import assert from 'node:assert/strict';
import {hdrMapLinear,sdrFilmicAnchor,srgbEncodeExtended,decodeFloat16,selectHDRDisplay,resolveHDRCalibration} from '../hdr-output.js';
const checks=[],calibration={paperWhiteNits:280,peakNits:1270,sdrWhiteNits:280,calibrationSource:'test-fixture'};
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
const near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
check('black has no artificial pedestal',()=>assert.deepEqual(hdrMapLinear([0,0,0],calibration),[0,0,0]));
check('filmic neutral anchor agrees with independent decimal reference',()=>{
  // Separate 45-digit decimal evaluation of the published fit coefficients.
  for(const [input,expected]of [[.01,.0024306057273716615],[.18,.21310544571434542],[.5,.5575863348840634],[1,.7633974415576376]])near(sdrFilmicAnchor([input,input,input])[0],expected);
});
check('OS-matched paper white keeps the SDR anchor below exposed peak one',()=>{
  for(const rgb of [[.01,.03,.07],[.18,.18,.18],[1,.5,.2]]){const a=hdrMapLinear(rgb,calibration),b=sdrFilmicAnchor(rgb);a.forEach((value,i)=>near(value,b[i]));}
});
check('paper white scales display nits without changing exposure',()=>{
  const rgb=[.5,.2,.1],base=sdrFilmicAnchor(rgb),mapped=hdrMapLinear(rgb,{...calibration,paperWhiteNits:203});mapped.forEach((value,i)=>near(value*280,base[i]*203));
});
check('exposure is applied once at the independent grey anchor',()=>near(hdrMapLinear([.18/.76,.18/.76,.18/.76],{...calibration,exposure:.76})[0],.21310544571434542));
check('peak conversion uses OS SDR white instead of native scRGB 80',()=>{
  for(const peakNits of [700,1200,1270])near(hdrMapLinear([10000,10000,10000],{...calibration,peakNits})[0]*280,peakNits,1e-8);
});
check('neutral ramp is monotone and bounded in target display nits',()=>{
  let last=0;for(let i=0;i<20000;i++){const v=hdrMapLinear([i*.01,i*.01,i*.01],calibration)[0]*280;assert.ok(v+1e-9>=last&&v<=1270+1e-9);last=v;}
});
check('highlight expansion is C1 at exposed peak one',()=>{
  const e=1e-5,below=hdrMapLinear([1-e,1-e,1-e],calibration)[0],at=hdrMapLinear([1,1,1],calibration)[0],above=hdrMapLinear([1+e,1+e,1+e],calibration)[0];near((above-at)/e,(at-below)/e,5e-5);
});
check('sRGB is encoded once and retains extended values',()=>{near(srgbEncodeExtended(.18),.46135612950044164);assert.ok(srgbEncodeExtended(1270/280)>1);});
check('binary16 decoder covers normal and subnormal',()=>{near(decodeFloat16(0x4000),2);near(decodeFloat16(1),2**-24);near(decodeFloat16(0xbc00),-1);});
const displays=[{deviceName:'right',attached:true,bounds:{left:0,top:0,right:2560,bottom:1440},scaleFactor:1,maxLuminanceNits:700,sdrWhiteNits:280,foregroundMonitor:false},{deviceName:'left',attached:true,bounds:{left:-2560,top:0,right:0,bottom:1440},scaleFactor:1,maxLuminanceNits:1270,sdrWhiteNits:280,foregroundMonitor:true}],report={available:true,displays};
check('explicit display overrides foreground',()=>assert.equal(selectHDRDisplay(report,{deviceName:'right'}).display.deviceName,'right'));
check('foreground selection states its uncertainty',()=>assert.equal(selectHDRDisplay(report).confidence,'foreground-observation'));
check('reliable negative-coordinate screen uniquely matches',()=>assert.equal(selectHDRDisplay(report,{screenReliable:true,screen:{left:-2560,top:0,width:2560,height:1440}}).display.deviceName,'left'));
check('ambiguous screens are not guessed',()=>assert.equal(selectHDRDisplay(report,{preferForeground:false}).display,null));
check('auto uses the selected native peak, not example 1200',()=>{const c=resolveHDRCalibration(report);assert.equal(c.peakNits,1270);assert.equal(c.paperWhiteNits,280);assert.equal(c.calibrationSource,'windows-dxgi');});
check('manual example is labelled override',()=>{const c=resolveHDRCalibration(report,{peakNits:1200});assert.equal(c.peakNits,1200);assert.equal(c.nativePeakNits,1270);assert.equal(c.calibrationSource,'manual-override');});
check('missing native data exposes fallback assumptions',()=>{const c=resolveHDRCalibration({available:false,displays:[]});assert.equal(c.calibrationSource,'unverified-fallback');assert.equal(c.nativePeakNits,null);});
console.log(JSON.stringify({passed:true,checks,limits:'Display-target invariants and independent decimal anchors. Actual GPU uses original vendored OutputPass as a separate oracle; no photometer or absolute scene-radiance claim.'},null,2));
