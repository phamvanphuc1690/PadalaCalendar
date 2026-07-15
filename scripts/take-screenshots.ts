/**
 * Screenshot script for PadalaCalendar
 * Takes 6 JPEG screenshots of key pages
 */
import { chromium } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3004';
const OUT_DIR = path.resolve(__dirname, '../../../screen-shot');

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  try {
    // Desktop context
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();

    // 01-landing
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT_DIR}/01-landing.jpg`, type: 'jpeg', quality: 85, fullPage: true });
    console.log('✅ 01-landing.jpg');

    // 02-dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${OUT_DIR}/02-dashboard.jpg`, type: 'jpeg', quality: 85, fullPage: true });
    console.log('✅ 02-dashboard.jpg');

    // 03-recipients (get first recipient ID from API)
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/recipients');
      return r.json();
    });
    const recipients = res.data ?? [];
    console.log(`Found ${recipients.length} recipients`);

    if (recipients.length > 0) {
      // 03-send-form
      await page.goto(`${BASE_URL}/send/${recipients[0].id}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${OUT_DIR}/03-send-form.jpg`, type: 'jpeg', quality: 85, fullPage: true });
      console.log('✅ 03-send-form.jpg');

      // 04-send-second recipient
      if (recipients.length > 1) {
        await page.goto(`${BASE_URL}/send/${recipients[1].id}`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: `${OUT_DIR}/04-send-second.jpg`, type: 'jpeg', quality: 85, fullPage: true });
        console.log('✅ 04-send-second.jpg');
      }
    }

    // 05-landing-scroll (below fold features)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT_DIR}/05-features.jpg`, type: 'jpeg', quality: 85 });
    console.log('✅ 05-features.jpg');

    await ctx.close();

    // 06-mobile view
    const mobileCtx = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await mobilePage.screenshot({ path: `${OUT_DIR}/06-mobile.jpg`, type: 'jpeg', quality: 85, fullPage: false });
    console.log('✅ 06-mobile.jpg');

    await mobileCtx.close();
    console.log('\n🎉 All 6 screenshots saved to screen-shot/');
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch((err) => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
