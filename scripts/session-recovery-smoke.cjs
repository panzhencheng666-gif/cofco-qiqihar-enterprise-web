const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const source = process.argv[2] || require('node:path').resolve(__dirname,'../public/session-recovery-v1.js');
const script = fs.existsSync(source) ? fs.readFileSync(source,'utf8') : '';
const counts = new Map();
let authenticated = false;
const server = http.createServer((req,res) => {
 const path = req.url.split('?')[0]; counts.set(path,(counts.get(path)||0)+1);
 if (path==='/guard.js') {res.setHeader('Content-Type','text/javascript');return res.end(script);}
 if (path.startsWith('/api/')) {res.setHeader('Content-Type','application/json'); res.statusCode = path.endsWith('/forbidden') ? 403 : path.endsWith('/broken') ? 500 : authenticated ? 200 : 401;return res.end(JSON.stringify({status:res.statusCode}));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html lang="zh-CN"><head><script src="/guard.js"></script></head><body><textarea aria-label="草稿">未提交内容</textarea><h1>业务页面</h1>'+(path==='/parent'?'<iframe src="/child"></iframe>':'')+'</body></html>');
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage(); await page.goto(origin);
  await page.route('http://session-external.invalid/**',r=>r.fulfill({status:401,headers:{'access-control-allow-origin':'*'},body:'{}'}));
  await page.evaluate(()=>fetch('http://session-external.invalid/api/v1/data'));
  await page.evaluate(()=>Promise.all(['/api/v1/forbidden','/api/v1/broken','/api/v1/identity/registration-entry/options'].map(x=>fetch(x))));
  assert.equal(await page.getByRole('dialog').count(),0,'403, 500, public routes must not expire session');
  await page.evaluate(()=>Promise.all([fetch('/api/v1/master-data/regions'),fetch('/api/v1/overview/options')]));
  assert.equal(await page.getByRole('dialog').count(),1,'401 must produce ONE recovery dialog');
  assert.equal(await page.locator('textarea').inputValue(),'未提交内容');
  const before=counts.get('/api/v1/master-data/regions');
  await page.evaluate(()=>fetch('/api/v1/master-data/regions'));
  assert.equal(counts.get('/api/v1/master-data/regions'),before,'expired polling must not reach server');
  await page.evaluate(()=>fetch('/api/v1/save',{method:'POST',body:'draft'}));
  assert.equal(counts.get('/api/v1/save'),undefined,'must not submit or replay writes after expiry');
  await page.getByRole('button',{name:'已登录，恢复当前页面',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),1,'401 on recovery must keep current page');
  await page.getByRole('button',{name:'保留当前页面',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0); assert.equal(await page.locator('textarea').inputValue(),'未提交内容');
  await page.getByRole('button',{name:'登录已失效 · 点击恢复',exact:true}).click();
  authenticated=true;
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'已登录，恢复当前页面',exact:true}).click()]);
  assert.equal(await page.getByRole('dialog').count(),0);
  console.log('PASS: correct status scope, deduplication, draft preserved, polling paused, writes not replayed, explicit recovery');
  authenticated=false;
  await page.goto(origin+'/parent');
  const child=page.frames().find(x=>x.url().endsWith('/child'));
  await child.evaluate(()=>fetch('/api/v1/overview/options'));
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').count(),1); assert.equal(await child.getByRole('dialog').count(),0);
  console.log('PASS: embedded overview uses parent recovery dialog');
  await page.goto(origin);
  await page.evaluate(()=>{window.checkStream=new EventSource('/api/v1/business-events/stream');});
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.evaluate(()=>window.checkStream.readyState),2);
  const streamRequests=counts.get('/api/v1/business-events/stream');
  await page.evaluate(()=>{window.nextStream=new EventSource('/api/v1/business-events/stream');});
  assert.equal(await page.evaluate(()=>window.nextStream.readyState),2);
  assert.equal(counts.get('/api/v1/business-events/stream'),streamRequests);
  console.log('PASS: SSE expiry confirmed with session endpoint, streams closed, reconnect suppressed');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e.message);server.close();process.exitCode=1;});
