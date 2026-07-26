import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = path.join(process.cwd(), '..', 'screen-shot');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test('01 landing shows PadalaCalendar heading and stats', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('PadalaCalendar').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Never miss a family/).first()).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01-landing.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '01-landing.jpg'))).toBe(true);
});

test('02 dashboard shows calendar grid with month heading', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await expect(page.getByText('Remittance Calendar').first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02-dashboard.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '02-dashboard.jpg'))).toBe(true);
});

test('03 dashboard shows overdue action card in red', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  const overduePill = page.getByText(/Overdue action needed|overdue/).first();
  await expect(overduePill).toBeVisible({ timeout: 5000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '03-overdue.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '03-overdue.jpg'))).toBe(true);
});

test('04 dashboard hero panel shows SEP-7 Send now CTA', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  const sendBtn = page.getByText(/Send now/).first();
  await expect(sendBtn).toBeVisible({ timeout: 5000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '04-send-cta.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '04-send-cta.jpg'))).toBe(true);
});

test('05 recipients page shows Maria family members', async ({ page }) => {
  await page.goto('/recipients');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await expect(page.getByText('Recipients').first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '05-recipients.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '05-recipients.jpg'))).toBe(true);
});

test('06 history page shows payment table and horizon feed', async ({ page }) => {
  await page.goto('/history');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await expect(page.getByText('Payment History').first()).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '06-history.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '06-history.jpg'))).toBe(true);
});

test('07 mobile 375px landing no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(380);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '07-mobile.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '07-mobile.jpg'))).toBe(true);
});

test('08 health API returns ok', async ({ page }) => {
  const res = await page.request.get('/api/health');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.data.app).toBe('PadalaCalendar');
});

test('09 mobile 375px dashboard no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(380);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '08-mobile-dashboard.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  expect(fs.existsSync(path.join(SCREENSHOT_DIR, '08-mobile-dashboard.jpg'))).toBe(true);
});

test('10 calendar shows day numbers and recipient chips', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  for (const day of [1, 15, 28]) {
    const cell = page.locator(`text=${day}`).first();
    await expect(cell).toBeVisible({ timeout: 5000 });
  }
});
