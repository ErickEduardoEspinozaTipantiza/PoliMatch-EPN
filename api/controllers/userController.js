import User from "../models/User.js";
import { ApiError, asyncRoute } from "../utils/errors.js";
import { objectBody, profileFields } from "../utils/validation.js";
import { ownUser, userPhotos } from "../utils/users.js";
import { uploadProfileImage } from "../utils/profile-images.js";
import { MAX_PHOTOS } from "../../shared/profile-options.js";

// The same fallback as userPhotos, evaluated on the current database document.
const storedPhotos = {
  $cond: [
    { $gt: [{ $size: { $ifNull: ["$photos", []] } }, 0] },
    "$photos",
    { $cond: [{ $ne: [{ $ifNull: ["$image", ""] }, ""] }, ["$image"], []] },
  ],
};

export const updateProfile = asyncRoute(async (req, res) => {
  const body = objectBody(req.body);
  const allowed = new Set([
    "name",
    "age",
    "gender",
    "genderPreference",
    "bio",
    "image",
    "photos",
    "interests",
    "relationshipGoal",
    "city",
    "university",
  ]);
  if (Object.keys(body).some((field) => !allowed.has(field)))
    throw new ApiError(400, "Solo puedes editar los campos de tu perfil.");
  const data = profileFields(body);
  const previousPhotos = userPhotos(req.user);
  const changingPhotos =
    Object.hasOwn(body, "photos") || Object.hasOwn(body, "image");
  if (Object.hasOwn(body, "photos")) {
    if (Object.hasOwn(body, "image"))
      throw new ApiError(
        400,
        "Edita la galería o la foto principal por separado.",
      );
    if (
      !Array.isArray(body.photos) ||
      body.photos.length > MAX_PHOTOS ||
      new Set(body.photos).size !== body.photos.length ||
      body.photos.some(
        (photo) => typeof photo !== "string" || !previousPhotos.includes(photo),
      )
    )
      throw new ApiError(
        400,
        "La galería solo puede contener hasta seis fotos tuyas, sin repetir.",
      );
    data.photos = body.photos;
  } else if (Object.hasOwn(body, "image")) {
    if (typeof body.image !== "string")
      throw new ApiError(400, "La imagen no es válida.");
    const image =
      body.image === "" || body.image === req.user.image
        ? body.image
        : await uploadProfileImage(body.image, req.app.locals.uploadImage);
    data.photos = image
      ? [image, ...previousPhotos.slice(1).filter((photo) => photo !== image)]
      : previousPhotos.slice(1);
  }
  if (changingPhotos) data.image = data.photos[0] || "";
  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      ...(changingPhotos
        ? { $expr: { $eq: [storedPhotos, { $literal: previousPhotos }] } }
        : {}),
    },
    { $set: data },
    { new: true, runValidators: true },
  );
  if (!user)
    throw new ApiError(
      409,
      "Tu perfil cambió. Recarga y vuelve a intentarlo.",
      "PROFILE_CHANGED",
    );
  res.json({ success: true, user: ownUser(user) });
});

export const addPhoto = asyncRoute(async (req, res) => {
  const body = objectBody(req.body);
  if (Object.keys(body).some((field) => field !== "image"))
    throw new ApiError(400, "Envía únicamente la imagen.");
  if (userPhotos(req.user).length >= MAX_PHOTOS)
    throw new ApiError(409, "Puedes añadir hasta seis fotos.", "PHOTO_LIMIT");
  const image = await uploadProfileImage(
    body.image,
    req.app.locals.uploadImage,
  );
  // Capacity check and append are atomic, including simultaneous uploads.
  const user = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      $expr: { $lt: [{ $size: storedPhotos }, MAX_PHOTOS] },
    },
    [
      {
        $set: {
          photos: { $concatArrays: [storedPhotos, { $literal: [image] }] },
        },
      },
      { $set: { image: { $arrayElemAt: ["$photos", 0] } } },
    ],
    { new: true },
  );
  if (!user)
    throw new ApiError(
      409,
      "Puedes añadir hasta seis fotos. Recarga tu perfil.",
      "PHOTO_LIMIT",
    );
  res.status(201).json({ success: true, user: ownUser(user) });
});
