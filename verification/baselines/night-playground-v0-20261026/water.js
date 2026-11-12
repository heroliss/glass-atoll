import * as THREE from 'three';
import { waveGLSL,waveStatistics } from './waves.js';
import { sandAlbedoGLSL } from './sand.js';
import { cloudShadowLookupGLSL } from './cloud-lighting.js';
import { createSunShadowBinding,sunShadowGLSL } from './sun-shadows.js';

// The surface combines actual scene refraction and planar reflection in linear light.
// Wavelengths and heights are measured in metres. Eight circular impulses are shared
// by vertex displacement and the fragment normal, so interaction deforms the water.
export function createWater(renderer, scene, camera, sun, {terrainHeight,skyCube,sandTexture,atmosphere,waveSpectrum,sunLight=null,indirectLighting}) {
  const treeShadow=createSunShadowBinding(THREE,sunLight);
  const refraction = new THREE.WebGLRenderTarget(1024, 768, {type:THREE.HalfFloatType, depthTexture:new THREE.DepthTexture(1024,768)});
  const reflection = new THREE.WebGLRenderTarget(768, 512, {type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(768,512)});
  const gl=renderer.getContext(),reflectionSamples=Math.min(2,renderer.capabilities.maxSamples??gl.getParameter(gl.MAX_SAMPLES));
  reflection.samples=reflectionSamples;
  reflection.texture.generateMipmaps=true;reflection.texture.minFilter=THREE.LinearMipmapLinearFilter;
  reflection.depthTexture.generateMipmaps=false;
  const mirrorCamera = camera.clone();
  const textureMatrix = new THREE.Matrix4();
  const impulses = Array.from({length:8},()=>new THREE.Vector4(0,0,-100,0));
  const heights=new Float32Array(1024*1024);
  for(let z=0;z<1024;z++)for(let x=0;x<1024;x++)heights[z*1024+x]=terrainHeight((x/1023-.5)*480,(z/1023-.5)*480);
  const heightTexture=new THREE.DataTexture(heights,1024,1024,THREE.RedFormat,THREE.FloatType);
  heightTexture.minFilter=heightTexture.magFilter=THREE.LinearFilter;heightTexture.needsUpdate=true;
  const white=new THREE.DataTexture(new Float32Array([1,1,1,1]),1,1,THREE.RGBAFormat,THREE.FloatType);white.needsUpdate=true;
  const zero=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);zero.needsUpdate=true;
  const uniforms = {
    uTime:{value:0}, uSun:{value:sun}, uIntensity:{value:1}, uRefract:{value:refraction.texture},
    uSunColor:{value:new THREE.Color(1,.97,.90)},uSkyColor:{value:new THREE.Color(.87,.94,1)},
    uDepth:{value:refraction.depthTexture}, uReflect:{value:reflection.texture},uReflectionDepth:{value:reflection.depthTexture},
    uTextureMatrix:{value:textureMatrix}, uResolution:{value:new THREE.Vector2(1024,768)},
    uInverseProjection:{value:camera.projectionMatrixInverse}, uCameraWorld:{value:camera.matrixWorld},
    uRipples:{value:impulses}, uWind:{value:1},uHeightMap:{value:heightTexture},uSkyCube:{value:skyCube},
    uViewProjection:{value:new THREE.Matrix4()},uSandTexture:{value:sandTexture},uSandColor:{value:sandTexture},uSandMacroColor:{value:sandTexture},uSandFineTile:{value:2},uSandMacroTile:{value:30},uSandAlbedoGain:{value:1},uCaustic:{value:white},uSunIrradiance:{value:3.6},uCausticExtent:{value:64},
    uMeanCurrent:{value:new THREE.Vector2()},uCurrentOffset:{value:new THREE.Vector2()},uRippleOffsets:{value:Array.from({length:8},()=>new THREE.Vector2())},uHydroState:{value:zero},uHydroExtent:{value:72},uHydroResolution:{value:384},uHydroEnabled:{value:0},uDebugMode:{value:0},
    uGlintAA:{value:1},uGlintTemporalVariance:{value:waveStatistics.temporalSlopeVariance||0}
  };
  const waveCode = waveGLSL;
  Object.assign(uniforms,atmosphere.uniforms);
  Object.assign(uniforms,waveSpectrum.uniforms);
  Object.assign(uniforms,treeShadow.uniforms,indirectLighting.uniforms);
  const material = new THREE.ShaderMaterial({
    uniforms,defines:{BAKED_WAVE_TEXTURES:1},
    vertexShader:/* glsl */`
      #define GEOMETRY_PASS
      ${waveCode}
      uniform mat4 uTextureMatrix;
      varying vec3 vWorld;
      varying vec4 vReflection;
      void main(){
        vec3 p=position;
        vec4 world=modelMatrix*vec4(p,1.);
        world.y=surface(world.xz);
        vWorld=world.xyz;
        vReflection=uTextureMatrix*world;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader:/* glsl */`
      #include <common>
      #include <packing>
      #define OPTICAL_PASS
      ${waveCode}
      ${sandAlbedoGLSL}
      ${cloudShadowLookupGLSL}
      ${sunShadowGLSL}
      ${indirectLighting.glsl}
      uniform vec3 uSun;
      uniform vec3 uSunColor,uSkyColor;
      uniform float uIntensity;
      uniform sampler2D uRefract;
      uniform highp sampler2D uDepth;
      uniform sampler2D uReflect;
      uniform highp sampler2D uReflectionDepth;
      uniform highp sampler2D uHeightMap;
      uniform sampler2D uSandTexture;
      uniform sampler2D uCaustic;
      uniform samplerCube uSkyCube;
      uniform mat4 uViewProjection;
      uniform float uSunIrradiance;
      uniform float uCausticExtent;
      uniform float uDebugMode;
      uniform float uGlintAA,uGlintTemporalVariance;
      uniform vec2 uResolution;
      uniform mat4 uInverseProjection;
      uniform mat4 uCameraWorld;
      varying vec3 vWorld;
      varying vec4 vReflection;
      vec3 reconstruct(vec2 uv,float depth) {
        vec4 v=uInverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);
        return (uCameraWorld*vec4(v.xyz/v.w,1.)).xyz;
      }
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      float bottomHeight(vec2 p){if(max(abs(p.x),abs(p.y))>239.)return -33.;return texture2D(uHeightMap,p/480.+.5).r;}
      float fresnelDielectric(float cosI){
        cosI=clamp(cosI,0.,1.);float eta=1.333;
        float cosT=sqrt(max(0.,1.-(1.-cosI*cosI)/(eta*eta)));
        float rs=(cosI-eta*cosT)/(cosI+eta*cosT);
        float rp=(eta*cosI-cosT)/(eta*cosI+cosT);
        return .5*(rs*rs+rp*rp);
      }
      void main(){
        vec2 p=vWorld.xz;
        opticalFootprint=max(length(dFdx(p)),length(dFdy(p)));
        vec3 n=surfaceNormal(p);
        vec3 V=normalize(cameraPosition-vWorld);
        float unmaskedFacing=max(dot(n,V),0.);
        if(dot(n,V)<.001)n=normalize(n+V*(.002-dot(n,V)));
        vec2 uv=gl_FragCoord.xy/uResolution;
        // Snell's law, followed by five height-field intersection refinements.
        // This path remains well defined at grazing and oblique viewpoints.
        vec3 T=refract(-V,n,1./1.333);
        float pathLength=max(.001,(bottomHeight(p)-vWorld.y)/min(T.y,-.12));
        for(int j=0;j<5;j++)pathLength=max(.001,(bottomHeight(p+T.xz*pathLength)-vWorld.y)/min(T.y,-.12));
        pathLength=min(pathLength,120.);
        vec3 bottom=vWorld+T*pathLength;
        float vertical=max(.0,vWorld.y-bottomHeight(p));
        vec4 projectedBottom=uViewProjection*vec4(bottom,1.);
        vec2 refrUV=projectedBottom.xy/projectedBottom.w*.5+.5;
        vec2 safeUV=clamp(refrUV,vec2(.002),vec2(.998));
        vec3 visibleBottom=reconstruct(safeUV,texture2D(uDepth,safeUV).x);
        float viewDistance=length(cameraPosition-vWorld);
        vec3 absorption=vec3(.160,.035,.018);
        vec3 scattering=vec3(.004,.009,.014);
        vec3 extinction=absorption+scattering;
        vec3 transmission=exp(-extinction*pathLength);
        vec3 lightRay=refract(-uSun,vec3(0,1,0),1./1.333);
        float sunlightPath=max(.0,-bottom.y)/max(.15,-lightRay.y);
        vec3 solarTransmission=exp(-extinction*sunlightPath)*(1.-fresnelDielectric(uSun.y));
        // Air-side occlusion must be queried at the solar ENTRY point, not
        // projected straight onto the sea surface or directly onto the bed.
        vec3 solarEntry=bottom-lightRay*sunlightPath;
        float bedTreeVisibility=treeSunVisibility(solarEntry);
        float surfaceTreeVisibility=treeSunVisibility(vWorld);
        vec3 volumePoint=vWorld+T*(pathLength*.5);
        float volumeSolarPath=max(0.,-volumePoint.y)/max(.15,-lightRay.y);
        float volumeTreeVisibility=treeSunVisibility(volumePoint-lightRay*volumeSolarPath);
        float slopeX=(bottomHeight(bottom.xz+vec2(.2,0))-bottomHeight(bottom.xz-vec2(.2,0)))/.4;
        float slopeZ=(bottomHeight(bottom.xz+vec2(0,.2))-bottomHeight(bottom.xz-vec2(0,.2)))/.4;
        vec3 bn=normalize(vec3(-slopeX,1.,-slopeZ));
        vec3 albedo=sampleSandAlbedo(bottom.xz,bottom.y);
        float solarCloud=getCloudShadow(vWorld,uCloudTime);
        float concentration=texture2D(uCaustic,bottom.xz/(2.*uCausticExtent)+.5).r;
        float coverage=1.-smoothstep(uCausticExtent*.9,uCausticExtent*.99,max(abs(bottom.x),abs(bottom.z)));
        concentration=mix(1.,max(.05,concentration),coverage*smoothstep(.08,.4,-bottom.y)*(1.-smoothstep(1.5,5.,-bottom.y)));
        vec3 bedDirect=albedo*uSunColor*uSunIrradiance*max(uSun.y,0.)*max(bn.y,0.)*concentration*solarCloud*bedTreeVisibility/3.14159265;
        vec3 bedAmbient=albedo*(.70*uSkyColor*uIntensity)/3.14159265;
        vec3 diffuseTransmission=exp(-extinction*(max(0.,-bottom.y)*1.3))*(1.-fresnelDielectric(1.));
        vec3 bedBounce=albedo*getIndirectIrradiance(bottom,bn)/3.14159265;
        vec3 refracted=bedDirect*solarTransmission+bedAmbient*diffuseTransmission+bedBounce*diffuseTransmission;
        // Reproject only small submerged objects. The seabed itself is shaded
        // at the refracted world-space hit, with no screen-edge discontinuity.
        bool inside=all(greaterThan(refrUV,vec2(.001)))&&all(lessThan(refrUV,vec2(.999)));
        float objectAboveBed=visibleBottom.y-bottomHeight(visibleBottom.xz);
        if(inside&&visibleBottom.y<-.03&&objectAboveBed>.06&&objectAboveBed<.6&&length(visibleBottom-bottom)<.6)refracted=texture2D(uRefract,safeUV).rgb*solarTransmission;
        // Beer-Lambert along both the incoming solar and outgoing view paths.
        // Isotropic single-scattering approximation for clear ocean water.
        vec3 volumeSolarTransmission=exp(-extinction*volumeSolarPath)*(1.-fresnelDielectric(uSun.y));
        vec3 volumeAmbientTransmission=exp(-extinction*(max(0.,-volumePoint.y)*1.3));
        vec3 volumeRadiance=scattering/extinction*(uSunColor*uSunIrradiance*solarCloud*volumeTreeVisibility*volumeSolarTransmission*.079577+.11*uSkyColor*uIntensity*volumeAmbientTransmission);
        vec3 waterColour=refracted*transmission+volumeRadiance*(1.-transmission);
        vec2 reflectUV=vReflection.xy/vReflection.w;
        reflectUV+=n.xz*.065/(1.+viewDistance*.01);
        vec2 safeReflect=clamp(reflectUV,vec2(.002),vec2(.998));
        vec3 reflected=texture2D(uReflect,safeReflect).rgb;
        // For the sky use the actual reflected 3D ray, rather than distorting
        // a flat horizon image. Nearby objects retain their planar reflection.
        vec3 R=reflect(-V,n);R.y=max(R.y,.006);
        float reflectionLod=max(0.,log2(max(1.,sqrt(unresolvedSlopeVariance)*128.)));
        vec3 skyReflection=textureLod(uSkyCube,R,reflectionLod).rgb;
        if(texture2D(uReflectionDepth,safeReflect).x>.9998)reflected=skyReflection;
        // Smith masking approximates unresolved wave self-occlusion at the
        // horizon. A flat normal-mapped mirror otherwise reflects bright haze
        // from back-facing facets that would be hidden by neighbouring waves.
        float macroNoV=max(V.y,.0001);
        float windGain=uWind*uWindSea;
        float slopeAlpha=max(.002,sqrt(${(waveStatistics.swellRmsSlope**2).toFixed(12)}*uSwell*uSwell+${(waveStatistics.windRmsSlope**2).toFixed(12)}*windGain*windGain));
        float visibility=2.*macroNoV/(macroNoV+sqrt(slopeAlpha*slopeAlpha+(1.-slopeAlpha*slopeAlpha)*macroNoV*macroNoV));
        visibility*=2.*unmaskedFacing/max(.0001,unmaskedFacing+sqrt(slopeAlpha*slopeAlpha+(1.-slopeAlpha*slopeAlpha)*unmaskedFacing*unmaskedFacing));
        // Masked microfacets still exchange light with other water facets and
        // the sky. Using deep-water volume radiance for that missing energy
        // makes the grazing horizon spuriously black. A low-frequency sky
        // lookup is a bounded missing-energy approximation here, rather than
        // a microfacet-distribution integral or a multiple-bounce solver.
        vec3 macroReflection=reflect(-V,vec3(0,1,0));
        macroReflection.y=max(.012,macroReflection.y);
        vec3 unresolvedSky=textureLod(uSkyCube,normalize(macroReflection),3.5).rgb;
        reflected=mix(unresolvedSky,reflected,visibility);
        float facing=clamp(dot(n,V),0.,1.);
        float fresnel=fresnelDielectric(facing);
        vec3 colour=mix(waterColour,reflected,fresnel);
        // Filtered fine slopes are a distribution, not a perfectly flat mirror.
        // A Gaussian-slope (Beckmann) lobe carries their mip moment variance.
        vec3 H=normalize(V+uSun);
        float NoH=max(dot(n,H),0.),NoL=max(dot(n,uSun),0.),NoV=max(facing,.001);
        vec3 normalDx=dFdx(n),normalDy=dFdy(n);
        float pixelNormalVariance=.083333*(dot(normalDx,normalDx)+dot(normalDy,normalDy));
        float temporalNormalVariance=${waveStatistics.swellTemporalSlopeVariance.toFixed(14)}*uSwell*uSwell+${waveStatistics.windTemporalSlopeVariance.toFixed(14)}*windGain*windGain;
        float aa=.0001+unresolvedSlopeVariance+.00001081125+uGlintAA*(pixelNormalVariance+temporalNormalVariance);
        float nh2=max(.0001,NoH*NoH);
        float D=exp((nh2-1.)/(aa*nh2))/(3.14159265*aa*nh2*nh2);
        float av=NoV/max(.0001,sqrt(aa*(1.-NoV*NoV)));
        float al=NoL/max(.0001,sqrt(aa*(1.-NoL*NoL)));
        float Gv=av>=1.6?1.:(3.535*av+2.181*av*av)/(1.+2.276*av+2.577*av*av);
        float Gl=al>=1.6?1.:(3.535*al+2.181*al*al)/(1.+2.276*al+2.577*al*al);
        float Fsun=fresnelDielectric(max(dot(V,H),0.));
        vec3 solarGlint=uSunColor*uSunIrradiance*solarCloud*surfaceTreeVisibility*D*Gv*Gl*Fsun/(4.*NoV);
        colour+=solarGlint;
        // Broken, fine swash on the waterline rather than a painted white ring.
        float swash=sin(vertical*18.-uTime*1.3+noise(p*.65)*5.);
        float foam=(1.-smoothstep(.018,.16,vertical))*smoothstep(.4,.88,swash)*smoothstep(.35,.72,noise(p*3.+uTime*.1));
        vec3 foamLight=vec3(.94,.96,.9)*(uSunColor*uSunIrradiance*solarCloud*surfaceTreeVisibility*.25+uSkyColor*.20*uIntensity);
        colour=mix(colour,foamLight,foam*.45);
        // Atmospheric perspective matches the pale, humid tropical horizon.
        // The shared HDR aerial pass handles the camera-to-water air segment.
        if(uDebugMode>.5&&uDebugMode<1.5)colour=waterColour;
        if(uDebugMode>1.5&&uDebugMode<2.5)colour=reflected;
        if(uDebugMode>2.5&&uDebugMode<3.5)colour=vec3(fresnel);
        if(uDebugMode>3.5&&uDebugMode<4.5)colour=volumeRadiance;
        if(uDebugMode>4.5&&uDebugMode<5.5)colour=vec3(unresolvedSlopeVariance*40.);
        if(uDebugMode>5.5&&uDebugMode<6.5)colour=n*.5+.5;
        if(uDebugMode>7.5&&uDebugMode<8.5)colour=vec3(bedTreeVisibility);
        if(uDebugMode>8.5&&uDebugMode<9.5)colour=vec3(surfaceTreeVisibility);
        if(uDebugMode>9.5&&uDebugMode<10.5)colour=vec3(volumeTreeVisibility);
        if(uDebugMode>10.5&&uDebugMode<11.5)colour=solarGlint;
        if(uDebugMode>11.5&&uDebugMode<12.5)colour=vec3(concentration);
        if(uDebugMode>12.5&&uDebugMode<13.5)colour=vec3(step(.9998,texture2D(uReflectionDepth,safeReflect).x));
        if(uDebugMode>13.5&&uDebugMode<14.5)colour=reflected;
        if(uDebugMode>14.5&&uDebugMode<15.5)colour=vec3(aa,unresolvedSlopeVariance,temporalNormalVariance)*20.;
        if(uDebugMode>6.5&&(any(isnan(colour))||any(isinf(colour))))colour=vec3(10.,0.,10.);
        gl_FragColor=vec4(colour,uGlintAA>.5?.70:1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side:THREE.FrontSide
  });
  const geometry=new THREE.PlaneGeometry(220,220,640,640).rotateX(-Math.PI/2);
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    if(positions.getX(i)<-109.9)positions.setX(i,-10000);
    if(positions.getX(i)>109.9)positions.setX(i,10000);
    if(positions.getZ(i)<-109.9)positions.setZ(i,-10000);
    if(positions.getZ(i)>109.9)positions.setZ(i,10000);
  }
  const mesh=new THREE.Mesh(geometry,material);
  mesh.frustumCulled=false;
  mesh.name='Refracting lagoon';
  mesh.renderOrder=2;
  // Called after Three's shadow pass, including the first frame in which the
  // map becomes available. The public update method is also safe before draw.
  mesh.onBeforeRender=()=>treeShadow.update();
  scene.add(mesh);
  let nextImpulse=0;
  const normal = new THREE.Vector3(0,1,0), reflectorWorldPosition=new THREE.Vector3(), cameraWorldPosition=new THREE.Vector3(), rotationMatrix=new THREE.Matrix4(), lookAtPosition=new THREE.Vector3(0,0,-1), view=new THREE.Vector3(), target=new THREE.Vector3(), clipPlane=new THREE.Plane(), clipVector=new THREE.Vector4(), q=new THREE.Vector4();
  return {
    mesh, uniforms, refraction, reflection,
    updateTreeShadow:light=>treeShadow.update(light),treeShadow,
    diagnostics(){return {treeShadow:treeShadow.diagnostics(),reflection:{size:[reflection.width,reflection.height],samples:reflection.samples,colourMipmaps:reflection.texture.generateMipmaps,depthMipmaps:reflection.depthTexture.generateMipmaps,filter:'linear mipmapped colour; independent non-mipmapped depth'},glintAA:{enabled:uniforms.uGlintAA.value,temporalSlopeVarianceAtReferenceWind:uniforms.uGlintTemporalVariance.value,model:'pixel normal variance plus statistical 1/120 s temporal slope variance; only direct-sun NDF'}};},
    impulse(x,z,time,strength=1){const i=nextImpulse++%8;impulses[i].set(x,z,time,strength);uniforms.uRippleOffsets.value[i].copy(uniforms.uCurrentOffset.value);},
    resize(w,h,quality='high'){
      refraction.setSize(w,h);
      const samples=quality==='high'?reflectionSamples:0;
      if(reflection.samples!==samples){reflection.samples=samples;reflection.dispose();}
      reflection.setSize(Math.max(320,Math.round(w*(quality==='high'?1:.65))),Math.max(240,Math.round(h*(quality==='high'?1:.65))));
      uniforms.uResolution.value.set(w,h);
    },
    render(time){
      uniforms.uTime.value=time;
      uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      mesh.visible=false;
      // Refraction retains a depth texture, allowing true water-path absorption.
      renderer.setRenderTarget(refraction);
      const cameraLayerMask=camera.layers.mask;
      const updateShadows=renderer.shadowMap.needsUpdate;
      renderer.shadowMap.needsUpdate=false;
      // Only small submerged props need screen reprojection. The seabed is
      // already intersected/shaded in world space, so don't redraw the entire
      // expensive sand/forest into this auxiliary object buffer.
      camera.layers.set(1);
      renderer.render(scene,camera);
      camera.layers.mask=cameraLayerMask;
      renderer.shadowMap.needsUpdate=updateShadows;
      // Mirror-camera oblique near plane clips everything beneath the surface.
      reflectorWorldPosition.set(0,0,0);
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      view.subVectors(reflectorWorldPosition,cameraWorldPosition).reflect(normal).negate().add(reflectorWorldPosition);
      rotationMatrix.extractRotation(camera.matrixWorld);
      lookAtPosition.set(0,0,-1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
      target.subVectors(reflectorWorldPosition,lookAtPosition).reflect(normal).negate().add(reflectorWorldPosition);
      mirrorCamera.position.copy(view);
      mirrorCamera.up.set(0,1,0).applyMatrix4(rotationMatrix).reflect(normal);
      mirrorCamera.lookAt(target);
      mirrorCamera.far=camera.far;
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
      clipPlane.setFromNormalAndCoplanarPoint(normal,reflectorWorldPosition).applyMatrix4(mirrorCamera.matrixWorldInverse);
      clipVector.set(clipPlane.normal.x,clipPlane.normal.y,clipPlane.normal.z,clipPlane.constant);
      const projection=mirrorCamera.projectionMatrix.elements;
      q.x=(Math.sign(clipVector.x)+projection[8])/projection[0];
      q.y=(Math.sign(clipVector.y)+projection[9])/projection[5];
      q.z=-1.; q.w=(1.+projection[10])/projection[14];
      clipVector.multiplyScalar(2./clipVector.dot(q));
      projection[2]=clipVector.x; projection[6]=clipVector.y; projection[10]=clipVector.z+1.-.002; projection[14]=clipVector.w;
      renderer.setRenderTarget(reflection);
      // Sky-only reflection pixels are sampled from uSkyCube in the water
      // shader anyway. Render that same cheap cube behind reflected objects,
      // rather than ray-marching the complete atmosphere a second time.
      // The cube supplies correct edge/MSAA/mip colour around small leaves.
      const skyWasVisible=atmosphere.mesh.visible,previousBackground=scene.background;
      try{
        atmosphere.mesh.visible=false;scene.background=skyCube;
        renderer.render(scene,mirrorCamera);
      }finally{atmosphere.mesh.visible=skyWasVisible;scene.background=previousBackground;}
      mesh.visible=true;
      renderer.setRenderTarget(null);
    }
  };
}
