import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(path.resolve('../flowpilot-codex-starter/frontend/package.json'));
const { chromium, expect } = require('@playwright/test');
const suiteUrl = new URL(process.env.TEST_SUITE_URL ?? 'http://localhost:5173').origin;
const hubUrl = new URL(process.env.TEST_HUB_URL ?? 'http://localhost:3000').origin;
const flowUrl = new URL(process.env.TEST_FLOW_URL ?? 'http://localhost:5174').origin;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-GB' });
const errors=[];const calls=[];
await context.addInitScript(({suiteUrl,hubUrl}) => {
    const key=location.origin===suiteUrl?'forgeflow.language':location.origin===hubUrl?'knowledgeHub.language':'flowpilot.language';
    if (!localStorage.getItem(key)) localStorage.setItem(key,'en');
}, {suiteUrl,hubUrl});
await context.route('**/*', route => {
    const url=new URL(route.request().url());let body;
    if(url.origin===suiteUrl && url.pathname.startsWith('/api/v1/')){
        const endpoint=url.pathname.slice('/api/v1'.length);
        const responses={
            '/auth/session':{user:{id:'language-test',name:'Synthetic Language Test',email:'language@example.test',administrator:false},csrfToken:'synthetic-language-token'},
            '/me/settings':{version:1,settings:{themeMode:'dark',defaultProjectView:'dashboard',defaultTaskPriority:'medium',language:'en'}},
            '/workspace':{version:1,revision:'synthetic-language',data:{projects:[],customers:[],tasks:[],activities:[],epics:[],sprints:[],files:[],wiki:{articles:[],categories:[]}}}
        };
        return route.fulfill({status:responses[endpoint]?200:404,contentType:'application/json',body:JSON.stringify(responses[endpoint]??{error:{code:'TEST_FIXTURE',message:'Synthetic fixture'}})});
    }
    if(url.pathname.endsWith('/api/auth/session'))body={mode:'local-demo',user:null,csrf_token:null,registration_enabled:false};
    else if(url.pathname.endsWith('/api/documents'))body={mode:'local-demo',provider:'fake',max_upload_bytes:10485760,documents:[{id:'10000000-0000-4000-8000-000000000001',filename:'Save workflow.pdf',size_bytes:2048,status:'ready',error_message:null,page_count:1,empty_page_count:0,chunk_count:1,embedding_status:'ready',embedding_error:null,created_at:'2026-11-04T10:00:00Z'}]};
    else if(url.pathname.endsWith('/api/v1/workflows'))body={items:[],total:0,limit:12,offset:0,storage:'demo_file'};
    else if(url.pathname.endsWith('/api/v1/health'))body={status:'ok',service:'flowpilot-api',version:'0.1.0',mode:'demo'};
    else if(url.pathname.endsWith('/api/v1/ready'))body={status:'ready',mode:'demo',dependencies:{postgresql:'mocked',redis:'mocked'}};
    else if(url.pathname.endsWith('/health'))body={status:'ok',mode:'local-demo'};
    if(body){calls.push(url.pathname);return route.fulfill({status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':route.request().headers().origin??hubUrl,'Access-Control-Allow-Credentials':'true'},body:JSON.stringify(body)});}
    return route.continue();
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const setSuiteLanguage=async language=>{
    await page.getByRole('link',{name:language==='de'?'Global settings':'Globale Einstellungen',exact:true}).click();
    await page.getByRole('link',{name:language==='de'?'Language':'Sprache',exact:true}).click();
    await page.locator('select').filter({has:page.locator('option[value="de"]')}).selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang',language);
};
try{
    await page.goto(suiteUrl+'/#/flowPilot/workflows');
    const flow=page.frameLocator('iframe[title="FlowPilot"]');
    await expect(flow.getByRole('button',{name:'+ New workflow',exact:true})).toBeVisible({timeout:60000});
    await flow.getByRole('button',{name:'+ New workflow',exact:true}).click();
    await flow.getByLabel('Workflow name',{exact:true}).fill('Save workflow — eigener Entwurf');
    const flowFrame=page.frames().find(f=>f.url().startsWith(flowUrl));
    const flowToken=await flowFrame.evaluate(()=>{window.__languageTestToken=crypto.randomUUID();return window.__languageTestToken;});
    await page.getByRole('button',{name:'AI Knowledge Hub',exact:true}).click();
    const hub=page.frameLocator('iframe[title="AI Knowledge Hub"]');
    await expect(hub.getByLabel('Your question',{exact:true})).toBeVisible({timeout:60000});
    await hub.getByLabel('Your question',{exact:true}).fill('Documents bleiben als eigene Frage unverändert');
    const hubFrame=page.frames().find(f=>f.url().startsWith(hubUrl));
    const hubToken=await hubFrame.evaluate(()=>{window.__languageTestToken=crypto.randomUUID();return window.__languageTestToken;});
    const before=calls.length;
    await setSuiteLanguage('de');
    await expect(page.getByRole('button',{name:'Projektverwaltung',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Entwicklerwerkzeuge',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Zeiterfassung',exact:true})).toBeVisible();
    await expect(flow.locator('html')).toHaveAttribute('lang','de');
    await expect(hub.locator('html')).toHaveAttribute('lang','de');
    if(calls.length!==before)throw new Error('Language change repeated an API request');
    if(await hubFrame.evaluate(()=>window.__languageTestToken)!==hubToken||await flowFrame.evaluate(()=>window.__languageTestToken)!==flowToken)throw new Error('Language change reloaded a frame');
    await page.getByRole('button',{name:'AI Knowledge Hub',exact:true}).click();
    await expect(hub.getByLabel('Deine Frage',{exact:true})).toHaveValue('Documents bleiben als eigene Frage unverändert');
    await page.getByRole('link',{name:'Dokumente',exact:true}).click();
    await expect(hub.getByRole('heading',{name:'Dokumentenbibliothek',exact:true})).toBeVisible();
    await expect(hub.getByText('Suchindex: Bereit', { exact: true })).toBeVisible();
    await expect(hub.getByText('Save workflow.pdf',{exact:true})).toBeVisible();
    await page.screenshot({path:'node_modules/.tmp/suite-language-de-hub.png',fullPage:true});
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'FlowPilot',exact:true}).click();
    await expect(flow.getByLabel('Name des Arbeitsablaufs',{exact:true})).toHaveValue('Save workflow — eigener Entwurf');
    await expect(page).toHaveURL(/#\/flowPilot\/workflows$/);
    await expect(page.getByRole('link',{name:'Arbeitsabläufe',exact:true})).toBeVisible();
    await page.screenshot({path:'node_modules/.tmp/suite-language-de-flow.png',fullPage:true});
    await setSuiteLanguage('en');
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'FlowPilot',exact:true}).click();
    await expect(flow.getByLabel('Workflow name',{exact:true})).toHaveValue('Save workflow — eigener Entwurf');
    await expect(page.getByRole('button',{name:'Project Manager',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Workflows',exact:true})).toBeVisible();
    for(const url of [hubUrl,flowUrl]){
        const standalone=await context.newPage();await standalone.goto(url);
        await expect(standalone.getByLabel('Language',{exact:true})).toBeVisible({timeout:30000});
        await standalone.getByLabel('Language',{exact:true}).selectOption('de');
        await expect(standalone.getByRole('link',{name:/Arbeitsabläufe|Dokumente/}).first()).toBeVisible();
        await expect(standalone.locator('html')).toHaveAttribute('lang','de');
        await standalone.reload();await expect(standalone.getByLabel('Sprache',{exact:true})).toHaveValue('de');
        await standalone.close();
    }
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('PASS: suite and both embedded apps switch DE/EN; menus, page controls, diagnostics and locale follow; drafts/data/frame identity survive; no extra requests; standalone preference works independently. APIs were mocked.');
}catch(error){console.log('ROOT',page.url());console.log('ERRORS',errors);for(const frame of page.frames()){console.log('FRAME',frame.url());if(frame.url().startsWith(hubUrl))console.log((await frame.locator('body').innerText()).slice(0,2500));}throw error;}finally{await browser.close();}
