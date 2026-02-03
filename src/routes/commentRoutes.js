import express from "express";
import { CommentController } from "../controllers/commentController";
import { validate } from "../middleware/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/:id", CommentController.getCommentById);

// Protected routes
router.use(authenticate);

// Create comment
router.post("/", validate("createComment"), CommentController.createComment);

// Update comment
router.put("/:id", validate("updateComment"), CommentController.updateComment);

// Delete comment
router.delete("/:id", CommentController.deleteComment);

// Like/unlike comment
router.post("/:id/like", CommentController.toggleLike);

// Report comment
router.post(
  "/:id/report",
  validate("reportComment"),
  CommentController.reportComment,
);

// User's comments
router.get("/user/my-comments", CommentController.getMyComments);

// Admin routes
router.post(
  "/:id/moderate",
  authorize("admin"),
  validate("moderateComment"),
  CommentController.moderateComments,
);

export default router;
