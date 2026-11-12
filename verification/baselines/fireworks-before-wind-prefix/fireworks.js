import {FIREWORK_TYPES,EMISSION_PROFILES,createFireworksSimulation,sampleBody,starEnvelope,clamp} from './fireworks-physics.js';
const rgbArray=v=>Array.isArray(v)?v:v?.toArray?v.toArray():[0,0,0];

// CPU budget for the actual camera-facing, pixel-integrated Gaussian shader.
// A spherical I/(pi*r*r) reference is NOT its off-axis radiance ceiling: the
// shader's sigma uses view depth while its pixel solid angle uses ray angle.
// This helper is also exercised against the real GPU shader by owned fixtures.
export function getFireworkSourceBound(p,camera,optics={},rawPerCandela=3.6e-5){
  const w=optics.width||1200,h=optics.height||900,V=camera.matrixWorldInverse.elements,P=camera.projectionMatrix.elements,E=camera.matrixWorld.elements;
  const project=(x,y,z)=>{const vx=V[0]*x+V[4]*y+V[8]*z+V[12],vy=V[1]*x+V[5]*y+V[9]*z+V[13],vz=V[2]*x+V[6]*y+V[10]*z+V[14],cw=P[3]*vx+P[7]*vy+P[11]*vz+P[15];return[(P[0]*vx+P[4]*vy+P[8]*vz+P[12])/Math.max(cw,1e-5)*w*.5,(P[1]*vx+P[5]*vy+P[9]*vz+P[13])/Math.max(cw,1e-5)*h*.5,cw];};
  const position=p.position,c=project(...position),depth=c[2];
  if(depth<=.01)return{peak:0,visible:false,nearPlaneFallback:false,rect:[0,0,0,0]}; // identical vertex cull
  const radius=p.radius,d=Math.max(radius,Math.hypot(position[0]-E[12],position[1]-E[13],position[2]-E[14])),ndcX=c[0]*2/w,ndcY=c[1]*2/h;
  const omega=4/(w*h*Math.abs(P[0]*P[5]))/(1+(ndcX/P[0])**2+(ndcY/P[5])**2)**1.5;
  const angular=radius*Math.abs(P[5])*h/(2*Math.max(depth,.001)),f=optics.focalMm??28,focus=Math.max(f+1,(optics.focusMetres??60)*1000);
  const coc=optics.dof?Math.abs(f*f*(depth*1000-focus)/((optics.aperture??8)*Math.max(depth*1000,f+1)*(focus-f)))/(optics.sensorHeightMm??24)*h*.5:0;
  const baseSigma2=.0784+angular*angular*.5+coc*coc*.25,I=(p.unmodulatedIntensity??p.intensity??0)*Math.max(...p.colour);
  // Any unit-area Gaussian's integral over one unit pixel is <=1 and <= its
  // peak density. Every spatial/time quadrature has nonnegative weights <=1.
  // Omit added shutter variance in this peak bound, conservatively.
  const peak=I*rawPerCandela/(d*d*omega)*Math.min(1,1/(2*Math.PI*baseSigma2));
  const velocity=p.velocity||[0,0,0],stretch=p.stretch||[0,0,0],shutter=optics.shutterSeconds??1/120;
  const a=project(...position.map((v,i)=>v+velocity[i]*shutter*.5)),b=project(...position.map((v,i)=>v-velocity[i]*shutter*.5));
  const M=[a[0]-b[0],a[1]-b[1]],trail=stretch.reduce((s,v)=>s+v*v,0)>1e-12;
  let motion=M,sigma2=baseSigma2,explicit=0,nearPlaneFallback=Math.min(a[2],b[2],depth)<=camera.near;
  if(trail){const sa=project(...position.map((v,i)=>v+stretch[i]*.5)),sb=project(...position.map((v,i)=>v-stretch[i]*.5));motion=[sa[0]-sb[0],sa[1]-sb[1]];nearPlaneFallback ||= Math.min(sa[2],sb[2])<=camera.near;if(Math.hypot(...M)<=1)sigma2+=(M[0]*M[0]+M[1]*M[1])/24;else explicit=1;}
  // Match the actual quad extent, including independent shutter/stretch;
  // a near-plane crossing has unbounded perspective derivatives, so assign
  // that source's peak to the whole viewport instead of a speed/depth guess.
  const extent=motion.map((v,i)=>3.65*Math.sqrt(sigma2)+Math.abs(v)*.5+Math.abs(M[i])*.5*explicit+.65+1);
  const cx=c[0]+w*.5,cy=c[1]+h*.5,rect=nearPlaneFallback?[0,0,w,h]:[cx-extent[0],cy-extent[1],cx+extent[0],cy+extent[1]];
  return{peak,visible:rect[2]>=0&&rect[0]<=w&&rect[3]>=0&&rect[1]<=h,rect,nearPlaneFallback,baseSigma2,omega,distance:d,depth,shutterPixels:M,stretchPixels:trail?motion:[0,0]};
}

