import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance, setUnauthorizedHandler } from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { advanceSession, sessionGeneration } from "../lib/session";
import { disconnectSocket, initializeSocket } from "../socket/socket.client";
import { useMessageStore } from "./useMessageStore";
import { useMatchStore } from "./useMatchStore";
import { useUserStore } from "./useUserStore";

let checkingPromise = null;
let authRequest = 0;
function clearPrivateState() {
  advanceSession();
  disconnectSocket();
  useMessageStore.getState().reset();
  useMatchStore.getState().reset();
  useUserStore.setState({ loading: false });
}

export const useAuthStore = create((set, get) => {
  const authenticate = async (path, data) => {
    if (get().loading) return false;
    const request = ++authRequest;
    set({ loading: true, authError: null });
    try {
      const res = await axiosInstance.post("/auth/" + path, data);
      if (request !== authRequest) return false;
      clearPrivateState();
      set({
        authUser: res.data.user,
        checkingAuth: false,
        onboardingPending: path === "signup",
      });
      initializeSocket(res.data.user._id);
      toast.success(
        path === "signup"
          ? "Tu cuenta está lista. ¡Bienvenido a PoliMatch!"
          : "Qué bueno verte de nuevo.",
      );
      return true;
    } catch (error) {
      if (request === authRequest) toast.error(errorMessage(error));
      return false;
    } finally {
      if (request === authRequest) set({ loading: false });
    }
  };
  return {
    authUser: null,
    onboardingPending: false,
    finishOnboarding: () => set({ onboardingPending: false }),
    checkingAuth: true,
    loading: false,
    authError: null,
    signup: (data) => authenticate("signup", data),
    login: (data) => authenticate("login", data),
    logout: async () => {
      if (get().loading) return false;
      set({ loading: true });
      try {
        await axiosInstance.post("/auth/logout");
        get().clearSession();
        return true;
      } catch (error) {
        if (error.response?.status === 401) {
          get().clearSession();
          return true;
        }
        toast.error(errorMessage(error));
        return false;
      } finally {
        set({ loading: false });
      }
    },
    checkAuth: () => {
      if (checkingPromise) return checkingPromise;
      const request = authRequest;
      const generation = sessionGeneration();
      set({ checkingAuth: true, authError: null });
      checkingPromise = (async () => {
        try {
          const res = await axiosInstance.get("/auth/me");
          if (request !== authRequest || generation !== sessionGeneration())
            return;
          if (!res.data.user?._id) {
            get().clearSession();
            return;
          }
          set({ authUser: res.data.user });
          initializeSocket(res.data.user._id);
        } catch (error) {
          if (request !== authRequest || generation !== sessionGeneration())
            return;
          if (error.response?.status === 401) get().clearSession();
          else set({ authError: errorMessage(error) });
        } finally {
          if (request === authRequest) set({ checkingAuth: false });
          checkingPromise = null;
        }
      })();
      return checkingPromise;
    },
    clearSession: () => {
      authRequest++;
      clearPrivateState();
      set({
        authUser: null,
        onboardingPending: false,
        checkingAuth: false,
        loading: false,
        authError: null,
      });
    },
    setAuthUser: (user) => set({ authUser: user }),
  };
});
setUnauthorizedHandler(() => useAuthStore.getState().clearSession());
