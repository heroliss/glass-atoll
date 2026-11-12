import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const old=JSON.parse(read('verification/r34-final-manifest.json')),folder='verification/baselines/r35-before-progress-update/';
fs.mkdirSync(new URL(folder,root),{recursive:true});
for(const path of ['README.md','verification/plans/PROGRESS.md','package.json']){
 const data=read(path),record=old.source[path]??old.artifacts[path];assert.equal(sha(data),record.sha256,path);
 const target=new URL(folder+path.split('/').at(-1),root);if(fs.existsSync(target))assert.deepEqual(fs.readFileSync(target),data);else fs.writeFileSync(target,data);
}
const p='package.json',before=read(p).toString(),needle='node --check firework-layer-profile.js',replacement=needle+' && node --check firework-scale-calibration.js';
assert.equal(before.split(needle).length,2);const after=before.replace(needle,replacement);fs.writeFileSync(new URL(p,root),after);
const receipt={schema:'glass-atoll.r35-check-command-update.v1',beforeSHA256:sha(before),afterSHA256:sha(after),scope:'Include the new pure module in the existing syntax check; no dependency or runtime configuration change'};
fs.writeFileSync(new URL('verification/r35-check-command-receipt.json',root),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
