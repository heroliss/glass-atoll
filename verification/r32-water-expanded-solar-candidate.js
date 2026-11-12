// Verification-only adapter for the actual factory-expanded fragment shader.
import {waveStatistics} from '../waves.js';
import {createWaterZeroSolarCandidate,restoreWaterZeroSolarCandidate} from './r32-water-zero-solar-candidate.js';
const KEYS=Object.freeze(['swellTemporalSlopeVariance','windTemporalSlopeVariance']);
const EXPECTED=Object.freeze(Object.fromEntries(KEYS.map(k=>[k,waveStatistics[k].toFixed(14)])));
const LITERAL='${waveStatistics.swellTemporalSlopeVariance.toFixed(14)}*uSwell*uSwell+${waveStatistics.windTemporalSlopeVariance.toFixed(14)}*windGain*windGain;';
const originalPrefix='        float temporalNormalVariance=',candidatePrefix='          temporalNormalVariance=';
function validateCoefficients(coefficients){
  if(!coefficients||typeof coefficients!=='object'||Array.isArray(coefficients)||![Object.prototype,null].includes(Object.getPrototypeOf(coefficients)))throw new TypeError('Two plain own coefficient strings are required');
  const descriptors=Object.getOwnPropertyDescriptors(coefficients),keys=Reflect.ownKeys(descriptors);
  if(keys.length!==2||keys.some(k=>typeof k!=='string'||!KEYS.includes(k)))throw new TypeError('Only the two production temporal coefficients are accepted');
  for(const key of KEYS){const d=descriptors[key];if(!d||!Object.hasOwn(d,'value')||d.enumerable!==true||typeof d.value!=='string'||d.value!==EXPECTED[key])throw new RangeError('Coefficient must be an own data string exactly matching current production toFixed(14): '+key);}
  return EXPECTED.swellTemporalSlopeVariance+'*uSwell*uSwell+'+EXPECTED.windTemporalSlopeVariance+'*windGain*windGain;';
}
function replaceOnce(source,from,to){if(typeof source!=='string'||source.split(from).length!==2)throw new Error('Expanded water temporal coefficient anchor drift');return source.replace(from,to);}
export function createExpandedWaterZeroSolarCandidate(source,coefficients){
  const expanded=validateCoefficients(coefficients);
  const literalized=replaceOnce(source,originalPrefix+expanded,originalPrefix+LITERAL);
  const candidate=createWaterZeroSolarCandidate(literalized);
  return replaceOnce(candidate,candidatePrefix+LITERAL,candidatePrefix+expanded);
}
export function restoreExpandedWaterZeroSolarCandidate(source,coefficients){
  const expanded=validateCoefficients(coefficients);
  const literalized=replaceOnce(source,candidatePrefix+expanded,candidatePrefix+LITERAL);
  const original=restoreWaterZeroSolarCandidate(literalized);
  return replaceOnce(original,originalPrefix+LITERAL,originalPrefix+expanded);
}
export const EXPANDED_WATER_ZERO_SOLAR_CANDIDATE=Object.freeze({
  revision:'r32-actual-expanded-water-zero-direct-source-v1',
  coefficients:EXPECTED,
  substitution:'Only one exact temporal coefficient declaration/assignment line; no regex or arbitrary GLSL substitutions',
  actualGPU:false,productionEdits:false,
});
