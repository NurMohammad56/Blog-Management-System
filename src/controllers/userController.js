import { UserService } from "../services/userService.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { responseHelpers } from "../utils/ResponseHelper.js";
import { User } from "../models/userModel.js";

export class UserController {
  static register = asyncHandler(async (req, res) => {
    const { userName, email, password, firstName, lastName } = req.body;

    const { user, token } = await UserService.register({
      userName,
      email,
      password,
      firstName,
      lastName,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.created(user);
  });

  static login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { user, token } = await UserService.login(email, password);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.success(user);
  });

  static getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const user = await UserService.getProfile(userId);
    res.success(user);
  });

  static updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const updateData = req.body;

    if (req.file) {
      updateData.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    const user = await UserService.updateProfile(userId, updateData);
    res.success(user);
  });

  static changePassword = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const { user, token } = await UserService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.success(user);
  });

  static forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const result = await UserService.forgotPassword(email);

    res.success(result);
  });

  static resetPassword = asyncHandler(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    const { user, token } = await UserService.resetPassword({
      resetToken,
      newPassword,
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.success(user);
  });

  static logout = asyncHandler(async (req, res) => {
    res.clearCookie("token");
    res.noContent();
  });

  static getAllUser = asyncHandler(async (req, res) => {
    const users = await UserService.getAllUser(req.query);
    res.success(users);
  });
}
