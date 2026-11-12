// Exact QA-only inverse of the opt-in Taylor extension. Runtime never imports it.
import {normalizeResolvedHostSource} from './resolved-light-default-normalize.mjs';
import {normalizeRingBurnAdapterSource} from './ring-burn-default-normalize.mjs';
const stateImport="import {parseSmokeDispersion,taylorDispersionFactors,validateDispersionMemory} from './pyro-smoke-dispersion.js';\n";
const taylorEvolve=`    if(taylor){const diffusion=taylorDispersionFactors(dt,lagrangianSeconds),dx=travel[0],dy=travel[1],dz=travel[2];
      for(const p of packets){const varianceTime=dt*(1-p.dispersionQ)+p.dispersionQ*diffusion.freshTime;finite(p.mean[0]+dx,'transported mean.x',PYRO_SMOKE_LIMITS.worldCoordinate);finite(p.mean[1]+dy+p.buoyantVelocity*f.Ab+p.temperatureExcessK*f.positionPerK,'transported mean.y',PYRO_SMOKE_LIMITS.worldCoordinate);finite(p.mean[2]+dz,'transported mean.z',PYRO_SMOKE_LIMITS.worldCoordinate);for(let c=0;c<3;c++)finite(p.covariance[c*4]+2*K[c]*varianceTime,'diffused variance',PYRO_SMOKE_LIMITS.covarianceElement);finite(p.temperatureExcessK*f.ea,'cooled temperature');finite(p.buoyantVelocity*f.eb+p.temperatureExcessK*f.velocityPerK,'buoyant velocity');validateDispersionMemory(p.dispersionQ*diffusion.decay);}
      for(const p of packets){const varianceTime=dt*(1-p.dispersionQ)+p.dispersionQ*diffusion.freshTime;p.mean[0]+=dx;p.mean[1]+=dy+p.buoyantVelocity*f.Ab+p.temperatureExcessK*f.positionPerK;p.mean[2]+=dz;p.buoyantVelocity=p.buoyantVelocity*f.eb+p.temperatureExcessK*f.velocityPerK;p.temperatureExcessK*=f.ea;for(let c=0;c<3;c++)p.covariance[c*4]+=2*K[c]*varianceTime;p.dispersionQ*=diffusion.decay;p._dirty=true;}if(packets.length)revision++;return;
    }
`;
export const taylorStateEdits=Object.freeze([
  ['pure math import',stateImport,''],
  ['factory options',"preferredColumnError=.05,dispersionModel='brownian',lagrangianSeconds=10}={}){","preferredColumnError=.05}={}){"],
  ['factory validation',"  parseSmokeDispersion({dispersionModel,lagrangianSeconds});const taylor=dispersionModel==='taylor';\n  finite(time,'origin time');","  finite(time,'origin time');"],
  ['Taylor-only public memory','sourceCount:p.sourceCount,...(p.dispersionQ===undefined?{}:{dispersionQ:p.dispersionQ})};','sourceCount:p.sourceCount};'],
  ['convex same-model merge memory',"  if(a.dispersionQ!==undefined){if(b.dispersionQ===undefined)fail('Cannot merge mixed dispersion models');p.dispersionQ=validateDispersionMemory(a.dispersionQ+wb*(b.dispersionQ-a.dispersionQ));}\n  kernel(p);return p;","  kernel(p);return p;"],
  ['birth memory validation',"_dirty:true};if(taylor)p.dispersionQ=validateDispersionMemory(s.dispersionQ??1);else if(s.dispersionQ!==undefined)fail('dispersionQ requires Taylor state');if(emitted+sumMass(emissionQueue)","_dirty:true};if(emitted+sumMass(emissionQueue)"],
  ['Taylor-only evolve branch',taylorEvolve+'    // Validate proposals first', '    // Validate proposals first'],
  ['Taylor snapshot metadata',"schema:'glass-atoll.pyro-smoke-state.v1',...(taylor?{dispersion:{model:dispersionModel,lagrangianSeconds,diffusivity:[...K]}}:{}),time:clock()","schema:'glass-atoll.pyro-smoke-state.v1',time:clock()"],
  ['Taylor diagnostic metadata',"version:'pyro-smoke-state-v1',...(taylor?{dispersion:{model:dispersionModel,lagrangianSeconds,diffusivity:[...K]}}:{}),time:clock()","version:'pyro-smoke-state-v1',time:clock()"],
  ['restricted physical limits',"limits:[...(taylor?['stationary decorrelated-parcel Taylor marginal closure; TL authored, not measured relative-puff dispersion; q preserves common-drift diffusion moments only']:[]),'no age deletion", "limits:['no age deletion"]
].map(e=>Object.freeze(e)));
function inverse(source,edits,scope){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of edits){if(result.split(from).length!==2)throw new Error(scope+' scope drift: '+label);result=result.replace(from,to);}return result;}
export const normalizeTaylorStateSource=source=>inverse(source,taylorStateEdits,'Taylor state');
export const taylorSourceEdits=Object.freeze([
  ['pure dispersion import',"import {parseSmokeDispersion,taylorDispersionAge} from './pyro-smoke-dispersion.js';\n",''],
  ['transport parse',"function parseTransport(t){const dispersion=parseSmokeDispersion(t),diffusivity=vector(t.diffusivity,'diffusivity');","function parseTransport(t){const diffusivity=vector(t.diffusivity,'diffusivity');"],
  ['Taylor-only transport metadata',"buoyantVelocity:finite(t.buoyantVelocity,'buoyantVelocity'),...(dispersion.dispersionModel==='taylor'?dispersion:{})};}","buoyantVelocity:finite(t.buoyantVelocity,'buoyantVelocity')};}"],
  ['same-aged covariance',"ageModel=model.dispersionModel==='taylor'?taylorDispersionAge(age,model.lagrangianSeconds):null,variance=model.diffusivity.map(k=>sigmaPerp*sigmaPerp+2*k*(ageModel?ageModel.varianceTime:age));","variance=model.diffusivity.map(k=>sigmaPerp*sigmaPerp+2*k*age);"],
  ['node age memory',"samples.push({time,weight:weights[i],position,variance,temperatureExcessK:thermal.temperatureExcessK,buoyantVelocity:thermal.buoyantVelocity,...(ageModel?{dispersionQ:ageModel.dispersionQ}:{})});","samples.push({time,weight:weights[i],position,variance,temperatureExcessK:thermal.temperatureExcessK,buoyantVelocity:thermal.buoyantVelocity});"],
  ['collapsed memory output',"return{mass,mean,covariance,temperatureExcessK,buoyantVelocity,...(model.dispersionModel==='taylor'?{dispersionQ:kahan(samples.map(s=>s.weight*s.dispersionQ))}:{}),diagnostics:","return{mass,mean,covariance,temperatureExcessK,buoyantVelocity,diagnostics:"],
  ['Taylor kernel diagnostic',"agedToBirth:true,...(model.dispersionModel==='taylor'?{dispersionModel:'taylor',lagrangianSeconds:model.lagrangianSeconds}:{}),temperatureVariance,","agedToBirth:true,temperatureVariance,"]
].map(e=>Object.freeze(e)));
const adapterValidation="stateInfo(state);const sourceDispersion=parseSmokeDispersion({dispersionModel,lagrangianSeconds});function assertDispersionState(next){const stateDispersion=stateInfo(next).dispersion;if((stateDispersion?.model??'brownian')!==dispersionModel||dispersionModel==='taylor'&&stateDispersion.lagrangianSeconds!==lagrangianSeconds)throw new RangeError('Source and state dispersion model/TL must agree');if(dispersionModel==='taylor'&&(!Array.isArray(transport.diffusivity)||transport.diffusivity.length!==3||transport.diffusivity.some((v,i)=>v!==stateDispersion.diffusivity[i])))throw new RangeError('Source and state diffusivity must agree');}assertDispersionState(state);if(dispersionModel==='brownian'&&transport.dispersionModel==='taylor')throw new RangeError('Brownian state cannot use Taylor source transport');const sourceTransport=dispersionModel==='taylor'?{...transport,...sourceDispersion}:transport;if(!sourceProvider";
export const taylorAdapterEdits=Object.freeze([
  ['pure dispersion import',"import {parseSmokeDispersion} from './pyro-smoke-dispersion.js';\n",''],
  ['adapter options',"trajectorySlots=12,dispersionModel='brownian',lagrangianSeconds=10,transport=SMOKE_SOURCE_TRANSPORT}","trajectorySlots=12,transport=SMOKE_SOURCE_TRANSPORT}"],
  ['same source-state immutable model',adapterValidation,'stateInfo(state);if(!sourceProvider'],
  ['optional local memory','buoyantVelocity=.35,kernelDiagnostics=null,dispersionQ;','buoyantVelocity=.35,kernelDiagnostics=null;'],
  ['source transport forwarding','windHistory:preparedWind,sigmaPerp:.30,transport:sourceTransport','windHistory:preparedWind,sigmaPerp:.30,transport'],
  ['aged root memory',"buoyantVelocity=moments.buoyantVelocity;dispersionQ=moments.dispersionQ;kernelDiagnostics=","buoyantVelocity=moments.buoyantVelocity;kernelDiagnostics="],
  ['queued root memory',"...(kernelDiagnostics?{kernelDiagnostics}: {}),...(dispersionQ===undefined?{}:{dispersionQ})});});","...(kernelDiagnostics?{kernelDiagnostics}: {})});});"],
  ['recent source memory',"mass:e.mass,position:[...e.mean],...(e.dispersionQ===undefined?{}:{dispersionQ:e.dispersionQ}),...(e.kernelDiagnostics?","mass:e.mass,position:[...e.mean],...(e.kernelDiagnostics?"],
  ['clear preserves immutable model',"const info=stateInfo(nextState);assertDispersionState(nextState);if(Math.abs(info.time-time)","const info=stateInfo(nextState);if(Math.abs(info.time-time)"],
  ['Taylor recipe metadata',"parameters:{...areas,centralFraction,...(dispersionModel==='taylor'?{dispersionModel,lagrangianSeconds}:{}),...(kernelModel===","parameters:{...areas,centralFraction,...(kernelModel==="]
].map(e=>Object.freeze(e)));
export const taylorHostEdits=Object.freeze([
  ['pure dispersion import',"import {parseSmokeDispersion} from './pyro-smoke-dispersion.js';\n",''],
  ['host options',"centralFraction=.20,trajectorySlots=12,dispersionModel='brownian',lagrangianSeconds=10}={}){","centralFraction=.20,trajectorySlots=12}={}){"],
  ['host validation',"  parseSmokeDispersion({dispersionModel,lagrangianSeconds});\n  if(trajectorySlots!==12", "  if(trajectorySlots!==12"],
  ['legacy opt-in boundary',"centralFraction!==.20||trajectorySlots!==12||dispersionModel!=='brownian')", "centralFraction!==.20||trajectorySlots!==12)"],
  ['immutable state/clear model',"sourceModel==='trajectory-v1'?{maxPendingEmissions:8192,...(dispersionModel==='taylor'?{dispersionModel,lagrangianSeconds}:{}),...(kernelModel===", "sourceModel==='trajectory-v1'?{maxPendingEmissions:8192,...(kernelModel==="],
  ['adapter model forwarding','kernelModel,centralFraction,trajectorySlots,dispersionModel,lagrangianSeconds,transport:SMOKE_SOURCE_TRANSPORT','kernelModel,centralFraction,trajectorySlots,transport:SMOKE_SOURCE_TRANSPORT']
].map(e=>Object.freeze(e)));
export const normalizeTaylorSourceMoments=source=>inverse(source,taylorSourceEdits,'Taylor source');
export const normalizeTaylorAdapterSource=source=>inverse(source.includes("from './pyro-smoke-ring-burn.js'")?normalizeRingBurnAdapterSource(source):source,taylorAdapterEdits,'Taylor adapter');
export const normalizeTaylorHostSource=source=>inverse(source.includes('prepareLighting(options){return volume.prepareLighting(options);}')?normalizeResolvedHostSource(source):source,taylorHostEdits,'Taylor host');
