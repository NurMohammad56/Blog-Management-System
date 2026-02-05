import { Comment } from "../models/commentModel.js";
import { Post } from "../models/postModel.js";
import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";

export class CommentService {
  static async createComment(authorId, commentData) {
    try {
      const post = await Post.findById(commentData.post);

      if (!post || post.isDeleted) {
        throw new AppError("Post not found", 404);
      }

      // vErify if post is published
      if (
        post.status != "published" ||
        (post.publishedAt && post.publishedAt > new Date())
      ) {
        throw new AppError("Post is not published yet", 400);
      }

      // Verify user exist
      const user = await User.findById(authorId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Check parent comment if replying
      if (commentData.parentComment) {
        const parentComment = await Comment.findById(commentData.parentComment);

        if (!parentComment) {
          throw new AppError("Parent comment not found", 404);
        }

        if (parentComment.isHidden) {
          throw new AppError("Parent comment is hidden", 400);
        }

        commentData.depth = parentComment.depth + 1;

        //Limit nesting depth
        if (commentData.depth > 3) {
          throw new AppError("Comment depth limit exceeded", 400);
        }
      }

      const comment = await Comment.create({
        ...commentData,
        author: authorId,
      });

      await comment.populate("author", "userName avatar fullName");

      return comment;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to create comment", 500);
    }
  }

  static async getCommentByPost(postId, options = {}) {
    try {
      const post = await Post.findById(postId);

      if (!post || post.isDeleted) {
        throw new AppError("Post not found", 404);
      }

      const result = await Comment.getCommentByPost(postId, options);

      return result;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to get comments", 500);
    }
  }

  static async getCommentById(commentId) {
    try {
      const comment = await Comment.findById(commentId)
        .populate("author", "userName avatar fullName")
        .populate({
          path: "replies",
          populate: {
            path: "author",
            select: "userName avatar fullName",
          },
        });

      if (!comment || comment.isHidden) {
        throw new AppError("Comment not found", 404);
      }

      return comment;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to get comment", 500);
    }
  }

  static async updateComment(commentId, updateData, userId) {
    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new AppError("Comment not found", 404);
      }

      const isAuthor = comment.author.toString() === userId.toString();
      const isAdmin = await this.checkAdmin(userId);

      if (!isAuthor && !isAdmin) {
        throw new AppError("You are not allowed to update this comment", 403);
      }

      // Only allow content update
      const allowedUpdates = ["content"];
      const updates = {};

      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      Object.assign(comment, updates);
      await comment.save();

      await comment.populate("author", "userName avatar fullName");

      return comment;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to update comment", 500);
    }
  }

  static async deleteComment(commentId, userId) {
    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new AppError("Comment not found", 404);
      }

      const isAuthor = comment.author.toString() === userId.toString();
      const isAdmin = await this.checkAdmin(userId);
      const isPostAuthor = await this.checkPostAuthor(comment.post, userId);

      if (!isAuthor && !isAdmin && !isPostAuthor) {
        throw new AppError("You are not allowed to delete this comment", 403);
      }

      comment.isHidden = true;
      comment.hiddenBy = userId;
      comment.hiddenAt = Date.now();
      comment.hiddenReason = "Deleted by user";

      await comment.save();

      return { message: "Comment deleted successfully" };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to delete comment", 500);
    }
  }

  static async toggelike(commentId, userId) {
    try {
      const comment = await Comment.toggleLike(commentId, userId);

      if (!comment || comment.isHidden) {
        throw new AppError("Comment not found", 404);
      }

      const liked = comment.likes.includes((id) => id.toString() === userId);

      return {
        liked,
        likesCount: comment.likesCount,
        message: liked ? "Comment unliked" : "Comment liked",
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to toggle like", 500);
    }
  }

  static async reportComment(commentId, userId, reason) {
    try {
      const comment = await Comment.reportComment(commentId, userId, reason);

      if (!comment || comment.isHidden) {
        throw new AppError("Comment not found", 404);
      }

      return {
        message: "Comment reported successfully",
        reportCount: comment.reportCount,
        isHidden: comment.isHidden,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to report comment", 500);
    }
  }

  static async getUserComment(userId, options = {}) {
    try {
      const { page = 1, limit = 20, includeHidden = false } = options;

      const filter = { author: userId };

      if (!includeHidden) {
        filter.isHidden = false;
      }

      const skip = (page - 1) * limit;

      const [comments, total] = await Promise.all([
        Comment.find(filter)
          .populate("author", "userName avatar fullName")
          .populate("post", "title")
          .sort("-createdAt")
          .skip(skip)
          .limit(limit),
        Comment.countDocuments(filter),
      ]);

      return {
        comments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to get user comments", 500);
    }
  }

  static async ModerateComment(commentId, action, moderateId, reason) {
    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new AppError("Comment not found", 404);
      }

      switch (action) {
        case "hide":
          comment.isHidden = true;
          comment.hiddenBy = comment.author;
          comment.hiddenAt = Date.now();
          comment.hiddenReason = reason;
          break;
        case "unhide":
          comment.isHidden = false;
          comment.hiddenBy = null;
          comment.hiddenAt = null;
          comment.hiddenReason = null;
          break;

        case "clear_reports":
          comment.reportedBy = [];
          comment.reportCount = 0;

        default:
          throw new AppError("Invalid action", 400);
      }

      await comment.save();

      return {
        message: `Comment ${action === "hide" ? "hidden" : "unhidden"} successfully`,
        comment,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to moderate comment", 500);
    }
  }

  static async checkAdmin(userId) {
    try {
      const user = await User.findById(userId);

      return user && user.role === "admin";
    } catch (error) {
      throw error;
    }
  }

  static async checkPostAuthor(postId, userId) {
    try {
      const post = await Post.findById(postId);

      return post && post.author.toString() === userId.toString();
    } catch (error) {
      throw error;
    }
  }
}
