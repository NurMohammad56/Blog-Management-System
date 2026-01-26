import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { asyncHandler } from "../utils/AsyncHandler.js";

export class UserService {
  static register = asyncHandler(async (userdata) => {
    const existingUser = await User.findOne({
      $or: [{ email: userdata.email }, { userName: userdata.userName }],
    });

    if (existingUser) {
      if (existingUser.email === userdata.email) {
        throw new AppError("Email already exists", 400);
      }

      if (existingUser.userName === userdata.userName) {
        throw new AppError("Username already exists", 400);
      }
    }

    const user = await User.create({
      useName: userdata.userName,
      email: userdata.email,
      password: userdata.password,
      firstName: userdata.firstName,
      lastName: userdata.lastName,
    });

    const token = this.generateToken(user._id);

    user.password = undefined;

    return { user, token };
  });

  static login = asyncHandler(async (identifier, password) => {
    const user = await User.findByEmailOrUsername(identifier);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.isLocked()) {
      throw new AppError("Account is temporarily locked. Try again later", 401);
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new AppError("Invalid credentials", 401);
    }

    await user.updateOne({
      $set: { lastLogin: new Date() },
      $unset: { lockUntil: 1, loginAttempts: 1 },
    });

    const token = this.generateToken(user._id);

    user.password = undefined;

    return (user, token);
  });

  // Generate JWT Token
  static generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  };

  // Verify JWT Token
  static verifyToken = asyncHandler((token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
  });

  static getProfile = asyncHandler(async (userId) => {
    const user = await User.findById(userId).select(
      "-password -__v -loginAttempts -lockUntil",
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  });

  static updateProfile = asyncHandler(async (userId, data) => {
    const restrictedFields = [
      "password",
      "email",
      "role",
      "isActive",
      "isVerified",
      "lastLoginAt",
      "loginAttempts",
      "lockUntil",
    ];

    restrictedFields.forEach((field) => delete data[field]);

    const user = await User.findByIdAndUpdate(userId, data, {
      new: true,
      runValidators: true,
    }).select("-password -__v");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return user;
  });

  static changePassword = asyncHandler(
    async (userId, currentPassword, newPassword) => {
      const user = await User.findById(userId);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      const isPasswordValid = await user.comparePassword(currentPassword);

      if (!isPasswordValid) {
        throw new AppError("Invalid current password", 401);
      }

      user.password = newPassword;
      await user.save();

      const token = this.generateToken(user._id);

      return { user, token };
    },
  );

  static forgotPassword = asyncHandler(async (email) => {
    const user = await User.findOne({ email });

    if (!user) {
      return { message: "If email exist, reset instruction sent" };
    }

    const resetToken = user.createPasswordResetToken();

    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    console.log(`Password reset URL: ${resetUrl}`);

    return { message: "If email exist, reset instruction sent" };
  });

  static resetPassword = asyncHandler(async (resetToken, newPassword) => {
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError("Token is invalid or has expired", 400);
    }

    user.password = newPassword;

    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    const token = this.generateToken(user._id);

    return { user, token };
  });

  static getAllUser = asyncHandler(async (query = {}) => {
    const { search = {}, page = 1, limit = 10 } = query;

    const filter = {};

    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const result = await User.getPaginated(filter, page, limit);

    return result;
  });
}
