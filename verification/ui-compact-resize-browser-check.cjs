const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
    // This control is inserted after initUI has installed the resize handlers.
    await page.locator('#display-transform').waitFor({ state: 'attached', timeout: 30000 });
    const expanded = async id => page.locator(id).getAttribute('aria-expanded');
    assert.equal(await expanded('#time-panel-toggle'), 'true');
    assert.equal(await expanded('#fireworks-toggle'), 'true');
    await page.setViewportSize({ width: 390, height: 550 });
    await page.waitForFunction(() =>
      document.querySelector('#time-panel-toggle').getAttribute('aria-expanded') === 'false' &&
      document.querySelector('#fireworks-toggle').getAttribute('aria-expanded') === 'false');
    assert.equal(await expanded('#time-panel-toggle'), 'false');
    assert.equal(await expanded('#fireworks-toggle'), 'false');
    await page.locator('#time-panel-toggle').evaluate(element => element.click());
    assert.equal(await expanded('#time-panel-toggle'), 'true');
    assert.equal(await expanded('#fireworks-toggle'), 'false');
    await page.locator('#fireworks-toggle').evaluate(element => element.click());
    assert.equal(await expanded('#time-panel-toggle'), 'false');
    assert.equal(await expanded('#fireworks-toggle'), 'true');
    assert.deepEqual(errors, []);
    process.stdout.write('Compact resize and drawer interactions: passed\n');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
