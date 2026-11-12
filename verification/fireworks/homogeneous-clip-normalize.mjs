// QA ONLY. Exact inverse of the GPU-witnessed homogeneous depth-budget fix.
export const homogeneousClipEdits=Object.freeze([
  [
    "Float32 homogeneous depth interval helper",
    "// The actual quad expands only clip.xy, so its four vertices share centre z/w.\n// Budget rejection uses the same Float32 centre and combined P*V upload. A\n// gamma7 dot-product interval retains the old bound at uncertain clip edges.\nconst fireworkClipGamma7=(7*2**-24)/(1-7*2**-24),fireworkClipFTZ=8*2**-126,fireworkClipMax=3.4028234663852886e38/8;\nfunction prepareFireworkDepthClip(c){\n  const M=c.gpuClipVP||(c.gpuClipVP=new Float32Array(16)),P=c.P,V=c.V;let finite=true;\n  for(let col=0;col<4;col++)for(let row=0;row<4;row++){const i=col*4;M[i+row]=P[row]*V[i]+P[row+4]*V[i+1]+P[row+8]*V[i+2]+P[row+12]*V[i+3];finite&&=Number.isFinite(M[i+row]);}\n  c.gpuClipFinite=finite;\n}\nfunction fireworkCentreDepthClipped(position,c){\n  if(!c.gpuClipFinite)return false;const M=c.gpuClipVP,x=Math.fround(position[0]),y=Math.fround(position[1]),z=Math.fround(position[2]);\n  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return false;\n  const za=M[2]*x,zb=M[6]*y,zc=M[10]*z,zd=M[14],wa=M[3]*x,wb=M[7]*y,wc=M[11]*z,wd=M[15],Z=za+zb+zc+zd,W=wa+wb+wc+wd,az=Math.abs(za)+Math.abs(zb)+Math.abs(zc)+Math.abs(zd),aw=Math.abs(wa)+Math.abs(wb)+Math.abs(wc)+Math.abs(wd);\n  // Extreme public/world inputs could overflow an actual Float32 multiply;\n  // retain the original budget instead of reasoning from finite binary64.\n  if(az>fireworkClipMax||aw>fireworkClipMax)return false;\n  const ez=fireworkClipGamma7*az+fireworkClipFTZ,ew=fireworkClipGamma7*aw+fireworkClipFTZ;\n  return W+ew<=Math.fround(.01)||Z-ez>W+ew||(Z+ez)+(W+ew)<0;\n}\n",
    ""
  ],
  [
    "prepare immutable upload matrix once per camera context",
    "prepareFireworkDepthClip(projection);sourceProjectionCache.set(camera,projection);",
    "sourceProjectionCache.set(camera,projection);"
  ],
  [
    "exclude only robustly clipped rows from overlap bins",
    "if(!projected||!bound.visible||fireworkCentreDepthClipped(p.position,projection))continue;",
    "if(!projected||!bound.visible)continue;"
  ]
].map(e=>Object.freeze(e)));
export function normalizeFireworkHomogeneousClipSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of homogeneousClipEdits){const count=result.split(from).length-1;if(count!==1)throw new Error('Homogeneous clip scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}
