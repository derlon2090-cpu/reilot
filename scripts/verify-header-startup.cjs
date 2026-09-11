const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
      page.on('requestfailed', request => console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText));
      await page.addInitScript(() => {
        window.headerFrames = [];
        function sample() {
          const nav = document.querySelector('.public-site > .public-nav');
          const logo = document.querySelector('.public-nav .nav-inner > .brand img');
          if (logo) {
            const r = logo.getBoundingClientRect();
            window.headerFrames.push({ width: r.width, right: r.right, height: r.height,
              ready: !!nav?.querySelector('.nav-links'), time: performance.now() });
          }
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      for (let run = 0; run < 3; run++) {
        // First run deliberately delays startup resources to expose partial rendering.
        if (run === 0) await page.route('**/app/**', async route => {
          await new Promise(resolve => setTimeout(resolve, 500));
          await route.continue();
        });
        await page.goto(process.env.HEADER_TEST_URL || 'http://localhost:3136/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('.public-site > .public-nav .brand img', { timeout: 60000 });
        await page.waitForFunction(() => document.querySelector('.public-site > .public-nav .brand img')?.naturalWidth > 0);
        await page.waitForTimeout(250);
        const frames = await page.evaluate(() => window.headerFrames);
        assert(frames.length > 0);
        for (const frame of frames) {
          assert(frame.ready, 'Logo appeared before navigation');
          assert(frame.width > 0 && frame.width <= (width <= 640 ? 114 : width <= 1180 ? 150 : 190), JSON.stringify(frame));
          assert(frame.right <= width + 1, 'Logo outside viewport');
        }
        assert(Math.max(...frames.map(f => f.width)) - Math.min(...frames.map(f => f.width)) < 1, 'Logo resized during startup');
        console.log(JSON.stringify({ width, run, samples: frames.length, logoWidth: frames[0].width, firstHeaderMs: Math.round(frames[0].time) }));
        if (run === 0) await page.unroute('**/app/**');
      }
      await page.screenshot({ path: `header-ready-${width}.png` });
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
