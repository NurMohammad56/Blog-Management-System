import { User } from "../models/userModel.js";
import { AppError } from "../utils/AppError.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export class UserService {
  static async register(userdata) {
    try {
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
        userName: userdata.userName,
        email: userdata.email,
        password: userdata.password,
        firstName: userdata.firstName,
        lastName: userdata.lastName,
      });

      const token = this.generateToken(user._id);
      user.password = undefined;

      return { user, token };
    } catch (error) {
      throw error;
    }
  }

  static async login({ identifier, password }) {
    try {
      const user = await User.findByEmailOrUsername(identifier);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      if (user.isLocked()) {
        throw new AppError(
          "Account is temporarily locked. Try again later",
          401,
        );
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

      return { user, token };
    } catch (error) {
      throw error;
    }
  }

  static generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError("Invalid or expired token", 401);
    }
  }

  static async getProfile(userId) {
    try {
      const user = await User.findById(userId).select(
        "-password -__v -loginAttempts -lockUntil",
      );

      if (!user) {
        throw new AppError("User not found", 404);
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  static async updateProfile({ userId, data }) {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  static async changePassword({ userId, currentPassword, newPassword }) {
    try {
      const user = await User.findById(userId).select("+password");

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
      user.password = undefined;

      return { user, token };
    } catch (error) {
      throw error;
    }
  }

  static async forgotPassword({ email }) {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        return { message: "If email exists, reset instructions sent" };
      }

      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      console.log("Password reset URL:", resetUrl);

      return { message: "If email exists, reset instructions sent" };
    } catch (error) {
      throw error;
    }
  }

  static async resetPassword({ resetToken, newPassword }) {
    try {
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
      user.password = undefined;

      return { user, token };
    } catch (error) {
      throw error;
    }
  }

  static async getAllUser(query = {}) {
    try {
      const { search = "", page = 1, limit = 10 } = query;
      const filter = {};

      if (search) {
        filter.$or = [
          { userName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
        ];
      }

      return await User.getPaginated(filter, page, limit);
    } catch (error) {
      throw error;
    }
  }
}
