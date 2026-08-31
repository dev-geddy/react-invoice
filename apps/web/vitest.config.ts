import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// @spec L2-TEST-01

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
  },
})
