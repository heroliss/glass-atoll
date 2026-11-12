const { chromium } = require('playwright');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const base = process.env.ATOLL_REVIEW_URL || 'http://127.0.0.1:5186/verification/fireworks/audio-palette-review.html';
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const report = { date: new Date().toISOString(), url: base, mode: 'isolated headless Chrome; autoplay permission enabled for playback mechanics only', errors: [], requestsFailed: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 900 } });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('requestfailed', request => report.requestsFailed.push({ url: request.url(), error: request.failure()?.errorText }));
    const response = await page.goto(base, { waitUntil: 'domcontentloaded' });
    report.httpStatus = response.status();
    report.clips = await page.evaluate(async () => Promise.all([...document.querySelectorAll('audio')].map(audio => new Promise(resolve => {
      let timer;
      const finish = status => { clearTimeout(timer); resolve({ source: audio.getAttribute('src'), controls: audio.controls, duration: Number.isFinite(audio.duration) ? audio.duration : null, status, mediaError: audio.error?.code || null }); };
      audio.addEventListener('loadedmetadata', () => finish('loaded'), { once: true });
      audio.addEventListener('error', () => finish('error'), { once: true });
      timer = setTimeout(() => finish('timeout'), 15000);
      audio.preload = 'metadata';
      audio.load();
    }))));
    report.assets = await Promise.all(report.clips.map(async clip => {
      const url = new URL(clip.source, base).href, result = await page.request.get(url);
      return { url, status: result.status(), bytes: (await result.body()).length };
    }));
    await page.screenshot({ path: path.join(__dirname, 'review-desktop.png'), fullPage: true });
    await page.locator('audio').first().evaluate(audio => audio.play());
    await page.waitForFunction(() => document.querySelector('audio').currentTime > .15, { timeout: 5000 });
    report.playback = await page.locator('audio').first().evaluate(audio => ({ currentTime: audio.currentTime, paused: audio.paused, error: audio.error?.code || null }));
    await page.locator('audio').first().evaluate(audio => audio.pause());
    await page.setViewportSize({ width: 390, height: 550 });
    report.compact = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, controlCount: document.querySelectorAll('audio[controls]').length }));
    await page.screenshot({ path: path.join(__dirname, 'review-compact.png'), fullPage: true });
    // Chrome may cancel a media range request after obtaining metadata. Accept
    // that cancellation only when both metadata and an independent full GET pass.
    const loadedAssets = new Set(report.assets.filter(asset => asset.status === 200 && asset.bytes > 0).map(asset => asset.url));
    report.metadataCancellations = report.requestsFailed.filter(request => request.error === 'net::ERR_ABORTED' && loadedAssets.has(request.url));
    report.requestsFailed = report.requestsFailed.filter(request => !report.metadataCancellations.includes(request));
    report.passed = report.httpStatus === 200 && report.clips.length === 8 && report.assets.every(asset => asset.status === 200 && asset.bytes > 0) && report.clips.every(clip => clip.status === 'loaded' && clip.controls && clip.duration > 0 && !clip.mediaError) && report.playback.currentTime > .15 && !report.playback.error && report.compact.scrollWidth <= report.compact.viewport && report.errors.length === 0 && report.requestsFailed.length === 0;
  } catch (error) {
    report.errors.push(error.stack || String(error));
    report.passed = false;
  } finally {
    await browser.close();
    await writeFile(path.join(__dirname, 'review-page-check.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
})();
