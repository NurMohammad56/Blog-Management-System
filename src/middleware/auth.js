import { AppError } from "../utils/AppError.js";
import { UserService } from "../services/userService.js";
import { User } from "../models/userModel.js";

export const authenticate = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    const decoded = UserService.verifyToken(token);

    const user = await User.findById(decoded.Id).select("+passwordChangeAt");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.passwordChangedAfter(decoded.iat)) {
      throw new AppError("User recently changed password", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...role) => {
  return (req, res, next) => {
    if (!role.user) {
      return next(new AppError("Not authorized to access this route", 401));
    }

    if (!role.includes(req.user.role)) {
      return next(
        new AppError("You are not allowed to access this route", 403),
      );
    }

    next();
  };
};

export const checkOwnerShip = (model, paramName = "id") => {
  return async (req, res, next) => {
    try {
      const resouceId = req.params[paramName];
      const userId = req.user._id;

      const resource = await model.findById(resouceId);

      if (!resource) {
        return next(new AppError("Resource not found", 404));
      }

      const isAdmin = req.user.role === "admin";
      const isOwner = resource.user.toString() === userId;

      if (!isAdmin && !isOwner) {
        return next(
          new AppError("You are not allowed to access this resource", 403),
        );
      }

      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};
