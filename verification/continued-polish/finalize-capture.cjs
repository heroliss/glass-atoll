const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(__dirname, '../..');
const method = 'CDP compositor JPEG95 frames retain wall-clock cadence, quantized by JPEG concat to a 40ms grid; production WebAudio Opus is captured independently and approximately synchronized. No time scaling or interpolation.';

(async () => {
  const reportPath = path.join(__dirname, 'dynamic-gallery.json');
  const report = JSON.parse(await fs.readFile(reportPath));
  if (!report.passed || report.clips.length !== 10) throw Error('A complete ten-style capture is required');
  for (const [file, hash] of Object.entries(report.sourceHashes)) if (sha(await fs.readFile(path.join(root, file))) !== hash) throw Error('Production source changed: ' + file);
  let sourceImages = 0;
  for (const clip of report.clips) {
    const encoded = await fs.readFile(path.join(__dirname, clip.id + '.webm'));
    if (encoded.length !== clip.bytes || clip.encodedSha256 && sha(encoded) !== clip.encodedSha256) throw Error('Encoded capture has changed: ' + clip.id);
    clip.encodedSha256 = sha(encoded);
    const sourceDir = path.join(__dirname, 'screencast-source', clip.id), timelineFile = path.join(sourceDir, 'timeline.json');
    const timeline = JSON.parse(await fs.readFile(timelineFile));
    for (const frame of timeline.timeline) {
      if (sha(await fs.readFile(path.join(sourceDir, frame.file))) !== frame.sha256) throw Error('Source frame changed: ' + clip.id + '/' + frame.file);
      sourceImages++;
    }
    timeline.screencast.method = method;
    await fs.writeFile(timelineFile, JSON.stringify(timeline, null, 2) + '\n');
    clip.screencast.method = method; clip.captureMethod = method;
    clip.screencast.timelineSha256 = sha(await fs.readFile(timelineFile));
    for (const frame of clip.frames) frame.sha256 = sha(await fs.readFile(path.join(__dirname, frame.file)));
  }
  report.limits[1] = 'Compositor JPEG frames retain wall-clock cadence on a 40ms concat grid; separately captured production WebAudio is approximately synchronized, without a shared measured sample clock. No generated in-between frames or time scaling.';
  const audioFiles = ['audio.js', 'fireworks-audio.js', 'audio-peak-guard.js', 'audio-peak-worklet.js', 'audio-peak-kernel.js', 'assets/audio/ocean-shore.ogg', 'assets/audio/leaf-rustle.ogg'];
  for (const entry of await fs.readdir(path.join(root, 'assets/audio/fireworks'), { withFileTypes: true })) if (entry.isFile() && /\.(ogg|wav|mp3)$/i.test(entry.name)) audioFiles.push('assets/audio/fireworks/' + entry.name);
  report.audioSourceSnapshot = { date: new Date().toISOString(), timing: 'After recording, before media validation; provenance snapshot, not a during-capture response seal.', hashes: {} };
  for (const file of audioFiles) report.audioSourceSnapshot.hashes[file] = sha(await fs.readFile(path.join(root, file)));
  report.captureReceipt = { finalizedAt: new Date().toISOString(), encodedFiles: report.clips.length, sourceImagesVerified: sourceImages, stageImages: report.clips.reduce((count, clip) => count + clip.frames.length, 0) };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, ...report.captureReceipt, audioFingerprintFiles: audioFiles.length }));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
