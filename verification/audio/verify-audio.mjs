import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {crossfadeLoopPCM,proceduralSplashPCM,audioPCMStats,encodeAudioWav} from '../../audio.js';

const directory=new URL('./',import.meta.url),sampleRate=48000;
function decodeRaw(bytes,count){
  const length=Math.floor(bytes.length/(count*4)),channels=Array.from({length:count},()=>new Float32Array(length));
  for(let i=0;i<length;i++)for(let ch=0;ch<count;ch++)channels[ch][i]=bytes.readFloatLE((i*count+ch)*4);
  return channels;
}
const report={kind:'PCM/loop technical verification; not a subjective listening assessment',checks:[],files:{}};
for(const [key,count,fade] of [['ocean',2,1.7],['leaves',1,1.2]]){
  const raw=decodeRaw(await readFile(new URL(`${key}-source.f32`,directory)),count);
  const loop=crossfadeLoopPCM(raw,sampleRate,fade),stats=audioPCMStats(loop);
  let largestOrdinaryDifference=0,expectedBoundaryDifference=0;
  for(let ch=0;ch<count;ch++){
    for(let i=1;i<loop.channels[ch].length;i++)largestOrdinaryDifference=Math.max(largestOrdinaryDifference,Math.abs(loop.channels[ch][i]-loop.channels[ch][i-1]));
    const period=loop.channels[ch].length;
    expectedBoundaryDifference=Math.max(expectedBoundaryDifference,Math.abs(raw[ch][period]-raw[ch][period-1]));
  }
  const seamMatchesContiguousSource=Math.abs(stats.seamDifference-expectedBoundaryDifference)<1e-7;
  report.files[key]={inputDuration:raw[0].length/sampleRate,loopDuration:loop.duration,crossfadeSeconds:fade,...stats,largestOrdinaryDifference,expectedBoundaryDifference,seamMatchesContiguousSource};
  report.checks.push({name:`${key}: no nonfinite or clipping`,passed:stats.nonFinite===0&&stats.peak<1});
  report.checks.push({name:`${key}: loop junction equals a contiguous source-sample step`,passed:seamMatchesContiguousSource&&stats.seamDifference<=largestOrdinaryDifference});
  await writeFile(new URL(`${key}-loop-preview.wav`,directory),encodeAudioWav(loop));
}
const splash=proceduralSplashPCM(sampleRate,7219),splashStats=audioPCMStats(splash);
report.files.splash={...splashStats,duration:splash.duration};
report.checks.push({name:'procedural splash finite, unclipped, zero endpoints',passed:splashStats.nonFinite===0&&splashStats.peak<1&&Math.abs(splash.channels[0][0])<1e-7&&Math.abs(splash.channels[0].at(-1))<1e-7});
await writeFile(new URL('procedural-splash-preview.wav',directory),encodeAudioWav(splash));
report.passed=report.checks.every(c=>c.passed);
await writeFile(new URL('pcm-qa.json',directory),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:report.checks,files:report.files,report:fileURLToPath(new URL('pcm-qa.json',directory))},null,2));
if(!report.passed)process.exitCode=1;
