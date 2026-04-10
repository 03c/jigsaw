import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    // jsdom for React; Node builtins (e.g. crypto) still run in Vitest's Node process
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup/vitest-setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/**/*.ts", "app/**/*.tsx"],
      exclude: ["app/routes.ts"],
    },
    server: {
      deps: {
        inline: ["react-router"],
      },
    },
  },
});
