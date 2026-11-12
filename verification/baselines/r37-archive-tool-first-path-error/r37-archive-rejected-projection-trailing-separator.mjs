// One-time recoverable capture of a rejected CPU candidate, then exact baseline restore.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const archive=path.join(root,'verification/baselines/r37-rejected-source-projection-reuse');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidate='3d8d6bffe8a26e58a6f44c90e3aef1bdd09b11b43b3cf3b621d3f6e2a4d2809f';
const baseline='03fdb7038bffbfc769924ffff6ee57a51b5e9f8b2d3c72169d06e72b9d45c735';
assert.equal(hash(fs.readFileSync(path.join(root,'fireworks.js'))),candidate);
assert(!fs.existsSync(archive),'Refuse to replace the rejected evidence archive');
const seeds=[
 'fireworks.js','main.js','verification/r36-final-manifest.json',
 'verification/r36-radiant-normal-plus1p70-wide.json',
 'verification/baselines/r37-before-source-projection-reuse/fireworks.js',
 'verification/r37-projection-baseline-probe.mjs','verification/r37-projection-baseline-probe.json',
 'verification/r37-projection-cpu-fixture.mjs','verification/r37-projection-reuse-check.mjs',
 'verification/r37-projection-reuse-check.json','verification/r37-projection-reuse-cpu-abba.mjs',
 'verification/r37-projection-reuse-cpu-abba.json','verification/r37-projection-reuse-cpu-receipt.json',
 'verification/R37-PROJECTION-REUSE-CPU-RESULT.md',
];
const files=new Set();
function visit(relative){
 relative=relative.replaceAll('\\','/');if(files.has(relative))return;
 const absolute=path.resolve(root,relative);assert(absolute.startsWith(root+path.sep));
 const data=fs.readFileSync(absolute);files.add(relative);
 if(!/\.(?:m?js)$/.test(relative))return;
 const source=data.toString('utf8');
 for(const match of source.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g))visit(path.relative(root,path.resolve(path.dirname(absolute),match[1])));
}
seeds.forEach(visit);const entries=[];
for(const relative of [...files].sort()){
 const data=fs.readFileSync(path.join(root,relative)),target=path.join(archive,relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);
 assert.equal(hash(fs.readFileSync(target)),hash(data));entries.push({path:relative,bytes:data.length,sha256:hash(data)});
}
const manifest={schema:'glass-atoll.r37-rejected-projection-archive.v1',candidateSHA256:candidate,baselineSHA256:baseline,decision:'NOT PROMOTED: exact CPU output, negative CPU timing; archive precedes production restore.',entryCount:entries.length,totalBytes:entries.reduce((n,x)=>n+x.bytes,0),entries};
fs.writeFileSync(path.join(archive,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const old=fs.readFileSync(path.join(root,'verification/baselines/r37-before-source-projection-reuse/fireworks.js'));assert.equal(hash(old),baseline);
fs.writeFileSync(path.join(root,'fireworks.js'),old);assert.equal(hash(fs.readFileSync(path.join(root,'fireworks.js'))),baseline);
const receipt={schema:'glass-atoll.r37-rejected-projection-restore.v1',passed:true,archive:'verification/baselines/r37-rejected-source-projection-reuse',archiveManifestSHA256:hash(fs.readFileSync(path.join(archive,'manifest.json'))),archiveEntries:entries.length,archiveBytes:manifest.totalBytes,rejectedCandidateSHA256:candidate,restoredFireworksSHA256:baseline,byteExactBaseline:true,candidateRetainedInProduction:false,sourceProjectionReuseAPIInProduction:false,actualGPU:false,browserActions:0,nativeContextCalls:0,reason:'216-sample CPU ABBA mean on/off1.268054 and median1.293381; complete keys/capture/copy cost outweighed repeated projection work.',performanceAdmissionPassed:false};
fs.writeFileSync(path.join(root,'verification/r37-projection-rejection-restore.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
