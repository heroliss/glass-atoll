// Verification-only source transform. Does not import or edit production code.
const START='  float treeSunVisibility(vec3 airPoint){';
const DISABLED='    if(uSunShadowEnabled<0.5)return 1.0;';
const OLD='    if(uSunShadowEnabled<0.5||coordinate.z<0.0||coordinate.z>1.0||any(lessThan(coordinate.xy,vec2(0.0)))||any(greaterThan(coordinate.xy,vec2(1.0))))return 1.0;';
const NEXT='    if(coordinate.z<0.0||coordinate.z>1.0||any(lessThan(coordinate.xy,vec2(0.0)))||any(greaterThan(coordinate.xy,vec2(1.0))))return 1.0;';
function once(source,token){if(typeof source!=='string'||source.split(token).length!==2)throw new Error('Disabled-shadow candidate source anchor drift');}
export function createDisabledSunShadowEarlyReturnCandidate(source){
  once(source,START);once(source,OLD);
  if(source.includes(DISABLED))throw new Error('Disabled-shadow candidate already applied');
  const newline=source.includes('\r\n')?'\r\n':'\n';
  return source.replace(START,START+newline+DISABLED).replace(OLD,NEXT);
}
export function restoreDisabledSunShadowEarlyReturnCandidate(source){
  const newline=source.includes('\r\n')?'\r\n':'\n';
  const joined=START+newline+DISABLED;once(source,joined);once(source,NEXT);
  return source.replace(joined,START).replace(NEXT,OLD);
}
export const DISABLED_SHADOW_CANDIDATE_SCOPE=Object.freeze({
  productionEdits:false,actualGPU:false,
  symbol:'treeSunVisibility',
  predicate:'uSunShadowEnabled < 0.5',
  disabledResult:1,
  enabledPath:'Unchanged coordinate, derivative, frustum, PCF, comparison and mix order',
  notPresent:'No sunShadowVisibility symbol exists in the current production sun-shadows.js',
  limitation:'Source equivalence only; GPU raster/driver timing still needs the separately admitted bounded gate',
});
