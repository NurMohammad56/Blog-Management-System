import { CommentService } from "../services/commentService.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

export class CommentController {
  static createComment = asyncHandler(async (req, res) => {
    const commentData = req.body;
    const authorId = req.user._id;

    const comment = await CommentService.createComment(authorId, commentData);

    res.created({
      data: { comment },
      message: "Comment created successfully",
    });
  });

  static getCommentsByPosts = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const options = req.query;

    const result = await CommentService.getCommentsByPosts(postId, options);

    res.success({
      data: { result },
      message: "Comments fetched successfully",
    });
  });

  static getCommentById = asyncHandler(async (req, res) => {
    const commentId = req.params.id;

    const comment = await CommentService.getCommentById(commentId);

    res.success({
      data: { comment },
      message: "Comment fetched successfully",
    });
  });

  static updateComment = asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const updateData = req.body;
    const userId = req.user._id;

    const comment = await CommentService.updateComment(
      commentId,
      updateData,
      userId,
    );

    res.success({
      data: { comment },
      message: "Comment updated successfully",
    });
  });

  static deleteComment = asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user._id;

    const comment = await CommentService.deleteComment(commentId, userId);

    res.success({
      message: result.message,
    });
  });

  static toggleLike = asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user._id;

    const result = await CommentService.toggelike(commentId, userId);

    res.success({
      message: result.message,
      data: {
        liked: result.liked,
        likesCount: result.likesCount,
      },
    });
  });

  static reportComment = asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user._id;
    const reason = req.body.reason;

    const result = await CommentService.reportComment(
      commentId,
      userId,
      reason,
    );

    res.success({
      message: result.message,
      data: {
        reportCount: result.reportCount,
        isHidden: result.isHidden,
      },
    });
  });

  static getMyComments = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const options = req.query;

    const result = await CommentService.getMyComments(userId, {
      ...options,
      isHidden: false,
    });

    res.success({
      data: { result },
      message: "Comments fetched successfully",
    });
  });

  static moderateComments = asyncHandler(async (req, res) => {
    const commentId = req.params.id;
    const moderatorId = req.user._id;
    const { action, reason } = req.body;

    const result = await CommentService.moderateComments(
      commentId,
      moderatorId,
      action,
      reason,
    );

    res.success({
      message: "Comment moderated successfully",
      data: { comment: result.comment },
    });
  });
}
