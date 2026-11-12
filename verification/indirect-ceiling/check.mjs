import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const candidate=fs.readFileSync(new URL('../../indirect-lighting.js',import.meta.url),'utf8');
const baseline=fs.readFileSync(new URL('./before/indirect-lighting.js',import.meta.url),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
// Expose the actual private factory only inside the copied in-memory test
// module. Count h() calls in both versions; this is work, not timing proof.
async function factory(source){
  assert(source.includes('function h(x,z){')&&source.includes('return {visibility,height:h,size};'));
  const instrumented=source.replace('function h(x,z){','let heightLookups=0;function h(x,z){heightLookups++;')
    .replace('return {visibility,height:h,size};','return {visibility,height:h,size,lookupCount:()=>heightLookups};')+'\nexport {createVisibility as testVisibility};';
  return (await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'))).testVisibility;
}
const [oldFactory,newFactory]=await Promise.all([factory(baseline),factory(candidate)]);
const heights=[()=>1,(x,z)=>1.1+.22*Math.cos(x*.3)*Math.sin(z*.41),(x,z)=>Math.max(-32,2-Math.hypot(x*.05,z*.08)),()=>-120,()=>1000000];
const volumes=[{center:[3,8,-2],radius:[3,8,5],extinction:.3},{center:[-9,6,8],radius:[6,5,3],extinction:.12}];
let seed=0x9631ab24;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const checks=[];
let total=0,oldLookups=0,newLookups=0;
for(let scene=0;scene<heights.length;scene++){
  const old=oldFactory(heights[scene],volumes,[-34,-24,68,48]),next=newFactory(heights[scene],volumes,[-34,-24,68,48]);
  // Independent rays include reversed order, endpoints outside the grid,
  // nearly-horizontal boundary cases and tall/negative-valued terrain.
  for(let i=0;i<2400;i++){
    const base=scene===4?1e6:0;
    const a=[rng()*180-90,base+(i%5===0?1.025+(rng()-.5)*1e-12:rng()*20-5),rng()*140-70];
    const b=[rng()*600-300,base+(i%7===0?a[1]-base:rng()*200-10),rng()*600-300];
    if(i%2===0){const t=a.splice(0,3,...b);b.splice(0,3,...t);}
    assert.equal(next.visibility(a,b),old.visibility(a,b));total++;
  }
  oldLookups+=old.lookupCount();newLookups+=next.lookupCount();checks.push({scene,passed:true,rays:2400,oldLookups:old.lookupCount(),newLookups:next.lookupCount()});
}
// A physical island-to-aerial-flower set: expected exact equality with a much
// shorter discrete terrain walk. Porous foliage attenuation remains active.
const land=(x,z)=>Math.max(-32,1.3-(x*x/900+z*z/400));
const old=oldFactory(land,volumes,[-34,-24,68,48]),next=newFactory(land,volumes,[-34,-24,68,48]);
for(let i=0;i<1200;i++){
  const a=[rng()*44-22,1.4+rng()*14,rng()*30-15],b=[29+rng()*70,70+rng()*100,7+rng()*40];
  assert.equal(next.visibility(a,b),old.visibility(a,b));total++;
}
assert(next.lookupCount()<old.lookupCount()*.05);
checks.push({scene:'island-to-aerial',passed:true,rays:1200,oldLookups:old.lookupCount(),newLookups:next.lookupCount(),lookupReduction:1-next.lookupCount()/old.lookupCount()});
const report={passed:true,total,scope:'Exact old/new sampled-visibility equality with copied private factories and deterministic rays; h() counts are algorithmic work, not hardware timing, frame rate or rendered image proof',sourceSHA256:hash(candidate),baselineSHA256:hash(baseline),oldLookups,newLookups,checks};
fs.writeFileSync(new URL('./check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,total,aerial:checks.at(-1)}));
