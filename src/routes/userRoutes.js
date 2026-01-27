import express from "express";
const router = express.Router();

import { UserController } from "../controllers/userController.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../middlewares/validation.js";
import { uploadAvatar } from "../middlewares/upload.js";

// Public routes
router.post("/register", validate("register"), UserController.register);

router.post("/login", validate("login"), UserController.login);

router.post(
  "/forgot-password",
  validate("forgotPassword"),
  UserController.forgotPassword,
);

router.post(
  "/reset-password/:resetToken",
  validate("resetPassword"),
  UserController.resetPassword,
);

// Protected routes
router.get("/profile", authenticate, UserController.getProfile);

router.put(
  "/profile",
  authenticate,
  uploadAvatar.single("avatar"),
  validate("updateProfile"),
  UserController.updateProfile,
);

router.put(
  "/change-password",
  authenticate,
  validate("changePassword"),
  UserController.changePassword,
);

router.get("/logout", authenticate, UserController.logout);

// Admin only routes
router.get("/", authenticate, authorize("admin"), UserController.getAllUsers);

router.get(
  "/:id",
  authenticate,
  authorize("admin"),
  UserController.getUserById,
);

export default router;
