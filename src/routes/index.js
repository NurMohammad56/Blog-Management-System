import express from "express";
const router = express.Router();

// Import all route files

import userRoutes from "./userRoutes.js";
import postRoutes from "./postRoutes.js";
import commentRoutes from "./commentRoutes.js";

// Mount route files
router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/comments", commentRoutes);

// API documentation
router.get("/", (req, res) => {
  res.json({
    message: "Blog API",
    version: "1.0.0",
    endpoints: {
      users: "/api/users",
      posts: "/api/posts",
      comments: "/api/comments",
    },
    documentation: "/api/docs",
  });
});

export default router;
