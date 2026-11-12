// QA ONLY: exact opt-in adaptive-tail layer, applied before older scope guards.
import {normalizeAdaptiveTailCentreSource} from './adaptive-tail-centre-normalize.mjs';
import {normalizeAdaptiveTailEndpointSource} from './adaptive-tail-endpoint-normalize.mjs';
import {normalize as normalizeFWTransmissionSource} from '../r10-fw-transmission-normalize.mjs';
import {normalize as normalizeCombustionBodySamplerSource} from './combustion-body-sampler-normalize.mjs';
export const adaptiveTailEdits=Object.freeze([
  [
    "optional constructor mode",
    "seed=14271,clusterModel='legacy',trailIntegration='legacy8'}={}){",
    "seed=14271,clusterModel='legacy'}={}){"
  ],
  [
    "mode validation",
    "  const validateTrailIntegration=value=>{if(value!=='legacy8'&&value!=='adaptive')throw new RangeError(\"trailIntegration must be 'legacy8' or 'adaptive'\");return value;};\n  trailIntegration=validateTrailIntegration(trailIntegration);\n  clusterModel=validateClusterModel(clusterModel);",
    "  clusterModel=validateClusterModel(clusterModel);"
  ],
  [
    "mode uniform",
    "uTrailAdaptive:{value:trailIntegration==='adaptive'?1:0},uStorageScale:{value:1},uRawPerCandela:",
    "uStorageScale:{value:1},uRawPerCandela:"
  ],
  [
    "vertex mode uniform",
    "uniform float uFocalMm,uAperture,uFocus,uSensorHeightMm,uDof,uShutter,uTrailAdaptive;",
    "uniform float uFocalMm,uAperture,uFocus,uSensorHeightMm,uDof,uShutter;"
  ],
  [
    "flat vertex sampling policy",
    "flat out vec4 vTrailSampling;out vec2 vOffset,vMotion;out vec3",
    "out vec2 vOffset,vMotion;out vec3"
  ],
  [
    "per-source bounded adaptive policy",
    "      // Each complete source selects ONE path. No per-pixel legacy/adaptive mix.\n      // Continuous N/N+1 blend keeps both midpoint spacings strictly below.5px.\n      vTrailSampling=vec4(8.,8.,0.,0.);\n      if(trail&&uTrailAdaptive>.5){\n        float L=length(motion);\n        if(L>1e-4){\n          vec2 axis=motion/L;float targetStep=.5*max(1.,sigma);float x=max(7.,L/targetStep),n0=floor(x)+1.,n1=n0+1.,f=fract(x),blend=clamp(f*f*f*(f*(f*6.-15.)+10.),0.,1.);\n          float support=.5*(abs(axis.x)+abs(axis.y))+6.*sigma+.02;\n          if(explicitShutter>.5)support+=.38729833462*abs(dot(shutter,axis));\n          float maxLocal=min(n1,ceil(2.*support*n1/L)+4.);\n          // Global index range is bounded for highp float precision. Local\n          // work is bounded independently of the complete segment length.\n          if(n1<=65536.&&maxLocal<=128.)vTrailSampling=vec4(n0,n1,blend,1.);\n        }\n      }\n      vec2 extent=3.65*vec2(sigma)",
    "      vec2 extent=3.65*vec2(sigma)"
  ],
  [
    "flat fragment sampling policy",
    "flat in vec4 vTrailSampling;in vec2 vOffset,vMotion;in vec3",
    "in vec2 vOffset,vMotion;in vec3"
  ],
  [
    "normalized bounded local quadrature helper",
    "    float adaptiveSpatialKernel(float n){\n      float L=length(vMotion);vec2 axis=vMotion/L;\n      float support=.5*(abs(axis.x)+abs(axis.y))+6.*vSigma+.02;\n      if(vTrailShutter.z>1.5)support+=.38729833462*abs(dot(vTrailShutter.xy,axis));\n      float along=dot(vOffset,axis);\n      int lo=int(clamp(ceil(n*(.5+(along-support)/L)-.5),0.,n));\n      int hi=int(clamp(floor(n*(.5+(along+support)/L)-.5),-1.,n-1.));\n      float kernel=0.;\n      for(int k=0;k<128;k++){\n        int i=lo+k;if(i>hi)break;\n        vec2 q=vOffset-vMotion*((float(i)+.5)/n-.5);\n        if(vTrailShutter.z<1.5)kernel+=integratedGaussian(q,vSigma);\n        else{\n          float b=integratedGaussian(q,vSigma)*(4./9.);\n          b+=(integratedGaussian(q-vTrailShutter.xy*.38729833462,vSigma)+integratedGaussian(q+vTrailShutter.xy*.38729833462,vSigma))*(5./18.);\n          kernel+=b;\n        }\n      }\n      // Keep the COMPLETE global quadrature weight. Never renormalize the\n      // pixel-local subset; omitted6sigma tails have an explicit error bound.\n      return kernel/n;\n    }\n    void finiteAir(vec3 start,vec3 endpoint,out vec3 T,out vec3 S){",
    "    void finiteAir(vec3 start,vec3 endpoint,out vec3 T,out vec3 S){"
  ],
  [
    "tail adaptive dispatch original head and legacy loop intact",
    "        if(vTrailSampling.w>.5)kernel=meanEmission*mix(adaptiveSpatialKernel(vTrailSampling.x),adaptiveSpatialKernel(vTrailSampling.y),vTrailSampling.z);\n        else for(int i=0;i<8;i++){\n          float t=(float(i)+.5)/8.-.5,weight=",
    "        for(int i=0;i<8;i++){\n          float t=(float(i)+.5)/8.-.5,weight="
  ],
  [
    "diagnostic slot only",
    "let records=[],quality={trailSegments:10},disposed=false,lastRender={instances:0},lastTrailSampling=null,trailIntegrationRequested=trailIntegration!=='legacy8',warnings=[]",
    "let records=[],quality={trailSegments:10},disposed=false,lastRender={instances:0},warnings=[]"
  ],
  [
    "mode peeled before physics configure",
    "const nextClusterModel=patch.clusterModel===undefined?clusterModel:validateClusterModel(patch.clusterModel),nextTrailIntegration=patch.trailIntegration===undefined?trailIntegration:validateTrailIntegration(patch.trailIntegration),{clusterModel:ignoredClusterModel,trailIntegration:ignoredTrailIntegration,...physicsPatch}=patch;",
    "const nextClusterModel=patch.clusterModel===undefined?clusterModel:validateClusterModel(patch.clusterModel),{clusterModel:ignoredClusterModel,...physicsPatch}=patch;"
  ],
  [
    "configure mode only no source rebuild",
    "const state=simulation.configure(physicsPatch);if(nextTrailIntegration!==trailIntegration)lastTrailSampling=null;if(patch.trailIntegration!==undefined)trailIntegrationRequested=true;trailIntegration=nextTrailIntegration;uniforms.uTrailAdaptive.value=trailIntegration==='adaptive'?1:0;if(nextClusterModel!==clusterModel)",
    "const state=simulation.configure(physicsPatch);if(nextClusterModel!==clusterModel)"
  ],
  [
    "conditional mode return default unchanged",
    "return{...state,clusterModel,...(trailIntegration==='adaptive'?{trailIntegration}: {})};},",
    "return{...state,clusterModel};},"
  ],
  [
    "CPU fallback diagnostic estimates isolated",
    "  function estimateTrailSampling(camera,optics,width,height,shutter){\n    const c=prepareSourceProjection(camera,{...optics,width,height,shutterSeconds:shutter},3.6e-5),b=sourceBoundOutput(),stats={scope:'CPU projected estimates; GPU branch validated by independent fixtures, not runtime readback',tails:0,clipped:0,adaptive:0,legacyFallback:0,reasons:{degenerate:0,globalBudget:0,localBudget:0},maximumN:0,maximumLocalBound:0,minimumStepPixels:.5,maximumStepSigma:.5,supportSigma:6,maxLocalSamplesPerLevel:128,maxGlobalSamples:65536};\n    for(const p of records){if(p.kind==='smoke'||!(p.stretch?.some(v=>v!==0)))continue;stats.tails++;if(!writeSourceBound(p,c,b)){stats.clipped++;continue;}const L=Math.hypot(...b.stretchPixels),S=Math.hypot(...b.shutterPixels),sigma=Math.sqrt(b.baseSigma2+(S<=1?S*S/24:0));\n      if(!(L>1e-4)){stats.legacyFallback++;stats.reasons.degenerate++;continue;}\n      const ax=b.stretchPixels[0]/L,ay=b.stretchPixels[1]/L,n0=Math.floor(Math.max(7,L/(.5*Math.max(1,sigma))))+1,n1=n0+1,support=.5*(Math.abs(ax)+Math.abs(ay))+6*sigma+.02+(S>1?.38729833462*Math.abs(b.shutterPixels[0]*ax+b.shutterPixels[1]*ay):0),local=Math.min(n1,Math.ceil(2*support*n1/L)+4);\n      stats.maximumN=Math.max(stats.maximumN,n1);stats.maximumLocalBound=Math.max(stats.maximumLocalBound,local);\n      if(n1>65536){stats.legacyFallback++;stats.reasons.globalBudget++;}else if(local>128){stats.legacyFallback++;stats.reasons.localBudget++;}else stats.adaptive++;\n    }\n    return stats;\n  }\n  function fillRecords(camera,air,rawPerCandela,shutter,medium=null,legacySmoke=true,reflection=false,planeY=0){",
    "  function fillRecords(camera,air,rawPerCandela,shutter,medium=null,legacySmoke=true,reflection=false,planeY=0){"
  ],
  [
    "render candidate diagnostic only",
    "lastTrailSampling=trailIntegration==='adaptive'?estimateTrailSampling(camera,{...optics,dof:!reflection&&optics.dof},width,height,uniforms.uShutter.value):null;\n      const count=fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value,medium,legacySmoke,reflection,planeY);",
    "const count=fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value,medium,legacySmoke,reflection,planeY);"
  ],
  [
    "conditional diagnostic default identical",
    "tailIntegration:{spatialSamples:8,...(trailIntegrationRequested?{requested:trailIntegration,effective:trailIntegration==='legacy8'?'legacy8':lastTrailSampling?'adaptive-with-legacy8-budget-fallback':'awaiting-render'}:{}),...(trailIntegration==='adaptive'?{mode:trailIntegration,spatialSamples:'positive adaptive N/N+1',estimates:lastTrailSampling}:{}),shutter:",
    "tailIntegration:{spatialSamples:8,shutter:"
  ],
  [
    "candidate execution upper-bound wording",
    "kernelEvaluations:trailIntegration==='adaptive'?'upper limits256 local spatial evaluations /768 with large shutter; projected counters are CPU estimates, not actual GPU execution counts':'8 normal /24 large-shutter tail; heads unchanged'",
    "kernelEvaluations:'8 normal /24 large-shutter tail; heads unchanged'"
  ]
].map(Object.freeze));
export function normalizeAdaptiveTailSource(source,{required=false}={}){if(!required&&!source.includes('uTrailAdaptive'))return source;let result=normalizeAdaptiveTailCentreSource(normalizeAdaptiveTailEndpointSource(normalizeFWTransmissionSource(normalizeCombustionBodySamplerSource(source))));for(const [name,from,to]of adaptiveTailEdits){const count=result.split(from).length-1;if(count!==1)throw Error('Adaptive-tail inverse '+name+' count '+count);result=result.replace(from,to);}return result;}
