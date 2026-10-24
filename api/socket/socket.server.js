import { Server } from "socket.io";
import { authenticateToken } from "../middleware/auth.js";
import { originAllowed } from "../middleware/security.js";

function cookieToken(header = "") {
  try {
    const value = header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("jwt="));
    return value ? decodeURIComponent(value.slice(4)) : undefined;
  } catch {
    return undefined;
  }
}

export function initializeSocket(httpServer, config) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    allowRequest: (req, done) =>
      done(null, originAllowed(req.headers.origin, config)),
  });
  io.use(async (socket, next) => {
    try {
      const token = cookieToken(socket.handshake.headers.cookie);
      const { claims } = await authenticateToken(token, config.jwtSecret);
      socket.data.token = token;
      socket.data.claims = claims;
      next();
    } catch {
      next(new Error("La sesión no es válida. Inicia sesión de nuevo."));
    }
  });
  io.on("connection", (socket) => {
    const { id, jti, exp } = socket.data.claims;
    socket.join(`user:${id}`);
    socket.join(`session:${jti}`);
    const timer = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, exp * 1000 - Date.now()),
    );
    timer.unref();
    socket.on("disconnect", () => clearTimeout(timer));
  });
  io.authConfig = config;
  return io;
}

// Recheck persisted sessions before delivery: a deleted account or revoked session
// cannot keep receiving events through a previously authenticated connection.
export async function emitToUser(io, userId, event, payload) {
  if (!io) return false;
  // Delivery follows a committed write. A transport outage must not turn a
  // persisted message or match into a failed HTTP response and invite retries.
  let sockets;
  try {
    sockets = await io.in(`user:${userId}`).fetchSockets();
  } catch {
    return false;
  }
  let delivered = false;
  for (const socket of sockets) {
    try {
      await authenticateToken(socket.data.token, io.authConfig.jwtSecret);
    } catch {
      try {
        socket.disconnect(true);
      } catch {
        /* Transport may already be gone. */
      }
      continue;
    }
    try {
      socket.emit(event, payload);
      delivered = true;
    } catch {
      /* Persisted state remains available through the HTTP API. */
    }
  }
  return delivered;
}
