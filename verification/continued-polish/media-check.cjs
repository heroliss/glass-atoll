const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const run = promisify(execFile);
const pilot = process.argv.includes('--pilot');
const output = pilot ? path.join(__dirname, 'screencast-pilot') : __dirname;

(async () => {
  const galleryBytes = await fs.readFile(path.join(output, 'dynamic-gallery.json'));
  const gallery = JSON.parse(galleryBytes);
  const gallerySha256 = createHash('sha256').update(galleryBytes).digest('hex');
  if (!gallery.passed || gallery.clips.length !== (pilot ? 1 : 10)) throw Error('Complete requested gallery is required');
  const previous = await fs.readFile(path.join(output, 'media-check.json')).then(bytes => JSON.parse(bytes), () => null);
  const report = { date: new Date().toISOString(), schema: 'glass-atoll.dynamic-gallery.media-check.v2', gallerySha256, clips: [], limits: ['Full-file decode, packet continuity, wall-clock duration and audio volume checks; not subjective listening or photorealism acceptance.', 'Warm capture with live audio and 750ms preroll; cold startup remains a separate unresolved runtime cost.', 'Audio/video use nearby wall-clock anchors, not a shared measured sample clock; JPEG concat uses a 40ms grid. Millisecond-accurate A/V sync is not established.'] };
  await fs.mkdir(path.join(output, 'raw'), { recursive: true });
  for (const clip of gallery.clips) {
    try {
    const file = path.join(output, clip.id + '.webm');
    const raw = path.join(output, 'raw', clip.id + '.webm');
    if (await fs.stat(raw).then(() => true, () => false)) {
      const prior = previous?.clips.find(item => item.id === clip.id);
      const rawHash = createHash('sha256').update(await fs.readFile(raw)).digest('hex');
      const finalHash = createHash('sha256').update(await fs.readFile(file)).digest('hex');
      if (previous?.gallerySha256 !== gallerySha256 || rawHash !== prior?.raw.sha256 || finalHash !== prior?.final.sha256) throw Error('Existing raw/final files belong to a different recording; archive them before validating new capture: ' + clip.id);
    } else {
      const source = await fs.readFile(file);
      if (source.length !== clip.bytes || clip.encodedSha256 && createHash('sha256').update(source).digest('hex') !== clip.encodedSha256) throw Error('Capture input does not match the gallery receipt: ' + clip.id);
      await fs.rename(file, raw);
    }
    // MediaRecorder emits a streaming WebM without a duration/index. Repackage
    // the exact VP9/Opus streams so the review player can seek; retain the raw.
    await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', file], { windowsHide: true, maxBuffer: 1024 * 1024 });
    const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=index,codec_name,codec_type,width,height,sample_rate,channels', '-of', 'json', file], { windowsHide: true });
    const metadata = JSON.parse(probe.stdout), video = metadata.streams.find(stream => stream.codec_type === 'video'), audio = metadata.streams.find(stream => stream.codec_type === 'audio');
    const decoded = await run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], { windowsHide: true, maxBuffer: 1024 * 1024 });
    const referenceDecoder = video.codec_name === 'vp8' ? 'libvpx' : 'libvpx-vp9';
    const referenceDecoded = await run('ffmpeg', ['-v', 'error', '-c:v', referenceDecoder, '-i', file, '-map', '0:v:0', '-an', '-f', 'null', '-'], { windowsHide: true, maxBuffer: 1024 * 1024 });
    const measured = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { windowsHide: true, maxBuffer: 1024 * 1024 });
    const mean = /mean_volume:\s*([^ ]+) dB/.exec(measured.stderr)?.[1], peak = /max_volume:\s*([^ ]+) dB/.exec(measured.stderr)?.[1];
    const packetProbe = await run('ffprobe', ['-v', 'error', '-show_packets', '-show_entries', 'packet=stream_index,pts_time,duration_time', '-of', 'json', file], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    const packets = JSON.parse(packetProbe.stdout).packets;
    const duration = Number(metadata.format.duration);
    const continuity = stream => {
      const rows = packets.filter(packet => packet.stream_index === stream.index).map(packet => ({ time: Number(packet.pts_time), duration: Number(packet.duration_time || 0) })).sort((a, b) => a.time - b.time);
      const gaps = rows.slice(1).map((packet, index) => packet.time - rows[index].time);
      const holes = rows.slice(1).map((packet, index) => packet.time - rows[index].time - rows[index].duration);
      return { packets: rows.length, firstSeconds: rows[0]?.time, lastEndSeconds: rows.at(-1)?.time + rows.at(-1)?.duration, maxIntervalSeconds: Math.max(0, ...gaps), maxUncoveredSeconds: Math.max(0, ...holes) };
    };
    const videoContinuity = continuity(video), audioContinuity = continuity(audio);
    const checks = {
      dimensions: video.width === clip.dimensions[0] && video.height === clip.dimensions[1],
      durationMatchesRecordingWallClock: duration > 0 && Math.abs(duration - clip.recordingWallSeconds) < .35,
      eventClockDriftUnderHalfSecond: Math.abs(clip.physicalSeconds - clip.wallSeconds) < .5,
      sourceImageStartsWithinOneFrame: clip.screencast.firstSeconds <= .04,
      sourceImageContinuity: clip.screencast.maxIntervalSeconds <= .25,
      sourceImagesCoverEnd: clip.recordingWallSeconds - clip.screencast.lastSeconds <= .25,
      videoStartsPromptly: videoContinuity.firstSeconds <= .25,
      noLongVideoFreeze: videoContinuity.maxIntervalSeconds <= .25,
      videoCoversEnd: Math.abs(duration - videoContinuity.lastEndSeconds) <= .25,
      audioStartsPromptly: audioContinuity.firstSeconds <= .15,
      audioContinuous: audioContinuity.maxUncoveredSeconds <= .03,
      audioCoversEnd: Math.abs(duration - audioContinuity.lastEndSeconds) <= .25,
      fullDecode: decoded.stderr.trim() === '',
      referenceVideoDecode: referenceDecoded.stderr.trim() === '',
      nonSilentAudio: Number.isFinite(Number(mean)) && Number.isFinite(Number(peak)),
    };
    const passed = Object.values(checks).every(Boolean);
    const rawBytes = await fs.readFile(raw), finalBytes = await fs.readFile(file);
    report.clips.push({ id: clip.id, passed, checks, metadata, raw: { file: 'raw/' + clip.id + '.webm', bytes: rawBytes.length, sha256: createHash('sha256').update(rawBytes).digest('hex') }, final: { file: clip.id + '.webm', bytes: finalBytes.length, sha256: createHash('sha256').update(finalBytes).digest('hex') }, sourceCapture: clip.captureMethod, repackaging: 'stream copy only; duration/index added; no audio/video reencoding at this validation step', recordingWallDifferenceSeconds: duration - clip.recordingWallSeconds, eventWallDifferenceSeconds: clip.physicalSeconds - clip.wallSeconds, videoContinuity, audioContinuity, decodeErrors: decoded.stderr.trim(), referenceVideoDecoder: referenceDecoder, referenceDecodeErrors: referenceDecoded.stderr.trim(), audioMeanDbfs: Number(mean), audioPeakDbfs: Number(peak), sourcePhysicalSeconds: clip.physicalSeconds, sourceWallSeconds: clip.wallSeconds });
    console.log(JSON.stringify({ id: clip.id, passed, duration, maxVideoInterval: videoContinuity.maxIntervalSeconds, firstAudio: audioContinuity.firstSeconds, peakDbfs: peak, failed: Object.keys(checks).filter(name => !checks[name]) }));
    } catch (error) { report.clips.push({ id: clip.id, passed: false, error: error.stack || String(error) }); }
  }
  report.passed = report.clips.every(clip => clip.passed);
  await fs.writeFile(path.join(output, 'media-check.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
