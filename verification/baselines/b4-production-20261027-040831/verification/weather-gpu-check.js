import {cloudShadowGLSL} from '../sky.js';

/** Bounded synchronous Float32 GPU/CPU density comparison. No time mutation. */
export function runWeatherCheck(THREE,renderer,atmosphere){
  const gl=renderer.getContext();
  if(!gl.getExtension('EXT_color_buffer_float'))return{available:false,passed:false,reason:'EXT_color_buffer_float is unavailable'};
  const u=atmosphere.uniforms,count=256,time=u.uCloudTime.value,base=u.uCloudBase.value,top=u.uCloudTop.value;
  let seed=623179;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
  const points=[];let attempts=0;
  // The field is sparse: deliberately include cloudy points, not 256 easy
  // zero values. Keep a second half for clear/boundary/random probes.
  while(points.length<128&&attempts++<12000){
    const p=[(random()-.5)*64000,base+(top-base)*(.025+random()*.80),(random()-.5)*64000];
    if(atmosphere.cloudDensityAt(p,time)>1e-5)points.push(p);
  }
  const selectedCloudyPoints=points.length;
  while(points.length<count){
    const i=points.length,altitude=i%9===0?base-2:i%9===1?top+2:base+(top-base)*random();
    points.push([(random()-.5)*64000,altitude,(random()-.5)*64000]);
  }
  const data=new Float32Array(count*4);
  points.forEach((p,i)=>{data[i*4]=p[0];data[i*4+1]=p[1];data[i*4+2]=p[2];data[i*4+3]=1;});
  const cpu=points.map((_,i)=>atmosphere.cloudDensityAt([data[i*4],data[i*4+1],data[i*4+2]],time));
  const pointTexture=new THREE.DataTexture(data,count,1,THREE.RGBAFormat,THREE.FloatType);
  pointTexture.minFilter=pointTexture.magFilter=THREE.NearestFilter;pointTexture.needsUpdate=true;
  const material=new THREE.ShaderMaterial({uniforms:{...u,uAuditPoints:{value:pointTexture}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`precision highp float;uniform highp sampler2D uAuditPoints;${cloudShadowGLSL}
      void main(){vec3 p=texelFetch(uAuditPoints,ivec2(int(gl_FragCoord.x),0),0).xyz;float d=atmosphereCloudDensity(p,uCloudTime,0.0);gl_FragColor=vec4(d,0.,0.,1.);}`});
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);scene.add(new THREE.Mesh(geometry,material));
  const target=new THREE.WebGLRenderTarget(count,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});
  const previousTarget=renderer.getRenderTarget(),cubeFace=renderer.getActiveCubeFace?.()||0,mipLevel=renderer.getActiveMipmapLevel?.()||0;
  const saved={viewport:Array.from(gl.getParameter(gl.VIEWPORT)),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),scissorTest:gl.isEnabled(gl.SCISSOR_TEST),autoClear:renderer.autoClear,xr:renderer.xr.enabled,clipping:renderer.clippingPlanes,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
  const savedTarget=previousTarget?{viewport:previousTarget.viewport.clone(),scissor:previousTarget.scissor.clone(),scissorTest:previousTarget.scissorTest}:null;
  const values=new Float32Array(count*4);let error=null;
  try{
    renderer.autoClear=false;renderer.xr.enabled=false;renderer.clippingPlanes=[];
    renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    renderer.setRenderTarget(target);renderer.render(scene,camera);
    renderer.readRenderTargetPixels(target,0,0,count,1,values);
  }catch(e){error=String(e?.message||e);}
  finally{
    // Never call setViewport with physical target pixels: that public method
    // applies DPR. Temporarily bind the saved physical target rectangle, then
    // restore its metadata after Three has restored the active GL rectangle.
    if(previousTarget){previousTarget.viewport.fromArray(saved.viewport);previousTarget.scissor.fromArray(saved.scissor);previousTarget.scissorTest=saved.scissorTest;}
    renderer.setRenderTarget(previousTarget,cubeFace,mipLevel);
    if(previousTarget){previousTarget.viewport.copy(savedTarget.viewport);previousTarget.scissor.copy(savedTarget.scissor);previousTarget.scissorTest=savedTarget.scissorTest;}
    renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.clippingPlanes=saved.clipping;
    renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
    target.dispose();geometry.dispose();material.dispose();pointTexture.dispose();
  }
  const restored={target:renderer.getRenderTarget()===previousTarget,cubeFace:(renderer.getActiveCubeFace?.()||0)===cubeFace,mipLevel:(renderer.getActiveMipmapLevel?.()||0)===mipLevel,
    viewport:JSON.stringify(Array.from(gl.getParameter(gl.VIEWPORT)))===JSON.stringify(saved.viewport),scissor:JSON.stringify(Array.from(gl.getParameter(gl.SCISSOR_BOX)))===JSON.stringify(saved.scissor),scissorTest:gl.isEnabled(gl.SCISSOR_TEST)===saved.scissorTest,
    autoClear:renderer.autoClear===saved.autoClear,xr:renderer.xr.enabled===saved.xr,clipping:renderer.clippingPlanes===saved.clipping,shadowAuto:renderer.shadowMap.autoUpdate===saved.shadowAuto,shadowNeeds:renderer.shadowMap.needsUpdate===saved.shadowNeeds};
  let maxAbsoluteError=0,squaredError=0,nonFinite=0,cpuPositive=0,gpuPositive=0,worst=null;
  for(let i=0;i<count;i++){
    const gpu=values[i*4],reference=cpu[i],difference=Math.abs(gpu-reference);
    if(!Number.isFinite(gpu)||!Number.isFinite(reference)){nonFinite++;continue;}
    cpuPositive+=reference>1e-5;gpuPositive+=gpu>1e-5;squaredError+=difference*difference;
    if(difference>maxAbsoluteError){maxAbsoluteError=difference;worst={index:i,position:Array.from(data.subarray(i*4,i*4+3)),cpu:reference,gpu};}
  }
  const report={available:true,passed:!error&&nonFinite===0&&maxAbsoluteError<.02&&Object.values(restored).every(Boolean),sampleCount:count,timeSeconds:time,selectedCloudyPoints,cpuPositive,gpuPositive,maxAbsoluteError,rmsAbsoluteError:Math.sqrt(squaredError/count),nonFinite,worst,restored,error,
    tolerance:.02,note:'Exact shared base-LOD density and actual uploaded Float32 points. Absolute tolerance allows spherical-altitude highp precision and texture filtering; full view rays intentionally use distance-filtered LOD. This is not a cloud appearance/performance acceptance.'};
  return report;
}
