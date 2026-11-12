// QA ONLY: actual application's existing dynamic loop/timer queries. No renderer
// lock, own query, getExtension, getError, draw, context or independent rAF loop.
const active=new WeakSet(),MODES=['legacy8','adaptive'],TIME_ELAPSED_EXT=0x88bf;
const clone=v=>v===undefined?null:structuredClone(v),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stats=values=>{if(!values.length)return null;const s=[...values].sort((a,b)=>a-b),q=p=>s[Math.ceil(p*s.length)-1];return{n:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:q(.5),p95:q(.95),minimum:s[0],maximum:s.at(-1),percentile:'nearest-rank ceil(p*n)-1'};};
const fail=message=>{throw Error(message);};
const maxDelta=(a,b)=>Math.max(0,...a.map((v,i)=>Math.abs(v-b[i])));

/** Owner supplies the already-paused singlepalm seed42 nearview, exact burstTime,
 * fixed C/pose/quality/wind. Own the one-shot probe slot; do not hold qaRenderLock.
 * begin-tagging happens before the original begin operation. The end-frame probe
 * switches only the NEXT frame; it cannot relabel the in-flightquery.
 */
export async function runAdaptiveTailScenePerformance(a,{gl,seconds=8,burstTime,declaredSeed,drainMs=2000,minSamplesPerMode=30}={}){
 if(!gl||typeof gl.beginQuery!=='function'||typeof gl.getQueryParameter!=='function'||typeof gl.getError!=='function')fail('Pass the original live main WebGL2 context');
 if(!a||!['benchmark','pause','setFrameProbe','fireworks','photometry','setFireworksTrailIntegration'].every(k=>typeof a[k]==='function'))fail('Main public/privateQA API required');
 if(seconds!==8||!Number.isFinite(burstTime)||declaredSeed!==42||!Number.isFinite(drainMs)||drainMs<0||drainMs>2000||minSamplesPerMode!==30)fail('This bounded fixture requires8seconds, explicit finite burstTime, declaredSeed42, drain0..2000 and minimum30samples per mode');
 if(active.has(gl))fail('An adaptive-tail sceneobserver already owns this context');
 const initial=a.state,fw=a.fireworks(),photo=a.photometry();
 if(!initial.parameters.paused||initial.graphicsContextInterrupted)fail('Use an already-paused uninterrupted scene');
 if(fw.active!==1||fw.queued!==0||fw.activeEvents?.length!==1||fw.activeEvents[0].type!=='palm'||fw.settings?.autoLaunch)fail('Prepare exactlyone activepalm, no queue or autolaunch');
 if(initial.time<burstTime||initial.time-burstTime>.5)fail('Start near burst+.1; exact supplied phase must be0..0.5s');
 const savedMode=fw.tailIntegration?.requested||'legacy8';if(!MODES.includes(savedMode))fail('Unknown original tail mode');
 const originals={beginQuery:gl.beginQuery,getQueryParameter:gl.getQueryParameter},descriptors=Object.fromEntries(Object.keys(originals).map(k=>[k,Object.getOwnPropertyDescriptor(gl,k)]));
 const report={schema:'glass-atoll.adaptive-tail-dynamic-scene-interleaved-performance.v1',dateUTC:new Date().toISOString(),status:'preparing',valid:false,actualScene:true,notExactPairedAB:true,seconds,burstTime,declaredSeed,seedVerification:'Owner-declared; currentactiveEvents has no seed field',setup:{state:clone(initial),event:clone(fw.activeEvents[0]),fireworks:clone(fw),photometry:{C:photo.cameraEV,P:photo.storageEV,outputExposureScale:photo.outputExposureScale}},frames:[],querySamples:[],invalidQueries:[],modeStatistics:{},restoration:{},issues:[],overhead:{setupMs:0,probeCalls:0,probeWallMs:0,switchCalls:0,switchWallMs:0,probeWindowWallMs:0,probeDrainWallMs:0,finalRestoreMs:0,wrapperCalls:0,originalGLCallWallMs:0,wrapperTotalWallMs:0,statsWallMs:0},limits:[
  'One actual8second evolvingpalm with alternatingframe modes; consecutiveframes have different physicalphase. Not an exact same-time pairedA/B.',
  'Per-mode GPU samples are the existing mainloop whole-frameTIME_ELAPSED queries, not isolatedtail shader cost or two independently benchmarked FPS values.',
  'OverallFPS includes these observer/state/mode-switch CPU costs. GPU interval can include submission bubbles induced by CPUwork before endQuery. Setup/stat/drain are outside the8second window.',
  'No new query/getExtension/getError or manualquerypoll is issued. Original beginQuery/getQueryParameter operations execute exactlyonce; noGL error flag draining/hiding.',
  'Tail sampling counts/fallbacks are CPU projectedestimates, sampled on adjacentframes every31frames, not GPU instructioncounts.',
  'Results only cover currentdevice/quality/view/phasewindow. Missingpending or nonfinite samples invalidate completeness; they are never filled with0.',
  'Original mode is restored withresetHistory:true and scene leftpaused; physicaltime/events are not rewound.']};
 const start=performance.now(),labels=new WeakMap(),pending=new Set(),rows=new Map();
 let currentMode='legacy8',measuring=false,probeOwned=false,patched=false,finished=false,frameNumber=0,windowQueries=0,querySerial=0,foreignResults=0,contextLost=false,benchmark=null,hardTimer=null,interruptedResolve;
 const interruption=new Promise(r=>{interruptedResolve=r;}),issue=message=>{if(!report.issues.includes(message))report.issues.push(message);};
 function beginQuery(...args){const t=performance.now(),modeAtBegin=currentMode,frameAtBegin=frameNumber+1;let result;try{result=Reflect.apply(originals.beginQuery,this,args);}finally{report.overhead.originalGLCallWallMs+=performance.now()-t;}
  if(this===gl&&measuring&&args[0]===TIME_ELAPSED_EXT){const query=args[1];windowQueries++;if(query&&(typeof query==='object'||typeof query==='function')){const label={id:++querySerial,mode:modeAtBegin,frame:frameAtBegin,beginWallMs:performance.now()-start,returned:false};labels.set(query,label);pending.add(query);}else{issue('Mainloop submitted a null/nonobject query');report.invalidQueries.push({mode:modeAtBegin,frame:frameAtBegin,reason:'null-query'});}}
  report.overhead.wrapperCalls++;report.overhead.wrapperTotalWallMs+=performance.now()-t;return result;
 }
 function getQueryParameter(...args){const t=performance.now();let result;try{result=Reflect.apply(originals.getQueryParameter,this,args);}finally{report.overhead.originalGLCallWallMs+=performance.now()-t;}
  if(this===gl){const label=args[0]&&labels.get(args[0]);if(args[1]===gl.QUERY_RESULT){if(label&&!label.returned){label.returned=true;pending.delete(args[0]);if(typeof result==='number'&&Number.isFinite(result)&&result>0)report.querySamples.push({...label,elapsedNanoseconds:result,gpuMs:result/1e6,returnWallMs:performance.now()-start});else{issue('Mainloop returned a nonfinite/null/nonpositive elapsedresult');report.invalidQueries.push({...label,reason:'invalid-elapsed-result',value:Number.isFinite(result)?result:String(result)});}}else if(!label&&measuring)foreignResults++;}
   else if(args[1]===gl.QUERY_RESULT_AVAILABLE&&result===null){issue('Mainloop queryavailability returned null (invalidquery/context suspected)');report.invalidQueries.push({id:label?.id??null,mode:label?.mode??null,frame:label?.frame??null,reason:'availability-null'});}}
  report.overhead.wrapperCalls++;report.overhead.wrapperTotalWallMs+=performance.now()-t;return result;
 }
 function setMode(mode,resetHistory=false){const t=performance.now();a.setFireworksTrailIntegration(mode,{resetHistory});currentMode=mode;report.overhead.switchCalls++;report.overhead.switchWallMs+=performance.now()-t;}
 function probe(timestamp){probeOwned=false;if(finished)return;const t=performance.now(),inWindow=measuring;try{
  if(measuring){if(frameNumber>=4096){issue('Frame metadata cap4096 reached');interruptedResolve('frame-cap');return;}const s=a.state,p=a.photometry(),row={frame:++frameNumber,frameStart:timestamp,wallMs:performance.now()-start,mode:currentMode,physicalTime:s.time,sourcePhase:s.time-burstTime,camera:[...s.camera],target:[...s.target],C:p.cameraEV,P:p.storageEV,outputExposureScale:p.outputExposureScale,renderScale:s.renderScale,width:s.lens.width,height:s.lens.height,temporal:{historyFrames:s.lens.temporal?.historyFrames,lastResetReason:s.lens.temporal?.lastResetReason}};
   if((frameNumber-1)%31<2){const f=a.fireworks();row.source={active:f.active,queued:f.queued,records:f.records,events:clone(f.activeEvents),tailPolicy:clone(f.tailIntegration),lastRender:clone(f.lastRender)};}
   report.frames.push(row);rows.set(frameNumber,row);if(s.graphicsContextInterrupted){contextLost=true;issue('Main graphicscontext interrupted');interruptedResolve('context-interrupted');return;}
   setMode(currentMode==='legacy8'?'adaptive':'legacy8',false);
  }
 }catch(error){issue('Frameprobe failed: '+String(error?.message||error));interruptedResolve('probe-failed');}
 finally{const elapsed=performance.now()-t;report.overhead.probeCalls++;report.overhead.probeWallMs+=elapsed;report.overhead[inWindow?'probeWindowWallMs':'probeDrainWallMs']+=elapsed;if(!finished){try{probeOwned=true;a.setFrameProbe(probe);}catch(error){probeOwned=false;issue('Probe re-registration failed: '+String(error));interruptedResolve('probe-registration-failed');}}}}
 function lost(){contextLost=true;issue('webglcontextlost event observed');interruptedResolve('context-lost');}
 active.add(gl);
 try{
  patched=true;for(const [name,fn]of Object.entries({beginQuery,getQueryParameter})){Object.defineProperty(gl,name,{value:fn,writable:true,configurable:true,enumerable:descriptors[name]?.enumerable??false});}
  gl.canvas?.addEventListener('webglcontextlost',lost);const before=a.state.lens.temporal?.historyFrames;setMode('legacy8',false);const after=a.state.lens.temporal?.historyFrames;
  if(Number.isFinite(before)&&Number.isFinite(after)&&after<before)fail('resetHistory:false hook unexpectedly reset existinghistory');
  probeOwned=true;a.setFrameProbe(probe);report.overhead.setupMs=performance.now()-start;report.status='measuring';measuring=true;a.pause(false);
  const measured=a.benchmark(seconds);hardTimer=setTimeout(()=>interruptedResolve('benchmark-deadline'),seconds*1000+4000);
  const result=await Promise.race([measured.then(value=>({kind:'benchmark',value})),interruption.then(reason=>({kind:'interrupted',reason}))]);
  measuring=false;a.pause(true);if(result.kind==='benchmark'){benchmark=result.value;report.benchmark=benchmark;if(benchmark.status!=='completed'||benchmark.validity!=='valid')issue('Main benchmark was cancelled/invalid');}else issue('Measurement interrupted: '+result.reason);
  const drainStart=performance.now(),until=drainStart+drainMs;while(pending.size&&performance.now()<until&&!contextLost)await sleep(10);report.drain={milliseconds:performance.now()-drainStart,maximumMs:drainMs,unreturned:[...pending].map(query=>({...labels.get(query)}))};
  if(pending.size)issue('Some tagged mainquery results were not returned during bounded drain');if(!windowQueries)issue('No mainloopTIME_ELAPSED query was observed');
 }catch(error){issue(String(error?.stack||error));report.failure=String(error?.message||error);}
 finally{
  measuring=false;finished=true;if(hardTimer!==null)clearTimeout(hardTimer);try{a.setFrameProbe(null);probeOwned=false;report.restoration.probeCleared=true;}catch(error){issue('Probe cleanup failed: '+String(error));}
  try{a.pause(true);report.restoration.leftPaused=a.state.parameters.paused===true;}catch(error){issue('Pause cleanup failed: '+String(error));}
  const restoreStarted=performance.now();
  try{if(contextLost||a.state.graphicsContextInterrupted){report.restoration.modeRestoreSkipped='context-lost-reload-required';issue('Mode/history GL reset skipped after contextloss; reloadrequired');}else{setMode(savedMode,true);report.restoration.mode=savedMode;report.restoration.resetHistory=true;report.restoration.actualMode=a.fireworks().tailIntegration?.requested||'legacy8';if(report.restoration.actualMode!==savedMode)issue('Original mode was not restored');}}catch(error){issue('Mode restore failed: '+String(error));}
  if(patched)for(const name of Object.keys(originals))try{if(descriptors[name])Object.defineProperty(gl,name,descriptors[name]);else delete gl[name];}catch(error){issue('Method descriptor restore failed: '+name+' '+String(error));}
  gl.canvas?.removeEventListener('webglcontextlost',lost);report.restoration.methodsRestored=Object.keys(originals).every(name=>gl[name]===originals[name]);if(!report.restoration.methodsRestored)issue('Original GL methods were not restored');active.delete(gl);report.overhead.finalRestoreMs=performance.now()-restoreStarted;
 }
 const statsStart=performance.now();
 for(const sample of report.querySamples){const frame=rows.get(sample.frame);if(frame){sample.physicalTime=frame.physicalTime;sample.sourcePhase=frame.sourcePhase;sample.C=frame.C;sample.P=frame.P;sample.renderScale=frame.renderScale;if(frame.mode!==sample.mode)issue('Beginquery mode tag disagrees with the actual endframe renderedmode');}else issue('Tagged query has no measuredframe metadata');}
 for(const mode of MODES){const q=report.querySamples.filter(x=>x.mode===mode);report.modeStatistics[mode]={validWholeFrameGPU:stats(q.map(x=>x.gpuMs)),queryCount:q.length,minimumRequired:minSamplesPerMode,phaseRange:q.length?[Math.min(...q.map(x=>x.sourcePhase)),Math.max(...q.map(x=>x.sourcePhase))]:null};if(q.length<minSamplesPerMode)issue(mode+' has fewer than30 finite returnedsamples');}
 const f=report.frames;report.observed={begun:windowQueries,returnedFinite:report.querySamples.length,foreignResultReads:foreignResults,frameCount:f.length,contextLost,metadataEvery31AdjacentFrames:true};
 if(f.some(x=>!Number.isFinite(x.C)||!Number.isFinite(x.P)))issue('Nonfinite C/P metadata');
 if(f.some(x=>Math.abs(x.C-photo.cameraEV)>1e-8))issue('Actual camera exposureC changed during comparison');
 if(f.some(x=>maxDelta(x.camera,initial.camera)>1e-8||maxDelta(x.target,initial.target)>1e-8))issue('Camera/target moved during comparison');
 if(f.some(x=>x.renderScale!==initial.renderScale||x.width!==initial.lens.width||x.height!==initial.lens.height))issue('Resolution/quality changed during comparison');
 report.overhead.wrapperMetadataEstimateMs=Math.max(0,report.overhead.wrapperTotalWallMs-report.overhead.originalGLCallWallMs);report.overhead.statsWallMs=performance.now()-statsStart;report.overhead.timerResolutionCaution='performance.now may be quantized; these small CPU subdivisions are estimates, not independent compute cost.';
 report.valid=report.issues.length===0&&benchmark?.status==='completed'&&benchmark?.validity==='valid'&&report.restoration.leftPaused&&report.restoration.methodsRestored;report.status=report.valid?'completed-interleaved-dynamic-sampling':'invalid';return report;
}
