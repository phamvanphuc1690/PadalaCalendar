import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const outputDir = path.resolve(__dirname, '../screen-shot');

async function capture() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await desktop.newPage();

  const shots: Array<[string, string]> = [
    ['01-landing.jpg', '/'],
    ['02-dashboard.jpg', '/dashboard'],
    ['03-recipients.jpg', '/recipients'],
    ['04-history.jpg', '/history'],
  ];

  for (const [filename, route] of shots) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(outputDir, filename),
      type: 'jpeg',
      quality: 85,
      fullPage: true,
    });
    console.log(`saved ${filename}`);
  }

  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({
    path: path.join(outputDir, '05-mobile-dashboard.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({
    path: path.join(outputDir, '06-mobile-landing.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: false,
  });
  await mobile.close();
  await browser.close();
  console.log(`saved screenshots to ${outputDir}`);
}

capture().catch((error) => {
  console.error(error);
  process.exit(1);
});
