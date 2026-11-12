// QA ONLY. Remove exactly the five medium and six optional-cluster edits.
// Each exact edit is matched once; no block stripping or whitespace normalization.
export const mediumCompatibilityEdits=Object.freeze([
  ['fillRecords optional arguments','function fillRecords(camera,air,rawPerCandela,shutter,medium=null,legacySmoke=true,reflection=false,planeY=0){','function fillRecords(camera,air,rawPerCandela,shutter){'],
  ['default no-op legacy smoke filter',"ordered=records.filter(p=>legacySmoke||p.kind!=='smoke').map(",'ordered=records.map('],
  ['optional visible-emitter transmission only',"      if(medium&&!smoke){const T=medium.transmission(eye,p.position,{reflection,planeY});for(let c=0;c<3;c++)arrays.colour[i*3+c]*=T[c];}\n",''],
  ['render optional arguments','optics={},air={},medium=null,legacySmoke=true}={}){','optics={},air={}}={}){'],
  ['fillRecords optional argument forwarding','fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value,medium,legacySmoke,reflection,planeY);','fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value);']
].map(a=>Object.freeze(a)));

export const clusterModelCompatibilityEdits=Object.freeze([
  [
    "optional cluster factory model",
    "{terrainHeight=()=>0,origin=[29,0,7],seed=14271,clusterModel='legacy'}={}){",
    "{terrainHeight=()=>0,origin=[29,0,7],seed=14271}={}){"
  ],
  [
    "validated cluster model closure",
    "  const validateClusterModel=value=>{if(value!=='legacy'&&value!=='moments')throw new RangeError(\"clusterModel must be 'legacy' or 'moments'\");return value;};\n  clusterModel=validateClusterModel(clusterModel);\n  const base=[...origin];",
    "  const base=[...origin];"
  ],
  [
    "optional moments cluster closure",
    "    const cluster={position:centre,color:rgb,colour:rgb,referenceCandela:I,intensity:I,radius:Math.max(2,Math.min(28,(simulation.time-event.burstTime)*8)),kind:'fireworks diffuse cluster',eventId:event.id,pathFlags:{diffuse:true,smoke:true,specular:false}};\n    if(clusterModel==='moments'){\n      // A finite-radius point proxy from the same luminous head/tail ledger.\n      // Spatial moments retain total I; they are not resolved area emission.\n      let weightedRadiusSquared=0,maxExtent=0;\n      for(const p of heads){if(!(p.intensity>0))continue;const dx=p.position[0]-centre[0],dy=p.position[1]-centre[1],dz=p.position[2]-centre[2],r2=dx*dx+dy*dy+dz*dz;weightedRadiusSquared+=p.intensity*r2;maxExtent=Math.max(maxExtent,Math.sqrt(r2));}\n      const rmsRadius=I>0?Math.sqrt(Math.max(0,weightedRadiusSquared/I)):0;\n      Object.assign(cluster,{radius:Math.max(2,rmsRadius),rmsRadius,maxExtent,illuminationModel:'intensity-weighted spatial-moment finite-radius point proxy; not exact area emission'});\n    }\n    return cluster;",
    "    return{position:centre,color:rgb,colour:rgb,referenceCandela:I,intensity:I,radius:Math.max(2,Math.min(28,(simulation.time-event.burstTime)*8)),kind:'fireworks diffuse cluster',eventId:event.id,pathFlags:{diffuse:true,smoke:true,specular:false}};"
  ],
  [
    "strip cluster configuration before physics",
    "const nextClusterModel=patch.clusterModel===undefined?clusterModel:validateClusterModel(patch.clusterModel),{clusterModel:ignoredClusterModel,...physicsPatch}=patch;const state=simulation.configure(physicsPatch);if(nextClusterModel!==clusterModel){clusterModel=nextClusterModel;clusterCache=null;boundCache=null;}const az=",
    "const state=simulation.configure(patch),az="
  ],
  [
    "echo selected cluster model",
    "launchOrigin[2]=base[2]+axis.z*.66;return{...state,clusterModel};",
    "launchOrigin[2]=base[2]+axis.z*.66;return state;"
  ],
  [
    "cluster diagnostics model",
    "diagnostics(){return{...simulation.state,clusterModel,clusterIlluminationModel:clusterModel==='moments'?'spatial-moment finite-radius point proxy; not exact area emission':'legacy age-times8 radius capped at28m',records:",
    "diagnostics(){return{...simulation.state,records:"
  ]
].map(a=>Object.freeze(a)));

export function normalizeFireworksMediumSource(source){
  if(typeof source!=='string')throw new TypeError('Medium compatibility normalizer needs exact source text');
  let normalized=source;
  for(const [label,from,to]of [...clusterModelCompatibilityEdits,...mediumCompatibilityEdits]){
    const count=normalized.split(from).length-1;
    if(count!==1)throw new Error(`Medium compatibility scope drift: ${label} must occur exactly once, got ${count}`);
    normalized=normalized.replace(from,to);
  }
  return normalized;
}

export function normalizeFireworksClusterSource(source){
  if(typeof source!=='string')throw new TypeError('Cluster compatibility normalizer needs exact source text');
  let normalized=source;
  for(const [label,from,to]of clusterModelCompatibilityEdits){
    const count=normalized.split(from).length-1;
    if(count!==1)throw new Error(`Cluster compatibility scope drift: ${label} must occur exactly once, got ${count}`);
    normalized=normalized.replace(from,to);
  }
  return normalized;
}
