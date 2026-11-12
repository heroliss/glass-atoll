// QA-only author envelope for an attached decorative ascent light. No thrust,
// fuel, smoke-mass, event/RNG/audio writes, production imports or activation.
import {starEnvelope} from '../../fireworks-physics.js';
export const ASCENT_ENVELOPE_PROFILES=Object.freeze({
  'through-burst-v1':Object.freeze({attackSeconds:.12,fadeSeconds:.40,coastSeconds:0}),
  'early-burnout-preview-v1':Object.freeze({attackSeconds:.12,fadeSeconds:.40,coastSeconds:.35}),
});
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth5=x=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};

export function ascentEnvelopeClock(life,profile='through-burst-v1'){
  if(!Number.isFinite(life)||life<0)throw new RangeError('finite nonnegative life required');
  if(!Object.hasOwn(ASCENT_ENVELOPE_PROFILES,profile))throw new RangeError('unknown QA ascent profile');
  const p=ASCENT_ENVELOPE_PROFILES[profile],coast=Math.min(p.coastSeconds,life*.25),burnout=life-coast;
  // Preserve separate attack/plateau/fade even for deliberately tiny QA lives.
  const attack=Math.min(p.attackSeconds,burnout*.25),fade=Math.min(p.fadeSeconds,burnout*.35);
  return{profile,life,attackEnd:attack,fadeStart:burnout-fade,burnout,coastSeconds:coast,fadeSeconds:fade,
    analyticEmissionSeconds:Math.max(0,burnout-(attack+fade)*.5)};
}
export function ascentEffectEnvelope(body,age,profile='through-burst-v1'){
  if(!Number.isFinite(age))throw new RangeError('finite age required');
  const c=ascentEnvelopeClock(body?.life,profile);
  if(age<=0||age>=c.burnout||c.burnout<=0)return 0;
  return smooth5(age/c.attackEnd)*smooth5((c.burnout-age)/c.fadeSeconds);
}
// A candidate central callsite for future integration. Non-carriers delegate
// unchanged to the real star envelope; kind='rocket' is a legacy carrier name.
export function bodyEmissionPrototype(body,age,profile='through-burst-v1'){
  return body?.kind==='rocket'?ascentEffectEnvelope(body,age,profile):starEnvelope(body,age);
}
export function shutterEmissionPrototype(body,age,seconds=1/120,profile='through-burst-v1'){
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('finite nonnegative shutter required');
  return Array.from({length:8},(_,k)=>bodyEmissionPrototype(body,age+((k+.5)/8-.5)*seconds,profile));
}
