// Run only after the parent finishes both serial production recordings.
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const run = promisify(execFile), output = __dirname, root = path.resolve(__dirname, '../..');
const sha = data => createHash('sha256').update(data).digest('hex');
const exists = file => fs.stat(file).then(() => true, () => false);
const execute = (program, args, maxBuffer = 4 * 1024 * 1024) => run(program, args, { windowsHide: true, maxBuffer });

// Read bounded Matroska/EBML structure, rather than finding coincidental byte
// strings inside compressed packets, to establish Duration and Cues entries.
function webmIndex(bytes) {
  function vint(at, keepMarker) {
    if (at >= bytes.length) throw Error('Truncated EBML integer');
    let width = 1, marker = 128; while (width <= 8 && !(bytes[at] & marker)) { width++; marker >>= 1; }
    if (width > 8 || at + width > bytes.length) throw Error('Invalid EBML integer');
    let value = BigInt(keepMarker ? bytes[at] : bytes[at] & (marker - 1));
    for (let i = 1; i < width; i++) value = value * 256n + BigInt(bytes[at + i]);
    return { width, value, unknown: !keepMarker && value === (1n << BigInt(7 * width)) - 1n };
  }
  function children(start, end) {
    const rows = []; let at = start;
    while (at < end) {
      if (rows.length > 100000) throw Error('EBML element limit');
      const id = vint(at, true), size = vint(at + id.width, false), data = at + id.width + size.width;
      const finish = size.unknown ? end : data + Number(size.value);
      if (finish > end || finish <= at || !Number.isSafeInteger(finish)) throw Error('EBML element outside parent');
      rows.push({ id: id.value.toString(16), data, end: finish, bytes: finish - data }); at = finish;
    }
    return rows;
  }
  const segment = children(0, bytes.length).find(e => e.id === '18538067');
  if (!segment) return { segment: false, durationElement: false, cuePoints: 0 };
  const top = children(segment.data, segment.end), info = top.find(e => e.id === '1549a966'), cues = top.find(e => e.id === '1c53bb6b');
  const duration = info && children(info.data, info.end).find(e => e.id === '4489');
  return { segment: true, durationElement: !!duration, durationValue: duration?.bytes === 8 ? bytes.readDoubleBE(duration.data) : duration?.bytes === 4 ? bytes.readFloatBE(duration.data) : null, cuesElement: !!cues, cuePoints: cues ? children(cues.data, cues.end).filter(e => e.id === 'bb').length : 0 };
}
function continuity(packets, stream, activeStartSeconds = null) {
  const rows = packets.filter(p => p.stream_index === stream.index).map(p => ({ time: Number(p.pts_time), duration: Number(p.duration_time || 0) })).sort((a, b) => a.time - b.time);
  const intervals = rows.slice(1).map((p, i) => p.time - rows[i].time), holes = rows.slice(1).map((p, i) => p.time - rows[i].time - rows[i].duration);
  const active = activeStartSeconds === null ? [] : rows.filter(p => p.time >= activeStartSeconds);
  const activeIntervals = active.slice(1).map((p, i) => p.time - active[i].time);
  return { packets: rows.length, finiteTimestamps: rows.every(p => Number.isFinite(p.time) && Number.isFinite(p.duration)), firstSeconds: rows[0]?.time, lastEndSeconds: rows.at(-1)?.time + rows.at(-1)?.duration, maxIntervalSeconds: Math.max(0, ...intervals), maxUncoveredSeconds: Math.max(0, ...holes), ...(activeStartSeconds === null ? {} : { firstActiveDelaySeconds: active[0]?.time - activeStartSeconds, maxActiveIntervalSeconds: Math.max(0, ...activeIntervals) }) };
}
async function streamHashes(file) {
  const result = await execute('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-']);
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}
async function sourceReceipt(receipt) {
  const files = Object.keys(receipt), changed = [];
  for (const file of files) if (await fs.readFile(path.join(root, file)).then(data => sha(data), () => null) !== receipt[file]) changed.push(file);
  return { files: files.length, changed, passed: changed.length === 0 };
}

