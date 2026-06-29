import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv'
// dotenv.config({ path: path.resolve(__dirname, '.env') })

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  outputDir: './test_results/playwright/test-output',
  testDir: './integration_tests/specs',
  /* Wait for wiremock and the feature server to be ready before running tests. */
  globalSetup: './integration_tests/globalSetup.ts',
  /* Maximum time one test can run for. (millis) */
  timeout: 3 * 60 * 1000,
  /* Maximum time test suite can run for. (millis) */
  globalTimeout: 60 * 60 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Ensure tests run consecutively due to inability to share wiremock instance */
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test_results/playwright/report', open: process.env.CI ? 'never' : 'on-failure' }],
    ['junit', { outputFile: 'test_results/playwright/junit.xml' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    actionTimeout: 30 /* seconds */ * 1000,
    timezoneId: 'Europe/London',
    launchOptions: { slowMo: 150 },
    screenshot: 'only-on-failure',
    trace: process.env.CI ? 'off' : 'on',
    ...devices['Desktop Chrome'],
    testIdAttribute: 'data-qa',
    baseURL: 'http://localhost:3007',
  },

  /* When running locally, start wiremock and the feature server automatically so
   * `npm run int-test` is self-contained. In CI these are already started by the
   * shared workflow, so we leave webServer undefined and run against those. */
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'docker compose -f docker-compose-test.yml up wiremock',
          url: 'http://localhost:9091/__admin/mappings',
          reuseExistingServer: true,
          timeout: 60 * 1000,
        },
        {
          command: 'npm run build && npm run start-feature',
          url: 'http://localhost:3007/ping',
          reuseExistingServer: true,
          timeout: 120 * 1000,
        },
      ],

  /* Configure projects */
  projects: [{ name: 'default' }],
})
