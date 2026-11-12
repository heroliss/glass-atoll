const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const run = promisify(execFile);

(async () => {
  const galleryPath = path.join(__dirname, 'dynamic-gallery.json');
  const gallery = JSON.parse(await fs.readFile(galleryPath));
  if (!gallery.passed || gallery.clips.length !== 10) throw Error('Completed source capture required');
  const report = { date: new Date().toISOString(), passed: false, reason: 'Chrome rejected FFmpeg VP9 playback; encode the identical compositor JPEG source and copied Opus into VP8 WebM.', clips: [] };
  for (const clip of gallery.clips) {
    const directory = path.join(__dirname, 'screencast-source', clip.id);
    const target = path.join(__dirname, clip.id + '.webm');
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'timeline.ffconcat', '-i', 'audio.webm', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libvpx', '-cpu-used', '4', '-threads', '4', '-crf', '10', '-b:v', '3000k', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-fps_mode', 'vfr', '-t', clip.recordingWallSeconds.toFixed(6), target], { cwd: directory, windowsHide: true, maxBuffer: 1024 * 1024 });
    const bytes = await fs.readFile(target);
    clip.bytes = bytes.length; clip.encodedSha256 = createHash('sha256').update(bytes).digest('hex');
    clip.encoding = { video: 'VP8', source: 'same compositor JPEG sequence', audio: 'same Opus, stream copy', timeBase: 'JPEG concat 1/25; no interpolation' };
    report.clips.push({ id: clip.id, bytes: bytes.length, sha256: clip.encodedSha256 });
    await fs.writeFile(path.join(__dirname, 'reencode-status.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ id: clip.id, encoded: 'VP8', bytes: bytes.length }));
  }
  report.passed = true;
  await fs.writeFile(galleryPath, JSON.stringify(gallery, null, 2) + '\n');
  await fs.writeFile(path.join(__dirname, 'reencode-status.json'), JSON.stringify(report, null, 2) + '\n');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
