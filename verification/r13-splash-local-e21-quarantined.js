import { waveGLSL, waveComponents } from './waves.js';
import { sandAlbedoGLSL } from './sand.js';
import { sunShadowGLSL } from './sun-shadows.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Bounded visual water-entry response. The actual surface impulse belongs to the
// app's shared wave/SWE system; this module neither adds it nor plays audio.
export function createSplash(THREE,{scene,uniforms={},sunDirection=null,maxEvents=4,dropletCount=96,sampleSurfaceHeight=null,skyContainsSolarDisc=false,envMode='sky-only'}={}){
  if(!scene)throw new Error('createSplash requires a scene');
  const groundKeys=['uHeightMap','uSandColor','uSandFineTile','uSandColorMean','uSandAlbedoGain','uCaustic','uCausticExtent','uSkyColor','uIntensity','uWave0','uWave1','uWave2','uWave3','uWaveDomains','uWaveResolution','uHydroState','uHydroExtent','uHydroResolution','uHydroEnabled','uTime','uWind','uSwell','uWindSea','uMeanCurrent','uCurrentOffset','uRipples','uRippleOffsets','uSunShadowMap','uSunShadowMatrix','uSunShadowSize','uSunShadowEnabled','uSunShadowBias','uSunShadowNormalBias','uSunShadowRadius','uSunShadowIntensity','uCloudShadowMap','uCloudShadowFar','uCloudShadowExtent','uCloudShadowFarExtent','uCloudTime','uCloudLightDirection'];
  const missingGround=groundKeys.filter(k=>!uniforms[k]),hasGround=missingGround.length===0;
  function validateMode(mode){if(!['sky-only','local-water'].includes(mode))throw new RangeError('Unknown splash environment mode');if(mode==='local-water'&&!hasGround)throw new Error('Local splash environment requires shared water uniforms: '+missingGround.join(','));return mode;}
  envMode=validateMode(envMode);
  const events=[];let serial=0,lastTime=0;
  const shared={...uniforms};
  shared.uSplashSun=uniforms.uSun||{value:sunDirection||new THREE.Vector3(.4,.8,.3).normalize()};
  shared.uSplashSunColor=uniforms.uSunColor||{value:new THREE.Color(1,.97,.9)};
  shared.uSplashIrradiance=uniforms.uSunIrradiance||{value:3.6};
  shared.uSplashSky=uniforms.uSkyCube||{value:null};
  // The environment may have been captured at a different FP16 storage P.
  // This is the same capture-to-scene ratio used by the water material.
  shared.uSplashSkyScale=uniforms.uSkyCubeScale||{value:1};
  // Both production cube-capture paths explicitly disable uSolarDisk, even
  // though the live sky's uniform returns to1 afterward. Only explicit cube
  // metadata may say it contains a disc; never infer this from the live sky.
  shared.uSplashSkyHasSun=uniforms.uSkyCubeHasSolarDisk||{value:skyContainsSolarDisc?1:0};
  shared.uSplashFallbackSky=uniforms.uSkyColor||{value:new THREE.Color(.65,.82,.96)};
  shared.uSplashHasSky={value:uniforms.uSkyCube?.value?1:0};
  shared.uSplashEnvironmentMode={value:envMode==='local-water'?1:0};
  const root=new THREE.Group();root.name='Metric stone-water splashes';scene.add(root);
  const lightGLSL=/* glsl */`
    uniform vec3 uSplashSun,uSplashSunColor,uSplashFallbackSky;
    uniform float uSplashIrradiance,uSplashHasSky,uSplashSkyScale,uSplashSkyHasSun;
    uniform samplerCube uSplashSky;
    vec3 splashSky(vec3 d){
      vec3 result=uSplashFallbackSky*mix(.4,1.,smoothstep(-.1,.6,d.y));
      if(uSplashHasSky>.5)result=max(vec3(0.),textureCube(uSplashSky,d).rgb)*uSplashSkyScale;
      return result;
    }
    float splashFresnel(float cosine){
      return .02037+.97963*pow(1.-clamp(cosine,0.,1.),5.);
    }
    float splashSolarRadiance(vec3 reflectedDirection){
      // Irradiance E is an integral over the solar disc, not its radiance.
      // A normalized angular Gaussian approximates the finite 0.53 degree
      // disc convolved with this pixel's reflected-direction footprint. Its
      // solid-angle integral is E; larger footprints spread the same energy.
      vec3 dx=dFdx(reflectedDirection),dy=dFdy(reflectedDirection);
      float variance=.00465*.00465*.25+(dot(dx,dx)+dot(dy,dy))/12.;
      float angleSquared=max(0.,2.*(1.-dot(reflectedDirection,normalize(uSplashSun))));
      return (1.-uSplashHasSky*uSplashSkyHasSun)*uSplashIrradiance*exp(-angleSquared/(2.*variance))/(6.28318530718*variance);
    }
  `;
  // Same physical bed inputs/functions as water, not a new RGB scene capture.
  // Unique samplers: spectrum4 +SWE1 +sky1 +height1 +sand1 +caustic1
  // +cloud2 +directional shadow1 =12. No props/transient GI are traced here.
  const localEnvironmentGLSL=hasGround?/* glsl */`
    #include <packing>
    #define GEOMETRY_PASS
    ${waveGLSL}
    ${sandAlbedoGLSL}
    ${sunShadowGLSL}
    uniform sampler2D uHeightMap,uCaustic,uCloudShadowMap,uCloudShadowFar;
    uniform float uCausticExtent,uIntensity,uCloudShadowExtent,uCloudShadowFarExtent,uCloudTime;
    uniform vec3 uSkyColor,uCloudLightDirection;
    uniform float uSplashEnvironmentMode;
    float splashBedHeight(vec2 p){return max(abs(p.x),abs(p.y))>239.?-33.:texture2D(uHeightMap,p/480.+.5).r;}
    float splashDielectric(float cosine){float c=clamp(cosine,0.,1.),ct=sqrt(max(0.,1.-(1.-c*c)/(1.333*1.333)));float rs=(c-1.333*ct)/(c+1.333*ct),rp=(1.333*c-ct)/(1.333*c+ct);return .5*(rs*rs+rp*rp);}
    float splashCloud(vec3 p){
      vec2 projected=p.xz-uCloudLightDirection.xz*max(0.,p.y-1.)/max(.08,uCloudLightDirection.y);
      vec2 uv=projected/(2.*uCloudShadowExtent)+.5,farUV=projected/(2.*uCloudShadowFarExtent)+.5;
      float covered=1.-smoothstep(.45,.495,max(abs(uv.x-.5),abs(uv.y-.5)));
      return mix(texture2D(uCloudShadowFar,clamp(farUV,vec2(.002),vec2(.998))).r,texture2D(uCloudShadowMap,clamp(uv,vec2(.001),vec2(.999))).r,covered);
    }
    vec3 splashEnvironment(vec3 P,vec3 R){
      vec3 sky=splashSky(R)+uSplashSunColor*splashSolarRadiance(R);
      if(uSplashEnvironmentMode<.5)return sky;
      vec3 field=waterField(P.xz),waterNormal=normalize(vec3(-field.y,1.,-field.z)),plane=vec3(P.x,field.x,P.z);
      float incident=dot(R,waterNormal),distanceToPlane=dot(plane-P,waterNormal)/min(incident,-.0001);
      float airDistance=clamp(distanceToPlane,0.,120.);vec3 entry=P+R*airDistance;
      // A local tangent-plane proxy only. Misses/upward/backward/unbounded
      // rays retain the current sky, rather than inventing a clamped hit.
      bool hit=incident<-.001&&distanceToPlane>=0.&&distanceToPlane<=120.;
      vec3 T=refract(R,waterNormal,1./1.333);
      float path=max(.001,(splashBedHeight(entry.xz)-entry.y)/min(T.y,-.05));
      for(int i=0;i<5;i++)path=max(.001,(splashBedHeight(entry.xz+T.xz*path)-entry.y)/min(T.y,-.05));
      path=min(path,120.);vec3 bottom=entry+T*path;
      float depth=max(0.,entry.y-bottom.y);
      vec3 bn=normalize(vec3(-(splashBedHeight(bottom.xz+vec2(.2,0))-splashBedHeight(bottom.xz-vec2(.2,0)))/.4,1.,-(splashBedHeight(bottom.xz+vec2(0,.2))-splashBedHeight(bottom.xz-vec2(0,.2)))/.4));
      vec3 albedo=sampleSandAlbedo(bottom.xz,bottom.y),extinction=vec3(.164,.044,.032),scattering=vec3(.004,.009,.014);
      vec3 sunWater=refract(-normalize(uSplashSun),waterNormal,1./1.333);
      float sunPath=depth/max(.05,-sunWater.y),sunCos=max(0.,dot(waterNormal,normalize(uSplashSun))),waterCos=max(.05,-dot(waterNormal,sunWater));
      vec3 solarEntry=bottom-sunWater*sunPath;
      float visibility=splashCloud(solarEntry)*treeSunVisibility(solarEntry);
      float concentration=texture2D(uCaustic,bottom.xz/(2.*uCausticExtent)+.5).r;
      float coverage=1.-smoothstep(uCausticExtent*.9,uCausticExtent*.99,max(abs(bottom.x),abs(bottom.z)));
      concentration=mix(1.,max(.05,concentration),coverage*smoothstep(.08,.4,-bottom.y)*(1.-smoothstep(1.5,5.,-bottom.y)));
      vec3 solarTransmission=exp(-extinction*sunPath)*(1.-splashDielectric(sunCos));
      float bedCos=max(0.,dot(bn,-sunWater))*sunCos/waterCos;
      vec3 bedDirect=albedo*uSplashSunColor*uSplashIrradiance*visibility*bedCos*concentration/3.14159265359;
      vec3 bedAmbient=albedo*(.70*uSkyColor*uIntensity)/3.14159265359;
      vec3 bed=bedDirect*solarTransmission+bedAmbient*exp(-extinction*depth*1.3)*(1.-splashDielectric(1.));
      vec3 transmission=exp(-extinction*path);
      vec3 volume=scattering/extinction*(1.-transmission)*(uSplashSunColor*uSplashIrradiance*visibility*solarTransmission*.079577+.11*uSkyColor*uIntensity*exp(-extinction*depth*.65));
      float F=splashDielectric(-incident);vec3 waterR=reflect(R,waterNormal);
      vec3 waterSky=splashSky(waterR)+uSplashSunColor*splashSolarRadiance(waterR);
      vec3 result=(bed*transmission+volume)*(1.-F)+waterSky*F;
      return hit?max(vec3(0.),result):sky;
    }
  `:/* glsl */`vec3 splashEnvironment(vec3 P,vec3 R){return splashSky(R)+uSplashSunColor*splashSolarRadiance(R);}`;
  const dropletVertex=/* glsl */`
    attribute vec3 aOffset,aVelocity;
    attribute float aRadius,aLife;
    uniform float uAge,uViewportHeight,uBaseHeight;
    uniform vec2 uOrigin;
    varying vec2 vDisc;
    varying vec3 vCenter;
    varying float vCoverage,vAlive;
    void main(){
      float age=max(uAge,0.);
      vec3 center=vec3(uOrigin.x,uBaseHeight,uOrigin.y)+aOffset+aVelocity*age+vec3(0.,-4.905*age*age,0.);
      vec4 eye=viewMatrix*vec4(center,1.);
      float metresPerPixel=2.*max(-eye.z,.02)/(max(projectionMatrix[1][1],.01)*max(uViewportHeight,1.));
      // Raster support only: opacity preserves the physical projected area.
      float radius=max(aRadius,metresPerPixel*.65);
      vCoverage=min(1.,aRadius*aRadius/(radius*radius));
      vAlive=step(0.,uAge)*(1.-smoothstep(aLife*.78,aLife,age));
      if(age>=aLife||eye.z>-.02)vAlive=0.;
      vDisc=position.xy;vCenter=center;
      eye.xy+=position.xy*radius;
      gl_Position=projectionMatrix*eye;
    }
  `;
  const dropletFragment=/* glsl */`
    ${lightGLSL}
    ${localEnvironmentGLSL}
    varying vec2 vDisc;
    varying vec3 vCenter;
    varying float vCoverage,vAlive;
    void main(){
      float r2=dot(vDisc,vDisc),aa=max(fwidth(r2),.002);
      float coverage=1.-smoothstep(1.-aa,1.+aa,r2);
      if(coverage*vCoverage*vAlive<.0002)discard;
      vec3 cameraRight=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
      vec3 cameraUp=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
      vec3 V=normalize(cameraPosition-vCenter);
      vec3 N=normalize(cameraRight*vDisc.x+cameraUp*vDisc.y+V*sqrt(max(0.,1.-r2)));
      float F=splashFresnel(dot(N,V));
      vec3 R=reflect(-V,N);
      vec3 color=splashEnvironment(vCenter,R);
      // Reflection-only transparent proxy: transmit the actual background
      // unchanged instead of replacing it with an unrelated sky direction.
      // This omits resolved droplet refraction/internal caustics, rather than
      // inventing an ambient/emissive visibility gain.
      float alpha=F*coverage*vCoverage*vAlive;
      gl_FragColor=vec4(color,clamp(alpha,0.,1.));
      #ifdef SCENE_REACTIVE_OUTPUT
        sceneReactiveMask=1.;
      #endif
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <premultiplied_alpha_fragment>
    }
  `;
  const crownVertex=/* glsl */`
    #define GEOMETRY_PASS
    ${waveGLSL}
    uniform float uAge,uScale,uSeed;
    uniform vec2 uOrigin;
    varying vec3 vWorld;
    varying vec2 vCrown;
    void main(){
      float t=clamp(uAge/.34,0.,1.),angle=uv.x*6.2831853;
      float radius=(.012+.088*(1.-exp(-t*4.)))*uScale;
      float fingers=.82+.12*sin(angle*13.+uSeed)+.06*sin(angle*19.-uSeed*.7);
      float rise=.082*sin(3.14159265*sqrt(t))*exp(-t*.75)*uScale;
      float rim=pow(uv.y,4.)*.007*sin(angle*13.+uSeed)*sin(3.14159265*t)*uScale;
      vec2 horizontal=uOrigin+vec2(cos(angle),sin(angle))*radius*(.85+.15*uv.y);
      vWorld=vec3(horizontal.x,surface(horizontal)+.001+rise*uv.y*fingers+rim,horizontal.y);
      vCrown=uv;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
    }
  `;
  const crownFragment=/* glsl */`
    ${lightGLSL}
    ${localEnvironmentGLSL}
    uniform float uAge,uSeed;
    varying vec3 vWorld;
    varying vec2 vCrown;
    void main(){
      float age=uAge/.34;
      float fade=smoothstep(0.,.045,age)*(1.-smoothstep(.55,1.,age));
      if(fade<=.001)discard;
      vec3 N=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
      vec3 V=normalize(cameraPosition-vWorld);if(dot(N,V)<0.)N=-N;
      float F=splashFresnel(dot(N,V));
      vec3 R=reflect(-V,N);
      vec3 color=splashEnvironment(vWorld,R);
      // Two parallel lossless air/water interfaces including their internal
      // reflection series: R_sheet=2F/(1+F), T_sheet=1-R_sheet.
      float sheetReflection=2.*F/(1.+F);
      float alpha=sheetReflection*fade*smoothstep(0.,.12,vCrown.y);
      gl_FragColor=vec4(color,clamp(alpha,0.,1.));
      #ifdef SCENE_REACTIVE_OUTPUT
        sceneReactiveMask=1.;
      #endif
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <premultiplied_alpha_fragment>
    }
  `;
  const crownGeometry=new THREE.PlaneGeometry(1,1,64,4);
  const quad=new THREE.BufferGeometry();
  quad.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));quad.setIndex([0,1,2,2,1,3]);
  function estimateHeight(x,z,time){
    if(sampleSurfaceHeight){const h=sampleSurfaceHeight(x,z,time);if(Number.isFinite(h))return h;}
    const offset=uniforms.uCurrentOffset?.value||{x:0,y:0},wind=uniforms.uWind?.value??1;
    let h=0;
    for(const w of waveComponents){
      const omega=Math.sqrt((9.81*w.k+.000070244*w.k**3)*Math.tanh(Math.min(w.k*3,4)));
      const filter=1-THREE.MathUtils.smoothstep(w.k,5,9);
      h+=filter*w.amplitude*(w.kind==='swell'?(uniforms.uSwell?.value??1):wind*(uniforms.uWindSea?.value??1))*Math.sin(((x-offset.x)*Math.cos(w.angle)+(z-offset.y)*Math.sin(w.angle))*w.k-omega*time+w.phase);
    }
    return h;
  }
  function remove(index){
    const event=events[index];root.remove(event.group);event.geometry.dispose();event.dropletMaterial.dispose();event.crownMaterial.dispose();events.splice(index,1);
  }
  function spawn(x,z,time=lastTime,strength=1,{stoneDiameter=.025,surfaceHeight=null}={}){
    if(!Number.isFinite(x+z+time+strength))return null;
    stoneDiameter=clamp(Number(stoneDiameter)||.025,.012,.045);
    while(events.length>=Math.max(1,maxEvents))remove(0);
    let seed=++serial*747796405;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    const scale=clamp(stoneDiameter/.025,.55,1.8)*Math.sqrt(clamp(strength,.2,1.6));
    const count=clamp(Math.round(dropletCount),24,160);
    const offsets=[],velocities=[],radii=[],lives=[];
    for(let i=0;i<count;i++){
      const angle=i*2.39996323+random()*.35,radial=.005+random()*.013*scale;
      const speed=(.22+random()*.66)*Math.sqrt(scale),up=(.75+random()*1.4)*Math.sqrt(scale);
      offsets.push(Math.cos(angle)*radial,.007+random()*.018,Math.sin(angle)*radial);
      velocities.push(Math.cos(angle)*speed,up,Math.sin(angle)*speed);
      // Default: mostly 0.4–2.4 mm diameter; sparse drops up to 4 mm.
      const diameter=(i%17===0?.0024+random()*.0016:.0004+Math.pow(random(),1.7)*.002)*scale;
      radii.push(diameter*.5);lives.push((up+Math.sqrt(up*up+2*9.81*.02))/9.81);
    }
    const geometry=new THREE.InstancedBufferGeometry();geometry.setIndex(quad.index.clone());geometry.setAttribute('position',quad.attributes.position.clone());geometry.instanceCount=count;
    geometry.setAttribute('aOffset',new THREE.InstancedBufferAttribute(new Float32Array(offsets),3));
    geometry.setAttribute('aVelocity',new THREE.InstancedBufferAttribute(new Float32Array(velocities),3));
    geometry.setAttribute('aRadius',new THREE.InstancedBufferAttribute(new Float32Array(radii),1));
    geometry.setAttribute('aLife',new THREE.InstancedBufferAttribute(new Float32Array(lives),1));
    const u={...shared,uOrigin:{value:new THREE.Vector2(x,z)},uAge:{value:0},uViewportHeight:{value:900},uScale:{value:scale},uSeed:{value:random()*8},uBaseHeight:{value:Number.isFinite(surfaceHeight)?surfaceHeight:estimateHeight(x,z,time)}};
    // Premultiplication preserves the same colour compositing but also lets
    // scalar MRT reactive1 survive: that output has no source alpha channel,
    // so straight SRC_ALPHA blending would erase it. Main target uses R8.
    const dropletMaterial=new THREE.ShaderMaterial({uniforms:u,vertexShader:dropletVertex,fragmentShader:dropletFragment,defines:hasGround?{BAKED_WAVE_TEXTURES:1}:{},transparent:true,premultipliedAlpha:true,depthWrite:false,depthTest:true});
    const crownMaterial=new THREE.ShaderMaterial({uniforms:u,vertexShader:crownVertex,fragmentShader:crownFragment,defines:{BAKED_WAVE_TEXTURES:1},transparent:true,premultipliedAlpha:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide});
    const group=new THREE.Group();group.name='25 mm stone splash';
    const drops=new THREE.Mesh(geometry,dropletMaterial),crown=new THREE.Mesh(crownGeometry,crownMaterial);
    drops.frustumCulled=crown.frustumCulled=false;drops.renderOrder=4;crown.renderOrder=3;
    drops.name='Millimetre spherical drop impostors';crown.name='Thin centimetre water crown';
    group.add(drops,crown);root.add(group);
    const event={id:serial,x,z,born:time,group,geometry,dropletMaterial,crownMaterial,uniforms:u,count,scale,radii,lives};events.push(event);
    return{id:serial,x,z,stoneDiameterMetres:stoneDiameter,maximumDropDiameterMetres:Math.max(...radii)*2,durationSeconds:Math.max(.34,...lives)};
  }
  return{
    spawn,root,
    configure({envMode:mode=envMode}={}){envMode=validateMode(mode);shared.uSplashEnvironmentMode.value=envMode==='local-water'?1:0;return{envMode,localWaterAvailable:hasGround,missingGround:[...missingGround],maximumUniqueSamplers:hasGround?12:6};},
    update(dt,time,camera,viewport=900){
      lastTime=time;const height=typeof viewport==='number'?viewport:viewport.height||viewport.viewportHeight||900;
      shared.uSplashHasSky.value=shared.uSplashSky.value?1:0;
      for(let i=events.length-1;i>=0;i--){
        const event=events[i],age=Math.max(0,time-event.born);
        if(age>Math.max(.34,...event.lives)+.08){remove(i);continue;}
        event.uniforms.uAge.value=age;event.uniforms.uViewportHeight.value=Math.max(1,height);
      }
    },
    clear(){while(events.length)remove(events.length-1);},
    get state(){return{active:events.length,maximumEvents:maxEvents,units:'metres/seconds',gravity:9.81,representation:'analytic spherical droplets + thin crown; not a fluid solve',environment:{mode:envMode,localWaterAvailable:hasGround,missingGround:[...missingGround],maximumUniqueSamplers:hasGround?12:6,limits:'Local tangent-plane water/bed only; no props, transient GI or resolved drop refraction'},events:events.map(e=>({id:e.id,x:e.x,z:e.z,age:Math.max(0,lastTime-e.born),dropCount:e.count,dropDiameterRangeMetres:[Math.min(...e.radii)*2,Math.max(...e.radii)*2],maximumCrownRadiusMetres:.1*e.scale,impactHeightEstimate:e.uniforms.uBaseHeight.value}))};},
    dispose(){while(events.length)remove(events.length-1);quad.dispose();crownGeometry.dispose();scene.remove(root);}
  };
}
