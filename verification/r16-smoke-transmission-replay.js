// Detached CPU diagnostic. It never advances a host, issues GL work, or changes
// a production BVH. Capture all arguments in one paused frame before calling.
import {createPyroSmokeColumns} from '../pyro-smoke-columns.js';

const clock=()=>globalThis.performance?.now?.()??Date.now();
const yieldTurn=()=>new Promise(resolve=>typeof requestAnimationFrame==='function'?requestAnimationFrame(resolve):setTimeout(resolve,0));
function vector(v,name){if(!v||v.length!==3||Array.from(v).some(x=>!Number.isFinite(x)))throw new TypeError(name+' requires three finite coordinates');return Array.from(v);}
function delta(a,b){const r={};for(const key of ['rays','zeroLengthRays','visitedNodes','bboxTests','kernelsEvaluated','omittedPackets','skippedNodes','zeroExtinctionPackets','totalQueryMs'])r[key]=b[key]-a[key];return r;}
function median(values){const x=[...values].sort((a,b)=>a-b);return x.length?x[Math.floor(x.length/2)]:null;}
function hashNumbers(values){const storage=new ArrayBuffer(8),view=new DataView(storage);let h=2166136261;for(const x of values){view.setFloat64(0,x,true);for(let i=0;i<8;i++)h=Math.imul(h^view.getUint8(i),16777619)>>>0;}return h.toString(16).padStart(8,'0');}
function hashText(value){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;return h.toString(16).padStart(8,'0');}

export async function runSmokeTransmissionReplay({snapshot,sources,origin,reflectionOrigin=null,planeY=0,sampleLimit=256,repetitions=3,maxPassMs=45,columnKernel='scalar'}={}){
  if(!snapshot||!Array.isArray(snapshot.packets)||snapshot.packets.length>128)throw new RangeError('Frozen snapshot requires at most128 packets; this helper is not a stress test');
  if(!Array.isArray(sources)||sources.length>14000)throw new RangeError('Complete frozen framing-source array requires at most14000 records');
  if(!Number.isInteger(sampleLimit)||sampleLimit<1||sampleLimit>1024||!Number.isInteger(repetitions)||repetitions<1||repetitions>3||!Number.isFinite(maxPassMs)||maxPassMs<5||maxPassMs>60||!Number.isFinite(planeY))throw new RangeError('Bounded sample1..1024, reps1..3, maxPassMs5..60 required');
  const eye=vector(origin,'origin'),mirror=reflectionOrigin===null?null:vector(reflectionOrigin,'reflectionOrigin'),frozen=structuredClone(snapshot),positions=sources.map((s,i)=>vector(s.position??s,'sources['+i+']')),count=Math.min(sampleLimit,positions.length),indices=Array.from({length:count},(_,i)=>Math.floor((i+.5)*positions.length/count)),rays=[],selection=[];
  for(const index of indices){const endpoint=positions[index];rays.push({from:eye,to:endpoint,pass:'main',index});selection.push(index,...endpoint);if(mirror){const t=(planeY-mirror[1])/(endpoint[1]-mirror[1]);if(Number.isFinite(t)&&t>=0&&t<=1)rays.push({from:mirror.map((v,c)=>v+(endpoint[c]-v)*t),to:endpoint,pass:'reflection',index});}}
  const pairUpperBound=rays.length*frozen.packets.length;if(pairUpperBound>262144)throw new RangeError('Selected replay exceeds262144 worst-case packet/ray pairs');
  const report={schema:'glass-atoll.r16-smoke-transmission-replay.v1',dateUTC:new Date().toISOString(),actualCPU:true,actualGPU:false,columnKernel,sourceRevision:frozen.revision,sourceTime:frozen.time??null,packets:frozen.packets.length,completeSourceRecords:positions.length,selectedSourceRecords:count,selection:'Deterministic evenly stratified source-list indices; complete list is never modified',selectionHash:hashNumbers(selection),snapshotHash:hashText(JSON.stringify(frozen)),hashPurpose:'Non-cryptographic reproducibility identifiers only',origin:eye,reflectionOrigin:mirror,planeY,selectedRays:rays.length,worstCasePacketRayPairs:pairUpperBound,checks:[],measurements:[]};
  const start=clock(),columns=createPyroSmokeColumns(frozen,{columnKernel});report.coldBuildWallMs=clock()-start;report.coldBuild=columns.diagnostics();
  const scratch=new Float64Array(3);let maxDifference=0,finite=true,checksum=0;
  // Compare the current fast route against the owned-result public route using
  // identical frozen columns; no changed density, omission budget or ray path.
  const oracleCount=Math.min(32,rays.length);
  for(let i=0;i<oracleCount;i++){const ray=rays[Math.floor((i+.5)*rays.length/oracleCount)],expected=columns.between(ray.from,ray.to).T;columns.writeTransmissionBetween(ray.from,ray.to,scratch);for(let c=0;c<3;c++){finite&&=Number.isFinite(scratch[c]);maxDifference=Math.max(maxDifference,Math.abs(scratch[c]-expected[c]));}}
  report.checks.push({name:'detached fast route matches current public binary64 columns',passed:finite&&maxDifference===0,comparedRays:oracleCount,maximumAbsoluteDifference:maxDifference});
  let stopped=false;
  for(let rep=0;rep<repetitions;rep++){
    await yieldTurn();const before=columns.resetDiagnostics(),began=clock();let completed=0;
    for(const ray of rays){columns.writeTransmissionBetween(ray.from,ray.to,scratch);checksum+=scratch[0]+scratch[1]*2+scratch[2]*3;completed++;if(completed%32===0&&clock()-began>maxPassMs){stopped=completed<rays.length;break;}}
    const wallMs=clock()-began,after=columns.diagnostics(),work=delta(before,after);report.measurements.push({repetition:rep,completedRays:completed,requestedRays:rays.length,complete:completed===rays.length,wallMs,...work,meanKernelsPerRay:completed?work.kernelsEvaluated/completed:0,meanBoxTestsPerRay:completed?work.bboxTests/completed:0,maximumQueryMs:after.maximumQueryMs,maximumOmittedBound:after.maximumOmittedBound});
    if(stopped||wallMs>maxPassMs){report.stopped='Replay reached the per-pass CPU wall guard; no further repetition dispatched';break;}
  }
  const complete=report.measurements.filter(x=>x.complete);report.summary={medianSampleWallMs:median(complete.map(x=>x.wallMs)),medianSampleColumnMs:median(complete.map(x=>x.totalQueryMs)),checksum,completedRepetitions:report.measurements.length,requestedRepetitions:repetitions};
  report.checks.push({name:'all requested bounded repetitions completed',passed:!report.stopped&&report.measurements.length===repetitions&&complete.length===repetitions});
  report.passed=report.checks.every(c=>c.passed);report.limits=['This is a detached CPU column replay, not a scene/frame or GPU/FPS measurement.','Source positions include every head and tail returned by getFramingSources; spatial selection is deterministic but no linear extrapolation is certified.','Reflection starts at the same waterplane crossing as the smoke host; invalid crossings emit no column query.','Source visibility culling, source packing, host preprocessing, physical20Hz updates, volume rasterization and field baking are excluded.','It preserves the current unbounded Gaussian BVH and its1e-5 optical omission budget; agreement is against the current public route, not an independent physical oracle.','The wall guard is inspected every32queries; one batch may exceed the requested guard. No production state is mutated.'];return report;
}
