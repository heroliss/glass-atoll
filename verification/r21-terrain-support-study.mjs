import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createAtollAirSurface,ATOLL_AIR_SURFACE_LIMITS as L} from '../firework-surface.js';
const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8'),source=fs.readFileSync(new URL('../firework-surface.js',import.meta.url),'utf8'),terrainSource=main.match(/export function terrainHeight\(x,z\)\{[\s\S]*?\n\}/)?.[0];assert.ok(terrainSource);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),terrainHash=hash(terrainSource.replace(/\r\n/g,'\n')),terrainHeight=new Function('return '+terrainSource.replace('export ',''))(),surface=createAtollAirSurface(terrainHeight);
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}};
check('Actual main terrain formula and pure contract source are pinned',()=>{assert.equal(terrainHash,'4f880aba8bc75fc727e4a45538e27ff6b5208a25b0c94372f0e02ef11f7d4562');assert.ok(Object.isFrozen(surface)&&Object.isFrozen(L));return{terrainFormulaNormalizedSHA256:terrainHash,surfaceSHA256:hash(source),callback:'extracted exact actual main.js terrain function, without executing browser main'};});
check('Analytic upper-height positive-support and clipped-surface slope bounds have outward margin',()=>{
  const rough=.027,positiveCoreRadius=(1+rough/1.3)**(1/2.25),angularModulationMinimum=1-.045-.028-.017,angularModulationMaximum=1+.045+.028+.017,angularDerivativeBound=.045*3+.028*5+.017*9;
  const rSlope=Math.hypot(angularModulationMaximum,angularDerivativeBound)/19,roughSlope=.027*(Math.hypot(1.1,.27)+Math.hypot(.21,.82)+.8*.063),coreSlope=1.3*2.25*1.01**1.25*.063+roughSlope,spitSlope=2*Math.sqrt(.677/72)+roughSlope;
  assert.ok(positiveCoreRadius<1.01&&.677<L.spitPaddedQuadraticThreshold);assert.ok(angularModulationMinimum>=.91-1e-15&&rSlope<.063);assert.ok(Math.max(coreSlope,spitSlope)<L.maximumSpatialSlope);assert.equal(L.maximumHeight,1.3+.027);
  return{upperHeight:L.maximumHeight,positiveCoreRadius,angularModulationMinimum,angularModulationMaximum,angularDerivativeBound,rSlope,roughSlope,corePlusRoughSlopeBound:coreSlope,spitPlusRoughSlopeBound:spitSlope,acceptedMaximumSlope:L.maximumSpatialSlope,method:'analytic triangle/chain-rule bounds, not fitted to finite samples'};
});
check('Finite dense height and local-slope witnesses agree with exact callback and global bounds',()=>{
  let points=0,slopes=0,min=Infinity,max=-Infinity,maxSlope=0;
  for(let i=0;i<=640;i++)for(let j=0;j<=420;j++){
    const x=-50+i*.15625,z=-32+j*.1525,h=surface.heightAt(x,z,1),raw=Math.max(0,terrainHeight(x,z));assert.equal(h,raw);assert.ok(h>=0&&h<=L.maximumHeight);min=Math.min(min,h);max=Math.max(max,h);points++;
    if(i%4===0&&j%4===0){const eps=1e-4,hx=(surface.heightAt(x+eps,z)-surface.heightAt(x-eps,z))/(2*eps),hz=(surface.heightAt(x,z+eps)-surface.heightAt(x,z-eps))/(2*eps),s=Math.hypot(hx,hz);maxSlope=Math.max(maxSlope,s);assert.ok(s<L.maximumSpatialSlope);slopes++;}
  }
  return{points,centralDifferenceSlopeWitnesses:slopes,minimumHeight:min,maximumHeight:max,maximumSampledGradient:maxSlope,scope:'Finite witnesses only; global analytic inequalities are the certificate'};
});
check('Whole-rectangle padded-ellipse sea tests enclose interior and never certify endpoint-only island crossings',()=>{
  let rectangles=0,seaRectangles=0,witnesses=0;let seed=0x9a8c2d11;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<8000;i++){
    const x=-100+200*random(),z=-70+140*random(),w=40*random(),h=35*random(),region={minimumX:x,maximumX:x+w,minimumZ:z,maximumZ:z+h},b=surface.boundAtHorizontalRegion(region);rectangles++;
    if(!b.certifiedSeaOnly)continue;seaRectangles++;assert.equal(b.maximumHeight,0);assert.equal(b.maximumSpatialSlope,0);
    for(let a=0;a<=4;a++)for(let c=0;c<=4;c++){assert.equal(surface.heightAt(x+w*a/4,z+h*c/4),0);witnesses++;}
  }
  const crossing={minimumX:-1.5,maximumX:-1.5,minimumZ:-30,maximumZ:30};assert.equal(surface.heightAt(-1.5,-30),0);assert.equal(surface.heightAt(-1.5,30),0);assert.ok(surface.heightAt(-1.5,-1)>1);assert.equal(surface.boundAtHorizontalRegion(crossing).certifiedSeaOnly,false);
  return{rectangles,seaRectangles,witnesses,endpointOnlyTestWouldMissIsland:true,certificate:'Rectangle minimum quadratic coordinate excludes BOTH outward-padded ellipses'};
});
check('Centimetre ridge and underwater terrain branch step remain handled by the clipped-surface contract',()=>{
  const x=40.5,from=0,to=14;let peak=-Infinity,peakZ=0,positiveWidth=0;
  for(let z=from;z<=to;z+=.001){const h=surface.heightAt(x,z);if(h>peak){peak=h;peakZ=z;}if(h>0)positiveWidth+=.001;}
  assert.equal(surface.heightAt(x,from),0);assert.equal(surface.heightAt(x,to),0);assert.ok(peak>.009&&peak<.012&&positiveWidth<2);assert.equal(surface.boundAtHorizontalRegion({minimumX:x,maximumX:x,minimumZ:from,maximumZ:to}).certifiedSeaOnly,false);
  const a=Math.PI/2,F=1+.045*Math.sin(3*a+.8)+.028*Math.cos(5*a-1.2)+.017*Math.sin(9*a),point=r=>[-1.5+30*r/F*Math.cos(a),-1+19*r/F*Math.sin(a)],left=point(1.25-1e-8),right=point(1.25+1e-8),rawLeft=terrainHeight(...left),rawRight=terrainHeight(...right);assert.ok(rawLeft<0&&rawRight<0&&rawLeft-rawRight>.002);assert.equal(surface.heightAt(...left),0);assert.equal(surface.heightAt(...right),0);
  return{ridge:{x,fromZ:from,toZ:to,peakMetres:peak,peakZ,finiteEstimatedPositiveWidthMetres:positiveWidth},submergedBranch:{rawLeft,rawRight,jumpMetres:rawLeft-rawRight,clippedLeft:0,clippedRight:0},scope:'Actual narrow-ridge finite witness and branch asymptote; surface certificate never relies on endpoint samples'};
});
check('Invalid regions callbacks clocks and height-bound violations fail closed',()=>{
  const invalid=[()=>createAtollAirSurface(null),()=>createAtollAirSurface(async()=>0),()=>surface.heightAt(NaN,0),()=>surface.heightAt(0,Infinity),()=>surface.heightAt(0,0,NaN),()=>surface.boundAtHorizontalRegion({minimumX:1,maximumX:0,minimumZ:0,maximumZ:1}),()=>surface.boundAtHorizontalRegion({minimumX:0,maximumX:1,minimumZ:0,maximumZ:Infinity}),()=>createAtollAirSurface(()=>2).heightAt(0,0),()=>createAtollAirSurface(()=>Promise.resolve(0)).heightAt(0,0)];for(const f of invalid)assert.throws(f);return{rejections:invalid.length};
});
const report={schema:'glass-atoll.r21-terrain-air-surface-study.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:hash(source),terrainFormulaNormalizedSHA256:terrainHash,checks,limits:['Only the pinned current static main.js terrain and mean-sea zero surface. Arbitrary callbacks need a separate explicit contract.','Does not include animated wave crests, firework quenching, terrain collision response, smoke/material changes, renderer or GPU acceptance.','Region classification requires a conservative complete horizontal trajectory enclosure; endpoints alone are insufficient.']};fs.writeFileSync(new URL('./r21-terrain-support-study.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
