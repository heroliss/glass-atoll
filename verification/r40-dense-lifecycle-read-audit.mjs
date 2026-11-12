// Arithmetic/ledger read audit only. Does not replay physics or invoke GL.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),here=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const raw=read('verification/r40-dense-lifecycle-count.json'),d=JSON.parse(raw),rows=d.rows,checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,detail:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e).slice(0,3000)});}};
const max=fn=>rows.reduce((a,b)=>fn(b)>fn(a)?b:a),brief=r=>({time:r.time,firstBurstAge:r.phase,packets:r.packets,counts:[r.main.count,r.reflection.count,r.ledger.count],pairs:[r.work.main.pairs,r.work.reflection.pairs,r.work.SH.pairs],totalPairs:r.work.totalPairs,padded64Slots:r.work.totalPadded64Slots,reductionTextureFetches:r.work.totalReductionTextureFetches,freshNumericDraws:r.work.totalFreshDraws,mapDraws:[r.work.main.mapDraws,r.work.reflection.mapDraws,r.work.SH.mapDraws],merges:r.merges,forcedMerges:r.forcedMerges});
const intervals=predicate=>{const out=[];let start=-1;for(let i=0;i<=rows.length;i++){const yes=i<rows.length&&predicate(rows[i]);if(yes&&start<0)start=i;if(!yes&&start>=0){out.push({firstSample:rows[start].time,lastSample:rows[i-1].time,samples:i-start});start=-1;}}return out;};
check('Current source pins, fixed genuine producer, bounded cadence and no solver/GL',()=>{
 for(const [p,h] of Object.entries(d.sourcePins))assert.equal(sha(read(p)),h,p);
 assert.equal(d.generatorSHA256,sha(read('verification/r40-dense-lifecycle-count.mjs')));
 assert.equal(d.passed,true);assert.equal(d.actualGPU,false);assert.equal(d.nativeContextCalls,0);assert.equal(d.referenceOracleEvaluations,0);assert.equal(d.inertCPUTransmissionAcknowledgements,0);
 assert.equal(d.physicalHz,60);assert.equal(d.opticalHz,20);assert.equal(d.updates,1090);assert.equal(rows.length,263);assert(rows.length<=400);assert(d.wallMs<120000);
 assert.equal(rows.at(-1).time,18.15);assert(d.endTime>d.sourceSupportEnd+1);assert.equal(d.launches.length,2);assert(d.launches.every(x=>x.accepted));
 for(let i=1;i<rows.length;i++)assert(Math.abs(rows[i].time-rows[i-1].time-.05)<4e-15);
 return{sourcePins:Object.keys(d.sourcePins).length,wallMs:d.wallMs,physicalUpdates:d.updates,opticalEpochs:rows.length,opticalViewFills:rows.length*2,end:d.endTime,sourceSupportEnd:d.sourceSupportEnd};
});
check('Every original ordered row charged; three distinct consumer roles and complete arithmetic',()=>{
 for(const r of rows){
  assert.equal(r.main.opticalRecordGeneration,r.reflection.opticalRecordGeneration);if(r.main.active>0&&r.reflection.active>0)assert.notEqual(r.main.cameraKey,r.reflection.cameraKey);else if(r.main.cameraKey===null&&r.reflection.cameraKey===null){assert.equal(r.main.count,0);assert.equal(r.reflection.count,0);}
  const jobs=[[r.work.main,r.main.count,r.main.active,1],[r.work.reflection,r.reflection.count,r.reflection.active,1],[r.work.SH,r.ledger.count,r.ledger.count,3]];
  for(const [w,N,active,attachments] of jobs){assert.equal(w.count,N);assert.equal(w.active,active);assert.equal(w.orderedRowsCharged,N);assert.equal(w.pairs,r.packets*N);const cells=N===0||r.packets===0?0:attachments===3?r.packets*Math.ceil(N/64):N*Math.ceil(r.packets/64);assert.equal(w.partialCells,cells);assert.equal(w.padded64Slots,cells*64);assert.equal(w.reductionTextureFetches,cells*attachments);assert.equal(w.totalDraws,w.mapDraws+1);assert.equal(w.exceeds4m,w.pairs>4000000);assert.equal(w.exceeds12m,w.pairs>12000000);assert.equal(w.exceeds8Maps,w.mapDraws>8);assert.equal(w.exceeds16Maps,w.mapDraws>16);}
  assert.equal(r.work.totalPairs,jobs.reduce((s,[w])=>s+w.pairs,0));assert.equal(r.work.totalPadded64Slots,jobs.reduce((s,[w])=>s+w.padded64Slots,0));assert.equal(r.work.totalFreshDraws,jobs.reduce((s,[w])=>s+w.totalDraws,0));assert.equal(r.work.totalReductionTextureFetches,jobs.reduce((s,[w])=>s+w.reductionTextureFetches,0));
 }
 return{auditedEpochs:rows.length,mainAndMirrorSeparate:true,SHChargedOnce:true,neutralDraws:'Theoretical cold neutral-pass bound; hasActiveRequest governs actual submission, not an asserted live draw count'};
});
check('Sampled maxima before any density merge; 12m and map ceilings stated separately',()=>{
 const T=max(r=>r.work.main.pairs),L=max(r=>r.work.SH.pairs),J=max(r=>r.work.totalPairs);
 assert.equal(T.time,9.45);assert.equal(T.work.main.pairs,8426298);assert.equal(L.time,9.5);assert.equal(L.work.SH.pairs,8421700);assert.equal(J.work.totalPairs,25272520);
 assert.equal(J.work.totalFreshDraws,33);assert.equal(J.work.totalPadded64Slots,25407744);assert.equal(J.work.totalReductionTextureFetches,664116);
 assert.equal(T.merges,0);assert.equal(L.merges,0);assert.equal(J.merges,0);
 assert.equal(Math.max(...rows.flatMap(r=>[r.work.main.mapDraws,r.work.reflection.mapDraws,r.work.SH.mapDraws])),10);
 assert(rows.every(r=>r.work.main.pairs<=12000000&&r.work.reflection.pairs<=12000000&&r.work.SH.pairs<=12000000));
 return{main:brief(T),SH:brief(L),joint:brief(J),firstDensityMerge:rows.find(r=>r.merges>0)?.time};
});
check('All mass/future-emission reservations preserved; later normal capacity merges explicit',()=>{
 let residual=0;
 for(const r of rows){const m=r.mass;residual=Math.max(residual,Math.abs(m.airborne+m.deposited+m.escaped+m.explicitlyCleared+m.pendingMass-m.emitted),Math.abs(r.scheduler.allocatedArea-r.scheduler.materializedArea-r.scheduler.reservedArea));assert.equal(r.scheduler.registeredEvents,2);assert(r.packets<=4096);assert(r.scheduler.reservedArea>=0);assert.equal(m.explicitlyCleared,0);}
 assert(residual<1e-11);const s=d.finalSmokeDiagnostics.events,last=rows.at(-1);assert.equal(s.coverage,'all-logical');assert.equal(s.duplicates,0);assert.equal(s.releaseErrors,0);assert.equal(s.fault,null);assert.equal(s.remainingCells,0);assert.equal(s.reservedArea,0);assert.equal(s.allocatedArea,40.7);assert.equal(s.completedCoverage.length,2);assert(s.completedCoverage.every(e=>e.bodyCount===192&&e.materializedBodies===192));assert.equal(last.merges,755);assert.equal(last.forcedMerges,568);assert.equal(last.packets,4096);assert(Math.abs(last.mass.emitted-40.7)<1e-11);assert.equal(last.ledger.count,0);assert.equal(last.main.count,0);assert.equal(last.reflection.count,0);
 return{maximumAccountingResidual:residual,allocatedReferenceMatter:40.7,finalEmitted:last.mass.emitted,finalFuture:0,completeLogicalBodies:384,finalPackets:4096,normalMerges:755,ofWhichForced:568,firstMerge:rows.find(r=>r.merges>0)?.time,firstForcedMerge:rows.find(r=>r.forcedMerges>0)?.time};
});
check('Exact numerical map source is used and current production fallback remains unchanged',()=>{
 const source=read('verification/r40-dense-lifecycle-count.mjs');assert(source.includes("from'../smoke-transmission-rectangles.js'"));assert(source.includes('maxMapPairs:1000000,maxDraws:65'));assert(source.includes('captureOnlyAcknowledgement:prepared===1'));assert(source.includes('No T/SH numerical solve'));assert(!source.includes('referencePackedField'));assert(!source.includes('referenceSmokeTransmission'));
 const fw=read('fireworks.js');assert(fw.includes('if(batchRequested&&!gpuEffective)'));assert(fw.includes('stats.mediumQueries++;const T=typeof medium.writeTransmission'));assert(fw.includes('count:ordered.length,...sourceRayBuffers'));
 const field=read('pyro-smoke-light-field.js');assert(field.includes('pair-work-capacity'));
 return{productionSourcesUnchangedByStudy:true,CPUFallbackStillExists:true,largerBudgetNotPromoted:true,perMapBudget:1000000};
});
const thresholdIntervals={mainOver4m:intervals(r=>r.work.main.exceeds4m),reflectionOver4m:intervals(r=>r.work.reflection.exceeds4m),SHOver4m:intervals(r=>r.work.SH.exceeds4m),mainOver8Maps:intervals(r=>r.work.main.exceeds8Maps),SHOver8Maps:intervals(r=>r.work.SH.exceeds8Maps),anyOver12m:intervals(r=>r.work.main.exceeds12m||r.work.reflection.exceeds12m||r.work.SH.exceeds12m),anyOver16Maps:intervals(r=>r.work.main.exceeds16Maps||r.work.reflection.exceeds16Maps||r.work.SH.exceeds16Maps)};
const out={schema:'glass-atoll.r40-dense-lifecycle-read-audit.v1',passed:checks.every(c=>c.passed),passedChecks:checks.filter(c=>c.passed).length,totalChecks:checks.length,actualGPU:false,rawSHA256:sha(raw),scriptSHA256:sha(fs.readFileSync(new URL(import.meta.url))),thresholdIntervals,maxima:{main:brief(max(r=>r.work.main.pairs)),SH:brief(max(r=>r.work.SH.pairs)),joint:brief(max(r=>r.work.totalPairs))},checks,limits:['New60Hz producer, not all-value identity to sealed R39 physical20Hz capture.','20Hz sampled observed maximum only; no continuous or arbitrary launch-count bound.','All original optical rows retained. Later normal density capacity merging is reported, not described as unmerged full lifetime.','No numerical GPU timing, full-frame budget or production cap/policy promotion.']};
fs.writeFileSync(new URL('r40-dense-lifecycle-read-audit.json',here),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
