// QA ONLY: inverse of the six coordinate-fix sites. The previous adaptive
// candidate and its failed GPU evidence remain immutable baselines.
export const adaptiveTailCentreEdits=Object.freeze([
  ['flat vertex centre','flat out vec4 vTrailSampling;flat out vec2 vTrailCentre;out vec2','flat out vec4 vTrailSampling;out vec2'],
  ['physical projected centre','      // Adaptive integration uses the physical projected centre, independent\n      // of the expanded quad\'s implementation-dependent raster snapping.\n      vTrailCentre=(ndc*.5+.5)*uSize;\n      vec2 extent=','      vec2 extent='],
  ['flat fragment centre','flat in vec4 vTrailSampling;flat in vec2 vTrailCentre;in vec2','flat in vec4 vTrailSampling;in vec2'],
  ['adaptive fragment position','    float adaptiveSpatialKernel(float n){\n      vec2 pixelOffset=gl_FragCoord.xy-vTrailCentre;','    float adaptiveSpatialKernel(float n){'],
  ['adaptive index position','      float along=dot(pixelOffset,axis);','      float along=dot(vOffset,axis);'],
  ['adaptive sample position','        vec2 q=pixelOffset-vMotion*((float(i)+.5)/n-.5);','        vec2 q=vOffset-vMotion*((float(i)+.5)/n-.5);']
].map(Object.freeze));
export function normalizeAdaptiveTailCentreSource(source,{required=false}={}){
  if(!required&&!source.includes('vTrailCentre'))return source;
  let result=source;
  for(const [name,from,to]of adaptiveTailCentreEdits){const count=result.split(from).length-1;if(count!==1)throw Error('Adaptive-tail centre inverse '+name+' count '+count);result=result.replace(from,to);}
  return result;
}
