import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    // Node, not jsdom. Nothing under tests/unit touches the DOM, and jsdom puts
    // Node's Buffer in a different realm from the test globals — which makes
    // `chunk instanceof Uint8Array` false for real zlib output and rejected
    // genuinely valid 3MF uploads.
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // tests/e2e is Playwright's. Vitest importing those specs throws
    // "Playwright Test did not expect test() to be called here".
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
});
