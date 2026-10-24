import mongoose from "mongoose";
import User from "../models/User.js";
import { ApiError, asyncRoute } from "../utils/errors.js";
import { objectId } from "../utils/validation.js";
import { ownUser, publicUser, PUBLIC_USER_FIELDS } from "../utils/users.js";
import { emitToUser } from "../socket/socket.server.js";

function targetId(req, key) {
  const id = objectId(req.params[key]);
  if (id === String(req.user._id))
    throw new ApiError(400, "No puedes elegir tu propio perfil.");
  return id;
}

export const swipeRight = asyncRoute(async (req, res) => {
  const likedId = targetId(req, "likedUserId");
  const session = await mongoose.startSession();
  let current, liked, createdMatch;
  try {
    await session.withTransaction(async () => {
      createdMatch = false;
      current = await User.findById(req.user._id).session(session);
      liked = await User.findById(likedId).session(session);
      if (!current) throw new ApiError(401, "La sesión ya no está disponible.");
      if (!liked) throw new ApiError(404, "El perfil no existe.", "NOT_FOUND");
      if (current.dislikes.some((id) => String(id) === likedId))
        throw new ApiError(409, "Ya descartaste este perfil.");
      await User.updateOne(
        { _id: current._id },
        { $addToSet: { likes: liked._id } },
        { session },
      );
      if (liked.likes.some((id) => String(id) === String(current._id))) {
        createdMatch =
          !current.matches.some((id) => String(id) === likedId) ||
          !liked.matches.some((id) => String(id) === String(current._id));
        await User.updateOne(
          { _id: current._id },
          { $addToSet: { matches: liked._id } },
          { session },
        );
        await User.updateOne(
          { _id: liked._id },
          { $addToSet: { matches: current._id } },
          { session },
        );
      }
    });
  } catch (error) {
    if (error.code === 20 || error.codeName === "IllegalOperation")
      throw new ApiError(
        503,
        "Los matches requieren MongoDB con replica set.",
        "REPLICA_SET_REQUIRED",
      );
    throw error;
  } finally {
    await session.endSession();
  }
  if (createdMatch) {
    await Promise.all([
      emitToUser(req.app.locals.io, likedId, "newMatch", publicUser(current)),
      emitToUser(
        req.app.locals.io,
        String(current._id),
        "newMatch",
        publicUser(liked),
      ),
    ]);
  }
  res.json({
    success: true,
    user: ownUser(current),
    match: createdMatch ? publicUser(liked) : null,
  });
});

export const swipeLeft = asyncRoute(async (req, res) => {
  const dislikedId = targetId(req, "dislikedUserId");
  if (!(await User.exists({ _id: dislikedId })))
    throw new ApiError(404, "El perfil no existe.", "NOT_FOUND");
  // A repeated or late pass must never undo an existing like or match.
  await User.updateOne(
    {
      _id: req.user._id,
      likes: { $ne: dislikedId },
      matches: { $ne: dislikedId },
    },
    { $addToSet: { dislikes: dislikedId } },
  );
  res.json({ success: true, user: ownUser(req.user) });
});

export const getMatches = asyncRoute(async (req, res) => {
  const user = await User.findById(req.user._id).populate(
    "matches",
    PUBLIC_USER_FIELDS,
  );
  res.json({
    success: true,
    matches: user.matches.filter(Boolean).map(publicUser),
  });
});

export const getUserProfiles = asyncRoute(async (req, res) => {
  const current = req.user;
  const users = await User.find({
    _id: {
      $ne: current._id,
      $nin: [...current.likes, ...current.dislikes, ...current.matches],
    },
    gender:
      current.genderPreference === "both"
        ? { $in: ["male", "female"] }
        : current.genderPreference,
    genderPreference: { $in: [current.gender, "both"] },
  })
    .select(PUBLIC_USER_FIELDS)
    .sort({ _id: 1 })
    .limit(31)
    .lean();
  res.json({
    success: true,
    users: users.slice(0, 30).map(publicUser),
    hasMore: users.length > 30,
  });
});
