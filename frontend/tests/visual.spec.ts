import { expect, test } from '@playwright/test'

/** Smoke tests for the two-building Mankato map and its source floor plans. */

test('exterior opens on the two-building campus overview', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Campus Map' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('Minnesota State University, Mankato').first()).toBeVisible()

  // Only two buildings exist, so both are labelled from the overview.
  await expect(page.locator('.building-label')).toHaveCount(2)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/two-building-overview.png' })
})

test('opening a building shows its source floor plan and switches floors', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /Engineering Building/ }).first().click()
  await page.getByRole('button', { name: 'Open floor plan' }).click()

  await expect(page.locator('.interior-header')).toBeVisible()
  await expect(page.locator('.floor-chip')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Floor 1', exact: true })).toHaveClass(/is-active/)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/two-building-floor-1.png' })

  await page.getByRole('button', { name: 'Floor 2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Floor 2', exact: true })).toHaveClass(/is-active/)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'test-results/two-building-floor-2.png' })
})

test('back to campus restores the exterior scene', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /Medical School Building/ }).first().click()
  await page.getByRole('button', { name: 'Open floor plan' }).click()
  await expect(page.locator('.interior-header')).toBeVisible()

  await page.getByRole('button', { name: 'Back to campus', exact: true }).click()
  await page.waitForTimeout(2000)
  await expect(page.locator('.interior-header')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.screenshot({ path: 'test-results/two-building-back.png' })
})
