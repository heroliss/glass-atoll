// Generate QA-only candidate assets; official export and original helpers are sealed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {buildAccurateAtan2Candidate,ATAN_CANDIDATE_VERSION} from './aces2-atan-math.js';
const root=new URL('./',import.meta.url),directory=new URL('./aces2-atan-candidate/',root),read=file=>fs.readFileSync(new URL(file,root),'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),write=(file,text)=>fs.writeFileSync(new URL(file,directory),text),exact=(source,from,to)=>{assert.equal(source.split(from).length-1,1,'Expected exact single generator anchor: '+from.slice(0,80));return source.replace(from,to);};
const seals={
 'aces2-gpu-check.js':'423ed607411bb213cdedd318e96d60e2a23e049415e00a02a34324a2819c5496',
 'aces2-stage-gpu-check.js':'725ddf0139306afffc40d4535b293170e7811bb32473300b225288f346667642',
 'aces2-oracle/export-report.json':'dc28a8de0cb7bb582c07ade5690c913d67b7f1df220f135b8f2fd3c28b24d1c9',
 'aces2-gpu-first.json':'682d1c51d227552bee7af07f5b2e0b6c93fbf531b4d3a90b299bb22ae4d3708a',
 'aces2-stage-oracle/stage-report.json':'4fb23a9563bb939d4c0e2d50f9431be8c0c2e5abfcb9eef032b48a5691d8ee59',
};
for(const [file,hash]of Object.entries(seals))assert.equal(sha(read(file)),hash,'Frozen evidence changed: '+file);
fs.mkdirSync(directory,{recursive:true});
write('OCIO-LICENSE.txt',read('aces2-oracle/OCIO-LICENSE.txt'));
write('README.md','# QA-only accurate atan2 candidate\n\nThis is a non-official numerical substitution in the OpenColorIO2.6.0 exported ACES2 shaders. Production HDR, look and defaults do not import it. Original files in ../aces2-oracle and the first52/53 report are unchanged.\n\nOnly the unique `atan(Aab.b, Aab.g)` call is replaced by a generic range-reduced degree17 atan2 function; the complete function exactly inverts to the sealed official source. CPU inputs/expected outputs and both hue tables are borrowed by relative paths without modification. `candidate-descriptor.js` records hashes and scope. The official export compatibility schema is retained only so the unchanged numerical probe can load these explicit candidate assets; it does not make this an official OCIO export or certification.\n\nOCIO-LICENSE.txt covers the original OpenColorIO-derived shader text. See ../ACES2-ATAN-CANDIDATE-NOTES.md for gates, use and limitations.\n');
const index=JSON.parse(read('aces2-oracle/export-report.json')),transformRows=[];
for(const entry of index.targets){
 const original=read('aces2-oracle/'+entry.functionFile),fragment=read('aces2-oracle/'+entry.probeFragmentFile),built=buildAccurateAtan2Candidate(original);
 assert.equal(sha(original),entry.functionSHA256);assert.equal(sha(fragment),entry.probeFragmentSHA256);
 assert.equal(built.normalize(built.source),original);assert.equal(fragment.split(original).length-1,1);
 const candidateFragment=fragment.replace(original,built.source),functionFile=`aces2-${entry.peakNits}-accurate-atan.glsl`,probeFragmentFile=`aces2-${entry.peakNits}-accurate-atan-probe.frag`;
 write(functionFile,built.source);write(probeFragmentFile,candidateFragment);
 transformRows.push({peakNits:entry.peakNits,officialFunctionFile:entry.functionFile,officialFunctionSHA256:entry.functionSHA256,functionFile,functionSHA256:sha(built.source),probeFragmentFile,probeFragmentSHA256:sha(candidateFragment),replacement:{from:built.from,to:built.to,count:1},prefixSHA256:sha(built.prefix),inverseExact:true});
 entry.functionFile=functionFile;entry.functionSHA256=sha(built.source);entry.functionCharacters=built.source.length;entry.probeFragmentFile=probeFragmentFile;entry.probeFragmentSHA256=sha(candidateFragment);
 entry.algorithm='Non-official generic accurate atan2 arithmetic candidate; every other official colour expression unchanged.';
 entry.cpuOracleFile='../aces2-oracle/'+entry.cpuOracleFile;
 for(const k of ['inputFile','expectedFile'])entry.gpuPattern[k]='../aces2-oracle/'+entry.gpuPattern[k];
 for(const table of entry.textures2D){for(const k of ['rgbaUploadFile','valuesFile','rawFile'])if(table[k])table[k]='../aces2-oracle/'+table[k];table.shaderPrecision='highp sampler2D; original hue tables and explicit interpolation unchanged; candidate replaces atan2 only';}
}
index.officialCPUExportEvidence={schema:index.schema,dateUTC:index.dateUTC,counts:index.counts,checksSHA256:sha(JSON.stringify(index.checks)),exportSHA256:seals['aces2-oracle/export-report.json'],scriptSHA256:index.scriptSHA256};
index.dateUTC='2026-10-27'; // Deterministic regeneration; source hashes bind actual bytes.
index.scriptSHA256=sha(read('build-aces2-atan-candidate.mjs'));
index.candidate={nonOfficial:true,productionIntegrated:false,version:ATAN_CANDIDATE_VERSION,sourceTransforms:transformRows,colourGateUnchanged:{absolute:2e-5,relative:2e-4},scope:'One generic atan2 arithmetic substitution per complete official shader. Same official CPU inputs, outputs, tables and all colour gates. This is not an official OCIO export or certification.'};
index.counts={total:3,passed:3};index.checks=transformRows.map(row=>({name:`${row.peakNits}: exact inverse to sealed official colour source`,passed:row.inverseExact}));
const indexText=JSON.stringify(index,null,2)+'\n',indexHash=sha(indexText);write('export-report.json',indexText);

// Preserve the known-good diagnostic GL/state machinery in an independent copy.
// Every generator change below is matched once, including the new acceptance gate.
const originalStage=read('aces2-stage-gpu-check.js');let stage=originalStage;
stage=exact(stage,'export async function runACES2StageGPUCheck(','export async function runACES2AtanStageGPUCheck(');
stage=exact(stage,"oldBase=new URL('./aces2-oracle/',import.meta.url)","oldBase=new URL('./aces2-atan-candidate/',import.meta.url)");
stage=exact(stage,seals['aces2-oracle/export-report.json'],indexHash);
stage=exact(stage,"schema:'glass-atoll.aces2-stage-GPU.v1'","schema:'glass-atoll.aces2-accurate-atan-stage-GPU.v1',nonOfficialCandidate:true,productionIntegrated:false");
stage=exact(stage,"originalAcceptance:'Frozen423 first report52/53 remains unchanged; this helper does not promote or replace it.'","originalAcceptance:'Frozen423 first report52/53 remains unchanged. This separate non-official atan2 candidate uses the identical colour threshold; stage instrumentation is not a replacement official CPU oracle.'");
stage=exact(stage,"check('frozen423_bad_blue_red_and_failed_gate_reproduced',ulp===0&&error>limit,row.frozenFirstFailure);","check('atan_candidate_bad_blue_uses_UNCHANGED_colour_gate',error<=limit,{...row.frozenFirstFailure,legacyEvidenceRetained:true,candidatePass:error<=limit});");
// These field names distinguish the candidate shader from the untouched original.
stage=stage.replaceAll('originalGPUvs','candidateGPUvs').replaceAll('originalGPU:','candidateUninstrumentedGPU:');
stage=exact(stage,'currentOriginalRed:baseline[i][0]','candidateActualRed:baseline[i][0]');
stage=exact(stage,'// QA-only ACES2 small-set stage diagnostics. No production chain or original423 edits.','// GENERATED QA-only non-official atan2 candidate stage diagnostics. Official423/725 untouched.');
stage+='\n// QA borrowing only: the independent generic-angle fixture reuses the same restored GL-state protocol.\nexport const ACES2AtanQAState=Object.freeze({capture,restore,differences,PIXEL_PARAMS});\n';
fs.writeFileSync(new URL('./aces2-atan-stage-gpu-check.js',root),stage);
const descriptor={schema:'glass-atoll.aces2-accurate-atan-candidate.v1',version:ATAN_CANDIDATE_VERSION,nonOfficial:true,productionIntegrated:false,indexSHA256:indexHash,stageHelperSHA256:sha(stage),mathSHA256:sha(read('aces2-atan-math.js')),generatorSHA256:sha(read('build-aces2-atan-candidate.mjs')),officialSeals:seals,sourceTransforms:transformRows,unchangedRawGate:{absolute:2e-5,relative:2e-4}};
write('candidate-descriptor.js','// Generated QA metadata; not imported by production.\nexport const ACES2_ATAN_CANDIDATE='+JSON.stringify(descriptor,null,2)+';\n');
for(const [file,hash]of Object.entries(seals))assert.equal(sha(read(file)),hash,'Generator modified frozen evidence: '+file);
console.log(JSON.stringify({indexSHA256:indexHash,stageHelperSHA256:sha(stage),targets:transformRows.map(r=>({peakNits:r.peakNits,functionSHA256:r.functionSHA256})),officialSealsPreserved:true},null,2));
