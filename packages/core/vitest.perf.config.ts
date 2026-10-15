import { defineConfig } from "vitest/config";

// Timing tests run alone, in one process, so other test files don't disturb the measurements.
export default defineConfig({
  test: {
    include: ["test/**/*.perf.ts"],
    fileParallelism: false,
    pool: "forks",
  },
});
