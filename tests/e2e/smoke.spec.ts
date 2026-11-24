import { expect, test } from '@playwright/test'

test('GET / returns 200 and has a main element', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('main')).toHaveCount(1)
})
