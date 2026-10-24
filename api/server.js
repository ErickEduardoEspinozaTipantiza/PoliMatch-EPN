import dotenv from "dotenv";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { validateEnvironment } from "./config/runtime.js";
import { initializeSocket } from "./socket/socket.server.js";

export async function startServer({
  env = process.env,
  connectDatabase = connectDB,
} = {}) {
  const config = validateEnvironment(env);
  await connectDatabase(env.MONGO_URI, { production: config.production });
  const app = createApp(config);
  const httpServer = createServer(app);
  const io = initializeSocket(httpServer, app.locals.config);
  app.locals.io = io;
  try {
    await new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(config.port, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await io.close();
    await mongoose.disconnect();
    throw error;
  }
  let closing;
  const close = () =>
    (closing ||= (async () => {
      await io.close();
      if (httpServer.listening)
        await new Promise((resolve) => httpServer.close(resolve));
      await mongoose.disconnect();
    })());
  return { app, httpServer, io, close };
}

const isEntry =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  dotenv.config();
  startServer()
    .then(({ httpServer, close }) => {
      console.log(
        `PoliMatch disponible en el puerto ${httpServer.address().port}.`,
      );
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, () => {
          const timer = setTimeout(() => process.exit(1), 10000);
          timer.unref();
          close().then(
            () => process.exit(0),
            () => process.exit(1),
          );
        });
    })
    .catch(() => {
      console.error(
        "No se pudo iniciar PoliMatch. Verifica MONGO_URI (replica set), JWT_SECRET (32 caracteres), CLIENT_URL y PORT. No se ha abierto el servidor HTTP.",
      );
      process.exitCode = 1;
    });
}
