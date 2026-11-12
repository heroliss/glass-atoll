import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),pin=p=>({sha256:sha(read(p)),bytes:read(p).length});
const previousPath='verification/r37-final-manifest.json',previous=json(previousPath);
assert.equal(pin(previousPath).sha256,'5ca4ce36cd79ee563d3c95c3dd03f4439683e38e1596ce849ebae94c879b21ad');
const candidatePins={'fireworks.js':'3f1093fa5fba26abfb2f53b15e390baf9f1a9b0fc0e5e1938d0feb2270004605','firework-layer-profile.js':'411ebd75fec379582e5d94086e40241d9f8c388c3c96a668bbbbb5af5d948715'};
for(const [p,h]of Object.entries(previous.source))assert.deepEqual(pin(p),candidatePins[p]?{sha256:candidatePins[p],bytes:read(p).length}:h,p);
const baseline='verification/baselines/r38-before-taps-writer/',saved=json(baseline+'manifest.json');
for(const [p,h]of Object.entries(saved.source)){assert.deepEqual(pin(baseline+p),h,p);assert.deepEqual(h,previous.source[p],p);}
const archive='verification/baselines/r38-rejected-taps-writer/';
assert.equal(fs.existsSync(new URL(archive,root)),false,'never overwrite candidate archive');
const checks=['verification/r38-fw-emission-bins-check.json','verification/r38-taps-writer-check.json','verification/r38-taps-writer-independent-check.json'];
for(const p of checks)assert.equal(json(p).passed,true,p);
const decision=json('verification/r38-fw-taps-caller-receipt.json');assert.equal(decision.performanceAdmissionPassed,false);assert.equal(decision.candidateRejected,true);assert.equal(decision.nativeABCancelled,true);
const evidence=fs.readdirSync(new URL('verification/',root)).filter(p=>/^r38-|^R38-/.test(p)&&fs.statSync(new URL('verification/'+p,root)).isFile()&&!p.startsWith('r38-user-state-')).map(p=>'verification/'+p);
const paths=[...new Set([...Object.keys(previous.source),...evidence])].sort(),entries={};
for(const p of paths){const dest=new URL(archive+p,root);fs.mkdirSync(new URL('./',dest),{recursive:true});fs.writeFileSync(dest,read(p));entries[p]=pin(p);assert.deepEqual(pin(archive+p),entries[p]);}
const record={schema:'glass-atoll.r38-rejected-taps-writer-archive.v1',createdUTC:new Date().toISOString(),sourceBasis:previousPath,candidatePins,entries,performanceAdmissionPassed:false,nativeABExecuted:false,note:'Frozen candidate and CPU evidence. Production restored separately. Scripts bind current root imports; reproduce using these archived source overrides and pinned unchanged inputs, not restored production.'};
fs.writeFileSync(new URL(archive+'manifest.json',root),JSON.stringify(record,null,2)+'\n');
for(const p of Object.keys(candidatePins))fs.writeFileSync(new URL(p,root),read(baseline+p));
for(const [p,h]of Object.entries(previous.source))assert.deepEqual(pin(p),h,p);
const result={schema:'glass-atoll.r38-taps-writer-rejection-restore.v1',passed:true,restoredUTC:new Date().toISOString(),archive:{path:archive+'manifest.json',...pin(archive+'manifest.json'),entries:paths.length},productionAllPreviousSourceExact:Object.keys(previous.source).length,productionSourceChanges:[],restored:Object.keys(candidatePins).map(p=>({path:p,...pin(p)})),mainUnchanged:true,approvedAudio:{path:'fireworks-audio.js',...pin('fireworks-audio.js')},performanceAdmissionPassed:false,nativeABExecuted:false,browserReloadRequired:false,reason:'324 complete CPU flow samples show mixed small effects and no improvement at target+1.7; candidate never loaded in current browser.'};
fs.writeFileSync(new URL('verification/r38-rejection-restore.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
