import test from "node:test";
import assert from "node:assert/strict";

const runtime = await import("../../api/config/runtime.js").catch(() => ({}));
test("deployment configuration rejects missing secrets and invalid browser origins", () => {
  assert.equal(typeof runtime.validateEnvironment, "function");
  assert.throws(() => runtime.validateEnvironment({}), /MONGO_URI/);
  assert.throws(
    () =>
      runtime.validateEnvironment({ MONGO_URI: "mongodb://127.0.0.1/test" }),
    /JWT_SECRET/,
  );
  assert.throws(
    () =>
      runtime.validateEnvironment({
        MONGO_URI: "mongodb://127.0.0.1/test",
        JWT_SECRET: "x".repeat(32),
        CLIENT_URL: "https://example.invalid/path",
      }),
    /CLIENT_URL/,
  );
});
