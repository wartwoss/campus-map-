// Screenshot harness for the visual gates. Drives the installed Chrome so no
// browser download is needed, with software WebGL enabled for headless runs.
//
//   node scripts/shoot.mjs [outDir]

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.SHOOT_URL ?? 'http://localhost:5173'
const OUT = process.argv[2] ?? 'screenshots'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })

async function shot(name, ms = 1800) {
  await page.waitForTimeout(ms)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('shot', name)
}

await page.goto(BASE, { waitUntil: 'networkidle' })

// 1. Exterior overview of the two-building site
await shot('01-overview', 3500)

// 2. Engineering Building, floors 1 and 2
await page.getByRole('button', { name: /Engineering Building/ }).first().click()
await shot('02-engineering-focus')
await page.getByRole('button', { name: 'Open floor plan' }).click()
await shot('03-engineering-floor-1', 3000)
await page.getByRole('button', { name: 'Floor 2', exact: true }).click()
await shot('04-engineering-floor-2', 3000)
await page.getByRole('button', { name: 'Back to campus', exact: true }).click()

// 3. Medical School Building, floors 1 and 2
await page.getByRole('button', { name: /Medical School Building/ }).first().click()
await page.getByRole('button', { name: 'Open floor plan' }).click()
await shot('05-medical-floor-1', 3000)
await page.getByRole('button', { name: 'Floor 2', exact: true }).click()
await shot('06-medical-floor-2', 3000)
await page.getByRole('button', { name: 'Back to campus', exact: true }).click()
await shot('07-back-to-campus', 2000)

await browser.close()
console.log('done')
