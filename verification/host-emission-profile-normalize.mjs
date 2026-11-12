// QA only: exact opt-in host parameter boundary; never strips source physics.
import {normalizePalmFanBurnHostSource} from './palm-fan-burn-normalize.mjs';
export const hostEmissionProfileEdits=Object.freeze([
  ['host option',"dispersionModel='brownian',lagrangianSeconds=10,emissionProfile='two-births'}={}){","dispersionModel='brownian',lagrangianSeconds=10}={}){"],
  ['profile validation',"  if(emissionProfile!=='two-births'&&emissionProfile!=='ring-uniform-burn-v1')throw new RangeError('emissionProfile must be two-births or ring-uniform-burn-v1');\n  parseSmokeDispersion(","  parseSmokeDispersion("],
  ['legacy profile refusal',"trajectorySlots!==12||dispersionModel!=='brownian'||emissionProfile!=='two-births')", "trajectorySlots!==12||dispersionModel!=='brownian')"],
  ['nondefault-only adapter option',"lagrangianSeconds,transport:SMOKE_SOURCE_TRANSPORT,...(emissionProfile==='two-births'?{}:{emissionProfile})})", "lagrangianSeconds,transport:SMOKE_SOURCE_TRANSPORT})"]
].map(e=>Object.freeze(e)));
export function normalizeSmokeHostEmissionProfileSource(source){let result=normalizePalmFanBurnHostSource(source);for(const [label,from,to]of hostEmissionProfileEdits){if(result.split(from).length!==2)throw new Error('Host emission profile scope drift: '+label);result=result.replace(from,to);}return result;}
