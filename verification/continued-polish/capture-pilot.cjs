const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
    await page.goto('http://127.0.0.1:5186/');
    await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 120000 });
    await page.evaluate(async () => {
      const a = window.__ATOLL__; a.pause(true);
      await a.setQuality('medium'); await a.setGraphics({ hdrMode: 'sdr' }); await a.timePreset('stars'); await a.setTime({ running: false });
      a.setFireworks({ type: 'display-saturn', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false, resolvedSmokeLighting: false }); a.setView('fireworks-close');
    });
    await page.waitForFunction(() => !window.__ATOLL__.cameraTransition(), null, { timeout: 20000 });
    await page.locator('#sound').click();
    await page.waitForFunction(() => window.__ATOLL__.audio.enabled && window.__ATOLL__.fireworks().audio.variantsLoaded.length === 5, null, { timeout: 30000 });
    await page.evaluate(() => window.__ATOLL__.launchFirework({ type: 'display-saturn', seed: 618 }));
    await page.waitForFunction(() => window.__ATOLL__.fireworks().active === 0, null, { timeout: 60000 });
    await page.evaluate(() => window.__ATOLL__.clearSmoke());
    const result = await page.evaluate(async () => {
      const a = window.__ATOLL__, canvas = document.querySelector('#scene canvas');
      a.pause(false);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const staging = document.createElement('canvas'); staging.width = canvas.width; staging.height = canvas.height;
      const drawing = staging.getContext('2d', { alpha: false });
      const video = staging.captureStream(0), audio = a.captureAudio(), track = video.getVideoTracks()[0];
      const stream = new MediaStream([...video.getVideoTracks(), ...audio.getAudioTracks()]);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 5000000, audioBitsPerSecond: 192000 });
      const chunks = [], samples = []; let lastRequest = -Infinity, frames = 0;
      const finished = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = event => reject(event.error); });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const capture = now => {
        if (now - lastRequest >= 1000 / 30) { drawing.drawImage(canvas, 0, 0); track.requestFrame(); frames++; lastRequest = now; }
        a.setFrameProbe(capture);
      };
      const start = performance.now(); recorder.start(500); a.setFrameProbe(capture);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const launch = a.launchFirework({ type: 'display-saturn', seed: 619 });
      while (a.fireworks().active) { await new Promise(resolve => setTimeout(resolve, 200)); samples.push({ wall: (performance.now() - start) / 1000, time: a.state.time, fps: a.state.fps }); }
      const seconds = (performance.now() - start) / 1000;
      recorder.stop(); await finished; a.setFrameProbe(null); a.pause(true); video.getTracks().forEach(item => item.stop()); a.stopAudioCapture();
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const dataURL = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      return { seconds, frames, launch, samples, canvas: { className: canvas.className, width: canvas.width, height: canvas.height, display: getComputedStyle(canvas).display, hdr: a.graphics().hdr }, dataURL };
    });
    const { dataURL, ...metadata } = result;
    const bytes = Buffer.from(dataURL.slice(dataURL.indexOf(';base64,') + 8), 'base64');
    await fs.writeFile(path.join(__dirname, 'capture-pilot.webm'), bytes);
    await fs.writeFile(path.join(__dirname, 'capture-pilot.json'), JSON.stringify(metadata, null, 2));
    console.log(JSON.stringify({ seconds: result.seconds, requestedFrames: result.frames, bytes: bytes.length }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
