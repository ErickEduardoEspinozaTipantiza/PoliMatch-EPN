import { beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const socket = vi.hoisted(() => ({
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
}));
vi.mock("../lib/axios", () => ({
  axiosInstance: transport,
  setUnauthorizedHandler: vi.fn(),
}));
vi.mock("../socket/socket.client", () => ({
  initializeSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  getSocket: () => socket,
}));
vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));
import { useMessageStore } from "./useMessageStore";
import { useMatchStore } from "./useMatchStore";
import { useAuthStore } from "./useAuthStore";
import { useUserStore } from "./useUserStore";

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const message = (id, sender = "b", receiver = "a") => ({
  _id: id,
  sender,
  receiver,
  content: "Hola",
  createdAt: "2026-10-23T12:00:00Z",
});

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    authUser: { _id: "a", name: "Ana" },
    checkingAuth: false,
    loading: false,
  });
  useMessageStore.setState({
    messages: [],
    loading: false,
    sending: false,
    activeConversation: null,
  });
  useMatchStore.setState({
    matches: [],
    userProfiles: [],
    swipingId: null,
    profilesHasMore: false,
  });
});

describe("conversation isolation and delivery", () => {
  it("ignores a history response for a conversation the user has left", async () => {
    const old = deferred();
    transport.get.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      data: { messages: [message("c1", "c")], hasMore: false },
    });
    const first = useMessageStore.getState().getMessages("b");
    await useMessageStore.getState().getMessages("c");
    old.resolve({ data: { messages: [message("b1")], hasMore: false } });
    await first;
    expect(useMessageStore.getState().messages.map((m) => m._id)).toEqual([
      "c1",
    ]);
  });
  it("filters other conversations and deduplicates delivered socket events", async () => {
    transport.get.mockResolvedValue({ data: { messages: [], hasMore: false } });
    await useMessageStore.getState().getMessages("b");
    useMessageStore.getState().subscribeToMessages();
    const receive = socket.on.mock.calls.find(
      ([event]) => event === "newMessage",
    )[1];
    receive({ message: message("wrong", "c") });
    receive({ message: message("right") });
    receive({ message: message("right") });
    expect(useMessageStore.getState().messages.map((m) => m._id)).toEqual([
      "right",
    ]);
  });
  it("does not lose a live message when history finishes loading", async () => {
    const history = deferred();
    transport.get.mockReturnValueOnce(history.promise);
    const loading = useMessageStore.getState().getMessages("b");
    useMessageStore.getState().subscribeToMessages();
    socket.on.mock.calls.find(([event]) => event === "newMessage")[1]({
      message: message("live"),
    });
    history.resolve({ data: { messages: [message("old")], hasMore: false } });
    await loading;
    expect(useMessageStore.getState().messages.map((m) => m._id)).toEqual([
      "old",
      "live",
    ]);
  });
  it("does not display a failed send as delivered and reports failure to retain the draft", async () => {
    transport.post.mockRejectedValueOnce(new Error("offline"));
    const sent = await useMessageStore
      .getState()
      .sendMessage("b", "Conserva este texto");
    expect(sent).toBe(false);
    expect(useMessageStore.getState().messages).toEqual([]);
  });
  it("uses the saved message ID when a send is confirmed", async () => {
    useMessageStore.setState({ activeConversation: "b" });
    transport.post.mockResolvedValueOnce({
      data: { message: message("saved", "a", "b") },
    });
    expect(await useMessageStore.getState().sendMessage("b", "Hola")).toBe(
      true,
    );
    expect(useMessageStore.getState().messages.map((m) => m._id)).toEqual([
      "saved",
    ]);
  });
});

describe("session and profile consistency", () => {
  it("handles network failure without accessing missing response.data", async () => {
    transport.post.mockRejectedValueOnce(new Error("offline"));
    await expect(
      useAuthStore.getState().login({ email: "a@b.test", password: "secret" }),
    ).resolves.toBe(false);
    expect(useAuthStore.getState().loading).toBe(false);
  });
  it("clears private state on logout and ignores previous in-flight data", async () => {
    const history = deferred();
    transport.get.mockReturnValueOnce(history.promise);
    const loading = useMessageStore.getState().getMessages("b");
    useMatchStore.setState({
      matches: [{ _id: "b" }],
      userProfiles: [{ _id: "c" }],
    });
    transport.post.mockResolvedValueOnce({
      status: 200,
      data: { success: true },
    });
    await useAuthStore.getState().logout();
    history.resolve({
      data: { messages: [message("private")], hasMore: false },
    });
    await loading;
    expect(useAuthStore.getState().authUser).toBeNull();
    expect(useMessageStore.getState().messages).toEqual([]);
    expect(useMatchStore.getState().matches).toEqual([]);
    expect(useMatchStore.getState().userProfiles).toEqual([]);
  });
  it("synchronizes the saved profile into the active session", async () => {
    transport.put.mockResolvedValueOnce({
      data: { user: { _id: "a", name: "Ana actualizada", image: "" } },
    });
    expect(
      await useUserStore.getState().updateProfile({ name: "Ana actualizada" }),
    ).toBe(true);
    expect(useAuthStore.getState().authUser.name).toBe("Ana actualizada");
  });
  it("ignores a saved profile response that arrives after logout", async () => {
    const saving = deferred();
    transport.put.mockReturnValueOnce(saving.promise);
    const update = useUserStore
      .getState()
      .updateProfile({ name: "Nombre anterior" });
    transport.post.mockResolvedValueOnce({
      status: 200,
      data: { success: true },
    });
    await useAuthStore.getState().logout();
    saving.resolve({ data: { user: { _id: "a", name: "Nombre anterior" } } });
    expect(await update).toBe(false);
    expect(useAuthStore.getState().authUser).toBeNull();
  });
});

