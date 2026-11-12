// Pure opt-in author-reference profiles. No renderer, RNG mutation, kg/yield,
// trajectory integration, camera exposure, storage exposure or sound side effects.
export const BURN_PROFILE_SCHEMA='glass-atoll.burn-profile.v1';
export const MATERIAL_LEDGER_SCHEMA='glass-atoll.burn-material-ledger.v1';
export const PHOTOPIC_Y=Object.freeze([.2126,.7152,.0722]);
const MAX_KNOTS=256,MAX_AGE=3600,MAX_VALUE=1e9,MAX_BUDGET=1e12;
const compiled=new WeakMap(),ledgers=new WeakSet();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const finite=(v,name)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new RangeError(name+' must be finite');return v;};
const bounded=(v,lo,hi,name)=>{finite(v,name);if(v<lo||v>hi)throw new RangeError(name+' outside '+lo+'..'+hi);return v;};
const identity=(v,name)=>{if(typeof v!=='string'||v.length<1||v.length>256)throw new TypeError(name+' requires a bounded nonempty string');return v;};
const only=(o,keys,name)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw new TypeError(name+' has unsupported fields');};
const y=rgb=>rgb[0]*PHOTOPIC_Y[0]+rgb[1]*PHOTOPIC_Y[1]+rgb[2]*PHOTOPIC_Y[2];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function colour(rgb){const I=y(rgb);return I>=Number.MIN_VALUE*16?rgb.map(v=>v/I):[0,0,0];}
function cloneMetadata(input){
  const seen=new WeakSet();let count=0;
  function copy(value,depth){
    if(++count>4096||depth>16)throw new RangeError('Profile metadata exceeds bounded data depth/count');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number')return finite(value,'Metadata number');
    if(typeof value==='string'){if(value.length>4096)throw new RangeError('Metadata string is too long');return value;}
    if(!value||typeof value!=='object'||seen.has(value))throw new TypeError('Profile metadata requires finite acyclic JSON data');
    if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError('Metadata must contain plain JSON objects');
    if(Reflect.ownKeys(value).some(k=>typeof k==='symbol')||Object.keys(value).length>256||Array.isArray(value)&&(value.length>256||Object.keys(value).length!==value.length))throw new RangeError('Metadata requires bounded dense JSON arrays/objects');
    seen.add(value);const entries=Object.entries(Object.getOwnPropertyDescriptors(value));
    if(entries.some(([,d])=>d.get||d.set))throw new TypeError('Metadata cannot contain accessors');
    const result=Array.isArray(value)?value.map(v=>copy(v,depth+1)):Object.fromEntries(entries.map(([key,d])=>[identity(key,'Metadata key'),copy(d.value,depth+1)]));seen.delete(value);return result;
  }
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Profile metadata requires a JSON object');return copy(input,0);
}
function requireProfile(profile){const data=compiled.get(profile);if(!data)throw new TypeError('Use an immutable profile created by createBurnProfile');return data;}
function knots(input,vector,name){
  if(!Array.isArray(input)||input.length<2||input.length>MAX_KNOTS)throw new RangeError(name+' requires2..256 knots');
  return input.map((k,i)=>{only(k,vector?['age','rgb']:['age','rate'],name+' knot');const age=bounded(k.age,0,MAX_AGE,name+' age');if(i&&!(age>input[i-1].age))throw new RangeError(name+' ages must strictly increase');
    if(vector){if(!Array.isArray(k.rgb)||k.rgb.length!==3)throw new TypeError('Emission requires three reference RGB channels');return{age,rgb:k.rgb.map(v=>bounded(v,0,MAX_VALUE,'Reference RGB'))};}
    return{age,rate:bounded(k.rate,0,MAX_VALUE,'Material rate')};
  });
}
function interpolate(a,b,t,field){const u=(t-a.age)/(b.age-a.age);return field==='rgb'?a.rgb.map((v,c)=>v+(b.rgb[c]-v)*u):a.rate+(b.rate-a.rate)*u;}
function pointAt(input,age,field){
  if(age<input[0].age||age>input.at(-1).age)return field==='rgb'?[0,0,0]:0;
  if(age===input.at(-1).age)return field==='rgb'?[...input.at(-1).rgb]:input.at(-1).rate;
  for(let i=0;i<input.length-1;i++)if(age<input[i+1].age)return interpolate(input[i],input[i+1],age,field);
  throw new Error('Unreachable profile interval');
}
// Integrate clipped local overlaps, never subtract two large cumulative values.
function area(input,from,to,field){
  const n=field==='rgb'?3:1,sum=new Array(n).fill(0),correction=new Array(n).fill(0);
  for(let i=0;i<input.length-1;i++){
    const a=input[i],b=input[i+1],lo=Math.max(from,a.age),hi=Math.min(to,b.age);if(!(hi>lo))continue;
    const va=interpolate(a,b,lo,field),vb=interpolate(a,b,hi,field);
    for(let c=0;c<n;c++){const value=(field==='rgb'?(va[c]+vb[c]):va+vb)*.5*(hi-lo),v=value-correction[c],next=sum[c]+v;correction[c]=(next-sum[c])-v;sum[c]=next;}
  }
  return field==='rgb'?sum:sum[0];
}
function propulsion(input){
  if(input===undefined||input===null)return{kind:'none',trajectoryImplemented:false};
  only(input,['kind','accelerationKnots','maximumTurnDegreesPerSecond','directionKnotSeconds','deltaVLimitMetresPerSecond'],'Propulsion descriptor');
  if(input.kind!=='finite-author-acceleration')throw new RangeError('Unsupported propulsion descriptor kind');
  const accelerationKnots=knots(input.accelerationKnots,false,'Acceleration');
  const startAge=accelerationKnots[0].age,endAge=accelerationKnots.at(-1).age;
  if(accelerationKnots[0].rate!==0||accelerationKnots.at(-1).rate!==0)throw new RangeError('Finite propulsion starts and ends at zero acceleration');
  const deltaVBound=area(accelerationKnots,startAge,endAge,'rate'),deltaVLimitMetresPerSecond=bounded(input.deltaVLimitMetresPerSecond,0,1e4,'Propulsion deltaV limit');
  if(deltaVBound>deltaVLimitMetresPerSecond)throw new RangeError('Acceleration integral exceeds the authored deltaV limit');
  return{kind:input.kind,accelerationKnots,startAge,endAge,maximumAccelerationMetresPerSecondSquared:Math.max(...accelerationKnots.map(k=>k.rate)),integratedAccelerationBoundMetresPerSecond:deltaVBound,deltaVLimitMetresPerSecond,
    maximumTurnDegreesPerSecond:bounded(input.maximumTurnDegreesPerSecond,0,720,'Maximum heading speed'),directionKnotSeconds:bounded(input.directionKnotSeconds,.01,1,'Heading knot interval'),
    trajectoryImplemented:false,units:'author acceleration m/s2; rate field in these descriptor knots is magnitude, not material rate; no force/fuel calibration'};
}
export function createBurnProfile(options){
  only(options,['id','emissionKnots','materialRateKnots','propulsion','metadata'],'Burn profile');
  const id=identity(options.id,'Profile ID'),emissionKnots=knots(options.emissionKnots,true,'Emission'),materialRateKnots=knots(options.materialRateKnots,false,'Material');
  // Explicit continuous fade at the finite emission boundary; no hidden cut.
  if(emissionKnots[0].rgb.some(v=>v!==0)||emissionKnots.at(-1).rgb.some(v=>v!==0))throw new RangeError('Emission boundary knots must be black');
  const normalizationArea=area(materialRateKnots,0,MAX_AGE,'rate');if(!(normalizationArea>=1e-250))throw new RangeError('Material profile needs positive representable normalization area');
  const sourceMaximumRGB=[0,1,2].map(c=>Math.max(...emissionKnots.map(k=>k.rgb[c]))),integralRGBReferenceSeconds=area(emissionKnots,0,MAX_AGE,'rgb');
  const motor=propulsion(options.propulsion),metadata=options.metadata===undefined?{}:options.metadata;
  const copied=cloneMetadata(metadata);
  const profile=freeze({schema:BURN_PROFILE_SCHEMA,id,calibrationStatus:'authored-reference-not-measured',
    units:'emissionRGBReference = reference-cd I times unit-photopic-Y linear-sRGB colour; not stored scene RGB, watts, sensor radiance or measured cd',
    emission:{knots:emissionKnots,startAge:emissionKnots[0].age,endAge:emissionKnots.at(-1).age,sourceMaximumRGB,integralRGBReferenceSeconds},
    material:{knots:materialRateKnots,startAge:materialRateKnots[0].age,endAge:materialRateKnots.at(-1).age,normalizationArea,units:'normalized author reference-material rate/CDF, not kg, fuel, PM or measured yield'},
    propulsion:motor,lifetimeSeconds:Math.max(emissionKnots.at(-1).age,materialRateKnots.at(-1).age,motor.endAge??0),
    physical:{massKg:null,volumeM3:null,referenceAreaM2:null,status:'unknown; no trajectory or mass/volume evolution implemented'},metadata:copied});
  compiled.set(profile,{emissionKnots,materialRateKnots,normalizationArea});return profile;
}
export function sampleBurnProfile(profile,age){
  const data=requireProfile(profile);finite(age,'Relative age');const emissionRGBReference=pointAt(data.emissionKnots,age,'rgb'),intensityCdReference=y(emissionRGBReference);
  return{age,emissionRGBReference,intensityCdReference,unitYColour:colour(emissionRGBReference),colourNormalization:intensityCdReference>=Number.MIN_VALUE*16?'unit-Y':'zero-or-subnormal-unresolved; raw reference RGB retained',materialCDF:sampleMaterialCDF(profile,age)};
}
export function integrateBurnEmission(profile,fromAge,toAge){
  const data=requireProfile(profile);finite(fromAge,'Window start');finite(toAge,'Window end');if(toAge<fromAge)throw new RangeError('Emission window cannot run backwards');
  const durationSeconds=toAge-fromAge;if(!Number.isFinite(durationSeconds))throw new RangeError('Emission window width must be finite');
  const integralRGBReferenceSeconds=area(data.emissionKnots,fromAge,toAge,'rgb');
  // Zero-width average is its instantaneous limit; the integral remains zero.
  const averageRGBReference=durationSeconds?integralRGBReferenceSeconds.map(v=>v/durationSeconds):pointAt(data.emissionKnots,fromAge,'rgb');
  const averageIntensityCdReference=y(averageRGBReference);
  return{fromAge,toAge,durationSeconds,integralRGBReferenceSeconds,averageRGBReference,averageIntensityCdReference,unitYColour:colour(averageRGBReference),colourNormalization:averageIntensityCdReference>=Number.MIN_VALUE*16?'unit-Y':'zero-or-subnormal-unresolved; raw reference RGB retained'};
}
export function sampleBurnShutter(profile,{age,shutterSeconds=0}={}){
  finite(age,'Relative shutter centre');bounded(shutterSeconds,0,MAX_AGE,'Shutter seconds');const from=age-shutterSeconds*.5,to=age+shutterSeconds*.5;
  if(!Number.isFinite(from)||!Number.isFinite(to)||shutterSeconds>0&&!(to>from))throw new RangeError('Shutter window is not representable at this relative age');
  return{...integrateBurnEmission(profile,from,to),requestedShutterSeconds:shutterSeconds,transmissionPolicy:'No T integration; current renderer anchor transmission remains a separate approximation'};
}
export function sampleMaterialCDF(profile,age){
  const data=requireProfile(profile);finite(age,'Material relative age');const k=data.materialRateKnots;
  if(age<=k[0].age)return 0;if(age>=k.at(-1).age)return 1;
  return clamp(area(k,k[0].age,age,'rate')/data.normalizationArea,0,1);
}
export function integrateMaterialFraction(profile,fromAge,toAge){
  const data=requireProfile(profile);finite(fromAge,'Material interval start');finite(toAge,'Material interval end');if(toAge<fromAge)throw new RangeError('Material interval cannot run backwards');
  return clamp(area(data.materialRateKnots,fromAge,toAge,'rate')/data.normalizationArea,0,1);
}
function hash(text){let value=2166136261;for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619);}value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;value=Math.imul(value,0x846ca68b);return(value^(value>>>16))>>>0;}
export function instantiateBurnProfile(profile,{eventSeed=0,bodyId,layerId='default',lifeVariationFraction=.06,intensityVariationFraction=.12,opticalScale=1}={}){
  requireProfile(profile);if(!Number.isSafeInteger(eventSeed)||eventSeed<0||eventSeed>4294967295)throw new RangeError('Event seed requires uint32');
  if(typeof bodyId==='number'){if(!Number.isSafeInteger(bodyId)||bodyId<0)throw new RangeError('Numeric body ID requires a nonnegative safe integer');}else identity(bodyId,'Body ID');identity(layerId,'Layer ID');
  bounded(lifeVariationFraction,0,.25,'Life variation');bounded(intensityVariationFraction,0,.5,'Intensity variation');bounded(opticalScale,0,64,'Optical scale');
  const key=JSON.stringify([BURN_PROFILE_SCHEMA,profile.id,eventSeed,bodyId,layerId]),draw=channel=>hash(key+'/'+channel)/4294967296;
  const timeScale=1+(2*draw('lifetime')-1)*lifeVariationFraction,intensityScale=(1+(2*draw('intensity')-1)*intensityVariationFraction)*opticalScale;
  let motor=null;if(profile.propulsion.kind!=='none')motor={kind:profile.propulsion.kind,accelerationKnots:profile.propulsion.accelerationKnots.map(k=>({age:k.age*timeScale,rate:k.rate})),maximumTurnDegreesPerSecond:profile.propulsion.maximumTurnDegreesPerSecond,directionKnotSeconds:profile.propulsion.directionKnotSeconds,deltaVLimitMetresPerSecond:profile.propulsion.deltaVLimitMetresPerSecond*timeScale};
  return createBurnProfile({id:profile.id+'/body/'+hash(key).toString(16),emissionKnots:profile.emission.knots.map(k=>({age:k.age*timeScale,rgb:k.rgb.map(v=>v*intensityScale)})),materialRateKnots:profile.material.knots.map(k=>({age:k.age*timeScale,rate:k.rate/timeScale})),propulsion:motor,
    metadata:{...profile.metadata,instance:{baseProfileId:profile.id,eventSeed,bodyId,layerId,identityKey:key,timeScale,intensityScale,opticalScale,directionSeed:hash(key+'/heading'),randomness:'keyed deterministic author variation at creation only; no trajectory generated'}}});
}
export function createMaterialLedger(profile,{budget=0}={}){
  requireProfile(profile);bounded(budget,0,MAX_BUDGET,'Reference material budget');
  const ledger=freeze({schema:MATERIAL_LEDGER_SCHEMA,profile,budget,throughAge:0,emitted:0,reserved:budget,cancelled:0,closed:false,accountingResidual:0,units:'author reference material, not kg'});ledgers.add(ledger);return ledger;
}
function ledgerState(value){if(!ledgers.has(value))throw new TypeError('Material ledger must be an immutable factory state');return value;}
export function advanceMaterialLedger(ledger,throughAge){
  ledgerState(ledger);finite(throughAge,'Ledger throughAge');if(throughAge<ledger.throughAge)throw new RangeError('Material ledger cannot rewind');
  if(ledger.closed)return{ledger,emission:{fromAge:ledger.throughAge,toAge:throughAge,amount:0,status:'closed'}};
  const target=ledger.budget*sampleMaterialCDF(ledger.profile,throughAge),amount=Math.max(0,target-ledger.emitted),emitted=Math.max(ledger.emitted,target),reserved=ledger.budget-emitted;
  const next=freeze({...ledger,throughAge,emitted,reserved,accountingResidual:ledger.budget-emitted-ledger.cancelled-reserved});ledgers.add(next);
  return{ledger:next,emission:freeze({fromAge:ledger.throughAge,toAge:throughAge,amount,status:'prepared-pure-delta; caller commits to downstream state atomically'})};
}
export function clearMaterialLedger(ledger){
  ledgerState(ledger);if(ledger.closed)return ledger;
  const cancelled=ledger.cancelled+ledger.reserved,next=freeze({...ledger,reserved:0,cancelled,closed:true,accountingResidual:ledger.budget-ledger.emitted-cancelled});ledgers.add(next);return next;
}
const unitY=rgb=>{const I=y(rgb);return rgb.map(v=>v/I);};
const RED=unitY([1,.015,.003]),GREEN=unitY([.025,1,.02]),BLUE=unitY([.055,.10,1]),GOLD=unitY([1,.47,.055]);
const RGB=(c,I)=>c.map(v=>v*I),black=age=>({age,rgb:[0,0,0]});
function simple(id,c,end){return createBurnProfile({id,emissionKnots:[black(0),{age:.04,rgb:RGB(c,6)},{age:end*.65,rgb:RGB(c,4)},black(end)],materialRateKnots:[{age:0,rate:.5},{age:end*.2,rate:1},{age:end,rate:.1}],metadata:{purpose:'author reference layer; no measured colour/brightness/burn time'}});}
export const EXAMPLE_BURN_PROFILES=freeze({
  twoColour:createBurnProfile({id:'author-two-colour-v1',emissionKnots:[black(0),{age:.04,rgb:RGB(RED,8)},{age:1.4,rgb:RGB(RED,8)},{age:1.65,rgb:RGB(GREEN,7)},{age:2.6,rgb:RGB(GREEN,7)},black(3.2)],materialRateKnots:[{age:0,rate:.2},{age:.2,rate:1},{age:2.6,rate:.7},{age:3.2,rate:0}],metadata:{purpose:'two-colour author transition; brightness is not calibrated'}}),
  outerBlue:simple('author-outer-blue-v1',BLUE,3.4),middleGreen:simple('author-middle-green-v1',GREEN,4.6),innerRed:simple('author-inner-red-v1',RED,2.6),
  bee:createBurnProfile({id:'author-finite-bee-v1',emissionKnots:[black(0),{age:.03,rgb:RGB(GOLD,6)},{age:1,rgb:RGB(GOLD,4)},{age:1.4,rgb:RGB(RED,1.5)},black(1.8)],materialRateKnots:[{age:0,rate:.2},{age:.1,rate:1},{age:1,rate:.8},{age:1.8,rate:0}],propulsion:{kind:'finite-author-acceleration',accelerationKnots:[{age:0,rate:0},{age:.05,rate:12},{age:.75,rate:12},{age:1,rate:0}],maximumTurnDegreesPerSecond:180,directionKnotSeconds:.125,deltaVLimitMetresPerSecond:12},metadata:{purpose:'finite unstable-heading descriptor only; approximate1s is authored, not measured bee motor data'}})
});
export const EXAMPLE_EFFECT_DESCRIPTORS=freeze({
  twoColour:{schema:'glass-atoll.effect-profile-descriptor.v1',id:'author-two-colour-shell-v1',layers:[{id:'single',distribution:'sphere',profile:EXAMPLE_BURN_PROFILES.twoColour,count:192,ignitionDelaySeconds:0,referenceMaterialShare:1}],trajectoryImplemented:false},
  threeLayer:{schema:'glass-atoll.effect-profile-descriptor.v1',id:'author-three-heart-v1',layers:[{id:'outer',distribution:'sphere',profile:EXAMPLE_BURN_PROFILES.outerBlue,count:64,radialSpeedMultiplier:1,ignitionDelaySeconds:0,referenceMaterialShare:1/3},{id:'middle',distribution:'sphere',profile:EXAMPLE_BURN_PROFILES.middleGreen,count:64,radialSpeedMultiplier:.7,ignitionDelaySeconds:0,referenceMaterialShare:1/3},{id:'inner',distribution:'sphere',profile:EXAMPLE_BURN_PROFILES.innerRed,count:64,radialSpeedMultiplier:.4,ignitionDelaySeconds:0,referenceMaterialShare:1/3}],trajectoryImplemented:false,notes:'Same192 logical-body budget; different burn ends, not three screen rings or delayed sub-explosions'},
  poweredBees:{schema:'glass-atoll.effect-profile-descriptor.v1',id:'author-finite-bee-shell-v1',layers:[{id:'bees',distribution:'sphere',profile:EXAMPLE_BURN_PROFILES.bee,count:24,ignitionDelaySeconds:0,referenceMaterialShare:1}],trajectoryImplemented:false,notes:'No positions, heading knots, force model or trajectory integration in this first stage'}
});
