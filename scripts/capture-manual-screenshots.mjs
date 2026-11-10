// Capture the real production UIs with synthetic, intercepted APIs. No live requests.
import { createServer, request } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(path.resolve('../flowpilot-codex-starter/frontend/package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = 'https://forge-flow.de', output = 'docs/handbuecher/screenshots';
const selected = process.argv.find(value=>value.startsWith('--only='))?.slice(7).split(',');
await mkdir(output, { recursive: true });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stamp = '2026-11-06T10:00:00Z', day = new Date().toISOString().slice(0, 10);
function seed(name) {
    const source = fs.readFileSync(`frontend/src/data/${name}.ts`, 'utf8');
    const exports = {}; new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(exports);
    return exports;
}
const apps = ['projectManager','git','wiki','devTools','timeTracker','business','cloud','knowledgeHub','flowPilot','pulseWatch'];
const user = { id: 'manual-demo', name: 'Beispielkonto', email: 'demo@example.test', administrator: true, active: true, portalOnly: false };
const customers = seed('customers').customers.map((value, index) => ({ ...value, street: 'Beispielstraße 12', postalCode: '10115', city: 'Berlin', country: 'Deutschland', email: `kontakt${index + 1}@example.test`, website: '', phone: '+49 30 000000', industry: 'IT & Software',
    contacts: [{ id: index + 1, customerId: value.id, name: ['Alex Beispiel','Sam Beispiel','Kim Beispiel'][index], role: 'Projektleitung', email: `kontakt${index + 1}@example.test`, phone: '' }], notes: 'Synthetische Beispieldaten für die Dokumentation.' }));
const data = { projects: seed('projects').projects, customers, tasks: seed('tasks').tasks, activities: [],
    epics: [{ id: 1, projectId: 1, title: 'Kundenportal', description: 'Projektübersicht und Freigaben umsetzen.', createdAt: stamp, updatedAt: stamp }],
    sprints: [{ id: 1, projectId: 1, title: 'Sprint 1 - Grundlagen', goal: 'Navigation und Aufgabenansicht fertigstellen.', startDate: day, endDate: '2026-12-31', status: 'planned', taskIds: [1, 2], createdAt: stamp, updatedAt: stamp }],
    files: [{ id: 1, projectId: 1, name: 'Projektbriefing.pdf', size: 48200, mediaType: 'application/pdf', lastModified: Date.parse(stamp), addedAt: stamp, updatedAt: stamp }],
    wiki: { categories: [{ id: 1, name: 'Projektwissen', description: 'Abläufe, Entscheidungen und hilfreiche Anleitungen.', createdAt: stamp, updatedAt: stamp }],
        articles: [{ id: 1, title: 'Projektstart', content: '# Projektstart\n\nHier halten wir Ziele, Zuständigkeiten und Entscheidungen fest.\n\n## Nächste Schritte\n\n- Kunden abstimmen\n- Aufgaben planen\n- Ergebnisse dokumentieren', categoryId: 1, parentId: null, createdAt: stamp, updatedAt: stamp },
            { id: 2, title: 'Qualitätscheck', content: '# Qualitätscheck\n\n1. Anforderungen prüfen\n2. Ergebnis testen\n3. Freigabe dokumentieren', categoryId: 1, parentId: 1, createdAt: stamp, updatedAt: stamp }] } };
data.tasks[0].epicId = 1;
const time = { version: 1, revision: 'manual-time', entries: [0,1,2].map(n => ({ id: uuid(10+n), date: day, startMinute: 540 + n*100, minutes: 60, breakMinutes: 15, customerId: 1, projectId: 1, customerName: customers[0].name, projectName: data.projects[0].name, comment: ['Projektplanung','Umsetzung der Navigation','Qualitätsprüfung'][n], billable: true })) };
const business = { version: 1, revision: 'manual-business', profile: { company: 'Beispielstudio', address: 'Beispielstraße 12\n10115 Berlin', email: 'studio@example.test', taxId: 'BEISPIEL', bank: 'Beispiel-Bankverbindung', currency: 'EUR', taxBasisPoints: 1900, hourlyRateCents: 9500, paymentDays: 14 },
    budgets: [{ projectId: 1, minutes: 4800, hourlyRateCents: 9500 }], timer: null,
    templates: [{ id: uuid(20), name: 'Website-Projekt', description: 'Wiederverwendbarer Ablauf vom Briefing bis zur Abnahme.', tasks: [{ title: 'Briefing durchführen', description: '', priority: 'high' }], milestones: ['Abnahme'], pages: [{ title: 'Projektbriefing', content: '# Ziele\n\nAnforderungen festhalten.' }] }],
    documents: [{ id: uuid(21), kind: 'offer', customerId: 1, projectId: 1, title: 'Website-Konzeption', date: day, dueDate: '2026-12-31', status: 'draft', number: '', issuer: '', recipient: '', currency: 'EUR', lines: [{ description: 'Konzeption und Projektplanung', quantity: '1', unitPriceCents: 95000, taxBasisPoints: 1900, minutes: 0 }], timeEntryIds: [], notes: 'Beispieldokument, kein echtes Angebot.' }] };
const developer = { revision: 'manual-dev', integrationsConfigured: true, snippets: [{ id: uuid(31), title: 'API-Antwort prüfen', language: 'typescript', prompt: '', code: 'const response = await fetch("/api/v1/health");\nconst data = await response.json();\nconsole.log(data.status);', kind: 'snippet', updatedAt: stamp }], connections: [{ id: uuid(32), name: 'Demo-Lesedatenbank', host: '127.0.0.1', port: 5432, database: 'beispiel', username: 'readonly_demo', sslMode: 'require', hasPassword: true }], githubConnected: true, githubLogin: 'beispielkonto', clones: [] };
const hubDocument = { id: uuid(40), filename: 'Projektleitfaden.pdf', size_bytes: 48000, status: 'ready', error_message: null, page_count: 3, empty_page_count: 0, chunk_count: 8, embedding_status: 'ready', embedding_error: null, created_at: stamp };
const monitor = { id: uuid(50), version: 0, name: 'Beispiel-API', url: 'https://status.example.test/health', method: 'GET', intervalSeconds: 60, timeoutMs: 5000, expectedStatus: 200, enabled: true, createdAt: stamp, updatedAt: stamp };
const summary = { total: 60, eligible: 60, successful: 59, failed: 1, excluded: 0, httpResponses: 60, uptimePercent: 98.333333, p50Ms: 82, p95Ms: 146 };
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2', '.json':'application/json' };
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/knowledge-hub')) {
        const upstream = request({ hostname:'127.0.0.1', port:5301, path:req.url, method:req.method, headers:{...req.headers,host:'127.0.0.1:5301'} }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
        upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream); return;
    }
    const base = url.pathname.startsWith('/flowpilot/') ? ['../flowpilot-codex-starter/frontend/dist',11] : url.pathname.startsWith('/pulsewatch/') ? ['../pulse-watch/frontend/dist',12] : ['frontend/dist',1];
    const root = path.resolve(base[0]), file = path.resolve(root, decodeURIComponent(url.pathname.slice(base[1])) || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(400); res.end(); return; }
    try { const body = await readFile(file); res.writeHead(200, {'Content-Type':mime[path.extname(file)] ?? 'application/octet-stream'}); res.end(body); }
    catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(5521,'127.0.0.1',resolve));
