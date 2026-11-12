import * as THREE from 'three';
import { waveGLSL } from './waves.js';
import { sandAlbedoGLSL } from './sand.js';
import { cloudShadowLookupGLSL } from './cloud-lighting.js';

// The surface combines actual scene refraction and planar reflection in linear light.
// Wavelengths and heights are measured in metres. Eight circular impulses are shared
// by vertex displacement and the fragment normal, so interaction deforms the water.
export function createWater(renderer, scene, camera, sun, {terrainHeight,skyCube,sandTexture,atmosphere}) {
  const refraction = new THREE.WebGLRenderTarget(1024, 768, {type:THREE.HalfFloatType, depthTexture:new THREE.DepthTexture(1024,768)});
  const reflection = new THREE.WebGLRenderTarget(768, 512, {type:THREE.HalfFloatType,depthTexture:new THREE.DepthTexture(768,512)});
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
    uMeanCurrent:{value:new THREE.Vector2()},uCurrentOffset:{value:new THREE.Vector2()},uRippleOffsets:{value:Array.from({length:8},()=>new THREE.Vector2())},uHydroState:{value:zero},uHydroExtent:{value:72},uHydroResolution:{value:384},uHydroEnabled:{value:0},uDebugMode:{value:0}
  };
  const waveCode = waveGLSL;
  Object.assign(uniforms,atmosphere.uniforms);
  const material = new THREE.ShaderMaterial({
    uniforms,
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
      #define OPTICAL_PASS
      ${waveCode}
      ${sandAlbedoGLSL}
      ${cloudShadowLookupGLSL}
      uniform vec3 uSun;
      uniform vec3 uSunColor,uSkyColor;
      uniform float uIntensity;
      uniform sampler2D uRefract;
      uniform sampler2D uDepth;
      uniform sampler2D uReflect;
      uniform sampler2D uReflectionDepth;
      uniform sampler2D uHeightMap;
      uniform sampler2D uSandTexture;
      uniform sampler2D uCaustic;
      uniform samplerCube uSkyCube;
      uniform mat4 uViewProjection;
      uniform float uSunIrradiance;
      uniform float uCausticExtent;
      uniform float uDebugMode;
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
        float slopeX=(bottomHeight(bottom.xz+vec2(.2,0))-bottomHeight(bottom.xz-vec2(.2,0)))/.4;
        float slopeZ=(bottomHeight(bottom.xz+vec2(0,.2))-bottomHeight(bottom.xz-vec2(0,.2)))/.4;
        vec3 bn=normalize(vec3(-slopeX,1.,-slopeZ));
        vec3 albedo=sampleSandAlbedo(bottom.xz,bottom.y);
        float solarCloud=getCloudShadow(vWorld,uCloudTime);
        float concentration=texture2D(uCaustic,bottom.xz/(2.*uCausticExtent)+.5).r;
        float coverage=1.-smoothstep(uCausticExtent*.9,uCausticExtent*.99,max(abs(bottom.x),abs(bottom.z)));
        concentration=mix(1.,max(.05,concentration),coverage*smoothstep(.08,.4,-bottom.y)*(1.-smoothstep(1.5,5.,-bottom.y)));
        vec3 refracted=albedo*(uSunColor*uSunIrradiance*max(uSun.y,0.)*max(bn.y,0.)*concentration*solarCloud+.70*uSkyColor*uIntensity)/3.14159265;
        // Reproject only small submerged objects. The seabed itself is shaded
        // at the refracted world-space hit, with no screen-edge discontinuity.
        bool inside=all(greaterThan(refrUV,vec2(.001)))&&all(lessThan(refrUV,vec2(.999)));
        float objectAboveBed=visibleBottom.y-bottomHeight(visibleBottom.xz);
        if(inside&&visibleBottom.y<-.03&&objectAboveBed>.06&&objectAboveBed<.6&&length(visibleBottom-bottom)<.6)refracted=texture2D(uRefract,safeUV).rgb;
        // Beer-Lambert along both the incoming solar and outgoing view paths.
        // Isotropic single-scattering approximation for clear ocean water.
        vec3 volumeRadiance=scattering/extinction*(uSunColor*uSunIrradiance*solarCloud*.079577+.11*uSkyColor*uIntensity);
        vec3 waterColour=refracted*solarTransmission*transmission+volumeRadiance*(1.-transmission);
        vec2 reflectUV=vReflection.xy/vReflection.w;
        reflectUV+=n.xz*.065/(1.+viewDistance*.01);
        vec2 safeReflect=clamp(reflectUV,vec2(.002),vec2(.998));
        vec3 reflected=texture2D(uReflect,safeReflect).rgb;
        // For the sky use the actual reflected 3D ray, rather than distorting
        // a flat horizon image. Nearby objects retain their planar reflection.
        vec3 R=reflect(-V,n);R.y=max(R.y,.006);
        vec3 skyReflection=textureCube(uSkyCube,R,1.2).rgb;
        if(texture2D(uReflectionDepth,safeReflect).x>.9998)reflected=skyReflection;
        // Smith masking approximates unresolved wave self-occlusion at the
        // horizon. A flat normal-mapped mirror otherwise reflects bright haze
        // from back-facing facets that would be hidden by neighbouring waves.
        float macroNoV=max(V.y,.0001);
        float slopeAlpha=max(.002,.14335*uWind);
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
        // Analytic finite-width GGX solar lobe, sharing the scene's irradiance.
        vec3 H=normalize(V+uSun);
        float NoH=max(dot(n,H),0.),NoL=max(dot(n,uSun),0.),NoV=max(facing,.001);
        float alpha=.018,aa=alpha*alpha;
        float den=NoH*NoH*(aa-1.)+1.;
        float D=aa/(3.14159265*den*den);
        float Gv=2.*NoV/(NoV+sqrt(aa+(1.-aa)*NoV*NoV));
        float Gl=2.*NoL/(NoL+sqrt(aa+(1.-aa)*NoL*NoL));
        float Fsun=fresnelDielectric(max(dot(V,H),0.));
        colour+=uSunColor*uSunIrradiance*solarCloud*D*Gv*Gl*Fsun/(4.*NoV);
        // Broken, fine swash on the waterline rather than a painted white ring.
        float swash=sin(vertical*18.-uTime*1.3+noise(p*.65)*5.);
        float foam=(1.-smoothstep(.018,.16,vertical))*smoothstep(.4,.88,swash)*smoothstep(.35,.72,noise(p*3.+uTime*.1));
        vec3 foamLight=vec3(.94,.96,.9)*(uSunColor*uSunIrradiance*solarCloud*.25+uSkyColor*.20*uIntensity);
        colour=mix(colour,foamLight,foam*.45);
        // Atmospheric perspective matches the pale, humid tropical horizon.
        float haze=1.-exp(-viewDistance*.000065);
        vec3 atmosphereRay=normalize(vWorld-cameraPosition);
        atmosphereRay.y=max(.004,atmosphereRay.y);
        vec3 airRadiance=textureLod(uSkyCube,normalize(atmosphereRay),2.).rgb;
        colour=mix(colour,airRadiance,haze);
        if(uDebugMode>.5&&uDebugMode<1.5)colour=waterColour;
        if(uDebugMode>1.5&&uDebugMode<2.5)colour=reflected;
        if(uDebugMode>2.5&&uDebugMode<3.5)colour=vec3(fresnel);
        if(uDebugMode>3.5&&uDebugMode<4.5)colour=volumeRadiance;
        if(uDebugMode>6.5&&(any(isnan(colour))||any(isinf(colour))))colour=vec3(10.,0.,10.);
        gl_FragColor=vec4(colour,1.);
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
  scene.add(mesh);
  let nextImpulse=0;
  const normal = new THREE.Vector3(0,1,0), reflectorWorldPosition=new THREE.Vector3(), cameraWorldPosition=new THREE.Vector3(), rotationMatrix=new THREE.Matrix4(), lookAtPosition=new THREE.Vector3(0,0,-1), view=new THREE.Vector3(), target=new THREE.Vector3(), clipPlane=new THREE.Plane(), clipVector=new THREE.Vector4(), q=new THREE.Vector4();
  return {
    mesh, uniforms, refraction, reflection,
    impulse(x,z,time,strength=1){const i=nextImpulse++%8;impulses[i].set(x,z,time,strength);uniforms.uRippleOffsets.value[i].copy(uniforms.uCurrentOffset.value);},
    resize(w,h,quality='high'){
      refraction.setSize(w,h);
      reflection.setSize(Math.max(320,Math.round(w*(quality==='high'?.72:.45))),Math.max(240,Math.round(h*(quality==='high'?.72:.45))));
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
      renderer.render(scene,mirrorCamera);
      mesh.visible=true;
      renderer.setRenderTarget(null);
    }
  };
}
