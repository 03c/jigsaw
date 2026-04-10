import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * Integration tests (Testcontainers, real DB). Requires Docker.
 * Run: npm run test:integration
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    pool: "forks",
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