describe("discovery decisions", () => {
  it("loads the next selection when a bounded batch is exhausted", async () => {
    useMatchStore.setState({
      userProfiles: [{ _id: "b" }],
      profilesHasMore: true,
    });
    transport.post.mockResolvedValueOnce({ data: { success: true } });
    transport.get.mockResolvedValueOnce({
      data: { users: [{ _id: "c" }], hasMore: false },
    });
    await useMatchStore.getState().swipeLeft({ _id: "b" });
    await vi.waitFor(() =>
      expect(useMatchStore.getState().userProfiles).toEqual([{ _id: "c" }]),
    );
  });
  it("does not restore a decided card when an older profile request finishes", async () => {
    const person = { _id: "b", name: "Bruno" };
    useMatchStore.setState({ userProfiles: [person] });
    const profiles = deferred();
    transport.get.mockReturnValueOnce(profiles.promise);
    const fetching = useMatchStore.getState().getUserProfiles();
    transport.post.mockResolvedValueOnce({ data: { success: true } });
    await useMatchStore.getState().swipeLeft(person);
    profiles.resolve({ data: { users: [person] } });
    await fetching;
    expect(useMatchStore.getState().userProfiles).toEqual([]);
    expect(useMatchStore.getState().isLoadingUserProfiles).toBe(false);
  });
  it("removes a profile only after a successful swipe", async () => {
    const person = { _id: "b", name: "Bruno" };
    useMatchStore.setState({ userProfiles: [person] });
    transport.post.mockRejectedValueOnce(new Error("offline"));
    expect(await useMatchStore.getState().swipeRight(person)).toBe(false);
    expect(useMatchStore.getState().userProfiles).toEqual([person]);
    transport.post.mockResolvedValueOnce({ data: { success: true } });
    expect(await useMatchStore.getState().swipeRight(person)).toBe(true);
    expect(useMatchStore.getState().userProfiles).toEqual([]);
  });
});

describe("match celebration delivery", () => {
  it("celebrates a confirmed HTTP match even if its socket event was missed", async () => {
    useMatchStore.getState().reset();
    const person = { _id: "b", name: "Bruno" };
    useMatchStore.setState({ userProfiles: [person] });
    transport.post.mockResolvedValueOnce({
      data: { success: true, match: person },
    });
    transport.get.mockResolvedValue({ data: { matches: [person] } });
    await useMatchStore.getState().swipeRight(person);
    expect(useMatchStore.getState().matchQueue).toEqual([person]);
    useMatchStore.getState().dismissMatch();
    expect(useMatchStore.getState().matchQueue).toEqual([]);
  });
  it("does not celebrate twice when socket arrives before the HTTP confirmation", async () => {
    useMatchStore.getState().reset();
    const person = { _id: "b", name: "Bruno" };
    useMatchStore.setState({ userProfiles: [person] });
    useMatchStore.getState().subscribeToNewMatches();
    const receive = socket.on.mock.calls.find(
      ([event]) => event === "newMatch",
    )[1];
    receive(person);
    transport.post.mockResolvedValueOnce({
      data: { success: true, match: person },
    });
    transport.get.mockResolvedValue({ data: { matches: [person] } });
    await useMatchStore.getState().swipeRight(person);
    expect(useMatchStore.getState().matchQueue).toEqual([person]);
    useMatchStore.getState().dismissMatch();
    receive(person);
    expect(useMatchStore.getState().matchQueue).toEqual([]);
    useMatchStore.getState().reset();
    expect(useMatchStore.getState().matchQueue).toEqual([]);
  });
});

it("publishes the signup destination atomically with the authenticated user", async () => {
  useAuthStore.getState().clearSession();
  transport.post.mockResolvedValue({ data: { user: { _id: "new-user" } } });
  const destinations = [];
  const unsubscribe = useAuthStore.subscribe((state) => {
    if (state.authUser?._id === "new-user")
      destinations.push(state.onboardingPending);
  });
  try {
    expect(await useAuthStore.getState().signup({})).toBe(true);
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.every(Boolean)).toBe(true);
    useAuthStore.getState().finishOnboarding();
    expect(useAuthStore.getState().onboardingPending).toBe(false);
    useAuthStore.getState().clearSession();
    expect(await useAuthStore.getState().login({})).toBe(true);
    expect(useAuthStore.getState().onboardingPending).toBe(false);
  } finally {
    unsubscribe();
  }
});
