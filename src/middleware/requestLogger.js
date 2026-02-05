const green = "\x1b[32m";
const red = "\x1b[31m";
const cyan = "\x1b[36m";
const reset = "\x1b[0m";

export const requestLogger = (req, res, next) => {
  const start = Date.now();

  console.log(`${cyan}[http] →${reset} ${req.method} ${req.originalUrl}`);

  res.on("finish", () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? red : green;

    console.log(
      `${color}[http] ←${reset} ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
};
