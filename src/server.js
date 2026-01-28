import app from "./app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

let server;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    server = app.listen(PORT, () => {
      console.log(`
Server Started Successfully
===============================
Environment: ${process.env.NODE_ENV || "development"}
Port: ${PORT}
URL: http://localhost:${PORT}
PID: ${process.pid}
      `);
    });
  })
  .catch((error) => {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  });

mongoose.connection.on("error", (error) => {
  console.error("MongoDB runtime error:", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

const shutdown = (signal) => {
  console.log(`\n Received ${signal}. Shutting down gracefully...`);

  if (!server) {
    process.exit(1);
  }

  server.close(() => {
    console.log("HTTP server closed");

    mongoose.connection.close(false, () => {
      console.log("🗄️ MongoDB connection closed");
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("Force shutdown due to timeout");
    process.exit(1);
  }, 5000);
};

process.on("SIGINT", shutdown); // Ctrl + C
process.on("SIGTERM", shutdown); // Docker / PM2 / Kubernetes

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  shutdown("unhandledRejection");
});
