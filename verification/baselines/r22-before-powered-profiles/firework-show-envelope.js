import {FIREWORK_TYPES,createFireworkEvent} from './fireworks-physics.js';
import {FIREWORK_LAYER_PROFILE_LIMITS,validateFireworkEffectProfile} from './firework-layer-profile.js';

// Pure physical-centre forecast for the current authored display simulation.
// Constants below are upper limits from the generator expressions, NOT fitted
// maxima from sampled seeds or physical pyrotechnic/product specifications.
export const FIREWORK_ENVELOPE_LIMITS=Object.freeze({
  peony:Object.freeze({intrinsicSpeed:19,lifeMultiplier:1.11}),
  chrysanthemum:Object.freeze({intrinsicSpeed:19,lifeMultiplier:1.11}),
  willow:Object.freeze({intrinsicSpeed:28,maximumBodySeconds:10.2+2.5}),
  palm:Object.freeze({intrinsicSpeed:28,maximumBodySeconds:5.4+1}),
  ring:Object.freeze({intrinsicSpeed:21,lifeMultiplier:1.11}),
  // |x|<=16/18, |y|<=(13+5+2+1)/18+.1 gives speed<32.51.
  heart:Object.freeze({intrinsicSpeed:33,lifeMultiplier:1.11}),
  // One root impulse<=19, one child impulse8.6; root.78 + child<=3.2s.
  crossette:Object.freeze({intrinsicSpeed:19+8.6,maximumBodySeconds:.78+2.5+.7}),
  strobe:Object.freeze({intrinsicSpeed:19,lifeMultiplier:1.11}),
  fan:Object.freeze({intrinsicSpeed:34,maximumBodySeconds:3.2+.6,maximumBirthDelaySeconds:8*.065}),
  bouquet:Object.freeze({intrinsicSpeed:21+10,maximumBodySeconds:2.2+.7}),
});
const G=9.81,DEG=Math.PI/180;
const finite=(x,name,min=-Infinity,max=Infinity)=>{if(!Number.isFinite(x)||x<min||x>max)throw new RangeError(`${name} requires finite${min}..${max}`);return x;};
const vector=(v,name,limit=1e6)=>{if(!v||v.length!==3)throw new TypeError(name+' requires3components');return Array.from(v,(x,c)=>finite(x,`${name}[${c}]`,-limit,limit));};
const range=(lo,hi)=>[Math.min(lo,hi),Math.max(lo,hi)];
const sum=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const product=(a,b)=>{const q=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return[Math.min(...q),Math.max(...q)];};
const scale=(a,s)=>product(a,[s,s]);
const factors=(k,t)=>{const F=-Math.expm1(-k*t)/k;return{F,H:t-F,E:Math.exp(-k*t)};};
const axis=(azimuth,elevation)=>{const a=azimuth*DEG,e=elevation*DEG;return[Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)];};

/** Exact unit-sphere cap extrema, enlarged to the current25..90 pitch clamp. */
export function fireworkLaunchConeBounds(azimuth,elevation,spread){
  finite(azimuth,'azimuth');finite(elevation,'elevation',25,90);finite(spread,'launchSpreadDegrees',0,15);
  const a=axis(azimuth,elevation),c=Math.cos(spread*DEG),s=Math.sin(spread*DEG);
  const bounds=a.map(v=>[v<=-c?-1:v*c-Math.sqrt(Math.max(0,1-v*v))*s,v>=c?1:v*c+Math.sqrt(Math.max(0,1-v*v))*s]);
  const elevations=[Math.max(25,elevation-spread),Math.min(90,elevation+spread)];
  bounds[1]=elevations.map(e=>Math.sin(e*DEG));
  return{axis:a,components:bounds,elevationDegrees:elevations,halfAngleDegrees:spread};
}
function windRanges(wind={maximumSpeed:5,direction:[.936,0,.352]}){
  if(wind.min!==undefined||wind.max!==undefined){
    const lo=vector(wind.min,'wind.min',50),hi=vector(wind.max,'wind.max',50);for(let c=0;c<3;c++)if(lo[c]>hi[c])throw new RangeError('wind.min exceeds wind.max');return lo.map((v,c)=>[v,hi[c]]);
  }
  const maximum=finite(wind.maximumSpeed??5,'wind.maximumSpeed',0,50),direction=vector(wind.direction??[.936,0,.352],'wind.direction',1),length=Math.hypot(...direction);
  if(Math.abs(length-1)>1e-9)throw new RangeError('wind.direction must be unit length');return direction.map(v=>range(0,v*maximum));
}

