const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const report = { date: new Date().toISOString(), schema: 'glass-atoll.continued-polish.review-ui.v1', checks: [], issues: [] };
  const check = (name, passed, detail) => report.checks.push({ name, passed, detail });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    page.on('pageerror', error => report.issues.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') report.issues.push({ message: message.text(), location: message.location() }); });
    page.on('response', response => { if (response.status() >= 400) report.issues.push({ url: response.url(), status: response.status() }); });
    const response = await page.goto('http://127.0.0.1:5186/verification/continued-polish/review.html', { waitUntil: 'domcontentloaded' });
    check('page HTTP', response?.status() === 200, response?.status());
    check('ten review cards', await page.locator('article').count() === 10, await page.locator('article h2').allTextContents());
    await page.locator('video').evaluateAll(videos => videos.forEach(video => { video.preload = 'metadata'; video.load(); }));
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(video => video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0), null, { timeout: 30000 });
    const media = await page.locator('video').evaluateAll(videos => videos.map(video => ({ source: video.currentSrc, duration: video.duration, width: video.videoWidth, height: video.videoHeight, error: video.error?.message || null })));
    check('ten seekable video files', media.length === 10 && media.every(video => video.width === 960 && video.height === 720 && !video.error), media);
    await page.screenshot({ path: path.join(__dirname, 'review-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, articleWidth: document.querySelector('article').getBoundingClientRect().width, videoWidth: document.querySelector('video').getBoundingClientRect().width }));
    check('390px layout fits viewport', narrow.scrollWidth <= narrow.width, narrow);
    await page.screenshot({ path: path.join(__dirname, 'review-mobile.png') });
    const playback = [];
    for (let index = 0; index < 10; index++) {
      const video = page.locator('video').nth(index);
      const target = await video.evaluate(async element => { element.currentTime = element.duration * .5; await element.play(); return element.currentTime; });
      await page.waitForFunction(({ index, target }) => { const v = document.querySelectorAll('video')[index]; return !v.error && !v.paused && v.currentTime > target + .2; }, { index, target }, { timeout: 10000 });
      playback.push(await video.evaluate(element => { element.pause(); return { source: element.currentSrc, currentTime: element.currentTime, totalVideoFrames: element.getVideoPlaybackQuality().totalVideoFrames, droppedVideoFrames: element.getVideoPlaybackQuality().droppedVideoFrames, error: element.error?.message || null }; }));
    }
    check('all ten clips actually play and decode in Chrome', playback.length === 10 && playback.every(item => !item.error && item.totalVideoFrames > 1), playback);
    await page.locator('#sequence').click();
    await page.waitForFunction(() => { const v = document.querySelector('video'); return !v.paused && v.currentTime > 0.2; }, null, { timeout: 10000 });
    check('sequence starts first clip', (await page.locator('#status').textContent()).includes('正在播放'), await page.locator('#status').textContent());
    await page.locator('video').first().evaluate(video => { video.currentTime = Math.max(0, video.duration - 0.3); });
    await page.waitForFunction(() => { const videos = document.querySelectorAll('video'); return videos[0].ended && !videos[1].paused && videos[1].currentTime > 0; }, null, { timeout: 10000 });
    check('sequence advances to second clip', (await page.locator('#status').textContent()).includes((await page.locator('article h2').nth(1).textContent()).trim()), await page.locator('#status').textContent());
    await page.locator('#stop').click();
    check('stop pauses all clips', await page.locator('video').evaluateAll(videos => videos.every(video => video.paused)), await page.locator('#status').textContent());
    check('no page or console errors', report.issues.length === 0, report.issues);
    await page.close();
  } catch (error) {
    check('completed UI flow', false, error.stack || String(error));
    if (page && !page.isClosed()) {
      report.failureState = await page.evaluate(() => ({ status: document.querySelector('#status')?.textContent, videos: [...document.querySelectorAll('video')].map(video => ({ src: video.currentSrc, paused: video.paused, ended: video.ended, currentTime: video.currentTime, readyState: video.readyState, networkState: video.networkState, error: video.error?.message || null, duration: video.duration, buffered: [...Array(video.buffered.length)].map((_, index) => [video.buffered.start(index), video.buffered.end(index)]) })) }));
      await page.screenshot({ path: path.join(__dirname, 'review-failure.png') });
    }
  } finally { await browser.close(); }
  report.passed = report.checks.every(item => item.passed);
  await fs.writeFile(path.join(__dirname, 'review-ui-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.map(item => [item.name, item.passed]) }));
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
