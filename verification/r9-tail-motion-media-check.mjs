// Technical artifact acceptance only. Does not render, transcode or change gain.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'verification');
const files={mp4:path.join(dir,'pyro-r9-tail-motion.mp4'),webm:path.join(dir,'pyro-r9-tail-motion.webm'),report:path.join(dir,'pyro-r9-tail-motion.json')};
const output=path.join(dir,'pyro-r9-motion-media-check.json');
const tools={ffmpeg:'C:/ProgramData/chocolatey/bin/ffmpeg.exe',ffprobe:'C:/ProgramData/chocolatey/bin/ffprobe.exe'};
const expectedAudioSHA256='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31';
const checks=[],results={},check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,evidence});
const sha=b=>createHash('sha256').update(b).digest('hex');
const number=x=>Number.isFinite(Number(x))?Number(x):null;
function run(executable,args,{binary=false,maxBuffer=33554432}={}){
  const r=spawnSync(executable,args,{windowsHide:true,encoding:binary?undefined:'utf8',maxBuffer,timeout:60000});
  if(r.error)throw r.error;
  return{status:r.status,signal:r.signal,stdout:r.stdout,stderr:binary?r.stderr.toString('utf8'):r.stderr};
}
function probe(file){const r=run(tools.ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]);if(r.status!==0)throw Error('ffprobe failed: '+r.stderr);return JSON.parse(r.stdout);}
function decode(file){const r=run(tools.ffmpeg,['-hide_banner','-v','error','-nostdin','-xerror','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-']);return{exitCode:r.status,signal:r.signal,stderr:r.stderr.trim(),passed:r.status===0&&!r.signal&&!r.stderr.trim()};}
function atoms(buffer){const out=[];let offset=0;while(offset<buffer.length){if(offset+8>buffer.length)throw Error('Truncated MP4 atom header');let size=buffer.readUInt32BE(offset);const type=buffer.toString('ascii',offset+4,offset+8);let header=8;if(size===1){if(offset+16>buffer.length)throw Error('Truncated extended MP4 atom');const n=buffer.readBigUInt64BE(offset+8);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Unbounded MP4 atom');size=Number(n);header=16;}else if(size===0)size=buffer.length-offset;if(size<header||offset+size>buffer.length)throw Error('Invalid MP4 atom bounds');out.push({type,offset,size});offset+=size;}return out;}
function audioStats(buffer,channels=2){
  if(buffer.length%4)throw Error('Truncated float32 audio output');
  const stats=Array.from({length:channels},()=>({samples:0,nonzero:0,negative:0,nonfinite:0,NaN:0,Inf:0,peak:0,sumSquared:0,fullScaleSamples:0}));
  for(let i=0;i<buffer.length/4;i++){const x=buffer.readFloatLE(i*4),s=stats[i%channels];s.samples++;if(!Number.isFinite(x)){s.nonfinite++;Number.isNaN(x)?s.NaN++:s.Inf++;continue;}if(x!==0)s.nonzero++;if(x<0)s.negative++;const a=Math.abs(x);s.peak=Math.max(s.peak,a);s.sumSquared+=x*x;if(a>=1)s.fullScaleSamples++;}
  return{bytes:buffer.length,frames:buffer.length/4/channels,channels:stats.map(({sumSquared,...s})=>({...s,rms:Math.sqrt(sumSquared/Math.max(1,s.samples))})),units:'decoded normalized float32 sample amplitude; no intersample true-peak/SPL or listening claim'};
}
function pngInfo(label,still){
  let buffer,source;if(typeof still?.image==='string'&&still.image.startsWith('data:image/png;base64,')){buffer=Buffer.from(still.image.slice(still.image.indexOf(',')+1),'base64');source='report embedded actual PNG';}
  else{const candidate=[`pyro-r9-tail-${label}.png`,`pyro-r9-tail-motion-${label}.png`].map(name=>path.join(dir,name)).find(p=>fs.existsSync(p));if(!candidate)return{valid:false,reason:'No embedded or named actual PNG'};buffer=fs.readFileSync(candidate);source=path.relative(root,candidate);}
  const valid=buffer.length>32&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buffer.toString('ascii',12,16)==='IHDR';return{valid,source,bytes:buffer.length,SHA256:sha(buffer),width:valid?buffer.readUInt32BE(16):null,height:valid?buffer.readUInt32BE(20):null};
}
const report={schema:'glass-atoll.r9-adaptive-tail-media.v1',dateUTC:new Date().toISOString(),actualMediaDecode:true,checks,results,limits:['Technical acceptance of saved files and capture metadata only; no new subjective listening or continuous visual acceptance.','CFR30 export may duplicate/drop native captured frames; neither requested capture cadence nor encoded fps proves rendererFPS.','One documented real camera cut is part of this movie; no same-event legacy/adaptive pixel equivalence is claimed.','SDR video does not certify HDR display brightness. Audio sample peak is not intersample true peak or calibrated sound pressure.','Capture report is checked for internal clock/cleanup consistency; track-stop metadata does not independently observe a browser after cleanup.','The palm/fan smoke source remains an explicit QA candidate; no source, gain, exposure or runtime file is edited by this script.']};
try{
  for(const [name,file]of Object.entries({...tools,...files}))if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw Error('Required final artifact/tool missing: '+name+' '+file);
  const capture=JSON.parse(fs.readFileSync(files.report,'utf8').replace(/^\uFEFF/,'')),mp4Bytes=fs.readFileSync(files.mp4),webmBytes=fs.readFileSync(files.webm);
  results.sourceScriptSHA256=sha(fs.readFileSync(fileURLToPath(import.meta.url)));results.files=Object.fromEntries(Object.entries(files).map(([k,p])=>[k,{path:path.relative(root,p),bytes:fs.statSync(p).size,SHA256:sha(fs.readFileSync(p))}]));
  const v=probe(files.mp4),w=probe(files.webm);results.mp4=v;results.webm=w;const video=v.streams.filter(s=>s.codec_type==='video'),audio=v.streams.filter(s=>s.codec_type==='audio'),vs=video[0],as=audio[0],wv=w.streams.find(s=>s.codec_type==='video'),wa=w.streams.find(s=>s.codec_type==='audio');
  check('final MP4 H2641920x1080 yuv420p CFR30 with one AAC48k stereo track',video.length===1&&audio.length===1&&vs.codec_name==='h264'&&vs.width===1920&&vs.height===1080&&vs.pix_fmt==='yuv420p'&&vs.r_frame_rate==='30/1'&&vs.avg_frame_rate==='30/1'&&as.codec_name==='aac'&&as.sample_rate==='48000'&&as.channels===2,{video:vs,audio:as});
  const duration=number(v.format.duration),frames=number(vs.nb_read_frames),captureDuration=number(capture.durationSeconds),requested=number(capture.secondsRequested),videoDuration=number(vs.duration);
  check('actual duration and counted CFR frames match the16second capture within bounded encoding tolerance',requested===16&&duration!==null&&Math.abs(duration-16)<=.6&&captureDuration!==null&&Math.abs(duration-captureDuration)<=.6&&frames!==null&&frames>0&&videoDuration!==null&&Math.abs(frames/30-videoDuration)<=1/30+.002,{encodedSeconds:duration,captureWallSeconds:captureDuration,requestedSeconds:requested,countedFrames:frames,videoSeconds:videoDuration,toleranceSeconds:.6});
  check('retained native WebM is nonempty with actual1080p video and audio',webmBytes.length>1024&&wv?.width===1920&&wv.height===1080&&!!wa&&number(wv.nb_read_frames)>0&&capture.bytes===webmBytes.length,{nativeFormat:w.format,nativeVideo:wv,nativeAudio:wa,reportedBytes:capture.bytes,actualBytes:webmBytes.length});
  const top=atoms(mp4Bytes);results.mp4TopLevelAtoms=top;const moov=top.find(x=>x.type==='moov'),mdat=top.find(x=>x.type==='mdat');check('MP4 faststart has complete moov before media data',!!moov&&!!mdat&&moov.offset<mdat.offset,{moov,mdat});
  for(const kind of ['mp4','webm']){const d=decode(files[kind]);results[kind+'FullDecode']=d;check(kind+': complete video and audio decode exits cleanly',d.passed,d);}
  const pcm=run(tools.ffmpeg,['-hide_banner','-v','error','-nostdin','-xerror','-i',files.mp4,'-map','0:a:0','-vn','-acodec','pcm_f32le','-f','f32le','-'],{binary:true});
  if(pcm.status!==0||pcm.stderr.trim())throw Error('Decoded PCM extraction failed: '+pcm.stderr);results.audio=audioStats(pcm.stdout);
  check('decoded stereo audio is finite nonempty nonzero and sample peak at most1',results.audio.frames>=48000&&Number.isInteger(results.audio.frames)&&results.audio.channels.every(s=>s.nonfinite===0&&s.nonzero>0&&s.rms>0&&Number.isFinite(s.rms)&&s.peak<=1),results.audio);
  const cues=capture.cues||[],cutCues=cues.filter(c=>c.kind==='one-time-camera-cut'),launchCues=cues.filter(c=>c.kind==='launch'),cut=capture.cut,launch=capture.launch;
  check('one actual launch and one documented post-burst cut occur inside the clip',launch?.accepted===true&&launch.queued===false&&launchCues.length===1&&cutCues.length===1&&!!cut&&Number.isFinite(cut.wallSeconds)&&cut.wallSeconds>=0&&cut.wallSeconds<=duration+.1&&Number.isFinite(cut.actualBurstAge)&&cut.actualBurstAge>=.15-1e-7&&Math.abs(cut.time-launch.burstTime-cut.actualBurstAge)<1e-7&&launchCues[0].wallSeconds>=0&&launchCues[0].wallSeconds<=cut.wallSeconds,{launch,launchCues,cut,cuts:cutCues.length});
  const stills=Object.fromEntries(['hot','late','cold'].map(k=>[k,{...pngInfo(k,capture.stills?.[k]),time:capture.stills?.[k]?.time,burstAge:capture.stills?.[k]?.burstAge,wallSeconds:capture.stills?.[k]?.wallSeconds}]));results.stills=stills;
  check('hot late cold stills contain actual1080p PNGs at ordered physical phases',Object.entries(stills).every(([name,s])=>s.valid&&s.width===1920&&s.height===1080&&Number.isFinite(s.burstAge)&&s.burstAge>=({hot:1.1,late:3.3,cold:9}[name])-1e-7&&Number.isFinite(s.wallSeconds)&&s.wallSeconds>=0&&s.wallSeconds<=captureDuration+.1)&&stills.hot.time<stills.late.time&&stills.late.time<stills.cold.time,stills);
  const samples=capture.samples||[],finiteClocks=samples.every((s,i)=>Number.isFinite(s.time)&&Number.isFinite(s.wallSeconds)&&(!i||s.time>=samples[i-1].time&&s.wallSeconds>=samples[i-1].wallSeconds));
  check('capture records one default near-apex palmI1 with fixedC16.5 SDRlegacy and adaptive integration',capture.type==='palm'&&capture.seed===42&&capture.intensityScale===1&&capture.sourceProfile==='palm-fan-burn'&&capture.integration==='adaptive'&&capture.cameraEV===16.5&&capture.displayTransform==='legacy'&&capture.hdrMode==='sdr'&&capture.launchPhysics?.heightInfo?.inputMode==='definition-rise'&&!capture.launchPhysics?.heightInfo?.flightInfo&&samples.length>=16&&finiteClocks&&samples.every(s=>s.photometry?.C===16.5)&&String(capture.final?.tailIntegration?.effective).startsWith('adaptive'),{type:capture.type,seed:capture.seed,intensityScale:capture.intensityScale,sourceProfile:capture.sourceProfile,heightInfo:capture.launchPhysics?.heightInfo,sampleCount:samples.length,finiteMonotonicClocks:finiteClocks,finalIntegration:capture.final?.tailIntegration});
  const currentAudioSHA256=sha(fs.readFileSync(path.join(root,'fireworks-audio.js'))),before=capture.initial?.audio,after=capture.final?.audio;
  check('accepted audio module identity and recorded gain remained unchanged',currentAudioSHA256===expectedAudioSHA256&&capture.servedAudioSHA256===expectedAudioSHA256&&capture.audioGainUnchanged===true&&before?.relativeBurstGain===after?.relativeBurstGain&&before?.postCompressorHeadroomGain===after?.postCompressorHeadroomGain,{currentAudioSHA256,servedAudioSHA256:capture.servedAudioSHA256,expectedAudioSHA256,before:{relativeBurstGain:before?.relativeBurstGain,headroom:before?.postCompressorHeadroomGain},after:{relativeBurstGain:after?.relativeBurstGain,headroom:after?.postCompressorHeadroomGain}});
  check('capture cleanup reports restored source selection and stopped tracks',capture.restoration?.status==='restored'&&capture.restoration.tracksStopped===true&&capture.restoration.smokeParametersExact===true&&typeof capture.restoration.paused==='boolean',capture.restoration);
}catch(e){report.failure={message:String(e.message||e),stack:String(e.stack||'')};check('all final artifact checks can complete',false,report.failure);}
report.counts={passed:checks.filter(c=>c.passed).length,total:checks.length};report.passed=checks.every(c=>c.passed);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,output:path.relative(root,output),duration:results.mp4?.format?.duration,audio:results.audio,failed:checks.filter(c=>!c.passed).map(c=>({name:c.name,evidence:c.evidence}))},null,2));
if(!report.passed)process.exitCode=1;
