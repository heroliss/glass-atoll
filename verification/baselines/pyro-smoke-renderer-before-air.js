// Isolated StageA renderer. No app/event wiring, clean-air correction or light-
// to-smoke extinction. Neutral extinction only; scattering is a disclosed
// conditional-mean/centre-order approximation, not a joint volume solver.
export const smokeGaussianColumnGLSL=/* glsl */`
  vec3 smokeWhiten(vec3 q,vec4 c0,vec2 c1){
    float x=q.x/c0.x,y=(q.y-c0.y*x)/c0.z;
    return vec3(x,y,(q.z-c0.w*x-c1.x*y)/c1.y);
  }
  float smokeErfc(float x){float t=1./(1.+.3275911*x);return (((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x);}
  float smokeErfDifference(float a,float b){
    if(a==b)return 0.;float width=b-a;
    if(width<1e-3/(1.+max(abs(a),abs(b)))){float h=width*.5,m=a+h,q=h*.5773502691896258;return 1.1283791670955126*h*(exp(-(m-q)*(m-q))+exp(-(m+q)*(m+q)));}
    if(a>=0.)return smokeErfc(a)-smokeErfc(b);
    if(b<=0.)return smokeErfc(-b)-smokeErfc(-a);
    return (1.-smokeErfc(-a))+(1.-smokeErfc(b));
  }
  // Mean is a physical ray distance after clipping, never a virtual kernel mean.
  vec3 smokeColumn(vec3 mean,vec4 c0,vec2 c1,float normalization,
                   vec3 direction,float start,float end){
    if(end<=start)return vec3(0.,start,0.);
    vec3 q=smokeWhiten(direction*start-mean,c0,c1),v=smokeWhiten(direction,c0,c1);
    float A=dot(v,v),b=dot(q,v)/A,extent=end-start,root=sqrt(A*.5);
    vec3 perpendicular=q-v*b;
    float e0=exp(-.5*A*b*b),e1=exp(-.5*A*(extent+b)*(extent+b));
    float integral=sqrt(1.5707963267948966/A)*smokeErfDifference(root*b,root*(extent+b));
    float tau=normalization*exp(-.5*dot(perpendicular,perpendicular))*integral;
    float conditional=clamp(-b,0.,extent),fallback=1.;
    if(integral>1e-10){float candidate=-b+(e0-e1)/(A*integral);if(candidate>=-1e-3&&candidate<=extent+1e-3){conditional=clamp(candidate,0.,extent);fallback=0.;}}
    return vec3(tau,start+conditional,fallback);
  }
`;

const PI=Math.PI,GAUSS3=(2*PI)**1.5;
const finite=(v,name)=>{if(!Number.isFinite(v))throw new RangeError(name+' must be finite');return v;};
const vector=(v,name)=>{const a=v?.toArray?v.toArray():v;if(!a||a.length!==3)throw new TypeError(name+' requires3 components');return Array.from(a,(x,i)=>finite(x,name+'['+i+']'));};
const nonnegative=(v,name)=>{const a=vector(v,name);if(a.some(x=>x<0))throw new RangeError(name+' must be nonnegative');return a;};
const f32=(v,name)=>{if(!Number.isFinite(Math.fround(v)))throw new RangeError(name+' exceeds finiteFloat32 range');return v;};
function cholesky(value){
  if(!value||value.length!==9)throw new TypeError('Packet covariance requires row-major3x3');const c=Array.from(value,(v,i)=>finite(v,'covariance['+i+']')),s=Math.max(c[0],c[4],c[8]);
  for(const [a,b]of [[1,3],[2,6],[5,7]])if(Math.abs(c[a]-c[b])>64*Number.EPSILON*s)throw new RangeError('Packet covariance must be symmetric');
  const L=Array(9).fill(0);for(let i=0;i<3;i++)for(let j=0;j<=i;j++){let x=c[i*3+j];for(let k=0;k<j;k++)x-=L[i*3+k]*L[j*3+k];if(i===j){if(!(x>0))throw new RangeError('Packet covariance must be SPD');L[i*3+j]=Math.sqrt(x);}else L[i*3+j]=x/L[j*3+j];}
  const det=L[0]*L[4]*L[8],inverse=[];
  for(let column=0;column<3;column++){const b=[0,0,0];b[column]=1;const y=[b[0]/L[0],0,0];y[1]=(b[1]-L[3]*y[0])/L[4];y[2]=(b[2]-L[6]*y[0]-L[7]*y[1])/L[8];const x=[0,0,y[2]/L[8]];x[1]=(y[1]-L[7]*x[2])/L[4];x[0]=(y[0]-L[3]*x[1]-L[6]*x[2])/L[0];for(let row=0;row<3;row++)inverse[row*3+column]=x[row];}
  return {L,det,trace:c[0]+c[4]+c[8],inverseFrobenius:Math.hypot(...inverse)};
}

