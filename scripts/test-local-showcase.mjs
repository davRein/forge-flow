// Run after npm.cmd run start:demo; requires the sibling FlowPilot Playwright dependency and Edge.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../flowpilot-codex-starter/frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
const page = await context.newPage();
const errors = [];
const blocked = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (!['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'http://localhost:5177', 'http://localhost:5176'].includes(url.origin)
      || (url.port === '5173' && url.pathname.startsWith('/api/'))) {
    blocked.push(url.origin + url.pathname);
    return route.abort();
  }
  return route.continue();
});
const apps = [
  { label: 'AI Knowledge Hub', port: 3000, path: 'knowledgeHub/documents', marker: '.sidebar', embedded: true },
  { label: 'FlowPilot', port: 5174, path: 'flowPilot/workflows', marker: '.workflow-list', embedded: true },
  { label: 'PulseWatch', port: 5177, path: 'pulseWatch/overview', marker: '.status-card', embedded: false },
  { label: 'DataScout', port: 5176, path: 'dataScout/dashboard', marker: '.suite-embedded', embedded: false },
];
try {
  await page.goto('http://localhost:5173/#/knowledgeHub/documents');
  for (const app of apps) {
    await page.evaluate(path => { location.hash = '#/' + path; }, app.path);
    const element = page.locator(`iframe[title="${app.label}"]`);
    await expect(element).toHaveAttribute('src', `http://localhost:${app.port}/`);
    await expect(element).toBeVisible({ timeout: 60000 });
    const child = page.frameLocator(`iframe[title="${app.label}"]`);
    if (app.embedded) await expect(child.locator('html')).toHaveAttribute('data-suite-embedded', 'true');
    if (app.label === 'AI Knowledge Hub') await expect(child.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
    else await expect(child.locator(app.marker)).toBeVisible();
    if (app.label === 'PulseWatch') await expect(child.getByText('Alle Basissysteme bereit', { exact: true })).toBeVisible();
    console.log(`PASS ${app.label}: local iframe and suite handshake, port ${app.port}`);
  }
  await expect(page.locator('iframe')).toHaveCount(4);
  const frames = page.frames();
  for (const app of apps) {
    await page.getByRole('button', { name: app.label, exact: true }).click();
    await expect(page.locator(`iframe[title="${app.label}"]`)).toBeVisible();
    expect(page.frames().filter(frame => frames.includes(frame))).toHaveLength(frames.length);
  }
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
  console.log('PASS all four app frames remain mounted; no page errors or external/Suite API requests. Real local fixture backends used.');
} finally { await browser.close(); }
