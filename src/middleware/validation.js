import { schemas } from "../validators/schemas.js";

export const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return res.status(500).json({
        success: false,
        message: "Validation schema not found",
      });
    }

    const errors = [];

    for (const field in schema) {
      const rules = schema[field];
      const value = req.body[field];

      // required check
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // type check
      if (rules.type === "string" && typeof value !== "string") {
        errors.push(`${field} must be a string`);
      }

      if (rules.type === "array" && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      }

      // length checks
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      // enum check
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of ${rules.enum.join(", ")}`);
      }

      // pattern check
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} format is invalid`);
      }
    }

    if (errors.length) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    next();
  };
};
