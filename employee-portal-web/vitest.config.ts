import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// G2-F10: node:test cannot render JSX, so component/interaction and automated-accessibility
// tests run under Vitest + jsdom. node:test still owns the non-JSX `*.test.ts` logic suites;
// Vitest only picks up `*.test.tsx`, so the two runners never overlap.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.tsx"],
    css: false,
  },
});
