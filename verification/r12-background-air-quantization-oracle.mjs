// Independent verification only. This file does not edit or execute the app.
// DataUtils is RTZ (after conversion to FP32); do not infer GPU rounding from it.
import {DataUtils} from '../vendor/three.core.js';

export const MIN_HALF_SUBNORMAL=2**-24;
const u=2**-24;
const gamma=n=>n*u/(1-n*u);
const quantizeRTZ=x=>DataUtils.fromHalfFloat(DataUtils.toHalfFloat(x));

// Closed endpoints deliberately admit exact representable-boundary ties.
// 'adjacent' is a rounding-mode-independent envelope for the usual IEEE modes.
// Select 'rtz' or 'rne' only after independently characterizing GPU conversion.
export function positiveHalfCell(value,mode='adjacent'){
  if(!Number.isFinite(value)||value<0||value>=65504)throw new RangeError('Requires a finite, nonnegative, nonsaturated half value.');
  const code=DataUtils.toHalfFloat(value);
  if(DataUtils.fromHalfFloat(code)!==value)throw new RangeError('Input is not exactly representable as binary16.');
  const previous=code===0?0:DataUtils.fromHalfFloat(code-1),next=DataUtils.fromHalfFloat(code+1);
  if(mode==='rtz')return [value,next];
  if(mode==='rne')return [code===0?0:(previous+value)/2,(value+next)/2];
  if(mode==='adjacent')return [previous,next];
  throw new RangeError('Unknown binary16 rounding model.');
}

// frames: [{P, scatter: RGBA values read from the half-resolution MRT}].
// This asks whether ONE nonnegative pre-storage source sample can explain ALL
// exposures. It never scales the already twice-quantized final P=0 image.
export function checkHalfSampleExposure(frames,{mode='adjacent',relativeArithmetic=0}={}){
  if(frames.length<2||frames.some(f=>f.scatter.length!==frames[0].scatter.length))throw new RangeError('Mismatched exposure frames.');
  if(!(relativeArithmetic>=0&&relativeArithmetic<1))throw new RangeError('Bad arithmetic allowance.');
  let channels=0,positiveChannels=0,failures=0,worstGap=0,worst=null;
  for(let i=0;i<frames[0].scatter.length;i+=4)for(let c=0;c<3;c++){
    let lower=0,upper=Infinity;const observations=[];
    for(const frame of frames){
      const value=frame.scatter[i+c],scale=2**frame.P,cell=positiveHalfCell(value,mode);
      const interval=[cell[0]/scale/(1+relativeArithmetic),cell[1]/scale/(1-relativeArithmetic)];
      lower=Math.max(lower,interval[0]);upper=Math.min(upper,interval[1]);
      observations.push({P:frame.P,value,rawInterval:interval});
    }
    channels++;if(observations.some(x=>x.value>0))positiveChannels++;
    const gap=lower-upper;if(gap>0){failures++;if(gap>worstGap){worstGap=gap;worst={pixel:i/4,channel:c,lower,upper,observations};}}
  }
  return {passed:failures===0&&positiveChannels>0,mode,relativeArithmetic,channels,positiveChannels,failures,worstGap,worst};
}

function bilinearStencil(x,y,width,height){
  const halfWidth=Math.ceil(width/2),halfHeight=Math.ceil(height/2);
  const gx=(x+.5)*halfWidth/width-.5,gy=(y+.5)*halfHeight/height-.5;
  const cornerX=Math.floor(gx),cornerY=Math.floor(gy),fx=gx-cornerX,fy=gy-cornerY;
  const result=[];
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const sx=Math.max(0,Math.min(halfWidth-1,cornerX+dx)),sy=Math.max(0,Math.min(halfHeight-1,cornerY+dy));
    result.push({index:4*(sy*halfWidth+sx),weight:(dx?fx:1-fx)*(dy?fy:1-fy)});
  }
  return result;
}

