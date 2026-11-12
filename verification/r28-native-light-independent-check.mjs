// Independent CPU review of the frozen, complete R28 native SH input/reference.
// No renderer/context is created and no production file is modified.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {R28_NATIVE_LIGHT_FIXTURE as fixture,R28_NATIVE_LIGHT_FIXTURE_DIGEST as digest,r28CanonicalJSON as canonical} from './r28-native-light-fixture.js';
import {R27_NATIVE_TRANSMISSION_FIXTURE as native,R27_NATIVE_TRANSMISSION_FIXTURE_DIGEST as nativeDigest} from './r27-native-transmission-fixture.js';
import {packSmokeLightPackets} from './baselines/r28-before-native-light/pyro-smoke-light-field.js';
import {boundSmokeLightField} from './baselines/r28-before-native-light/pyro-smoke-light-bound.js';
import {referencePackedField,groupBoundOracle} from './pyro-smoke-light-field-oracle.js';
const checks=[],sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(new URL(p,import.meta.url));
const bits=a=>Array.from(new Uint32Array(a.buffer,a.byteOffset,a.length));
const f32=words=>new Float32Array(Uint32Array.from(words).buffer);
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}};
const pins={
 './r28-native-light-fixture.js':'38a796ffe384a8b42e56cd5a03c65f58e81426c9483d79158be45c103ec15adf',
 './r28-native-light-fixture.json':'1d7954b58eef43c53ada4519ffcf2fb1ef375a31518963390c6d0b1447b2d2e1',
 './r28-native-light-fixture.mjs':'6ea1664b9d8b92c24cdea42978bc1b1180a3b36a8e35fe4cda59383d4895f98e'
};
const packets={data:f32(fixture.packing.packedPacketWordsU32),count:fixture.packing.packetCount,stride:4,capacity:fixture.packing.packedPacketCapacity,version:fixture.packing.packetVersion};
const ledger={...fixture.ledger,data:f32(fixture.ledger.dataWordsU32)};
check('Frozen module, JSON, generator and complete native physical/source association',()=>{
 for(const [file,pin]of Object.entries(pins))assert.equal(sha(read(file)),pin,file);
 assert.equal(sha(canonical(fixture)),digest);assert.equal(digest,'809b983e5e87f8c112a919e8f718f316f792619e664941972283e584d0bdd22d');
 assert.equal(canonical(fixture)+'\n',read('./r28-native-light-fixture.json').toString());
 assert.equal(fixture.provenance.r27ArtifactDigest,nativeDigest);assert.equal(canonical(fixture.snapshot),canonical(native.snapshot));
 assert.equal(packets.count,755);assert.equal(ledger.count,1728);assert.equal(ledger.capacity,14000);assert.equal(ledger.stride,8);
 assert.deepEqual(fixture.ledger.dataWordsU32.slice(0,1728*8),native.emissionLedger.dataWordsU32);
 assert(fixture.ledger.dataWordsU32.slice(1728*8).every(x=>x===0));
 for(const k of ['groups','version','recordGeneration','time','rawPerCandela','units'])assert.deepEqual(fixture.ledger[k],native.emissionLedger[k],k);
 const source=read('./r28-native-light-fixture.js').toString();assert.doesNotMatch(source,/^\s*import\b/m);assert.doesNotMatch(source,/referencePackedField\s*\(/);
 return{packetCount:packets.count,sourceCount:ledger.count,densityRevision:fixture.snapshot.revision,ledgerVersion:ledger.version,recordGeneration:ledger.recordGeneration,digest,allNativePhysicalAndSourceRowsRetained:true};
});
check('Unchanged receiver model and full input upload words, independent of packet mass',()=>{
 const packed=packSmokeLightPackets(fixture.snapshot,{capacity:4096,version:1});assert.deepEqual(bits(packed.data),fixture.packing.packedPacketWordsU32);
 const p=f32(fixture.packing.packetUploadWordsU32),s=f32(fixture.packing.sourceUploadWordsU32);assert.equal(p.byteLength,65536);assert.equal(s.byteLength,450560);
 for(let i=0;i<755;i++){const packet=fixture.snapshot.packets[i];for(let c=0;c<3;c++)assert.equal(p[i*4+c],Math.fround(packet.mean[c]));assert.equal(p[i*4+3],Math.fround((packet.covariance[0]+packet.covariance[4]+packet.covariance[8])/3));}
 assert.deepEqual(bits(p.subarray(0,755*4)),bits(packed.data));assert(p.subarray(755*4).every(x=>Object.is(x,0)));
 assert.deepEqual(bits(s.subarray(0,1728*8)),native.emissionLedger.dataWordsU32);assert(s.subarray(1728*8).every(x=>Object.is(x,0)));
 const changed=structuredClone(fixture.snapshot);for(const packet of changed.packets)packet.mass=packet.mass*3+1;assert.deepEqual(bits(packSmokeLightPackets(changed,{capacity:4096,version:1}).data),bits(packed.data));
 return{uploadedBytes:p.byteLength+s.byteLength,receiverModel:'Float32 mean and trace(Sigma)/3; source variance added in unchanged kernel',massAffectsIncidentSH:false,coefficientChannels:'RGBA=(C0,C1x,C1y,C1z), not alpha'};
});
check('Native exact rectangle coverage visits all ordered pair addresses once under the declared policy',()=>{
 const p=fixture.policy,seen=new Uint8Array(20385);assert.equal(p.logicalPairs,1304640);assert.equal(p.partialCapacityTexels,25971);assert.deepEqual(p.partialSize,[256,102]);assert.deepEqual(p.finalSize,[256,16]);assert.equal(p.bytes.total,1966080);
 assert.deepEqual(p.mapRects.map(r=>[r.x,r.y,r.width,r.height]),[[0,0,256,61],[0,61,256,18],[0,79,161,1]]);
 let orderedCell=0,pairs=0;for(const r of p.mapRects){assert.equal(r.begin,orderedCell);assert(r.width*r.height*64<=1000000);for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){const a=y*256+x;assert.equal(a,orderedCell++);assert.equal(seen[a]++,0);const packet=a%755,tile=Math.floor(a/755);assert(packet<755&&tile<27);for(let k=0;k<64;k++){const source=tile*64+k;if(source<1728)pairs++;}}assert.equal(orderedCell,r.end);}assert(seen.every(x=>x===1));assert.equal(pairs,755*1728);
 assert.deepEqual(p.reduceRect,[0,0,256,16]);assert.equal(p.finalSuffixMustBeZero,true);
 return{completeCells:seen.length,logicalPairs:pairs,mapSlots:p.mapRects.map(r=>r.width*r.height*64),draws:4,outputFullRows:4096,validCoefficientRows:755,numericalBytes:p.bytes.total};
});
check('Every stored signed coefficient/attachment, angular envelope and raw bound is internally consistent',()=>{
 assert.equal(fixture.oracle.rows.length,755);const ideal=groupBoundOracle(packets,ledger,{g:.32}),bound=boundSmokeLightField({packets,ledger,anisotropy:.32});assert.deepEqual(bound,fixture.rawBound);assert.deepEqual(ideal,fixture.idealGroupBound);
 let negative=0,negativeFourth=0,minimum=Infinity,maximum=0;
 for(let i=0;i<755;i++){const row=fixture.oracle.rows[i];assert.equal(row.index,i);for(let c=0;c<3;c++){const a=[row.C0[c],...row.C1.slice(c*3,c*3+3)];assert.deepEqual(fixture.oracle.attachmentsRGBA[c].slice(i*4,i*4+4),a);const n=Math.hypot(...a.slice(1));assert.equal(row.minimum[c],a[0]-n);assert.equal(row.maximum[c],a[0]+n);assert(a[0]>=0);assert(row.minimum[c]>=0);assert(row.maximum[c]<=ideal.rows[i][c]);assert(row.maximum[c]<=bound.maximumRGB[c]);minimum=Math.min(minimum,row.minimum[c]);maximum=Math.max(maximum,row.maximum[c]);negative+=a.slice(1).filter(x=>x<0).length;if(a[3]<0)negativeFourth++;}}
 assert.equal(negative,2973);assert.equal(negativeFourth,862);assert.equal(minimum,fixture.oracle.minimumAngular);assert.equal(maximum,fixture.oracle.maximumAngular);
 return{coefficients:755*12,negativeC1:negative,negativeFourthChannels:negativeFourth,minimumAngular:minimum,maximumAngular:maximum,rawBound:bound.maxRGB,normalizationBudget:.002,scope:'Isotropic average SH1; not anisotropic transport or incoming-path self-shadow'};
});
check('All 755 by 1728 offline positive-Laplace references replay without production special functions',()=>{
 const started=performance.now(),rows=referencePackedField(packets,ledger,{g:.32,nodes:256});assert.deepEqual(rows,fixture.oracle.rows);
 const oracleSource=read('./pyro-smoke-light-field-oracle.js').toString();assert.doesNotMatch(oracleSource,/^\s*import\b/m);assert.doesNotMatch(oracleSource,/smokeIsotropicMoments\s*\(/);
 return{receiverRows:rows.length,allSourcesPerRow:ledger.count,coefficientValues:rows.length*12,bitExactToFrozenRows:true,nodes:256,cpuMs:performance.now()-started,onlineReferenceWork:false};
});
check('Separately selected 384-node convergence witnesses retain signed coefficients and error budget',()=>{
 const indices=[0,128,377,709,720,754],started=performance.now();let maximum=0;
 for(const index of indices){const one={...packets,data:packets.data.slice(index*4,index*4+4),count:1,capacity:1},reference=referencePackedField(one,ledger,{g:.32,nodes:384})[0],base=fixture.oracle.rows[index],scale=Math.max(...base.C0,1e-30);for(let c=0;c<3;c++)maximum=Math.max(maximum,Math.abs(reference.C0[c]-base.C0[c])/scale);for(let c=0;c<9;c++)maximum=Math.max(maximum,Math.abs(reference.C1[c]-base.C1[c])/scale);}
 assert(maximum<2e-6);return{indices,nodes:384,maximumNormalizedDifference:maximum,cpuMs:performance.now()-started,scope:'Selected numerical falsification, not a universal floating point or quadrature certificate'};
});
const report={schema:'glass-atoll.r28-native-light-independent-cpu.v1',dateUTC:new Date().toISOString(),actualGPU:false,browserActions:0,productionEdits:0,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},checks,sourcePins:pins,limits:['Complete frozen input and independent numerical recipe review only; no candidate or hardware acceptance here.','The all-row replay reuses the existing independently derived positive-Laplace oracle, never production Dawson/erf.','Offline native data is a causal reconstruction with the documented R27 clock/wind/camera contract, not a recording of every browser frame.','Single SH request work/bytes do not prove whole-frame timing, sustained FPS or multi-firework lifetime coverage.']};
fs.writeFileSync(new URL('./r28-native-light-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed),oracle:checks[4].evidence,convergence:checks[5].evidence},null,2));if(!report.passed)process.exitCode=1;
