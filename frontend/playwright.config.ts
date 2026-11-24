import { defineConfig } from '@playwright/test'

/**
 * Visual regression / smoke tests. Uses the locally installed Chrome so no
 * browser download is required. Run against the dev server:
 *
 *   npm run dev            (in another terminal)
 *   npx playwright test
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: process.env.SHOOT_URL ?? 'http://localhost:5173',
    viewport: { width: 1600, height: 900 },
    channel: 'chrome',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  reporter: [['list']],
})
