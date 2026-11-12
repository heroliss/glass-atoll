import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decomposeTransmissionInterval,planTransmissionRectangles} from './r26-transmission-rectangles.js';

const checks=[];
const check=(name,fn)=>{try{const detail=fn();checks.push({name,passed:true,detail});}catch(e){checks.push({name,passed:false,error:e.stack});}};
const source=readFileSync(new URL('./r26-transmission-rectangles.js',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
function assertRectangles(rects,begin,end,width,cap){
 let cursor=begin;
 for(const r of rects){
  assert.equal(r.begin,cursor);assert.equal(r.begin,r.y*width+r.x);assert.equal(r.end,r.begin+r.texels);
  assert.equal(r.texels,r.width*r.height);assert.ok(r.width>0&&r.height>0&&r.x>=0&&r.x+r.width<=width);
  assert.ok(r.texels<=cap);if(r.height>1){assert.equal(r.x,0);assert.equal(r.width,width);}
  // Enumerate raster coordinates independently, including wrap between every row.
  let local=r.begin;
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)assert.equal((r.y+y)*width+r.x+x,local++);
  assert.equal(local,r.end);cursor=r.end;
 }
 assert.equal(cursor,end);
}
function assertLogical(p){
 assert.equal(p.coveredCells,p.completeCells);assert.equal(p.mapDraws,p.mapRects.length);assert.equal(p.totalDraws,p.mapDraws+1);
 assertRectangles(p.mapRects,0,p.completeCells,p.partialWidth,Math.max(1,p.maxCellsPerMap));
 let pairCount=0,slotCount=0;
 for(const r of p.mapRects){let pairs=0;
  for(let a=r.begin;a<r.end;a++){
   const sourceId=a%p.partialStride,tile=Math.floor(a/p.partialStride);
   if(sourceId<p.sourceCount)for(let packet=tile*64;packet<Math.min((tile+1)*64,p.packetCount);packet++)pairs++;
  }
  assert.equal(r.logicalPairs,pairs);assert.equal(r.conservativePairs,r.texels*64);assert.ok(r.conservativePairs<=p.maxMapPairs);
  pairCount+=pairs;slotCount+=r.texels*64;
 }
 assert.equal(pairCount,p.logicalPairs);assert.equal(slotCount,p.conservativePairs);
}
check('755 packets by 1734 ordered sources: complete 1.30917m request, three exact maps plus one reduction',()=>{
 const p=planTransmissionRectangles({sourceCount:1734,packetCount:755,partialWidth:256,maxMapPairs:1_000_000,maxDraws:8});
 assert.equal(p.supported,true);assertLogical(p);assert.equal(p.logicalPairs,1_309_170);assert.equal(p.conservativePairs,1_331_712);
 assert.equal(p.mapDraws,3);assert.deepEqual(p.mapRects.map(({x,y,width,height})=>[x,y,width,height]),[[0,0,256,61],[0,61,256,20],[0,81,72,1]]);
 assert.equal(p.productionAdmitted,false);assert.equal(p.actualGPU,false);assert.equal(p.effective,false);
 return {logicalPairs:p.logicalPairs,padded64Pairs:p.conservativePairs,mapDraws:p.mapDraws,totalDraws:p.totalDraws,rectangles:p.mapRects};
});
check('Arbitrary interval decomposition: row tail, grouped whole rows and row prefix cover each cell once',()=>{
 let cases=0,cells=0;
 for(const width of [1,2,3,7,16,255,256])for(const cap of [1,2,7,16,255,256,511,1024])for(const begin of [0,1,width-1,width+1])for(const length of [0,1,width-1,width,width+1,width*3+5]){
  const end=begin+length,p=decomposeTransmissionInterval({begin,end,partialWidth:width,maxCellsPerRect:cap,maxRects:4095});
  assert.equal(p.supported,true);assertRectangles(p.rects,begin,end,width,cap);cases++;cells+=length;
 }
 return {cases,cells};
});
check('Independent pair enumeration: row wraps, incomplete packet tiles, legacy stride holes and low map budgets',()=>{
 let cases=0,cells=0;let seed=260427;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let i=0;i<700;i++){
  const n=next()%180+1,p=[1,63,64,65,127,128,129,755][next()%8],stride=n+next()%19,width=[1,3,16,64,255,256][next()%6],cap=64*(next()%513+1);
  const plan=planTransmissionRectangles({sourceCount:n,packetCount:p,partialStride:stride,partialWidth:width,maxMapPairs:cap,maxDraws:4096});
  assert.equal(plan.supported,true);assertLogical(plan);cases++;cells+=plan.completeCells;
 }
 return {cases,cells};
});
check('Physical address boundaries and non-divisible 64-slot budgets: 18000 sources, 4096 packets',()=>{
 const p=planTransmissionRectangles({sourceCount:18000,packetCount:4096,partialWidth:256,maxMapPairs:1_048_575,maxDraws:100});
 assert.equal(p.supported,true);assert.equal(p.completeCells,1_152_000);assert.equal(p.logicalPairs,73_728_000);assert.equal(p.maxCellsPerMap,16383);
 assertLogical(p);assert.ok(p.mapRects.every(r=>r.conservativePairs<=1_048_575));
 const one=planTransmissionRectangles({sourceCount:1,packetCount:1,partialWidth:256,maxMapPairs:65,maxDraws:2});assertLogical(one);assert.equal(one.conservativePairs,64);
 return {maxCells:p.completeCells,maxLogicalPairs:p.logicalPairs,draws:p.totalDraws};
});
check('Empty inputs remain neutral: no map cells, one complete output reduction, no uncharged holes',()=>{
 for(const [n,p] of [[0,0],[0,65],[5,0]]){
  const plan=planTransmissionRectangles({sourceCount:n,packetCount:p,partialWidth:256,partialStride:18000,maxMapPairs:1,maxDraws:1});
  assert.equal(plan.supported,true);assert.equal(plan.neutral,true);assertLogical(plan);assert.equal(plan.totalDraws,1);assert.equal(plan.reductionReadTexels,0);
 }
 return {cases:3};
});
check('Rejected budget returns no executable prefix; exact reduction draw counts toward draw budget',()=>{
 const args={sourceCount:1734,packetCount:755,partialWidth:256,maxMapPairs:1_000_000};
 for(const maxDraws of [1,2,3]){const p=planTransmissionRectangles({...args,maxDraws});assert.equal(p.supported,false);assert.deepEqual(p.mapRects,[]);assert.equal(p.coveredCells,0);assert.equal(p.totalDraws,null);}
 assert.equal(planTransmissionRectangles({...args,maxDraws:4}).supported,true);
 const p=planTransmissionRectangles({sourceCount:1,packetCount:1,partialWidth:256,maxMapPairs:63,maxDraws:2});assert.equal(p.supported,false);assert.deepEqual(p.mapRects,[]);assert.equal(p.reason,'one64-slot-cell-exceeds-map-capacity');
 return {rejectedBudgets:4};
});
check('Invalid numeric domains reject: no unsafe integer, nonfinite, impossible width/stride or allocation-sized arguments',()=>{
 const args={sourceCount:2,packetCount:65,partialWidth:256,maxMapPairs:1_000_000};let cases=0;
 for(const field of Object.keys(args))for(const bad of [NaN,Infinity,-Infinity,-1,.5,Number.MAX_SAFE_INTEGER+1]){assert.throws(()=>planTransmissionRectangles({...args,[field]:bad}),RangeError);cases++;}
 for(const patch of [{sourceCount:18001},{packetCount:4097},{partialWidth:0},{partialWidth:257},{partialStride:0},{partialStride:1},{partialStride:18001},{maxMapPairs:0},{maxMapPairs:73728001},{maxDraws:0},{maxDraws:4097}]){assert.throws(()=>planTransmissionRectangles({...args,...patch}),RangeError);cases++;}
 for(const patch of [{begin:3,end:2},{begin:0,end:1152001},{begin:0,end:1,maxCellsPerRect:0},{begin:0,end:1,maxRects:4096}]){assert.throws(()=>decomposeTransmissionInterval({partialWidth:256,maxCellsPerRect:64,...patch}),RangeError);cases++;}
 return {rejectedCases:cases};
});
check('Plans are deeply immutable and verification-only; pure module contains no render/context/import/publication path',()=>{
 const p=planTransmissionRectangles({sourceCount:257,packetCount:65,partialWidth:256,maxMapPairs:16384,maxDraws:10});assertLogical(p);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.mapRects)&&p.mapRects.every(Object.isFrozen));
 assert.throws(()=>{p.mapRects[0].width=1;},TypeError);assert.throws(()=>p.mapRects.push({}),TypeError);
 assert.equal(p.requiredAfterAllMaps,true);assert.match(p.borrowedOutputPolicy,/before any next prepare/);
 assert.doesNotMatch(source,/\bimport\b|\bgetContext\s*\(|\brender\s*\(|\breadPixels\s*\(|\bfetch\s*\(/);
 return {sourceSHA256:sha(source),scope:p.scope};
});
const report={schema:'glass-atoll.r26.rectangle-independent-cpu-check.v1',actualGPU:false,productionChanged:false,passed:checks.every(c=>c.passed),summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:sha(source),checks};
writeFileSync(new URL('./r26-transmission-rectangles-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
