import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { uploadImage } from "./config/cloudinary.js";
import { ApiError, errorHandler } from "./utils/errors.js";
import {
  authRateLimit,
  browserSecurity,
  originAllowed,
} from "./middleware/security.js";

export function createApp(options = {}) {
  const config = {
    jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET,
    clientUrl:
      options.clientUrl ?? process.env.CLIENT_URL ?? "http://localhost:5173",
    production: options.production ?? process.env.NODE_ENV === "production",
  };
  const app = express();
  app.disable("x-powered-by");
  if (options.trustProxy) app.set("trust proxy", options.trustProxy);
  app.locals.config = config;
  app.locals.uploadImage = options.uploadImage || uploadImage;
  app.use(browserSecurity(config));
  app.use(
    cors({
      origin: (origin, done) => done(null, originAllowed(origin, config)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "3mb" }));
  app.use(cookieParser());
  app.get("/api/health", (_req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res
      .status(ready ? 200 : 503)
      .json({ success: ready, status: ready ? "ok" : "unavailable" });
  });
  app.use("/api/auth", authRateLimit(options.authRateLimit), authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/matches", matchRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api", (_req, _res, next) =>
    next(new ApiError(404, "La ruta no existe.", "NOT_FOUND")),
  );
  if (config.production) {
    const dist = fileURLToPath(new URL("../client/dist/", import.meta.url));
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
  app.use((_req, _res, next) =>
    next(new ApiError(404, "La ruta no existe.", "NOT_FOUND")),
  );
  app.use(errorHandler);
  return app;
}
