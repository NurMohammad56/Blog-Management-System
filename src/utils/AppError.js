export class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);

    this.statusCode = statusCode;
    this.details = details;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}
