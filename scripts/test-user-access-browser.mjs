import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../flowpilot-codex-starter/frontend/package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const server = await createServer({ configFile: false, root: fileURLToPath(new URL('../frontend', import.meta.url)), envDir: false, plugins: [react()], define: { 'import.meta.env.VITE_DATA_MODE': JSON.stringify('api'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') }, server: { host: 'localhost', port: 5514, strictPort: true } });
await server.listen();
const origin = 'http://localhost:5514';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const allApps = ['projectManager','git','wiki','devTools','timeTracker','business','cloud','knowledgeHub','flowPilot','pulseWatch','dataScout','requestLab'];
const workspace = { version: 1, revision: 'fixture-workspace', data: { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } } };
const account = { id: 'synthetic-user', username: 'fixture.user', email: 'fixture@example.test', name: 'Synthetic user', administrator: false, active: true, allowedApps: ['requestLab'], sessionVersion: 3 };
const errors = [];
async function fixture(user, signedIn = true) {
    const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 1440, height: 1050 } });
    const page = await context.newPage(); const calls = []; const writes = [];
    page.on('pageerror', error => errors.push(error.message));
    let existing = { ...account }; let authenticated = signedIn; let rejectAccess = true;
    await context.route('**/*', async route => {
        const request = route.request(); const url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        calls.push(url.pathname);
        if (request.method() !== 'GET') writes.push({ path: url.pathname, data: request.postDataJSON(), csrf: request.headers()['x-csrf-token'] });
        let body; let status = 200;
        if (url.pathname.endsWith('/auth/csrf')) body = { csrfToken: 'synthetic-token' };
        else if (url.pathname.endsWith('/auth/login')) { authenticated = true; body = { user, csrfToken: 'synthetic-token' }; }
        else if (url.pathname.endsWith('/auth/session')) { body = authenticated ? { user, csrfToken: 'synthetic-token' } : { error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } }; status = authenticated ? 200 : 401; }
        else if (url.pathname.endsWith('/me/settings')) body = { version: 1, settings: { themeMode: 'dark', language: 'en', defaultProjectView: 'dashboard', defaultTaskPriority: 'medium' } };
        else if (url.pathname.endsWith('/settings/global')) body = { revision: 'global-fixture', industries: ['IT'], visibleApps: allApps, aiApps: [] };
        else if (url.pathname.endsWith('/workspace')) body = workspace;
        else if (url.pathname.endsWith('/me/rest-collections')) body = { version: 1, revision: 'rest-fixture', collections: [] };
        else if (url.pathname.endsWith('/users/synthetic-user/access')) {
            if (rejectAccess) { rejectAccess = false; status = 409; body = { error: { code: 'USERNAME_IN_USE', message: 'Synthetic username conflict' } }; }
            else { existing = { ...existing, ...request.postDataJSON(), sessionVersion: 4 }; body = existing; }
        } else if (url.pathname.endsWith('/users')) {
            if (request.method() === 'POST') { body = { ...account, ...request.postDataJSON(), id: 'created-fixture', sessionVersion: 0 }; status = 201; }
            else body = [existing];
        } else { status = 404; body = { error: { message: 'Unconfigured fixture route' } }; }
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    return { context, page, calls, writes };
}
try {
    const admin = await fixture({ ...account, id: 'synthetic-admin', name: 'Administrator', username: 'administrator', administrator: true, allowedApps: allApps });
    await admin.page.goto(origin + '/#/settings/general?category=users');
    await expect(admin.page.getByRole('heading', { name: 'Create user', exact: true })).toBeVisible();
    await admin.page.getByRole('button', { name: 'Edit app permissions', exact: true }).click();
    const dialog = admin.page.getByRole('dialog');
    await dialog.getByLabel('Username', { exact: true }).fill('renamed.user');
    await dialog.getByRole('checkbox', { name: 'RequestLab', exact: true }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Dev Tools', exact: true }).check();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Synthetic username conflict');
    await expect(dialog.getByLabel('Username', { exact: true })).toHaveValue('renamed.user');
    await expect(dialog.getByRole('checkbox', { name: 'Dev Tools', exact: true })).toBeChecked();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    const rights = admin.writes.filter(call => call.path.endsWith('/access'));
    expect(rights.length).toBe(2); expect(rights[1].data).toEqual({ username: 'renamed.user', allowedApps: ['devTools'], sessionVersion: 3 }); expect(rights[1].csrf).toBe('synthetic-token');
    const form = admin.page.getByRole('form', { name: 'Create user', exact: true });
    const fields = form.locator('input:not([type="checkbox"])');
    for (const [index, value] of ['Synthetic new user', 'new.user', 'new@example.test', 'Synthetic-Password-12345', 'Synthetic-Password-12345'].entries()) await fields.nth(index).fill(value);
    await form.getByRole('button', { name: 'Create user', exact: true }).click();
    await expect(fields.nth(1)).toHaveValue('');
    expect(admin.writes.find(call => call.path.endsWith('/users')).data.username).toBe('new.user');
    await admin.page.screenshot({ path: 'node_modules/.tmp/user-access-admin.png', fullPage: true });
    await admin.context.close();

    const limited = await fixture(account);
    await limited.page.goto(origin + '/#/requestLab/client');
    await expect(limited.page.getByRole('heading', { name: 'RequestLab', exact: true })).toBeVisible();
    for (const label of ['Project Manager','Business','Cloud','Dev Tools','FlowPilot','DataScout']) await expect(limited.page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    await limited.page.evaluate(() => { location.hash = '#/business/budgets'; });
    await expect(limited.page).toHaveURL(/#\/requestLab\/client$/);
    expect(limited.calls.some(path => /me\/(business|time-tracking|developer)/.test(path))).toBe(false);
    await limited.page.setViewportSize({ width: 390, height: 844 });
    await limited.page.screenshot({ path: 'node_modules/.tmp/user-access-mobile.png', fullPage: true });
    expect(await limited.page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await limited.context.close();

    const empty = await fixture({ ...account, allowedApps: [] });
    await empty.page.goto(origin + '/#/projectManager/dashboard');
    await expect(empty.page).toHaveURL(/#\/settings\/general$/);
    expect(empty.calls.some(path => path.endsWith('/me/rest-collections'))).toBe(false);
    await empty.context.close();

    const login = await fixture(account, false);
    await login.page.goto(origin);
    const identifier = login.page.getByLabel('Username or email', { exact: true });
    await expect(identifier).toHaveAttribute('type', 'text');
    await expect(login.page.getByRole('button', { name: /trial|register|sign up/i })).toHaveCount(0);
    await identifier.fill('fixture.user');
    await login.page.getByLabel('Password', { exact: true }).fill('Synthetic-Password-12345');
    await login.page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(login.page.getByRole('heading', { name: 'RequestLab', exact: true })).toBeVisible();
    expect(login.writes.find(call => call.path.endsWith('/auth/login')).data.email).toBe('fixture.user');
    await login.context.close();
    expect(errors).toEqual([]);
    console.log('PASS administrator create/edit, conflict recovery, explicit app grants/version/CSRF, restricted app navigation/no background API calls, empty grants/settings, username login and mobile width. Synthetic APIs only.');
} finally { await browser.close(); await server.close(); }
