import {normalizeAscentPhysicsSource} from './ascent-default-normalize.mjs';
// QA-only exact inverse of the ring timed-reference extension. Every site
// must appear exactly once; then restore the full frozen D60 physics source.
export const timedFlightEdits=Object.freeze([
  {
    "name": "private_flight_parser_and_inverse",
    "before": "// Analytic CIE 1931 fit",
    "after": "// Opt-in display trajectory calibrated to a supplier example's height/fuse\n// labels. It is not a measured smiley trajectory or a charge/energy recipe.\nfunction parseFlightOptions({type='peony',flightModel='apex',burstDelaySeconds,height}={}){\n  if(flightModel!=='apex'&&flightModel!=='timed-reference')throw new RangeError('flightModel must be apex or timed-reference');\n  if(flightModel==='apex'){if(burstDelaySeconds!==undefined)throw new RangeError('burstDelaySeconds requires timed-reference');return null;}\n  if(type!=='ring')throw new RangeError('timed-reference currently requires ring');\n  if(burstDelaySeconds!==3)throw new RangeError('timed-reference requires explicit burstDelaySeconds=3');\n  if(height!==undefined)throw new RangeError('timed-reference uses the definition rise120; explicit height is unsupported');\n  return{model:flightModel,burstDelaySeconds};\n}\nfunction timedReferenceLaunch(height,time){\n  const drag=.075,travel=-Math.expm1(-drag*time)/drag;\n  return{time,verticalVelocity:(height+G*time/drag)/travel-G/drag,height};\n}\n\n// Analytic CIE 1931 fit"
  },
  {
    "name": "factory_optin_arguments",
    "before": "smileyLayout='reference',intensityScale=1}={}){\n  intensityScale=",
    "after": "smileyLayout='reference',intensityScale=1,flightModel='apex',burstDelaySeconds}={}){\n  intensityScale="
  },
  {
    "name": "factory_flight_preflight",
    "before": "  intensityScale=normaliseIntensityScale(intensityScale);\n  const definition=",
    "after": "  intensityScale=normaliseIntensityScale(intensityScale);\n  const flight=parseFlightOptions({type,flightModel,burstDelaySeconds,height});\n  const definition="
  },
  {
    "name": "reference_height_at_fixed_fuse",
    "before": "  const reference=apexLaunch(rise),muzzleSpeed=reference.verticalVelocity/Math.sin(80*PI/180),verticalVelocity=muzzleSpeed*Math.sin(elevation*PI/180),flightTime=Math.log1p(.075*verticalVelocity/G)/.075;",
    "after": "  const reference=flight?timedReferenceLaunch(rise,flight.burstDelaySeconds):apexLaunch(rise),muzzleSpeed=reference.verticalVelocity/Math.sin(80*PI/180),verticalVelocity=muzzleSpeed*Math.sin(elevation*PI/180),flightTime=flight?flight.burstDelaySeconds:Math.log1p(.075*verticalVelocity/G)/.075;"
  },
  {
    "name": "candidate_height_semantics",
    "before": "  const heightInfo={inputMode:definition.ground?",
    "after": "  const heightInfo={inputMode:flight?'timed-reference-rise':definition.ground?"
  },
  {
    "name": "candidate_only_height_evidence",
    "before": "    visibleApex:definition.ground?groundVisibleApex(heads,origin[1]):null};",
    "after": "    visibleApex:definition.ground?groundVisibleApex(heads,origin[1]):null,...(flight?{flightInfo:{model:flight.model,burstDelaySeconds:flight.burstDelaySeconds,referenceRiseMetres:120,referenceElevationDegrees:80,referenceVerticalVelocity:reference.verticalVelocity,muzzleSpeed,actualBurstVerticalVelocity:burstState.velocity[1],heightMeaning:'rise at fixed fuse, not apex; changed elevation keeps reference muzzle speed',authorApproximation:'constant linear drag .075/s; example fuse interpreted as display launch-to-burst delay; not measured smiley ballistics',sourceURL:'https://rise-hanabi.jp/fireworks/knowledge/'}}:{})};"
  },
  {
    "name": "actual_resolved_burst_velocity_evidence",
    "before": "  event.heightInfo.actualBurstWorldY=actual.position[1];event.heightInfo.actualBurstRiseMetres=actual.position[1]-event.origin[1];",
    "after": "  event.heightInfo.actualBurstWorldY=actual.position[1];event.heightInfo.actualBurstRiseMetres=actual.position[1]-event.origin[1];\n  if(event.heightInfo.flightInfo)event.heightInfo.flightInfo.actualBurstVerticalVelocity=actual.velocity[1];"
  },
  {
    "name": "queue_preflight_before_seed_slot_or_queue",
    "before": "  function launch(options={}){if(Object.hasOwn(options,'intensityScale'))",
    "after": "  function launch(options={}){const flight=parseFlightOptions({type:settings.type,...options});if(flight)options={...options,type:'ring'};if(Object.hasOwn(options,'intensityScale'))"
  },
  {
    "name": "refuse_persistent_flight_settings",
    "before": "    configure(patch={}){const intensityScale=",
    "after": "    configure(patch={}){if(Object.hasOwn(patch,'flightModel')||Object.hasOwn(patch,'burstDelaySeconds'))throw new RangeError('Flight candidates are per-launch only; configure is unchanged');const intensityScale="
  }
]);
export function normalizeTimedFlightPhysicsSource(source){
  source=normalizeAscentPhysicsSource(source);
  for(const {name,before,after} of [...timedFlightEdits].reverse()){
    const count=source.split(after).length-1;
    if(count!==1)throw new Error('Timed flight inverse '+name+' requires one exact site; found '+count);
    source=source.replace(after,before);
  }
  return source;
}
