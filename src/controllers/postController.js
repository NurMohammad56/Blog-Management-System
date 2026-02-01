import { PostService } from "../services/postService.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { Post } from "../models/postModel";

export class PostController {
  static createpost = asyncHandler(async (req, res) => {
    const postData = req.body;
    const authorId = req.user._id;

    if (req.file) {
      postData.coverImage = `/uploads/posts/${req.file.filename}`;
    }

    const post = await PostService.createPost(postData, authorId);

    res.created({
      data: post,
      message: "Post created successfully",
    });
  });

  static getAllPosts = asyncHandler(async (req, res) => {
    const posts = await PostService.getAllPosts(req.query);

    res.success({
      data: posts,
      message: "Posts fetched successfully",
    });
  });

  static getPostById = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const incrementView = req.query.increment === "true";

    const post = await PostService.getPostById(postId, incrementView);

    res.success({
      data: { post },
      message: "Post fetched successfully",
    });
  });

  static updatePost = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const updateData = req.body;
    const userId = req.user._id;

    if (req.file) {
      updateData.coverImage = `/uploads/posts/${req.file.filename}`;
    }

    const post = await PostService.updatePost(postId, updateData, userId);

    res.success({
      data: { post },
      message: "Post updated successfully",
    });
  });

  static deletePost = asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const userId = req.user._id;

    const result = await PostService.deletePost(postId, userId);

    res.success({
      message: result.message,
    });
  });

  static toggleLike = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const postId = req.params.id;

    const result = await PostService.toggleLike(postId, userId);

    res.success({
      message: result.message,
      data: {
        liked: result.liked,
        likesCount: result.likesCount,
      },
    });
  });

  static getMyPosts = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const posts = await PostService.getMyPosts(userId, req.query);

    res.success({
      data: posts,
      message: "Posts fetched successfully",
    });
  });

  static getPostsByUser = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const result = await PostService.getPostsByUser(userId, {
      ...req.query,
      category,
    });

    res.success({
      data: result,
      message: "Posts fetched successfully",
    });
  });

  static getPostByTag = asyncHandler(async (req, res) => {
    const tag = req.params.tag;

    const result = await PostService.getAllPosts({
      ...req.query,
      tag,
    });

    res.success({
      data: result,
      message: "Posts fetched successfully",
    });
  });

  static searchPosts = asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q) {
      return next(new AppError("Please provide a search query", 400));
    }

    const result = await PostService.getAllPosts({
      ...req.query,
      q,
    });

    res.success({
      data: result,
      message: "Posts fetched successfully",
    });
  });
}
