import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { sessionGeneration } from "../lib/session";
import { getSocket } from "../socket/socket.client";
import { useAuthStore } from "./useAuthStore";

let request = 0;
let unsubscribe = () => {};
const initial = {
  messages: [],
  activeConversation: null,
  loading: false,
  sending: false,
  error: null,
  hasMore: false,
  nextCursor: null,
  loadingOlder: false,
};
const merge = (first, second) =>
  [...new Map([...first, ...second].map((m) => [m._id, m])).values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

export const useMessageStore = create((set, get) => ({
  ...initial,
  reset: () => {
    request++;
    unsubscribe();
    set({ ...initial });
  },
  clearConversation: () => {
    request++;
    set({ ...initial });
  },
  getMessages: async (userId) => {
    const current = ++request;
    const generation = sessionGeneration();
    set({ ...initial, activeConversation: userId, loading: true });
    try {
      const { data } = await axiosInstance.get(
        "/messages/conversation/" + userId,
      );
      if (current !== request || generation !== sessionGeneration()) return;
      set((state) => ({
        messages: merge(data.messages, state.messages),
        hasMore: Boolean(data.hasMore),
        nextCursor: data.nextCursor,
        error: null,
      }));
    } catch (error) {
      if (current === request && generation === sessionGeneration())
        set({ error: errorMessage(error) });
    } finally {
      if (current === request && generation === sessionGeneration())
        set({ loading: false });
    }
  },
  loadOlderMessages: async () => {
    const { activeConversation, nextCursor, hasMore, loadingOlder } = get();
    if (!activeConversation || !hasMore || loadingOlder) return;
    const current = request;
    const generation = sessionGeneration();
    set({ loadingOlder: true });
    try {
      const { data } = await axiosInstance.get(
        "/messages/conversation/" + activeConversation,
        { params: { before: nextCursor } },
      );
      if (current !== request || generation !== sessionGeneration()) return;
      set((state) => ({
        messages: merge(data.messages, state.messages),
        hasMore: Boolean(data.hasMore),
        nextCursor: data.nextCursor,
      }));
    } catch (error) {
      if (current === request && generation === sessionGeneration())
        toast.error(errorMessage(error));
    } finally {
      if (current === request && generation === sessionGeneration())
        set({ loadingOlder: false });
    }
  },
  sendMessage: async (receiverId, content) => {
    if (get().sending || !content.trim() || content.length > 2000) return false;
    const generation = sessionGeneration();
    const current = request;
    set({ sending: true });
    try {
      const { data } = await axiosInstance.post("/messages/send", {
        receiverId,
        content: content.trim(),
      });
      if (generation !== sessionGeneration()) return false;
      if (get().activeConversation === receiverId)
        set((state) => ({ messages: merge(state.messages, [data.message]) }));
      return true;
    } catch (error) {
      if (generation === sessionGeneration()) toast.error(errorMessage(error));
      return false;
    } finally {
      if (generation === sessionGeneration() && current === request)
        set({ sending: false });
    }
  },
  subscribeToMessages: () => {
    unsubscribe();
    const socket = getSocket();
    if (!socket) return () => {};
    const receive = ({ message }) => {
      const ownId = useAuthStore.getState().authUser?._id;
      const peer = get().activeConversation;
      if (
        peer &&
        ((message.sender === peer && message.receiver === ownId) ||
          (message.sender === ownId && message.receiver === peer))
      ) {
        set((state) => ({ messages: merge(state.messages, [message]) }));
      }
    };
    // Reload after reconnect to recover events missed while offline.
    const reconnect = () => {
      const peer = get().activeConversation;
      if (peer && !get().loading) get().getMessages(peer);
    };
    socket.on("newMessage", receive);
    socket.on("connect", reconnect);
    unsubscribe = () => {
      socket.off("newMessage", receive);
      socket.off("connect", reconnect);
    };
    return unsubscribe;
  },
  unsubscribeFromMessages: () => unsubscribe(),
}));
