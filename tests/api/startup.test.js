import test from "node:test";
import assert from "node:assert/strict";

const module = await import("../../api/server.js").catch(() => ({}));

test("startup validates environment before any database connection", async () => {
  assert.equal(typeof module.startServer, "function");
  let connected = false;
  await assert.rejects(
    module.startServer({
      env: {},
      connectDatabase: async () => {
        connected = true;
      },
    }),
    /MONGO_URI/,
  );
  assert.equal(connected, false);
});

test("database failure prevents HTTP server from starting", async () => {
  assert.equal(typeof module.startServer, "function");
  await assert.rejects(
    module.startServer({
      env: {
        MONGO_URI: "mongodb://127.0.0.1:27017/isolated",
        JWT_SECRET: "isolated-startup-test-secret-32-characters",
        CLIENT_URL: "http://localhost:5173",
        PORT: "0",
      },
      connectDatabase: async () => {
        throw new Error("isolated database failure");
      },
    }),
    /isolated database failure/,
  );
});