const browser = await chromium.launch({ channel:'msedge', headless:true });
const context = await browser.newContext({ viewport:{width:1120,height:700}, locale:'de-DE', deviceScaleFactor:1.5 });
let portalMode = false;
const errors = [], missing = new Set(), manifest = [];
await context.addInitScript(() => { localStorage.setItem('forgeflow.language','de'); localStorage.setItem('knowledgeHub.language','de'); localStorage.setItem('flowpilot.language','de'); });
await context.route('**/*', async route => {
    const url = new URL(route.request().url()), p = url.pathname;
    if (url.origin !== origin) return route.abort();
    let body;
    if (p === '/api/v1/projects/1/files/1/content') return route.fulfill({status:200,contentType:'application/pdf',body:Buffer.alloc(48200)});
    if (p === '/api/v1/auth/session') body = { user: {...user,portalOnly:portalMode}, csrfToken:'manual-token' };
    else if (p === '/api/v1/me/settings') body = { version:1, settings:{themeMode:'light',defaultProjectView:'dashboard',defaultTaskPriority:'medium',language:'de'} };
    else if (p === '/api/v1/settings/global') body = { revision:'manual-global',industries:['IT & Software','Beratung & Dienstleistungen'],visibleApps:apps,aiApps:['projectManager'] };
    else if (p === '/api/v1/workspace') body = {version:1,revision:'manual-workspace',data};
    else if (p === '/api/v1/me/recent-activity') body = {entries:[]};
    else if (p === '/api/v1/me/time-tracking') body = time;
    else if (p === '/api/v1/me/business') body = business;
    else if (p === '/api/v1/me/rest-collections') body = {version:1,revision:'manual-rest',collections:[]};
    else if (p === '/api/v1/me/developer') body = developer;
    else if (p.includes('/me/developer/github/repositories')) body = {items:[{id:1,name:'beispielkonto/projektportal',privateRepo:true,description:'Synthetisches Beispielrepository',size:640,url:'https://github.com/example/projektportal'}],page:1,hasMore:false};
    else if (p === '/api/v1/users') body = [user];
    else if (p === '/api/v1/me/business/portal-accounts') body = [];
    else if (p === '/api/v1/portal/home') body = {customerName:customers[0].name,projects:[{id:1,name:'Website Relaunch',deadline:'2026-12-31',tasks:12,done:7}],articles:[data.wiki.articles[0]],files:[data.files[0]],documents:[],reportMonths:['2026-11']};
    else if (p === '/knowledge-hub-api/health') body = {status:'ok',mode:'authenticated'};
    else if (p === '/knowledge-hub-api/api/auth/session') body = {mode:'authenticated',auth_source:'suite',user:{id:uuid(40),email:user.email,external_ai_consent:false},csrf_token:'manual-token',registration_enabled:false};
    else if (p === '/knowledge-hub-api/api/documents') body = {mode:'authenticated',provider:'fake',max_upload_bytes:10485760,documents:[hubDocument]};
    else if (p === '/knowledge-hub-api/api/chat') body = {answer:'Laut Projektleitfaden werden Anforderungen zuerst im Briefing festgehalten und anschließend als Aufgaben geplant.',sources_found:true,citations:[{document_id:hubDocument.id,filename:hubDocument.filename,page:2,excerpt:'Vor der Umsetzung werden Ziele, Zuständigkeiten und Abnahmekriterien im Briefing abgestimmt.'}],provider:'fake',demo:true};
    else if (p === '/flowpilot-api/api/v1/health') body = {status:'ok',service:'flowpilot-api',version:'0.1.0',mode:'infrastructure'};
    else if (p === '/flowpilot-api/api/v1/ready') body = {status:'ready',mode:'infrastructure',dependencies:{postgresql:'ok',redis:'ok'}};
    else if (p === '/flowpilot-api/api/v1/jobs/status') body = {enabled:true,broker_ready:true,storage:'postgresql',global_concurrency:2,workflow_concurrency:1};
    else if (p.startsWith('/flowpilot-api/api/v1/workflows')) body = {items:[],total:0,limit:12,offset:0,storage:'postgresql'};
    else if (p.startsWith('/flowpilot-api/')) body = {items:[],total:0,limit:20,offset:0,storage:'postgresql'};
    else if (p === '/pulsewatch-api/api/v1/health') body = {status:'UP',database:'UP',service:'pulsewatch',mode:'postgres'};
    else if (p === '/pulsewatch-api/api/v1/auth/session') body = {user:{id:uuid(50),username:'Beispielkonto'},csrfToken:'manual-token',demo:false,suite:true};
    else if (p.startsWith('/pulsewatch-api/api/v1/monitors/dashboard')) {
        const range=url.searchParams.get('range') ?? '24h'; const seconds=range==='1h'?60:range==='7d'?3600:900;
        body={window:{range,from:'2026-11-05T10:00:00Z',to:stamp,bucketSeconds:seconds,buckets:86400/seconds},source:url.searchParams.get('source')==='FIXTURE'?'FIXTURE':'HTTP',overview:{UP:1,DOWN:0,BLOCKED:0,UNKNOWN:0,STALE:0,DISABLED:0},items:[{monitor,status:'UP',lastCheck:{finishedAt:stamp,outcome:'UP',responseStatus:200,latencyMs:82,configurationVersion:0},summary}],page:0,size:20,total:1};
    } else if (p.startsWith('/pulsewatch-api/api/v1/monitors')) body = {items:[monitor],page:0,size:20,total:1};
    if (body !== undefined) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if (/^\/(api\/v1|knowledge-hub-api|flowpilot-api|pulsewatch-api)\//.test(p)) { missing.add(p); return route.fulfill({status:404,contentType:'application/json',body:'{"error":{"code":"MANUAL_FIXTURE","message":"Beispielansicht: keine echte Serveraktion."}}'}); }
    const response = await route.fetch({url:'http://127.0.0.1:5521'+p+url.search,maxRedirects:0}); return route.fulfill({response});
});
const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
async function capture(key, route, action) {
    if (selected && !selected.includes(key)) return;
    await page.goto(origin+'/?manual='+encodeURIComponent(key)+'#'+route);
    await expect(page.getByRole('heading',{name:'Einstellungen',exact:true}).or(page.locator('aside')).first()).toBeAttached({timeout:15000});
    await page.waitForTimeout(650);
    if (action) await action(page);
    if (route.includes('?project=1')) await page.locator('main').evaluate(el=>{el.scrollTop=380;});
    await page.waitForTimeout(250);
    await page.screenshot({path:`${output}/${key}.png`});
    manifest.push({key,route,file:`${key}.png`,capturedAt:new Date().toISOString(),synthetic:true});
    console.log('Captured',key);
}
try {
    await capture('projekt-dashboard','/projectManager/dashboard');
    await capture('projekt-kunden','/projectManager/customers?customer=1');
    await capture('projekt-aufgaben','/projectManager/projects?project=1',p=>p.getByRole('button',{name:'Aufgaben',exact:true}).click());
    await capture('projekt-board','/projectManager/projects?project=1',p=>p.getByRole('button',{name:'Aufgabenboard',exact:true}).click());
    await capture('projekt-sprints','/projectManager/projects?project=1',p=>p.getByRole('button',{name:'Sprints',exact:true}).click());
    await capture('wiki-uebersicht','/wiki/home');
    await capture('wiki-seiten','/wiki/articles');
    for (const [key,route] of [['tools-json','json'],['tools-rest','rest'],['tools-rechner','calculator'],['tools-konverter','converter'],['tools-snippeter','snippeter'],['tools-dbscripter','dbScripter']]) await capture(key,`/devTools/${route}`);
    await capture('zeit-kalender','/timeTracker/calendar');
    await capture('zeit-auswertung','/timeTracker/reports');
    for (const [key,route] of [['business-budgets','budgets'],['business-dokumente','documents'],['business-vorlagen','templates'],['business-portal','portal'],['business-profil','profile']]) await capture(key,`/business/${route}`);
    await capture('git-repositories','/git/repositories',async p=>{await p.getByRole('button',{name:'Repositories laden',exact:true}).click(); await expect(p.getByText('beispielkonto/projektportal',{exact:true})).toBeVisible();});
    await capture('cloud-start','/cloud/files');
    for (const [key,category] of [['einstellungen-optik','appearance'],['einstellungen-apps','apps'],['einstellungen-ki','ai'],['einstellungen-sprache','language']]) await capture(key,`/settings/general?category=${category}`);
    await capture('hub-dokumente','/knowledgeHub/documents',async()=>{await expect(page.frameLocator('iframe[title="AI Knowledge Hub"]').getByText('Projektleitfaden.pdf',{exact:true})).toBeVisible({timeout:30000});});
    await capture('hub-chat','/knowledgeHub/chat',async()=>{const f=page.frameLocator('iframe[title="AI Knowledge Hub"]'); await expect(f.locator('#question')).toBeVisible({timeout:30000}); await f.locator('#question').fill('Wie werden Anforderungen im Projektleitfaden geplant?'); await f.locator('button[type="submit"]').click(); await expect(f.getByText('Laut Projektleitfaden werden Anforderungen zuerst im Briefing festgehalten und anschließend als Aufgaben geplant.',{exact:true})).toBeVisible(); await f.locator('body').evaluate(()=>window.scrollTo(0,500));});
    await capture('flow-uebersicht','/flowPilot/overview',async()=>{await expect(page.frameLocator('iframe[title="FlowPilot"]').locator('body')).toContainText('FlowPilot',{timeout:30000});});
    await capture('flow-editor','/flowPilot/workflows',async()=>{const f=page.frameLocator('iframe[title="FlowPilot"]'); await f.getByRole('button',{name:/Neuer Arbeitsablauf|New workflow/}).click({timeout:30000});});
    await capture('flow-jobs','/flowPilot/jobs',async()=>{const f=page.frameLocator('iframe[title="FlowPilot"]'); await expect(f.getByText(/Aufträge konnten nicht geladen/)).toHaveCount(0); await expect(f.locator('body')).toBeVisible(); await page.waitForTimeout(400);});
    await capture('pulse-dashboard','/pulseWatch/overview',async()=>{const f=page.frameLocator('iframe[title="PulseWatch"]'); await expect(f.getByText('Beispiel-API',{exact:true}).first()).toBeVisible({timeout:30000}); await f.locator('body').evaluate(()=>window.scrollTo(0,480));});
    await capture('pulse-metriken','/pulseWatch/overview',async()=>{const f=page.frameLocator('iframe[title="PulseWatch"]'); await expect(f.getByText('Beispiel-API',{exact:true}).first()).toBeVisible({timeout:30000}); await f.locator('body').evaluate(()=>window.scrollTo(0,850));});
    if (!selected || selected.includes('portal-kundensicht')) {
        portalMode=true;
        await page.goto(origin+'/'); await page.waitForTimeout(900); await expect(page.getByText('Freigegebene Projekte',{exact:true})).toBeVisible();
        await page.screenshot({path:`${output}/portal-kundensicht.png`}); manifest.push({key:'portal-kundensicht',file:'portal-kundensicht.png',route:'portalOnly',synthetic:true});
    }
} finally {
    let screens = manifest;
    if (selected) { const previous=JSON.parse(await readFile('docs/handbuecher/screenshots/manifest.json','utf8')); screens=[...new Map([...previous.screenshots,...manifest].map(value=>[value.key,value])).values()]; }
    await writeFile('docs/handbuecher/screenshots/manifest.json',JSON.stringify({capturedAt:new Date().toISOString(),source:'Actual local production UI; all APIs synthetic; no live traffic',screenshots:screens,errors,missingApiFixtures:[...missing]},null,2));
    await browser.close(); await new Promise(resolve=>server.close(resolve));
}
if(errors.length) throw new Error(errors.join('\n'));
console.log(`Captured ${manifest.length} synthetic-data screenshots.`);
