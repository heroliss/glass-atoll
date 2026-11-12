"""Closed, reversible R35 two-file patch. No shader/physical-source edits."""
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parent.parent
changes=[]
def patch(file,old,new):
    p=root/file
    raw=p.read_bytes(); text=raw.decode(); newline='\r\n' if b'\r\n' in raw else '\n'
    old=old.replace('\r\n','\n').replace('\n',newline);new=new.replace('\r\n','\n').replace('\n',newline)
    if text.count(old)!=1:raise ValueError(file+': anchor is not unique '+old[:100])
    p.write_bytes(text.replace(old,new).encode());changes.append({'file':file,'old':old,'new':new})

patch('firework-show-envelope.js',"const G=9.81,DEG=Math.PI/180;", "const G=9.81,DEG=Math.PI/180,SCALED_PROFILE='three-heart-scale120-v1';")
patch('firework-show-envelope.js',"const profileLimits=effectProfile==='legacy'?null:getFireworkEffectProfileLimits(effectProfile),powered=effectProfile==='powered-bees-v1';", "const profileLimits=effectProfile==='legacy'?null:getFireworkEffectProfileLimits(effectProfile),powered=effectProfile==='powered-bees-v1',scaled=effectProfile===SCALED_PROFILE;\n  if(scaled)validateScaledLimits(profileLimits,pick('starDragModel','bounded-descent'));\n  const sourceRadialScaleAlpha=scaled?finite(options.sourceRadialScaleAlpha??profileLimits.maximumRadialScale,'Known source radial scale alpha',Number.MIN_VALUE,profileLimits.maximumRadialScale):null,scaledShutterSeconds=scaled?finite(pick('shutterSeconds',1),'Scaled optical shutter seconds',0,1):0;")
patch('firework-show-envelope.js',"if(profileLimits&&!powered&&(","if(profileLimits&&!powered&&!scaled&&(")
patch('firework-show-envelope.js',"const S=profileLimits?.intrinsicSpeed??limits.intrinsicSpeed,bodyF=", "const S=scaled?profileLimits.unscaledIntrinsicSpeed*sourceRadialScaleAlpha:profileLimits?.intrinsicSpeed??limits.intrinsicSpeed,bodyF=")
patch('firework-show-envelope.js',"  const totalPadding=tailPadding+padding+1e-5+poweredPadding;", "  let scaledBounds=null,scaledPadding=0;\n  if(scaled){\n    const body=scaledOpticalSupport([bodySpeedBound,bodySpeedBound,bodySpeedBound],wind.map(r=>Math.max(Math.abs(r[0]),Math.abs(r[1]))),kMax,G,trailSeconds,scaledShutterSeconds),rocket=scaledOpticalSupport([muzzleSpeed+windSpeedBound+G*carrierSeconds[1],muzzleSpeed+windSpeedBound+G*carrierSeconds[1],muzzleSpeed+windSpeedBound+G*carrierSeconds[1]],wind.map(r=>Math.max(Math.abs(r[0]),Math.abs(r[1]))),canonical.rocket?.drag??kMax,G,rocketTrailSeconds,scaledShutterSeconds);\n    // Detached-centre travel was already included in tailPadding above.\n    scaledPadding=Math.max(...body.opticalPadding,...rocket.opticalPadding);\n    scaledBounds={familyIntrinsicSpeedMetresPerSecond:profileLimits.intrinsicSpeed,sourceIntrinsicSpeedMetresPerSecond:S,sourceRadialScaleAlpha,scaleBasis:options.sourceRadialScaleAlpha===undefined?'unknown-seed family cap4':'caller-supplied known compiled source subset',opticalShutterSeconds:scaledShutterSeconds,opticalMaximumShutterSeconds:1,body,rocket,additionalOpticalPaddingMetres:scaledPadding};\n  }\n  const totalPadding=tailPadding+padding+1e-5+poweredPadding+scaledPadding;")
patch('firework-show-envelope.js',"windRanges:wind,...(poweredBounds?{powered:poweredBounds}:{})},", "windRanges:wind,...(poweredBounds?{powered:poweredBounds}:{}),...(scaledBounds?{scaled:scaledBounds}:{})},")
patch('firework-show-envelope.js',"coverage:powered?'All admitted", "coverage:scaled?'All admitted scaled-profile seeds or declared known-alpha subset; physical bodies/detached tails plus conservative causal midpoint, neighbouring-tail stretch and linear shutter proxy support above the renderer floor.':powered?'All admitted")
patch('firework-show-envelope.js',"method:powered?'analytic", "method:scaled?'analytic cone/positive drag intervals with separate76m/s family or19*known-alpha limit and continuous component optical derivative padding; no sampled-max bound':powered?'analytic")
patch('firework-show-envelope.js',"certificate.',powered?'Powered", "certificate.',scaled?'Scaled world-space source/tail/stretch/shutter proxies only, S<=1s: camera Gaussian quad/DOF/bloom and persistent smoke retain separate framing margins. This does not prove curved-path integration accuracy or varying transmission.':powered?'Powered")

