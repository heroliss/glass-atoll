// Protocol-only fake mainloop. No browser/GPU or production performance claim.
import {runAdaptiveTailScenePerformance} from './adaptive-tail-scene-performance.js';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const checks=[],check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,...evidence});
async function run(kind='normal'){
 let paused=true,mode='legacy8',probe=null,time=10.1,frames=0,run=false,resolveBenchmark,poll=[],tickCount=0,interrupted=false;
 const counts={begin:0,result:0,available:0,getError:0,newQuery:0,end:0,setterFalse:0,setterTrue:0},canvas=new EventTarget(),originalQueries=[];
 const gl={canvas,QUERY_RESULT:34918,QUERY_RESULT_AVAILABLE:34919,getError(){counts.getError++;return 0;},beginQuery(_target,q){counts.begin++;q.actualMode=mode;q.readyAfter=tickCount+2;originalQueries.push(q);},getQueryParameter(q,key){if(key===34919){counts.available++;return tickCount>=q.readyAfter;}counts.result++;return kind==='null-result'?null:q.actualMode==='legacy8'?1e6:2e6;},endQuery(){counts.end++;}};
 const before={begin:gl.beginQuery,get:gl.getQueryParameter},settings={paused:true};
 const a={get state(){return{time,parameters:{paused},graphicsContextInterrupted:interrupted,renderScale:1,camera:[1,2,3],target:[0,0,0],lens:{width:640,height:360,temporal:{historyFrames:24,lastResetReason:'unchanged'}}};},fireworks(){return{active:1,queued:0,records:1000,settings:{autoLaunch:false},activeEvents:[{id:'test-event',type:'palm',intensityScale:1}],tailIntegration:{requested:mode,estimates:mode==='adaptive'?{tails:900,adaptive:900,legacyFallback:0}:undefined}};},photometry(){return{cameraEV:16.5,storageEV:12,outputExposureScale:1};},pause(v){paused=!!v;},setFrameProbe(value){probe=value;},setFireworksTrailIntegration(next,{resetHistory=true}={}){mode=next;counts[resetHistory?'setterTrue':'setterFalse']++;},benchmark(){run=true;const p=new Promise(r=>{resolveBenchmark=r;});setImmediate(tick);return p;}};
 function finishBenchmark(status='completed'){run=false;resolveBenchmark({status,validity:status==='completed'?'valid':'invalid',elapsedSeconds:8,averageFps:17.5,frames,raw:{frameIntervals:Array(frames).fill(8*1000/140)}});}
 function tick(){tickCount++;
  if(poll.length&&gl.getQueryParameter(poll[0],34919)){gl.getQueryParameter(poll[0],34918);poll.shift();}
  if(!paused&&run){let q;if(kind!=='no-query'){q={};gl.beginQuery(0x88bf,q);}frames++;time=10.1+frames*8/140;const cb=probe;probe=null;cb?.(performance.now());if(q){gl.endQuery(0x88bf);poll.push(q);}if(kind==='lost'&&frames===10){interrupted=true;canvas.dispatchEvent(new Event('webglcontextlost'));finishBenchmark('cancelled');}else if(frames===140)finishBenchmark();}
  else{const cb=probe;probe=null;cb?.(performance.now());}
  if(run||poll.length)setImmediate(tick);
 }
 const report=await runAdaptiveTailScenePerformance(a,{gl,seconds:8,burstTime:10,declaredSeed:42,drainMs:250});
 return{report,counts,restored:gl.beginQuery===before.begin&&gl.getQueryParameter===before.get,paused,probe,mode};
}
const good=await run();check('beginmode remains correct although probe changesmode before end',good.report.valid&&good.report.modeStatistics.legacy8.validWholeFrameGPU.mean===1&&good.report.modeStatistics.adaptive.validWholeFrameGPU.mean===2,{modes:good.report.modeStatistics});
check('minimum30permodes and all actual returned samples retained',good.report.querySamples.length===140&&good.report.modeStatistics.legacy8.queryCount===70&&good.report.modeStatistics.adaptive.queryCount===70&&good.report.drain.unreturned.length===0);
check('original ops exactlyonce no ownquery/getError',good.counts.begin===140&&good.counts.result===140&&good.counts.getError===0&&good.counts.newQuery===0,{counts:good.counts});
check('normalcleanup restores mode/history/methods andpause',good.restored&&good.paused&&good.probe===null&&good.mode==='legacy8'&&good.counts.setterTrue===1);
const missing=await run('no-query');check('noquery is invalid not syntheticzeroGPU',!missing.report.valid&&missing.report.querySamples.length===0&&missing.report.modeStatistics.legacy8.validWholeFrameGPU===null&&missing.report.issues.some(x=>x.includes('No mainloopTIME')));
const bad=await run('null-result');check('nonfinite/null results are invalid never counted as0ms',!bad.report.valid&&bad.report.querySamples.length===0&&bad.report.invalidQueries.length===140);
const lost=await run('lost');check('contextloss invalidates and skips unsafehistoryGLreset',!lost.report.valid&&lost.report.observed.contextLost&&lost.report.restoration.modeRestoreSkipped==='context-lost-reload-required'&&lost.restored&&lost.paused&&lost.counts.setterTrue===0);
const source=await readFile(new URL('./adaptive-tail-scene-performance.js',import.meta.url));const report={schema:'glass-atoll.adaptive-tail-interleave-protocol-check.v1',dateUTC:new Date().toISOString(),actualGPU:false,actualScene:false,sourceSHA256:createHash('sha256').update(source).digest('hex'),checks,limits:['Fake one-shot mainloop tests only querylabel/timing/cleanup protocol. No browser/GPU/FPS evidence.','Production scene performance must be run by owner with real8s benchmark and realpreparedpalm.']};report.counts={passed:checks.filter(c=>c.passed).length,total:checks.length};report.passed=checks.every(c=>c.passed);await writeFile(new URL('./adaptive-tail-scene-performance-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));process.exitCode=report.passed?0:1;
