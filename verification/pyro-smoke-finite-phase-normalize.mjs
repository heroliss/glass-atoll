// QA only: exactly undo this round's seven optional-phase edits. Does not strip
// arbitrary render/shader functions or authorize any other physical change.
import {normalizeResolvedRendererSource} from './resolved-light-default-normalize.mjs';
export const finitePhaseEdits=Object.freeze([
  ['uniform allocation','Object.assign(uniforms,localDefaults,{uUseLocalLighting:{value:0},uFiniteClusterPhase:{value:0}});','Object.assign(uniforms,localDefaults,{uUseLocalLighting:{value:0}});'],
  ['GLSL uniform','uniform float uUseLocalLighting,uFiniteClusterPhase;','uniform float uUseLocalLighting;'],
  ['local pyro phase branch','if(uUseLocalLighting>.5){vec3 worldPoint=uEye+point;for(int i=0;i<6;i++){vec3 L;vec3 incident=localIncident(worldPoint,i,L);if(uFiniteClusterPhase>.5&&i>=4){float distance=length(uLocalPosition[i].xyz-worldPoint),weight=smoothstep(1.,2.,distance/uLocalPosition[i].w),phase=mix(0.07957747154594767,phaseHG(clamp(dot(direction,L),-1.,1.)),weight);source+=incident*phase;}else{source+=incident*phaseHG(clamp(dot(direction,L),-1.,1.));}}}','if(uUseLocalLighting>.5){vec3 worldPoint=uEye+point;for(int i=0;i<6;i++){vec3 L;vec3 incident=localIncident(worldPoint,i,L);source+=incident*phaseHG(clamp(dot(direction,L),-1.,1.));}}'],
  ['legacy pyro phase branch','if(uFiniteClusterPhase>.5){float weight=smoothstep(1.,2.,sqrt(distance2)/uClusterRadius[i]);phase=mix(0.07957747154594767,phase,weight);}',''],
  ['optional argument','air={},localLighting=null,finiteClusterPhase=false,optics={},debugMode=0','air={},localLighting=null,optics={},debugMode=0'],
  ['uniform assignment','      uniforms.uFiniteClusterPhase.value=finiteClusterPhase?1:0;\n',''],
  ['diagnostic flag','samplerCount:2,finiteClusterPhase:!!finiteClusterPhase','samplerCount:2']
].map(x=>Object.freeze(x)));
export function normalizeSmokeFinitePhaseSource(source){let result=source.includes("import {createPyroSmokeLightField}")?normalizeResolvedRendererSource(source):source;for(const [label,from,to]of finitePhaseEdits){const count=result.split(from).length-1;if(count!==1)throw new Error(`Finite phase scope drift: ${label} expected1 occurrence, got${count}`);result=result.replace(from,to);}return result;}
