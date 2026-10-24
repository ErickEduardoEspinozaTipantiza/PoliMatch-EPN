import { ApiError } from "./errors.js";
import {
  INTERESTS,
  MAX_INTERESTS,
  RELATIONSHIP_GOALS,
} from "../../shared/profile-options.js";

export function objectBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ApiError(400, "Envía un objeto JSON válido.");
  return body;
}

export function text(value, label, { min = 1, max = 1000, trim = true } = {}) {
  if (typeof value !== "string")
    throw new ApiError(400, `${label} no es válido.`);
  const result = trim ? value.trim() : value;
  if (result.length < min || result.length > max)
    throw new ApiError(
      400,
      `${label} debe tener entre ${min} y ${max} caracteres.`,
    );
  return result;
}

export function email(value) {
  const result = text(value, "El correo", { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    throw new ApiError(400, "El correo no es válido.");
  return result;
}

export function profileFields(body) {
  const data = {};
  for (const [field, max] of [
    ["city", 80],
    ["university", 120],
  ])
    if (Object.hasOwn(body, field))
      data[field] = text(
        body[field],
        field === "city" ? "La ciudad" : "La universidad",
        { min: 0, max },
      );
  if (Object.hasOwn(body, "relationshipGoal")) {
    if (
      body.relationshipGoal !== "" &&
      !RELATIONSHIP_GOALS.some(({ value }) => value === body.relationshipGoal)
    )
      throw new ApiError(400, "Elige una intención válida.");
    data.relationshipGoal = body.relationshipGoal;
  }
  if (Object.hasOwn(body, "interests")) {
    if (
      !Array.isArray(body.interests) ||
      body.interests.length > MAX_INTERESTS ||
      new Set(body.interests).size !== body.interests.length ||
      body.interests.some((interest) => !INTERESTS.includes(interest))
    )
      throw new ApiError(
        400,
        "Elige hasta cinco intereses distintos de la lista.",
      );
    data.interests = body.interests;
  }
  if (Object.hasOwn(body, "name"))
    data.name = text(body.name, "El nombre", { max: 80 });
  if (Object.hasOwn(body, "bio"))
    data.bio = text(body.bio, "La biografía", { min: 0, max: 500 });
  if (Object.hasOwn(body, "age")) {
    const age =
      typeof body.age === "string" && /^\d+$/.test(body.age)
        ? Number(body.age)
        : body.age;
    if (!Number.isInteger(age) || age < 18 || age > 120)
      throw new ApiError(400, "La edad debe estar entre 18 y 120 años.");
    data.age = age;
  }
  for (const [field, choices] of [
    ["gender", ["male", "female"]],
    ["genderPreference", ["male", "female", "both"]],
  ]) {
    if (Object.hasOwn(body, field)) {
      if (!choices.includes(body[field]))
        throw new ApiError(400, "La preferencia o el género no es válido.");
      data[field] = body[field];
    }
  }
  return data;
}

export function objectId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new ApiError(400, "El identificador no es válido.");
  return value.toLowerCase();
}

export function pageLimit(value, fallback = 50) {
  if (value === undefined) return fallback;
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    Number(value) < 1 ||
    Number(value) > 100
  )
    throw new ApiError(400, "El límite debe estar entre 1 y 100.");
  return Number(value);
}
