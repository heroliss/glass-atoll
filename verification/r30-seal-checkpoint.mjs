import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve('.'),dir=path.join(root,'verification'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),file=p=>{const b=fs.readFileSync(p);return{sha256:sha(b),bytes:b.length};};
const receiptName='r30-browser-fresh-scene-v5-actual-gpu.json',r=read(receiptName),old=read('r29-final-manifest.json');
assert(r.passed&&r.actualGPU&&r.counts.passed===6&&r.counts.total===6);
assert.equal(r.timedIntervals.length,1);assert(r.timedIntervals[0].ready&&!r.timedIntervals[0].disjoint&&r.timedIntervals[0].gpuMs<100);
assert.equal(r.numericalStages.length,18);assert.equal(r.sharedLighting.field.bakes,1);
assert.equal(r.final.sourceT.prepares,2);assert.equal(r.final.sourceT.draws,12);assert.equal(r.cpuFallbackQueries??0,0);
assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);
assert(r.restoration.passed&&r.originalPresentationRebuild.passed);
const checks=[],currentReports=[
 'r30-browser-native-replay-check.json',
 'r30-browser-strict-cpu-actual.json',
 'r30-browser-strict-cpu-actual-independent-audit.json',
 'r30-browser-strict-cpu-actual-motion-audit.json',
 'r30-browser-fresh-scene-preflight.json',
 receiptName,
 'r30-composed-frame-layer-bounds-audit.json',
 'r30-v5-smoke-workstream-actual-audit.json',
 'r30-fresh-scene-small-encoding.json',
 'r30-user-restoration-check.json'
];
for(const name of currentReports){const v=read(name);assert.equal(v.passed,true,name);checks.push({path:'verification/'+name,...file(path.join(dir,name)),counts:v.counts??null,scope:name===receiptName?'Actual single small complete scene':name==='r30-browser-strict-cpu-actual.json'?'Actual CPU-only strict browser reconstruction':'Read the named report; scopes differ and do not add to one universal test suite'});}
const source={},changed=[];
for(const [name,before] of Object.entries(old.source)){const now=file(path.join(root,name));source[name]=now;if(now.sha256!==before.sha256)changed.push(name);}
assert.deepEqual(changed,['main.js'],'R30 production-source changes against R29 must be QA integration only in main.js');
for(const [name,digest] of Object.entries(r.sourcePins)){const absolute=path.resolve(dir,name);assert(absolute.startsWith(root+path.sep));const now=file(absolute);assert.equal(now.sha256,digest,'Actual source pin changed: '+name);source[path.relative(root,absolute).replaceAll(path.sep,'/')]=now;}
assert.equal(source['main.js'].sha256,'bfe586ddebfb2d47eb83f285762ecf1acfe92e773862699092bf88c178545777');
assert.equal(source['fireworks-audio.js'].sha256,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
const artifactPaths=[];
function walk(base){for(const entry of fs.readdirSync(base,{withFileTypes:true})){const full=path.join(base,entry.name),relative=path.relative(dir,full).replaceAll(path.sep,'/');if(entry.isDirectory()){if(relative==='baselines'||relative.startsWith('baselines/r30-'))walk(full);}else if((/^r30-/i.test(entry.name)||relative.startsWith('baselines/r30-')||relative==='R31-NATIVE-FRAME-DESIGN.md')&&!entry.name.startsWith('r30-final-manifest')&&!entry.name.startsWith('r30-final-independent-'))artifactPaths.push(relative);}}
walk(dir);artifactPaths.sort();
const artifacts=Object.fromEntries(artifactPaths.map(name=>['verification/'+name,file(path.join(dir,name))]));
for(const name of ['README.md','verification/plans/PROGRESS.md'])artifacts[name]=file(path.join(root,name));
const preservedFailures=['r30-fresh-scene-actual-gpu.json','r30-browser-fresh-scene-actual-gpu.json','r30-browser-fresh-scene-v3-actual-gpu.json','r30-browser-fresh-scene-v4-actual-gpu.json'].map(name=>{const v=read(name);assert.equal(v.passed,false);return{path:'verification/'+name,...file(path.join(dir,name)),actualGPU:v.actualGPU,actualDraws:v.actualDraws??0,failure:v.failure??v.checks.find(c=>!c.passed)?.error};});
const manifest={schema:'glass-atoll.r30-final-manifest.v1',sealedUTC:new Date().toISOString(),passed:true,goalStatus:'active',previousManifest:{path:'verification/r29-final-manifest.json',...file(path.join(dir,'r29-final-manifest.json'))},productionChangesAgainstR29:changed,source,artifacts,currentPassingReports:checks,preservedFailures,actualFrame:{receipt:'verification/'+receiptName,gpuMs:r.timedIntervals[0].gpuMs,coldInstrumentedCpuSubmitMs:r.cpuSubmitMs,draws:r.actualDraws,renders:r.renderCalls,elements:r.elements,nativeOps:r.nativeOps,numericalDraws:18,sourceTPrepares:2,sharedSHBakes:1,cpuFallbackQueries:0,mainSize:[r.image.width,r.image.height],reflection:r.final.water.reflection,rawImageSHA256:sha(Buffer.from(r.image.rgbaBase64,'base64')),originalPresentationRebuild:r.originalPresentationRebuild},syntax:{command:'npm run check',exitCode:0,log:'verification/r30-final-runtime-syntax.log'},userRestoration:read('r30-user-restoration-check.json').counts,console:read('r30-user-restoration-check.json').console,limits:['Checkpoint/source/evidence sealing only; whole project goal remains active.','A single160x171 fading-phase scene is not native-resolution, evolving-scene FPS, HDR-display or photorealism acceptance.','Only main.js QA APIs/bridge changed in the compared production source set; physical matter, kernels and approved audio stayed unchanged.','The two-event >4m per-kernel fallback cliff remains unresolved.','All historical failures/source-only reviews retain their original scope; selected reports do not imply the old entire test suite is green.','Automatic HDR peak changed700→1270 while intent stayed automatic; no OS settings changed.','No restoration of the original instantaneous environmental state or bitwise cache history is claimed.']};
const output=path.join(dir,'r30-final-manifest.json');assert(!fs.existsSync(output),'Final manifest already sealed; preserve it before deliberate revision');fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({passed:manifest.passed,goalStatus:manifest.goalStatus,sourcePins:Object.keys(source).length,artifacts:Object.keys(artifacts).length,currentPassingReports:checks.length,preservedFailures:preservedFailures.length,productionChangesAgainstR29:changed,manifest:file(output)},null,2));
