import express from "express";
import { PostController } from "../controllers/postController.js";
import { CommentController } from "../controllers/commentController.js";
import { authenticate, authorize, checkOwnerShip } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { uploadPostImage, processImage } from "../middleware/upload.js";
import { Post } from "../models/postModel.js";

const router = express.Router();

// Public routes
router.get("/", PostController.getAllPosts);
router.get("/search", PostController.searchPosts);
router.get("/tag/:tag", PostController.getPostByTag);
router.get("/user/:userId", PostController.getPostsByUser);
router.get("/:id", PostController.getPostById);

// Comments for post (public)
router.get("/:postId/comments", CommentController.getCommentsByPosts);

// Protected routes (authenticated users)
router.use(authenticate);

// Create post (Author/Admin only)
router.post(
  "/",
  authorize("author", "admin"),
  uploadPostImage.single("coverImage"),
  processImage(1200, 800),
  validate("createPost"),
  PostController.createpost,
);

// Update post (Owner or Admin)
router.put(
  "/:id",
  checkOwnerShip(Post, "id"),
  uploadPostImage.single("coverImage"),
  processImage(1200, 800),
  validate("updatePost"),
  PostController.updatePost,
);

// Delete post (Owner or Admin)
router.delete("/:id", checkOwnerShip(Post, "id"), PostController.deletePost);

// Like/unlike post
router.post("/:id/like", PostController.toggleLike);

// Comments (authenticated users)
router.post(
  "/:postId/comments",
  validate("createComment"),
  CommentController.createComment,
);

// User's own posts
router.get("/user/my-posts", PostController.getMyPosts);

// Comment management (on specific post)
router.put(
  "/:postId/comments/:commentId",
  validate("updateComment"),
  CommentController.updateComment,
);

router.delete("/:postId/comments/:commentId", CommentController.deleteComment);

router.post("/:postId/comments/:commentId/like", CommentController.toggleLike);

export default router;
