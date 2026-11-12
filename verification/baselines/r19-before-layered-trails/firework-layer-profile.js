// Pure opt-in compiler/samplers. Profiles are authored display references,
// not measured candela, fuel/particle mass or chemical/spectral calibration.
import {createBurnProfile,instantiateBurnProfile,sampleBurnProfile,EXAMPLE_BURN_PROFILES} from './firework-burn-profile.js';

export const FIREWORK_EFFECT_PROFILES=Object.freeze(['legacy','three-heart-v1','two-colour-v1']);
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
export const FIREWORK_LAYER_PROFILE_LIMITS=freeze({
  'three-heart-v1':{maximumBodySeconds:4.876,intrinsicSpeed:19,maximumIgnitionDelaySeconds:0,tailDurationSeconds:.35,propulsionKind:'none',bodyCount:192,layerCount:3,lifeVariationFraction:.06,intensityVariationFraction:0},
  'two-colour-v1':{maximumBodySeconds:3.392,intrinsicSpeed:19,maximumIgnitionDelaySeconds:0,tailDurationSeconds:.35,propulsionKind:'none',bodyCount:192,layerCount:1,lifeVariationFraction:.06,intensityVariationFraction:0}
});
const Y=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
const finite=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new RangeError(name+' must be finite');return x;};
const finiteVector=v=>Array.isArray(v)&&v.length===3&&[0,1,2].every(c=>Number.isFinite(v[c]));
const verifiedWindowProfiles=new WeakSet();
export function validateFireworkEffectProfile(type,effectProfile='legacy'){
  if(!FIREWORK_EFFECT_PROFILES.includes(effectProfile))throw new RangeError('Unknown effectProfile');
  if(effectProfile!=='legacy'&&type!=='chrysanthemum')throw new RangeError('Nonlegacy effectProfile requires chrysanthemum');return effectProfile;
}
function layerFor(id,effectProfile){
  if(effectProfile==='two-colour-v1')return{id:'single',multiplier:1,template:EXAMPLE_BURN_PROFILES.twoColour};
  return[{id:'outer',multiplier:1,template:EXAMPLE_BURN_PROFILES.outerBlue},{id:'middle',multiplier:.7,template:EXAMPLE_BURN_PROFILES.middleGreen},{id:'inner',multiplier:.4,template:EXAMPLE_BURN_PROFILES.innerRed}][id%3];
}
export function compileFireworkLayerProfile({type,effectProfile='legacy',heads,burstVelocity,eventSeed}={}){
  validateFireworkEffectProfile(type,effectProfile);if(effectProfile==='legacy')return null;
  if(!Array.isArray(heads)||heads.length!==192||!finiteVector(burstVelocity))throw new RangeError('Layer profile requires192 native roots and finite burst velocity');
  if(!Number.isSafeInteger(eventSeed)||eventSeed<0||eventSeed>4294967295)throw new RangeError('Layer seed requires uint32');
  const ids=new Set(),patches=[],layerCounts={},limits=FIREWORK_LAYER_PROFILE_LIMITS[effectProfile];let sumI0=0,maximumLife=0;
  for(const body of heads){
    if(!Number.isSafeInteger(body.id)||body.id<0||body.id>=192||ids.has(body.id)||body.parentBody)throw new RangeError('Layer profile requires each original root ID0..191 exactly once');ids.add(body.id);
    if(!finiteVector(body.baseVelocity)||!(body.intensity>=0)||!Number.isFinite(body.intensity))throw new RangeError('Layer body requires finite native base velocity/I0');
    const layer=layerFor(body.id,effectProfile),relative=body.baseVelocity.map((v,c)=>v-burstVelocity[c]);
    if(Math.hypot(...relative)>19+1e-8)throw new RangeError('Native intrinsic speed exceeds the layer hard contract');
    const velocity=relative.map((v,c)=>burstVelocity[c]+v*layer.multiplier),instance=instantiateBurnProfile(layer.template,{eventSeed,bodyId:body.id,layerId:layer.id,lifeVariationFraction:.06,intensityVariationFraction:0,opticalScale:1});
    const peak=Math.max(...instance.emission.knots.map(k=>Y(k.rgb))),scale=body.intensity/peak;
    const burnProfile=createBurnProfile({id:instance.id,emissionKnots:instance.emission.knots.map(k=>({age:k.age,rgb:k.rgb.map(v=>v*scale)})),materialRateKnots:instance.material.knots.map(k=>({age:k.age,rate:k.rate})),
      metadata:{...instance.metadata,effectProfile,layerId:layer.id,normalization:{policy:'native I0 peak budget; current intensityScale already included; no second gain',nativeReferenceI0:body.intensity,templatePeakY:peak},physicalCalibration:'authored reference; no measured kg/fuel/photometry'}});
    const life=burnProfile.lifetimeSeconds;if(life>limits.maximumBodySeconds+1e-12)throw new RangeError('Derived life exceeds fixed layer contract');
    patches.push({id:body.id,effectProfile,layerId:layer.id,ignitionDelay:0,burnProfile,life,velocity,baseVelocity:[...velocity],emissionReferenceI0:body.intensity});
    layerCounts[layer.id]=(layerCounts[layer.id]??0)+1;sumI0+=body.intensity;maximumLife=Math.max(maximumLife,life);
  }
  return freeze({schema:'glass-atoll.compiled-layer-profile.v1',effectProfile,patches,layerCounts,referencePeakBudget:sumI0,maximumLife,limits,
    photometry:'peakY normalized to each existing body I0; no claim of unchanged time integral',material:'No CDF scheduler or material allocation changed; downstream original model remains',propulsionKind:'none'});
}
export function sampleProfileBodyEmission(body,age){
  if(!body.burnProfile)throw new RangeError('Profile emission requires a compiled body');finite(age,'Body relative age');
  const value=sampleBurnProfile(body.burnProfile,age-(body.ignitionDelay??0)),I0=body.emissionReferenceI0??body.intensity;
  return{...value,allPhaseMaximumRGB:body.burnProfile.emission.sourceMaximumRGB,envelope:I0>0?value.intensityCdReference/I0:0,effectProfile:body.effectProfile,layerId:body.layerId};
}
// Eight positive time bins. Each tap is a local reference-RGB integral divided
// by the common width/8, so the shader's uniform1/8 weights retain total flux.
export function sampleProfileBodyEmissionWindow(body,{fromAge,toAge,bins=8,outRGB}={}){
  if(!body.burnProfile)throw new RangeError('Vector profile window is opt-in only');finite(fromAge,'Window start');finite(toAge,'Window end');
  if(!verifiedWindowProfiles.has(body.burnProfile)){sampleBurnProfile(body.burnProfile,0);verifiedWindowProfiles.add(body.burnProfile);}
  if(toAge<fromAge||!Number.isFinite(toAge-fromAge)||bins!==8)throw new RangeError('Profile window requires ordered finite ages and8 bins');
  if(outRGB!==undefined&&(!(outRGB instanceof Float64Array||outRGB instanceof Float32Array)||outRGB.length<24))throw new TypeError('outRGB requires24 Float64/Float32 entries');
  const rgbTaps=outRGB??new Float64Array(24),delay=body.ignitionDelay??0,start=fromAge-delay,end=toAge-delay,width=end-start,knots=body.burnProfile.emission.knots;
  let totalR=0,totalG=0,totalB=0;
  if(width===0){const v=sampleBurnProfile(body.burnProfile,start).emissionRGBReference;for(let i=0;i<8;i++)for(let c=0;c<3;c++)rgbTaps[i*3+c]=v[c];totalR=v[0];totalG=v[1];totalB=v[2];}
  else for(let bin=0;bin<8;bin++){
    const lo=start+width*bin/8,hi=bin===7?end:start+width*(bin+1)/8;if(!(hi>lo))throw new RangeError('Positive profile bins are not representable at this age');
    for(let c=0;c<3;c++){
      let sum=0,correction=0;for(let k=0;k<knots.length-1;k++){const a=knots[k],b=knots[k+1],left=Math.max(lo,a.age),right=Math.min(hi,b.age);if(!(right>left))continue;
        const va=a.rgb[c]+(b.rgb[c]-a.rgb[c])*((left-a.age)/(b.age-a.age)),vb=a.rgb[c]+(b.rgb[c]-a.rgb[c])*((right-a.age)/(b.age-a.age)),v=(va+vb)*.5*(right-left)-correction,next=sum+v;correction=(next-sum)-v;sum=next;
      }
      rgbTaps[bin*3+c]=sum/(width/8);if(c===0)totalR+=sum/width;else if(c===1)totalG+=sum/width;else totalB+=sum/width;
    }
  }
  const averageRGBReference=[totalR,totalG,totalB];return{fromAge,toAge,bins:8,rgbTaps,averageRGBReference,integralRGBReferenceSeconds:averageRGBReference.map(v=>v*width),allPhaseMaximumRGB:body.burnProfile.emission.sourceMaximumRGB,
    bufferLifetime:outRGB?'Borrowed caller buffer, first24 entries overwritten; consume before caller reuses it':'Owned new24-entry Float64 buffer',scope:'Source vector time-bin averages only; no geometry kernel, head/tail allocation, P/C or transmission integration'};
}
