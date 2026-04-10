import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest-react-setup.ts"],
    include: ["tests/unit/frontend/**/*.test.tsx"],
    exclude: ["**/node_modules/**"],
  },
});
