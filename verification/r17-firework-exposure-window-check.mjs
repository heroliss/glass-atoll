import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveFireworkExposure,sampleFixedReleaseEmberWindow,sampleCausalOpticalAnchor} from '../firework-exposure-window.js';

const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:error.stack});}};
const near=(a,b,tol=2e-12)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const rgbNear=(a,b,tol)=>{assert.equal(a.length,b.length);a.forEach((v,c)=>near(v,b[c],tol));};
const unit=rgb=>{const Y=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;return rgb.map(v=>v/Y);};
const gold=unit([1,.6,.17]),constant=()=>gold;
const sample=(emitter,window)=>sampleFixedReleaseEmberWindow({releaseTime:2,sourceIntensity:7,duration:.8,colourAtAge:constant,...emitter},{fromTime:2,toTime:2.8,...window});
// Independent composite Simpson integration of sampled colour on every
// clipped LUT segment. This shares no exponential primitive with the module.
function reference(emitter,{fromTime,toTime,bins=8}){
 const {releaseTime,sourceIntensity,duration,colourAtAge,colourSegments=1}=emitter,width=toTime-fromTime,start=fromTime-releaseTime,out=new Float64Array(bins*3);
 if(width===0){const c=start>=0&&start<=duration?colourAtAge(start).map(v=>v*sourceIntensity*Math.exp(-3.5*start/duration)):[0,0,0];for(let i=0;i<bins;i++)out.set(c,i*3);return out;}
 for(let bin=0;bin<bins;bin++){
  const left=start+width*bin/bins,right=start+width*(bin+1)/bins;
  for(let segment=0;segment<colourSegments;segment++){
   const lo=Math.max(0,left,duration*segment/colourSegments),hi=Math.min(duration,right,duration*(segment+1)/colourSegments);if(!(hi>lo))continue;
   const n=256,h=(hi-lo)/n,tot=[0,0,0];
   for(let i=0;i<=n;i++){const t=lo+i*h,c=colourAtAge(t),w=i===0||i===n?1:i%2?4:2,g=Math.exp(-3.5*t/duration)*w;for(let k=0;k<3;k++)tot[k]+=c[k]*g;}
   for(let k=0;k<3;k++)out[bin*3+k]+=sourceIntensity*h/3*tot[k]/(width/bins);
  }
 }
 return out;
}
check('causal exposure endpoints, represented width and zero shutter are explicit',()=>{
 const e=resolveFireworkExposure({physicalNow:20,shutterSeconds:.5});assert.deepEqual([e.from,e.to,e.anchor,e.durationSeconds],[19.5,20,19.75,.5]);assert.equal(e.mode,'causal-end');assert.ok(Object.isFrozen(e));
 const z=resolveFireworkExposure({physicalNow:-4,shutterSeconds:0});assert.deepEqual([z.from,z.to,z.anchor,z.durationSeconds],[-4,-4,-4,0]);const d=resolveFireworkExposure({physicalNow:20});assert.equal(d.shutterSeconds,1/120);
 for(const input of [{physicalNow:NaN},{physicalNow:0,shutterSeconds:-1},{physicalNow:0,shutterSeconds:1.1},{physicalNow:0,shutterSeconds:Infinity},{physicalNow:2**40,shutterSeconds:1e-8}])assert.throws(()=>resolveFireworkExposure(input));
});
check('constant unitY gold matches independent analytic exponential means in all24channels',()=>{
 const r=sample({},{}),width=.8,binWidth=width/8,expected=[];
 for(let i=0;i<8;i++){const lo=i*binWidth,hi=(i+1)*binWidth,I=7*Math.exp(-3.5*lo/.8)*(1-Math.exp(-3.5*(hi-lo)/.8))*.8/3.5/binWidth;expected.push(...gold.map(v=>v*I));}
 rgbNear(Array.from(r.rgbBins),expected);rgbNear(r.averageRGB,gold.map(v=>v*7*(1-Math.exp(-3.5))/3.5));assert.deepEqual(r.allPhaseColourMaximum,gold);return{averageRGB:r.averageRGB,channels:r.rgbBins.length};
});
check('birth clipping and extinction use the ORIGINAL whole-bin width, with no pre-birth emission',()=>{
 const emitter={releaseTime:2.25,sourceIntensity:7,duration:.4,colourAtAge:constant},window={fromTime:2,toTime:2.8};
 const r=sample(emitter,window),expected=reference(emitter,window);rgbNear(Array.from(r.rgbBins),Array.from(expected),3e-12);
 assert.deepEqual(Array.from(r.rgbBins.slice(0,6)),new Array(6).fill(0));assert.deepEqual(Array.from(r.rgbBins.slice(21,24)),[0,0,0]);
 const bin2I=7*(1-Math.exp(-3.5*.05/.4))*.4/3.5/.1;rgbNear(Array.from(r.rgbBins.slice(6,9)),gold.map(v=>v*bin2I));return{partialBirthBin:r.rgbBins.slice(6,9),normalisedBySeconds:.1,liveSeconds:.05};
});
check('zero-width windows use the exact instantaneous limit at birth end and outside support',()=>{
 for(const age of [-.1,0,.2,.8,.81]){const r=sample({releaseTime:0},{fromTime:age,toTime:age}),expected=age>=0&&age<=.8?gold.map(v=>v*7*Math.exp(-3.5*age/.8)):[0,0,0];for(let i=0;i<8;i++)rgbNear(Array.from(r.rgbBins.slice(i*3,i*3+3)),expected);rgbNear(r.averageRGB,expected);}
});
check('piecewise linear colour times exponential agrees with independent Simpson across knots',()=>{
 const red=unit([1,0,0]),green=unit([0,1,0]),blue=unit([0,0,1]),table=[red,green,blue],duration=.8;
 const colourAtAge=age=>{const x=Math.min(2,Math.max(0,age/duration*2)),i=Math.min(1,Math.floor(x)),u=x-i;return table[i].map((v,c)=>v*(1-u)+table[i+1][c]*u);};
 const emitter={releaseTime:2,sourceIntensity:11,duration,colourAtAge,colourSegments:2},window={fromTime:1.95,toTime:2.75};const actual=sample(emitter,window),expected=reference(emitter,window);rgbNear(Array.from(actual.rgbBins),Array.from(expected),2e-11);
 assert.ok(actual.allPhaseColourMaximum.every((v,c)=>v===Math.max(...table.map(a=>a[c]))));return{segmentOverlaps:actual.segmentOverlaps};
});
const duration=.88,table=Array.from({length:129},(_,i)=>unit([1,.7-.45*i/128,.2*(1-i/128)]));
const cooling=age=>{const x=Math.min(128,Math.max(0,age/duration*128)),i=Math.min(127,Math.floor(x)),u=x-i;return table[i].map((v,c)=>v*(1-u)+table[i+1][c]*u);};
const coolingMaximum=[0,1,2].map(c=>Math.max(...table.map(rgb=>rgb[c])));
check('128-segment cooling LUT integrates actual RGB ageing rather than current colour times scalar I',()=>{
 const emitter={releaseTime:4,sourceIntensity:17,duration,colourAtAge:cooling,colourSegments:128},window={fromTime:4.07,toTime:4.72},r=sample(emitter,window),expected=reference(emitter,window);rgbNear(Array.from(r.rgbBins),Array.from(expected),3e-11);rgbNear(r.allPhaseColourMaximum,coolingMaximum);
 const averageI=17*(Math.exp(-3.5*.07/duration)-Math.exp(-3.5*.72/duration))*duration/3.5/.65,currentColour=cooling(.72),wrong=currentColour.map(v=>v*averageI);assert.ok(Math.abs(r.averageRGB[0]-wrong[0])>.1);return{averageRGB:r.averageRGB,incorrectCurrentColourTimesAverageI:wrong};
});
check('provided root colour bound avoids full LUT evaluation and remains checked at visited nodes',()=>{
 let calls=0;const r=sample({releaseTime:0,duration,colourSegments:128,colourAtAge:age=>{calls++;return cooling(age);},allPhaseColourMaximum:coolingMaximum},{fromTime:.4,toTime:.408});
 const other=sample({releaseTime:0,duration,colourSegments:128,colourAtAge:cooling},{fromTime:.4,toTime:.408});rgbNear(Array.from(r.rgbBins),Array.from(other.rgbBins));assert.ok(calls<10);assert.equal(r.colourNodesEvaluated,calls);assert.deepEqual(r.allPhaseColourMaximum,coolingMaximum);return{evaluatedNodes:calls,fullLUTNodes:129};
});
check('narrow late windows retain finite energy even when absolute bin timestamps would collapse',()=>{
 const fromTime=2**40,toTime=fromTime+.001,largeDuration=2**42,r=sample({releaseTime:0,duration:largeDuration},{fromTime,toTime});
 const width=toTime-fromTime,expectedI=7*Math.exp(-3.5*(fromTime/largeDuration))*(-Math.expm1(-3.5*(width/largeDuration)))/(3.5*(width/largeDuration));rgbNear(r.averageRGB,gold.map(v=>v*expectedI),3e-14);
 assert.ok(r.rgbBins.every(v=>v>0));assert.equal(new Set(Array.from({length:9},(_,i)=>fromTime+width*i/8)).size<9,true);
 const f=1000.7,t=f+1e-8,s=sample({releaseTime:0,duration:2000},{fromTime:f,toTime:t}),scalar=7*Math.exp(-3.5*f/2000)*(-Math.expm1(-3.5*(t-f)/2000))/(3.5*(t-f)/2000);rgbNear(s.averageRGB,gold.map(v=>v*scalar),3e-13);return{largeClock:fromTime,representedWidth:width,naiveAbsoluteBinCount:new Set(Array.from({length:9},(_,i)=>fromTime+width*i/8)).size,expectedBins:8,lateTinyWindow:t-f};
});
check('zero source intensity, supplied output and linear optical scaling are independent of release time',()=>{
 const target=new Float32Array(30).fill(77),out=sample({sourceIntensity:0},{outRGB:target});assert.equal(out.rgbBins,target);assert.deepEqual(Array.from(target.slice(0,24)),new Array(24).fill(0));assert.deepEqual(Array.from(target.slice(24)),new Array(6).fill(77));assert.deepEqual(out.averageRGB,[0,0,0]);
 const one=sample({sourceIntensity:3},{fromTime:2.1,toTime:2.4}),two=sample({sourceIntensity:6},{fromTime:2.1,toTime:2.4});rgbNear(Array.from(two.rgbBins),Array.from(one.rgbBins).map(v=>2*v));rgbNear(two.averageRGB,one.averageRGB.map(v=>2*v));
 const translated=sample({releaseTime:-100},{fromTime:-99.9,toTime:-99.6});const original=sample({releaseTime:2},{fromTime:2.1,toTime:2.4});rgbNear(Array.from(translated.rgbBins),Array.from(original.rgbBins),2e-12);
});
check('all-phase colour bound covers every bin and final average without a second intensity multiplier',()=>{
 for(const window of [{fromTime:3.9,toTime:4.01},{fromTime:4.001,toTime:4.7},{fromTime:4.8,toTime:4.95}]){const r=sample({releaseTime:4,sourceIntensity:17,duration,colourAtAge:cooling,colourSegments:128,allPhaseColourMaximum:coolingMaximum},window);for(let i=0;i<r.rgbBins.length;i++)assert.ok(r.rgbBins[i]>=0&&r.rgbBins[i]<=17*coolingMaximum[i%3]*(1+1e-13));r.averageRGB.forEach((v,c)=>assert.ok(v<=17*coolingMaximum[c]*(1+1e-13)));}
});
check('actual midpoint anchor samples only a past state and does not retain callback vectors',()=>{
 const calls=[],position=[4,5,6],velocity=[1,2,3],r=sampleCausalOpticalAnchor({birth:0,physicalNow:1,shutterSeconds:.4,sampleAt:t=>{calls.push(t);return{position,velocity};}});
 assert.deepEqual(calls,[.8]);assert.equal(r.virtualBirthAnchor,false);assert.equal(r.sampledTime,.8);assert.deepEqual(r.position,position);position[0]=99;velocity[0]=99;assert.equal(r.position[0],4);assert.equal(r.velocity[0],1);
});
check('birth after midpoint uses an explicit virtual raster anchor, never a pre-birth or future sample',()=>{
 const calls=[],r=sampleCausalOpticalAnchor({birth:.8,physicalNow:1,shutterSeconds:.8,sampleAt:t=>{calls.push(t);assert.ok(t>=.8&&t<=1);return{position:[8,2,-1],velocity:[10,-4,2]};}});
 assert.deepEqual(calls,[.8]);assert.equal(r.virtualBirthAnchor,true);near(r.virtualOffsetSeconds,-.2);rgbNear(r.position,[6,2.8,-1.4]);assert.match(r.positionPolicy,/not a physical pre-birth/);
 let n=0;assert.equal(sampleCausalOpticalAnchor({birth:2,physicalNow:1,sampleAt:()=>{n++;}}),null);assert.equal(n,0);
 const z=sampleCausalOpticalAnchor({birth:-3,physicalNow:-2,shutterSeconds:0,sampleAt:t=>{assert.equal(t,-2);return{position:[0,0,0],velocity:[0,0,0]};}});assert.equal(z.virtualBirthAnchor,false);
});
check('virtual anchor plus centre velocity places constant-velocity late-born bin locations correctly',()=>{
 const birth=.8,now=1,S=.8,v=[10,3,-2],p0=[5,6,7],r=sampleCausalOpticalAnchor({birth,physicalNow:now,shutterSeconds:S,sampleAt:t=>({position:p0.map((x,c)=>x+v[c]*(t-birth)),velocity:v})});
 for(let i=0;i<8;i++){const t=now-S+(i+.5)*S/8;if(t<birth)continue;const raster=r.position.map((x,c)=>x+v[c]*(t-r.exposure.anchor)),actual=p0.map((x,c)=>x+v[c]*(t-birth));rgbNear(raster,actual);}
});
check('invalid callbacks units bounds outputs and unsupported domains reject atomically',()=>{
 const target=new Float64Array(24).fill(9),before=Array.from(target),bad=[
  ()=>sample({sourceIntensity:-1},{outRGB:target}),()=>sample({duration:0},{outRGB:target}),()=>sample({colourSegments:0},{outRGB:target}),()=>sample({colourAtAge:()=>[1,0,0]},{outRGB:target}),()=>sample({colourAtAge:()=>[NaN,0,0]},{outRGB:target}),()=>sample({allPhaseColourMaximum:[0,0,0]},{outRGB:target}),()=>sample({}, {fromTime:3,toTime:2,outRGB:target}),()=>sample({}, {fromTime:NaN,outRGB:target}),()=>sample({}, {outRGB:new Int32Array(24)}),()=>sample({}, {outRGB:new Float64Array(23)}),()=>sample({}, {bins:65,outRGB:target}),()=>sample({colourAtAge:()=>{throw new Error('colour failed');}},{outRGB:target})
 ];for(const run of bad)assert.throws(run);assert.deepEqual(Array.from(target),before);
 let calls=0;assert.throws(()=>sampleCausalOpticalAnchor({birth:0,physicalNow:1,sampleAt:async()=>{calls++;}}));assert.equal(calls,0);assert.throws(()=>sampleCausalOpticalAnchor({birth:0,physicalNow:1,sampleAt:()=>({position:[0,0,NaN],velocity:[0,0,0]})}));assert.throws(()=>sampleCausalOpticalAnchor({birth:0,physicalNow:1,sampleAt:()=>Promise.resolve({})}));
});
check('pure module introduces no runtime renderer timer imports or production source edits',()=>{
 const s=readFileSync(new URL('../firework-exposure-window.js',import.meta.url),'utf8');assert.doesNotMatch(s,/^import\s/m);assert.doesNotMatch(s,/\bTHREE\b|Math\.random\(|requestAnimationFrame|setTimeout\(|new\s+WebGL|\.getContext\(/);assert.match(s,/Math\.expm1/);return{rendererImports:0,randomCalls:0,newPasses:0};
});
const source=readFileSync(new URL('../firework-exposure-window.js',import.meta.url)),report={schema:'glass-atoll.r17-firework-exposure-window-cpu.v1',date:new Date().toISOString(),actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:createHash('sha256').update(source).digest('hex'),checks,limits:['Pure fixed-release discrete-ember exposure, not complete continuous release-grid history or whole-scene exposure.','Linear colour-segment model is exact for the declared LUT interpolant; callback physics is authored.','Source motion, camera motion, depth, PSF and changing smoke transmission are outside this helper.','CPU correctness and bounded callback counts do not establish native frame cost or GPU visual acceptance.']};
writeFileSync(new URL('./r17-firework-exposure-window-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