patch('firework-show-envelope.js',"/**\n * origin is a fixed launch point",'''// New version only: do not weaken the old19m/s layered or powered contracts.
function validateScaledLimits(limits,model){
  if(!limits||limits.maximumBodySeconds!==4.876||limits.intrinsicSpeed!==76||limits.unscaledIntrinsicSpeed!==19||limits.maximumRadialScale!==4||limits.maximumIgnitionDelaySeconds!==0||limits.tailDurationSeconds!==.35||limits.propulsionKind!=='none'||limits.bodyCount!==192||limits.layerCount!==3||limits.requiredStarDragModel!=='bounded-descent'||limits.requiredBodyDragPerSecond!==G/16||model!=='bounded-descent')throw new RangeError('Unsupported scaled firework envelope contract');
}

// Component speed bounds are valid for every held-wind segment: velocity is
// a convex drag response to its initial velocity and bounded terminal forcing.
// At fixed lag q'=v+.25*a*F_e+wind response-(1-E_e)*w_release.
function scaledOpticalSupport(speed,wind,k,gravity,D,shutter){
  const f=factors(1.35,D),acceleration=speed.map((v,c)=>k*(v+wind[c])+(c===1?gravity:0)),fieldVelocity=speed.map((v,c)=>v+.25*acceleration[c]*f.F+2*(1-f.E)*wind[c]);
  const lagDerivative=speed.map((v,c)=>1.25*v+.25*acceleration[c]*f.F+(1-f.E)*wind[c]+(c===1?G*f.F:0));
  const tailPadding=speed.map((v,c)=>.25*v*f.F+(wind[c]+(c===1?G/1.35:0))*f.H),stretchPadding=lagDerivative.map(v=>.5*D*v);
  // Positive source exposure may persist up to S after source extinction.
  // Its midpoint is at most S/2 outside the luminous-life interval; birth
  // anchoring may extend backwards by S/2. Add a further S/2 for the raster
  // motion and S/2 for two independently birth-clamped stretch endpoints.
  const shutterPadding=fieldVelocity.map((v,c)=>1.5*Math.max(v,speed[c])*shutter),opticalPadding=shutterPadding.map((v,c)=>v+stretchPadding[c]);
  return{sourceVelocityBound:speed,sourceAccelerationBound:acceleration,tailFieldVelocityBound:fieldVelocity,tailLagDerivativeBound:lagDerivative,tailPadding,stretchPadding,shutterPadding,opticalPadding,tailSeconds:D,shutterSeconds:shutter};
}

function componentTravelBounds(position,velocity,wind,k,gravity,life){
  const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity],speed=[];
  for(let c=0;c<3;c++){
    for(const side of[0,1]){
      const initial=velocity[c][side],terminal=wind[c][side]-(c===1?gravity/k:0),ages=[0,life],ratio=-terminal/(initial-terminal);
      if(ratio>0&&ratio<1){const t=-Math.log(ratio)/k;if(t>0&&t<life)ages.push(t);}
      for(const t of ages){const f=factors(k,t),value=position[c][side]+initial*f.F+terminal*f.H;minimum[c]=Math.min(minimum[c],value);maximum[c]=Math.max(maximum[c],value);}
    }
    speed[c]=Math.max(Math.abs(velocity[c][0]),Math.abs(velocity[c][1]),Math.max(Math.abs(wind[c][0]),Math.abs(wind[c][1]))+(c===1?gravity/k:0));
  }
  return{min:minimum,max:maximum,speed};
}

/** Known-event continuous enclosure, including legal explicit-height flights.
 * The actual launch/fuse is fixed; future uniform wind can vary arbitrarily
 * within committed component ranges. No future body pose or RNG is sampled.
 */
export function getScaledFireworkLiveEnvelope(event,{windRanges:inputWind,shutterSeconds=1}={}){
  if(event?.effectProfile!==SCALED_PROFILE)throw new RangeError('Scaled live enclosure requires its explicit profile');
  const limits=getFireworkEffectProfileLimits(SCALED_PROFILE);validateScaledLimits(limits,event.aerodynamics?.starDragModel);
  finite(shutterSeconds,'Scaled optical shutter seconds',0,1);
  const radialScale=event.layerProfile?.radialScale,alpha=finite(radialScale?.alpha,'Compiled radial scale alpha',Number.MIN_VALUE,4),S=19*alpha;
  if(radialScale.schema!=='glass-atoll.three-heart-radial-scale-calibration.v1'||!Object.isFrozen(radialScale)||radialScale.sourceGainIndependent!==true)throw new RangeError('Scaled live enclosure requires compiled immutable radial metadata');
  if(!Array.isArray(event.heads)||event.heads.length!==192||!event.rocket)throw new RangeError('Scaled live enclosure requires192 original heads and a carrier');
  const wind=windRanges(inputWind),W=wind.map(r=>Math.max(Math.abs(r[0]),Math.abs(r[1]))),rocket=event.rocket,origin=vector(rocket.position,'Carrier launch position'),initial=vector(rocket.velocity,'Carrier initial velocity'),carrierK=finite(rocket.drag,'Carrier drag',Number.MIN_VALUE),carrierG=finite(rocket.gravity??G,'Carrier gravity',0),carrierLife=finite(rocket.life,'Carrier life',0),flight=factors(carrierK,carrierLife);
  const burstPosition=wind.map((r,c)=>r.map(w=>origin[c]+initial[c]*flight.F+(w-(c===1?carrierG/carrierK:0))*flight.H)),burstVelocity=wind.map((r,c)=>r.map(w=>initial[c]*flight.E+(w-(c===1?carrierG/carrierK:0))*(1-flight.E)));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],maximumPadding=[0,0,0],maximumOpticalPadding=[0,0,0],supports=[],baselineVelocity=vector(event.baselineBurst?.velocity,'Baseline carrier velocity'),baselinePosition=vector(event.baselineBurst?.position,'Baseline burst position');
  function include(position,velocity,k,gravity,life,duration,bodyId,scalarPostLife=0){
    const physical=componentTravelBounds(position,velocity,wind,k,gravity,life),support=scaledOpticalSupport(physical.speed,W,k,gravity,duration,shutterSeconds),padding=support.tailPadding.map((v,c)=>v+support.opticalPadding[c]+scalarPostLife*physical.speed[c]+1e-5);
    for(let c=0;c<3;c++){min[c]=Math.min(min[c],physical.min[c]-padding[c]);max[c]=Math.max(max[c],physical.max[c]+padding[c]);maximumPadding[c]=Math.max(maximumPadding[c],padding[c]);maximumOpticalPadding[c]=Math.max(maximumOpticalPadding[c],support.opticalPadding[c]);}
    supports.push({bodyId,lifeSeconds:life,...support});
  }
  include(origin.map(v=>[v,v]),initial.map(v=>[v,v]),carrierK,carrierG,carrierLife,.5,'rocket',.02);
  for(const body of event.heads){
    if(body.parentBody||body.thrustProfile||body.drag!==G/16||body.birth!==event.burstTime||body.trailProfile?.recipeId!=='layered-gold-v1')throw new RangeError('Scaled live enclosure requires unchanged unpowered same-birth layered-gold roots');
    const base=vector(body.basePosition,'Root baseline birth position'),velocity=vector(body.baseVelocity,'Root scaled base velocity'),kick=velocity.map((v,c)=>v-baselineVelocity[c]);
    if(Math.hypot(...kick)>S+1e-7)throw new RangeError('Scaled source violates19*compiled-alpha intrinsic contract');
    const life=finite(body.life,'Scaled root life',Number.MIN_VALUE,4.876),duration=finite(body.trailProfile.durationSeconds,'Scaled root tail duration',0,.35),gravity=finite(body.gravity??G,'Root gravity',0);
    include(burstPosition.map((r,c)=>r.map(v=>v+base[c]-baselinePosition[c])),burstVelocity.map((r,c)=>r.map(v=>v+kick[c])),body.drag,gravity,life,duration,body.id);
  }
  min[1]=Math.max(0,min[1]);max[1]=Math.max(min[1],max[1]);if(![...min,...max].every(Number.isFinite))throw new RangeError('Scaled live enclosure exceeded numeric domain');
  return{schema:'glass-atoll.scaled-firework-live-envelope.v1',eventId:event.id,effectProfile:SCALED_PROFILE,min,max,centre:min.map((v,c)=>(v+max[c])/2),burstPositionRanges:burstPosition,burstVelocityRanges:burstVelocity,
    limits:{familyIntrinsicSpeedMetresPerSecond:76,knownSourceIntrinsicSpeedMetresPerSecond:S,sourceRadialScaleAlpha:alpha,scaleBasis:'19*compiled alpha hard-input relation; per-body actual kick components, not sampled trajectory maxima',bodyCount:192,bodyMaximumSeconds:4.876,windRanges:wind,opticalShutterSeconds:shutterSeconds,opticalMaximumShutterSeconds:1,maximumComponentPaddingMetres:maximumPadding,maximumOpticalComponentPaddingMetres:maximumOpticalPadding,arithmeticPaddingMetres:1e-5},
    support:supports,coverage:'All actual event roots, rocket, detached-tail centres and bounded causal midpoint/linear shutter/lag stretch proxy endpoints above worldY0; every held-wind history within supplied ranges, fixed actual launch and fuse',
    limitations:['Binary64 conservative interval derivation with arithmetic padding, not a formal directed-rounding certificate.','Camera Gaussian quad, DOF, bloom and persistent smoke have separate framing margins; this is not curved-path or time-varying transmission integration accuracy.','No prediction beyond supplied wind ranges, no terrain safety or post-contact120m visible-width guarantee.']};
}

/**
 * origin is a fixed launch point''')

