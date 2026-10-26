import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Unit tests cover plain TypeScript in lib/ (wear engine, planner), so no DOM is needed.
    environment: "node",
    include: ["lib/**/*.test.ts"],
    passWithNoTests: true,
  },
});
