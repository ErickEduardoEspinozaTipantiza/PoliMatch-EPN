import { ApiError } from "../utils/errors.js";

export const originAllowed = (origin, config) =>
  !origin || origin === config.clientUrl;

export function browserSecurity(config) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (
      !originAllowed(req.headers.origin, config) ||
      (req.headers["sec-fetch-site"] === "cross-site" &&
        !["GET", "HEAD", "OPTIONS"].includes(req.method))
    )
      return next(
        new ApiError(
          403,
          "El origen de esta solicitud no está permitido.",
          "ORIGIN_REJECTED",
        ),
      );
    next();
  };
}

export function authRateLimit({ max = 20, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    if (req.method !== "POST" || !["/login", "/signup"].includes(req.path))
      return next();
    const now = Date.now();
    if (attempts.size >= 10000)
      for (const [key, entry] of attempts)
        if (entry.until <= now) attempts.delete(key);
    const key = req.ip;
    let entry = attempts.get(key);
    if (!entry || entry.until <= now) {
      if (attempts.size >= 10000)
        return next(
          new ApiError(
            429,
            "Demasiados intentos. Inténtalo más tarde.",
            "RATE_LIMITED",
          ),
        );
      entry = { count: 0, until: now + windowMs };
      attempts.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.until - now) / 1000));
      return next(
        new ApiError(
          429,
          "Demasiados intentos. Inténtalo más tarde.",
          "RATE_LIMITED",
        ),
      );
    }
    next();
  };
}
