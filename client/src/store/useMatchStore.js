import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { errorMessage } from "../lib/errors";
import { sessionGeneration } from "../lib/session";
import { getSocket } from "../socket/socket.client";

let matchRequest = 0;
let profileRequest = 0;
let feedbackTimer;
let unsubscribe = () => {};
const celebrated = new Set();
const initial = {
  matches: [],
  userProfiles: [],
  isLoadingMyMatches: false,
  isLoadingUserProfiles: false,
  matchesError: null,
  profilesError: null,
  profilesHasMore: false,
  swipingId: null,
  swipeFeedback: null,
  matchQueue: [],
  swipeAnimating: false,
};
const unique = (items) => [
  ...new Map(items.filter(Boolean).map((item) => [item._id, item])).values(),
];

export const useMatchStore = create((set, get) => {
  const receiveMatch = (person) => {
    if (!person?._id || celebrated.has(person._id)) return;
    celebrated.add(person._id);
    set((state) => ({
      matches: unique([...state.matches, person]),
      matchQueue: [...state.matchQueue, person],
    }));
  };
  const swipe = async (person, direction) => {
    if (get().swipingId) return false;
    const generation = sessionGeneration();
    set({ swipingId: person._id });
    try {
      const { data } = await axiosInstance.post(
        "/matches/swipe-" + direction + "/" + person._id,
      );
      if (generation !== sessionGeneration()) return false;
      if (data?.match) receiveMatch(data.match);
      profileRequest++;
      clearTimeout(feedbackTimer);
      set((state) => ({
        isLoadingUserProfiles: false,
        userProfiles: state.userProfiles.filter((p) => p._id !== person._id),
        swipeFeedback: direction === "right" ? "liked" : "passed",
      }));
      feedbackTimer = setTimeout(() => set({ swipeFeedback: null }), 1500);
      if (direction === "right") get().getMyMatches();
      if (!get().userProfiles.length && get().profilesHasMore)
        get().getUserProfiles();
      return true;
    } catch (error) {
      if (generation === sessionGeneration()) toast.error(errorMessage(error));
      return false;
    } finally {
      if (generation === sessionGeneration()) set({ swipingId: null });
    }
  };
  return {
    ...initial,
    reset: () => {
      matchRequest++;
      profileRequest++;
      clearTimeout(feedbackTimer);
      unsubscribe();
      celebrated.clear();
      set({ ...initial });
    },
    dismissMatch: () =>
      set((state) => ({ matchQueue: state.matchQueue.slice(1) })),
    getMyMatches: async () => {
      const current = ++matchRequest;
      const generation = sessionGeneration();
      const atStart = get().matches;
      set({ isLoadingMyMatches: true, matchesError: null });
      try {
        const { data } = await axiosInstance.get("/matches");
        if (current !== matchRequest || generation !== sessionGeneration())
          return;
        const arrivals = get().matches.filter(
          (m) => !atStart.some((old) => old._id === m._id),
        );
        set({ matches: unique([...data.matches, ...arrivals]) });
      } catch (error) {
        if (current === matchRequest && generation === sessionGeneration())
          set({ matchesError: errorMessage(error) });
      } finally {
        if (current === matchRequest && generation === sessionGeneration())
          set({ isLoadingMyMatches: false });
      }
    },
    getUserProfiles: async () => {
      const current = ++profileRequest;
      const generation = sessionGeneration();
      set({ isLoadingUserProfiles: true, profilesError: null });
      try {
        const { data } = await axiosInstance.get("/matches/user-profiles");
        if (current === profileRequest && generation === sessionGeneration())
          set({
            userProfiles: data.users,
            profilesHasMore: Boolean(data.hasMore),
          });
      } catch (error) {
        if (current === profileRequest && generation === sessionGeneration())
          set({ profilesError: errorMessage(error) });
      } finally {
        if (current === profileRequest && generation === sessionGeneration())
          set({ isLoadingUserProfiles: false });
      }
    },
    swipeLeft: (person) => swipe(person, "left"),
    swipeRight: (person) => swipe(person, "right"),
    subscribeToNewMatches: () => {
      unsubscribe();
      const socket = getSocket();
      if (!socket) return () => {};
      const receive = receiveMatch;
      const reconnect = () => {
        get().getMyMatches();
      };
      socket.on("newMatch", receive);
      socket.on("connect", reconnect);
      unsubscribe = () => {
        socket.off("newMatch", receive);
        socket.off("connect", reconnect);
      };
      return unsubscribe;
    },
    unsubscribeFromNewMatches: () => unsubscribe(),
  };
});
