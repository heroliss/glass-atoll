// Read-only source/geometry scale audit. Writes evidence only under verification/.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {waveComponents,waveCascades,waveStatistics,waveWindFactor,waveComponentGain,waveOmega,seaStateDefaults} from '../waves.js';
import {shallowSwellDefaults,shallowSwellModes,shallowSwellWeights} from '../hydrodynamics.js';
import {createVegetation} from '../vegetation.js';
import {createSplash} from '../splash.js';

const files=['main.js','vegetation.js','sand.js','waves.js','splash.js','floating-leaves.js','hydrodynamics.js'];
const sourceHashes=Object.fromEntries(files.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex')]));
const mainSource=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const waveSource=fs.readFileSync(new URL('../waves.js',import.meta.url),'utf8');
const swellPeriod=shallowSwellDefaults.period;
const swellComponentPeriods=shallowSwellModes.map(mode=>swellPeriod/mode.ratio);
const ringGroupSpeed=Number(waveSource.match(/float ring=d-age\*([\d.]+)/)?.[1]||.68);
const ringOmega=Number(waveSource.match(/float phase=11\.\*d-([\d.]+)\*age/)?.[1]||11*.68);
const ringStrength=Number(mainSource.match(/water\.impulse\(x,z,time,([\d.]+)\)/)?.[1]||1);
const hydroStrength=Number(mainSource.match(/hydrodynamics\.disturb\(x,z,([\d.]+)\)/)?.[1]||1);
const functionSource=mainSource.slice(mainSource.indexOf('export function terrainHeight'),mainSource.indexOf('const noiseGLSL')).replace('export ','');
const terrainHeight=new Function(functionSource+'; return terrainHeight;')();
const westDepths=[];for(let z=-72;z<=72;z+=.375)westDepths.push(-terrainHeight(-72,z));
const vegetation=createVegetation(THREE,{terrainHeight:()=>1.2,seed:40219});
const nominalLeafLengths={};
for(const name of ['Folded coconut pinnae','Veined alternate coastal leaves']){
  const a=vegetation.children.find(q=>q.name===name).geometry.attributes,lengths=[];
  for(let i=0;i<a.position.count;i+=3)if(a.aGroveMotion.getZ(i)===1)lengths.push(a.aLeafRoot.getW(i));
  lengths.sort((a,b)=>a-b);nominalLeafLengths[name]={count:lengths.length,min:lengths[0],median:lengths[Math.floor(lengths.length/2)],max:lengths.at(-1)};
}
const attributes=vegetation.children.find(q=>q.name==='Arched palm rachises').geometry.attributes,groups=new Map();
for(let i=0;i<attributes.position.count;i++){
  const root=[attributes.aBranchRoot.getX(i),attributes.aBranchRoot.getY(i),attributes.aBranchRoot.getZ(i)],key=root.map(x=>x.toFixed(4)).join(','),t=attributes.aGroveMotion.getY(i).toFixed(5);
  if(!groups.has(key))groups.set(key,new Map());const rows=groups.get(key);
  if(!rows.has(t))rows.set(t,{p:new THREE.Vector3(),n:0,t:Number(t)});
  const row=rows.get(t);row.p.add(new THREE.Vector3(attributes.position.getX(i),attributes.position.getY(i),attributes.position.getZ(i)));row.n++;
}
const arcs=[...groups.values()].map(rows=>{
  const q=[...rows.values()].sort((a,b)=>a.t-b.t);q.forEach(v=>v.p.divideScalar(v.n));
  let length=0;for(let i=1;i<q.length;i++)length+=q[i].p.distanceTo(q[i-1].p);return length;
}).sort((a,b)=>a-b);
const omega=k=>Math.sqrt((9.81*k+.000070244*k**3)*Math.tanh(k*3));
const cg=k=>(omega(k+.0001)-omega(k-.0001))/.0002;
const periods=waveComponents.map(w=>2*Math.PI/waveOmega(w.k));
const significantHeightAtWind=speed=>4*Math.sqrt(waveComponents.reduce((sum,w)=>sum+(w.amplitude*waveComponentGain(w,waveWindFactor(speed),seaStateDefaults))**2/2,0));
function sweComparison(depth,period=swellPeriod){
  const target=(2*Math.PI/period)**2;let lo=1e-10,hi=10;
  for(let i=0;i<100;i++){const k=(lo+hi)/2;if(9.81*k*Math.tanh(k*depth)>target)hi=k;else lo=k;}
  const k=(lo+hi)/2,wavelength=2*Math.PI/k,sweSpeed=Math.sqrt(9.81*depth),exactSpeed=wavelength/period;
  return {depth,period,exactWavelength:wavelength,sweWavelength:sweSpeed*period,phaseSpeedErrorPercent:(sweSpeed/exactSpeed-1)*100};
}
const splash=createSplash(THREE,{scene:new THREE.Scene()});const impact=splash.spawn(0,0,0,1,{stoneDiameter:.025});
const result={date:new Date().toISOString(),units:'metres and seconds unless specified',sourceHashes,
  terrain:{nominalDryEllipseRadii:[30,19],centralElevation:terrainHeight(-1.5,-1),westDrivingBoundaryDepthRange:[Math.min(...westDepths),Math.max(...westDepths)]},
  vegetation:{trunkVerticalHeights:vegetation.userData.treeRecords.map(t=>t.height),frondRachisArcMetres:{count:arcs.length,min:arcs[0],median:arcs[Math.floor(arcs.length/2)],max:arcs.at(-1)},nominalLeafLengths},
  waves:{...waveStatistics,seaStateDefaults,settingsBasis:'Exported authored defaults, not a live runtime snapshot.',windFactor5:waveWindFactor(5),HsAt5:significantHeightAtWind(5),HsAtZeroWind:significantHeightAtWind(0),heightMixRule:'Hs=4*sqrt(sum((amplitude*systemGain)^2/2)); swellGain=Hs_swell/.16, windGain=waveWindFactor(speed)*windSea',wavelengthRange:[Math.min(...waveComponents.map(w=>2*Math.PI/w.k)),Math.max(...waveComponents.map(w=>2*Math.PI/w.k))],intrinsicPeriodAt3mRange:[Math.min(...periods),Math.max(...periods)],domains:waveCascades.map(q=>q.domain)},
  independentSWE:{settingsBasis:'shallowSwellDefaults exported by hydrodynamics.js; separate from the7.5s analytic swell.',period:swellPeriod,amplitude:shallowSwellDefaults.amplitude,groupiness:shallowSwellDefaults.groupiness,componentPeriodsSeconds:swellComponentPeriods,componentWeights:shallowSwellWeights(shallowSwellDefaults.groupiness),amplitudeMeaning:'Regular-wave-equivalent amplitude; sum(componentAmplitude^2)=amplitude^2.',at3m:sweComparison(3,swellPeriod),atShallowestDrivingBoundary:sweComparison(Math.min(...westDepths),swellPeriod),atDeepestDrivingBoundary:sweComparison(Math.max(...westDepths),swellPeriod),shortestComponentAt3m:sweComparison(3,Math.min(...swellComponentPeriods)),shortestComponentAtDeepestDrivingBoundary:sweComparison(Math.max(...westDepths),Math.min(...swellComponentPeriods))},
  swePhaseErrorByDepth:[.2,.5,1,3,5,10,15,32].map(h=>sweComparison(h,swellPeriod)),
  clickRing:{k:11,wavelength:2*Math.PI/11,implementedPhaseSpeed:ringOmega/11,implementedGroupSpeed:ringGroupSpeed,correctPhaseSpeedAt3m:omega(11)/11,correctGroupSpeedAt3m:cg(11),callerStrength:ringStrength,heightCoefficient:.065*ringStrength},
  impact:{hydroStrength,maximumEtaCoefficient:.028*hydroStrength,relativeEnergyToStrength1:hydroStrength*hydroStrength,newSplashIntegrated:/splashes\.spawn\(x,z,time,1,\{stoneDiameter:\.025\}\)/.test(mainSource),old55mmPointsPresent:/size:\.055/.test(mainSource)},
  splash:{default25mmImpact:impact,state:splash.state},
  caveat:'This checks source dimensions and idealized theory, not measurements of an actual Maldives island, breaking-wave field, species specimen or water-entry experiment.'};
fs.writeFileSync(new URL('./scale-audit-check.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({trunks:result.vegetation.trunkVerticalHeights,fronds:result.vegetation.frondRachisArcMetres,waves:result.waves,splash:impact,clickRing:result.clickRing,SWE:result.independentSWE,impact:result.impact}));
splash.dispose();vegetation.userData.dispose();
