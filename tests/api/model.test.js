import test from "node:test";
import assert from "node:assert/strict";
import User from "../../api/models/User.js";

const fixture = (overrides = {}) =>
  new User({
    name: "Persona de prueba",
    email: "persona@example.invalid",
    password: "fixture-password",
    age: 24,
    gender: "female",
    genderPreference: "both",
    ...overrides,
  });

test("User JSON never exposes credentials", () => {
  assert.equal(Object.hasOwn(fixture().toJSON(), "password"), false);
});

test("User rejects an underage profile even outside signup", async () => {
  await assert.rejects(fixture({ age: 17 }).validate(), /age/);
});

test("User normalizes email and rejects malformed addresses", async () => {
  const normalized = fixture({ email: " PERSONA@EXAMPLE.INVALID " });
  await normalized.validate();
  assert.equal(normalized.email, "persona@example.invalid");
  await assert.rejects(fixture({ email: "invalid" }).validate(), /email/);
});
