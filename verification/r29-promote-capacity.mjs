import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const read=n=>fs.readFileSync(n,'utf8'),json=n=>JSON.parse(read(n)),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const n of ['r29-independent-capacity-policy-check.json','r29-root-capacity-hook-check.json','r29-native-peaks-independent-check.json'])assert.equal(json('verification/'+n).passed,true,n);
const p=json('verification/r29-capacity-staging-pins.json');
for(const[n,b]of Object.entries(p.sourceBefore))assert.equal(sha(fs.readFileSync(n)),b.sha256,n);
for(const[n,b]of Object.entries(p.staging))assert.equal(sha(fs.readFileSync('verification/r29-capacity-staging/'+n)),b.sha256,n);
const writes={};for(const n of ['pyro-smoke-transmission-pack.js','pyro-smoke-light-tiles.js','main.js']){
 let s=read('verification/r29-capacity-staging/'+n);if(n==='pyro-smoke-light-tiles.js')s=s.replace("from '../../smoke-transmission-rectangles.js'","from './smoke-transmission-rectangles.js'");writes[n]=s;
}
for(const[n,s]of Object.entries(writes))fs.writeFileSync(n,s);
const T=await import('../pyro-smoke-transmission-gpu.js'),pack=await import('../pyro-smoke-transmission-pack.js'),layout=await import('../smoke-transmission-layout.js'),L=await import('../pyro-smoke-light-field.js'),tiles=await import('../pyro-smoke-light-tiles.js');
const names=Object.keys(p.sourceBefore),source=Object.fromEntries(names.map(n=>[n,{sha256:sha(fs.readFileSync(n)),bytes:fs.statSync(n).size}]));
const functions=Object.fromEntries(Object.entries({createTransmission:T.createSmokeTransmissionGPU,planTransmission:pack.planSmokeTransmission,packTransmission:pack.packSmokeTransmissionInputs,layoutTransmission:layout.planSmokeTransmissionLayout,createLightField:L.createPyroSmokeLightField,packLight:L.packSmokeLightPackets,planLight:tiles.planSmokeLightTiles,tileFactory:tiles.createSmokeLightTileBaker}).map(([k,f])=>[k,sha(Function.prototype.toString.call(f))]));
const report={schema:'glass-atoll.r29-capacity-promotion.v1',calibrationPending:true,requiredJobs:['source-peak','light-peak','joint-peak'],source,functions,ceiling:{transmission:4000000,lighting:4000000,maxMapPairs:1000000,maxMapDraws:8},runtimeChanged:Object.keys(writes),scope:'Capacity-only three literal changes plus four explicit daily budgets and three exclusive QA methods. Existing kernels/scheduler/state/old library defaults preserved. Separate actual production calibration remains pending.'};
fs.writeFileSync('verification/r29-production-capacity-pins.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({capacityWritten:true,calibrationPending:true,runtimeChanged:report.runtimeChanged,source,functions},null,2));
