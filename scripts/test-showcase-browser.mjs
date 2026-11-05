import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.resolve('../flowpilot-codex-starter/frontend/package.json'));
const { chromium, expect } = require('@playwright/test');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on('pageerror', error => failures.push(error.message));
const emptyWorkspace = { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } };
await page.route('http://localhost:5173/api/v1/**', route => {
  const endpoint = new URL(route.request().url()).pathname.replace('/api/v1', '');
  const responses = {
    '/auth/session': { user: { id: 'suite-browser-fixture', name: 'Synthetic Suite Test', email: 'suite@example.test', administrator: false }, csrfToken: 'synthetic-browser-token' },
    '/me/settings': { version: 1, settings: { themeMode: 'dark', defaultProjectView: 'dashboard', defaultTaskPriority: 'medium', language: 'en' } },
    '/workspace': { version: 1, revision: 'synthetic', data: emptyWorkspace },
  };
  return route.fulfill({ status: responses[endpoint] ? 200 : 404, contentType: 'application/json', body: JSON.stringify(responses[endpoint] ?? { error: { code: 'NOT_CONFIGURED', message: 'Synthetic suite browser fixture' } }) });
});
try {
  await page.goto('http://localhost:5173/#/knowledgeHub/documents');
  const hub = page.frameLocator('iframe[title="AI Knowledge Hub"]');
  await expect(hub.locator('html')).toHaveAttribute('data-suite-embedded', 'true', { timeout: 60000 });
  await expect(hub.locator('.sidebar')).toBeHidden();
  await expect(hub.locator('.topbar')).toBeHidden();
  await expect(hub.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
  await expect(hub.getByText('Local demo only.', { exact: true })).toHaveCount(0);
  await expect(hub.locator('.notice')).toHaveCount(0);
  await page.getByRole('link', { name: 'Chat', exact: true }).click();
  await expect.poll(() => page.frames().find(frame => frame.url().includes(':3000'))?.url()).toBe('http://localhost:3000/');
  await page.getByRole('button', { name: 'FlowPilot', exact: true }).click();
  const flow = page.frameLocator('iframe[title="FlowPilot"]');
  await expect(flow.locator('html')).toHaveAttribute('data-suite-embedded', 'true', { timeout: 30000 });
  await expect(flow.locator('.sidebar')).toBeHidden();
  await expect(flow.getByText(/MILESTONE/i)).toHaveCount(0);
  await expect(flow.getByText('Simulated', { exact: true })).toHaveCount(2);
  await page.getByRole('link', { name: 'Workflows', exact: true }).click();
  await expect(flow.locator('.workflow-list')).toBeVisible();
  await expect.poll(() => page.frames().find(frame => frame.url().includes(':5174'))?.url()).toContain('#/workflows');
  await page.screenshot({ path: 'node_modules/.tmp/suite-flowpilot-integrated.png', fullPage: true });
  await flow.getByRole('button', { name: 'Use demo workflow →', exact: true }).click();
  await flow.getByLabel('Workflow name', { exact: true }).fill('Unsaved synthetic suite draft');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: 'Runs', exact: true }).click();
  await expect(page).toHaveURL(/#\/flowPilot\/workflows$/);
  await expect(flow.getByLabel('Workflow name', { exact: true })).toHaveValue('Unsaved synthetic suite draft');
  await page.getByRole('button', { name: 'AI Knowledge Hub', exact: true }).click();
  await expect(hub.locator('html')).toHaveAttribute('data-suite-embedded', 'true');
  await page.getByRole('link', { name: 'Documents', exact: true }).click();
  await expect(hub.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
  await page.screenshot({ path: 'node_modules/.tmp/suite-knowledge-integrated.png', fullPage: true });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'FlowPilot', exact: true }).click();
  await expect(page).toHaveURL(/#\/flowPilot\/workflows$/);
  await expect(flow.getByLabel('Workflow name', { exact: true })).toHaveValue('Unsaved synthetic suite draft');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'AI Knowledge Hub', exact: true }).click();
  await expect(page).toHaveURL(/#\/knowledgeHub\/chat$/);
  await expect(page.locator('iframe[title="AI Knowledge Hub"]')).toBeVisible();
  await expect.poll(() => page.frames().find(frame => frame.url().includes(':3000'))?.url()).toBe('http://localhost:3000/');
  await page.screenshot({ path: 'node_modules/.tmp/suite-knowledge-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Suite shell overflows mobile viewport');
  for (const url of ['http://localhost:3000', 'http://localhost:5174']) {
    const standalone = await browser.newPage();
    await standalone.goto(url);
    await expect(standalone.locator('.sidebar')).toBeVisible();
    await expect(standalone.getByText('Local demo only.', { exact: true })).toHaveCount(0);
    await expect(standalone.getByText(/MILESTONE/i)).toHaveCount(0);
    await expect(standalone.locator('html')).not.toHaveAttribute('data-suite-embedded', 'true');
    await standalone.close();
  }
  if (failures.length) throw new Error('Browser errors: ' + failures.join('; '));
  console.log('PASS: real child apps load within suite, use suite tabs, hide duplicate navigation, retain frames, and keep standalone navigation. ForgeFlow account APIs were mocked; child APIs were real fake/mock backends.');
} finally { await browser.close(); }
