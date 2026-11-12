// New closed R40 phases; all sealed R39 files and current production are read-only.
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
import {R39_DENSE_JOINT_FIXTURE as artifact,R39_DENSE_JOINT_FIXTURE_DIGEST as digest,r39DenseCanonicalJSON as canonical} from './r39-dense-joint-fixture.js';

const root=new URL('../',import.meta.url),here=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const base=read('verification/r39-dense-calibration-runtime.js').toString('utf8');assert.equal(sha(base),'0e6f2bd483c18f343dbe129c2c96bceefd3e6fb71ebfbd070f223a331253900c');
const oldPins=JSON.parse(read('verification/r39-dense-calibration-pins.json')),revision='r40-dense-fixed-mirror-light-joint-v1';
assert.equal(sha(canonical(artifact)),digest);assert.equal(digest,'96780577818e0d25e0b31ba3dc207fec22db86abf66702380431eefe5c416303');
const TCTOR={maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:12000000,maxMapPairs:1000000,maxMapDraws:16};
const LCTOR={maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxRequestPairs:12000000,maxMapPairs:1000000,maxMapDraws:16,anisotropy:.32,bakeMode:'tiled64'};
const P=artifact.snapshot.packets.length,main=artifact.consumers.find(x=>x.kind==='main'),mirror=artifact.consumers.find(x=>x.kind==='reflection'),LC=artifact.ledger.count;
assert.equal(P,1663);assert.equal(main.input.count,2418);assert.equal(mirror.input.count,2418);assert.equal(LC,2413);
const tLayout=layoutT(main.input.count,P,TCTOR),tMap=rectangles({sourceCount:main.input.count,packetCount:P,partialStride:tLayout.partialStride,partialWidth:tLayout.allocation.partial.width,maxMapPairs:1000000,maxDraws:17}),lPlan=lightPlan(P,LC,LCTOR);
assert.equal(tMap.mapDraws,6);assert.equal(lPlan.mapDraws,6);
const common={packets:P,tCount:main.input.count,lCount:LC,mirrorCount:mirror.input.count};
const specs={mirror:{...common,tMaps:6,lMaps:0,tViewKinds:['reflection'],transmissionFields:1,draws:7,prepares:1,readBytes:38816},light:{...common,tMaps:0,lMaps:6,tViewKinds:[],transmissionFields:0,draws:7,prepares:1,readBytes:80208},joint:{...common,tMaps:6,lMaps:6,tViewKinds:['main','reflection'],transmissionFields:2,draws:21,prepares:3,readBytes:157840}};
let s=base;const edits=[],replace=(old,next)=>{assert.equal(s.split(old).length,2,'Unique R39 seam: '+old.slice(0,90));const index=s.indexOf(old);s=s.slice(0,index)+next+s.slice(index+old.length);edits.push({index,old,new:next});};
replace("import {R39_DENSE_CALIBRATION_PINS as PINS} from './r39-dense-calibration-pins.js';","import {R40_DENSE_CALIBRATION_PINS as PINS} from './r40-dense-calibration-pins.js';");
replace("import {R39_DENSE_FIXTURE,R39_DENSE_FIXTURE_DIGEST,r39DenseCanonicalJSON} from './r39-dense-native-fixture.js';","import {R39_DENSE_JOINT_FIXTURE as R39_DENSE_FIXTURE,R39_DENSE_JOINT_FIXTURE_DIGEST as R39_DENSE_FIXTURE_DIGEST,r39DenseCanonicalJSON} from './r39-dense-joint-fixture.js';");
replace("export const R39_DENSE_CALIBRATION_REVISION='r39-dense-current-main-sourceT-v1';\nconst R29_CALIBRATION_RUNTIME_REVISION=R39_DENSE_CALIBRATION_REVISION;",`export const R40_DENSE_CALIBRATION_REVISION='${revision}';\nconst R29_CALIBRATION_RUNTIME_REVISION=R40_DENSE_CALIBRATION_REVISION;`);
const specSource=Object.entries(specs).map(([key,value])=>JSON.stringify(key)+':Object.freeze('+JSON.stringify(value).replace(/"tViewKinds":(\[[^\]]*\])/,'"tViewKinds":Object.freeze($1)')+')').join(',');
replace(s.match(/^const SPECS=.*$/m)[0],'const SPECS=Object.freeze({'+specSource+'});');
const sourceKeys=Object.keys(oldPins.sources).map(p=>p.replace('./r39-dense-calibration-runtime.js','./r40-dense-calibration-runtime.js').replace('./r39-dense-calibration-build.mjs','./r40-dense-calibration-build.mjs')).concat('./r39-dense-calibration-runtime.js');
replace(s.match(/^ const sourceKeys=.*$/m)[0],' const sourceKeys='+JSON.stringify(sourceKeys)+';');
replace("PINS.schema==='glass-atoll.r39-dense-calibration-pins.v1'","PINS.schema==='glass-atoll.r40-dense-calibration-pins.v1'");
replace("exact(PINS.jobs,['source'])","exact(PINS.jobs,['mirror','light','joint'])");
replace("for(const key of ['source']){const job=PINS.jobs[key],paths=[\"./r39-dense-native-fixture.js\",\"./r39-dense-native-fixture.json\"];","for(const key of ['mirror','light','joint']){const job=PINS.jobs[key],paths=['./r39-dense-joint-fixture.js','./r39-dense-joint-fixture.json'];");