// Black incoming RGB, all-sky fixture only; all scatter markers must be -2.
// CPU reconstructs the measured half-res samples at their own exposure.
// fp32OperationBudget bounds positive multiply/add/divide rounding separately
// from binary16 conversion; uvError must be measured/calibrated by the caller
// if the rasterizer's interpolated vUv is not treated as exact pixel centers.
export function checkBlackSkyComposite({width,height,scatter,composite},{mode='adjacent',fp32OperationBudget=16,uvError=0}={}){
  const halfWidth=Math.ceil(width/2),halfHeight=Math.ceil(height/2);
  if(scatter.length!==halfWidth*halfHeight*4||composite.length!==width*height*4)throw new RangeError('Mismatched texture dimensions.');
  if(Array.from({length:halfWidth*halfHeight},(_,i)=>scatter[4*i+3]).some(a=>a!==-2))throw new RangeError('Only all-sky valid local-only samples are supported.');
  let channels=0,failures=0,worstGap=0,worst=null;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const stencil=bilinearStencil(x,y,width,height);
    for(let c=0;c<3;c++){
      const values=stencil.map(s=>scatter[s.index+c]),sum=stencil.reduce((a,s)=>a+s.weight*scatter[s.index+c],0);
      const range=Math.max(...values)-Math.min(...values);
      // Bilinear interpolation is Lipschitz in each coordinate with constant
      // <= local value range. This bounds a supplied UV coordinate uncertainty.
      const coordinateError=range*uvError*(halfWidth+halfHeight);
      const arithmeticError=gamma(fp32OperationBudget)*Math.max(...values),epsilon=coordinateError+arithmeticError;
      const actual=composite[4*(y*width+x)+c],cell=positiveHalfCell(actual,mode);
      const gap=Math.max(cell[0]-(sum+epsilon),(sum-epsilon)-cell[1],0);
      channels++;if(gap>0){failures++;if(gap>worstGap){worstGap=gap;worst={x,y,channel:c,actual,cell,reconstructed:sum,epsilon,values};}}
    }
  }
  return {passed:failures===0,mode,fp32OperationBudget,uvError,channels,failures,worstGap,worst};
}

function syntheticFrame(P,{doubleExposure=false}={}){
  const width=4,height=4,scale=2**(doubleExposure?2*P:P),q=MIN_HALF_SUBNORMAL;
  // At pixel (1,1), the first three weights sum to 15/16 and last is 1/16.
  // Source is perfectly linear before the two RTZ stores.
  const raw=[2.99,2.99,2.99,1.99].map(x=>Math.fround(x*q));
  const scatter=raw.flatMap(value=>[quantizeRTZ(value*scale),quantizeRTZ(value*scale),quantizeRTZ(value*scale),-2]);
  const composite=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const z=bilinearStencil(x,y,width,height).reduce((sum,s)=>sum+s.weight*scatter[s.index],0);
    composite.push(quantizeRTZ(z),quantizeRTZ(z),quantizeRTZ(z),.75);
  }
  return {P,width,height,raw,scatter,composite};
}

export function runCounterexample(){
  const frames=[-8,0,4,8].map(P=>syntheticFrame(P));
  const base=frames.find(f=>f.P===0),scaled=frames.find(f=>f.P===8),index=4*(1*4+1);
  const expected=base.composite[index]*256,actual=scaled.composite[index],difference=Math.abs(actual-expected),tolerance=2e-5+.003*Math.abs(expected);
  const exposure=checkHalfSampleExposure(frames,{mode:'rtz'});
  const reconstruction=frames.map(frame=>({P:frame.P,...checkBlackSkyComposite(frame,{mode:'rtz'})}));
  const doubleExposure=checkHalfSampleExposure([-8,0,4,8].map(P=>syntheticFrame(P,{doubleExposure:true})),{mode:'adjacent'});
  const report={kind:'Independent CPU two-FP16-stage quantization counterexample',passed:false,
    minHalfSubnormal:MIN_HALF_SUBNORMAL,vendorConversion:'DataUtils.toHalfFloat drops discarded mantissa bits after FP32 conversion; positive RTZ',
    counterexample:{sourceRaw:base.raw,sourceEV8:base.raw.map(x=>x*256),baseHalfSamples:base.scatter.filter((_,i)=>i%4===0),ev8HalfSamples:scaled.scatter.filter((_,i)=>i%4===0),x:1,y:1,base:base.composite[index],actual,expected,difference,tolerance,oldGateRatio:difference/tolerance,perfectlyLinearRaw:true},
    perHalfSampleExposure:exposure,compositeReconstruction:reconstruction,
    doubledExposureNegativeControl:doubleExposure,
    limits:['CPU counterexample establishes that the old gate is invalid under two RTZ stores; it does not characterize the GPU conversion mode.','The adjacent-cell gate covers ordinary directed and nearest rounding, but cannot establish an exact rounding mode.','Composite reconstruction currently supports black RGB and all valid sky markers only; mixed-depth fallback requires a separate oracle.','Any nonzero UV uncertainty must be independently measured or justified by the GPU precision contract, not chosen to make a failed test pass.']};
  report.passed=report.counterexample.oldGateRatio>1&&exposure.passed&&reconstruction.every(x=>x.passed)&&!doubleExposure.passed;
  return report;
}

if(typeof process!=='undefined'&&process.argv?.[1]?.replaceAll('\\','/').endsWith('/r12-background-air-quantization-oracle.mjs')){
  const {writeFile}=await import('node:fs/promises');
  const report=runCounterexample();
  await writeFile(new URL('./r12-background-air-quantization-counterexample.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,oldGateRatio:report.counterexample.oldGateRatio,intervalGatePassed:report.perHalfSampleExposure.passed,reconstructionPassed:report.compositeReconstruction.every(x=>x.passed),doubleExposureRejected:!report.doubledExposureNegativeControl.passed}));
  if(!report.passed)process.exitCode=1;
}
