import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = { '@': fileURLToPath(new URL('./', import.meta.url)) }

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.tsx'],
        },
      },
    ],
  },
})
