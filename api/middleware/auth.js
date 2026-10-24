import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { ApiError, asyncRoute } from "../utils/errors.js";

export async function authenticateToken(token, secret) {
  if (!token)
    throw new ApiError(401, "Inicia sesión para continuar.", "UNAUTHORIZED");
  let claims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(
      401,
      "La sesión expiró. Inicia sesión de nuevo.",
      "UNAUTHORIZED",
    );
  }
  if (
    typeof claims.id !== "string" ||
    !/^[a-f\d]{24}$/i.test(claims.id) ||
    typeof claims.jti !== "string"
  )
    throw new ApiError(401, "La sesión no es válida.", "UNAUTHORIZED");
  const [user, session] = await Promise.all([
    User.findById(claims.id),
    Session.findOne({
      _id: claims.jti,
      user: claims.id,
      expiresAt: { $gt: new Date() },
    }),
  ]);
  if (!user || !session)
    throw new ApiError(
      401,
      "La sesión no está disponible. Inicia sesión de nuevo.",
      "UNAUTHORIZED",
    );
  return { user, claims };
}

export const protectRoute = asyncRoute(async (req, _res, next) => {
  const { user, claims } = await authenticateToken(
    req.cookies.jwt,
    req.app.locals.config.jwtSecret,
  );
  req.user = user;
  req.auth = claims;
  next();
});
