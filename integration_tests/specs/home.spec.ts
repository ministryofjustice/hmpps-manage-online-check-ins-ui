import { test, expect } from '@playwright/test'
import { login, resetStubs } from '../testUtils'

test.beforeEach(async () => {
  await resetStubs()
})

test.describe('Home page', () => {
  test('signs in and shows the home page', async ({ page }) => {
    await login(page)

    await expect(page.locator('h1')).toHaveText('This site is under construction...')
  })
})