// Independent finite effects layer. Never insert effectsScene into main scene:
// main lens invokes render() after its opaque air/DOF, before shared bloom.
export function createFireworks(THREE,{terrainHeight=()=>0,origin=[29,0,7],seed=14271}={}){
  const base=[...origin];base[1]=Math.max(base[1],terrainHeight(base[0],base[2]))+.04;
  const launchOrigin=[base[0],base[1]+.83,base[2]],simulation=createFireworksSimulation({origin:launchOrigin,seed});
  const rig=new THREE.Group();rig.name='Physical display launcher, metres';rig.position.fromArray(base);
  const steel=new THREE.MeshStandardMaterial({color:0x323c3d,metalness:.72,roughness:.48}),rubber=new THREE.MeshStandardMaterial({color:0x171d1d,roughness:.92});
  const plate=new THREE.Mesh(new THREE.BoxGeometry(.86,.09,.64),steel);plate.position.y=.045;plate.castShadow=plate.receiveShadow=true;rig.add(plate);
  for(const x of [-.3,.3])for(const z of [-.22,.22]){const foot=new THREE.Mesh(new THREE.CylinderGeometry(.07,.085,.10,12),rubber);foot.position.set(x,.02,z);foot.castShadow=true;rig.add(foot);}
  const aim=new THREE.Group();aim.position.y=.17;rig.add(aim);
  for(const x of [-.22,0,.22]){const tube=new THREE.Mesh(new THREE.CylinderGeometry(.064,.064,.68,16,1,true),steel);tube.position.set(x,.32,0);tube.castShadow=tube.receiveShadow=true;aim.add(tube);}
  const effectsScene=new THREE.Scene();effectsScene.name='Finite fireworks and smoke, no sky/environment capture';
  const dummy=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);dummy.needsUpdate=true;
  const capacity=14000,geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));geometry.setIndex([0,1,2,0,2,3]);
  const attributes={centre:3,velocity:3,stretch:3,colour:3,shape:4,smokeLight:3,temporal0:4,temporal1:4},arrays={};
  for(const [name,size]of Object.entries(attributes)){arrays[name]=new Float32Array(capacity*size);geometry.setAttribute('a'+name[0].toUpperCase()+name.slice(1),new THREE.InstancedBufferAttribute(arrays[name],size).setUsage(THREE.DynamicDrawUsage));}
  geometry.instanceCount=0;
  const uniforms={uViewProjection:{value:new THREE.Matrix4()},uProjection:{value:new THREE.Matrix4()},uEye:{value:new THREE.Vector3()},uSize:{value:new THREE.Vector2(1,1)},uDepth:{value:dummy},
    uStorageScale:{value:1},uRawPerCandela:{value:3.6e-5},uPlaneY:{value:0},uNear:{value:.1},uFar:{value:30000},
    uFocalMm:{value:28},uAperture:{value:8},uFocus:{value:60},uSensorHeightMm:{value:24},uDof:{value:0},uShutter:{value:1/120},uVignette:{value:0},
    uAirEnabled:{value:0},uBetaR:{value:new THREE.Vector3()},uBetaME:{value:new THREE.Vector3()},uBetaMS:{value:new THREE.Vector3()},uHeights:{value:new THREE.Vector2(8000,1200)},uG:{value:.76},uSunDirection:{value:new THREE.Vector3(0,1,0)},uRawSunRGB:{value:new THREE.Vector3()},
  };
  const vertex=/* glsl */`precision highp float;
    in vec3 position,aCentre,aVelocity,aStretch,aColour,aSmokeLight;in vec4 aShape,aTemporal0,aTemporal1;
    uniform mat4 uViewProjection,uProjection;uniform vec3 uEye;uniform vec2 uSize;
    uniform float uFocalMm,uAperture,uFocus,uSensorHeightMm,uDof,uShutter;
    out vec2 vOffset,vMotion;out vec3 vWorld,vColour,vSmokeLight,vTrailShutter;out vec4 vShape,vTemporal0,vTemporal1;out float vSigma,vOriginalSigma,vOmega,vDistance;
    vec2 projectPixels(vec3 p){vec4 c=uViewProjection*vec4(p,1.);return c.xy/max(c.w,1e-5)*uSize*.5;}
    void main(){
      vec4 clip=uViewProjection*vec4(aCentre,1.);float depth=max(clip.w,.001);vec2 ndc=clip.xy/depth;
      float pixelScale=abs(uProjection[1][1])*uSize.y*.5/depth,worldSigma=aShape.y*pixelScale*.70710678;
      float f=uFocalMm,s=depth*1000.,focus=max(f+1.,uFocus*1000.);
      float coc=abs(f*f*(s-focus)/(uAperture*max(s,f+1.)*(focus-f)))/uSensorHeightMm*uSize.y*.5*uDof;
      if(aShape.x>.5)worldSigma=aShape.y*pixelScale*.5;
      float sigma=sqrt(.0784+worldSigma*worldSigma+coc*coc*.25);
      vec2 shutter=projectPixels(aCentre+aVelocity*uShutter*.5)-projectPixels(aCentre-aVelocity*uShutter*.5);
      bool trail=dot(aStretch,aStretch)>1e-12;vec2 motion=shutter;float explicitShutter=0.;
      if(trail){
        motion=projectPixels(aCentre+aStretch*.5)-projectPixels(aCentre-aStretch*.5);
        // A uniform shutter segment has covariance m*mT/12. When its length
        // is at most1pixel use an isotropic trace-preserving approximation
        // (half its trace per axis), never subtract a spatial tail tangent.
        // Wider near-view shutter footprints use explicit3-point quadrature.
        if(length(shutter)<=1.)sigma=sqrt(sigma*sigma+dot(shutter,shutter)/24.);
        else explicitShutter=1.;
      }
      vec2 extent=3.65*vec2(sigma)+abs(motion)*.5+abs(shutter)*.5*explicitShutter+vec2(.65);
      clip.xy+=position.xy*extent*2./uSize*clip.w;gl_Position=clip;
      if(clip.w<=.01)gl_Position=vec4(3.,3.,3.,1.);
      vOffset=position.xy*extent;vMotion=motion;vTrailShutter=vec3(shutter,trail?(explicitShutter>.5?2.:1.):0.);vWorld=aCentre;vShape=aShape;vColour=aColour;vSmokeLight=aSmokeLight;vTemporal0=aTemporal0;vTemporal1=aTemporal1;vSigma=sigma;vOriginalSigma=max(.28,worldSigma);
      vec2 slope=ndc/vec2(uProjection[0][0],uProjection[1][1]);
      vOmega=4./(uSize.x*uSize.y*abs(uProjection[0][0]*uProjection[1][1]))/pow(1.+dot(slope,slope),1.5);
      vDistance=max(length(aCentre-uEye),aShape.y);
    }`;
  const fragment=/* glsl */`precision highp float;precision highp int;
    uniform vec3 uEye,uBetaR,uBetaME,uBetaMS,uSunDirection,uRawSunRGB;uniform vec2 uSize,uHeights;
    uniform float uStorageScale,uRawPerCandela,uPlaneY,uAirEnabled,uG,uVignette,uFocalMm,uSensorHeightMm;
    #ifndef REFLECTION_PASS
      uniform highp sampler2D uDepth;
    #endif
    in vec2 vOffset,vMotion;in vec3 vWorld,vColour,vSmokeLight,vTrailShutter;in vec4 vShape,vTemporal0,vTemporal1;in float vSigma,vOriginalSigma,vOmega,vDistance;
    out vec4 outColour;
    float erfApprox(float x){float s=sign(x);x=abs(x);float t=1./(1.+.3275911*x);return s*(1.-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x));}
    float integratedGaussian(vec2 p,float sigma){vec2 a=(p-vec2(.5))/(sigma*1.41421356237),b=(p+vec2(.5))/(sigma*1.41421356237);return max(0.,.25*(erfApprox(b.x)-erfApprox(a.x))*(erfApprox(b.y)-erfApprox(a.y)));}
    void finiteAir(vec3 start,vec3 endpoint,out vec3 T,out vec3 S){
      T=vec3(1.);S=vec3(0.);if(uAirEnabled<.5)return;
      vec3 ray=endpoint-start;float distance=length(ray);if(distance<1e-5)return;vec3 direction=ray/distance;
      float mu=clamp(dot(direction,uSunDirection),-1.,1.),phaseR=3./(16.*3.14159265359)*(1.+mu*mu),phaseM=(1.-uG*uG)/(12.56637061436*pow(max(1e-4,1.+uG*uG-2.*uG*mu),1.5));
      for(int i=0;i<4;i++){float a=float(i)/4.,b=float(i+1)/4.,ds=(b*b-a*a)*distance;vec3 p=start+direction*((a*a+b*b)*.5*distance);float h=max(0.,p.y);vec3 r=uBetaR*exp(-h/uHeights.x),m=uBetaMS*exp(-h/uHeights.y),extinction=r+uBetaME*exp(-h/uHeights.y);vec3 integral=(vec3(1.)-exp(-extinction*ds))/max(extinction,vec3(1e-12));integral=mix(integral,vec3(ds),lessThan(extinction*ds,vec3(1e-5)));S+=T*uRawSunRGB*(r*phaseR+m*phaseM)*integral;T*=exp(-extinction*ds);}
    }
    void main(){
      #ifndef REFLECTION_PASS
        float obstacle=textureLod(uDepth,gl_FragCoord.xy/uSize,0.).r;
        if(gl_FragCoord.z>obstacle+1e-6)discard;
      #endif
      vec3 origin=uEye;
      #ifdef REFLECTION_PASS
        float denominator=vWorld.y-uEye.y;
        if(abs(denominator)<1e-6)discard;
        float t=(uPlaneY-uEye.y)/denominator;if(t<0.||t>1.)discard;
        origin=mix(uEye,vWorld,t);
      #endif
      vec3 T,S;finiteAir(origin,vWorld,T,S);
      vec3 rgb;float alpha=0.;
      if(vShape.x<.5){
        float kernel=0.,meanEmission=(dot(vTemporal0,vec4(1.))+dot(vTemporal1,vec4(1.)))*.125;
        for(int i=0;i<8;i++){
          float t=(float(i)+.5)/8.-.5,weight=i<4?vTemporal0[i]:vTemporal1[i-4];vec2 q=vOffset-vMotion*t;
          if(vTrailShutter.z<.5)kernel+=integratedGaussian(q,vSigma)*weight*.125;
          else if(vTrailShutter.z<1.5)kernel+=integratedGaussian(q,vSigma)*meanEmission*.125;
          else{
            // Three-point Gauss-Legendre average of the independent shutter.
            // Spatial tail integration remains the same8samples/total flux.
            float b=integratedGaussian(q,vSigma)*(4./9.);
            b+=(integratedGaussian(q-vTrailShutter.xy*.38729833462,vSigma)+integratedGaussian(q+vTrailShutter.xy*.38729833462,vSigma))*(5./18.);
            kernel+=b*meanEmission*.125;
          }
        }
        rgb=T*vColour*(vShape.z*uRawPerCandela/max(vDistance*vDistance*vOmega,1e-12))*kernel;
      }else{float r2=dot(vOffset,vOffset)/(vSigma*vSigma);if(r2>13.4)discard;float tau=vShape.w*exp(-.5*r2)*vOriginalSigma*vOriginalSigma/(vSigma*vSigma);alpha=1.-exp(-tau);rgb=T*(vSmokeLight*alpha)+S*alpha;}
      // ONE / ONE_MINUS_SRC_ALPHA: source RGB already premultiplied; a pure
      // emitter alpha=0 must retain its energy and the sky behind it.
      vec2 sensor=(gl_FragCoord.xy/uSize-.5)*vec2(uSensorHeightMm*uSize.x/uSize.y,uSensorHeightMm);
      float cos4=pow(inversesqrt(1.+dot(sensor,sensor)/(uFocalMm*uFocalMm)),4.);
      float vignette=mix(1.,mix(1.,cos4,.30),uVignette);
      outColour=vec4(rgb*uStorageScale*vignette,alpha);
    }`;
  function material(reflection){return new THREE.RawShaderMaterial({name:reflection?'Finite reflected effects, water-hit air':'Finite direct effects, manual opaque depth',glslVersion:THREE.GLSL3,defines:reflection?{REFLECTION_PASS:1}:{},uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthTest:reflection,depthWrite:false,toneMapped:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor});}
  const mainMaterial=material(false),reflectionMaterial=material(true),mesh=new THREE.Mesh(geometry,mainMaterial);mesh.name='Depth-sorted finite particles, sparks, grey smoke';mesh.frustumCulled=false;effectsScene.add(mesh);
  let records=[],quality={trailSegments:10},disposed=false,lastRender={instances:0},warnings=[],boundCache=null,boundsCache=null,boundsKey='',clusterCache=null;
  const viewPosition=new THREE.Vector3(),projected=new THREE.Vector3();
  function updateRecords(){
    const now=simulation.time,timeline=simulation.windTimeline;records=simulation.particles().filter(p=>p.kind==='smoke');
    for(const event of simulation.active)for(const body of [...(event.rocket?[event.rocket]:[]),...event.heads]){
      const age=now-body.birth,life=body.life;if(age<0)continue;
      const rocket=body.kind==='rocket',fraction=(body.trail||rocket) ? .34 : 0;
      if(age<life+.02){const state=sampleBody(body,now,timeline),emission=rocket?(age<life?1:0):starEnvelope(body,age);if(state.position[1]>.03)records.push({...state,eventId:event.id,kind:'star',radius:body.radius,intensity:body.intensity*emission*(1-fraction),unmodulatedIntensity:body.intensity*(1-fraction),sourceBody:body,sourceAge:age,colour:body.colour,stretch:[0,0,0]});}
      if(!fraction)continue;
      const duration=event.type==='willow' ? .88 : event.type==='palm' ? .62 : rocket ? .50 : .35,segments=quality.trailSegments;
      let sum=0;for(let j=0;j<segments;j++)sum+=Math.exp(-((j+.5)/segments)*3.5);
      const tail=[];for(let j=0;j<segments;j++){
        const lag=(j+.5)/segments*duration,born=now-lag,a=born-body.birth;if(a<0||a>life)continue;
        const source=sampleBody(body,born,timeline),ember={birth:born,position:source.position,velocity:source.velocity.map(v=>v*.25),drag:1.35,gravity:9.81},state=sampleBody(ember,now,timeline);
        if(state.position[1]<.03)continue;
        const envelope=rocket?1:starEnvelope(body,a),weight=Math.exp(-lag/duration*3.5)/sum;
        tail.push({...state,eventId:event.id,kind:'star',radius:.0018,intensity:body.intensity*fraction*weight*envelope,unmodulatedIntensity:body.intensity*fraction*weight,sourceBody:body,sourceAge:a,colour:EMISSION_PROFILES.thermal,stretch:[0,0,0]});
      }
      for(let j=0;j<tail.length;j++){const one=tail[Math.max(0,j-1)].position,two=tail[Math.min(tail.length-1,j+1)].position,weight=j===0||j===tail.length-1?1:.5;tail[j].stretch=two.map((v,i)=>(v-one[i])*weight);records.push(tail[j]);}
    }
    boundCache=null;clusterCache=null;
  }
  function getLightClusters(){if(clusterCache)return clusterCache;return clusterCache=simulation.active.map(event=>{
    const heads=records.filter(p=>p.kind==='star'&&p.eventId===event.id);
    let I=0,centre=[0,0,0],rgb=[0,0,0];for(const p of heads){I+=p.intensity;for(let c=0;c<3;c++){centre[c]+=p.position[c]*p.intensity;rgb[c]+=p.colour[c]*p.intensity;}}
    if(I>1e-8){centre=centre.map(x=>x/I);rgb=rgb.map(x=>x/I);}else{centre=[...event.burstPosition];rgb=[1,1,1];}
    return{position:centre,color:rgb,colour:rgb,referenceCandela:I,intensity:I,radius:Math.max(2,Math.min(28,(simulation.time-event.burstTime)*8)),kind:'fireworks diffuse cluster',eventId:event.id,pathFlags:{diffuse:true,smoke:true,specular:false}};
  }).filter(l=>l.referenceCandela>1e-6).slice(0,2);}
  function smokeLighting(p,eye,air,rawPerCandela,clusters){
    const ambient=rgbArray(air?.ambientIrradianceRGB),sun=rgbArray(air?.rawSunRGB);
    const out=ambient.map((v,c)=>(v+sun[c]*.22)*p.colour[c]/(4*Math.PI));
    const view=p.position.map((v,i)=>eye[i]-v),viewLength=Math.hypot(...view);
    for(const l of clusters){const delta=l.position.map((v,i)=>v-p.position[i]),d2=Math.max(l.radius*l.radius,...[delta.reduce((s,v)=>s+v*v,0)]),length=Math.sqrt(d2),mu=delta.reduce((s,v,i)=>s+v*view[i],0)/Math.max(length*viewLength,1e-9),g=.32,phase=(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5);for(let c=0;c<3;c++)out[c]+=l.color[c]*l.referenceCandela*rawPerCandela/d2*phase*p.colour[c]*.72;}
    return out;
  }
  function fillRecords(camera,air,rawPerCandela,shutter){
    camera.updateMatrixWorld();const eye=camera.position.toArray(),ordered=records.map(p=>({p,z:viewPosition.fromArray(p.position).applyMatrix4(camera.matrixWorldInverse).z})).sort((a,b)=>a.z-b.z),clusters=getLightClusters();
    if(ordered.length>capacity)throw new Error('Finite effects instance capacity exceeded without deleting logical heads.');
    for(let i=0;i<ordered.length;i++){
      const p=ordered[i].p,smoke=p.kind==='smoke',light=smoke?smokeLighting(p,eye,air,rawPerCandela,clusters):[0,0,0];
      arrays.centre.set(p.position,i*3);arrays.velocity.set(p.velocity||[0,0,0],i*3);arrays.stretch.set(p.stretch||[0,0,0],i*3);arrays.colour.set(p.colour,i*3);arrays.smokeLight.set(light,i*3);arrays.shape.set([smoke?1:0,p.radius,p.unmodulatedIntensity??p.intensity??0,p.opticalDepth||0],i*4);
      for(let k=0;k<8;k++){const age=p.sourceAge+((k+.5)/8-.5)*shutter,body=p.sourceBody;const weight=!body?1:body.kind==='rocket'?(age>=0&&age<body.life?1:0):starEnvelope(body,age);arrays[k<4?'temporal0':'temporal1'][i*4+(k%4)]=weight;}
    }
    geometry.instanceCount=ordered.length;for(const name of Object.keys(attributes))geometry.getAttribute('a'+name[0].toUpperCase()+name.slice(1)).needsUpdate=true;
    return ordered.length;
  }
  const api={rig,effectsScene,types:FIREWORK_TYPES,
    configure(patch={}){if(patch.automaticDirection!==undefined)patch={...patch,autoDirection:patch.automaticDirection};const state=simulation.configure(patch),az=state.autoDirection?Math.atan2(base[0],-base[2]):state.azimuth*Math.PI/180,axis=new THREE.Vector3(Math.sin(az)*Math.cos(state.elevation*Math.PI/180),Math.sin(state.elevation*Math.PI/180),-Math.cos(az)*Math.cos(state.elevation*Math.PI/180));aim.rotation.set(0,0,0);aim.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);launchOrigin[0]=base[0]+axis.x*.66;launchOrigin[1]=base[1]+.17+axis.y*.66;launchOrigin[2]=base[2]+axis.z*.66;return state;},
    launch(options){const result=simulation.launch(options);updateRecords();return result;},stop(){simulation.stop();},
    update({time,dt,windVector}={}){simulation.update({time,windVector});updateRecords();},
    drainEvents:()=>simulation.drainEvents(),
    getBounds(){
      if(!simulation.active.length)return{centre:[...base],center:[...base],radius:2,min:base.map(x=>x-1),max:base.map(x=>x+1),active:false};
      const wind=simulation.windTimeline.at(-1).wind,key=Math.floor(simulation.time*2)+'|'+simulation.active.map(e=>e.id).join(',')+'|'+wind.join(',');if(key===boundsKey)return boundsCache;
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],include=(p,pad=8)=>{for(let c=0;c<3;c++){min[c]=Math.min(min[c],p[c]-pad);max[c]=Math.max(max[c],p[c]+pad);}};
      for(const e of simulation.active){include(e.origin,2);for(const b of [...(e.rocket?[e.rocket]:[]),...e.heads])for(let j=0;j<=16;j++){const p=sampleBody(b,b.birth+b.life*j/16,simulation.windTimeline).position;if(p[1]>0)include(p);}
        include(e.burstPosition,18);include(e.burstPosition.map((v,c)=>v+wind[c]*9.8+(c===1?5:0)),18);
      }
      min[1]=Math.max(0,min[1]);boundsKey=key;const centre=min.map((v,c)=>(v+max[c])*.5);return boundsCache={min,max,centre,center:centre,radius:Math.hypot(...max.map((v,c)=>(v-min[c])*.5)),active:true,predicted:true,model:'16-point analytic trajectory forecast at current wind +8m margin; 2Hz cache; smoke envelope'};
    },
    getLightClusters,
    getRadianceBound({camera,optics={},rawPerCandela=3.6e-5}={}){
      if(!camera)return{maximumRawRadiance:records.reduce((s,p)=>s+(p.unmodulatedIntensity??p.intensity??0)*Math.max(...p.colour)/Math.max(Math.PI*p.radius*p.radius,1e-8)*rawPerCandela*1.02,0),method:'authored spherical surface reference only; projected Gaussian budget requires camera',conservative:false,requiresCamera:true};
      camera.updateMatrixWorld();const w=optics.width||1200,h=optics.height||900,bins=new Float64Array(32*32);let global=0,maxChannel=0,visible=0,nearFallback=0;
      for(const p of records){if(p.kind==='smoke')continue;global+=(p.unmodulatedIntensity??p.intensity)*Math.max(...p.colour)/(Math.PI*p.radius*p.radius)*1.02*rawPerCandela;maxChannel=Math.max(maxChannel,...p.colour);const bound=getFireworkSourceBound(p,camera,optics,rawPerCandela);if(!bound.visible)continue;visible++;nearFallback+=Number(bound.nearPlaneFallback);
        const r=bound.rect,x0=Math.max(0,Math.floor(r[0]/w*32)),x1=Math.min(31,Math.floor(r[2]/w*32)),y0=Math.max(0,Math.floor(r[1]/h*32)),y1=Math.min(31,Math.floor(r[3]/h*32));
        for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++)bins[yy*32+xx]+=bound.peak;
      }
      // Smoke and rapidly illuminated receivers are separately budgeted by
      // root from the same physical clusters. This bound describes sources.
      const clusters=getLightClusters(),smokeBound=clusters.reduce((sum,l)=>sum+Math.max(...l.color)*l.referenceCandela*rawPerCandela/(l.radius*l.radius)*.24,0)*Math.min(1,records.filter(p=>p.kind==='smoke').reduce((sum,p)=>sum+p.opticalDepth,0));
      const peak=Math.max(0,...bins)*1.2+smokeBound;return boundCache={maximumRawRadiance:peak,maxRawRadiance:peak,globalFiniteSurfaceCeiling:global,globalReferenceOnly:true,ownSmokeRawBound:smokeBound,maximumEmissionRGBChannel:maxChannel,visibleSources:visible,nearPlaneFallbackSources:nearFallback,method:'32x32 conservative source overlap bins; actual pixel-integrated Gaussian peak and projected shutter/stretch extent; near crossings cover viewport; legacy globalFiniteSurfaceCeiling is a spherical reference only; root separately budgets ambient/air/receivers',conservative:true};
    },
    render({renderer,target,camera,opaqueDepth=null,reflection=false,planeY=0,frame={},optics={},air={}}={}){
      if(disposed||!records.length)return;
      const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),autoClear=renderer.autoClear,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
      const width=target?.width||optics.width||1,height=target?.height||optics.height||1;
      const scale=frame.sceneScale??2**(frame.storageEV||0),rawPerCandela=frame.rawPerCandela??3.6e-5;
      camera.updateMatrixWorld();uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);uniforms.uProjection.value.copy(camera.projectionMatrix);uniforms.uEye.value.setFromMatrixPosition(camera.matrixWorld);uniforms.uSize.value.set(width,height);
      uniforms.uDepth.value=reflection?dummy:opaqueDepth||dummy;uniforms.uPlaneY.value=planeY;uniforms.uStorageScale.value=scale;uniforms.uRawPerCandela.value=rawPerCandela;
      uniforms.uFocalMm.value=optics.focalMm??28;uniforms.uAperture.value=optics.aperture??8;uniforms.uFocus.value=optics.focusMetres??60;uniforms.uSensorHeightMm.value=optics.sensorHeightMm??24;uniforms.uDof.value=!reflection&&optics.dof?1:0;uniforms.uShutter.value=reflection?0:(optics.shutterSeconds??1/120);uniforms.uVignette.value=!reflection&&optics.vignette?1:0;
      uniforms.uAirEnabled.value=air.enabled?1:0;for(const [name,field]of [['uBetaR','betaRayleighRGB'],['uBetaME','betaMieExtinctionRGB'],['uBetaMS','betaMieScatteringRGB'],['uSunDirection','sunDirection'],['uRawSunRGB','rawSunRGB']])uniforms[name].value.fromArray(rgbArray(air[field]));
      uniforms.uHeights.value.set(air.rayleighHeight||8000,air.aerosolHeight||1200);uniforms.uG.value=air.asymmetry??.76;
      const count=fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value);mesh.material=reflection?reflectionMaterial:mainMaterial;
      try{renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(target);renderer.render(effectsScene,camera);lastRender={instances:count,reflection,storageEV:frame.storageEV??Math.log2(scale),rawPerCandela,width,height};}
      finally{renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;renderer.setRenderTarget(previous,face,mip);}
    },
    setQuality(patch={}){quality.trailSegments=clamp(Math.round(patch.trailSegments??quality.trailSegments),6,16);updateRecords();return{...quality};},
    diagnostics(){return{...simulation.state,records:records.length,lastRender,quality:{...quality},radianceBound:boundCache,warnings:[...warnings],units:'reference cd + approximate emission RGB, linear scene reference once *2^storageEV; not measured pyrotechnic photometry',renderer:'independent instanced premult effects, four-segment finite air; water-hit reflection origin; sorted short segments',tailIntegration:{spatialSamples:8,shutter:'<=1px: trace-preserving isotropic variance; >1px:3-point independent quadrature',kernelEvaluations:'8 normal /24 large-shutter tail; heads unchanged',extraPasses:0},limits:['linear drag/burn model; no chemical or shock/fluid solve','grey smoke thin sprites; centre-depth sorting and shared near-air visibility approximation','resolved opaque depth/defocus occlusion approximation; root owns one shared bloom/vignette','subpixel tail shutter variance is a bounded angular approximation, not exact time-space convolution','star/cross-spectrum RGB is approximate CIE fit + authored bands and gamut compression']};},
    dispose(){disposed=true;geometry.dispose();mainMaterial.dispose();reflectionMaterial.dispose();dummy.dispose();rig.traverse(o=>o.geometry?.dispose());steel.dispose();rubber.dispose();},
  };
  api.configure({});return api;
}