patch('fireworks.js',"import {getFireworkShowEnvelope} from './firework-show-envelope.js';","import {getFireworkShowEnvelope,getScaledFireworkLiveEnvelope} from './firework-show-envelope.js';")
patch('fireworks.js',"...(event.effectProfile==='powered-bees-v1'?{effectProfile:event.effectProfile}:{}),ground:","...(event.effectProfile==='powered-bees-v1'?{effectProfile:event.effectProfile}:{}),...(event.effectProfile==='three-heart-scale120-v1'?{effectProfile:event.effectProfile,radialScale:event.layerProfile.radialScale}:{}),ground:")
patch('fireworks.js',"    getBounds(){", "    getBounds(options={}){")
patch('fireworks.js',"      if(key===boundsKey)return boundsCache;",'''      const scaledEvents=simulation.active.filter(e=>e.effectProfile==='three-heart-scale120-v1');let scaledWind=null,scaledShutter=null;
      if(scaledEvents.length){
        scaledShutter=options.shutterSeconds??1;if(!Number.isFinite(scaledShutter)||scaledShutter<0||scaledShutter>1)throw new RangeError('Scaled bounds shutter requires0..1 seconds');
        const minimum=[0,0,0],maximum=[0,0,0];for(const knot of simulation.windTimeline)for(let c=0;c<3;c++){minimum[c]=Math.min(minimum[c],knot.wind[c]);maximum[c]=Math.max(maximum[c],knot.wind[c]);}
        scaledWind={min:minimum,max:maximum};key+='|scaled:'+scaledEvents.map(e=>e.layerProfile.radialScale.alpha).join(',')+'|shutter:'+scaledShutter+'|scaledWindRange:'+minimum.join(',')+'/'+maximum.join(',');
      }
      if(key===boundsKey)return boundsCache;''')
