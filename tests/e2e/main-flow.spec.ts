/**
 * E2E: Main user flow — adapt this for each project.
 * Replace "invoice" with your domain entity.
 * Run: npm run test:e2e
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const DEMO_WALLET = process.env.TEST_WALLET_PUBKEY ?? 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGPKU3KX6Q5IEBVZ4HRR4I'

test.describe('Landing & wallet connect', () => {
  test('shows product name + CTA above fold', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible()
  })

  test('no a11y violations on landing', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toHaveLength(0)
  })
})

test.describe('Mobile 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('no horizontal scroll on landing', async ({ page }) => {
    await page.goto('/')
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = page.viewportSize()?.width ?? 375
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth)
  })

  test('primary CTA reachable without scroll on mobile', async ({ page }) => {
    await page.goto('/')
    const btn = page.getByRole('button', { name: /connect wallet/i })
    const box = await btn.boundingBox()
    expect(box).not.toBeNull()
    // Button must be within first 812px (no vertical scroll needed)
    expect(box!.y + box!.height).toBeLessThan(812)
  })
})

test.describe('Main user journey (with seed data)', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock session cookie so we skip wallet connect in tests
    await page.context().addCookies([
      {
        name: 'session',
        value: Buffer.from(JSON.stringify({ pubkey: DEMO_WALLET })).toString('base64'),
        domain: 'localhost',
        path: '/',
      },
    ])
  })

  test('dashboard loads with stats', async ({ page }) => {
    await page.goto('/dashboard')
    // Should show at least one stat card (balance, count, etc.)
    await expect(page.locator('[data-testid="stat-card"]').first()).toBeVisible()
  })

  test('create entity → see in list', async ({ page }) => {
    await page.goto('/dashboard')
    // TODO: replace with your project's create flow
    // Example for invoice project:
    // await page.getByRole('button', { name: /create invoice/i }).click()
    // await page.getByLabel(/amount/i).fill('20')
    // await page.getByRole('button', { name: /generate/i }).click()
    // await expect(page.getByText('₱20.00')).toBeVisible()
  })

  test('no a11y violations on dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    const results = await new AxeBuilder({ page }).analyze()
    // Allow max 2 violations (third-party widget issues)
    expect(results.violations.length).toBeLessThanOrEqual(2)
  })
})

test.describe('Empty state', () => {
  test('empty state has instruction text', async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'session',
        value: Buffer.from(JSON.stringify({ pubkey: 'EMPTY_USER_KEY' })).toString('base64'),
        domain: 'localhost',
        path: '/',
      },
    ])
    await page.goto('/dashboard')
    // Empty state must NOT just say "No data"
    const emptyText = await page.locator('[data-testid="empty-state"]').textContent()
    expect(emptyText).not.toMatch(/^no data$/i)
    expect(emptyText?.length).toBeGreaterThan(20)
  })
})