/** Caller owns renderer, target, immutable snapshot and detached depth texture.
 * Lighting is RAW, pre-storage exposure: ambientRGB/4pi + HG*incidentRGB.
 * A single sceneScale is applied to lighting uniforms; no camera C is read.
 */
export function createPyroSmokeRenderer(THREE,renderer,{maxPackets=4096,supportSigma=5,anisotropy=.32}={}){
  if(!Number.isInteger(maxPackets)||maxPackets<1||maxPackets>65536)throw new RangeError('maxPackets requires1..65536');
  if(!Number.isFinite(supportSigma)||supportSigma<4||supportSigma>5)throw new RangeError('supportSigma requires4..5');
  if(!Number.isFinite(anisotropy)||Math.abs(anisotropy)>.9)throw new RangeError('anisotropy requires-.9...9');
  const geometry=new THREE.InstancedBufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
  const arrays={rect:new Float32Array(maxPackets*4),mean:new Float32Array(maxPackets*3),chol0:new Float32Array(maxPackets*4),chol1:new Float32Array(maxPackets*2),optics:new Float32Array(maxPackets*4)};
  for(const [name,size]of [['rect',4],['mean',3],['chol0',4],['chol1',2],['optics',4]])geometry.setAttribute('a'+name[0].toUpperCase()+name.slice(1),new THREE.InstancedBufferAttribute(arrays[name],size).setUsage(THREE.DynamicDrawUsage));geometry.instanceCount=0;
  const dummy=new THREE.DataTexture(new Float32Array([1]),1,1,THREE.RedFormat,THREE.FloatType);dummy.needsUpdate=true;dummy.minFilter=dummy.magFilter=THREE.NearestFilter;dummy.generateMipmaps=false;
  const uniforms={uOpaqueDepth:{value:dummy},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uEye:{value:new THREE.Vector3()},uSize:{value:new THREE.Vector2(1,1)},uNearFar:{value:new THREE.Vector2(.1,30000)},uReflection:{value:0},uPlaneY:{value:0},uDebugMode:{value:0},uG:{value:anisotropy},uAmbient:{value:new THREE.Vector3()},uDirectionalRGB:{value:new THREE.Vector3()},uDirectionalDirection:{value:new THREE.Vector3(0,1,0)},uClusterPosition:{value:[new THREE.Vector3(),new THREE.Vector3()]},uClusterRGB:{value:[new THREE.Vector3(),new THREE.Vector3()]},uClusterRadius:{value:new Float32Array([1,1])},uVignette:{value:0},uSensorHeight:{value:24},uFocal:{value:28}};
  const vertex=/* glsl */`precision highp float;in vec3 position,aMean;in vec4 aRect,aChol0,aOptics;in vec2 aChol1;
    flat out vec3 vMean;flat out vec4 vChol0,vOptics;flat out vec2 vChol1;
    void main(){vec2 uv=position.xy*.5+.5;gl_Position=vec4(mix(aRect.xy,aRect.zw,uv),0.,1.);vMean=aMean;vChol0=aChol0;vChol1=aChol1;vOptics=aOptics;}`;
  const fragment=/* glsl */`precision highp float;precision highp int;
    uniform highp sampler2D uOpaqueDepth;uniform mat4 uInverseProjection,uCameraWorld;uniform vec3 uEye,uAmbient,uDirectionalRGB,uDirectionalDirection,uClusterPosition[2],uClusterRGB[2];uniform vec2 uSize,uNearFar;uniform float uReflection,uPlaneY,uDebugMode,uG,uClusterRadius[2],uVignette,uSensorHeight,uFocal;
    flat in vec3 vMean;flat in vec4 vChol0,vOptics;flat in vec2 vChol1;out vec4 outColour;
    ${smokeGaussianColumnGLSL}
    float phaseHG(float mu){float g=uG,den=1.+g*g-2.*g*mu;return(1.-g*g)/(12.566370614359172*den*sqrt(den));}
    void main(){
      vec2 uv=gl_FragCoord.xy/uSize,ndc=uv*2.-1.;vec4 h=uInverseProjection*vec4(ndc,1.,1.);
      vec3 viewDirection=normalize(h.xyz);if(viewDirection.z>0.)viewDirection=-viewDirection;
      vec3 direction=normalize(mat3(uCameraWorld)*viewDirection);
      float start=0.,end=uNearFar.y/max(-viewDirection.z,1e-6),depth=textureLod(uOpaqueDepth,uv,0.).r;
      if(depth<.9999999){vec4 p=uInverseProjection*vec4(ndc,depth*2.-1.,1.);vec3 endpoint=mat3(uCameraWorld)*(p.xyz/p.w);end=min(end,dot(endpoint,direction));}
      if(uReflection>.5){if(direction.y<=0.)discard;start=max(0.,(uPlaneY-uEye.y)/direction.y);}
      if(end<=start)discard;
      vec3 column=smokeColumn(vMean,vChol0,vChol1,vOptics.x,direction,start,end);float tau=column.x;
      if(uDebugMode>.5){outColour=vec4(tau,column.y,column.z,1.);return;}
      if(tau<=0.)discard;
      float opacity=tau<1e-3?tau*(1.-tau*.5+tau*tau/6.):1.-exp(-tau);
      vec3 point=direction*column.y,source=uAmbient/12.566370614359172+uDirectionalRGB*phaseHG(clamp(dot(direction,uDirectionalDirection),-1.,1.));
      for(int i=0;i<2;i++){vec3 delta=uClusterPosition[i]-point;float distance2=dot(delta,delta),phase=distance2>1e-12?phaseHG(clamp(dot(direction,delta*inversesqrt(distance2)),-1.,1.)):0.07957747154594767;source+=uClusterRGB[i]*phase/max(distance2,uClusterRadius[i]*uClusterRadius[i]);}
      vec3 rgb=vOptics.yzw*source*opacity;
      vec2 sensor=(uv-.5)*vec2(uSensorHeight*uSize.x/uSize.y,uSensorHeight);float cos4=pow(inversesqrt(1.+dot(sensor,sensor)/(uFocal*uFocal)),4.);rgb*=mix(1.,mix(1.,cos4,.30),uVignette);
      outColour=vec4(rgb,opacity);
    }`;
  const material=new THREE.RawShaderMaterial({name:'StageA finite Gaussian smoke / neutral premult',glslVersion:THREE.GLSL3,uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;const scene=new THREE.Scene();scene.add(mesh);
  let records=[],lastRender=null,disposed=false,stateRevision=null;
  const pView=new THREE.Vector3(),pClip=new THREE.Vector4(),eye=new THREE.Vector3(),minRect=new THREE.Vector2(),maxRect=new THREE.Vector2();
  function parseLighting(lighting={}){
    const ambient=nonnegative(lighting.ambientRGB??[0,0,0],'raw ambientRGB'),directional=nonnegative(lighting.rawDirectionalRGB??[0,0,0],'rawDirectionalRGB'),direction=vector(lighting.directionalDirection??[0,1,0],'directionalDirection'),size=Math.hypot(...direction),rawPerCandela=finite(lighting.rawPerCandela??3.6e-5,'rawPerCandela');if(!(size>0)||rawPerCandela<0)throw new RangeError('Unit light direction and nonnegative source scale required');
    const clusters=(lighting.clusters??[]).map(l=>{const position=vector(l.position,'cluster.position'),color=nonnegative(l.color??l.colour,'cluster raw color'),I=finite(l.referenceCandela,'referenceCandela'),radius=finite(l.radius,'cluster.radius');if(I<0||!(radius>0))throw new RangeError('Cluster requires nonnegative sourceI and positive radius');return{position,color,intensity:I*rawPerCandela,radius};});if(clusters.length>2)throw new RangeError('StageA accepts at most2 raw clusters');return{ambient,directional,direction:direction.map(v=>v/size),clusters};
  }
  const api={
    setState(snapshot){if(disposed)throw new Error('Smoke renderer is disposed');if(!snapshot||!Array.isArray(snapshot.packets)||snapshot.packets.length>maxPackets)throw new RangeError('snapshot packet capacity invalid');const profiles=new Map((snapshot.profiles??[]).map(p=>[p.id,p]));
      const parsed=snapshot.packets.map(p=>{const profile=profiles.get(p.profileId);if(!profile)throw new RangeError('Missing packet optical profile');const k=nonnegative(profile.extinctionPerMassRGB,'extinction profile'),scale=Math.max(...k);if(Math.max(...k)-Math.min(...k)>1e-10*scale)throw new RangeError('StageA requires neutral extinction; RGB transmission cannot use one premult alpha');const ssa=nonnegative(profile.singleScatteringAlbedoRGB??[.9,.9,.9],'SSA');if(ssa.some(v=>v>1))throw new RangeError('SSA must be<=1');const mass=finite(p.mass,'relative mass');if(!(mass>0))throw new RangeError('Relative mass must be positive');const mean=vector(p.mean,'packet.mean'),shape=cholesky(p.covariance),normalization=mass*k[0]/(GAUSS3*shape.det),columnBound=mass*k[0]*shape.inverseFrobenius/(2*PI);for(const x of [...shape.L,normalization])f32(x,'GPU Gaussian field');if(k[0]>0&&(!(Math.fround(normalization)>0)||columnBound>1e30))throw new RangeError('Reference optical fields exceed StageA GPU numeric domain');return{id:p.id,mean,shape,ssa,normalization,columnBound,radius:supportSigma*Math.sqrt(shape.trace)};});
      records=parsed;stateRevision=snapshot.revision??null;return{packets:records.length,stateRevision};},
    getRadianceBound(lighting={}){const light=parseLighting(lighting),phaseMax=(1+Math.abs(anisotropy))/(4*PI*(1-Math.abs(anisotropy))**2);let ssaMax=0;for(const p of records)ssaMax=Math.max(ssaMax,...p.ssa);let maximum=Math.max(...light.ambient)/(4*PI)+Math.max(...light.directional)*phaseMax;for(const l of light.clusters)maximum+=Math.max(...l.color)*l.intensity/(l.radius*l.radius)*phaseMax;return{maxRGB:maximum*ssaMax,rawBeforeStorageExposure:true,method:'non-emissive convex-over source-function upper bound; current unoccluded raw sources; no factor per historical packet',limits:'authored raw incident reference, neutral extinction and at most2 clusters; not a bound for future joint-media/light transport'};},
    render({target,camera,opaqueDepth=null,allowUnoccluded=false,reflection=false,planeY=0,frame={},lighting={},optics={},debugMode=0}={}){
      if(disposed)throw new Error('Smoke renderer is disposed');if(!target||!camera?.isPerspectiveCamera)throw new TypeError('Target and perspective camera required');if(opaqueDepth&&(opaqueDepth===target.depthTexture||opaqueDepth===target.texture||target.textures?.includes(opaqueDepth)))throw new Error('Opaque depth must be detached from the drawing target; attached feedback is forbidden');if(!opaqueDepth&&!allowUnoccluded)throw new Error('Resolved independent opaqueDepth required (allowUnoccluded is isolated QA only)');
      const P=finite(frame.storageEV??0,'storageEV'),scale=finite(frame.sceneScale??2**P,'sceneScale');if(!(scale>0)||('storageEV'in frame&&'sceneScale'in frame&&Math.abs(scale/2**P-1)>1e-8))throw new RangeError('sceneScale must equal2^storageEV');const light=parseLighting(lighting),w=target.width,h=target.height;if(!(w>0&&h>0))throw new RangeError('Positive target size required');finite(planeY,'planeY');
      camera.updateMatrixWorld();eye.setFromMatrixPosition(camera.matrixWorld);const E=eye.toArray(),ordered=records.filter(p=>p.normalization>0).map(p=>({p,z:pView.fromArray(p.mean).applyMatrix4(camera.matrixWorldInverse).z})).sort((a,b)=>a.z-b.z||(a.p.id??0)-(b.p.id??0));let count=0,fullScreen=0,culled=0,bound=0;
      for(const {p}of ordered){bound+=p.columnBound*Math.exp(-.5*supportSigma*supportSigma);pView.fromArray(p.mean).applyMatrix4(camera.matrixWorldInverse);if(-pView.z+p.radius<=0){culled++;continue;}let full=-pView.z<=p.radius;minRect.set(Infinity,Infinity);maxRect.set(-Infinity,-Infinity);
        if(!full){for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){pClip.set(pView.x+x*p.radius,pView.y+y*p.radius,pView.z+z*p.radius,1).applyMatrix4(camera.projectionMatrix);if(pClip.w<=1e-8){full=true;continue;}minRect.x=Math.min(minRect.x,pClip.x/pClip.w);minRect.y=Math.min(minRect.y,pClip.y/pClip.w);maxRect.x=Math.max(maxRect.x,pClip.x/pClip.w);maxRect.y=Math.max(maxRect.y,pClip.y/pClip.w);}}
        if(full){minRect.set(-1,-1);maxRect.set(1,1);fullScreen++;}else if(minRect.x>1||minRect.y>1||maxRect.x< -1||maxRect.y< -1){culled++;continue;}
        arrays.rect.set([Math.max(-1,minRect.x),Math.max(-1,minRect.y),Math.min(1,maxRect.x),Math.min(1,maxRect.y)],count*4);arrays.mean.set(p.mean.map((v,i)=>f32(v-E[i],'camera-relative centre')),count*3);const L=p.shape.L;arrays.chol0.set([L[0],L[3],L[4],L[6]],count*4);arrays.chol1.set([L[7],L[8]],count*2);arrays.optics.set([p.normalization,...p.ssa],count*4);count++;
      }
      geometry.instanceCount=count;for(const name of Object.keys(arrays))geometry.getAttribute('a'+name[0].toUpperCase()+name.slice(1)).needsUpdate=true;
      uniforms.uOpaqueDepth.value=opaqueDepth??dummy;uniforms.uInverseProjection.value.copy(camera.projectionMatrix).invert();uniforms.uCameraWorld.value.copy(camera.matrixWorld);uniforms.uEye.value.copy(eye);uniforms.uSize.value.set(w,h);uniforms.uNearFar.value.set(camera.near,camera.far);uniforms.uReflection.value=reflection?1:0;uniforms.uPlaneY.value=planeY;uniforms.uDebugMode.value=debugMode;uniforms.uAmbient.value.fromArray(light.ambient.map(v=>f32(v*scale,'stored ambient')));uniforms.uDirectionalRGB.value.fromArray(light.directional.map(v=>f32(v*scale,'stored directional')));uniforms.uDirectionalDirection.value.fromArray(light.direction);
      for(let i=0;i<2;i++){const l=light.clusters[i];uniforms.uClusterPosition.value[i].fromArray(l?l.position.map((v,c)=>f32(v-E[c],'relative cluster position')):[0,0,0]);uniforms.uClusterRGB.value[i].fromArray(l?l.color.map(v=>f32(v*l.intensity*scale,'stored cluster')):[0,0,0]);uniforms.uClusterRadius.value[i]=l?l.radius:1;}
      uniforms.uVignette.value=!reflection&&optics.vignette?1:0;uniforms.uSensorHeight.value=optics.sensorHeightMm??24;uniforms.uFocal.value=optics.focalMm??28;material.blending=debugMode?THREE.NoBlending:THREE.CustomBlending;
      const previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()).clone(),scissor:renderer.getScissor(new THREE.Vector4()).clone(),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,shadowAuto:renderer.shadowMap.autoUpdate,shadowDirty:renderer.shadowMap.needsUpdate};
      try{renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(target);renderer.setViewport(0,0,w,h);renderer.setScissorTest(false);renderer.render(scene,camera);}finally{renderer.autoClear=previous.autoClear;renderer.shadowMap.autoUpdate=previous.shadowAuto;renderer.shadowMap.needsUpdate=previous.shadowDirty;renderer.setRenderTarget(previous.target,previous.face,previous.mip);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);}
      lastRender={packets:records.length,instances:count,culled,fullScreenFallbacks:fullScreen,reflection,width:w,height:h,storageEV:Math.log2(scale),supportSigma,offProxyOpticalDepthUpperBound:bound,debugMode,stateRevision,extraOffscreenTargets:0};return{...lastRender};
    },
    diagnostics(){return{version:'pyro-smoke-renderer-stageA-v1',lastRender:lastRender?{...lastRender}:null,maxPackets,packets:records.length,supportSigma,anisotropy,neutralExtinctionOnly:true,limits:['no app/event/source integration','true finite Gaussian columns withFloat32/erf and finite proxy-tail error; no unbiased-renderer claim','back-to-front latent-centre order; S at optical conditional mean, overlapping/source-varying scattering is approximate','no clean-air/front correction, smoke self-shadow, light-to-smoke attenuation, cloud/tree visibility or multiple scattering','opaque depth must be independently resolved; no centre-depth discard','whole-space Gaussian matches state; no ground-fold/deposition model implicitly applied','no density/P/C coupling; P applied once to incident-light uniforms, no camera exposure read','proxy culling affects rendering only; physical state mass is never deleted','far/subpixel footprint filtering and volumeDOF are not solved; per-source PSF remains caller-owned']};},
    dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();dummy.dispose();records=[];}
  };return api;
}
