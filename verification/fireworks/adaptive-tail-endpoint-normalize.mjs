// QA ONLY: the single exact zero-weight-dispatch optimization site.
export const adaptiveTailEndpointEdits=Object.freeze([
  ['zero weight short-circuit',
    '        if(vTrailSampling.w>.5){\n          if(vTrailSampling.z==0.)kernel=meanEmission*adaptiveSpatialKernel(vTrailSampling.x);\n          else kernel=meanEmission*mix(adaptiveSpatialKernel(vTrailSampling.x),adaptiveSpatialKernel(vTrailSampling.y),vTrailSampling.z);\n        }',
    '        if(vTrailSampling.w>.5)kernel=meanEmission*mix(adaptiveSpatialKernel(vTrailSampling.x),adaptiveSpatialKernel(vTrailSampling.y),vTrailSampling.z);']
].map(Object.freeze));
export function normalizeAdaptiveTailEndpointSource(source,{required=false}={}){
  if(!required&&!source.includes('if(vTrailSampling.z==0.)'))return source;
  let result=source;for(const [name,from,to]of adaptiveTailEndpointEdits){const count=result.split(from).length-1;if(count!==1)throw Error('Adaptive-tail endpoint inverse '+name+' count '+count);result=result.replace(from,to);}return result;
}
