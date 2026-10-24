import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { sessionGeneration } from "../lib/session";
import { useAuthStore } from "./useAuthStore";

export const useUserStore = create((set, get) => ({
  loading: false,
  updateProfile: async (data) => {
    if (get().loading) return false;
    const generation = sessionGeneration();
    set({ loading: true });
    try {
      const res = await axiosInstance.put("/users/update", data);
      if (generation !== sessionGeneration()) return false;
      useAuthStore.getState().setAuthUser(res.data.user);
      toast.success("Tu perfil se ha guardado.");
      return true;
    } catch (error) {
      if (generation === sessionGeneration()) toast.error(errorMessage(error));
      return false;
    } finally {
      if (generation === sessionGeneration()) set({ loading: false });
    }
  },
}));
