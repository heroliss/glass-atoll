import {normalizeEmissionLedgerSource} from './emission-ledger-normalize.mjs';
import {normalizeFireworkHomogeneousClipSource} from './homogeneous-clip-normalize.mjs';
// QA ONLY: exact inverse of read-only source trace hook.
export const fireworkBoundTraceEdits=Object.freeze([
  [
    "optional read-only source trace argument",
    "getRadianceBound({camera,optics={},rawPerCandela=3.6e-5,onSourceBound=null}={}){\n      if(onSourceBound!==null&&typeof onSourceBound!=='function')throw new TypeError('onSourceBound must be a function or null');",
    "getRadianceBound({camera,optics={},rawPerCandela=3.6e-5}={}){"
  ],
  [
    "read-only trace ordinal",
    "let global=0,maxChannel=0,visible=0,nearFallback=0,traceOrdinal=0;",
    "let global=0,maxChannel=0,visible=0,nearFallback=0;"
  ],
  [
    "source values frozen and reported without changing bound",
    "const projected=writeSourceBound(p,projection,bound,colourMaximum);if(onSourceBound){const vector=v=>Object.freeze(Array.from(v||boundZero)),source=Object.freeze({index:traceOrdinal++,kind:p.kind,eventId:p.eventId??null,bodyId:p.sourceBody?.id??null,patternPart:p.sourceBody?.patternPart??null,position:vector(p.position),positionInputFloat32:p.position instanceof Float32Array,velocity:vector(p.velocity),stretch:vector(p.stretch),colour:vector(p.colour),radius:p.radius,intensity:p.intensity,unmodulatedIntensity:p.unmodulatedIntensity??p.intensity,sourceAge:p.sourceAge??null}),output=Object.freeze(projected?{...bound,rect:vector(bound.rect),shutterPixels:vector(bound.shutterPixels),stretchPixels:vector(bound.stretchPixels)}:{peak:0,visible:false,nearPlaneFallback:false,rect:vector(bound.rect)});onSourceBound(Object.freeze({source,bound:output,projected:!!projected}));}if(!projected||!bound.visible)continue;visible++;",
    "if(!writeSourceBound(p,projection,bound,colourMaximum)||!bound.visible)continue;visible++;"
  ]
].map(e=>Object.freeze(e)));
export function normalizeFireworkBoundTraceSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=source.includes('function getEmissionLedger(')?normalizeEmissionLedgerSource(source):source;result=result.includes('function prepareFireworkDepthClip(')?normalizeFireworkHomogeneousClipSource(result):result;for(const [label,from,to]of fireworkBoundTraceEdits){const n=result.split(from).length-1;if(n!==1)throw new Error('Source trace scope drift: '+label+' count '+n);result=result.replace(from,to);}return result;}
