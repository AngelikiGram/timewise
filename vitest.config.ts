import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"] },
  // The web app's import aliases, so its libraries can be tested directly.
  resolve: {
    alias: {
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
});
