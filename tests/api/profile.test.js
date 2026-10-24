import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../api/app.js";
import User from "../../api/models/User.js";

const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jpecAAAAASUVORK5CYII=";

test("dating profile fields and owned gallery round trip safely", async (t) => {
  const db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
  await mongoose.connect(db.getUri(), { dbName: "profile_isolated" });
  let uploads = 0;
  const app = createApp({
    jwtSecret: "profile-isolated-secret",
    uploadImage: async () =>
      `https://res.cloudinary.com/test/photo-${++uploads}.png`,
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let cookie;
  const request = async (path, method = "GET", body, authenticated = true) => {
    const res = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(authenticated && cookie ? { Cookie: cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    return {
      status: res.status,
      body: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0],
    };
  };
  try {
    const signup = await request("/api/auth/signup", "POST", {
      name: "Luna",
      email: "luna@example.invalid",
      password: "fixture-password",
      age: 23,
      gender: "female",
      genderPreference: "both",
      relationshipGoal: "long-term",
      interests: ["Música", "Cine"],
      city: " Bogotá ",
      university: "Universidad Nacional",
    });
    assert.equal(signup.status, 201);
    cookie = signup.cookie;
    await t.test(
      "signup persists optional fields and normalizes text",
      async () => {
        assert.equal(signup.body.user.relationshipGoal, "long-term");
        assert.deepEqual(signup.body.user.interests, ["Música", "Cine"]);
        assert.equal(signup.body.user.city, "Bogotá");
        assert.deepEqual(signup.body.user.photos, []);
      },
    );
    await t.test("rejects invalid profile fields", async () => {
      for (const body of [
        { relationshipGoal: "unknown" },
        { interests: ["unknown"] },
        { interests: ["Cine", "Cine"] },
        { interests: Array(6).fill("Cine") },
        { city: "x".repeat(81) },
        { university: "x".repeat(121) },
      ])
        assert.equal(
          (await request("/api/users/update", "PUT", body)).status,
          400,
          JSON.stringify(body),
        );
    });
    await t.test(
      "valid edits persist and discovery includes only public additions",
      async () => {
        const updated = await request("/api/users/update", "PUT", {
          relationshipGoal: "campus",
          interests: ["Café"],
          city: " Medellín ",
          university: " Otra universidad ",
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.user.city, "Medellín");
        const me = await request("/api/auth/me");
        assert.equal(me.body.user.relationshipGoal, "campus");
        assert.deepEqual(me.body.user.interests, ["Café"]);
        assert.equal(me.body.user.university, "Otra universidad");
        const viewer = await request("/api/auth/signup", "POST", {
          name: "Viewer",
          email: "viewer@example.invalid",
          password: "fixture-password",
          age: 24,
          gender: "male",
          genderPreference: "both",
        });
        const originalCookie = cookie;
        cookie = viewer.cookie;
        const profiles = await request("/api/matches/user-profiles");
        cookie = originalCookie;
        const luna = profiles.body.users.find(
          (user) => user._id === signup.body.user._id,
        );
        assert.equal(luna.relationshipGoal, "campus");
        assert.deepEqual(luna.interests, ["Café"]);
        assert.equal(luna.city, "Medellín");
        assert.equal(Object.hasOwn(luna, "email"), false);
        assert.equal(Object.hasOwn(luna, "password"), false);
      },
    );
    await t.test(
      "uploads require authentication and real image bytes",
      async () => {
        assert.equal(
          (await request("/api/users/photos", "POST", { image: pixel }, false))
            .status,
          401,
        );
        assert.equal(
          (
            await request("/api/users/photos", "POST", {
              image: "data:image/png;base64,YWJj",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/api/users/photos", "POST", {
              image:
                "data:image/png;base64," +
                Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"),
            })
          ).status,
          413,
        );
      },
    );
    await t.test(
      "gallery appends, reorders, removes and refuses foreign URLs",
      async () => {
        const first = await request("/api/users/photos", "POST", {
          image: pixel,
        });
        assert.equal(first.status, 201);
        const second = await request("/api/users/photos", "POST", {
          image: pixel,
        });
        const photos = second.body.user.photos;
        assert.equal(photos.length, 2);
        assert.equal(second.body.user.image, photos[0]);
        const reordered = await request("/api/users/update", "PUT", {
          photos: [...photos].reverse(),
        });
        assert.equal(reordered.body.user.image, photos[1]);
        assert.equal(
          (
            await request("/api/users/update", "PUT", {
              photos: ["https://res.cloudinary.com/test/foreign.png"],
            })
          ).status,
          400,
        );
        const removed = await request("/api/users/update", "PUT", {
          photos: [photos[0]],
        });
        assert.deepEqual(removed.body.user.photos, [photos[0]]);
        assert.equal(removed.body.user.image, photos[0]);
      },
    );
    await t.test("concurrent uploads cannot exceed six photos", async () => {
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          request("/api/users/photos", "POST", { image: pixel }),
        ),
      );
      assert.equal(results.filter((r) => r.status === 201).length, 5);
      assert.equal(results.filter((r) => r.status === 409).length, 3);
      const me = await request("/api/auth/me");
      assert.equal(me.body.user.photos.length, 6);
      assert.equal(me.body.user.image, me.body.user.photos[0]);
      const cleared = await request("/api/users/update", "PUT", { photos: [] });
      assert.equal(cleared.body.user.image, "");
    });
    await t.test(
      "legacy images survive appending and legacy image updates keep gallery synchronized",
      async () => {
        await User.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(signup.body.user._id) },
          {
            $set: { image: "https://res.cloudinary.com/test/legacy.png" },
            $unset: { photos: "" },
          },
        );
        const me = await request("/api/auth/me");
        assert.deepEqual(me.body.user.photos, [
          "https://res.cloudinary.com/test/legacy.png",
        ]);
        const appended = await request("/api/users/photos", "POST", {
          image: pixel,
        });
        assert.equal(appended.body.user.photos.length, 2);
        assert.equal(
          appended.body.user.image,
          "https://res.cloudinary.com/test/legacy.png",
        );
        const updated = await request("/api/users/update", "PUT", {
          image: pixel,
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.user.photos.length, 2);
        assert.equal(updated.body.user.image, updated.body.user.photos[0]);
        assert.equal(updated.body.user.photos[1], appended.body.user.photos[1]);
        assert.equal(
          (
            await request("/api/users/update", "PUT", {
              image: "https://foreign.invalid/photo.png",
            })
          ).status,
          400,
        );
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await db.stop();
  }
});
