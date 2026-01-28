import multer from "multer";
import path from "path";
import fs from "fs";
import fsPromises from "fs/promises";
import sharp from "sharp";
import { AppError } from "../utils/AppError.js";

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

const fileFilter = (allowedMimeTypes) => {
  return (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Invalid file type: ${file.mimetype}. Only images are allowed.`,
          400,
        ),
        false,
      );
    }
  };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = uploadDirs.general;

    if (file.fieldname === "avatar") {
      folder = uploadDirs.avatars;
    } else if (file.fieldname === "coverImage") {
      folder = uploadDirs.posts;
    }

    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${file.fieldname}-${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${ext}`;

    cb(null, uniqueName);
  },
});

export const processImage =
  (width = 800, height = 800) =>
  async (req, res, next) => {
    if (!req.file) return next();

    try {
      const inputPath = req.file.path;
      const outputPath = inputPath.replace(path.extname(inputPath), ".webp");

      await sharp(inputPath)
        .resize(width, height, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat("webp", { quality: 80 })
        .toFile(outputPath);

      // Remove original file (NON-BLOCKING)
      await fsPromises.unlink(inputPath);

      // Update req.file with optimized image info
      req.file.path = outputPath;
      req.file.filename = path.basename(outputPath);

      next();
    } catch (error) {
      next(new AppError("Image processing failed", 500));
    }
  };

// Avatar upload (single image)
export const uploadAvatar = multer({
  storage,
  fileFilter: fileFilter(["image/jpeg", "image/png", "image/webp"]),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
});

// Post image upload (single image)
export const uploadPostImage = multer({
  storage,
  fileFilter: fileFilter([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

// Multiple images upload
export const uploadMultiple = multer({
  storage,
  fileFilter: fileFilter(["image/jpeg", "image/png", "image/webp"]),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
});
