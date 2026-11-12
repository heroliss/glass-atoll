// Build QA-only capacity copies; arithmetic and original production files stay untouched.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const modules={
 'pyro-smoke-transmission-pack.js':'r39-dense-pack.js',
 'smoke-transmission-layout.js':'r39-dense-layout.js',
 'pyro-smoke-transmission-gpu.js':'r39-dense-gpu.js',
 'pyro-smoke-light-tiles.js':'r39-dense-light-tiles.js',
 'pyro-smoke-light-field.js':'r39-dense-light-field.js',
};
const entries=[];
for(const [original,name]of Object.entries(modules)){
 const originalBytes=fs.readFileSync(new URL(original,root)),text=originalBytes.toString('utf8');let copied=text;
 const changes=original==='pyro-smoke-transmission-pack.js'?2:original==='pyro-smoke-light-tiles.js'?1:0;
 if(changes){assert.equal((text.match(/4000000/g)||[]).length,changes);copied=copied.replaceAll('4000000','12000000');}
 const paths=[];copied=copied.replace(/from (['"])(\.\/[^'"]+)\1/g,(whole,quote,path)=>{const file=path.slice(2),replacement=modules[file]?'./'+modules[file]:'../'+file;paths.push({from:path,to:replacement});return `from ${quote}${replacement}${quote}`;});
 let inverse=copied;for(const {from,to}of paths)inverse=inverse.replaceAll(to,from);if(changes)inverse=inverse.replaceAll('12000000','4000000');assert.equal(inverse,text,'Closed import/capacity inverse failed: '+original);
 const target='verification/'+name;fs.writeFileSync(new URL(target,root),copied);entries.push({original,target,originalSHA256:sha(originalBytes),candidateSHA256:sha(Buffer.from(copied)),originalBytes:originalBytes.length,candidateBytes:Buffer.byteLength(copied),ceilingLiteralChanges:changes,importRelocations:paths,byteExactInverse:true});
}
const report={schema:'glass-atoll.r39-dense-qa-copy-pins.v1',passed:true,productionChanged:false,explicitQACeiling:12000000,productionCeiling:4000000,constructorDefaultsChanged:false,shaderArithmeticChanged:false,entries};
fs.writeFileSync(new URL('verification/r39-dense-calibration-copy-pins.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,entries:entries.map(e=>({path:e.target,sha256:e.candidateSHA256}))},null,2));
