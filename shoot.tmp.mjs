import { chromium } from '@playwright/test'
const base = 'http://localhost:3000'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const shot = async (name, { login } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  if (login) {
    await page.goto(`${base}/login`)
    await page.fill('input[name="email"]', login.email)
    await page.fill('input[name="password"]', login.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/account|\/$/, { timeout: 30000 }).catch(() => {})
  }
  for (const [label, path] of [['home', '/'], ['shop', '/shop'], ['product', '/products/ahsap-kuksa-bardak'], ['toptan', '/toptan-basvuru']]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `/tmp/shots/${name}-${label}.png`, fullPage: false })
  }
  await ctx.close()
}
await shot('anon')
await shot('wholesale', { login: { email: 'toptan@example.com', password: 'password' } })
await browser.close()
