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
