import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import User from "../../api/models/User.js";

// Import the seed module without opening a database connection.
const seed = await import("../../api/seeds/demo.js").catch((error) => {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  return {};
});
const confirmation = "polimatch-local-demo";

test("seed requires an explicit local disposable database and confirmation", () => {
  assert.equal(typeof seed.validateSeedEnvironment, "function");
  const good = {
    SEED_URI: "mongodb://127.0.0.1:27017/polimatch_seed",
    SEED_CONFIRM: confirmation,
  };
  assert.equal(seed.validateSeedEnvironment(good), good.SEED_URI);
  for (const env of [
    {},
    { MONGO_URI: good.SEED_URI, SEED_CONFIRM: confirmation },
    { ...good, SEED_CONFIRM: undefined },
    { ...good, NODE_ENV: "production" },
    { ...good, SEED_URI: "mongodb+srv://remote.invalid/polimatch_seed" },
    { ...good, SEED_URI: "mongodb://remote.invalid/polimatch_seed" },
    { ...good, SEED_URI: "mongodb://localhost/production" },
    { ...good, SEED_URI: "mongodb://localhost" },
    { ...good, SEED_URI: "mongodb://user:password@localhost/polimatch_seed" },
  ])
    assert.throws(() => seed.validateSeedEnvironment(env), /SEED|producción/);
});

test("invalid seed configuration fails before opening a database connection", async () => {
  assert.equal(typeof seed.seedUsers, "function");
  let connected = false;
  await assert.rejects(
    seed.seedUsers({
      env: {},
      connectDatabase: async () => {
        connected = true;
      },
    }),
    /SEED/,
  );
  assert.equal(connected, false);
});

test(
  "local demo seed preserves existing users and is idempotent with usable passwords",
  { skip: !seed.seedUsers },
  async () => {
    const db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    const uri = db.getUri("polimatch_seed_test");
    const env = { SEED_URI: uri, SEED_CONFIRM: confirmation, NODE_ENV: "test" };
    try {
      await mongoose.connect(uri);
      const existing = await User.create({
        name: "Keep me",
        email: "keep@example.invalid",
        password: "keep-password",
        age: 25,
        gender: "female",
        genderPreference: "both",
      });
      await mongoose.disconnect();
      const first = await seed.seedUsers({ env });
      assert.equal(first.created, 21);
      await mongoose.connect(uri);
      assert.equal((await User.findById(existing._id)).name, "Keep me");
      const demo = await User.findOne({
        email: "demo.male.1@example.invalid",
      }).select("+password");
      assert.equal(await demo.matchPassword("local-demo-password"), true);
      for (const profile of await User.find({
        email: /@example\.invalid$/,
        image: { $ne: "" },
      })) {
        if (!profile.image) continue;
        const asset = await readFile(
          new URL(`../../client/public${profile.image}`, import.meta.url),
          "utf8",
        );
        assert.match(
          asset,
          /^<svg\s/,
          "Demo images must be real vector portraits, not downloaded HTML",
        );
      }
      demo.bio = "Preserve my local edit";
      await demo.save();
      const passwordHash = demo.password;
      await mongoose.disconnect();
      assert.equal((await seed.seedUsers({ env })).created, 0);
      await mongoose.connect(uri);
      assert.equal(await User.countDocuments(), 22);
      const repeated = await User.findById(demo._id).select("+password");
      assert.equal(repeated.bio, "Preserve my local edit");
      assert.equal(repeated.password, passwordHash);
    } finally {
      await mongoose.disconnect();
      await db.stop();
    }
  },
);
