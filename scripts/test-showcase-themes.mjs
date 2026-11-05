import { createServer, request } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('../flowpilot-codex-starter/frontend/package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = 'https://forge-flow.de';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/flowpilot') { res.writeHead(308, { Location: '/flowpilot/' }); res.end(); return; }
    if (url.pathname.startsWith('/knowledge-hub')) {
        const upstream = request({ hostname: '127.0.0.1', port: 5300, path: req.url,
            headers: { ...req.headers, host: '127.0.0.1:5300' } }, response => {
            res.writeHead(response.statusCode, response.headers); response.pipe(res);
        });
        upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream); return;
    }
    const flow = url.pathname.startsWith('/flowpilot/');
    const root = path.resolve(flow ? '../flowpilot-codex-starter/frontend/dist' : 'frontend/dist');
    const file = path.resolve(root, decodeURIComponent(flow ? url.pathname.slice(11) : url.pathname.slice(1)) || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(400); res.end(); return; }
    try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(5513, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--host-resolver-rules=MAP forge-flow.de 127.0.0.1'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
let settings = { themeMode: 'dune', defaultProjectView: 'dashboard', defaultTaskPriority: 'medium', language: 'en' };
const user = { id: 'theme-fixture', name: 'Theme Test', email: 'theme@example.test', administrator: true, external_ai_consent: true };
await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    let body;
    const p = url.pathname;
    if (p === '/api/v1/auth/session') body = { user, csrfToken: 'synthetic-token' };
    else if (p === '/api/v1/me/settings') {
        if (route.request().method() === 'PUT') { settings = route.request().postDataJSON().settings; return route.fulfill({ status: 204 }); }
        body = { version: 1, settings };
    } else if (p === '/api/v1/workspace') body = { version: 1, revision: 'synthetic', data: { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } } };
    else if (p === '/knowledge-hub-api/api/auth/session') body = { mode: 'authenticated', auth_source: 'suite', user, csrf_token: 'synthetic-token', registration_enabled: false };
    else if (p === '/knowledge-hub-api/api/documents') body = { mode: 'authenticated', provider: 'openai', max_upload_bytes: 10485760, documents: [] };
    else if (p === '/knowledge-hub-api/health') body = { status: 'ok', mode: 'authenticated' };
    else if (p === '/flowpilot-api/api/v1/workflows') body = { items: [], total: 0, limit: 12, offset: 0, storage: 'postgresql' };
    else if (p === '/flowpilot-api/api/v1/health') body = { status: 'ok', service: 'flowpilot-api', version: '0.1.0', mode: 'infrastructure' };
    else if (p === '/flowpilot-api/api/v1/ready') body = { status: 'ready', mode: 'infrastructure', dependencies: { postgresql: 'ok', redis: 'ok' } };
    if (body) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (/^\/(api\/v1|knowledge-hub-api|flowpilot-api)\//.test(p)) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"FIXTURE","message":"Synthetic fixture"}}' });
    const response = await route.fetch({ url: 'http://127.0.0.1:5513' + (p === '/flowpilot' ? '/flowpilot/' : p) + url.search, maxRedirects: 0 });
    return route.fulfill({ response });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const navigate = async hash => { await page.evaluate(value => { location.hash = value; }, hash); };
try {
    await page.goto(origin + '/#/knowledgeHub/chat');
    const hub = page.frameLocator('iframe[title="AI Knowledge Hub"]');
    await expect(hub.locator('html')).toHaveAttribute('data-suite-theme', 'light');
    await hub.locator('#question').fill('Unsent question retained across themes');
    await navigate('/flowPilot/overview');
    const flow = page.frameLocator('iframe[title="FlowPilot"]');
    await expect(flow.locator('html')).toHaveAttribute('data-suite-theme', 'light');
    const originalFrames = page.frames().slice(1);
    await mkdir('node_modules/.tmp/theme-screenshots', { recursive: true });
    for (const theme of ['light', 'dark', 'aurora', 'dune', 'forest', 'ink', 'rose']) {
        await navigate('/projectManager/settings?category=appearance');
        await page.locator(`input[name="theme-mode"][value="${theme}"]`).check();
        const palette = { light: '#f7f8fa', dark: '#191e25', aurora: '#14272e', dune: '#f6f0e7', forest: '#f3f7f1', ink: '#201c2d', rose: '#fbf3f4' }[theme];
        await expect.poll(() => hub.locator('html').evaluate(el => el.style.getPropertyValue('--suite-content'))).toBe(palette);
        await expect.poll(() => flow.locator('html').evaluate(el => el.style.getPropertyValue('--suite-content'))).toBe(palette);
        for (const [name, hash, frame] of [['hub', '/knowledgeHub/chat', hub], ['flow', '/flowPilot/overview', flow]]) {
            await navigate(hash);
            await expect(frame.locator('body')).toBeVisible();
            if (name === 'hub') {
                await expect(hub.locator('#question')).toHaveValue('Unsent question retained across themes');
                const muted = await hub.locator('.page-heading .muted').evaluate(el => getComputedStyle(el).color);
                const expectedMuted = await hub.locator('html').evaluate(el => { const probe = document.createElement('i'); probe.style.color = el.style.getPropertyValue('--suite-textSecondary'); document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; });
                expect(muted).toBe(expectedMuted);
            }
            const color = await frame.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
            const expectedColor = await page.evaluate(hex => { const el = document.createElement('i'); el.style.color = hex; document.body.append(el); const value = getComputedStyle(el).color; el.remove(); return value; }, palette);
            expect(color).toBe(expectedColor);
            await page.screenshot({ path: `node_modules/.tmp/theme-screenshots/${theme}-${name}.png` });
        }
    }
    expect(page.frames().slice(1)).toEqual(originalFrames);
    expect(errors).toEqual([]);
    console.log('PASS: seven palettes, both real app frontends, live theme changes, retained frames, 14 screenshots. APIs synthetic; no provider calls.');
} finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
}
