import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'npm run build && npm run start -- -p 3100',
    port: 3100,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXT_PUBLIC_E2E: '1' },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
})
