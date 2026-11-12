// One predefined bounded CPU attribution run. Original FW only; no candidate.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import os from 'node:os';
import {factory,instance,cameras,read,root} from './r38-fw-cpu-fixture.mjs';
const started=performance.now(),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const original=read('verification/baselines/r38-before-taps-writer/fireworks.js');assert.equal(sha(original),'03fdb7038bffbfc769924ffff6ee57a51b5e9f8b2d3c72169d06e72b9d45c735');
const productionFiles=['fireworks.js','firework-layer-profile.js','fireworks-physics.js','firework-burn-profile.js','fireworks-audio.js'];
const productionBefore=Object.fromEntries(productionFiles.map(p=>[p,sha(read(p))]));
assert.equal(productionBefore['fireworks.js'],sha(original));assert.equal(productionBefore['firework-layer-profile.js'],'411242962dc8681e2eb487acc7f03937ebe32331ec06414f9e78a5674778c537');
const changes=[];let instrumented=original;
function replaceOnce(old,next,label){assert.equal(instrumented.split(old).length,2,label);instrumented=instrumented.replace(old,next);changes.push({label,old,next});}
const support=String.raw`
let __r39Mode='off',__r39Table=Object.create(null),__r39Stack=[];
function __r39Entry(name){return __r39Table[name]??=( {calls:0,inclusiveMs:0,exclusiveMs:0} );}
function __r39Start(name){const e=__r39Entry(name);e.calls++;if(__r39Mode!=='timed')return null;const token={e,start:performance.now(),children:0};__r39Stack.push(token);return token;}
function __r39End(token){if(!token)return;const elapsed=performance.now()-token.start;const top=__r39Stack.pop();if(top!==token)throw Error('Attribution nesting mismatch');token.e.inclusiveMs+=elapsed;token.e.exclusiveMs+=elapsed-token.children;if(__r39Stack.length)__r39Stack.at(-1).children+=elapsed;}
function __r39Measure(name,fn,args){if(__r39Mode==='off')return fn(...args);const token=__r39Start(name);try{return fn(...args);}finally{__r39End(token);}}
function __r39Wrap(name,fn){return function(...args){return __r39Measure(name,fn,args);};}
export function r39AttributionReset(mode){if(!['off','count','timed'].includes(mode))throw Error('Unknown attribution mode');if(__r39Stack.length)throw Error('Attribution reset while active');__r39Mode=mode;__r39Table=Object.create(null);}
export function r39AttributionRead(){if(__r39Stack.length)throw Error('Attribution snapshot while active');return structuredClone(__r39Table);}
`;
// Imported functions are wrapped as whole calls, never their scalar operations.
const imports=[['sampleBody','body-motion'],['sampleBodyEmissionWindow','RGB-window'],['sampleBodyEmission','point-emission'],['bodyEmissionEnvelope','legacy-envelope'],['resolveFireworkExposure','exposure-object'],['sampleCausalOpticalAnchor','past-anchor-sampler'],['sampleTailReleaseFieldNode','tail-field-motion'],['sampleTrailColour','current-tail-colour'],['buildContactOpticalRecords','partial-contact-records']];
const wrappers=[];
for(const [name,label]of imports){
 const line=instrumented.split('\r\n').find(l=>l.startsWith('import {')&&new RegExp('(?:[,{])'+name+'(?:[,}])').test(l));assert(line,name+' import');
 const next=line.replace(new RegExp('([,{])'+name+'([,}])'),'$1'+name+' as __r39Raw_'+name+'$2');replaceOnce(line,next,'import alias '+name);wrappers.push(`const ${name}=__r39Wrap('${label}',__r39Raw_${name});`);
}
const contactLine="import {createFireworkContactSupport} from './firework-contact-support.js';";
replaceOnce(contactLine,"import {createFireworkContactSupport as __r39Raw_createContact} from './firework-contact-support.js';",'contact factory alias');
wrappers.push("function createFireworkContactSupport(...args){const a=__r39Raw_createContact(...args);return Object.freeze({...a,begin:__r39Wrap('contact-generation-begin',a.begin),isAboveSurface:__r39Wrap('current-air-test',a.isAboveSurface),resolve:__r39Wrap('contact-support',a.resolve),sampleAt:__r39Wrap('contact-local-motion',a.sampleAt)});}");
replaceOnce("const RADIANT_PROFILE_ID='three-heart-radiant120-v1';",support+'\r\n'+wrappers.join('\r\n')+"\r\nconst RADIANT_PROFILE_ID='three-heart-radiant120-v1';",'meter-only support');
replaceOnce('  function opticalViewRecord(p,shutter){',"  opticalAnchor=__r39Wrap('anchor-cache-and-pose',opticalAnchor);\r\n  function opticalViewRecord(p,shutter){",'whole anchor cache wrapper');
replaceOnce('    const rgbTaps=new Float64Array(24);',"    const __r39RGB=__r39Mode==='off'?null:__r39Start('RGB-array-window-and-tail-colour');\r\n    const rgbTaps=new Float64Array(24);",'RGB coarse block entry');
replaceOnce('    if(!rgbTaps.some(v=>v>0)){',"    __r39End(__r39RGB);\r\n    if(!rgbTaps.some(v=>v>0)){",'RGB coarse block exit');
replaceOnce('  const contactViewCache=new WeakMap();',"  opticalViewRecord=__r39Wrap('optical-row-build-and-cache',opticalViewRecord);\r\n  const contactViewCache=new WeakMap();",'whole optical row wrapper');
replaceOnce('  function* opticalRows(shutter,includeSmoke=true){',"  opticalViewRecords=__r39Wrap('contact-row-build-and-cache',opticalViewRecords);\r\n  function* opticalRows(shutter,includeSmoke=true){",'whole contact row wrapper');
replaceOnce('export function getFireworkSourceBound(p,camera,optics={},rawPerCandela=3.6e-5){',"writeSourceBound=__r39Wrap('camera-projection-source-bound',writeSourceBound);\r\nexport function getFireworkSourceBound(p,camera,optics={},rawPerCandela=3.6e-5){",'whole projection wrapper');
// This is verification source only; existing factory adds its inspection seam.
fs.writeFileSync(new URL('verification/r39-original-fw-instrumented.js',root),instrumented);
const measuredSeam='api.configure({});return api;';assert.equal(instrumented.split(measuredSeam).length,2);
const withSeam=instrumented.replace(measuredSeam,"api.r39Reset=r39AttributionReset;api.r39Read=r39AttributionRead;"+measuredSeam);
const uninstrumentedFactory=await factory(original),instrumentedFactory=await factory(withSeam),view=cameras();
const lanes=[{name:'original',mode:null,create:uninstrumentedFactory},{name:'countOnly',mode:'count',create:instrumentedFactory},{name:'timed',mode:'timed',create:instrumentedFactory}].map(lane=>({...lane,...instance(lane.create)}));
const samples=[],checks=[];let fault=null;
function operation(lane,name,fn){if(lane.mode)lane.fw.r39Reset(lane.mode);const begin=performance.now(),value=fn(),wallMs=performance.now()-begin;return{name,wallMs,counts:lane.mode?lane.fw.r39Read():null,value};}
function compact(value){return{name:value.name,wallMs:value.wallMs,categories:value.counts};}
try{
 for(const phase of [.7,1.7,2.5])for(let trial=0;trial<6;trial++){
  assert(performance.now()-started<90000,'Predefined CPU run exceeded90 seconds before next case');
  const order=trial%2?[...lanes].reverse():lanes;
  const values=new Map();
  for(const lane of order){
   const update=operation(lane,'fresh-generation-update',()=>lane.update(phase));
   const first=operation(lane,'first-main-source-bound',()=>lane.fw.getRadianceBound({camera:view.main,optics:view.optics}));
   const mirror=operation(lane,'cached-mirror-source-bound',()=>lane.fw.getRadianceBound({camera:view.mirror,optics:view.mo}));
   samples.push({phaseSeconds:phase,trial,lane:lane.name,physicalTime:lane.fw.r38State().time,recordsGeneration:lane.fw.r38State().recordsGeneration,operations:[compact(update),compact(first),compact(mirror)]});
   values.set(lane.name,{first:first.value,mirror:mirror.value});
  }
  for(const name of['countOnly','timed'])assert.deepEqual(values.get(name),values.get('original'));
  if(trial===0){
   const rows=lanes[0].fw.r38Rows(1/120),physical=lanes[0].fw.r38State();
   for(const lane of lanes.slice(1)){assert.deepEqual(lane.fw.r38Rows(1/120),rows);assert.deepEqual(lane.fw.r38State(),physical);}
   checks.push({phaseSeconds:phase,fullOpticalRowsExact:true,completePhysicalStateAndContactDiagnosticsExact:true,rows:rows.length});
  }
 }
}catch(error){fault=String(error.stack??error);}
finally{for(const lane of lanes)lane.fw.dispose();}
function stats(a){const s=[...a].sort((a,b)=>a-b);return{count:a.length,mean:a.reduce((s,x)=>s+x,0)/a.length,median:(s[2]+s[3])/2,min:s[0],max:s.at(-1)};}
const aggregates=[];
for(const phase of[.7,1.7,2.5])for(const lane of lanes)for(const op of['fresh-generation-update','first-main-source-bound','cached-mirror-source-bound']){
 const rows=samples.filter(s=>s.phaseSeconds===phase&&s.lane===lane.name).map(s=>s.operations.find(o=>o.name===op));if(!rows.length)continue;
 const names=[...new Set(rows.flatMap(r=>Object.keys(r.categories??{})))];
 aggregates.push({phaseSeconds:phase,lane:lane.name,operation:op,wallMs:stats(rows.map(r=>r.wallMs)),categories:Object.fromEntries(names.map(name=>[name,{calls:stats(rows.map(r=>r.categories[name]?.calls??0)),inclusiveMs:stats(rows.map(r=>r.categories[name]?.inclusiveMs??0)),exclusiveMs:stats(rows.map(r=>r.categories[name]?.exclusiveMs??0))}]))});
}
const deltas=[];for(const phase of[.7,1.7,2.5])for(const op of['fresh-generation-update','first-main-source-bound','cached-mirror-source-bound']){
 const get=lane=>aggregates.find(a=>a.phaseSeconds===phase&&a.operation===op&&a.lane===lane)?.wallMs.mean;
 if(get('original')!==undefined)deltas.push({phaseSeconds:phase,operation:op,countMinusOriginalMeanMs:get('countOnly')-get('original'),timedMinusCountMeanMs:get('timed')-get('countOnly'),timedMinusOriginalMeanMs:get('timed')-get('original'),interpretation:'Observed instrumentation/scheduling differences, signed and unclamped; not a subtractive correction to category timings'});
}
for(const p of productionFiles)assert.equal(sha(read(p)),productionBefore[p],p+' changed during read-only run');
const report={schema:'glass-atoll.r39-original-fw-optical-attribution.v1',passed:!fault&&checks.length===3,error:fault,actualGPU:false,browserUsed:false,optimizationImplemented:false,productionChanged:false,scope:'One predefined bounded run: archived original03fd factory, actual192-root radiant, N8, fixed native main and original oblique-water mirror, actual terrain/static air surface, fixed wind, three physical phases; six fresh record generations per phase per lane',sourceSHA256:{originalFW:sha(original),instrumentedVerificationFW:sha(instrumented),fixture:sha(read('verification/r38-fw-cpu-fixture.mjs')),production:productionBefore},engine:{node:process.version,V8:process.versions.v8,cpu:os.cpus()[0]?.model},instrumentation:{wholeFunctionWrappers:imports.map(([name,label])=>({name,label})),coarseRGBBlock:true,callCountControl:true,nestedInclusiveAndExclusive:true,caseCount:samples.length,phaseTrials:6,scriptSHA256:sha(fs.readFileSync(new URL(import.meta.url))),sourceChanges:changes},checks,samples,aggregates,instrumentationDeltas:deltas,wallSeconds:(performance.now()-started)/1000,limits:['Inclusive category times overlap; never add inclusive parent and child totals. Exclusive row residual includes cache lookup, object/array operations, stretch bookkeeping, validation and wrapper/JIT overhead; it is not an isolated allocation time.','Timing uses whole-function and one coarse RGB block boundaries, not per scalar operation. Per-call performance.now/stack bookkeeping and wrappers perturb optimization and GC; count-only/original controls expose perturbation, not a reliable time correction.','Signed control differences may be negative due to schedule/JIT/noise; they are retained, not clamped or interpreted as negative physical work.','Imported contact helper internal motion is included in contact-support, not separately intercepted. Partial-contact RGB calls in their own module are included in partial-contact-records; do not claim the RGB-window counter captures them.','Repeated updates at the same committed phase make fresh recordsGeneration without advancing physical time. This is CPU attribution, not native evolving wall-clock performance, browser FPS or GPU shader timing.','No curve, material, shutter, projection, sample count, pixel, audio, source setting or production file is changed.']};
fs.writeFileSync(new URL('verification/r39-optical-construction-attribution.json',root),JSON.stringify(report,null,2)+'\n');
const brief=aggregates.filter(a=>a.lane==='timed'&&a.operation==='first-main-source-bound').map(a=>({phase:a.phaseSeconds,wall:a.wallMs.mean,categories:Object.fromEntries(Object.entries(a.categories).map(([k,v])=>[k,{calls:v.calls.mean,inclusive:v.inclusiveMs.mean,exclusive:v.exclusiveMs.mean}]))}));
console.log(JSON.stringify({passed:report.passed,error:fault,wallSeconds:report.wallSeconds,checks,firstConsumer:brief},null,2));if(!report.passed)process.exitCode=1;
