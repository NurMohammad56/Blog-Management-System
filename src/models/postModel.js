import mongoose, { Schema, model } from "mongoose";

const postSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Post title is required"],
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      minlength: 50,
    },

    excerpt: {
      type: String,
      maxlength: 300,
    },

    coverImage: {
      type: String,
      default: "/images/blog-cover.jpg",
    },

    category: {
      type: String,
      enum: ["technology", "culture", "lifestyle", "food", "fashion"],
      default: "technology",
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    metaTitle: String,
    metaDescription: String,

    views: {
      type: Number,
      default: 0,
    },

    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    likesCount: {
      type: Number,
      default: 0,
    },

    commentCount: {
      type: Number,
      default: 0,
    },

    readingTime: {
      type: Number,
      default: 0,
    },

    publishedAt: Date,

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtuals comment
postSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
});

// Generate slug before saving
postSchema.pre("save", function (next) {
  if (!this.isModified("title")) return next();

  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\w]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();

  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 200) + "...";
  }

  if (this.isModified("content")) {
    const wordCount = this.content.split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }

  next();
});

postSchema.pre("save", function (next) {
  if (this.likes && Array.isArray(this.likes)) {
    this.likesCount = this.likes.length;
  }
  next();
});

postSchema.statics = {
  async getPublishedPosts(
    filter = {},
    page = 1,
    limit = 10,
    sort = "-publishedAt",
  ) {
    const query = { ...filter, status: "published", isDeleted: false };

    if (query.publishedAt) query.publishedAt = { $lte: new Date() };

    const skip = (page - 1) * limit;

    const [post, total] = await Promise.all([
      this.find(query)
        .populate("author", "userName avatar")
        .sort(sort)
        .skip(skip)
        .limit(limit),

      this.countDocuments(query),
    ]).then(([post, total]) => [post, total]);

    return {
      post,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  },

  async incrementViews(postId) {
    return this.findByIdAndUpdate(
      postId,
      { $inc: { views: 1 } },
      { new: true },
    );
  },

  async toggleLike(postId, userId) {
    const post = await this.findById(postId);

    if (!post) throw new Error("Post not found");

    const likeIndex = post.likes.indexOf(userId);

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return post;
  },
};

export const Post = model("Post", postSchema);
