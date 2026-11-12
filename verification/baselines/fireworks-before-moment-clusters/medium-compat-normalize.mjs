// QA ONLY. Remove exactly the five reviewed optional-medium edits. No broad
// fillRecords/render block stripping, whitespace normalization or runtime use.
export const mediumCompatibilityEdits=Object.freeze([
  ['fillRecords optional arguments','function fillRecords(camera,air,rawPerCandela,shutter,medium=null,legacySmoke=true,reflection=false,planeY=0){','function fillRecords(camera,air,rawPerCandela,shutter){'],
  ['default no-op legacy smoke filter',"ordered=records.filter(p=>legacySmoke||p.kind!=='smoke').map(",'ordered=records.map('],
  ['optional visible-emitter transmission only',"      if(medium&&!smoke){const T=medium.transmission(eye,p.position,{reflection,planeY});for(let c=0;c<3;c++)arrays.colour[i*3+c]*=T[c];}\n",''],
  ['render optional arguments','optics={},air={},medium=null,legacySmoke=true}={}){','optics={},air={}}={}){'],
  ['fillRecords optional argument forwarding','fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value,medium,legacySmoke,reflection,planeY);','fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value);']
].map(a=>Object.freeze(a)));

export function normalizeFireworksMediumSource(source){
  if(typeof source!=='string')throw new TypeError('Medium compatibility normalizer needs exact source text');
  let normalized=source;
  for(const [label,from,to]of mediumCompatibilityEdits){
    const count=normalized.split(from).length-1;
    if(count!==1)throw new Error(`Medium compatibility scope drift: ${label} must occur exactly once, got ${count}`);
    normalized=normalized.replace(from,to);
  }
  return normalized;
}
