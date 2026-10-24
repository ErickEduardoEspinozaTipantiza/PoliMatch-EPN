import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createServer as createViteServer } from "../../client/node_modules/vite/dist/node/index.js";
import react from "../../client/node_modules/@vitejs/plugin-react/dist/index.js";
import { createApp } from "../../api/app.js";
import { initializeSocket } from "../../api/socket/socket.server.js";

// A disposable MongoDB and real application, without production startup, .env,
// seed scripts, credentials, or external upload services.
let db, api, io, vite, closing;
const close = () =>
  (closing ||= (async () => {
    await vite?.close();
    await io?.close();
    api?.closeAllConnections();
    if (api?.listening) await new Promise((resolve) => api.close(resolve));
    await mongoose.disconnect();
    await db?.stop();
  })());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });

try {
  db = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.14" },
  });
  await mongoose.connect(db.getUri("polimatch_fullstack_test"));
  const app = createApp({
    jwtSecret: "isolated-fullstack-secret-never-used-in-production",
    clientUrl: "http://127.0.0.1:5179",
    production: false,
    authRateLimit: { max: 100, windowMs: 60_000 },
    uploadImage: async () => {
      throw new Error("External uploads are disabled in this isolated test.");
    },
  });
  api = createServer(app);
  io = initializeSocket(api, app.locals.config);
  app.locals.io = io;
  await new Promise((resolve, reject) => {
    api.once("error", reject);
    api.listen(5002, "127.0.0.1", () => {
      api.off("error", reject);
      resolve();
    });
  });
  vite = await createViteServer({
    root: fileURLToPath(new URL("../../client", import.meta.url)),
    configFile: false,
    envFile: false,
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify("/api"),
      "import.meta.env.VITE_SOCKET_URL": JSON.stringify(
        "http://127.0.0.1:5179",
      ),
    },
    server: {
      host: "127.0.0.1",
      port: 5179,
      strictPort: true,
      proxy: {
        "/api": { target: "http://127.0.0.1:5002", changeOrigin: false },
        "/socket.io": {
          target: "http://127.0.0.1:5002",
          changeOrigin: false,
          ws: true,
        },
      },
    },
  });
  await vite.listen();
  console.log(
    "Isolated fullstack test ready: frontend 5179, API 5002, disposable MongoDB.",
  );
} catch {
  console.error(
    "Isolated fullstack test failed to start. Production configuration was not loaded.",
  );
  await close();
  process.exitCode = 1;
}
