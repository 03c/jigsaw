import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 60_000,
    hookTimeout: 60_000,
    server: {
      deps: {
        inline: ["react-router"],
      },
    },
  },
});