(async () => {
  const recordingBytes = await fs.readFile(path.join(output, 'multi-previews.json')), recording = JSON.parse(recordingBytes), recordingReportSha256 = sha(recordingBytes);
  const expected = ['island-light', 'multi-fireworks'];
  if (!recording.passed || recording.clips.length !== expected.length || !expected.every(id => recording.clips.some(c => c.id === id && c.passed))) throw Error('Both complete current multi-previews clips are required');
  const previous = await fs.readFile(path.join(output, 'media-check.json')).then(bytes => JSON.parse(bytes), () => null);
  const report = { schema: 'glass-atoll.multi-light-audio.media-check.v1', dateUTC: new Date().toISOString(), recordingReport: 'multi-previews.json', recordingReportSha256, sourceReceipt: { before: await sourceReceipt(recording.sourceHashes) }, clips: [], passed: false,
    limits: ['Full-file and independent libvpx decode, stream payload hashes, packet continuity, indexed wall duration and non-silent audio establish technical media delivery.', 'Active-firework cadence excludes the static, pre-launch recording lead-in; the full-file maximum frame interval is still reported, not hidden.', 'These checks do not establish subjective listening/appearance, calibrated sound pressure, FPS, or photorealism.', 'Production WebAudio Opus and compositor JPEG use nearby wall anchors rather than a measured shared sample clock. Concat cadence is quantized to 40ms; millisecond audio/video sync is unverified.'] };
  if (!report.sourceReceipt.before.passed) { await fs.writeFile(path.join(output, 'media-check.json'), JSON.stringify(report, null, 2)); throw Error('Recording source receipt is stale: ' + report.sourceReceipt.before.changed.join(', ')); }
  await fs.mkdir(path.join(output, 'raw'), { recursive: true });
  for (const clip of recording.clips) {
    try {
      const file = path.join(output, clip.id + '.webm'), raw = path.join(output, 'raw', clip.id + '.webm');
      if (await exists(raw)) {
        const rawBytes = await fs.readFile(raw), finalBytes = await fs.readFile(file), prior = previous?.clips.find(item => item.id === clip.id);
        if (rawBytes.length !== clip.bytes || sha(rawBytes) !== clip.encodedSha256) throw Error('Preserved raw belongs to another recording; retain/archive it before checking a new capture: ' + clip.id);
        if (sha(finalBytes) !== clip.encodedSha256 && sha(finalBytes) !== prior?.final?.sha256) throw Error('Current final file has changed outside this validator: ' + clip.id);
      } else {
        const input = await fs.readFile(file);
        if (input.length !== clip.bytes || sha(input) !== clip.encodedSha256) throw Error('Capture file differs from multi-previews receipt: ' + clip.id);
        await fs.copyFile(file, raw, constants.COPYFILE_EXCL);
      }
      // Retain the original. Stream copy changes only container duration/cues.
      await execute('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', file]);
      const probe = await execute('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=index,codec_name,codec_type,width,height,sample_rate,channels', '-of', 'json', file]);
      const metadata = JSON.parse(probe.stdout), video = metadata.streams.find(s => s.codec_type === 'video'), audio = metadata.streams.find(s => s.codec_type === 'audio');
      if (!video || !audio) throw Error('Both video and audio streams required');
      const decoded = await execute('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-']);
      const referenceDecoder = video.codec_name === 'vp8' ? 'libvpx' : 'libvpx-vp9';
      const reference = await execute('ffmpeg', ['-v', 'error', '-c:v', referenceDecoder, '-i', file, '-map', '0:v:0', '-an', '-f', 'null', '-']);
      const measured = await execute('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
      const mean = Number(/mean_volume:\s*([^ ]+) dB/.exec(measured.stderr)?.[1]), peak = Number(/max_volume:\s*([^ ]+) dB/.exec(measured.stderr)?.[1]);
      const packetResult = await execute('ffprobe', ['-v', 'error', '-show_packets', '-show_entries', 'packet=stream_index,pts_time,duration_time', '-of', 'json', file], 8 * 1024 * 1024);
      const packets = JSON.parse(packetResult.stdout).packets, videoContinuity = continuity(packets, video, clip.preRollSeconds), audioContinuity = continuity(packets, audio), duration = Number(metadata.format.duration);
      const rawBytes = await fs.readFile(raw), finalBytes = await fs.readFile(file), rawStreamHashes = await streamHashes(raw), finalStreamHashes = await streamHashes(file), index = webmIndex(finalBytes);
      const checks = {
        dimensions: video.width === clip.dimensions[0] && video.height === clip.dimensions[1] && video.width === 960 && video.height === 720,
        expectedAudioCodec: audio.codec_name === 'opus' && Number(audio.sample_rate) === 48000,
        durationMatchesRecordingWallClock: duration > 0 && Math.abs(duration - clip.recordingWallSeconds) < .35,
        eventClockDriftUnderHalfSecond: Math.abs(clip.physicalSeconds - clip.wallSeconds) < .5,
        recordedCompletePostRoll: clip.completed && clip.postEventPhysicalSeconds >= .7,
        sourceImageStartsWithinOneFrame: clip.screencast.firstSeconds <= .04,
        sourceImageActiveContinuity: clip.screencast.firstActiveDelaySeconds <= .25 && clip.screencast.maxActiveIntervalSeconds <= .25,
        sourceImagesCoverEnd: clip.recordingWallSeconds - clip.screencast.lastSeconds <= .25,
        videoStartsPromptly: videoContinuity.firstSeconds <= .25,
        videoTimestampsFinite: videoContinuity.finiteTimestamps,
        noLongActiveVideoFreeze: videoContinuity.firstActiveDelaySeconds <= .25 && videoContinuity.maxActiveIntervalSeconds <= .25,
        videoCoversEnd: Math.abs(duration - videoContinuity.lastEndSeconds) <= .25,
        audioStartsPromptly: audioContinuity.firstSeconds <= .15,
        audioTimestampsFinite: audioContinuity.finiteTimestamps,
        opusPacketContinuity: audioContinuity.maxUncoveredSeconds <= .03,
        audioCoversEnd: Math.abs(duration - audioContinuity.lastEndSeconds) <= .25,
        fullDecode: decoded.stderr.trim() === '', referenceVideoDecode: reference.stderr.trim() === '',
        nonSilentAudio: Number.isFinite(mean) && Number.isFinite(peak) && mean > -90,
        exactEncodedPayloadsRetained: rawStreamHashes.length === 2 && JSON.stringify(rawStreamHashes) === JSON.stringify(finalStreamHashes),
        durationAndCueIndexPresent: index.durationElement && index.durationValue > 0 && index.cuePoints > 0,
        rawMatchesCaptureReceipt: rawBytes.length === clip.bytes && sha(rawBytes) === clip.encodedSha256,
      };
      const result = { id: clip.id, passed: Object.values(checks).every(Boolean), checks, metadata, index, raw: { file: 'raw/' + clip.id + '.webm', bytes: rawBytes.length, sha256: sha(rawBytes), streamHashes: rawStreamHashes }, final: { file: clip.id + '.webm', bytes: finalBytes.length, sha256: sha(finalBytes), streamHashes: finalStreamHashes }, repackaging: 'Stream copy only; original raw retained; encoded packet payload hashes unchanged.', sourceCapture: clip.screencast.method, recordingWallDifferenceSeconds: duration - clip.recordingWallSeconds, eventWallDifferenceSeconds: clip.physicalSeconds - clip.wallSeconds, videoContinuity, audioContinuity, decodeErrors: decoded.stderr.trim(), referenceVideoDecoder: referenceDecoder, referenceDecodeErrors: reference.stderr.trim(), audioMeanDbfs: mean, audioPeakDbfs: peak };
      report.clips.push(result); console.log(JSON.stringify({ id: clip.id, passed: result.passed, duration, audioMeanDbfs: mean, audioPeakDbfs: peak, maxVideoInterval: videoContinuity.maxIntervalSeconds, maxAudioHole: audioContinuity.maxUncoveredSeconds, cuePoints: index.cuePoints, failed: Object.keys(checks).filter(k => !checks[k]) }));
    } catch (error) { report.clips.push({ id: clip.id, passed: false, error: error.stack || String(error) }); }
    await fs.writeFile(path.join(output, 'media-check.json'), JSON.stringify(report, null, 2) + '\n');
  }
  report.sourceReceipt.after = await sourceReceipt(recording.sourceHashes); report.passed = report.clips.length === 2 && report.clips.every(c => c.passed) && report.sourceReceipt.before.passed && report.sourceReceipt.after.passed;
  await fs.writeFile(path.join(output, 'media-check.json'), JSON.stringify(report, null, 2) + '\n'); if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
