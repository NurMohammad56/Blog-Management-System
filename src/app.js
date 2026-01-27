import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";

import routeConfig from "./config/routeConfig.js";

import errorHandler from "./middlewares/errorHandler.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { responseHelpers } from "./utils/ResponseHelper.js";

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardsHeaders: true,
  legacyHeaders: false,
});

app.use("/api/v1", limiter);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(xss());

app.use(
  hpp({
    whitelist: ["category", "tags", "sort", "limit", "page"],
  }),
);

app.use(mongoSanitize());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.use(compression());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "public", "uploads")),
);

app.use(routeConfig);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("*", (req, res, next) => {
  const error = new Error(`Cannot find ${req.originalUrl} on this server`);
  error.statusCode = 404;
  next(error);
});

app.use(errorHandler);

app.use(requestLogger);
app.use(responseHelpers);

export default app;
