import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('../flowpilot-codex-starter/frontend/package.json'));
const { chromium, expect } = require('@playwright/test');
const origin = 'https://forge-flow.de';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
const server = createServer(async (req,res) => {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/knowledge-hub')){
        const upstream=request({hostname:'127.0.0.1',port:5300,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:5300'}}, response=>{
            res.writeHead(response.statusCode,response.headers);response.pipe(res);
        });upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);return;
    }
    const flow=url.pathname.startsWith('/flowpilot/');
    const root=path.resolve(flow?'../flowpilot-codex-starter/frontend/dist':'frontend/dist');
    const relative=decodeURIComponent(flow?url.pathname.slice('/flowpilot/'.length):url.pathname.slice(1))||'index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(400);res.end();return;}
    try{const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(5513,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--host-resolver-rules=MAP forge-flow.de 127.0.0.1']});
const context=await browser.newContext({locale:'en-GB',viewport:{width:1440,height:1000}});
const errors=[];let administrator=true;
await context.addInitScript(()=>{localStorage.setItem('forgeflow.language','en');localStorage.setItem('knowledgeHub.language','en');localStorage.setItem('flowpilot.language','en');});
await context.route('**/*',async route=>{
    const url=new URL(route.request().url());let fixture;
    if(url.origin!==origin)return route.abort();
    const pathname=url.pathname;
    if(pathname==='/api/v1/auth/session')fixture={user:{id:'production-fixture',name:'Synthetic production test',email:'production@example.test',administrator},csrfToken:'synthetic-production-token'};
    else if(pathname==='/api/v1/me/settings')fixture={version:1,settings:{themeMode:'dark',defaultProjectView:'dashboard',defaultTaskPriority:'medium',language:'en'}};
    else if(pathname==='/api/v1/workspace')fixture={version:1,revision:'synthetic',data:{projects:[],customers:[],tasks:[],activities:[],epics:[],sprints:[],files:[],wiki:{articles:[],categories:[]}}};
    else if(pathname==='/knowledge-hub-api/api/auth/session')fixture={mode:'local-demo',user:null,csrf_token:null,registration_enabled:false};
    else if(pathname==='/knowledge-hub-api/api/documents')fixture={mode:'local-demo',provider:'fake',max_upload_bytes:10485760,documents:[]};
    else if(pathname==='/flowpilot-api/api/v1/workflows')fixture={items:[],total:0,limit:12,offset:0,storage:'postgresql'};
    else if(pathname==='/flowpilot-api/api/v1/health')fixture={status:'ok',service:'flowpilot-api',version:'0.1.0',mode:'infrastructure'};
    else if(pathname==='/flowpilot-api/api/v1/ready')fixture={status:'ready',mode:'infrastructure',dependencies:{postgresql:'ok',redis:'ok'}};
    else if(pathname==='/knowledge-hub-api/health')fixture={status:'ok',mode:'local-demo'};
    if(fixture)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)});
    if(pathname.startsWith('/api/v1/')||pathname.startsWith('/knowledge-hub-api/')||pathname.startsWith('/flowpilot-api/'))return route.fulfill({status:404,contentType:'application/json',body:'{"error":{"code":"FIXTURE","message":"Synthetic fixture"}}'});
    const response=await route.fetch({url:'http://127.0.0.1:5513'+pathname+url.search,maxRedirects:0});
    await route.fulfill({response});
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')console.log('CONSOLE',message.text());});
page.on('requestfailed',req=>console.log('FAILED',req.url(),req.failure()?.errorText));
try{
    await page.goto(origin+'/#/flowPilot/workflows');
    const flow=page.frameLocator('iframe[title="FlowPilot"]');
    await expect(flow.getByRole('button',{name:'+ New workflow',exact:true})).toBeVisible({timeout:30000});
    await flow.getByRole('button',{name:'+ New workflow',exact:true}).click();
    await flow.getByLabel('Workflow name',{exact:true}).fill('Production path draft');
    await page.getByRole('button',{name:'AI Knowledge Hub',exact:true}).click();
    const hub=page.frameLocator('iframe[title="AI Knowledge Hub"]');
    await expect(hub.getByLabel('Your question',{exact:true})).toBeVisible({timeout:30000});
    await page.getByRole('link',{name:'Documents',exact:true}).click();
    await expect(hub.getByRole('heading',{name:'Document library',exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Global settings',exact:true}).click();
    await page.getByRole('link',{name:'Language',exact:true}).click();
    await page.locator('select').filter({has:page.locator('option[value="de"]')}).selectOption('de');
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'FlowPilot',exact:true}).click();
    await expect(flow.getByLabel('Name des Arbeitsablaufs',{exact:true})).toHaveValue('Production path draft');
    await page.screenshot({path:'node_modules/.tmp/showcase-production-paths.png',fullPage:true});
    administrator=false;
    await page.reload();
    await expect(page.getByRole('button',{name:'Project Manager',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'FlowPilot',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'AI Knowledge Hub',exact:true})).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('PASS: actual production builds use separate subpaths/APIs; embedded navigation, language and drafts survive; non-admin sessions mount no showcase frames. All APIs mocked; no connection to the real server.');
}catch(error){
    console.log('Browser errors:',errors);
    for(const frame of page.frames())console.log('Frame:',frame.url(),(await frame.locator('body').innerText()).slice(0,1400));
    throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
