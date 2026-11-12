const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = __dirname;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const issues = [];
  page.on('pageerror', error => issues.push(error.message));
  page.on('console', message => { if (message.type() === 'error') issues.push(message.text()); });
  try {
    await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 120000 });
    await page.addStyleTag({ content: 'body > :not(#scene) { visibility: hidden !important; }' });
    const cases = [{ name: 'day-slow', preset: 'day', charge: .12 }, { name: 'day-fast', preset: 'day', charge: .95 }, { name: 'night-fast', preset: 'stars', charge: .95 }];
    const results = [];
    for (const item of cases) {
      await page.evaluate(async preset => {
        const a = window.__ATOLL__;
        a.pause(true);
        a.setFireworks({ autoLaunch: false });
        await a.setTime({ running: false });
        await a.timePreset(preset);
        a.setLocalLights({ flashlight: { enabled: preset === 'stars', brightness: .7 } });
        a.setCamera([48, 2, 30], [53, 0, 30]);
        a.pause(false);
      }, item.preset);
      await sleep(350);
      const launch = await page.evaluate(charge => window.__ATOLL__.throwStone(null, charge), item.charge);
      const deadline = Date.now() + 9000;
      let splash = null;
      while (Date.now() < deadline) {
        splash = await page.evaluate(() => window.__ATOLL__.interactions().splashes.events.at(-1) || null);
        if (splash && splash.age >= .10 && splash.age <= splash.crownDurationSeconds) break;
        await sleep(20);
      }
      const state = await page.evaluate(() => { const a = window.__ATOLL__; a.pause(true); return { splash: a.interactions().splashes.events.at(-1) || null, fps: a.state.fps, graphicsError: a.state.graphicsContextInterrupted }; });
      const screenshot = path.join(output, item.name + '.png');
      await page.screenshot({ path: screenshot });
      results.push({ ...item, launch, ...state, screenshot });
      await page.evaluate(() => window.__ATOLL__.pause(false));
      await sleep(850);
    }
    await fs.writeFile(path.join(output, 'main-scene-review.json'), JSON.stringify({ results, issues }, null, 2));
    console.log(JSON.stringify({ results: results.map(({ screenshot, splash, ...rest }) => ({ ...rest, screenshot, splash: splash && { age: splash.age, radius: splash.maximumCrownRadiusMetres, crownDuration: splash.crownDurationSeconds, impact: splash.impact && { normalSpeed: splash.impact.normalSpeedMetresPerSecond, scale: splash.impact.scale } } })), issues }, null, 2));
    if (issues.length || results.some(row => !row.splash || row.graphicsError)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
