import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

// Separate from vite.config.ts: the app config pulls in PWA and router plugins the tests don't need
export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
