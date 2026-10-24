import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Use the current Node runtime, including environments without npm on PATH.
const root = fileURLToPath(new URL("../", import.meta.url));
const client = resolve(root, "client");
const checks = [
  ["API", ["--test", "tests/api/*.test.js"], root],
  [
    "Estado del cliente",
    [resolve(client, "node_modules/vitest/vitest.mjs"), "run"],
    client,
  ],
  ["Lint", [resolve(client, "node_modules/eslint/bin/eslint.js"), "."], client],
  [
    "Build",
    [resolve(client, "node_modules/vite/bin/vite.js"), "build"],
    client,
  ],
];
for (const [name, args, cwd] of checks) {
  console.log(`\nPoliMatch · ${name}`);
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
