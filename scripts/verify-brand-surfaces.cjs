/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS verification script */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto(process.env.BRAND_TEST_URL || 'http://localhost:3137/',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForSelector('.marketing-footer',{timeout:60000});
   await page.waitForTimeout(1000);
   const footer=page.locator('.marketing-footer');
   const f=await footer.evaluate(e=>({brandBackground:getComputedStyle(e.querySelector('.brand')).backgroundColor,filter:getComputedStyle(e.querySelector('.brand img')).filter,bottomBefore:getComputedStyle(e.querySelector('.marketing-footer-bottom'),'::before').content}));
   assert.equal(f.brandBackground,'rgba(0, 0, 0, 0)');
   assert.equal(f.bottomBefore,'none');
   await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto'; window.scrollTo({top:document.body.scrollHeight,behavior:'instant'});});
   await page.screenshot({path:`brand-footer-${width}.png`,timeout:15000});
   // Layout fixture uses the actual sidebar classes and production styles; no private session needed.
   await page.evaluate(()=>{document.querySelector('#app').innerHTML='<div class="dashboard-shell"><aside class="sidebar"><div class="sidebar-brand"><button class="brand btn-ghost"><img class="brand-logo-image brand-logo-image--primary" src="/assets/renvix-logo-primary.png" width="814" height="228"></button></div></aside></div>'; const s=document.querySelector('.sidebar');s.style.setProperty('transform','none','important');s.style.setProperty('visibility','visible','important');});
   const d=await page.locator('.sidebar-brand').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('img').getBoundingClientRect();return{centerError:Math.abs((a.left+a.right-b.left-b.right)/2),inside:b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom}});
   assert(d.inside,JSON.stringify(d));assert(d.centerError<2,JSON.stringify(d));
   console.log(JSON.stringify({width,footer:f,sidebar:d}));
   await page.close();
  }
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto((process.env.BRAND_AUTH_URL || 'http://localhost:3137')+'/login',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForSelector('.auth-suite-brandbar-logo img',{timeout:60000});
   const logo=page.locator('.auth-suite-brandbar-logo img');
   const box=await logo.boundingBox();assert(box.width<=(width===390?128:180));
   console.log(JSON.stringify({width,authLogo:box}));
   await page.screenshot({path:`brand-auth-${width}.png`,timeout:15000});
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
