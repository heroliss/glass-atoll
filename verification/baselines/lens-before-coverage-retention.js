import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createSpatialUpscaler } from './upscaler.js';

// Full-frame focal geometry. Exposure compensation is relative to the scene's
// calibrated exposure, not a claim of absolute photographic lux/ISO calibration.
export function circleOfConfusion({focalMm,aperture,focusMetres,distanceMetres,sensorHeightMm,pixels}) {
  const focus=Math.max(focalMm+1,focusMetres*1000),distance=Math.max(focalMm+1,distanceMetres*1000);
  const diameter=Math.abs(focalMm*focalMm*(distance-focus)/(aperture*distance*(focus-focalMm)));
  return diameter/sensorHeightMm*pixels;
}

// An eight-position pixel footprint, applied only to vegetation clip positions.
// The camera projection/FOV and all water/reflection cameras remain unchanged.
export function temporalJitterSample(index) {
  const radical=(n,base)=>{let value=0,fraction=1/base;while(n>0){value+=(n%base)*fraction;n=Math.floor(n/base);fraction/=base;}return value;};
  const n=((index%8)+8)%8+1;
  // Centre the finite cycle itself, rather than the infinite Halton sequence.
  // This prevents a small permanent silhouette offset after accumulation.
  return [radical(n,2)-.4453125,radical(n,3)-.5];
}

// Original, selective temporal reconstruction. Primary algorithm references:
// https://github.com/playdeadgames/temporal (history validation / clipping)
// https://research.nvidia.com/labs/rtr/publication/yang2020survey/
// This is camera-depth reprojection, not object-motion-vector TAA or TAAU.
export const selectiveTemporalGLSL=/* glsl */`
  uniform sampler2D tCurrent,tCurrentDepth,tHistory;
  uniform vec2 uSize;
  uniform mat4 uInverseCurrentVP,uPreviousVP,uPreviousView;
  uniform float uNear,uFar,uHistoryValid,uHistoryWeight,uWind,uMotionDelta,uProjectionScale;
  varying vec2 vUv;
  float coverage(vec4 colour){return clamp((1.-colour.a)/.75,0.,1.);}
  float linearDepth(float depth){return uNear*uFar/(uFar-(uFar-uNear)*depth);}
  vec3 toYCoCg(vec3 c){return vec3(dot(c,vec3(.25,.5,.25)),(c.r-c.b)*.5,(-c.r+2.*c.g-c.b)*.25);}
  vec3 fromYCoCg(vec3 c){return vec3(c.x+c.y-c.z,c.x+c.z,c.x-c.y-c.z);}
  void main(){
    vec2 pixel=1./uSize;
    vec4 current=texture2D(tCurrent,vUv);
    float mask=coverage(current);
    mask=max(mask,coverage(texture2D(tCurrent,vUv+vec2(pixel.x,0))));
    mask=max(mask,coverage(texture2D(tCurrent,vUv-vec2(pixel.x,0))));
    mask=max(mask,coverage(texture2D(tCurrent,vUv+vec2(0,pixel.y))));
    mask=max(mask,coverage(texture2D(tCurrent,vUv-vec2(0,pixel.y))));
    // Opaque water, sky, sand and their reflections pass through untouched.
    if(mask<.012){gl_FragColor=vec4(current.rgb,0.);return;}
    vec3 lo=vec3(1e20),hi=vec3(-1e20),mean=vec3(0),moment=vec3(0);
    float taggedDepth=1.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
      vec2 uv=clamp(vUv+vec2(float(x),float(y))*pixel,pixel*.5,1.-pixel*.5);
      vec4 sampleColour=texture2D(tCurrent,uv);
      vec3 c=toYCoCg(sampleColour.rgb);
      lo=min(lo,c);hi=max(hi,c);mean+=c;moment+=c*c;
      if(coverage(sampleColour)>.012)taggedDepth=min(taggedDepth,texture2D(tCurrentDepth,uv).r);
    }
    float depth=linearDepth(taggedDepth);
    if(uHistoryValid<.5){gl_FragColor=vec4(current.rgb,depth);return;}
    // Depth dilation uses only tagged vegetation samples. MSAA depth resolve
    // may select a background sample on a thin silhouette; the neighbouring
    // foreground depth supplies a conservative camera reprojection anchor.
    vec4 world=uInverseCurrentVP*vec4(vUv*2.-1.,taggedDepth*2.-1.,1.);
    world/=max(1e-8,world.w);
    vec4 previousClip=uPreviousVP*world;
    vec2 previousUV=previousClip.xy/max(previousClip.w,1e-8)*.5+.5;
    if(previousClip.w<=0.||any(lessThan(previousUV,pixel*.5))||any(greaterThan(previousUV,1.-pixel*.5))){gl_FragColor=vec4(current.rgb,depth);return;}
    vec4 history=texture2D(tHistory,previousUV);
    float expectedDepth=-(uPreviousView*world).z;
    float tolerance=max(.10,expectedDepth*.015);
    if(history.a<=0.||abs(history.a-expectedDepth)>tolerance){gl_FragColor=vec4(current.rgb,depth);return;}
    mean/=9.;moment/=9.;
    vec3 sigma=sqrt(max(moment-mean*mean,vec3(0)));
    lo=max(lo,mean-sigma*1.35);hi=min(hi,mean+sigma*1.35);
    vec3 historyY=toYCoCg(history.rgb);
    vec3 boxCenter=(lo+hi)*.5,boxExtent=max((hi-lo)*.5,vec3(1e-5));
    vec3 offset=historyY-boxCenter;
    vec3 ratios=abs(offset)/boxExtent;
    vec3 clipped=boxCenter+offset/max(1.,max(ratios.x,max(ratios.y,ratios.z)));
    float rectification=length(historyY-clipped)/(length(historyY)+length(clipped)+.05);
    float cameraMotion=length((previousUV-vUv)*uSize);
    float worldSpeed=.10+.20*uWind+.03*uWind*uWind;
    float windPixels=worldSpeed*uMotionDelta*uProjectionScale/max(depth,.3);
    float weight=uHistoryWeight*exp(-rectification*8.)*exp(-cameraMotion*.055)*exp(-windPixels*windPixels*4.);
    weight*=1.-smoothstep(18.,42.,cameraMotion);
    vec3 result=mix(current.rgb,fromYCoCg(clipped),clamp(weight,0.,.9));
    gl_FragColor=vec4(result,depth);
  }
`;

