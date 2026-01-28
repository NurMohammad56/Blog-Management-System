import mongoose, { Schema, model } from "mongoose";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      minlength: [1, "Comment cannot be empty"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    depth: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    likesCount: {
      type: Number,
      default: 0,
    },

    repliesCount: {
      type: Number,
      default: 0,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: Date,

    isHidden: {
      type: Boolean,
      default: false,
    },

    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    hiddenReason: String,

    hiddenAt: Date,

    reportCount: {
      type: Number,
      default: 0,
    },

    reportedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reason: String,
        reportedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

commentSchema.virtual("replies", {
  ref: "Comment",
  localField: "_id",
  foreignField: "parentComment",
  options: { sort: { createdAt: -1 } },
});

commentSchema.index({ post: 1, depth: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ author: 1 });

// Middleware to upate count
commentSchema.pre("save", async function (next) {
  // Update likes count
  if (this.likes && Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }

  // Mark as edited if content changed
  if (this.isModified("content") && !this.isNew) {
    this.isEdited = true;
    this.editedAt = Date.now();
  }

  // Update post comment count
  if (!this.isNew) {
    const post = mongoose.model("Post");
    await post.findByIdAndUpdate(this.post, { $inc: { commentsCount: 1 } });

    // Update parant comment replies count
    if (this.parantComment) {
      await mongoose
        .model("Comment")
        .findByIdAndUpdate(this.parentComment, { $inc: { repliesCount: 1 } });
    }
  }

  next();
});

// Middleware to handle deletion
commentSchema.pre("remove", async function (next) {
  const Post = mongoose.model("Post");
  const Comment = mongoose.model("Comment");

  await Post.findByIdAndUpdate(this.post, {
    $inc: { commentsCount: -1 },
  });

  // Decrement parent comment replies count
  if (this.parentComment) {
    await Comment.findByIdAndUpdate(this.parentComment, {
      $inc: { repliesCount: -1 },
    });
  }

  // Delete replies
  await Comment.deleteMany({ parentComment: this._id });

  next();
});

commentSchema.statics = {
  async getCommentByPost(postI, option = {}) {
    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      depth = 0,
      includeReplies = true,
    } = option;

    const skip = (page - 1) * limit;

    let query = {
      post: postI,
      isHidden: false,
    };

    if (depth === 0) {
      query.parentComment = null;
    } else if (depth > 0) {
      query.depth = depth;
    }

    const [comments, total] = await Promise.all([
      this.find(query)
        .populate("author", "userName avatar fullName")
        .sort(sort === "newest" ? "-createdAt" : "createdAt")
        .skip(skip)
        .limit(limit),
      this.countDocuments(query),
    ]);

    // Populate replies
    if (includeReplies && depth === 0) {
      for (let comment of comments) {
        comment.replies = await this.getReplies(comment._id, 1);
      }
    }

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
  },

  async getReplies(commentId, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];

    const replies = await this.find({
      parentComment: commentId,
      isHidden: false,
    })
      .populate("author", "userName avatar fullName")
      .sort("-createdAt");

    // Recursively get nested replies
    for (let reply of replies) {
      reply.replies = await this.getReplies(
        reply._id,
        maxDepth,
        currentDepth + 1,
      );
    }

    return replies;
  },

  async toggleLike(commentId, userId) {
    const comment = await this.findById(commentId);

    if (!comment) throw new Error("Comment not found");

    const likeIndex = comment.likes.indexOf(userId);

    if (likeIndex > -1) {
      comment.likes.splice(likeIndex, 1);
    } else {
      comment.likes.push(userId);
    }

    await comment.save();
    return comment;
  },

  async reportComment(commentId, userId, reason) {
    const comment = this.findById(commentId);

    if (!comment) throw new Error("Comment not found");

    const alreadyReported = await comment.reportedBy.some(
      (report) => report.reportedBy.toString() === userId.toString(),
    );

    if (!alreadyReported) {
      comment.reportedBy.push({
        user: userId,
        reason: reason || "Inappropriate content",
        reportedAt: Date.now(),
      });

      comment.reportCount += 1;

      if (comment.reportCount >= 3) {
        comment.isHidden = true;
        comment.hiddenBy = userId;
        comment.hiddenAt = Date.now();
        comment.hiddenReason = "Multiple reports";
      }

      await comment.save;
    }

    return comment;
  },
};

export const Comment = model("Comment", commentSchema);
