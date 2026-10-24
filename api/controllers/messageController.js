import Message from "../models/Message.js";
import User from "../models/User.js";
import { emitToUser } from "../socket/socket.server.js";
import { ApiError, asyncRoute } from "../utils/errors.js";
import { objectBody, objectId, pageLimit, text } from "../utils/validation.js";

async function authorizeConversation(current, targetId) {
  const id = objectId(targetId);
  if (id === String(current._id))
    throw new ApiError(400, "Elige otra persona para conversar.");
  const target = await User.findById(id).select("matches");
  if (!target) throw new ApiError(404, "El perfil no existe.", "NOT_FOUND");
  if (
    !current.matches.some((match) => String(match) === id) ||
    !target.matches.some((match) => String(match) === String(current._id))
  )
    throw new ApiError(
      403,
      "Solo puedes conversar con tus conexiones mutuas.",
      "MATCH_REQUIRED",
    );
  return id;
}

export const sendMessage = asyncRoute(async (req, res) => {
  const body = objectBody(req.body);
  const content = text(body.content, "El mensaje", { max: 2000 });
  const receiver = await authorizeConversation(req.user, body.receiverId);
  const message = await Message.create({
    sender: req.user._id,
    receiver,
    content,
  });
  await emitToUser(req.app.locals.io, receiver, "newMessage", { message });
  res.status(201).json({ success: true, message });
});

function decodeCursor(value) {
  if (typeof value !== "string" || value.length > 300)
    throw new ApiError(400, "El cursor no es válido.");
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString());
    objectId(cursor.id);
    if (
      typeof cursor.at !== "string" ||
      !Number.isFinite(Date.parse(cursor.at))
    )
      throw new Error("invalid date");
    return { _id: cursor.id, createdAt: new Date(cursor.at) };
  } catch {
    throw new ApiError(400, "El cursor no es válido.");
  }
}

export const getConversation = asyncRoute(async (req, res) => {
  const other = await authorizeConversation(req.user, req.params.userId);
  const limit = pageLimit(req.query.limit);
  const filters = [
    {
      $or: [
        { sender: req.user._id, receiver: other },
        { sender: other, receiver: req.user._id },
      ],
    },
  ];
  if (req.query.before !== undefined) {
    const cursor = decodeCursor(req.query.before);
    filters.push({
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ],
    });
  }
  const newest = await Message.find({ $and: filters })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = newest.length > limit;
  const messages = newest.slice(0, limit).reverse();
  const oldest = messages[0];
  const nextCursor =
    hasMore && oldest
      ? Buffer.from(
          JSON.stringify({
            at: oldest.createdAt.toISOString(),
            id: String(oldest._id),
          }),
        ).toString("base64url")
      : null;
  res.json({ success: true, messages, hasMore, nextCursor });
});