patch('fireworks.js',"      min[1]=Math.max(0,min[1]);boundsKey=key;",'''      const scaledAnalytic=[];
      for(const event of scaledEvents){
        const envelope=getScaledFireworkLiveEnvelope(event,{windRanges:scaledWind,shutterSeconds:scaledShutter});
        for(let c=0;c<3;c++){min[c]=Math.min(min[c],envelope.min[c]);max[c]=Math.max(max[c],envelope.max[c]);}
        scaledAnalytic.push({eventId:event.id,effectProfile:event.effectProfile,min:envelope.min,max:envelope.max,limits:envelope.limits,coverage:envelope.coverage,limitations:envelope.limitations});
      }
      min[1]=Math.max(0,min[1]);boundsKey=key;''')
patch('fireworks.js',"model:poweredEvents.length?'Native sampled/smoke forecast", "model:scaledEvents.length?'Native sampled/smoke forecast union continuous scaled actual-launch/fuse/source/tail/stretch/shutter enclosure; full committed wind ranges and compiled19*alpha relation':poweredEvents.length?'Native sampled/smoke forecast")
patch('fireworks.js',"...(poweredEvents.length?{poweredAnalytic}: {})};", "...(poweredEvents.length?{poweredAnalytic}: {}),...(scaledEvents.length?{scaledAnalytic}: {})};")

patch('firework-show-envelope.js',"  if(powered&&(kMin!==profileLimits.requiredBodyDragPerSecond||kMax!==kMin||canonical.heads.filter(b=>b.thrustProfile).length!==profileLimits.motorBodyCount))throw new RangeError('Powered generator drag/count violates the published envelope contract');", "  if(powered&&(kMin!==profileLimits.requiredBodyDragPerSecond||kMax!==kMin||canonical.heads.filter(b=>b.thrustProfile).length!==profileLimits.motorBodyCount))throw new RangeError('Powered generator drag/count violates the published envelope contract');\n  if(scaled&&(kMin!==profileLimits.requiredBodyDragPerSecond||kMax!==kMin||canonical.heads.length!==192||canonical.heads.some(b=>b.parentBody||b.thrustProfile)))throw new RangeError('Scaled generator drag/count/propulsion violates the published envelope contract');")
receipt={'schema':'glass-atoll.r35-two-motion-source-transform.v1','changes':changes,'sourceSHA256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['fireworks.js','firework-show-envelope.js']}}
(root/'verification/r35-motion-envelope-source-transform.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'changes':len(changes),'sourceSHA256':receipt['sourceSHA256']},indent=2))
