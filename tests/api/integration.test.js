import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { io as connectSocket } from "socket.io-client";
import User from "../../api/models/User.js";
import Message from "../../api/models/Message.js";

const appModule = await import("../../api/app.js").catch((error) => {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
  return {};
});

test("HTTP app can be created without listening or loading environment files", () => {
  assert.equal(
    typeof appModule.createApp,
    "function",
    "Export createApp separately from production startup",
  );
});

test(
  "API protects accounts, matching, conversations and socket sessions",
  { skip: !appModule.createApp },
  async (t) => {
    const secret = "isolated-test-secret-never-used-in-production";
    const origin = "http://localhost:5173";
    const config = {
      jwtSecret: secret,
      clientUrl: origin,
      authRateLimit: { max: 1000, windowMs: 60000 },
    };
    const db = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.14" },
    });
    await mongoose.connect(db.getUri(), { dbName: "polimatch_isolated_test" });
    const app = appModule.createApp({
      ...config,
      uploadImage: async () => {
        throw new Error("external service unavailable");
      },
    });
    const server = createServer(app);
    const { initializeSocket } =
      await import("../../api/socket/socket.server.js");
    const io = initializeSocket(server, app.locals.config);
    app.locals.io = io;
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const sockets = [];
    const request = async (
      path,
      { method = "GET", cookie, body, headers = {} } = {},
    ) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        ...(body !== undefined
          ? { body: typeof body === "string" ? body : JSON.stringify(body) }
          : {}),
      });
      return {
        status: response.status,
        body: await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
      };
    };
    const account = async (name, gender = "female") => {
      const result = await request("/api/auth/signup", {
        method: "POST",
        body: {
          name,
          email: `${name}@example.invalid`,
          password: "fixture-password",
          age: 25,
          gender,
          genderPreference: "both",
        },
      });
      assert.equal(result.status, 201);
      return { ...result.body.user, cookie: result.cookie };
    };
    const socket = (cookie) => {
      const client = connectSocket(base, {
        forceNew: true,
        reconnection: false,
        transports: ["websocket"],
        ...(cookie
          ? { extraHeaders: { Cookie: cookie, Origin: origin } }
          : { auth: { userId: "forged" } }),
      });
      sockets.push(client);
      return client;
    };
    const event = (client, name, timeout = 4000) =>
      Promise.race([
        new Promise((resolve) => client.once(name, (...args) => resolve(args))),
        new Promise((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error(`Missing socket event ${name}`)),
            timeout,
          );
          timer.unref();
        }),
      ]);
    try {
      const alice = await account("alice");
      const bob = await account("bob", "male");
      const outsider = await account("outsider");

      await t.test(
        "auth and discovery never expose password or other users' private fields",
        async () => {
          assert.equal(Object.hasOwn(alice, "password"), false);
          const login = await request("/api/auth/login", {
            method: "POST",
            body: {
              email: " ALICE@EXAMPLE.INVALID ",
              password: "fixture-password",
            },
          });
          assert.equal(login.status, 200);
          assert.equal(Object.hasOwn(login.body.user, "password"), false);
          const me = await request("/api/auth/me", { cookie: alice.cookie });
          assert.equal(me.body.user._id, alice._id);
          assert.equal(Object.hasOwn(me.body.user, "password"), false);
          const profiles = await request("/api/matches/user-profiles", {
            cookie: alice.cookie,
          });
          assert.equal(profiles.status, 200);
          assert.ok(profiles.body.users.length >= 2);
          for (const profile of profiles.body.users)
            for (const field of [
              "password",
              "email",
              "likes",
              "dislikes",
              "matches",
              "gender",
              "genderPreference",
            ]) {
              assert.equal(Object.hasOwn(profile, field), false, field);
            }
          assert.equal(me.body.user.gender, "female");
          assert.equal(me.body.user.genderPreference, "both");
        },
      );

      await t.test(
        "discovery bounds each batch and exposes remaining candidates after decisions",
        async () => {
          const discoverer = await account("discoverer");
          await User.insertMany(
            Array.from({ length: 35 }, (_, index) => ({
              name: `Candidate ${index}`,
              email: `candidate-${index}@example.invalid`,
              password: "unused-fixture",
              age: 25,
              gender: "male",
              genderPreference: "both",
            })),
          );
          const first = await request("/api/matches/user-profiles", {
            cookie: discoverer.cookie,
          });
          assert.equal(first.status, 200);
          assert.equal(first.body.users.length, 30);
          assert.equal(first.body.hasMore, true);
          for (const candidate of first.body.users) {
            assert.equal(
              (
                await request(`/api/matches/swipe-left/${candidate._id}`, {
                  method: "POST",
                  cookie: discoverer.cookie,
                })
              ).status,
              200,
            );
          }
          const second = await request("/api/matches/user-profiles", {
            cookie: discoverer.cookie,
          });
          assert.equal(second.body.users.length, 8);
          assert.equal(second.body.hasMore, false);
          const seen = new Set(first.body.users.map(({ _id }) => _id));
          assert.ok(second.body.users.every(({ _id }) => !seen.has(_id)));
        },
      );

      await t.test(
        "profile editing rejects reserved fields, validates age, and can clear a photo",
        async () => {
          for (const body of [
            null,
            [],
            { password: "replacement" },
            { matches: [bob._id] },
            { $set: { age: 1 } },
            { email: "other@example.invalid" },
            { age: 17 },
            { image: 7 },
            { bio: "x".repeat(501) },
          ]) {
            assert.equal(
              (
                await request("/api/users/update", {
                  method: "PUT",
                  cookie: alice.cookie,
                  body,
                })
              ).status,
              400,
            );
          }
          const result = await request("/api/users/update", {
            method: "PUT",
            cookie: alice.cookie,
            body: { name: "Alicia", bio: "Hola", image: "" },
          });
          assert.equal(result.status, 200);
          assert.equal(result.body.user.name, "Alicia");
          assert.equal(result.body.user.image, "");
        },
      );

      await t.test(
        "signup rejects bcrypt truncation by UTF-8 bytes while legacy long passwords can log in",
        async () => {
          const data = {
            name: "Unicode",
            email: "unicode@example.invalid",
            age: 25,
            gender: "female",
            genderPreference: "both",
          };
          for (const password of ["x".repeat(73), "é".repeat(37)]) {
            assert.equal(
              (
                await request("/api/auth/signup", {
                  method: "POST",
                  body: { ...data, password },
                })
              ).status,
              400,
            );
          }
          const password = "é".repeat(36);
          assert.equal(
            (
              await request("/api/auth/signup", {
                method: "POST",
                body: { ...data, password },
              })
            ).status,
            201,
          );
          assert.equal(
            (
              await request("/api/auth/login", {
                method: "POST",
                body: { email: data.email, password },
              })
            ).status,
            200,
          );
          await User.create({
            ...data,
            name: "Legacy long password",
            email: "long-password@example.invalid",
            password: "é".repeat(40),
          });
          assert.equal(
            (
              await request("/api/auth/login", {
                method: "POST",
                body: {
                  email: "long-password@example.invalid",
                  password: "é".repeat(40),
                },
              })
            ).status,
            200,
          );
        },
      );

      await t.test(
        "invalid, missing and expired sessions return JSON 401",
        async () => {
          assert.equal((await request("/api/auth/me")).status, 401);
          assert.equal(
            (await request("/api/auth/me", { cookie: "jwt=invalid" })).status,
            401,
          );
          const expired = jwt.sign(
            { id: alice._id, jti: "expired-fixture" },
            secret,
            { expiresIn: -1 },
          );
          assert.equal(
            (await request("/api/auth/me", { cookie: `jwt=${expired}` }))
              .status,
            401,
          );
          const duplicate = await request("/api/auth/signup", {
            method: "POST",
            body: {
              name: "duplicate",
              email: "alice@example.invalid",
              password: "fixture-password",
              age: 25,
              gender: "female",
              genderPreference: "both",
            },
          });
          assert.equal(duplicate.status, 409);
        },
      );

      await t.test(
        "uppercase object ids cannot bypass self-selection or an existing pass",
        async () => {
          const current = await account("canonical-current");
          const target = await account("canonical-target");
          const selfLike = await request(
            `/api/matches/swipe-right/${current._id.toUpperCase()}`,
            { method: "POST", cookie: current.cookie },
          );
          const selfPass = await request(
            `/api/matches/swipe-left/${current._id.toUpperCase()}`,
            { method: "POST", cookie: current.cookie },
          );
          assert.deepEqual([selfLike.status, selfPass.status], [400, 400]);
          assert.equal(
            (
              await request(`/api/matches/swipe-left/${target._id}`, {
                method: "POST",
                cookie: current.cookie,
              })
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                `/api/matches/swipe-right/${target._id.toUpperCase()}`,
                { method: "POST", cookie: current.cookie },
              )
            ).status,
            409,
          );
          assert.deepEqual((await User.findById(current._id)).likes, []);
        },
      );

      await t.test(
        "untrusted browser origins, malformed JSON and unknown API routes get JSON errors",
        async () => {
          assert.equal(
            (
              await request("/api/auth/logout", {
                method: "POST",
                cookie: alice.cookie,
                headers: { Origin: "https://untrusted.invalid" },
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request("/api/auth/logout", {
                method: "POST",
                cookie: alice.cookie,
                headers: { "Sec-Fetch-Site": "cross-site" },
              })
            ).status,
            403,
          );
          assert.equal(
            (await request("/api/auth/login", { method: "POST", body: "{" }))
              .status,
            400,
          );
          assert.equal((await request("/api/unknown")).status, 404);
          assert.equal((await request("/api/health")).status, 200);
        },
      );

      await t.test(
        "sockets require a real cookie session and reject a disallowed origin",
        async () => {
          const anonymous = socket();
          const [error] = await event(anonymous, "connect_error");
          assert.ok(error);
          const rejected = connectSocket(base, {
            forceNew: true,
            reconnection: false,
            transports: ["websocket"],
            extraHeaders: {
              Cookie: alice.cookie,
              Origin: "https://untrusted.invalid",
            },
          });
          sockets.push(rejected);
          assert.ok((await event(rejected, "connect_error"))[0]);
        },
      );

      await t.test(
        "simultaneous repeated likes produce one mutual match without changing passwords",
        async () => {
          assert.equal(
            (
              await request(`/api/matches/swipe-right/${alice._id}`, {
                method: "POST",
                cookie: alice.cookie,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("/api/matches/swipe-left/not-an-id", {
                method: "POST",
                cookie: alice.cookie,
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request(
                "/api/matches/swipe-left/aaaaaaaaaaaaaaaaaaaaaaaa",
                { method: "POST", cookie: alice.cookie },
              )
            ).status,
            404,
          );
          const results = await Promise.all(
            Array.from({ length: 8 }, (_, index) =>
              request(
                `/api/matches/swipe-right/${index % 2 ? alice._id : bob._id}`,
                {
                  method: "POST",
                  cookie: index % 2 ? bob.cookie : alice.cookie,
                },
              ),
            ),
          );
          assert.ok(
            results.every(({ status }) => status === 200),
            JSON.stringify(results),
          );
          for (const [person, target] of [
            [alice, bob],
            [bob, alice],
          ]) {
            const persisted = await User.findById(person._id).select(
              "+password",
            );
            assert.deepEqual(persisted.likes.map(String), [target._id]);
            assert.deepEqual(persisted.matches.map(String), [target._id]);
            assert.equal(
              await persisted.matchPassword("fixture-password"),
              true,
            );
          }
          const matches = await request("/api/matches", {
            cookie: alice.cookie,
          });
          assert.equal(matches.body.matches.length, 1);
          assert.equal(
            Object.hasOwn(matches.body.matches[0], "password"),
            false,
          );
          assert.equal(
            Object.hasOwn(matches.body.matches[0], "genderPreference"),
            false,
          );
          assert.equal(Object.hasOwn(matches.body.matches[0], "gender"), false);
          const saved = await User.findById(alice._id).select("+password");
          saved.bio = "Saved without a password change";
          await saved.save();
          assert.equal(
            await (
              await User.findById(alice._id).select("+password")
            ).matchPassword("fixture-password"),
            true,
          );
        },
      );

      await t.test(
        "messages require mutual matching and valid content",
        async () => {
          assert.equal(
            (
              await request("/api/messages/send", {
                method: "POST",
                cookie: outsider.cookie,
                body: { receiverId: alice._id, content: "unwanted" },
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request(`/api/messages/conversation/${alice._id}`, {
                cookie: outsider.cookie,
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request("/api/messages/send", {
                method: "POST",
                cookie: alice.cookie,
                body: { receiverId: bob._id, content: "   " },
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("/api/messages/send", {
                method: "POST",
                cookie: alice.cookie,
                body: { receiverId: bob._id, content: "x".repeat(2001) },
              })
            ).status,
            400,
          );
          assert.equal(
            (
              await request("/api/messages/conversation/not-an-id", {
                cookie: alice.cookie,
              })
            ).status,
            400,
          );
        },
      );

      await t.test(
        "all authenticated tabs receive messages after another tab disconnects",
        async () => {
          const bobOne = socket(bob.cookie);
          await event(bobOne, "connect");
          const bobTwo = socket(bob.cookie);
          await event(bobTwo, "connect");
          bobOne.disconnect();
          const notification = event(bobTwo, "newMessage");
          const sent = await request("/api/messages/send", {
            method: "POST",
            cookie: alice.cookie,
            body: { receiverId: bob._id, content: "hola" },
          });
          assert.equal(sent.status, 201);
          const [{ message }] = await notification;
          assert.equal(message._id, sent.body.message._id);
          assert.equal(message.sender, alice._id);
        },
      );

      await t.test(
        "transport failure after persistence keeps messages and mutual likes successful",
        async () => {
          const one = await account("notification-one");
          const two = await account("notification-two", "male");
          assert.equal(
            (
              await request(`/api/matches/swipe-right/${two._id}`, {
                method: "POST",
                cookie: one.cookie,
              })
            ).status,
            200,
          );
          app.locals.io = {
            in: () => ({
              fetchSockets: async () => {
                throw new Error("transport unavailable");
              },
            }),
          };
          try {
            const liked = await request(`/api/matches/swipe-right/${one._id}`, {
              method: "POST",
              cookie: two.cookie,
            });
            const sent = await request("/api/messages/send", {
              method: "POST",
              cookie: one.cookie,
              body: { receiverId: two._id, content: "Persisted even offline" },
            });
            assert.deepEqual([liked.status, sent.status], [200, 201]);
            assert.deepEqual(
              (await User.findById(one._id)).matches.map(String),
              [two._id],
            );
            assert.deepEqual(
              (await User.findById(two._id)).matches.map(String),
              [one._id],
            );
            assert.equal(
              (await Message.findById(sent.body.message._id)).content,
              "Persisted even offline",
            );
          } finally {
            app.locals.io = io;
          }
        },
      );

      await t.test(
        "history pages backwards without missing equal-timestamp messages",
        async () => {
          await Message.deleteMany({});
          const when = new Date("2026-01-01T00:00:00Z");
          for (let index = 0; index < 5; index++)
            await Message.create({
              sender: alice._id,
              receiver: bob._id,
              content: `item-${index}`,
              createdAt: when,
              updatedAt: when,
            });
          const latest = await request(
            `/api/messages/conversation/${bob._id}?limit=2`,
            { cookie: alice.cookie },
          );
          assert.deepEqual(
            latest.body.messages.map(({ content }) => content),
            ["item-3", "item-4"],
          );
          assert.equal(latest.body.hasMore, true);
          const previous = await request(
            `/api/messages/conversation/${bob._id}?limit=2&before=${encodeURIComponent(latest.body.nextCursor)}`,
            { cookie: alice.cookie },
          );
          assert.deepEqual(
            previous.body.messages.map(({ content }) => content),
            ["item-1", "item-2"],
          );
          const oldest = await request(
            `/api/messages/conversation/${bob._id}?limit=2&before=${encodeURIComponent(previous.body.nextCursor)}`,
            { cookie: alice.cookie },
          );
          assert.deepEqual(
            oldest.body.messages.map(({ content }) => content),
            ["item-0"],
          );
          assert.equal(oldest.body.hasMore, false);
          assert.equal(oldest.body.nextCursor, null);
          assert.equal(
            (
              await request(
                `/api/messages/conversation/${bob._id}?before=invalid`,
                { cookie: alice.cookie },
              )
            ).status,
            400,
          );
        },
      );

      await t.test(
        "image failures preserve profile and oversized images return 413",
        async () => {
          const pixel =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jpecAAAAASUVORK5CYII=";
          const result = await request("/api/users/update", {
            method: "PUT",
            cookie: alice.cookie,
            body: { name: "Should not persist", image: pixel },
          });
          assert.equal(result.status, 502);
          assert.equal((await User.findById(alice._id)).name, "Alicia");
          assert.equal(
            (
              await request("/api/users/update", {
                method: "PUT",
                cookie: alice.cookie,
                body: {
                  image: "data:image/png;base64,dGhpcyBpcyBub3QgYSBwaG90bw==",
                },
              })
            ).status,
            400,
          );
          const large =
            "data:image/png;base64," +
            Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64");
          assert.equal(
            (
              await request("/api/users/update", {
                method: "PUT",
                cookie: alice.cookie,
                body: { image: large },
              })
            ).status,
            413,
          );
        },
      );

      await t.test(
        "logout revokes only that session and disconnects its sockets",
        async () => {
          const login = await request("/api/auth/login", {
            method: "POST",
            body: {
              email: "alice@example.invalid",
              password: "fixture-password",
            },
          });
          const first = socket(alice.cookie);
          await event(first, "connect");
          const second = socket(login.cookie);
          await event(second, "connect");
          const disconnected = event(first, "disconnect");
          assert.equal(
            (
              await request("/api/auth/logout", {
                method: "POST",
                cookie: alice.cookie,
              })
            ).status,
            200,
          );
          await disconnected;
          assert.equal(second.connected, true);
          assert.equal(
            (await request("/api/auth/me", { cookie: alice.cookie })).status,
            401,
          );
          assert.equal(
            (await request("/api/auth/me", { cookie: login.cookie })).status,
            200,
          );
          const stale = socket(alice.cookie);
          assert.ok((await event(stale, "connect_error"))[0]);
        },
      );

      await t.test(
        "deleted account loses HTTP session and cannot receive socket events",
        async () => {
          const deleted = await account("deleted");
          const client = socket(deleted.cookie);
          await event(client, "connect");
          await User.deleteOne({ _id: deleted._id });
          assert.equal(
            (await request("/api/auth/me", { cookie: deleted.cookie })).status,
            401,
          );
          const { emitToUser } =
            await import("../../api/socket/socket.server.js");
          assert.equal(
            await emitToUser(io, deleted._id, "newMatch", { _id: bob._id }),
            false,
          );
          const denied = socket(deleted.cookie);
          assert.ok((await event(denied, "connect_error"))[0]);
        },
      );

      await t.test(
        "socket expires when the authenticated JWT expires",
        async () => {
          const { default: Session } =
            await import("../../api/models/Session.js");
          const jti = "short-lived-session";
          await Session.create({
            _id: jti,
            user: bob._id,
            expiresAt: new Date(Date.now() + 1500),
          });
          const token = jwt.sign({ id: bob._id }, secret, {
            jwtid: jti,
            expiresIn: 1,
          });
          const client = socket(`jwt=${token}`);
          await event(client, "connect");
          await event(client, "disconnect", 2500);
          assert.equal(client.connected, false);
        },
      );

      await t.test(
        "legacy mixed-case email still logs in and cannot be registered again",
        async () => {
          const legacy = await account("legacy");
          await User.collection.updateOne(
            { _id: new mongoose.Types.ObjectId(legacy._id) },
            { $set: { email: "Legacy@Example.Invalid" } },
          );
          const login = await request("/api/auth/login", {
            method: "POST",
            body: {
              email: "legacy@example.invalid",
              password: "fixture-password",
            },
          });
          assert.equal(login.status, 200);
          const duplicate = await request("/api/auth/signup", {
            method: "POST",
            body: {
              name: "legacy",
              email: "legacy@example.invalid",
              password: "fixture-password",
              age: 25,
              gender: "female",
              genderPreference: "both",
            },
          });
          assert.equal(duplicate.status, 409);
        },
      );

      await t.test(
        "auth endpoint rate limit is enforced without throttling unrelated API routes",
        async () => {
          const limitedApp = appModule.createApp({
            ...config,
            authRateLimit: { max: 2, windowMs: 60000 },
          });
          const limitedServer = createServer(limitedApp);
          await new Promise((resolve) =>
            limitedServer.listen(0, "127.0.0.1", resolve),
          );
          const url = `http://127.0.0.1:${limitedServer.address().port}`;
          try {
            const options = {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: "missing@example.invalid",
                password: "fixture",
              }),
            };
            assert.equal(
              (await fetch(url + "/api/auth/login", options)).status,
              401,
            );
            assert.equal(
              (await fetch(url + "/api/auth/login", options)).status,
              401,
            );
            assert.equal(
              (await fetch(url + "/api/auth/login", options)).status,
              429,
            );
            assert.equal((await fetch(url + "/api/health")).status, 200);
          } finally {
            limitedServer.closeAllConnections();
            await new Promise((resolve) => limitedServer.close(resolve));
          }
        },
      );
    } finally {
      for (const client of sockets) client.disconnect();
      await io?.close();
      server.closeAllConnections();
      if (server.listening)
        await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await db.stop();
    }
  },
);
