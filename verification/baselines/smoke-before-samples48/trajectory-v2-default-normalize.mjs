// QA ONLY: exact optional V2 edits, never runtime normalization.
export const trajectoryV2AdapterEdits=Object.freeze([
  [
    "pure source-moment import",
    "import {createPyroSmokeEventPackets} from './pyro-smoke-events.js';\nimport {SMOKE_SOURCE_TRANSPORT,createSourceWindHistory,appendSourceWindHistory,pastSegmentSourceMoments} from './pyro-smoke-source-moments.js';",
    "import {createPyroSmokeEventPackets} from './pyro-smoke-events.js';"
  ],
  [
    "kernel/fraction recipe parameters",
    "function makeEntry(d,serial,areas,centralFraction,kernelModel){",
    "function makeEntry(d,serial,areas){"
  ],
  [
    "independent central source fraction",
    "const central=areas.burstArea*centralFraction,",
    "const central=areas.burstArea*.2,"
  ],
  [
    "bounded causal source cell clocks",
    "mass,{bodyId:r.bodyId,...(kernelModel==='past-segment-v2'?{segmentStart:r.birth+(r.age===.35?.05:.35),segmentEnd:r.birth+r.age}:{})});",
    "mass,{bodyId:r.bodyId});"
  ],
  [
    "optional kernel factory arguments",
    "maxRememberedEvents=2048,kernelModel='point',centralFraction=.20,transport=SMOKE_SOURCE_TRANSPORT}={}){",
    "maxRememberedEvents=2048}={}){"
  ],
  [
    "kernel validation before source state reads",
    "  if(kernelModel!=='point'&&kernelModel!=='past-segment-v2')throw new RangeError('kernelModel must be point or past-segment-v2');if(!Number.isFinite(centralFraction)||centralFraction<=0||centralFraction>=1)throw new RangeError('centralFraction must be finite strictly between0 and1');\n  stateInfo(state);if(!sourceProvider",
    "  stateInfo(state);if(!sourceProvider"
  ],
  [
    "causal wind history value",
    "  let sourceWindHistory=kernelModel==='past-segment-v2'?createSourceWindHistory({time:stateInfo(state).time,wind:state.snapshot().currentWind}):null;\n  const prepared=new WeakMap(),recent=[];",
    "  const prepared=new WeakMap(),recent=[];"
  ],
  [
    "physical wind input at prepare",
    "function prepare(events,{throughTime,windVector}={}){",
    "function prepare(events,{throughTime}={}){"
  ],
  [
    "recipe option forwarding",
    "entry=makeEntry(d,serial++,areas,centralFraction,kernelModel);",
    "entry=makeEntry(d,serial++,areas);"
  ],
  [
    "transactional causal wind before due sampling",
    "    let preparedWind=sourceWindHistory;if(kernelModel==='past-segment-v2'){let retainFrom=throughTime-.30;for(const entry of proposed.values())for(let i=entry.next;i<entry.plans.length;i++){const start=entry.plans[i].segmentStart;if(start!==undefined)retainFrom=Math.min(retainFrom,start);}preparedWind=appendSourceWindHistory(sourceWindHistory,{time:throughTime,windVector,retainFrom,maxSamples:1024});}\n    const ready=[];",
    "    const ready=[];"
  ],
  [
    "aged segment moments or unchanged point kernel",
    "let position,covariance,temperatureExcessK=12,buoyantVelocity=.35,kernelDiagnostics=null;if(p.component==='root'){if(kernelModel==='past-segment-v2'){const moments=pastSegmentSourceMoments({start:p.segmentStart,end:p.segmentEnd,mass:p.mass,samplePosition:time=>sourceProvider.sample(p.eventId,{kind:'root',time,bodyId:p.bodyId}).position,windHistory:preparedWind,sigmaPerp:.30,transport});position=vec(moments.mean,'aged trajectory segment mean');covariance=moments.covariance;temperatureExcessK=moments.temperatureExcessK;buoyantVelocity=moments.buoyantVelocity;kernelDiagnostics={...moments.diagnostics,birthCovariance:[...covariance]};}else{position=vec(sourceProvider.sample(p.eventId,{kind:'root',time:p.time,bodyId:p.bodyId}).position,'trajectory point');covariance=[1.6**2,0,0,0,1.1**2,0,0,0,1.6**2];}}",
    "let position,covariance,temperatureExcessK=12,buoyantVelocity=.35;if(p.component==='root'){position=vec(sourceProvider.sample(p.eventId,{kind:'root',time:p.time,bodyId:p.bodyId}).position,'trajectory point');covariance=[1.6**2,0,0,0,1.1**2,0,0,0,1.6**2];}"
  ],
  [
    "segment diagnostics only on new kernels",
    "temperatureExcessK,buoyantVelocity,...(kernelDiagnostics?{kernelDiagnostics}: {})});});",
    "temperatureExcessK,buoyantVelocity});});"
  ],
  [
    "wind included in prepared transaction",
    "throughTime,preparedWind,proposed,newSeen,",
    "throughTime,proposed,newSeen,"
  ],
  [
    "install wind only with committed batch",
    "function install(tx,accepted,partial){sourceWindHistory=tx.preparedWind;const map=",
    "function install(tx,accepted,partial){const map="
  ],
  [
    "new kernel recent metadata",
    "mass:e.mass,position:[...e.mean],...(e.kernelDiagnostics?{kernel:{...e.kernelDiagnostics,birthCovariance:[...e.kernelDiagnostics.birthCovariance],window:[...e.kernelDiagnostics.window]}}:{})});",
    "mass:e.mass,position:[...e.mean]});"
  ],
  [
    "clear resets causal wind origin",
    "boundState=nextState;if(kernelModel==='past-segment-v2')sourceWindHistory=createSourceWindHistory({time,wind:nextState.snapshot().currentWind});nextEmissionId=",
    "boundState=nextState;nextEmissionId="
  ],
  [
    "nondefault kernel diagnostics",
    "sourceModel:'trajectory-v1',...(kernelModel==='point'&&centralFraction===.20?{}:{kernelModel,centralFraction,windHistory:sourceWindHistory?{samples:sourceWindHistory.samples.length,oldestTime:sourceWindHistory.samples[0].time,throughTime:sourceWindHistory.throughTime,maxSamples:1024}:null}),revision,",
    "sourceModel:'trajectory-v1',revision,"
  ],
  [
    "configured parameter diagnostics",
    "parameters:{...areas,centralFraction,...(kernelModel==='past-segment-v2'?{kernelModel,sigmaPerp:.30,segmentWindows:[[.05,.35],[.35,.65]],futureCovarianceCrossTermsDiscarded:true}:{}),",
    "parameters:{...areas,centralFraction:.2,"
  ],
  [
    "release wind buffer on disposal",
    "entries.clear();seen.clear();tombstones.clear();sourceWindHistory=null;disposed=true;",
    "entries.clear();seen.clear();tombstones.clear();disposed=true;"
  ]
].map(e=>Object.freeze(e)));
export function normalizeTrajectoryV2AdapterSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of trajectoryV2AdapterEdits){const count=result.split(from).length-1;if(count!==1)throw new Error('V2 adapter scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}

export const trajectoryV2HostEdits=Object.freeze([
  [
    "shared native transport defaults import",
    "import {createPyroSmokeTrajectoryEvents} from './pyro-smoke-trajectory-events.js';\nimport {SMOKE_SOURCE_TRANSPORT} from './pyro-smoke-source-moments.js';",
    "import {createPyroSmokeTrajectoryEvents} from './pyro-smoke-trajectory-events.js';"
  ],
  [
    "optional kernel fraction host options",
    "sourceModel='legacy9',sourceProvider=null,kernelModel='point',centralFraction=.20}={}){",
    "sourceModel='legacy9',sourceProvider=null}={}){"
  ],
  [
    "legacy cannot falsely enable new source controls",
    "  if(sourceModel==='legacy9'&&(kernelModel!=='point'||centralFraction!==.20))throw new RangeError('Source kernel controls require trajectory-v1; legacy9 remains unchanged');\n  const sourceStateOptions=sourceModel==='trajectory-v1'?{maxPendingEmissions:8192,...(kernelModel==='past-segment-v2'?{diffusivity:SMOKE_SOURCE_TRANSPORT.diffusivity,coolSeconds:SMOKE_SOURCE_TRANSPORT.coolSeconds,dragSeconds:SMOKE_SOURCE_TRANSPORT.dragSeconds,ambientKelvin:SMOKE_SOURCE_TRANSPORT.ambientKelvin}: {})}:{};",
    "  const sourceStateOptions=sourceModel==='trajectory-v1'?{maxPendingEmissions:8192}:{};"
  ],
  [
    "explicit same native transport source contract",
    "createPyroSmokeTrajectoryEvents({state,sourceProvider,queueCapacity:8192,kernelModel,centralFraction,transport:SMOKE_SOURCE_TRANSPORT}),",
    "createPyroSmokeTrajectoryEvents({state,sourceProvider,queueCapacity:8192}),"
  ],
  [
    "same timestamp native wind reaches source preflight",
    "events.prepare(sourceEvents,{throughTime:now,windVector});",
    "events.prepare(sourceEvents,{throughTime:now});"
  ]
].map(e=>Object.freeze(e)));
export function normalizeTrajectoryV2HostSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of trajectoryV2HostEdits){const count=result.split(from).length-1;if(count!==1)throw new Error('V2 host scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}
