import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.js", "src/features/**/*.test.js"], css: false },
});
