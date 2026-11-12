// Verification-only 1-D wet/dry counterfactual. Not a production module or a
// calibration of this island. Hydrostatic reconstruction + Rusanov flux.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {waveComponents,waveOmega} from '../waves.js';
const audit=JSON.parse(fs.readFileSync(new URL('r13-water-audit.json',import.meta.url))),upwindShore=audit.shoreline.points.find(p=>p.index===32),slope=upwindShore.localSlope;
const modes=waveComponents.filter(w=>w.kind==='swell'),g=9.81,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function simulate(n,{duration=60,forcing=true}={}){
  const start=performance.now(),left=-12,right=6,dx=(right-left)/n,bed=Float64Array.from({length:n},(_,i)=>slope*(left+(i+.5)*dx));
  let h=Float64Array.from(bed,z=>Math.max(0,-z)),q=new Float64Array(n),foam=new Float64Array(n),moisture=new Float64Array(n),t=0,steps=0,massFlux=0,clippedMass=0,minHeight=0,maxSpeed=0;
  const originalH=[...h],initialMass=h.reduce((s,v)=>s+v,0)*dx,fh=new Float64Array(n+1),fq=new Float64Array(n+1),corrL=new Float64Array(n+1),corrR=new Float64Array(n+1),series=[],profiles=[];
  const offH=-bed[0],c0=Math.sqrt(g*offH),wetThreshold=.002,shallow=1e-5,probe=Math.max(0,Math.min(n-1,Math.floor((-.35-left)/dx))),dryProbe=Math.max(0,Math.min(n-1,Math.floor((.25-left)/dx)));
  let nextSample=0,peakOnshore=-Infinity,peakOffshore=Infinity;
  const incoming=time=>{if(!forcing)return 0;const ramp=clamp(time/6,0,1),smooth=ramp*ramp*(3-2*ramp);return smooth*modes.reduce((s,w)=>s+w.amplitude*Math.sin(w.k*(-44*Math.cos(w.angle)-Math.sin(w.angle))-waveOmega(w.k)*time+w.phase),0);};
  while(t<duration-1e-12){
    let speed=c0;for(let i=0;i<n;i++)speed=Math.max(speed,Math.abs(h[i]>shallow?q[i]/h[i]:0)+Math.sqrt(g*h[i]));
    const dt=Math.min(1/120,.42*dx/speed,duration-t),targetEta=incoming(t),outgoing=(h[0]>shallow?q[0]/h[0]:0)-2*Math.sqrt(g*h[0]),invariantPlus=2*c0+2*targetEta*c0/offH;
    const boundaryU=.5*(invariantPlus+outgoing),boundaryC=.25*(invariantPlus-outgoing),boundaryH=Math.max(0,boundaryC)**2/g,boundaryQ=boundaryH*boundaryU;
    for(let edge=0;edge<=n;edge++){
      const l=edge-1,r=edge,zl=edge===0?bed[0]:bed[l],zr=edge===n?bed[n-1]:bed[r],hl=edge===0?boundaryH:h[l],hr=edge===n?0:h[r],ql=edge===0?boundaryQ:q[l],qr=edge===n?0:q[r];
      const ul=hl>shallow?ql/hl:0,ur=hr>shallow?qr/hr:0,zstar=Math.max(zl,zr),hlstar=Math.max(0,hl+zl-zstar),hrstar=Math.max(0,hr+zr-zstar),qlstar=ul*hlstar,qrstar=ur*hrstar;
      const a=Math.max(Math.abs(ul)+Math.sqrt(g*hlstar),Math.abs(ur)+Math.sqrt(g*hrstar));
      fh[edge]=.5*(qlstar+qrstar)-.5*a*(hrstar-hlstar);
      fq[edge]=.5*(ul*qlstar+.5*g*hlstar**2+ur*qrstar+.5*g*hrstar**2)-.5*a*(qrstar-qlstar);
      corrL[edge]=.5*g*(hl*hl-hlstar*hlstar);corrR[edge]=.5*g*(hr*hr-hrstar*hrstar);
    }
    const hn=new Float64Array(n),qn=new Float64Array(n),fn=new Float64Array(n);
    massFlux+=dt*(fh[0]-fh[n]);
    for(let i=0;i<n;i++){
      const next=h[i]-dt/dx*(fh[i+1]-fh[i]);minHeight=Math.min(minHeight,next);assert(next>=-1e-11,'negative wet/dry height');hn[i]=Math.max(0,next);if(next<0)clippedMass-=next*dx;
      let momentum=q[i]-dt/dx*((fq[i+1]+corrL[i+1])-(fq[i]+corrR[i]));
      if(hn[i]<=shallow)momentum=0;else{const velocity=momentum/hn[i],manning=.018;momentum/=1+g*manning*manning*Math.abs(velocity)*dt/Math.max(hn[i],.001)**(4/3);}
      qn[i]=momentum;const u=hn[i]>shallow?momentum/hn[i]:0;maxSpeed=Math.max(maxSpeed,Math.abs(u));
      const prev=i?i-1:i,nextIndex=i+1<n?i+1:i,uprev=h[prev]>shallow?q[prev]/h[prev]:0,unext=h[nextIndex]>shallow?q[nextIndex]/h[nextIndex]:0;
      const compression=Math.max(0,-(unext-uprev)/(2*dx)),froude=Math.abs(u)/Math.sqrt(g*Math.max(hn[i],.001)),gradient=u>=0?(foam[i]-foam[prev])/dx:(foam[nextIndex]-foam[i])/dx;
      fn[i]=hn[i]>.001?clamp(foam[i]-dt*u*gradient+dt*compression*Math.max(0,froude-.65)*(1-foam[i])-dt*foam[i]/2.5,0,1):foam[i]*Math.exp(-dt/1.2);
      moisture[i]=hn[i]>wetThreshold?1-(1-moisture[i])*Math.exp(-8*dt):moisture[i]*Math.exp(-dt/35);
    }
    h=hn;q=qn;foam=fn;t+=dt;steps++;
    if(t>=nextSample-1e-12){
      let front=left;for(let i=0;i<n;i++)if(h[i]>wetThreshold)front=left+(i+.5)*dx;
      const u=h[probe]>shallow?q[probe]/h[probe]:0;if(t>20){peakOnshore=Math.max(peakOnshore,u);peakOffshore=Math.min(peakOffshore,u);}
      series.push({time:t,shoreFrontX:front,runupHeight:slope*front,probeVelocityMps:u,landProbeWaterDepth:h[dryProbe],landProbeMoisture:moisture[dryProbe],maximumFoamCoverage:Math.max(...foam),incidentEta:targetEta});
      if(n===280&&t>=36&&t<=48&&profiles.length<7&&(!profiles.length||t-profiles.at(-1).time>1.9))profiles.push({time:t,x:Array.from({length:n},(_,i)=>left+(i+.5)*dx),bed:[...bed],h:[...h],q:[...q],foam:[...foam],moisture:[...moisture]});nextSample+=.1;
    }
  }
  const finalMass=h.reduce((s,v)=>s+v,0)*dx,massResidual=finalMass-initialMass-massFlux-clippedMass,postWarm=series.filter(s=>s.time>20),dryHistory=postWarm.filter(s=>s.landProbeWaterDepth<wetThreshold&&s.landProbeMoisture>.1);
  assert(Math.abs(massResidual)<1e-9,'volume closure');assert(Number.isFinite(maxSpeed));
  return{n,dx,duration,forcing,slope,steps,elapsedCpuMs:performance.now()-start,initialMass,finalMass,netBoundaryVolume:massFlux,clippedMass,massResidual,minimumProposedHeight:minHeight,
    maxAbsVelocityMps:maxSpeed,peakProbeOnshoreVelocityMps:peakOnshore,peakProbeOffshoreVelocityMps:peakOffshore,maxRunupHeightAfter20s:Math.max(...postWarm.map(s=>s.runupHeight)),minRunupHeightAfter20s:Math.min(...postWarm.map(s=>s.runupHeight)),
    maxDepthDifferenceFromRest:Math.max(...h.map((v,i)=>Math.abs(v-originalH[i]))),maxVelocityAtEnd:Math.max(...q.map((v,i)=>h[i]>shallow?Math.abs(v/h[i]):0)),dryButMoistSamples:dryHistory.length,series:n===280?series:undefined,profiles:n===280?profiles:undefined};
}
const calm=simulate(280,{duration:30,forcing:false}),runs=[140,280,560].map(n=>simulate(n));
assert(calm.maxDepthDifferenceFromRest<1e-10&&calm.maxVelocityAtEnd<1e-9,'lake at rest');
for(const r of runs){assert(r.peakProbeOnshoreVelocityMps>.02&&r.peakProbeOffshoreVelocityMps<-.02,'runup/backwash both occur');assert(r.maxRunupHeightAfter20s>0,'wetting moves above original shoreline');assert(r.dryButMoistSamples>0,'wet memory survives recession');}
const report={schema:'glass-atoll.r13-water-shore-prototype.v1',dateUTC:new Date().toISOString(),passed:true,actualGPU:false,runtimeMutated:false,
  forcing:'Exact64 native swell components at fixed worldXZ[-44,-1],6s startup; used as one-dimensional incident Riemann characteristic. No added random wave oscillator.',
  localReference:{shorePointXZ:upwindShore.pointXZ,localSlope:slope,note:'Upwind western scene shore tangent-plane surrogate; not the full scene bathymetry or a measured tropical beach.'},
  scheme:'Verification-only first-order conservative nonlinear1D SWE; hydrostatic reconstruction/Rusanov; wet/dry; semi-implicit authored Manning .018; no dispersive offshore/Boussinesq model.',
  opticalAndMaterialLimits:'Foam is an advected compression/Froude diagnostic with authored lifetime, not resolved air bubbles. Moisture is shared wet-contact35s authored history, not a measured porous-sand simulation. No GPU caustics or production textures are implemented.',
  calm,runs,limits:['Not actual island2D bathymetry, no alongshore/refraction/diffraction; plane slope uses one actual upwind shoreline sample only.','Resolution comparison demonstrates scale sensitivity, not validated convergence or a real beach calibration.','CPU wall cost here is not a production GPU/FPS estimate.','No actual renderer/normal/shoreline seam/caustic acceptance follows from the numerical positive-depth/mass tests.']};
fs.writeFileSync(new URL('r13-water-shore-prototype.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,calm:{...calm,series:undefined,profiles:undefined},runs:runs.map(({series,profiles,...r})=>r)},null,2));
