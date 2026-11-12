// Offline admission of exactly the three actually GPU-checked atan candidates.
// Does not rewrite official research exports or manufacture new peak targets.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {buildAccurateAtan2Candidate} from './aces2-atan-math.js';
const root=new URL('../',import.meta.url),qa=new URL('./verification/',root),out=new URL('./vendor/aces2/',root),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),read=(name,base=qa)=>fs.readFileSync(new URL(name,base)),json=name=>JSON.parse(read(name));
const candidate=json('aces2-atan-candidate/export-report.json'),freeze=json('aces2-atan-freeze.json'),gpu=json('aces2-atan-gpu-first.json');
assert.equal(gpu.passed,true);assert.deepEqual(gpu.counts,{passed:77,total:77});assert.equal(sha(read('aces2-atan-gpu-first.json')),'0c26b5fa7f553c8c03e618ae966f744f356db124d140bc26c843915b1d4daa8c');
for(const row of freeze.files)assert.equal(sha(read(row.file,root)),row.sha256);
fs.mkdirSync(out,{recursive:true});
const write=(name,bytes)=>{const u=new URL(name,out);fs.mkdirSync(new URL('./',u),{recursive:true});fs.writeFileSync(u,bytes);return{file:name,sha256:sha(bytes),bytes:Buffer.byteLength(bytes)};};
const license=write('OCIO-LICENSE.txt',read('aces2-oracle/OCIO-LICENSE.txt'));
let helper=null;
const targets=candidate.targets.map(e=>{
 const original=read(`aces2-oracle/aces2-${e.peakNits}-official.glsl`),functionBytes=read('aces2-atan-candidate/'+e.functionFile),built=buildAccurateAtan2Candidate(original.toString('utf8'));
 assert.equal(built.source,functionBytes.toString('utf8'));assert.equal(built.normalize(built.source),original.toString('utf8'));assert.equal(sha(functionBytes),e.functionSHA256);
 if(!helper)helper=write('accurate-atan-helper.glsl',built.prefix);
 else assert.equal(helper.sha256,sha(built.prefix));
 const directory=e.peakNits+'/',originalFile=write(directory+'original-ocio26.glsl',original),functionFile=write(directory+'accurate-atan.glsl',functionBytes);
 const tables=e.textures2D.map(t=>{const b=read('aces2-atan-candidate/'+t.rgbaUploadFile);assert.equal(sha(b),t.rgbaSHA256);return{...write(directory+`table-${t.index}-rgba.f32`,b),index:t.index,samplerName:t.samplerName,width:363,height:1,components:4,internalFormat:'RGBA32F',format:'RGBA',type:'FLOAT',filter:'NEAREST',wrap:'CLAMP_TO_EDGE',mipmaps:false,colorSpace:'NoColorSpace',flipY:false};});
 const cpu=json('aces2-oracle/aces2-'+e.peakNits+'-cpu.json'),ids=['neutral-0','neutral-0.18','neutral-1',...['red','green','blue','cyan','magenta','yellow'].map(n=>'hue-'+n+'-1'),...['red','green','blue','yellow','thermal'].map(n=>'profile-'+n+'-1'),'negative-or-extreme-2'],tiny=cpu.samples.find(s=>s.name==='blue'&&s.family==='six-hue-unit-Y-ramp'&&s.level>0),boundary=cpu.samples.find(s=>s.family==='AP1-domain-boundary');
 assert(tiny&&boundary);ids.push(tiny.id,boundary.id);const rows=Array.from(new Set(ids)).map(id=>{const s=cpu.samples.find(s=>s.id===id);assert(s,'Missing official CPU anchor '+id);return{id,inputFloat32:s.inputFloat32,expected:s.outputNormalized100Nit.map(Math.fround),exactBlack:id==='neutral-0',positiveBlue:id===tiny.id};});
 const anchors=write(directory+'anchors.json',JSON.stringify({schema:'glass-atoll.aces2-output-anchors.v1',peakNits:e.peakNits,units:'display-linear Rec709 normalized100nit',tolerance:{absolute:2e-5,relative:2e-4},sourceCPUOracleSHA256:sha(read('aces2-oracle/aces2-'+e.peakNits+'-cpu.json')),rows},null,2)+'\n');
 return{peakNits:e.peakNits,function:e.function,functionFile,originalFile,tables,anchors,inverse:{prefixFile:helper.file,from:built.from,to:built.to,replacements:1,wholeOriginalSHA256:sha(original)},reference:{officialExportSHA256:freeze.unchangedOriginalSeals['aces2-oracle/export-report.json'],candidateFunctionSHA256:e.functionSHA256,GPU77ReportSHA256:sha(read('aces2-atan-gpu-first.json'))}};
});
const manifest={schema:'glass-atoll.aces2-output-vendor.v1',variant:'aces2-ocio26-accurate-atan-v1',OCIOVersion:'2.6.0',nonOfficialNumericalVariant:true,supportedPeaks:[100,700,1270],input:'exposed scene-linear Rec709/D65; complete official AP1 adaptation/domain wrapper included once',output:'display-linear Rec709; numeric1=100nit; no OETF',tolerance:{absolute:2e-5,relative:2e-4},license,atanHelper:helper,targets,sourceAdmission:{actualGPUReport:'verification/aces2-atan-gpu-first.json',sha256:sha(read('aces2-atan-gpu-first.json')),checks:77,notOfficialCertification:true,productionDefaultPromotion:false}};
const text=JSON.stringify(manifest,null,2)+'\n';write('manifest.json',text);
write('manifest.js','// Generated admission pin. No dynamic target generation.\nexport const ACES2_VENDOR_PIN=Object.freeze('+JSON.stringify({schema:manifest.schema,variant:manifest.variant,manifestSHA256:sha(text),supportedPeaks:manifest.supportedPeaks,OCIOVersion:'2.6.0'})+');\n');
write('README.md','# Optional ACES2 numerical variant resources\n\nVariant `aces2-ocio26-accurate-atan-v1` is explicitly non-official: the unique native atan2 is replaced with a generic range-reduced degree17 function. All other official OpenColorIO2.6.0 shader text and the two hue tables remain unchanged. Each directory retains the original function and exact inverse evidence. OCIO-LICENSE.txt applies to the OpenColorIO-derived content.\n\nOnly100/700/1270nit targets have been admitted by the frozen77-check actual GPU report. This does not make the expanded sample set an official OCIO abs-only certification or certify an HDR display. `aces2-output.js` is optional and is not enabled by these resources.\n\nEach target contains two363x1 RGBA32F NEAREST/clamped, non-mipmapped hue tables. Their manual shader interpolation must not be replaced by hardware linear filtering. Output numeric1 means100nit before the separate unit conversion and exactly one optional sRGB encoding. No paper-white/look compensation is included.\n');
console.log(JSON.stringify({variant:manifest.variant,manifestSHA256:sha(text),targets:targets.map(t=>({peakNits:t.peakNits,anchors:JSON.parse(read(t.anchors.file,out)).rows.length,functionSHA256:t.functionFile.sha256})),resourcesAdmittedWithoutRuntimeIntegration:true},null,2));
