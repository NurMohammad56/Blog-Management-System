import mongoose, { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new Schema(
  {
    userName: {
      name: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "User must be atleast 3 characters"],
      maxlength: [30, "User cannot exceed 30 characters"],
      lowerCase: true,
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscore",
      ],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowerCase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be atleast 6 characters"],
      select: false,
    },

    passwordChangedAt: Date,
    passwordResetToken: Date,
    passwordResetExpires: Date,

    firstName: {
      type: String,
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    avatar: {
      type: String,
      default: "/images/default-avatar.png",
    },

    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },

    role: {
      type: String,
      enum: ["user", "author", "admin"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    lastLoginAt: Date,
    loginAttempts: {
      type: Number,
      defualt: 0,
    },

    lockUntil: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

userSchema.virtual("fullName").get(function () {
  return (
    `${this.firstName || ""} ${this.lastName || ""}`.trim() || this.userName
  );
});

userSchema.virtual("profileUrl").get(function () {
  return `/users/${this.userName}`;
});

userSchema.methods = {
  comparePassword: async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  },

  changePasswordAfter: function (JWTTimestamps) {
    if (this.passwordChangeAt) {
      const changedTime = parseInt(this.passwordChangeAt.getTime() / 1000, 10);

      return JWTTimestamps < changedTime;
    }

    return false;
  },

  createPasswordResetToken: function () {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
  },

  isLocked: function () {
    return !!(this.isLocked && this.lockUntil > Date.now());
  },

  incrementLoginAttempts: function () {
    if (this.lockUntil && this.lockUntil < Date.now()) {
      return this.updateOne({
        $set: { loginAttempts: 1 },
        $unset: { lockUntil: 1 },
      });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
      updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
    }

    return this.updateOne(updates);
  },
};

userSchema.statics = {
  findByEmailOrUsername: function (identifier) {
    return this.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { userName: identifier.toLowerCase() },
      ],
    }).select("+password");
  },

  exist: async function (field, value) {
    const count = await this.countDocuments({ [field]: value });
    return count > 0;
  },

  getPaginated: async function (
    filter = {},
    page = 1,
    limit = 10,
    sort = "-createdAt",
  ) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.find(filter).sort(sort).skip(skip).limit(limit).select("-v"),

      this.countDocuments(filter),
    ]);

    return {
      users,
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
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.getSalt(10);

    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.loginAttempts;
  delete user.lockUntil;
  delete user.__v;
  return user;
};

export const User = model("User", userSchema);
