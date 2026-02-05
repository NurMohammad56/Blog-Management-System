import { Post } from "../models/postModel.js";
import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";
import { Comment } from "../models/commentModel.js";
import fs from "fs";
import path from "path";

export class PostService {
  static async createPost(postData, authorId) {
    try {
      const author = await User.findById(authorId);

      if (!author) {
        console.log("Author not found:", authorId);

        throw new AppError("Author not found", 404);
      }

      if (author.role === "user") {
        console.log("User not authorized to create posts:", author.role);

        throw new AppError("You are not allowed to create a post", 403);
      }

      if (!postData.excerpt && postData.content) {
        postData.excerpt = postData.content.substring(0, 200) + "...";
      }

      if (postData.content) {
        const wordCount = postData.content.split(/\s+/).length;
        postData.readingTime = Math.ceil(wordCount / 200);
      }

      if (postData.status === "published" && !postData.publishedAt) {
        postData.publishedAt = new Date();
      }

      const post = await Post.create({
        ...postData,
        author: authorId,
      });

      await post.populate("author", "username avatar fullName email");

      return post;
    } catch (error) {
      console.log("PostService.createPost error: ", error.message, error.stack);

      if (error.code === 11000 && error.keyPattern?.slug) {
        throw new AppError("Post with this slug already exists", 400);
      }

      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => err.message);
        throw new AppError(errors.join(", "), 400);
      }

