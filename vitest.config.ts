import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname_esm = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: ['lib/**/*.test.ts', 'lib/types.ts', 'app/**/*.test.ts', 'app/api/_test-helpers.ts'],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': __dirname_esm,
    },
  },
})
