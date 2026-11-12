import { waveGLSL, waveComponents } from '../waves.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Bounded visual water-entry response. The actual surface impulse belongs to the
// app's shared wave/SWE system; this module neither adds it nor plays audio.
export function createSplash(THREE,{scene,uniforms={},sunDirection=null,maxEvents=4,dropletCount=96,sampleSurfaceHeight=null}={}){
  if(!scene)throw new Error('createSplash requires a scene');
  const events=[];let serial=0,lastTime=0;
  const shared={...uniforms};
  shared.uSplashSun=uniforms.uSun||{value:sunDirection||new THREE.Vector3(.4,.8,.3).normalize()};
  shared.uSplashSunColor=uniforms.uSunColor||{value:new THREE.Color(1,.97,.9)};
  shared.uSplashIrradiance=uniforms.uSunIrradiance||{value:3.6};
  shared.uSplashSky=uniforms.uSkyCube||{value:null};
  shared.uSplashHasSky={value:uniforms.uSkyCube?.value?1:0};
  const root=new THREE.Group();root.name='Metric stone-water splashes';scene.add(root);
  const lightGLSL=/* glsl */`
    uniform vec3 uSplashSun,uSplashSunColor;
    uniform float uSplashIrradiance,uSplashHasSky;
    uniform samplerCube uSplashSky;
    vec3 splashSky(vec3 d){
      vec3 result=mix(vec3(.22,.36,.43),vec3(.65,.82,.96),smoothstep(-.1,.6,d.y));
      if(uSplashHasSky>.5)result=max(vec3(0.),textureCube(uSplashSky,d).rgb);
      return result;
    }
    float splashFresnel(float cosine){
      return .02037+.97963*pow(1.-clamp(cosine,0.,1.),5.);
    }
  `;
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
      vec3 reflected=splashSky(reflect(-V,N));
      vec3 transmitted=splashSky(refract(-V,N,1./1.333));
      float sun=pow(max(dot(reflect(-normalize(uSplashSun),N),V),0.),950.);
      vec3 color=mix(transmitted*.78,reflected,F)+uSplashSunColor*(sun*uSplashIrradiance*2.5);
      float alpha=(.055+F*.70+sun*.32)*coverage*vCoverage*vAlive;
      gl_FragColor=vec4(color,clamp(alpha,0.,.9));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
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
      float sun=pow(max(dot(reflect(-normalize(uSplashSun),N),V),0.),340.);
      float rim=smoothstep(.72,1.,vCrown.y);
      vec3 color=splashSky(reflect(-V,N))*(.7+F*.6)+uSplashSunColor*sun*uSplashIrradiance*.65;
      float alpha=(.035+.30*F+.06*rim+sun*.18)*fade*smoothstep(0.,.12,vCrown.y);
      gl_FragColor=vec4(color,clamp(alpha,0.,.55));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
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
    const dropletMaterial=new THREE.ShaderMaterial({uniforms:u,vertexShader:dropletVertex,fragmentShader:dropletFragment,transparent:true,depthWrite:false,depthTest:true});
    const crownMaterial=new THREE.ShaderMaterial({uniforms:u,vertexShader:crownVertex,fragmentShader:crownFragment,defines:{BAKED_WAVE_TEXTURES:1},transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide});
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
    update(dt,time,camera,viewport=900){
      lastTime=time;const height=typeof viewport==='number'?viewport:viewport.height||viewport.viewportHeight||900;
      for(let i=events.length-1;i>=0;i--){
        const event=events[i],age=Math.max(0,time-event.born);
        if(age>Math.max(.34,...event.lives)+.08){remove(i);continue;}
        event.uniforms.uAge.value=age;event.uniforms.uViewportHeight.value=Math.max(1,height);
      }
    },
    clear(){while(events.length)remove(events.length-1);},
    get state(){return{active:events.length,maximumEvents:maxEvents,units:'metres/seconds',gravity:9.81,representation:'analytic spherical droplets + thin crown; not a fluid solve',events:events.map(e=>({id:e.id,x:e.x,z:e.z,age:Math.max(0,lastTime-e.born),dropCount:e.count,dropDiameterRangeMetres:[Math.min(...e.radii)*2,Math.max(...e.radii)*2],maximumCrownRadiusMetres:.1*e.scale,impactHeightEstimate:e.uniforms.uBaseHeight.value}))};},
    dispose(){while(events.length)remove(events.length-1);quad.dispose();crownGeometry.dispose();scene.remove(root);}
  };
}