      throw new AppError("Failed to create post", 500);
    }
  }

  static async getPostById(postId, optins = {}) {
    try {
      const {
        incrementViews = false,
        includeAuthor = false,
        includeComments = false,
        commentLimit = 10,
      } = optins;

      let query = Post.findById(postId);

      if (incrementViews) {
        query = query.updateOne({ $inc: { views: 1 } });
      }

      if (includeAuthor) {
        query = query.populate("author", "userName avatar");
      }

      const post = await query;

      if (post.isDeleted) {
        throw new AppError("Post not found", 404);
      }

      if (post.status !== "published") {
        throw new AppError("Post is not published yet", 400);
      }

      if (includeComments) {
        const comments = await Comment.find({
          post: postId,
          parentComment: null,
          isHidden: false,
        })
          .populate("author", "userName avatar fullName")
          .sort("-createdAt")
          .limit(commentLimit);

        post.comments = comments;
      }

      return post;
    } catch (error) {
      console.error("PostService.getPostById error:", error.message);

      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === "CastError") {
        throw new AppError("Invalid post ID", 400);
      }

      throw new AppError("Failed to retrieve post", 500);
    }
  }

  static async getAllPosts(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        includeAuthor = false,
        category,
        tag,
        author,
        status,
        search,
        sortBy = "publishedAt",
        sortOrder = "desc",
      } = filters;

      const filter = { isDeleted: false };

      if (status === "published") {
        filter.status = "published";
        filter.publishedAt = { $lte: new Date() };
      } else if (status) {
        filter.status = status;
      }

      if (category) {
        filter.category = category;
      }

      if (tag) {
        filter.tags = tag;
      }

      if (author) {
        const authorUser = await User.findById({
          $or: [{ userName: author }, { email: author }, { _id: author }],
        });

        if (authorUser) {
          filter.author = authorUser._id;
        }
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { excerpt: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;

      const sort = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      let query = Post.find(filter).sort(sort).skip(skip).limit(limit);

      if (includeAuthor) {
        query = query.populate("author", "userName avatar");
      }

      const posts = await query;

      const total = await Post.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      return {
        posts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          category,
          tag,
          author,
          status,
          search,
          sortBy,
          sortOrder,
        },
      };
    } catch (error) {
      console.error("PostService.getAllPosts error:", error.message);
      throw new AppError("Failed to retrieve posts", 500);
    }
  }

  static async updatePost(postId, updateData, userId) {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        throw new AppError("Post not found", 404);
      }

      if (post.isDeleted) {
        throw new AppError("Post has been deleted", 404);
      }

      const isAuthor = post.author.toString() === userId.toString();
      const isAdmin = await this.checkAdmin(userId);

      if (!isAuthor && !isAdmin) {
        throw new AppError("You are not allowed to update this post", 403);
      }

      const allowedUpdates = [
        "title",
        "content",
        "excerpt",
        "coverImage",
        "category",
        "status",
        "metaTitle",
        "metaDescription",
      ];

      const updates = {};
      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      if (updates.status === "published" && post.status !== "published") {
        updates.publishedAt = new Date();
      }

      if (updates.title && updates.title !== post.title) {
        updates.slug = updates.title
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, "-")
          .replace(/--+/g, "-")
          .trim();

        const existingPost = await Post.findOne({
          slug: updates.slug,
          _id: { $ne: postId },
        });

        if (existingPost) {
          updates.slug = `${updates.slug}-${Date.now()}`;
        }
      }

      if (updates.content && !updates.excerpt) {
        updates.excerpt = updates.content.substring(0, 200) + "...";
      }

      if (updates.content) {
        const wordCount = updates.content.split(/\s+/).length;
        updates.readingTime = Math.ceil(wordCount / 200);
      }

      Object.assign(post, updates);
      await post.save();

      await post.populate("author", "userName avatar fullName");

      return post;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to update post", 500);
    }
  }

  static async deletePost(postId, userId) {
    try {
      const post = await Post.findById(postId);

      if (!post) {
        throw new AppError("Post not found", 404);
      }

      if (post.isDeleted) {
        throw new AppError("Post already deleted", 400);
      }

      // 2. Check authorization
      const user = await User.findById(userId);
      const isAdmin = user?.role === "admin";
      const isAuthor = post.author.toString() === userId.toString();

      if (!isAdmin && !isAuthor) {
        throw new AppError("You are not authorized to delete this post", 403);
      }

      // 3. Soft delete the post
      post.isDeleted = true;
      post.deletedAt = new Date();
      post.deletedBy = userId;

      // 4. Delete associated cover image if exists
      if (
        post.coverImage &&
        post.coverImage !== "/images/default-post-cover.jpg"
      ) {
        await this.deletePostImage(post.coverImage);
      }

      await post.save();

      console.log("Post soft deleted successfully:", postId);

      return {
        message: "Post deleted successfully",
        postId,
        deletedAt: post.deletedAt,
      };
    } catch (error) {
      console.error("PostService.deletePost error:", error.message);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to delete post", 500);
    }
  }

  static async toggleLike(postId, userId) {
    try {
      console.log("PostService.toggleLike called:", { postId, userId });

      // 1. Find the post
      const post = await Post.findById(postId);

      if (!post || post.isDeleted) {
        throw new AppError("Post not found", 404);
      }

      if (post.status !== "published") {
        throw new AppError("Cannot like unpublished post", 400);
      }

      // 2. Check if user already liked the post
      const likeIndex = post.likes.indexOf(userId);

      let action;
      if (likeIndex > -1) {
        // Unlike
        post.likes.splice(likeIndex, 1);
        action = "unliked";
      } else {
        // Like
        post.likes.push(userId);
        action = "liked";
      }

      // Update likes count
      post.likesCount = post.likes.length;

      await post.save();

      console.log("Post", action, "successfully:", postId);

      return {
        action,
        likesCount: post.likesCount,
        liked: action === "liked",
      };
    } catch (error) {
      console.error("PostService.toggleLike error:", error.message);

      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === "CastError") {
        throw new AppError("Invalid post ID", 400);
      }

      throw new AppError("Failed to toggle like", 500);
    }
  }

  static async getPostsByUser(userId, options = {}) {
    try {
      console.log("PostService.getPostsByUser called:", { userId, options });

      const {
        page = 1,
        limit = 10,
        status,
        includeDrafts = false,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;

      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const filter = {
        author: userId,
        isDeleted: false,
      };

      if (status) {
        filter.status = status;
      } else if (!includeDrafts) {
        filter.status = "published";
      }

      const skip = (page - 1) * limit;

      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const [posts, total] = await Promise.all([
        Post.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("author", "username avatar"),
        Post.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);
      console.log("User posts retrieved:", posts.length, "of", total);

      return {
        posts,
        user: {
          id: user._id,
          username: user.username,
          avatar: user.avatar,
          fullName: user.fullName,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error("PostService.getPostsByUser error:", error.message);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Failed to retrieve user posts", 500);
    }
  }

  static async getPostStatistics(authorId = null) {
    try {
      console.log("PostService.getPostStatistics called:", { authorId });

      const filter = { isDeleted: false };
      if (authorId) {
        filter.author = authorId;
      }

      const totalPosts = await Post.countDocuments(filter);

      const publishedPosts = await Post.countDocuments({
        ...filter,
        status: "published",
      });

      const draftPosts = await Post.countDocuments({
        ...filter,
        status: "draft",
      });

      const totalViews = await Post.aggregate([
        { $match: filter },
        { $group: { _id: null, totalViews: { $sum: "$views" } } },
      ]);

      const totalLikes = await Post.aggregate([
        { $match: filter },
        { $group: { _id: null, totalLikes: { $sum: "$likesCount" } } },
      ]);

      const totalComments = await Post.aggregate([
        { $match: filter },
        { $group: { _id: null, totalComments: { $sum: "$commentsCount" } } },
      ]);

      const mostViewed = await Post.find(filter)
        .sort({ views: -1 })
        .limit(5)
        .select("title views likesCount commentsCount");

      const mostLiked = await Post.find(filter)
        .sort({ likesCount: -1 })
        .limit(5)
        .select("title views likesCount commentsCount");

      const postsByCategory = await Post.aggregate([
        { $match: filter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const postsByMonth = await Post.aggregate([
        {
          $match: {
            ...filter,
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      console.log("Post statistics retrieved");

      return {
        totals: {
          all: totalPosts,
          published: publishedPosts,
          draft: draftPosts,
          views: totalViews[0]?.totalViews || 0,
          likes: totalLikes[0]?.totalLikes || 0,
          comments: totalComments[0]?.totalComments || 0,
        },
        analytics: {
          mostViewed,
          mostLiked,
          postsByCategory,
          postsByMonth: postsByMonth.map((item) => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
            count: item.count,
          })),
        },
        averages: {
          viewsPerPost:
            totalPosts > 0
              ? Math.round((totalViews[0]?.totalViews || 0) / totalPosts)
              : 0,
          likesPerPost:
            totalPosts > 0 ? (totalLikes[0]?.totalLikes || 0) / totalPosts : 0,
          commentsPerPost:
            totalPosts > 0
              ? (totalComments[0]?.totalComments || 0) / totalPosts
              : 0,
        },
      };
    } catch (error) {
      console.error("PostService.getPostStatistics error:", error.message);
      throw new AppError("Failed to get post statistics", 500);
    }
  }

  static async searchPosts(searchQuery, options = {}) {
    try {
      console.log("PostService.searchPosts called:", {
        searchQuery,
        options,
      });

      const {
        page = 1,
        limit = 10,
        category,
        tag,
        author,
        sortBy = "relevance",
        sortOrder = "desc",
      } = options;

      const searchFilter = {
        isDeleted: false,
        status: "published",
        publishedAt: { $lte: new Date() },
        $text: { $search: searchQuery },
      };

      if (category) {
        searchFilter.category = category;
      }

      if (tag) {
        searchFilter.tags = { $in: [tag.toLowerCase()] };
      }

      if (author) {
        const authorUser = await User.findOne({ username: author });
        if (authorUser) {
          searchFilter.author = authorUser._id;
        }
      }

      const skip = (page - 1) * limit;

      let sort = {};
      if (sortBy === "relevance") {
        sort = { score: { $meta: "textScore" } };
      } else {
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;
      }

      let query = Post.find(searchFilter, {
        score: { $meta: "textScore" },
      })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("author", "username avatar");

      const posts = await query;

      const total = await Post.countDocuments(searchFilter);
      const totalPages = Math.ceil(total / limit);

      console.log("Search results:", posts.length, "of", total);

      return {
        posts,
        search: {
          query: searchQuery,
          totalResults: total,
          suggestedQueries: this.generateSearchSuggestions(searchQuery),
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error("🔥 PostService.searchPosts error:", error.message);

      // If text index doesn't exist, fallback to regex search
      if (error.code === 27) {
        return this.fallbackSearch(searchQuery, options);
      }

      throw new AppError("Failed to search posts", 500);
    }
  }

  static generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  static async deletePostImage(imagePath) {
    try {
      if (imagePath.startsWith("/uploads/posts/")) {
        const filename = imagePath.split("/").pop();
        const filePath = path.join(
          __dirname,
          "../../public/uploads/posts",
          filename,
        );

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("🗑️ Deleted post image:", filename);
        }
      }
    } catch (error) {
      console.error("Failed to delete post image:", error.message);
    }
  }

  static async fallbackSearch(searchQuery, options) {
    const filter = {
      isDeleted: false,
      status: "published",
      $or: [
        { title: { $regex: searchQuery, $options: "i" } },
        { content: { $regex: searchQuery, $options: "i" } },
        { excerpt: { $regex: searchQuery, $options: "i" } },
      ],
    };

    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort("-publishedAt")
        .skip(skip)
        .limit(limit)
        .populate("author", "username avatar"),
      Post.countDocuments(filter),
    ]);

    return {
      posts,
      search: {
        query: searchQuery,
        totalResults: total,
        note: "Using fallback search (text index not available)",
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    };
  }

  static generateSearchSuggestions(query) {
    const suggestions = [];

    const categories = [
      "technology",
      "lifestyle",
      "education",
      "entertainment",
      "business",
    ];
    categories.forEach((category) => {
      if (category.includes(query.toLowerCase())) {
        suggestions.push(`category:${category}`);
      }
    });

    // Add common tags
    const commonTags = [
      "javascript",
      "nodejs",
      "express",
      "mongodb",
      "react",
      "vue",
      "angular",
    ];
    commonTags.forEach((tag) => {
      if (tag.includes(query.toLowerCase())) {
        suggestions.push(`tag:${tag}`);
      }
    });

    return suggestions.slice(0, 5);
  }
}
