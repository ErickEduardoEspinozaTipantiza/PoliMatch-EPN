import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { ApiError, asyncRoute } from "../utils/errors.js";
import { email, objectBody, profileFields, text } from "../utils/validation.js";
import { ownUser } from "../utils/users.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: "strict",
  secure: req.app.locals.config.production,
  path: "/",
});

async function issueSession(user, req, res) {
  const id = randomUUID();
  const token = jwt.sign(
    { id: String(user._id) },
    req.app.locals.config.jwtSecret,
    { expiresIn: "7d", jwtid: id, algorithm: "HS256" },
  );
  await Session.create({
    _id: id,
    user: user._id,
    expiresAt: new Date(Date.now() + WEEK),
  });
  res.cookie("jwt", token, { ...cookieOptions(req), maxAge: WEEK });
}

// Legacy accounts may contain mixed-case addresses. Match them without rewriting
// existing records; new accounts remain normalized and protected by the unique index.
const legacyEmail = (value) =>
  new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

export const signup = asyncRoute(async (req, res) => {
  const body = objectBody(req.body);
  for (const field of ["name", "age", "gender", "genderPreference"])
    if (!Object.hasOwn(body, field))
      throw new ApiError(400, "Completa todos los campos obligatorios.");
  const data = profileFields(body);
  data.email = email(body.email);
  data.password = text(body.password, "La contraseña", {
    min: 6,
    max: 128,
    trim: false,
  });
  if (Buffer.byteLength(data.password, "utf8") > 72)
    throw new ApiError(
      400,
      "La contraseña es demasiado larga. Usa menos caracteres.",
    );
  if (await User.exists({ email: legacyEmail(data.email) }))
    throw new ApiError(
      409,
      "Ya existe una cuenta con ese correo.",
      "EMAIL_EXISTS",
    );
  const user = await User.create(data);
  await issueSession(user, req, res);
  res.status(201).json({ success: true, user: ownUser(user) });
});

export const login = asyncRoute(async (req, res) => {
  const body = objectBody(req.body);
  const normalized = email(body.email);
  const password = text(body.password, "La contraseña", {
    max: 128,
    trim: false,
  });
  const user =
    (await User.findOne({ email: normalized }).select("+password")) ||
    (await User.findOne({ email: legacyEmail(normalized) }).select(
      "+password",
    ));
  if (!user || !(await user.matchPassword(password)))
    throw new ApiError(
      401,
      "Correo o contraseña incorrectos.",
      "INVALID_CREDENTIALS",
    );
  await issueSession(user, req, res);
  res.json({ success: true, user: ownUser(user) });
});

export const logout = asyncRoute(async (req, res) => {
  const token = req.cookies.jwt;
  if (token) {
    let claims;
    try {
      claims = jwt.verify(token, req.app.locals.config.jwtSecret, {
        algorithms: ["HS256"],
      });
    } catch {
      /* An expired cookie can still be cleared. */
    }
    if (typeof claims?.jti === "string") {
      await Session.deleteOne({ _id: claims.jti });
      req.app.locals.io?.in(`session:${claims.jti}`).disconnectSockets(true);
    }
  }
  res.clearCookie("jwt", cookieOptions(req));
  res.json({ success: true, message: "Sesión cerrada." });
});
