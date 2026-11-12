// Build one new closed R29 successor. This script creates verification files only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createSmokeTransmissionGPU as createTransmission} from './r39-dense-gpu.js';
import {packSmokeTransmissionInputs as packT,planSmokeTransmission as policyT} from './r39-dense-pack.js';
import {planSmokeTransmissionLayout as layoutT} from './r39-dense-layout.js';
import {createPyroSmokeLightField as createLightField,packSmokeLightPackets as packLight,smokeLightMomentsGLSL as moments} from './r39-dense-light-field.js';
import {planSmokeLightTiles as lightPlan,createSmokeLightTileBaker as tileFactory} from './r39-dense-light-tiles.js';
import {planTransmissionRectangles as rectangles,decomposeTransmissionInterval as decompose} from '../smoke-transmission-rectangles.js';
import {smokeGaussianColumnGLSL as column} from '../pyro-smoke-renderer.js';
import {boundSmokeLightField as lightBound} from '../pyro-smoke-light-bound.js';
import {captureLightNativeState as capture,restoreLightNativeState as restore,sameLightNativeState as sameState,withLightNativeState as preserve} from '../pyro-smoke-light-native-state.js';

const root=new URL('../',import.meta.url),here=new URL('./',import.meta.url),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(new URL(p,root));
const final=process.argv.includes('--final'),revision='r39-dense-current-main-sourceT-v1',fixturePath='verification/r39-dense-native-fixture.json';
const TCTOR={maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:12000000,maxMapPairs:1000000,maxMapDraws:16};
const fixture=fs.existsSync(new URL(fixturePath,root))?JSON.parse(read(fixturePath)):null;
let spec={packets:0,tCount:0,lCount:0,mirrorCount:0,tMaps:0,lMaps:0,draws:0,prepares:1,readBytes:0},phase={densityRevision:0,densityTime:0,key:'PENDING',label:'PENDING',seconds:0,time:0},dataModule=null;
if(final){
 assert(fixture,'Final build requires the new full current fixture');
 dataModule=await import(new URL('r39-dense-native-fixture.js',here).href);
 const main=fixture.consumers.find(v=>v.kind==='main'),mirror=fixture.consumers.find(v=>v.kind==='reflection'),P=fixture.snapshot.packets.length;
 assert(main&&mirror&&main.input.count*P>4000000&&main.input.count*P<=12000000&&mirror.input.count>0,'Fixed real dense main request and nonempty captured mirror required');
 const layout=layoutT(main.input.count,P,TCTOR),map=rectangles({sourceCount:main.input.count,packetCount:P,partialStride:layout.partialStride,partialWidth:layout.allocation.partial.width,maxMapPairs:1000000,maxDraws:17});
 assert(layout.supported&&map.supported);spec={packets:P,tCount:main.input.count,lCount:fixture.ledger.count,mirrorCount:mirror.input.count,tMaps:map.mapDraws,lMaps:0,draws:map.totalDraws,prepares:1,readBytes:(main.input.count+8)*16};phase=fixture.phase;
 assert.deepEqual(Object.keys(phase).sort(),['densityRevision','densityTime','key','label','seconds','time'].sort());
 assert.equal(dataModule.r39DenseCanonicalJSON(dataModule.R39_DENSE_FIXTURE),dataModule.r39DenseCanonicalJSON(fixture));
 assert.equal(sha(dataModule.r39DenseCanonicalJSON(fixture)),dataModule.R39_DENSE_FIXTURE_DIGEST);
}
const sources=['../main.js','./r39-dense-pack.js','./r39-dense-layout.js','./r39-dense-gpu.js','./r39-dense-light-tiles.js','./r39-dense-light-field.js','../pyro-smoke-light-native-state.js','../pyro-smoke-renderer.js','../pyro-smoke.js','../fireworks.js','../fireworks-physics.js','../firework-layer-profile.js','../fireworks-audio.js','../package.json','./r39-dense-calibration-runtime.js','./r39-dense-calibration-build.mjs','../smoke-transmission-rectangles.js','../pyro-smoke-light-bound.js','./r16-smoke-transmission-oracle.js','./pyro-smoke-light-field-oracle.js'];
const jobSources=['./r39-dense-native-fixture.js','./r39-dense-native-fixture.json'];
const baseRuntime=read('verification/r29-native-calibration-runtime.js').toString('utf8');let s=baseRuntime;
const edits=[],replace=(a,b)=>{assert.equal(s.split(a).length,2,'Expected unique R29 seam: '+a.slice(0,80));const index=s.indexOf(a);s=s.slice(0,index)+b+s.slice(index+a.length);edits.push({index,old:a,new:b});};
replace("import {R29_CALIBRATION_PINS as PINS} from './r29-native-calibration-pins.js';", "import {R39_DENSE_CALIBRATION_PINS as PINS} from './r39-dense-calibration-pins.js';\nimport {R39_DENSE_FIXTURE,R39_DENSE_FIXTURE_DIGEST,r39DenseCanonicalJSON} from './r39-dense-native-fixture.js';\nimport {createSmokeTransmissionGPU as createTransmission} from './r39-dense-gpu.js';\nimport {createPyroSmokeLightField as createLightField} from './r39-dense-light-field.js';");
for(const [a,b]of [['../pyro-smoke-transmission-pack.js','./r39-dense-pack.js'],['../smoke-transmission-layout.js','./r39-dense-layout.js'],['../pyro-smoke-light-field.js','./r39-dense-light-field.js'],['../pyro-smoke-light-tiles.js','./r39-dense-light-tiles.js']])replace("from '"+a+"'","from '"+b+"'");
replace("export const R29_CALIBRATION_RUNTIME_REVISION='r29-complete-native-lifetime-v1';",`export const R39_DENSE_CALIBRATION_REVISION='${revision}';\nconst R29_CALIBRATION_RUNTIME_REVISION=R39_DENSE_CALIBRATION_REVISION;`);
replace('const TCTOR=Object.freeze({maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8});','const TCTOR=Object.freeze('+JSON.stringify(TCTOR)+');');
replace("const LCTOR=Object.freeze({maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8,anisotropy:.32,bakeMode:'tiled64'});","const LCTOR=Object.freeze({maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxRequestPairs:12000000,maxMapPairs:1000000,maxMapDraws:16,anisotropy:.32,bakeMode:'tiled64'});");
const specLine=s.match(/^const SPECS=.*$/m)[0];replace(specLine,'const SPECS=Object.freeze({source:Object.freeze('+JSON.stringify(spec)+')});\nconst FIXED_PHASE_KEY='+JSON.stringify(phase.key)+';');
const sourceLine=s.match(/^ const sourceKeys=.*$/m)[0];replace(sourceLine,' const sourceKeys='+JSON.stringify(sources)+';');
replace("PINS.schema==='glass-atoll.r29-native-calibration-pins.v1'","PINS.schema==='glass-atoll.r39-dense-calibration-pins.v1'");
replace("exact(PINS.jobs,['source','joint','light'])","exact(PINS.jobs,['source'])");
replace("for(const key of ['source','joint','light']){const job=PINS.jobs[key],paths=['./r29-native-phase-'+key+'-peak.js','./r29-native-phase-'+key+'-peak.json','./r29-'+key+'-peak-gpu-check.js','./r29-native-phase-fixture.mjs'];","for(const key of ['source']){const job=PINS.jobs[key],paths="+JSON.stringify(jobSources)+';');
replace("job.phase.key===key+'-peak'&&job.phase.label===key+'-peak'","job.phase.key===FIXED_PHASE_KEY&&job.phase.label==="+JSON.stringify(phase.label));
replace("copy.phase.key===kind+'-peak'","copy.phase.key===FIXED_PHASE_KEY");
replace('snapshot.time<=ledger.time','snapshot.requestedTime===ledger.time');
replace("mirror?.input.count===0&&!mirror.submitted","mirror?.input.count===spec.mirrorCount&&mirror.requested&&mirror.submitted");
replace("const jobs=[];\n if(spec.tMaps)","demand(Number.isSafeInteger(copy.opticalRecordGeneration)&&[main,mirror].every(v=>v.captureBackend==='verification-only-inert-acknowledgement'&&v.hardwareEffective===false&&v.captureMetadata.time===copy.phase.time&&v.captureMetadata.sourceTransmission.recordsGeneration===copy.opticalRecordGeneration&&v.captureMetadata.sourceTransmission.sourceVersion===v.input.sourceVersion&&v.captureMetadata.sourceTransmission.cameraKey===v.input.cameraKey&&v.captureMetadata.sourceTransmission.densityRevision===snapshot.revision),'Captured optical lineage and inert source-ray provenance mismatch');const jobs=[];\n if(spec.tMaps)");
replace('provenance:copy.provenance,phase:copy.phase,otherConsumers:', 'provenance:copy.provenance,phase:copy.phase,opticalRecordGeneration:copy.opticalRecordGeneration,otherConsumers:');
replace("const candidates=[0,cells-1,...rects.map(r=>r.begin),rects[0].end-1,lastTile,sentinel,Math.floor(cells/2),1,17,63]","const candidates=[0,cells-1,lastTile,sentinel,rects[0].end-1,rects[1]?.begin,Math.floor(cells/2),1,17,63,...rects.map(r=>r.begin)]");
replace('export async function runR29NativeCalibration(THREE,renderer,kind,artifact,exportedDigest,canonical,options={}){',"export async function runR39DenseCalibration(THREE,renderer,options={}){\n const kind='source',artifact=R39_DENSE_FIXTURE,exportedDigest=R39_DENSE_FIXTURE_DIGEST,canonical=r39DenseCanonicalJSON;");
replace("schema:'glass-atoll.r29-native-lifetime-GPU.v1'","schema:'glass-atoll.r39-dense-current-main-GPU.v1'");
replace('actualGPU:false,passed:false,actualDraws:0','actualGPU:false,passed:false,effective:false,publishedToLive:false,actualDraws:0');
replace("['parentLocked','createTransmission','createLightField'].includes(k)","['parentLocked'].includes(k)");
// No caller-supplied factories; their unchanged bodies and all QA imports are pinned.
for(const key of ['createTransmission','createLightField']){const old='options.'+key,count=s.split(old).length-1;assert.equal(count,3);for(let j=0;j<count;j++){const index=s.lastIndexOf(old);s=s.slice(0,index)+key+s.slice(index+old.length);edits.push({index,old,new:key});}}
replace('mainOpticalSources:spec.tCount,emissionSources:spec.lCount','mainOpticalSources:spec.tCount,reflectionOpticalSources:spec.mirrorCount,submittedConsumers:[\'main\'],unsubmittedConsumers:[\'reflection\',\'light\'],emissionSources:spec.lCount');
replace('densityRevision:owned.snapshot.revision,ledgerVersion:owned.ledger.version,recordGeneration:owned.ledger.recordGeneration,ledgerTime:', "densityRevision:owned.snapshot.revision,densityTick:owned.snapshot.tick,densityCommittedTime:owned.snapshot.time,densityRequestedTime:owned.snapshot.requestedTime,capturedOpticalRecordGeneration:owned.opticalRecordGeneration,capturedSourceMetadataScope:'Original CPU producer used an inert acknowledgement only; no captured gpu/effective flag is hardware evidence',ledgerVersion:owned.ledger.version,recordGeneration:owned.ledger.recordGeneration,ledgerTime:");
replace('(spec.tMaps?2707456:0)+(spec.lMaps?3919872:0)','(spec.tMaps?4706304:0)+(spec.lMaps?9916416:0)');
replace('light?diag.tiled.allocatedBytes===3919872:diag.gpuNumericalBytes===2707456','light?diag.tiled.allocatedBytes===9916416:diag.gpuNumericalBytes===4706304');
replace("'One fixed actual dense60Hz native peak job; all original packets, rays and emission sources retained. No source/density thinning, reference GPU, volume or scene draw.'","'One fixed actual current two-event dense MAIN SourceT job only; all original packets and main rays retained. Captured reflection and current ledger remain owned metadata but are NOT submitted. No source/density thinning, reference GPU, volume, SH, reflection or scene draw.'");
replace('report.counts={passed:report.checks.filter(x=>x.passed).length,total:report.checks.length};report.limits=',"report.effective=report.passed;report.effectiveScope='Completed private numerical validation only; owned fields are disposed and no live texture/source result is published';report.counts={passed:report.checks.filter(x=>x.passed).length,total:report.checks.length};report.limits=");
let inverse=s;for(const edit of edits.toReversed()){assert.equal(inverse.slice(edit.index,edit.index+edit.new.length),edit.new,'Closed runtime inverse seam');inverse=inverse.slice(0,edit.index)+edit.old+inverse.slice(edit.index+edit.new.length);}assert.equal(inverse,baseRuntime,'Whole R29 closed source inverse');
// Names in comments/error strings do not affect the preserved GL/math protocol.
fs.writeFileSync(new URL('r39-dense-calibration-runtime.js',here),s);
const sourceHashes=Object.fromEntries(sources.map(p=>[p,final?sha(fs.readFileSync(new URL(p,here))):'0'.repeat(64)]));
const functions={createTransmission,createLightField,packT,policyT,layoutT,rectangles,decompose,packLight,lightPlan,tileFactory,lightBound,capture,restore,sameState,preserve};
const functionHashes=Object.fromEntries([...Object.entries(functions).map(([k,v])=>[k,sha(Function.prototype.toString.call(v))]),['column',sha(column)],['moments',sha(moments)]]);
const pins={schema:'glass-atoll.r39-dense-calibration-pins.v1',pending:!final,runtimeRevision:revision,sources:sourceHashes,functions:functionHashes,jobs:{source:{artifactDigest:final?dataModule.R39_DENSE_FIXTURE_DIGEST:'0'.repeat(64),canonicalFunctionSHA256:final?sha(Function.prototype.toString.call(dataModule.r39DenseCanonicalJSON)):'0'.repeat(64),sources:Object.fromEntries(jobSources.map(p=>[p,final?sha(fs.readFileSync(new URL(p,here))):'0'.repeat(64)])),phase}}};
const freeze="const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};\n";
fs.writeFileSync(new URL('r39-dense-calibration-pins.js',here),'// Closed QA-only fixed current source-main job; no injected workload or cap.\n'+freeze+'export const R39_DENSE_CALIBRATION_PINS=freeze('+JSON.stringify(pins)+');\n');
fs.writeFileSync(new URL('r39-dense-calibration-pins.json',here),JSON.stringify(pins,null,2)+'\n');
fs.writeFileSync(new URL('r39-dense-calibration-build-receipt.json',here),JSON.stringify({schema:'glass-atoll.r39-dense-calibration-build.v1',pending:!final,productionChanged:false,baseRuntimeSHA256:sha(read('verification/r29-native-calibration-runtime.js')),runtimeSHA256:sha(Buffer.from(s)),byteExactWholeRuntimeInverse:true,spec,TCTOR,edits,actualGPU:false},null,2)+'\n');
console.log(JSON.stringify({pending:!final,runtimeSHA256:sha(Buffer.from(s)),spec,sourceCount:sources.length,functionCount:Object.keys(functionHashes).length},null,2));
