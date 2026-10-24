import { expect, it, vi } from "vitest";
import { axiosInstance, setUnauthorizedHandler } from "./axios";
import { advanceSession } from "./session";

it("does not expire a new session because an old request returns unauthorized", async () => {
  const expired = vi.fn();
  setUnauthorizedHandler(expired);
  let reject;
  const response = axiosInstance
    .get("/matches", {
      adapter: (config) =>
        new Promise((resolve, rejectPromise) => {
          reject = () => rejectPromise({ config, response: { status: 401 } });
        }),
    })
    .catch((error) => error);
  await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
  advanceSession();
  reject();
  await response;
  expect(expired).not.toHaveBeenCalled();
});

it("expires the current session on an unauthorized protected request", async () => {
  const expired = vi.fn();
  setUnauthorizedHandler(expired);
  await axiosInstance
    .get("/matches", {
      adapter: (config) =>
        Promise.reject({ config, response: { status: 401 } }),
    })
    .catch(() => {});
  expect(expired).toHaveBeenCalledOnce();
});