// Bind the exact frozen independent map references: no online oracle and no
// range-only partial gate. Address decoding follows each kernel's original order.
const partialBinding=`function bindPartialReferences(list,cells,rows,columns,light=false){
 demand(Array.isArray(list)&&list.length===8,'Exactly eight frozen independent partial references required');const addresses=[];
 for(const r of list){demand(Number.isSafeInteger(r.address)&&r.address>=0&&r.address<cells&&!addresses.includes(r.address),'Unique bounded frozen partial address required');const row=r.address%rows,tile=Math.floor(r.address/rows);if(light){demand(r.packetIndex===row&&r.tile===tile&&r.sourceBegin===tile*64&&r.sourceEnd===Math.min(columns,(tile+1)*64)&&r.normalization==='raw map partial BEFORE once-only final1/(4pi)','SH partial original source/tile/normalization mismatch');demand(Array.isArray(r.attachmentsRGBA)&&r.attachmentsRGBA.length===3&&r.attachmentsRGBA.every(v=>Array.isArray(v)&&v.length===4&&v.every(Number.isFinite)&&v[0]>=0),'All signed raw SH partial references required');}else{demand(r.row===row&&r.tile===tile&&Array.isArray(r.tauRGBA)&&r.tauRGBA.length===4&&r.tauRGBA.every(Number.isFinite)&&r.tauRGBA.slice(0,3).every(v=>v>=0)&&r.tauRGBA[3]===0,'T partial original packet/tile/tau reference mismatch');}addresses.push(r.address);}return addresses;
}
`;
replace('function ownPhase(kind,artifact,canonical){',partialBinding+'function ownPhase(kind,artifact,canonical){');
const tBegin=s.indexOf(' if(spec.tMaps){'),tEnd=s.indexOf(' if(spec.lMaps){',tBegin);assert(tBegin>0&&tEnd>tBegin);let t=s.slice(tBegin,tEnd);
t=t.replace(' if(spec.tMaps){const v=main.input,',' for(const selectedView of spec.tViewKinds){const view=selectedView===\'main\'?main:mirror,v=view.input,').replaceAll('main.','view.');
t=t.replace("const samples=probes(map.mapRects,map.completeCells,input.count*(map.tileCount-1),input.count-1);jobs.push({kind:'transmission',","const partialReferences=view.oracle.partialSamples,samples=bindPartialReferences(partialReferences,map.completeCells,input.count,spec.packets);jobs.push({kind:'transmission',view:selectedView,partialReferences,");
assert(t.includes('partialReferences'));replace(s.slice(tBegin,tEnd),t);
replace("const samples=probes(plan.mapRects,plan.partialTexels,spec.packets*(plan.tileCount-1),light.oracle.colouredSentinel.index);jobs.push({kind:'light',","const partialReferences=light.oracle.partialSamples,samples=bindPartialReferences(partialReferences,plan.partialTexels,spec.packets,ledger.count,true);jobs.push({kind:'light',view:null,partialReferences,");
replace("if(kind==='joint')demand(jobs[0].input.snapshot===jobs[1].snapshot&&jobs[1].ledger===ledger,'Joint must share SAME owned snapshot and current ledger, no stale result');","demand(jobs.every(j=>j.kind==='light'?j.snapshot===snapshot&&j.ledger===ledger:j.input.snapshot===snapshot),'All selected jobs require SAME privately owned snapshot and current ledger');if(kind==='joint')demand(jobs.length===3&&jobs[0].view==='main'&&jobs[1].view==='reflection'&&jobs[2].kind==='light','Fixed three-job complete order required');");
replace("sameGenerationOwned:kind!=='joint'||jobs[0].input.snapshot===jobs[1].snapshot","sameGenerationOwned:jobs.every(j=>j.kind==='light'?j.snapshot===snapshot&&j.ledger===ledger:j.input.snapshot===snapshot)");

