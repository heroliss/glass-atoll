// CPU-only arithmetic/source receipt. Does not construct a scene or invoke GL.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {RAW_PER_CANDELA} from '../scene-radiometry.js';
const path='verification/r34-three-layer-bright-state.json';
const s=JSON.parse(fs.readFileSync(path,'utf8')),c=s.clusters[0],p=s.photometry;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const Y=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
const I=c.referenceCandela*Y(c.color),distance=Math.hypot(...c.position.map((v,i)=>v-s.state.camera[i]));
const groundDistance=Math.hypot(...c.position),groundCos=c.position[1]/groundDistance,cloudDistance=p.frame.weather.cloudBase-c.position[1];
const groundCut=Math.max(0,1-(groundDistance/280)**4)**2,peak=s.fireworks.activeEvents[0].layerProfile.referencePeakBudget;
const finalGain=.76*2**p.cameraEV*RAW_PER_CANDELA;
const cases=[-20,0,11.75,19].map(P=>({P,combinedGain:2**P*(.76*2**(p.cameraEV-P))*RAW_PER_CANDELA}));
const light=s.smoke.rendering.resolvedLighting.field,view=s.fireworks.lastRenderByView;
const checks=[
 {name:'Saved normalized colour and reference units',passed:Math.abs(Y(c.color)-1)<1e-12&&p.rawPerCandela===RAW_PER_CANDELA&&I>0&&peak>0},
 {name:'Storage P cancels the scene/output scale in the documented linear chain',passed:cases.every(x=>Math.abs(x.combinedGain-finalGain)<=1e-12*finalGain)},
 {name:'Saved complete per-eye SourceT and resolved SH are enabled, with distinct complete packet/source counts',passed:light.effective===true&&light.sourceCount===1728&&light.packetCount===24&&light.requiredPairs===24*1728&&['main','reflection'].every(k=>view[k].instances===1728&&view[k].mediumQueries===0&&view[k].sourceTransmission.effective===true)},
];
const report={schema:'glass-atoll.r34-photometry-chain-readonly-audit.v1',actualGPU:false,browserActions:0,productionEdits:0,passed:checks.every(x=>x.passed),checks,
 sourcePins:Object.fromEntries([path,'scene-radiometry.js','fireworks-physics.js','firework-layer-profile.js','fireworks.js','local-lights.js','sky.js','pyro-smoke-renderer.js','pyro-smoke-light-field.js','fireworks-audio.js'].map(x=>[x,hash(x)])),
 saved:{phasePhysicalTime:s.state.time,camera:s.state.camera,clusterPosition:c.position,clusterRadius:c.radius,clusterMaxExtent:c.maxExtent,totalReferenceCandela:c.referenceCandela,colourY:Y(c.color),peakReferenceBudget:peak,remainingPeakBudgetFraction:I/peak,packetCount:light.packetCount,ledgerSourceCount:light.sourceCount,cameraEV:p.cameraEV,storageEV:p.storageEV,outputExposureScale:p.outputExposureScale},
 arithmetic:{rawRGB:c.color.map(v=>v*c.referenceCandela*RAW_PER_CANDELA),finalGainBeforeDisplayTransform:finalGain,storageScaleCancellationCases:cases,cameraDistanceMetres:distance,
 idealIsotropicPoint:{cameraNormalIlluminanceLux:I/distance**2,directlyBelowGroundIlluminanceLux:I/c.position[1]**2,islandOriginDistanceMetres:groundDistance,islandOriginNormalCosine:groundCos,islandOriginIlluminanceBeforeCutoffLux:I/groundDistance**2*groundCos,islandOriginCustomCutoffFactor:groundCut,islandOriginIlluminanceAfterCutoffLux:I/groundDistance**2*groundCos*groundCut,minimumCloudLayerDistanceMetres:cloudDistance,nearestCloudLayerIncidentIlluminanceUpperLux:I/cloudDistance**2},
 unitAlbedoLambertOrigin:{noAirNoOcclusionLinearOutputBeforeDisplayTransform:finalGain*(I/groundDistance**2*groundCos*groundCut)/Math.PI,assumptions:'Isotropic aggregate point, horizontal receiver at [0,0,0], unit diffuse albedo, no air/cloud/geometry occlusion; not a sampled pixel or radiometric calibration.'}},
 limits:['The cd labels are authored references, not measured shell photometry. SI calculations here are conditional on interpreting those labels as SI.','No pixel, sensor, monitor-nit, full transport, native surface shading or GPU evaluation was performed.','Storage cancellation applies before nonlinear display transform and finite-precision effects; it is not a proof of all implementation stages.','Local point proxy has a finite280m cutoff; cloud and resolved ledger models differ. No runtime change or brightness multiplier is authorized by this report.']};
fs.writeFileSync('verification/r34-photometry-unit-chain-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,saved:report.saved,arithmetic:report.arithmetic},null,2));
if(!report.passed)process.exitCode=1;
