import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "../utils/AppError.js";
import sharp from "sharp";

const uploadDirs = {
  avatars: "public/uploads/avatars",
  posts: "public/uploads/posts",
  general: "public/uploads/general",
};

Object.values(uploadDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, res, cb) => {
    let folder = "general";

    if (file.fieldname === "avatar") {
      folder = "avatars";
    } else if (file.fieldname === "coverImage") {
      folder = "posts";
    }

    cb(null, uploadDirs[folder]);
  },

  filename: (req, res, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);

    const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;

    cb(null, filename);
  },
});

const processImage = (width = 800, height = 800) => {
  return async (req, res, next) => {
    if (!req.file) return next();

    try {
      const filePath = req.file.path;

      await sharp(filePath)
        .resize(width, height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .png({ quality: 80 })
        .webp({ quality: 80 })
        .toFile(filePath);

      next();
    } catch (error) {
      next(new AppError("Failed to process image", 500));
    }
  };
};

export const uploadAvatar = multer({
  storage: storage,
  fileFilter: fileFilter(["image/jpeg", "image/png", "image/webp"]),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
});

export const uploadPostImage = multer({
  storage: storage,
  fileFilter: fileFilter([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter(["image/jpeg", "image/png", "image/webp"]),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});
