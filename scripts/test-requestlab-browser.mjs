import { createRequire } from 'node:module';
const require = createRequire(new URL('../../flowpilot-codex-starter/frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
const page = await context.newPage();
let sent = 0;
const errors = [];
const blocked = [];
page.on('pageerror', error => errors.push(error.message));
let collections = { version: 1, revision: 'fixture-rest', collections: [] };
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === 'https://requestlab.example.test') {
    if (request.method() !== 'OPTIONS') sent++;
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body: '{"synthetic":"requestlab-success"}' });
  }
  if (url.origin !== 'http://localhost:5173') { blocked.push(url.origin); return route.abort(); }
  if (url.pathname.startsWith('/api/')) {
    const responses = {
      '/api/v1/auth/session': { user: { id: 'synthetic-requestlab-user', name: 'Synthetic test', email: 'fixture@example.test', administrator: true }, csrfToken: 'synthetic-token' },
      '/api/v1/me/settings': { version: 1, settings: { themeMode: 'dark', language: 'en', defaultProjectView: 'dashboard', defaultTaskPriority: 'medium' } },
      '/api/v1/settings/global': { revision: 'fixture-global', industries: ['IT'], visibleApps: ['devTools', 'requestLab'], aiApps: [] },
      '/api/v1/workspace': { version: 1, revision: 'fixture-workspace', data: { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } } },
    };
    if (url.pathname.endsWith('/me/rest-collections')) {
      if (request.method() === 'PUT') collections = { ...request.postDataJSON(), revision: 'fixture-saved' };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(collections) });
    }
    return route.fulfill({ status: responses[url.pathname] ? 200 : 404, contentType: 'application/json', body: JSON.stringify(responses[url.pathname] ?? {}) });
  }
  return route.continue();
});
try {
  await page.goto('http://localhost:5173/#/devTools/json');
  await expect(page.getByRole('link', { name: 'REST client', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'RequestLab', exact: true }).click();
  await expect(page).toHaveURL(/#\/requestLab\/client$/);
  await expect(page.getByRole('heading', { name: 'RequestLab', exact: true })).toBeVisible();
  const address = page.getByRole('textbox', { name: 'URL', exact: true });
  await address.fill('https://requestlab.example.test/echo');
  expect(sent).toBe(0);
  await page.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Response body', exact: true })).toHaveValue(/requestlab-success/);
  expect(sent).toBe(1);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input').nth(0).fill('Synthetic request');
  await dialog.locator('input').nth(1).fill('Synthetic collection');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await address.fill('https://requestlab.example.test/unsaved-draft');
  await page.getByRole('button', { name: 'Dev Tools', exact: true }).click();
  await expect(page.getByRole('link', { name: 'REST client', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'RequestLab', exact: true }).click();
  await expect(address).toHaveValue('https://requestlab.example.test/unsaved-draft');
  await expect(page.getByRole('textbox', { name: 'Response body', exact: true })).toHaveValue(/requestlab-success/);
  await page.evaluate(() => { location.hash = '#/devTools/rest?from=legacy'; });
  await expect(page).toHaveURL(/#\/requestLab\/client\?from=legacy$/);
  await expect(address).toHaveValue('https://requestlab.example.test/unsaved-draft');
  expect(sent).toBe(1);
  await page.screenshot({ path: 'node_modules/.tmp/requestlab-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(address).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'node_modules/.tmp/requestlab-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
  console.log('PASS RequestLab sidebar app, manual fixture HTTP request, save, retained draft/response, legacy redirect, no automatic resend and mobile width. All APIs synthetic.');
} finally { await browser.close(); }
