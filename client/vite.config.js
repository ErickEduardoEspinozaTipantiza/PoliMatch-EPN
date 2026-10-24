import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.API_PROXY_TARGET || "http://localhost:5000";
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api": { target, changeOrigin: false },
        "/socket.io": { target, ws: true, changeOrigin: false },
      },
    },
    test: {
      include: ["src/**/*.test.js"],
      environment: "node",
      clearMocks: true,
    },
  };
});