// For variable drag k in[kMin,kMax], initial positive velocity travels no
// further than F(kMin,t), while gravity has at least g*H(kMax,t)/kMax effect.
// Thus y(t)<=positiveV*F(kMin,t)+(max(0,windY)-g/kMax)*H(kMax,t).
// Its derivative is decreasing when the latter coefficient is negative;
// bracket its unique maximum and enclose both monotone terms at the bracket.
function verticalTravelUpper(positiveV,windY,kMin,kMax,tMax){
  positiveV=Math.max(0,positiveV);const c=Math.max(0,windY)-G/kMax;
  const value=t=>positiveV*factors(kMin,t).F+c*factors(kMax,t).H;
  if(c>=0)return value(tMax);
  if(positiveV===0)return 0;
  const derivative=t=>positiveV*Math.exp(-kMin*t)+c*(1-Math.exp(-kMax*t));
  if(derivative(tMax)>=0)return value(tMax);
  let lo=0,hi=tMax;for(let i=0;i<56;i++){const t=(lo+hi)*.5;if(derivative(t)>0)lo=t;else hi=t;}
  return positiveV*factors(kMin,hi).F+c*factors(kMax,lo).H;
}

/**
 * origin is a fixed launch point if muzzleOffsetMetres=0; otherwise the rig's
 * muzzle pivot and launch origin=origin+axis*muzzleOffsetMetres. The caller
 * resolves automatic seaward azimuth. All burst orientations are enclosed.
 */
