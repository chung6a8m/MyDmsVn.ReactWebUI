import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Opt-in only. The backend fixture owns SQL, TestServer, process lifetime and IPC.
// Default hosted unit tests never select this file and need no SQL credentials.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/integration/web4-ports.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 10_000,
    retry: 0,
  },
});
