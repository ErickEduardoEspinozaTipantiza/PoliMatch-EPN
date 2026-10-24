import { io } from "socket.io-client";
let socket = null;
let owner = null;
export const initializeSocket = (userId) => {
  if (socket && owner === userId) return socket;
  disconnectSocket();
  owner = userId;
  // The server derives identity exclusively from the HttpOnly cookie.
  socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
    withCredentials: true,
  });
  return socket;
};
export const getSocket = () => socket;
export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  owner = null;
};