export function getFireworkShowEnvelope(options={}){
  const settings=options.settings??{},pick=(key,fallback)=>options[key]??settings[key]??fallback;
  const type=pick('type','peony'),definition=FIREWORK_TYPES.find(t=>t.id===type),limits=FIREWORK_ENVELOPE_LIMITS[type];
  if(!definition||!limits)throw new RangeError('Unknown firework envelope type');
  const effectProfile=validateFireworkEffectProfile(type,options.effectProfile!==undefined?options.effectProfile:settings.effectProfile!==undefined?settings.effectProfile:'legacy');
  const profileLimits=effectProfile==='legacy'?null:FIREWORK_LAYER_PROFILE_LIMITS[effectProfile];
  // This extension covers only the current non-propelled, same-birth chrys
  // compiler. Future delays/motors/speeds require a separate interval proof.
  if(profileLimits&&(!(profileLimits.maximumBodySeconds>0&&profileLimits.maximumBodySeconds<=4.876)||!(profileLimits.intrinsicSpeed>=0&&profileLimits.intrinsicSpeed<=19)||profileLimits.maximumIgnitionDelaySeconds!==0||!(profileLimits.tailDurationSeconds>=0&&profileLimits.tailDurationSeconds<=.35)||profileLimits.propulsionKind!=='none'||profileLimits.bodyCount!==192))throw new RangeError('Unsupported layered firework envelope contract');
  if(pick('flightModel','apex')!=='apex'||options.height!==undefined||settings.height!==undefined)throw new RangeError('Show envelope currently supports definition-rise apex flights only');
  const origin=vector(options.origin??[29,.87,7],'origin'),muzzle=finite(options.muzzleOffsetMetres??0,'muzzleOffsetMetres',0,2);
  const azimuth=finite(pick('azimuth',110),'azimuth'),elevation=finite(pick('elevation',78),'elevation',25,90),spread=finite(pick('launchSpreadDegrees',3),'launchSpreadDegrees',0,15);
  finite(pick('burstTiltDegrees',12),'burstTiltDegrees',0,45);finite(pick('burstRollDegrees',8),'burstRollDegrees',0,30);
  const wind=windRanges(options.wind),padding=finite(options.paddingMetres??0,'paddingMetres',0,100);
  const floor=finite(options.visibleFloorMetres??.03,'visibleFloorMetres',-1e6,1e6),cone=fireworkLaunchConeBounds(azimuth,elevation,spread);
  const launch=cone.components.map((r,c)=>sum([origin[c],origin[c]],scale(r,muzzle)));
  const canonicalOrigin=origin.map((v,c)=>v+muzzle*cone.axis[c]);
  const canonical=createFireworkEvent({type,origin:canonicalOrigin,azimuth,elevation,seed:0,starDragModel:pick('starDragModel','bounded-descent'),smileyLayout:pick('smileyLayout','reference'),...(profileLimits?{effectProfile}:{})});
  const drags=canonical.heads.map(b=>b.drag??.2),kMin=Math.min(...drags),kMax=Math.max(...drags);
  if(!(kMin>0&&Number.isFinite(kMax)))throw new RangeError('Unsupported body drag');
  const bodySeconds=profileLimits?.maximumBodySeconds??limits.maximumBodySeconds??definition.burn*limits.lifeMultiplier;
  const birthDelay=profileLimits?.maximumIgnitionDelaySeconds??limits.maximumBirthDelaySeconds??0;
  for(const b of canonical.heads)if(b.birth-canonical.burstTime+b.life>bodySeconds+birthDelay+1e-10)throw new Error('Generator lifetime exceeds its published envelope contract');
  const S=profileLimits?.intrinsicSpeed??limits.intrinsicSpeed,bodyF=factors(kMin,bodySeconds).F,bodyH=factors(kMax,bodySeconds).H;
  let burst=launch.map(r=>r.slice()),burstVelocity=[[0,0],[0,0],[0,0]],carrierSeconds=[0,0],muzzleSpeed=0;
  const min=launch.map(r=>r[0]),max=launch.map(r=>r[1]);
  if(!definition.ground){
    const rocket=canonical.rocket,k=rocket.drag;muzzleSpeed=Math.hypot(...rocket.velocity);
    carrierSeconds=cone.elevationDegrees.map(e=>Math.log1p(k*muzzleSpeed*Math.sin(e*DEG)/G)/k);
    const low=factors(k,carrierSeconds[0]),high=factors(k,carrierSeconds[1]),F=[low.F,high.F],E=[high.E,low.E],H=[low.H,high.H];
    const maxRise=verticalTravelUpper(muzzleSpeed*cone.components[1][1],wind[1][1],k,k,carrierSeconds[1]);
    for(let c=0;c<3;c++){
      const initial=scale(cone.components[c],muzzleSpeed);
      burst[c]=sum(sum(launch[c],product(initial,F)),product(wind[c],H));
      burstVelocity[c]=sum(product(initial,E),product(wind[c],[1-low.E,1-high.E]));
      const rocketPosition=sum(sum(launch[c],product(initial,[0,high.F])),product(wind[c],[0,high.H]));
      if(c===1){
        burst[c]=sum(burst[c],scale(H,-G/k));
        // Flight fuse is the zero-vertical-wind apex for each launch pitch;
        // that homogeneous vertical velocity cancels exactly in the model.
        burstVelocity[c]=product(wind[c],[1-low.E,1-high.E]);
        burst[c][1]=Math.min(burst[c][1],launch[c][1]+maxRise);
        max[c]=Math.max(max[c],launch[c][1]+maxRise);
      }else{min[c]=Math.min(min[c],rocketPosition[0]);max[c]=Math.max(max[c],rocketPosition[1]);}
    }
  }
  for(let c=0;c<3;c++){
    const travel=sum(sum(burst[c],product(burstVelocity[c],[0,bodyF])),sum([-S*bodyF,S*bodyF],product(wind[c],[0,bodyH])));
    if(c===1)max[c]=Math.max(max[c],burst[c][1]+verticalTravelUpper(Math.max(0,burstVelocity[c][1])+S,wind[c][1],kMin,kMax,bodySeconds));
    else{min[c]=Math.min(min[c],travel[0]);max[c]=Math.max(max[c],travel[1]);}
  }
  // Detached embers are born anywhere inside the body envelope, inherit1/4
  // body velocity and then fly at drag1.35 for no more than this trail lag.
  const trailSeconds=profileLimits?.tailDurationSeconds??(type==='willow'?.88:type==='palm'?.62:definition.trail?.35:0);
  const rocketTrailSeconds=definition.ground?0:.50;
  const windSpeedBound=Math.hypot(...wind.map(r=>Math.max(Math.abs(r[0]),Math.abs(r[1]))));
  const burstSpeedBound=Math.hypot(...burstVelocity.map(r=>Math.max(Math.abs(r[0]),Math.abs(r[1]))));
  const bodySpeedBound=burstSpeedBound+S+windSpeedBound+G/kMin;
  const emberPad=(v,t)=>{const f=factors(1.35,t);return .25*v*f.F+(windSpeedBound+G/1.35)*f.H;};
  const tailPadding=Math.max(emberPad(bodySpeedBound,trailSeconds),emberPad(muzzleSpeed+windSpeedBound+G*carrierSeconds[1],rocketTrailSeconds));
  const totalPadding=tailPadding+padding+1e-5;
  for(let c=0;c<3;c++){min[c]-=totalPadding;max[c]+=totalPadding;}
  min[1]=floor;
  if(max[1]<floor)max[1]=floor;
  if(![...min,...max].every(Number.isFinite))throw new RangeError('Envelope exceeded numeric domain');
  return{schema:'glass-atoll.firework-show-envelope.v1',type,...(profileLimits?{effectProfile}:{}),min,max,centre:min.map((v,c)=>(v+max[c])/2),
    launchDirectionRanges:cone.components,launchElevationRangeDegrees:cone.elevationDegrees,launchPositionRanges:launch,burstPositionRanges:burst,burstVelocityRanges:burstVelocity,
    limits:{intrinsicSpeedMetresPerSecond:S,bodySeconds,birthDelaySeconds:birthDelay,minimumBodyDragPerSecond:kMin,maximumBodyDragPerSecond:kMax,carrierSeconds,muzzleSpeedMetresPerSecond:muzzleSpeed,tailSeconds:trailSeconds,rocketTailSeconds:rocketTrailSeconds,tailAnchorPaddingMetres:tailPadding,compositionPaddingMetres:padding,arithmeticPaddingMetres:1e-5,windRanges:wind},
    coverage:'All allowed seed-dependent speeds/lives, configured launch cone and arbitrary burst rotations; physical luminous body and detached-tail centres above the renderer floor.',
    method:'analytic cone component extrema + positive linear-drag response intervals + generator hard speed/lifetime limits; canonical event only calibrates deterministic muzzle speed and drag classes',
    limitations:['Binary64 conservative analytic derivation with small arithmetic padding, not a formal directed-rounding certificate.','Source-centre envelope only: camera-dependent Gaussian quad/DOF/shutter/bloom footprint and persistent drifting smoke require their separate framing margins.','Wind may vary piecewise in time only within supplied component bounds; no prediction of future user settings.','Current generator contract only; no arbitrary per-launch height, timed-reference flight or external physics modifications.']};
}