replace('let physicalError=0,quantizedError=0,neutralRows=0;','let physicalError=0,quantizedError=0,neutralRows=0,partialMaximumAbsoluteError=0;');
replace("demand(partials[0][i*4+3]===0,'Partial tau alpha must0');","demand(partials[0][i*4+3]===0,'Partial tau alpha must0');for(let c=0;c<3;c++)partialMaximumAbsoluteError=Math.max(partialMaximumAbsoluteError,Math.abs(partials[0][i*4+c]-job.partialReferences[i].tauRGBA[c]));");
replace("demand(physicalError<=1e-5&&quantizedError<=8e-6,'All-row original/quantized T tolerance failed');","demand(physicalError<=1e-5&&quantizedError<=8e-6,'All-row original/quantized T tolerance failed');demand(partialMaximumAbsoluteError<=1e-5,'Frozen independent raw T partial absolute1e-5 gate failed');");
replace('maximumGPUVsQuantizedDoubleTError:quantizedError,neutralRows','maximumGPUVsQuantizedDoubleTError:quantizedError,partialMaximumAbsoluteError,partialTolerance:{absoluteTau:1e-5,reference:\'frozen original64-packet quantized-input double column integrals\'},neutralRows');
replace('function validateLight(job,pixels,partials,raw){','function validateLight(job,pixels,partials,raw){let partialC0Error=0,partialC1Error=0;for(let i=0;i<job.samples.length;i++){const refs=job.partialReferences[i].attachmentsRGBA,scale=Math.max(...refs.map(v=>v[0]),1e-30);for(let c=0;c<3;c++){const values=partials[c].subarray(i*4,i*4+4);partialC0Error=Math.max(partialC0Error,Math.abs(values[0]-refs[c][0])/scale);partialC1Error=Math.max(partialC1Error,Math.hypot(...Array.from(values.slice(1),(v,k)=>v-refs[c][k+1]))/scale);}}demand(partialC0Error<=.002&&partialC1Error<=.002,\'Frozen independent raw SH partial signed C0/C1 .002 gate failed\');');
replace('validPacketRows:job.snapshot.packets.length,coefficientWords:','partialMaximumC0ErrorOverPeakReferenceC0:partialC0Error,partialMaximumC1VectorErrorOverPeakReferenceC0:partialC1Error,partialNormalization:\'raw map before final1/(4pi); compared directly to frozen256-node references\',validPacketRows:job.snapshot.packets.length,coefficientWords:');
replace('export async function runR39DenseCalibration(THREE,renderer,options={}){\n const kind=\'source\',artifact=R39_DENSE_FIXTURE,exportedDigest=R39_DENSE_FIXTURE_DIGEST,canonical=r39DenseCanonicalJSON;','export async function runR40DenseCalibration(THREE,renderer,options={}){\n const kind=options?.phase===undefined?\'mirror\':options.phase,artifact=R39_DENSE_FIXTURE,exportedDigest=R39_DENSE_FIXTURE_DIGEST,canonical=r39DenseCanonicalJSON;');
replace("schema:'glass-atoll.r39-dense-current-main-GPU.v1'","schema:'glass-atoll.r40-dense-fixed-phase-GPU.v1'");
replace("['parentLocked'].includes(k)","['parentLocked','phase'].includes(k)");
replace("options.parentLocked===true&&THREE.REVISION==='180'","options.parentLocked===true&&typeof kind==='string'&&Object.hasOwn(SPECS,kind)&&THREE.REVISION==='180'");
replace("submittedConsumers:['main'],unsubmittedConsumers:['reflection','light']","submittedConsumers:[...spec.tViewKinds,...(spec.lMaps?['light']:[])],unsubmittedConsumers:['main','reflection','light'].filter(v=>!spec.tViewKinds.includes(v)&&!(v==='light'&&spec.lMaps))");
replace('(spec.tMaps?4706304:0)+(spec.lMaps?9916416:0)','spec.transmissionFields*4706304+(spec.lMaps?9916416:0)');
replace("job.localRenders=0;job.partial=null;job.output=null;}\n  patch(renderer.debug","job.localRenders=0;job.partial=null;job.output=null;}demand(new Set(fields).size===fields.length,'Selected requests must own distinct fields; two retained T outputs may not alias');\n  patch(renderer.debug");
replace("currentDraw={job:job.kind,index:","currentDraw={job:job.kind,view:job.view??null,index:");
replace("for(const job of owned.jobs){const light=job.kind==='light',r=job.result,diag=job.field.diagnostics();","if(kind==='joint')demand(owned.jobs[0].output!==owned.jobs[1].output&&owned.jobs[0].output?.texture!==owned.jobs[1].output?.texture,'Both T outputs must remain independently retained until readback');for(const job of owned.jobs){const light=job.kind==='light',r=job.result,diag=job.field.diagnostics();");
replace("report.jobs.push({kind:job.kind,readback,","report.jobs.push({kind:job.kind,view:job.view??null,cameraKey:job.input?.cameraKey??job.packed.cameraKey??null,readback,");
replace("'One fixed actual current two-event dense MAIN SourceT job only; all original packets and main rays retained. Captured reflection and current ledger remain owned metadata but are NOT submitted. No source/density thinning, reference GPU, volume, SH, reflection or scene draw.'","'One fixed selected mirror, SH or ordered main+mirror+SH numerical phase from the SAME current two-event snapshot. All packets/rays/emission sources retained; two distinct T fields hold joint outputs until checks. No thinning, reference GPU, volume or scene draw.'");

