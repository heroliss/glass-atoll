// Pure CPU policy proof for a possible promotion. No production edit or GL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {planSmokeTransmissionLayout as layout} from './r26-transmission-layout-candidate.js';
import {planTransmissionRectangles as rectangles} from './r26-transmission-rectangles.js';
const checks=[],sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
check('Active-count global18k/4096 old and explicit candidate envelopes fit at most4maps under both conservative slot caps',()=>{
 const cases=[];
 for(const maxRequestPairs of [1048576,1400000])for(const maxMapPairs of [1000000,1048576]){
  const a=layout(0,0,{maxSources:18000,maxPackets:4096,maxRequestPairs}).allocation.partial;assert.equal(a.width,256);
  let maximumMaps=0,maximumCells=0,witness=null;
  for(let packetCount=1;packetCount<=4096;packetCount++){
   const sourceCount=Math.min(18000,Math.floor(maxRequestPairs/packetCount)),p=rectangles({sourceCount,packetCount,partialStride:sourceCount,partialWidth:a.width,maxMapPairs,maxDraws:9});assert(p.supported);assert(p.mapRects.every(r=>r.conservativePairs<=maxMapPairs));assert(p.completeCells<=a.logicalCapacity);
   if(p.mapDraws>maximumMaps){maximumMaps=p.mapDraws;witness={sourceCount,packetCount};}maximumCells=Math.max(maximumCells,p.completeCells);
  }
  // For fixedNp, count*ceil(Np/64) is monotone inNs. Starting at address0,
  // decompose has only full rows grouped in floor(floor(cap/64)/width) batches,
  // followed by at most one row prefix. This bounds every smaller feasibleNs,
  // not merely the4096 sampled maximum-count witnesses.
  const fullRowsPerMap=Math.floor(Math.floor(maxMapPairs/64)/a.width),allCountsUpperBound=Math.ceil(Math.floor(maximumCells/a.width)/fullRowsPerMap)+1;
  assert(fullRowsPerMap>0);assert(maximumMaps<=4&&allCountsUpperBound<=4);cases.push({maxRequestPairs,maxMapPairs,packetCountsChecked:4096,partial:a,maximumCells,maximumMaps,witness,fullRowsPerMap,allCountsUpperBound,defaultMapDrawCap8Sufficient:true});
 }
 return{cases,proofScope:'Exact global18k/4096 active-count layout and both declared conservative per-map slot caps; no timing or shader optical guarantee'};
});
check('Historical logical≤1048576 request16131x65 needs4maps at1000000slots and remains covered by default8',()=>{
 const p=rectangles({sourceCount:16131,packetCount:65,partialWidth:256,maxMapPairs:1000000,maxDraws:9});assert(p.supported);assert.equal(p.logicalPairs,1048515);assert(p.logicalPairs<=1048576);assert.equal(p.mapDraws,4);assert.equal(p.totalDraws,5);assert(p.mapDraws<=8);
 const three=rectangles({sourceCount:16131,packetCount:65,partialWidth:256,maxMapPairs:1000000,maxDraws:4});assert.equal(three.supported,false);
 return{logicalPairs:p.logicalPairs,conservativeSlots:p.conservativePairs,maps:p.mapDraws,totalDraws:p.totalDraws,rects:p.mapRects.map(r=>[r.x,r.y,r.width,r.height]),threeMapCapWouldRegress:true};
});
check('Legacy-max padding has a different QA policy and cannot share the promoted active-count map-cap proof',()=>{
 const caps={maxSources:18000,maxPackets:4096,maxRequestPairs:1048576,layoutMode:'legacy-max'},a=layout(1,4096,caps),p=rectangles({sourceCount:1,packetCount:4096,partialStride:18000,partialWidth:a.allocation.partial.width,maxMapPairs:1000000,maxDraws:9});assert.equal(a.supported,true);assert.equal(a.pairs,4096);assert.equal(a.mapDomainTexels,1152000);assert.equal(p.supported,false);assert.equal(p.conservativePairs,73728000);
 return{logicalPairs:a.pairs,paddedCells:a.mapDomainTexels,conservativeSlots:p.conservativePairs,new8MapScheduleUnsupported:true,proposedCompatibility:'Keep explicit legacy-max historical two-pass comparator under unchanged maxPairs<=1048576; reject explicit maxRequestPairs>1048576 in that QA mode. Do not claim active-count map-cap policy applies to the comparator.'};
});
const pins=Object.fromEntries(['r26-transmission-layout-candidate.js','r26-transmission-rectangles.js'].map(name=>[name,sha(fs.readFileSync(new URL('./'+name,import.meta.url)))]));
const report={schema:'glass-atoll.r27-active-policy-independent-cpu.v1',dateUTC:new Date().toISOString(),actualGPU:false,productionEdits:0,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},checks,pins,compatibilityProposal:{maxPairs:'Retain incumbent argument/default3072 and limit1048576',maxRequestPairs:'Optional explicit active-count request allowance; effective=maxRequestPairs??maxPairs; bounded<=1400000',maxMapDraws:'Default8 maps, reduction separate; do not promote native-specific3map fixture cap',legacyMax:'Historical two-pass comparator path with oldlogical cap and no>1048576 promotion'},limits:['Pure policy/allocation geometry proof only. This does not admit larger native GPU requests, total frame budgets, optical numerics or production staging.','At most4maps is a geometric upper bound under these caps; it is not a frame-time/FPS target or a permanent user-specified workload ceiling.']};
fs.writeFileSync(new URL('./r27-active-policy-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
