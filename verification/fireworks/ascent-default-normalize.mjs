// QA ONLY: exactly undo the authorized default decorative-ascent layer.
// Every new anchor must occur once; all unrelated bytes survive unchanged.
import {normalizeAdaptiveTailSource} from './adaptive-tail-default-normalize.mjs';
export const ascentPhysicsEdits=Object.freeze([
  [
    "central decorative body envelope",
    "// Legacy kind='rocket' is a ballistic mortar carrier with an authored attached\n// ascent-light effect, not a continuously thrusting engine or a smoke-mass source.\n// Source candela stays unchanged; this bounded C2 envelope is not renormalized.\nexport function bodyEmissionEnvelope(body,age){\n  if(body.kind!=='rocket')return starEnvelope(body,age);\n  if(age<=0||age>=body.life)return 0;\n  const attack=Math.min(.12,body.life*.25),fade=Math.min(.40,body.life*.35);\n  const enter=clamp(age/attack,0,1),end=clamp((body.life-age)/fade,0,1);\n  return enter*enter*enter*(enter*(enter*6-15)+10)*end*end*end*(end*(end*6-15)+10);\n}\n",
    ""
  ],
  [
    "physics carrier emission",
    "emission:bodyEmissionEnvelope(event.rocket,time-event.time)",
    "emission:1"
  ]
].map(Object.freeze));
export const ascentFireworksEdits=Object.freeze([
  [
    "central import",
    "import {FIREWORK_TYPES,EMISSION_PROFILES,createFireworksSimulation,sampleBody,bodyEmissionEnvelope,clamp} from './fireworks-physics.js';",
    "import {FIREWORK_TYPES,EMISSION_PROFILES,createFireworksSimulation,sampleBody,starEnvelope,clamp} from './fireworks-physics.js';"
  ],
  [
    "carrier meaning",
    "combustion:'not-established; no engine/fuel material metadata; authored through-burst-v1 attached ascent-light proxy; ballistic carrier has no sustained propulsion'",
    "combustion:'not-established; no engine/fuel/ascent-comet metadata'"
  ],
  [
    "head clock",
    "emission=bodyEmissionEnvelope(body,age)",
    "emission=rocket?(age<life?1:0):starEnvelope(body,age)"
  ],
  [
    "tail birth clock",
    "const envelope=bodyEmissionEnvelope(body,a)",
    "const envelope=rocket?1:starEnvelope(body,a)"
  ],
  [
    "shutter clock",
    "const weight=!body?1:bodyEmissionEnvelope(body,age);",
    "const weight=!body?1:body.kind==='rocket'?(age>=0&&age<body.life?1:0):starEnvelope(body,age);"
  ]
].map(Object.freeze));
function inverse(source,edits){if(typeof source!=='string')throw new TypeError('Source text required');if(!edits.some(([,from])=>source.includes(from)))return source;for(const [name,from,to]of edits){const count=source.split(from).length-1;if(count!==1)throw Error('Ascent inverse '+name+' requires one exact site; found '+count);source=source.replace(from,to);}return source;}
export const normalizeAscentPhysicsSource=source=>inverse(source,ascentPhysicsEdits);
export const normalizeAscentFireworksSource=source=>inverse(normalizeAdaptiveTailSource(source),ascentFireworksEdits);