let inverse=s;for(const e of edits.toReversed()){assert.equal(inverse.slice(e.index,e.index+e.new.length),e.new);inverse=inverse.slice(0,e.index)+e.old+inverse.slice(e.index+e.new.length);}assert.equal(inverse,base);
fs.writeFileSync(new URL('r40-dense-calibration-runtime.js',here),s);
const sourceHashes=Object.fromEntries(sourceKeys.map(p=>[p,sha(fs.readFileSync(new URL(p,here)))])),functions={createTransmission,createLightField,packT,policyT,layoutT,rectangles,decompose,packLight,lightPlan,tileFactory,lightBound,capture,restore,sameState,preserve},functionHashes=Object.fromEntries([...Object.entries(functions).map(([k,v])=>[k,sha(Function.prototype.toString.call(v))]),['column',sha(column)],['moments',sha(moments)]]);
const job={artifactDigest:digest,canonicalFunctionSHA256:sha(Function.prototype.toString.call(canonical)),sources:Object.fromEntries(['./r39-dense-joint-fixture.js','./r39-dense-joint-fixture.json'].map(p=>[p,sha(fs.readFileSync(new URL(p,here)))])),phase:artifact.phase};
const pins={schema:'glass-atoll.r40-dense-calibration-pins.v1',pending:false,runtimeRevision:revision,sources:sourceHashes,functions:functionHashes,jobs:{mirror:job,light:job,joint:job}};
const freeze="const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};\n";fs.writeFileSync(new URL('r40-dense-calibration-pins.js',here),'// Fixed immutable R40 phases; no workload/factory/cap injection.\n'+freeze+'export const R40_DENSE_CALIBRATION_PINS=freeze('+JSON.stringify(pins)+');\n');fs.writeFileSync(new URL('r40-dense-calibration-pins.json',here),JSON.stringify(pins,null,2)+'\n');
fs.writeFileSync(new URL('r40-dense-calibration-build.json',here),JSON.stringify({schema:'glass-atoll.r40-dense-calibration-build.v1',passed:true,productionChanged:false,baseRuntimeSHA256:sha(base),runtimeSHA256:sha(s),byteExactWholeR39RuntimeInverse:true,specs,TCTOR,LCTOR,edits,actualGPU:false},null,2)+'\n');console.log(JSON.stringify({runtimeSHA256:sha(s),specs,sourcePins:sourceKeys.length,cachedFunctions:Object.keys(functionHashes).length},null,2));
