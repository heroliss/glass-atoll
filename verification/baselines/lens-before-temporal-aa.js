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
    setSize(w,h,outW=w,outH=h){width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));outputWidth=Math.round(outW);outputHeight=Math.round(outH);for(const target of [sceneTarget,lensTarget,antialiasTarget,encodedTarget])target.setSize(width,height);smaa.setSize(width,height);uniforms.uResolution.value.set(width,height);upscaler.setSize(width,height,outputWidth,outputHeight);},
    configure({focal=28,aperture=8,dof=false,vignette=true,antialias='smaa',quality:requestedQuality='high'}={}){
      uniforms.uFocal.value=focal;uniforms.uAperture.value=aperture;uniforms.uDof.value=dof?1:0;uniforms.uVignette.value=vignette?1:0;
      useSmaa=antialias==='smaa';quality=requestedQuality;setSamples();
    },
    render(scene,focusDistance){
      uniforms.uNear.value=camera.near;uniforms.uFar.value=camera.far;
      uniforms.uFocus.value=Math.max(.3,focusDistance);uniforms.uSensorHeight.value=camera.getFilmHeight();
      renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
      sceneStats={triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};
      renderer.setRenderTarget(lensTarget);quad.render(renderer);
      let result=lensTarget;
      // r180 SMAA explicitly operates in linear-sRGB, before tone mapping.
      if(useSmaa){smaa.render(renderer,antialiasTarget,lensTarget);result=antialiasTarget;}
      const enlarge=width<outputWidth||height<outputHeight;
      if(enlarge&&upscalerReady){output.renderToScreen=false;output.render(renderer,encodedTarget,result);upscaler.render(encodedTarget);}
      else{output.renderToScreen=true;output.render(renderer,null,result);}
    },
    get state(){return {width,height,outputWidth,outputHeight,upscaler:width<outputWidth?upscaler.state.mode:'native resolution',samples:sceneTarget.samples,maxSamples,antialias:useSmaa?'MSAA + SMAA':'MSAA',focalMm:uniforms.uFocal.value,cameraFocalMm:camera.getFocalLength(),verticalFovDegrees:camera.fov,exposureScale:renderer.toneMappingExposure,aperture:uniforms.uAperture.value,focusMetres:uniforms.uFocus.value,sensorHeightMm:uniforms.uSensorHeight.value,depthOfField:uniforms.uDof.value===1,vignette:uniforms.uVignette.value===1,sceneStats};},
    dispose(){for(const target of [sceneTarget,lensTarget,antialiasTarget,encodedTarget])target.dispose();smaa.dispose();output.dispose();material.dispose();quad.dispose();upscaler.dispose();}
  };
}