export function createLens(renderer,camera) {
  const maxSamples=renderer.getContext().getParameter(renderer.getContext().MAX_SAMPLES);
  const sceneTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(4,maxSamples),depthBuffer:true});
  sceneTarget.texture.name='Linear HDR scene, physical depth and MSAA';
  sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const lensTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const antialiasTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const encodedTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.UnsignedByteType,depthBuffer:false,colorSpace:THREE.NoColorSpace});
  const upscaler=createSpatialUpscaler(THREE,renderer,{sharpnessStops:1});
  let upscalerReady=false;
  const ready=upscaler.ready.then(value=>{upscalerReady=value;return value;});
  const smaa=new SMAAPass(),output=new OutputPass();output.renderToScreen=true;
  const temporalTargets=[0,1].map(i=>{
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    target.texture.name='Selective vegetation HDR history '+i;return target;
  });
  const temporalUniforms={tCurrent:{value:sceneTarget.texture},tCurrentDepth:{value:sceneTarget.depthTexture},tHistory:{value:temporalTargets[1].texture},
    uSize:{value:new THREE.Vector2(1,1)},uInverseCurrentVP:{value:new THREE.Matrix4()},uPreviousVP:{value:new THREE.Matrix4()},uPreviousView:{value:new THREE.Matrix4()},
    uNear:{value:camera.near},uFar:{value:camera.far},uHistoryValid:{value:0},uHistoryWeight:{value:.84},uWind:{value:0},uMotionDelta:{value:0},uProjectionScale:{value:1}};
  const temporalMaterial=new THREE.ShaderMaterial({name:'Selective vegetation camera reprojection and variance clipping',uniforms:temporalUniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:selectiveTemporalGLSL});
  const temporalQuad=new FullScreenQuad(temporalMaterial),currentVP=new THREE.Matrix4(),lastPosition=new THREE.Vector3(),lastQuaternion=new THREE.Quaternion();
  let useTemporal=true,historyValid=false,historyFrames=0,historyIndex=0,jitterIndex=0,lastAnimationTime=null,lastResetReason='initial',lastSettings=null,temporalScene=null,temporalGroups=[];
  let lastJitter=[0,0];
  function resetTemporalHistory(reason='explicit'){historyValid=false;historyFrames=0;historyIndex=0;jitterIndex=0;lastAnimationTime=null;lastResetReason=reason;}
  function findTemporalGroups(scene){
    if(temporalScene!==scene||temporalGroups.length===0){temporalGroups=[];scene.traverse(object=>{if(object.userData?.temporalAA?.jitter)temporalGroups.push(object.userData.temporalAA);});temporalScene=scene;}
    return temporalGroups;
  }
  const uniforms={
    tScene:{value:sceneTarget.texture},tDepth:{value:sceneTarget.depthTexture},
    uResolution:{value:new THREE.Vector2(1,1)},uNear:{value:camera.near},uFar:{value:camera.far},
    uFocal:{value:28},uAperture:{value:8},uFocus:{value:80},uSensorHeight:{value:24},
    uDof:{value:0},uVignette:{value:1}
  };
  const material=new THREE.ShaderMaterial({name:'Thin lens and restrained optical falloff',uniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:/* glsl */`
      uniform sampler2D tScene,tDepth;
      uniform vec2 uResolution;
      uniform float uNear,uFar,uFocal,uAperture,uFocus,uSensorHeight,uDof,uVignette;
      varying vec2 vUv;
      float viewDistance(vec2 uv){float z=texture2D(tDepth,uv).x;return uNear*uFar/(uFar-(uFar-uNear)*z);}
      float cocPixels(float distance){
        float f=uFocal,focus=max(f+1.,uFocus*1000.),s=max(f+1.,distance*1000.);
        return abs(f*f*(s-focus)/(uAperture*s*(focus-f)))/uSensorHeight*uResolution.y;
      }
      void main(){
        float depth=viewDistance(vUv);
        vec3 colour=texture2D(tScene,vUv).rgb;
        float radius=min(9.,cocPixels(depth)*.5)*uDof;
        if(radius>.42){
          vec3 sum=colour;float weight=1.;
          for(int i=0;i<12;i++){
            float fi=float(i)+.5,angle=fi*2.39996323;
            vec2 offset=vec2(cos(angle),sin(angle))*sqrt(fi/12.)*radius/uResolution;
            vec2 q=clamp(vUv+offset,vec2(.00001),vec2(.99999));
            float otherDepth=viewDistance(q),otherCoc=cocPixels(otherDepth)*.5;
            // Foreground/background rejection reduces bright silhouette bleeding.
            float valid=1.-smoothstep(max(.12,depth*.015),max(.4,depth*.07),abs(otherDepth-depth));
            valid=max(valid,step(length(offset*uResolution),otherCoc)*.14);
            sum+=texture2D(tScene,q).rgb*valid;weight+=valid;
          }
          colour=sum/weight;
        }
        vec2 sensor=(vUv-.5)*vec2(uSensorHeight*uResolution.x/uResolution.y,uSensorHeight);
        float cos4=pow(inversesqrt(1.+dot(sensor,sensor)/(uFocal*uFocal)),4.);
        // Real corrected lenses have less falloff than an uncorrected cos^4 lens.
        colour*=mix(1.,mix(1.,cos4,.30),uVignette);
        gl_FragColor=vec4(colour,1.);
      }`
  });
  const quad=new FullScreenQuad(material);
  let useSmaa=true,quality='high',width=1,height=1,outputWidth=1,outputHeight=1,sceneStats={triangles:0,calls:0};
  function setSamples(){const wanted=Math.min(quality==='high'?4:2,maxSamples);if(sceneTarget.samples!==wanted){sceneTarget.samples=wanted;sceneTarget.dispose();}}
  return {
    ready,
    setSize(w,h,outW=w,outH=h){width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));outputWidth=Math.round(outW);outputHeight=Math.round(outH);for(const target of [sceneTarget,lensTarget,antialiasTarget,encodedTarget,...temporalTargets])target.setSize(width,height);smaa.setSize(width,height);uniforms.uResolution.value.set(width,height);temporalUniforms.uSize.value.set(width,height);upscaler.setSize(width,height,outputWidth,outputHeight);resetTemporalHistory('resize');},
    configure({focal=28,aperture=8,exposure=0,dof=false,vignette=true,antialias='smaa',quality:requestedQuality='high',temporal=true,temporalWeight=.84}={}){
      uniforms.uFocal.value=focal;uniforms.uAperture.value=aperture;uniforms.uDof.value=dof?1:0;uniforms.uVignette.value=vignette?1:0;
      useSmaa=antialias==='smaa';quality=requestedQuality;setSamples();useTemporal=Boolean(temporal);
      temporalUniforms.uHistoryWeight.value=THREE.MathUtils.clamp(temporalWeight,0,.9);
      const settings=JSON.stringify([focal,aperture,exposure,dof,vignette,antialias,requestedQuality,useTemporal,temporalUniforms.uHistoryWeight.value]);
      if(settings!==lastSettings){resetTemporalHistory('settings');lastSettings=settings;}
    },
    resetTemporalHistory,
    render(scene,focusDistance){
      uniforms.uNear.value=camera.near;uniforms.uFar.value=camera.far;
      uniforms.uFocus.value=Math.max(.3,focusDistance);uniforms.uSensorHeight.value=camera.getFilmHeight();
      const groups=findTemporalGroups(scene),active=useTemporal&&groups.length>0;
      const animationTime=groups.length?Math.max(...groups.map(g=>g.time.value)):0;
      const motionDelta=lastAnimationTime===null?0:animationTime-lastAnimationTime;
      if(historyValid&&(camera.position.distanceTo(lastPosition)>Math.max(2,focusDistance*.12)||camera.quaternion.angleTo(lastQuaternion)>.20||motionDelta<-.0001||motionDelta>.12))resetTemporalHistory('camera or animation cut');
      lastJitter=active?temporalJitterSample(jitterIndex++):[0,0];
      // Only vegetation projection samples change. The main camera matrices,
      // physical vertex positions, water, shadow and reflection views do not.
      try{
        for(const g of groups){g.jitter.value.set(2*lastJitter[0]/width,2*lastJitter[1]/height);g.active.value=active?1:0;}
        renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      }finally{for(const g of groups){g.jitter.value.set(0,0);g.active.value=0;}}
      sceneStats={triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
      uniforms.tScene.value=sceneTarget.texture;
      if(active){
        currentVP.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        temporalUniforms.uInverseCurrentVP.value.copy(currentVP).invert();
        temporalUniforms.uNear.value=camera.near;temporalUniforms.uFar.value=camera.far;
        temporalUniforms.uHistoryValid.value=historyValid?1:0;
        temporalUniforms.uWind.value=Math.max(...groups.map(g=>g.wind.value));
        temporalUniforms.uMotionDelta.value=THREE.MathUtils.clamp(motionDelta,0,.06);
        temporalUniforms.uProjectionScale.value=Math.abs(camera.projectionMatrix.elements[5])*height*.5;
        temporalUniforms.tHistory.value=temporalTargets[1-historyIndex].texture;
        renderer.setRenderTarget(temporalTargets[historyIndex]);temporalQuad.render(renderer);
        uniforms.tScene.value=temporalTargets[historyIndex].texture;historyIndex=1-historyIndex;
        temporalUniforms.uPreviousVP.value.copy(currentVP);temporalUniforms.uPreviousView.value.copy(camera.matrixWorldInverse);
        historyValid=true;historyFrames++;
      }else if(historyValid)resetTemporalHistory('temporal disabled');
      lastAnimationTime=animationTime;lastPosition.copy(camera.position);lastQuaternion.copy(camera.quaternion);
      renderer.setRenderTarget(lensTarget);quad.render(renderer);
      let result=lensTarget;
      // r180 SMAA explicitly operates in linear-sRGB, before tone mapping.
      if(useSmaa){smaa.render(renderer,antialiasTarget,lensTarget);result=antialiasTarget;}
      const enlarge=width<outputWidth||height<outputHeight;
      if(enlarge&&upscalerReady){output.renderToScreen=false;output.render(renderer,encodedTarget,result);upscaler.render(encodedTarget);}
      else{output.renderToScreen=true;output.render(renderer,null,result);}
    },
    get state(){return {width,height,outputWidth,outputHeight,upscaler:width<outputWidth?upscaler.state.mode:'native resolution',samples:sceneTarget.samples,maxSamples,antialias:['MSAA',useTemporal?'selective temporal':null,useSmaa?'SMAA':null].filter(Boolean).join(' + '),temporal:{enabled:useTemporal,active:useTemporal&&temporalGroups.length>0,historyFrames,historyWeight:temporalUniforms.uHistoryWeight.value,jitterPixels:[...lastJitter],lastResetReason,scope:'opaque vegetation only; camera-depth reprojection, no object motion vectors',historyBytes:width*height*16},focalMm:uniforms.uFocal.value,cameraFocalMm:camera.getFocalLength(),verticalFovDegrees:camera.fov,exposureScale:renderer.toneMappingExposure,aperture:uniforms.uAperture.value,focusMetres:uniforms.uFocus.value,sensorHeightMm:uniforms.uSensorHeight.value,depthOfField:uniforms.uDof.value===1,vignette:uniforms.uVignette.value===1,sceneStats};},
    dispose(){for(const target of [sceneTarget,lensTarget,antialiasTarget,encodedTarget,...temporalTargets])target.dispose();smaa.dispose();output.dispose();material.dispose();quad.dispose();temporalMaterial.dispose();temporalQuad.dispose();upscaler.dispose();}
  };
}
