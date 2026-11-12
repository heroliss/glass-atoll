import {FIREWORK_TYPES,EMISSION_PROFILES,createFireworksSimulation,sampleBody,bodyEmissionEnvelope,clamp} from './fireworks-physics.js';

// Authored detached-ember chromaticity experiment at fixed photopic Y. This is
// not a fuel/radiant-power/heat-transfer solve; head colour and intensity law stay.
export const THERMAL_TAIL_COLOUR_PROFILE=Object.freeze({schema:'glass-atoll.thermal-tail-colour.v1',hotKelvin:2850,coldKelvin:1900,samples:129,wavelengthStepNm:5,age:'detached ember lag / existing tail duration',luminance:'linear sRGB photopic Y=1; reference candela unchanged',limits:'authored colour curve, not measured particle temperatures, spectral emissivity or combustion/heat transfer'});
let thermalTailColourTable;
function thermalColourAtKelvin(temperature){
  const xyz=[0,0,0],e=(w,a,b,c)=>Math.exp(-.5*((w-a)*(w<a?b:c))**2);
  for(let w=380;w<=780;w+=5){const l=w*1e-9,s=1/(l**5*Math.expm1(.01438776877/(l*temperature)))*1e-29;
    const cmf=[.362*e(w,442,.0624,.0374)+1.056*e(w,599.8,.0264,.0323)-.065*e(w,501.1,.049,.0382),.821*e(w,568.8,.0213,.0247)+.286*e(w,530.9,.0613,.0322),1.217*e(w,437,.0845,.0278)+.681*e(w,459,.0385,.0725)];
    for(let c=0;c<3;c++)xyz[c]+=s*cmf[c]*5;
  }
  let rgb=[3.24096994*xyz[0]-1.53738318*xyz[1]-.49861076*xyz[2],-.96924364*xyz[0]+1.8759675*xyz[1]+.04155506*xyz[2],.05563008*xyz[0]-.20397696*xyz[1]+1.05697151*xyz[2]];
  const neutral=Math.max(0,-Math.min(...rgb));rgb=rgb.map(v=>v+neutral);const Y=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  return Object.freeze(rgb.map(v=>v/Y));
}
export function thermalTailColour(lag,duration){
  if(!Number.isFinite(lag)||!Number.isFinite(duration)||duration<=0||lag<0||lag>duration)throw new RangeError('Detached thermal tail requires finite lag in [0,duration] and positive duration');
  if(lag===0)return EMISSION_PROFILES.thermal;
  if(!thermalTailColourTable)thermalTailColourTable=Object.freeze(Array.from({length:THERMAL_TAIL_COLOUR_PROFILE.samples},(_,i)=>i===0?EMISSION_PROFILES.thermal:thermalColourAtKelvin(2850-950*i/(THERMAL_TAIL_COLOUR_PROFILE.samples-1))));
  const x=lag/duration*(thermalTailColourTable.length-1),i=Math.min(thermalTailColourTable.length-2,Math.floor(x)),f=x-i,a=thermalTailColourTable[i],b=thermalTailColourTable[i+1];
  return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
}

// Optional logical metadata builder; only describeCombustion invokes it.
export function describeFireworkCombustion(event){
  const frozen=Object.freeze;
  const finite=(value,name)=>{if(!Number.isFinite(value))throw new RangeError('Combustion metadata requires finite '+name);return value;};
  const unknownMatter=category=>frozen({matterWeightCategory:category,relativeWeight:null,weightStatus:'unknown',fuel:'unknown',smokeYield:'unknown',absoluteMassKg:null});
  if(!event||typeof event.id!=='string'||!event.id||!Array.isArray(event.heads)||!Array.isArray(event.events))throw new TypeError('An active physical firework event is required');
  const id=event.id,ground=!!event.definition?.ground,prefix=id+'/combustion',nodes=[],edges=[],bySource=new Map(),byBody=new Map();
  const launchTime=finite(event.time,'launch time'),burstTime=finite(event.burstTime,'burst time'),endTime=finite(event.endTime,'event end');
  function append({sourceID,parentSourceID=null,edgeKind=null,...data}){
    if(bySource.has(sourceID))throw new RangeError('Combustion source IDs must be unique');
    const parent=parentSourceID===null?null:bySource.get(parentSourceID);
    if(parentSourceID!==null&&!parent)throw new RangeError('Combustion ancestry must be topologically ordered');
    const birth=finite(data.birth,'birth'),life=finite(data.life,'life');if(life<0||!Number.isFinite(birth+life))throw new RangeError('Combustion lifetime is invalid');
    if(parent&&birth<parent.birth)throw new RangeError('Combustion child predates its parent');
    const node=frozen({sourceID,eventId:id,parentSourceID,ancestry:frozen(parent?[...parent.ancestry,parent.sourceID]:[]),...data,birth,life,endTime:birth+life});
    nodes.push(node);bySource.set(sourceID,node);if(parent)edges.push(frozen({from:parent.sourceID,to:sourceID,kind:edgeKind}));return node;
  }
  const lifts=event.events.filter(e=>e.kind==='launch').map((e,i)=>append({sourceID:prefix+'/lift/'+i,role:'lift',birth:e.time,life:0,lifetimeMeaning:'instant-trigger-only; physical charge burn duration unknown',bodyId:null,parentBodyId:null,familyID:prefix+'/lift/'+i,sourceEventKind:'launch',sourceEventSeed:e.seed,combustion:'charge-trigger; yield unknown',matter:unknownMatter('lift-charge-yield-unknown')}));
  if(!lifts.length)throw new RangeError('Combustion event has no launch trigger');
  let ignition;
  if(!ground){
    if(!event.rocket)throw new RangeError('Aerial combustion metadata requires its mortar carrier');
    const carrier=append({sourceID:prefix+'/carrier',parentSourceID:lifts[0].sourceID,edgeKind:'launches-carrier',role:'mortar-carrier',birth:event.rocket.birth,life:event.rocket.life,lifetimeMeaning:'kinematic-flight-only; not engine burn duration',bodyId:null,parentBodyId:null,familyID:prefix+'/carrier',combustion:'not-established; no engine/fuel material metadata; authored through-burst-v1 attached ascent-light proxy; ballistic carrier has no sustained propulsion',matter:unknownMatter('carrier-not-an-engine-source')});
    const bursts=event.events.filter(e=>e.kind==='burst');if(bursts.length!==1)throw new RangeError('Aerial combustion metadata requires one burst trigger');
    ignition=append({sourceID:prefix+'/burst',parentSourceID:carrier.sourceID,edgeKind:'reaches-burst-trigger',role:'burst',birth:bursts[0].time,life:0,lifetimeMeaning:'instant-trigger-only; physical charge burn duration unknown',bodyId:null,parentBodyId:null,familyID:prefix+'/burst',sourceEventKind:'burst',sourceEventSeed:bursts[0].seed,combustion:'charge-trigger; yield unknown',matter:unknownMatter('burst-charge-yield-unknown')});
  }
  for(const body of event.heads){
    if(!Number.isSafeInteger(body.id)||body.id<0||byBody.has(body.id))throw new RangeError('Combustion body IDs must be unique nonnegative integers');
    const parent=body.parentBody?byBody.get(body.parentBody.id):null;
    if(body.parentBody&&(!parent||body.parent!==body.parentBody.id))throw new RangeError('Combustion split parent is missing or inconsistent');
    const trigger=parent||ignition||(event.type==='fan'?lifts.find(n=>n.birth===body.birth):lifts[0]);
    if(!trigger)throw new RangeError('Ground combustion body has no matching launch trigger');
    const sourceID=prefix+'/body/'+body.id,role=ground?'ground-comet':parent?'aerial-child':'aerial-root';
    const node=append({sourceID,parentSourceID:trigger.sourceID,edgeKind:parent?'split-child':'ignites-body',role,bodyId:body.id,parentBodyId:body.parentBody?.id??null,birth:body.birth,life:body.life,lifetimeMeaning:'authored physical body burn life; independent of image/strobe/trail samples',familyID:parent?parent.familyID:prefix+'/family/'+body.id,patternPart:body.patternPart??null,combustion:'declared-burning-body',matter:unknownMatter(parent?'inherited-family-share-unknown':body.split?'split-parent-family-share-unknown':ground?'ground-comet-share-unknown':'aerial-root-share-unknown')});
    byBody.set(body.id,node);
  }
  const roles=frozen(Object.fromEntries(['lift','mortar-carrier','burst','aerial-root','aerial-child','ground-comet'].map(role=>[role,nodes.filter(n=>n.role===role).length])));
  return frozen({schema:'glass-atoll.combustion-metadata.v1',id,type:event.type,seed:event.seed,ground,launchTime,burstTime,endTime,nodes:frozen(nodes),edges:frozen(edges),counts:frozen({nodes:nodes.length,edges:edges.length,bodies:byBody.size,roles}),sourcePolicy:'Physical logical bodies and charge triggers only; tails/shutter/mirror are not additional matter sources',positionPolicy:'Metadata may name future births; no world position, velocity, or future wind is provided. Existing causal provider.sample remains unchanged.',matterPolicy:'All fuel/yield/weights unknown; no absolute kg or smoke budget assigned; split family labels do not allocate parent/child material'});
}

const rgbArray=v=>Array.isArray(v)?v:v?.toArray?v.toArray():[0,0,0];

// CPU budget for the actual camera-facing, pixel-integrated Gaussian shader.
// A spherical I/(pi*r*r) reference is NOT its off-axis radiance ceiling: the
// shader's sigma uses view depth while its pixel solid angle uses ray angle.
// This helper is also exercised against the real GPU shader by owned fixtures.
const boundZero=[0,0,0];
const maximumRGB=rgb=>rgb.length===3?Math.max(rgb[0],rgb[1],rgb[2]):Math.max(...rgb);
// The actual quad expands only clip.xy, so its four vertices share centre z/w.
// Budget rejection uses the same Float32 centre and combined P*V upload. A
// gamma7 dot-product interval retains the old bound at uncertain clip edges.
const fireworkClipGamma7=(7*2**-24)/(1-7*2**-24),fireworkClipFTZ=8*2**-126,fireworkClipMax=3.4028234663852886e38/8;
function prepareFireworkDepthClip(c){
  const M=c.gpuClipVP||(c.gpuClipVP=new Float32Array(16)),P=c.P,V=c.V;let finite=true;
  for(let col=0;col<4;col++)for(let row=0;row<4;row++){const i=col*4;M[i+row]=P[row]*V[i]+P[row+4]*V[i+1]+P[row+8]*V[i+2]+P[row+12]*V[i+3];finite&&=Number.isFinite(M[i+row]);}
  c.gpuClipFinite=finite;
}
function fireworkCentreDepthClipped(position,c){
  if(!c.gpuClipFinite)return false;const M=c.gpuClipVP,x=Math.fround(position[0]),y=Math.fround(position[1]),z=Math.fround(position[2]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return false;
  const za=M[2]*x,zb=M[6]*y,zc=M[10]*z,zd=M[14],wa=M[3]*x,wb=M[7]*y,wc=M[11]*z,wd=M[15],Z=za+zb+zc+zd,W=wa+wb+wc+wd,az=Math.abs(za)+Math.abs(zb)+Math.abs(zc)+Math.abs(zd),aw=Math.abs(wa)+Math.abs(wb)+Math.abs(wc)+Math.abs(wd);
  // Extreme public/world inputs could overflow an actual Float32 multiply;
  // retain the original budget instead of reasoning from finite binary64.
  if(az>fireworkClipMax||aw>fireworkClipMax)return false;
  const ez=fireworkClipGamma7*az+fireworkClipFTZ,ew=fireworkClipGamma7*aw+fireworkClipFTZ;
  return W+ew<=Math.fround(.01)||Z-ez>W+ew||(Z+ez)+(W+ew)<0;
}
function prepareSourceProjection(camera,optics,rawPerCandela,c={scratch:new Float64Array(3)}){
  c.w=optics.width||1200;c.h=optics.height||900;c.V=camera.matrixWorldInverse.elements;c.P=camera.projectionMatrix.elements;c.E=camera.matrixWorld.elements;
  c.near=camera.near;c.raw=rawPerCandela;c.absP5=Math.abs(c.P[5]);c.omegaBase=4/(c.w*c.h*Math.abs(c.P[0]*c.P[5]));
  c.focal=optics.focalMm??28;c.focus=Math.max(c.focal+1,(optics.focusMetres??60)*1000);c.aperture=optics.aperture??8;c.sensor=optics.sensorHeightMm??24;
  c.dof=optics.dof;c.shutter=optics.shutterSeconds??1/120;return c;
}
function projectSourcePoint(x,y,z,c){
  const V=c.V,P=c.P,vx=V[0]*x+V[4]*y+V[8]*z+V[12],vy=V[1]*x+V[5]*y+V[9]*z+V[13],vz=V[2]*x+V[6]*y+V[10]*z+V[14];
  const cw=P[3]*vx+P[7]*vy+P[11]*vz+P[15],denominator=Math.max(cw,1e-5),out=c.scratch;
  // Preserve the old dot-product/order rather than reassociate P*V or use a
  // speed/depth approximation for projected shutter/stretch endpoints.
  out[0]=(P[0]*vx+P[4]*vy+P[8]*vz+P[12])/denominator*c.w*.5;
  out[1]=(P[1]*vx+P[5]*vy+P[9]*vz+P[13])/denominator*c.h*.5;out[2]=cw;
}
function sourceBoundOutput(){return{peak:0,visible:false,rect:[0,0,0,0],nearPlaneFallback:false,baseSigma2:0,omega:0,distance:0,depth:0,shutterPixels:[0,0],stretchPixels:[0,0]};}
function writeSourceBound(p,c,out,maximumColour=maximumRGB(p.colour)){
  const position=p.position,x=position[0],y=position[1],z=position[2],q=c.scratch;
  projectSourcePoint(x,y,z,c);const centreX=q[0],centreY=q[1],depth=q[2],rect=out.rect;
  if(depth<=.01){out.peak=0;out.visible=false;out.nearPlaneFallback=false;rect.fill(0);return false;}
  const P=c.P,E=c.E,w=c.w,h=c.h,radius=p.radius,d=Math.max(radius,Math.hypot(x-E[12],y-E[13],z-E[14])),ndcX=centreX*2/w,ndcY=centreY*2/h;
  const omega=c.omegaBase/(1+(ndcX/P[0])**2+(ndcY/P[5])**2)**1.5;
  const angular=radius*c.absP5*h/(2*Math.max(depth,.001)),f=c.focal,focus=c.focus;
  const coc=c.dof?Math.abs(f*f*(depth*1000-focus)/(c.aperture*Math.max(depth*1000,f+1)*(focus-f)))/c.sensor*h*.5:0;
  const baseSigma2=.0784+angular*angular*.5+coc*coc*.25,I=(p.unmodulatedIntensity??p.intensity??0)*maximumColour;
  out.peak=I*c.raw/(d*d*omega)*Math.min(1,1/(2*Math.PI*baseSigma2));
  const velocity=p.velocity||boundZero,stretch=p.stretch||boundZero,shutter=c.shutter;
  // Array.map on Float32Array used to round endpoints to Float32. Preserve
  // this public-input case while production world positions remain Float64.
  const float32=position instanceof Float32Array;
  let ax=x+velocity[0]*shutter*.5,ay=y+velocity[1]*shutter*.5,az=z+velocity[2]*shutter*.5;
  if(float32){ax=Math.fround(ax);ay=Math.fround(ay);az=Math.fround(az);}projectSourcePoint(ax,ay,az,c);
  const aX=q[0],aY=q[1],aDepth=q[2];
  let bx=x-velocity[0]*shutter*.5,by=y-velocity[1]*shutter*.5,bz=z-velocity[2]*shutter*.5;
  if(float32){bx=Math.fround(bx);by=Math.fround(by);bz=Math.fround(bz);}projectSourcePoint(bx,by,bz,c);
  const mx=aX-q[0],my=aY-q[1];let motionX=mx,motionY=my,sigma2=baseSigma2,explicit=0,nearPlaneFallback=Math.min(aDepth,q[2],depth)<=c.near;
  let stretch2=0;for(let i=0;i<stretch.length;i++)stretch2+=stretch[i]*stretch[i];const trail=stretch2>1e-12;
  if(trail){
    ax=x+stretch[0]*.5;ay=y+stretch[1]*.5;az=z+stretch[2]*.5;
    if(float32){ax=Math.fround(ax);ay=Math.fround(ay);az=Math.fround(az);}projectSourcePoint(ax,ay,az,c);
    const saX=q[0],saY=q[1],saDepth=q[2];
    bx=x-stretch[0]*.5;by=y-stretch[1]*.5;bz=z-stretch[2]*.5;
    if(float32){bx=Math.fround(bx);by=Math.fround(by);bz=Math.fround(bz);}projectSourcePoint(bx,by,bz,c);
    motionX=saX-q[0];motionY=saY-q[1];nearPlaneFallback ||= Math.min(saDepth,q[2])<=c.near;
    if(Math.hypot(mx,my)<=1)sigma2+=(mx*mx+my*my)/24;else explicit=1;
  }
  const spread=3.65*Math.sqrt(sigma2),extentX=spread+Math.abs(motionX)*.5+Math.abs(mx)*.5*explicit+.65+1,extentY=spread+Math.abs(motionY)*.5+Math.abs(my)*.5*explicit+.65+1;
  const cx=centreX+w*.5,cy=centreY+h*.5;
  if(nearPlaneFallback){rect[0]=0;rect[1]=0;rect[2]=w;rect[3]=h;}
  else{rect[0]=cx-extentX;rect[1]=cy-extentY;rect[2]=cx+extentX;rect[3]=cy+extentY;}
  out.visible=rect[2]>=0&&rect[0]<=w&&rect[3]>=0&&rect[1]<=h;out.nearPlaneFallback=nearPlaneFallback;out.baseSigma2=baseSigma2;out.omega=omega;out.distance=d;out.depth=depth;
  out.shutterPixels[0]=mx;out.shutterPixels[1]=my;out.stretchPixels[0]=trail?motionX:0;out.stretchPixels[1]=trail?motionY:0;return true;
}
export function getFireworkSourceBound(p,camera,optics={},rawPerCandela=3.6e-5){
  const out=sourceBoundOutput();if(!writeSourceBound(p,prepareSourceProjection(camera,optics,rawPerCandela),out))return{peak:0,visible:false,nearPlaneFallback:false,rect:out.rect};
  return out;
}

// Independent finite effects layer. Never insert effectsScene into main scene:
// main lens invokes render() after its opaque air/DOF, before shared bloom.
export function createFireworks(THREE,{terrainHeight=()=>0,origin=[29,0,7],seed=14271,clusterModel='legacy',trailIntegration='legacy8',tailColourMode='constant'}={}){
  const validateClusterModel=value=>{if(value!=='legacy'&&value!=='moments')throw new RangeError("clusterModel must be 'legacy' or 'moments'");return value;};
  const validateTrailIntegration=value=>{if(value!=='legacy8'&&value!=='adaptive')throw new RangeError("trailIntegration must be 'legacy8' or 'adaptive'");return value;};
  trailIntegration=validateTrailIntegration(trailIntegration);
  const validateTailColourMode=value=>{if(value!=='constant'&&value!=='cooling')throw new RangeError("tailColourMode must be 'constant' or 'cooling'");return value;};
  tailColourMode=validateTailColourMode(tailColourMode);let tailColourModeRequested=tailColourMode!=='constant';
  clusterModel=validateClusterModel(clusterModel);
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
    uTrailAdaptive:{value:trailIntegration==='adaptive'?1:0},uStorageScale:{value:1},uRawPerCandela:{value:3.6e-5},uPlaneY:{value:0},uNear:{value:.1},uFar:{value:30000},
    uFocalMm:{value:28},uAperture:{value:8},uFocus:{value:60},uSensorHeightMm:{value:24},uDof:{value:0},uShutter:{value:1/120},uVignette:{value:0},
    uAirEnabled:{value:0},uBetaR:{value:new THREE.Vector3()},uBetaME:{value:new THREE.Vector3()},uBetaMS:{value:new THREE.Vector3()},uHeights:{value:new THREE.Vector2(8000,1200)},uG:{value:.76},uSunDirection:{value:new THREE.Vector3(0,1,0)},uRawSunRGB:{value:new THREE.Vector3()},
  };
  const vertex=/* glsl */`precision highp float;
    in vec3 position,aCentre,aVelocity,aStretch,aColour,aSmokeLight;in vec4 aShape,aTemporal0,aTemporal1;
    uniform mat4 uViewProjection,uProjection;uniform vec3 uEye;uniform vec2 uSize;
    uniform float uFocalMm,uAperture,uFocus,uSensorHeightMm,uDof,uShutter,uTrailAdaptive;
    flat out vec4 vTrailSampling;flat out vec2 vTrailCentre;out vec2 vOffset,vMotion;out vec3 vWorld,vColour,vSmokeLight,vTrailShutter;out vec4 vShape,vTemporal0,vTemporal1;out float vSigma,vOriginalSigma,vOmega,vDistance;
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
      // Each complete source selects ONE path. No per-pixel legacy/adaptive mix.
      // Continuous N/N+1 blend keeps both midpoint spacings strictly below.5px.
      vTrailSampling=vec4(8.,8.,0.,0.);
      if(trail&&uTrailAdaptive>.5){
        float L=length(motion);
        if(L>1e-4){
          vec2 axis=motion/L;float targetStep=.5*max(1.,sigma);float x=max(7.,L/targetStep),n0=floor(x)+1.,n1=n0+1.,f=fract(x),blend=clamp(f*f*f*(f*(f*6.-15.)+10.),0.,1.);
          float support=.5*(abs(axis.x)+abs(axis.y))+6.*sigma+.02;
          if(explicitShutter>.5)support+=.38729833462*abs(dot(shutter,axis));
          float maxLocal=min(n1,ceil(2.*support*n1/L)+4.);
          // Global index range is bounded for highp float precision. Local
          // work is bounded independently of the complete segment length.
          if(n1<=65536.&&maxLocal<=128.)vTrailSampling=vec4(n0,n1,blend,1.);
        }
      }
      // Adaptive integration uses the physical projected centre, independent
      // of the expanded quad's implementation-dependent raster snapping.
      vTrailCentre=(ndc*.5+.5)*uSize;
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
    flat in vec4 vTrailSampling;flat in vec2 vTrailCentre;in vec2 vOffset,vMotion;in vec3 vWorld,vColour,vSmokeLight,vTrailShutter;in vec4 vShape,vTemporal0,vTemporal1;in float vSigma,vOriginalSigma,vOmega,vDistance;
    out vec4 outColour;
    float erfApprox(float x){float s=sign(x);x=abs(x);float t=1./(1.+.3275911*x);return s*(1.-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x));}
    float integratedGaussian(vec2 p,float sigma){vec2 a=(p-vec2(.5))/(sigma*1.41421356237),b=(p+vec2(.5))/(sigma*1.41421356237);return max(0.,.25*(erfApprox(b.x)-erfApprox(a.x))*(erfApprox(b.y)-erfApprox(a.y)));}
    float adaptiveSpatialKernel(float n){
      vec2 pixelOffset=gl_FragCoord.xy-vTrailCentre;
      float L=length(vMotion);vec2 axis=vMotion/L;
      float support=.5*(abs(axis.x)+abs(axis.y))+6.*vSigma+.02;
      if(vTrailShutter.z>1.5)support+=.38729833462*abs(dot(vTrailShutter.xy,axis));
      float along=dot(pixelOffset,axis);
      int lo=int(clamp(ceil(n*(.5+(along-support)/L)-.5),0.,n));
      int hi=int(clamp(floor(n*(.5+(along+support)/L)-.5),-1.,n-1.));
      float kernel=0.;
      for(int k=0;k<128;k++){
        int i=lo+k;if(i>hi)break;
        vec2 q=pixelOffset-vMotion*((float(i)+.5)/n-.5);
        if(vTrailShutter.z<1.5)kernel+=integratedGaussian(q,vSigma);
        else{
          float b=integratedGaussian(q,vSigma)*(4./9.);
          b+=(integratedGaussian(q-vTrailShutter.xy*.38729833462,vSigma)+integratedGaussian(q+vTrailShutter.xy*.38729833462,vSigma))*(5./18.);
          kernel+=b;
        }
      }
      // Keep the COMPLETE global quadrature weight. Never renormalize the
      // pixel-local subset; omitted6sigma tails have an explicit error bound.
      return kernel/n;
    }
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
        if(vTrailSampling.w>.5){
          if(vTrailSampling.z==0.)kernel=meanEmission*adaptiveSpatialKernel(vTrailSampling.x);
          else kernel=meanEmission*mix(adaptiveSpatialKernel(vTrailSampling.x),adaptiveSpatialKernel(vTrailSampling.y),vTrailSampling.z);
        }
        else for(int i=0;i<8;i++){
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
  let records=[],quality={trailSegments:10},disposed=false,lastRender={instances:0},lastTrailSampling=null,trailIntegrationRequested=trailIntegration!=='legacy8',warnings=[],boundCache=null,boundsCache=null,boundsKey='',clusterCache=null;
  const sourceProjectionCache=new WeakMap(),sourceBoundScratch=sourceBoundOutput(),radianceBins=new Float64Array(32*32);
  const boundsPastSamples=new WeakMap();let boundsSampleGeneration=0;
  const viewPosition=new THREE.Vector3(),projected=new THREE.Vector3();
  function updateRecords(){
    const now=simulation.time,timeline=simulation.windTimeline;records=simulation.particles().filter(p=>p.kind==='smoke');
    for(const event of simulation.active)for(const body of [...(event.rocket?[event.rocket]:[]),...event.heads]){
      const age=now-body.birth,life=body.life;if(age<0)continue;
      const rocket=body.kind==='rocket',fraction=(body.trail||rocket) ? .34 : 0;
      if(age<life+.02){const state=sampleBody(body,now,timeline),emission=bodyEmissionEnvelope(body,age);if(state.position[1]>.03)records.push({...state,eventId:event.id,kind:'star',radius:body.radius,intensity:body.intensity*emission*(1-fraction),unmodulatedIntensity:body.intensity*(1-fraction),sourceBody:body,sourceAge:age,colour:body.colour,stretch:[0,0,0]});}
      if(!fraction)continue;
      const duration=event.type==='willow' ? .88 : event.type==='palm' ? .62 : rocket ? .50 : .35,segments=quality.trailSegments;
      let sum=0;for(let j=0;j<segments;j++)sum+=Math.exp(-((j+.5)/segments)*3.5);
      const tail=[];for(let j=0;j<segments;j++){
        const lag=(j+.5)/segments*duration,born=now-lag,a=born-body.birth;if(a<0||a>life)continue;
        const source=sampleBody(body,born,timeline),ember={birth:born,position:source.position,velocity:source.velocity.map(v=>v*.25),drag:1.35,gravity:9.81},state=sampleBody(ember,now,timeline);
        if(state.position[1]<.03)continue;
        const envelope=bodyEmissionEnvelope(body,a),weight=Math.exp(-lag/duration*3.5)/sum;
        tail.push({...state,eventId:event.id,kind:'star',radius:.0018,intensity:body.intensity*fraction*weight*envelope,unmodulatedIntensity:body.intensity*fraction*weight,sourceBody:body,sourceAge:a,colour:tailColourMode==='cooling'?thermalTailColour(lag,duration):EMISSION_PROFILES.thermal,stretch:[0,0,0]});
      }
      for(let j=0;j<tail.length;j++){const one=tail[Math.max(0,j-1)].position,two=tail[Math.min(tail.length-1,j+1)].position,weight=j===0||j===tail.length-1?1:.5;tail[j].stretch=two.map((v,i)=>(v-one[i])*weight);records.push(tail[j]);}
    }
    boundCache=null;clusterCache=null;
  }
  function getLightClusters(){if(clusterCache)return clusterCache;return clusterCache=simulation.active.map(event=>{
    const heads=records.filter(p=>p.kind==='star'&&p.eventId===event.id);
    let I=0,centre=[0,0,0],rgb=[0,0,0];for(const p of heads){I+=p.intensity;for(let c=0;c<3;c++){centre[c]+=p.position[c]*p.intensity;rgb[c]+=p.colour[c]*p.intensity;}}
    if(I>1e-8){centre=centre.map(x=>x/I);rgb=rgb.map(x=>x/I);}else{centre=[...event.burstPosition];rgb=[1,1,1];}
    const cluster={position:centre,color:rgb,colour:rgb,referenceCandela:I,intensity:I,radius:Math.max(2,Math.min(28,(simulation.time-event.burstTime)*8)),kind:'fireworks diffuse cluster',eventId:event.id,pathFlags:{diffuse:true,smoke:true,specular:false}};
    if(clusterModel==='moments'){
      // A finite-radius point proxy from the same luminous head/tail ledger.
      // Spatial moments retain total I; they are not resolved area emission.
      let weightedRadiusSquared=0,maxExtent=0;
      for(const p of heads){if(!(p.intensity>0))continue;const dx=p.position[0]-centre[0],dy=p.position[1]-centre[1],dz=p.position[2]-centre[2],r2=dx*dx+dy*dy+dz*dz;weightedRadiusSquared+=p.intensity*r2;maxExtent=Math.max(maxExtent,Math.sqrt(r2));}
      const rmsRadius=I>0?Math.sqrt(Math.max(0,weightedRadiusSquared/I)):0;
      Object.assign(cluster,{radius:Math.max(2,rmsRadius),rmsRadius,maxExtent,illuminationModel:'intensity-weighted spatial-moment finite-radius point proxy; not exact area emission'});
    }
    return cluster;
  }).filter(l=>l.referenceCandela>1e-6).slice(0,2);}
  // Optional actual-source ledger. No allocation/traversal until requested.
  // data is borrowed until the next ledger call after records/raw-scale change;
  // upload synchronously or copy if retaining it across a physical update.
  let emissionLedgerCache=null,emissionLedgerRecords=null,emissionLedgerData=null,emissionLedgerVersion=0,emissionRecordGeneration=0;
  function getEmissionLedger({rawPerCandela=3.6e-5}={}){
    if(disposed)throw new Error('Cannot query a disposed firework source ledger');
    if(typeof rawPerCandela!=='number'||!Number.isFinite(rawPerCandela)||rawPerCandela<0)throw new RangeError('Emission ledger rawPerCandela requires finite nonnegative reference scale');
    if(emissionLedgerCache&&emissionLedgerRecords===records&&emissionLedgerCache.rawPerCandela===rawPerCandela)return emissionLedgerCache;
    const groups=[],indices=new Map();let count=0;
    // Full preflight precedes any mutation of the published reusable buffer.
    for(const p of records){if(p.kind==='smoke')continue;const I=p.intensity,position=p.position,colour=p.colour;
      if(typeof I!=='number'||!Number.isFinite(I)||I<0||!position||position.length!==3||!colour||colour.length!==3||!Number.isFinite(p.radius)||p.radius<0)throw new RangeError('Emission ledger requires finite nonnegative luminous records');
      for(let c=0;c<3;c++)if(!Number.isFinite(position[c])||!Number.isFinite(Math.fround(position[c]))||!Number.isFinite(colour[c])||colour[c]<0)throw new RangeError('Emission ledger position/colour is outside its finite Float32 domain');
      if(!(I>0&&maximumRGB(colour)>0))continue;
      if(!((typeof p.eventId==='string'&&p.eventId.length>0)||(typeof p.eventId==='number'&&Number.isFinite(p.eventId))))throw new RangeError('Emission ledger source requires a stable event ID');
      const variance=p.radius*p.radius/5;if(!Number.isFinite(Math.fround(variance)))throw new RangeError('Emission ledger emitter variance overflows Float32');
      for(let c=0;c<3;c++){const raw=I*colour[c]*rawPerCandela,value=Math.fround(raw);if(!Number.isFinite(value)||(raw>0&&value===0))throw new RangeError('Emission ledger raw RGB is not representable in Float32');}
      if(++count>capacity)throw new RangeError('Emission ledger capacity exceeded; no luminous entries were truncated');
      if(!indices.has(p.eventId)){if(groups.length===2)throw new RangeError('Emission ledger supports at most two complete event groups');indices.set(p.eventId,groups.length);groups.push({index:groups.length,eventId:p.eventId,count:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],sumRawRGB:[0,0,0]});}
    }
    if(emissionLedgerVersion>=Number.MAX_SAFE_INTEGER||emissionRecordGeneration>=Number.MAX_SAFE_INTEGER)throw new RangeError('Emission ledger revision exhausted');
    if(!emissionLedgerData)emissionLedgerData=new Float32Array(capacity*8);let row=0;
    for(const p of records){if(p.kind==='smoke'||!(p.intensity>0&&maximumRGB(p.colour)>0))continue;const group=groups[indices.get(p.eventId)],o=row++*8;emissionLedgerData[o]=p.position[0];emissionLedgerData[o+1]=p.position[1];emissionLedgerData[o+2]=p.position[2];emissionLedgerData[o+3]=p.radius*p.radius/5;for(let c=0;c<3;c++){emissionLedgerData[o+4+c]=p.intensity*p.colour[c]*rawPerCandela;const value=emissionLedgerData[o+4+c];group.min[c]=Math.min(group.min[c],emissionLedgerData[o+c]);group.max[c]=Math.max(group.max[c],emissionLedgerData[o+c]);group.sumRawRGB[c]+=value;}emissionLedgerData[o+7]=group.index;group.count++;}
    if(emissionLedgerRecords!==records)emissionRecordGeneration++;emissionLedgerRecords=records;
    const frozenGroups=Object.freeze(groups.map(group=>Object.freeze({...group,min:Object.freeze(group.min),max:Object.freeze(group.max),sumRawRGB:Object.freeze(group.sumRawRGB)})));
    return emissionLedgerCache=Object.freeze({schema:'glass-atoll.emission-ledger.v1',version:++emissionLedgerVersion,recordGeneration:emissionRecordGeneration,time:simulation.time,count,stride:8,capacity,data:emissionLedgerData,groups:frozenGroups,rawPerCandela,units:'metres, isotropic emitter variance m2, current modulated raw RGB reference before camera/P/transmission',bufferLifetime:'Borrowed reusable Float32 buffer; valid until next getEmissionLedger call after physical record generation or rawPerCandela changes. Upload synchronously or copy.'});
  }
  function smokeLighting(p,eye,air,rawPerCandela,clusters){
    const ambient=rgbArray(air?.ambientIrradianceRGB),sun=rgbArray(air?.rawSunRGB);
    const out=ambient.map((v,c)=>(v+sun[c]*.22)*p.colour[c]/(4*Math.PI));
    const view=p.position.map((v,i)=>eye[i]-v),viewLength=Math.hypot(...view);
    for(const l of clusters){const delta=l.position.map((v,i)=>v-p.position[i]),d2=Math.max(l.radius*l.radius,...[delta.reduce((s,v)=>s+v*v,0)]),length=Math.sqrt(d2),mu=-delta.reduce((s,v,i)=>s+v*view[i],0)/Math.max(length*viewLength,1e-9),g=.32,phase=(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5);for(let c=0;c<3;c++)out[c]+=l.color[c]*l.referenceCandela*rawPerCandela/d2*phase*p.colour[c]*.72;}
    return out;
  }
  function estimateTrailSampling(camera,optics,width,height,shutter){
    const c=prepareSourceProjection(camera,{...optics,width,height,shutterSeconds:shutter},3.6e-5),b=sourceBoundOutput(),stats={scope:'CPU projected estimates; GPU branch validated by independent fixtures, not runtime readback',tails:0,clipped:0,adaptive:0,legacyFallback:0,reasons:{degenerate:0,globalBudget:0,localBudget:0},maximumN:0,maximumLocalBound:0,minimumStepPixels:.5,maximumStepSigma:.5,supportSigma:6,maxLocalSamplesPerLevel:128,maxGlobalSamples:65536};
    for(const p of records){if(p.kind==='smoke'||!(p.stretch?.some(v=>v!==0)))continue;stats.tails++;if(!writeSourceBound(p,c,b)){stats.clipped++;continue;}const L=Math.hypot(...b.stretchPixels),S=Math.hypot(...b.shutterPixels),sigma=Math.sqrt(b.baseSigma2+(S<=1?S*S/24:0));
      if(!(L>1e-4)){stats.legacyFallback++;stats.reasons.degenerate++;continue;}
      const ax=b.stretchPixels[0]/L,ay=b.stretchPixels[1]/L,n0=Math.floor(Math.max(7,L/(.5*Math.max(1,sigma))))+1,n1=n0+1,support=.5*(Math.abs(ax)+Math.abs(ay))+6*sigma+.02+(S>1?.38729833462*Math.abs(b.shutterPixels[0]*ax+b.shutterPixels[1]*ay):0),local=Math.min(n1,Math.ceil(2*support*n1/L)+4);
      stats.maximumN=Math.max(stats.maximumN,n1);stats.maximumLocalBound=Math.max(stats.maximumLocalBound,local);
      if(n1>65536){stats.legacyFallback++;stats.reasons.globalBudget++;}else if(local>128){stats.legacyFallback++;stats.reasons.localBudget++;}else stats.adaptive++;
    }
    return stats;
  }
  const sourceTransmissionScratch=new Float64Array(3);
  function fillRecords(camera,air,rawPerCandela,shutter,medium=null,legacySmoke=true,reflection=false,planeY=0){
    camera.updateMatrixWorld();const eye=camera.position.toArray(),ordered=records.filter(p=>legacySmoke||p.kind!=='smoke').map(p=>({p,z:viewPosition.fromArray(p.position).applyMatrix4(camera.matrixWorldInverse).z})).sort((a,b)=>a.z-b.z),clusters=getLightClusters();
    if(ordered.length>capacity)throw new Error('Finite effects instance capacity exceeded without deleting logical heads.');
    for(let i=0;i<ordered.length;i++){
      const p=ordered[i].p,smoke=p.kind==='smoke',light=smoke?smokeLighting(p,eye,air,rawPerCandela,clusters):[0,0,0];
      arrays.centre.set(p.position,i*3);arrays.velocity.set(p.velocity||[0,0,0],i*3);arrays.stretch.set(p.stretch||[0,0,0],i*3);arrays.colour.set(p.colour,i*3);arrays.smokeLight.set(light,i*3);arrays.shape.set([smoke?1:0,p.radius,p.unmodulatedIntensity??p.intensity??0,p.opticalDepth||0],i*4);
      if(medium&&!smoke){const T=typeof medium.writeTransmission==='function'?medium.writeTransmission(eye,p.position,sourceTransmissionScratch,{reflection,planeY}):medium.transmission(eye,p.position,{reflection,planeY});for(let c=0;c<3;c++)arrays.colour[i*3+c]*=T[c];}
      for(let k=0;k<8;k++){const age=p.sourceAge+((k+.5)/8-.5)*shutter,body=p.sourceBody;const weight=!body?1:bodyEmissionEnvelope(body,age);arrays[k<4?'temporal0':'temporal1'][i*4+(k%4)]=weight;}
    }
    geometry.instanceCount=ordered.length;for(const name of Object.keys(attributes))geometry.getAttribute('a'+name[0].toUpperCase()+name.slice(1)).needsUpdate=true;
    return ordered.length;
  }
  // Read-only kinematic view for an optional bounded smoke source adapter.
  // This never samples a future point, advances simulation/RNG, or reads light I.
  const smokeDescriptorCache=new WeakMap();let smokeDescribeCalls=0,smokeSampleCalls=0,smokeReleases=0;
  let smokeCombustionCache;
  let smokeBodyIndexCache;
  const smokeVector=value=>Object.freeze(Array.from(value));
  function smokeActiveEvent(id){const event=simulation.active.find(e=>e.id===id);if(!event)throw new RangeError('Smoke source descriptor is no longer active: '+id);const first=simulation.windTimeline[0];if(first&&first.time>event.time+1e-10)throw new RangeError('Smoke source wind history was pruned before its causal launch');return event;}
  const smokeSourceProvider=Object.freeze({
    get time(){return simulation.time;},
    describeCombustion(eventId){
      if(disposed)throw new Error('Cannot query disposed combustion metadata');
      const event=smokeActiveEvent(eventId);let descriptor=smokeCombustionCache?.get(event);if(descriptor)return descriptor;
      descriptor=describeFireworkCombustion(event);(smokeCombustionCache??=new WeakMap()).set(event,descriptor);return descriptor;
    },
    describe(eventId){
      const event=smokeActiveEvent(eventId);smokeDescribeCalls++;let descriptor=smokeDescriptorCache.get(event);if(descriptor)return descriptor;
      const roots=event.heads.filter(b=>!b.parentBody).map(b=>Object.freeze({id:b.id,birth:b.birth,life:b.life,baseVelocity:smokeVector(b.baseVelocity),patternPart:b.patternPart??null}));
      const frame=event.patternFrame?Object.freeze({kind:event.patternFrame.kind,right:smokeVector(event.patternFrame.right),up:smokeVector(event.patternFrame.up),normal:smokeVector(event.patternFrame.normal)}):null;
      descriptor=Object.freeze({schema:'glass-atoll.smoke-kinematic-descriptor.v1',id:event.id,type:event.type,seed:event.seed,ground:!!event.definition.ground,time:event.time,burstTime:event.burstTime,endTime:event.endTime,baselineVelocity:smokeVector(event.baselineBurst.velocity),shapeFrame:frame,roots:Object.freeze(roots),sourceEvents:Object.freeze(event.events.map(e=>Object.freeze({kind:e.kind,time:e.time,seed:e.seed}))) });
      smokeDescriptorCache.set(event,descriptor);return descriptor;
    },
    sample(eventId,{kind,time,bodyId,eventKind,seed}={}){
      if(!Number.isFinite(time)||time>simulation.time)throw new RangeError('Smoke source sample must be finite and already born at the current simulation time');
      const event=smokeActiveEvent(eventId);if(time<event.time)throw new RangeError('Smoke source sample predates its causal launch');let position;
      if(kind==='root'){const body=event.heads.find(b=>!b.parentBody&&b.id===bodyId);if(!body||time<body.birth||time>=body.birth+body.life)throw new RangeError('Smoke source requires an existing burning root at the requested birth time');position=sampleBody(body,time,simulation.windTimeline).position;}
      else if(kind==='event'){const source=event.events.find(e=>e.kind===eventKind&&e.time===time&&(seed===undefined||seed===e.seed));if(!source)throw new RangeError('Smoke source event clock/seed does not match its active descriptor');position=source.position;}
      else throw new RangeError('Smoke source sample kind must be root or event');
      if(!position.every(Number.isFinite))throw new RangeError('Smoke source point is not finite');smokeSampleCalls++;return Object.freeze({eventId,time,position:smokeVector(position)});
    },
    sampleBody(eventId,{bodyId,time}={}){
      if(disposed)throw new Error('Cannot sample disposed combustion bodies');
      if(!Number.isSafeInteger(bodyId)||bodyId<0||!Number.isFinite(time)||time>simulation.time)throw new RangeError('Combustion body sampling requires a nonnegative native body ID and finite past/current time');
      const event=smokeActiveEvent(eventId);let index=smokeBodyIndexCache?.get(event);
      if(!index){index=new Map(event.heads.map(body=>[body.id,body]));(smokeBodyIndexCache??=new WeakMap()).set(event,index);}
      const body=index.get(bodyId);if(!body||time<body.birth||time>=body.birth+body.life)throw new RangeError('Combustion source requires an existing burning native body at the requested time');
      const position=sampleBody(body,time,simulation.windTimeline).position;if(!position.every(Number.isFinite))throw new RangeError('Combustion source point is not finite');
      return Object.freeze({eventId,bodyId,time,position:smokeVector(position)});
    },
    release(eventId){const event=simulation.active.find(e=>e.id===eventId);if(event)smokeDescriptorCache.delete(event);smokeReleases++;},
    diagnostics(){return{describeCalls:smokeDescribeCalls,sampleCalls:smokeSampleCalls,releases:smokeReleases,strongEventArchives:0,positionPolicy:'past/current exact physical time only; active event plus unpruned causal wind required'};}
  });
  const api={rig,effectsScene,types:FIREWORK_TYPES,smokeSourceProvider,
    get tailColourMode(){return tailColourMode;},
    configure(patch={}){if(patch.automaticDirection!==undefined)patch={...patch,autoDirection:patch.automaticDirection};const nextClusterModel=patch.clusterModel===undefined?clusterModel:validateClusterModel(patch.clusterModel),nextTrailIntegration=patch.trailIntegration===undefined?trailIntegration:validateTrailIntegration(patch.trailIntegration),nextTailColourMode=patch.tailColourMode===undefined?tailColourMode:validateTailColourMode(patch.tailColourMode),{clusterModel:ignoredClusterModel,trailIntegration:ignoredTrailIntegration,tailColourMode:ignoredTailColourMode,...physicsPatch}=patch;const state=simulation.configure(physicsPatch);if(patch.tailColourMode!==undefined)tailColourModeRequested=true;if(nextTailColourMode!==tailColourMode){tailColourMode=nextTailColourMode;updateRecords();}if(nextTrailIntegration!==trailIntegration)lastTrailSampling=null;if(patch.trailIntegration!==undefined)trailIntegrationRequested=true;trailIntegration=nextTrailIntegration;uniforms.uTrailAdaptive.value=trailIntegration==='adaptive'?1:0;if(nextClusterModel!==clusterModel){clusterModel=nextClusterModel;clusterCache=null;boundCache=null;}const az=state.autoDirection?Math.atan2(base[0],-base[2]):state.azimuth*Math.PI/180,axis=new THREE.Vector3(Math.sin(az)*Math.cos(state.elevation*Math.PI/180),Math.sin(state.elevation*Math.PI/180),-Math.cos(az)*Math.cos(state.elevation*Math.PI/180));aim.rotation.set(0,0,0);aim.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);launchOrigin[0]=base[0]+axis.x*.66;launchOrigin[1]=base[1]+.17+axis.y*.66;launchOrigin[2]=base[2]+axis.z*.66;return{...state,clusterModel,...(trailIntegration==='adaptive'?{trailIntegration}: {}),...(tailColourMode==='cooling'?{tailColourMode}: {})};},
    launch(options){const result=simulation.launch(options);updateRecords();return result;},stop(){simulation.stop();},
    update({time,dt,windVector}={}){simulation.update({time,windVector});updateRecords();},
    drainEvents:()=>simulation.drainEvents(),
    getBounds(){
      if(!simulation.active.length)return{centre:[...base],center:[...base],radius:2,min:base.map(x=>x-1),max:base.map(x=>x+1),active:false};
      const wind=simulation.windTimeline.at(-1).wind,key=Math.floor(simulation.time*2)+'|'+simulation.active.map(e=>e.id).join(',')+'|'+wind.join(',');if(key===boundsKey)return boundsCache;
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],include=(p,pad=8)=>{for(let c=0;c<3;c++){min[c]=Math.min(min[c],p[c]-pad);max[c]=Math.max(max[c],p[c]+pad);}};
      const generation=++boundsSampleGeneration,sameVector=(a,b)=>a===undefined?b===undefined:b!==undefined&&a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
      function pastSamples(b){
        let cache=boundsPastSamples.get(b);if(cache?.generation===generation)return cache;
        const parent=b.parentBody?pastSamples(b.parentBody):null,parentVersion=parent?.version||0;
        // resolveBurst can replace a future birth pose on each wind update.
        // Compare its values (and inherited parent version), never array identity.
        if(!cache||cache.birth!==b.birth||cache.life!==b.life||cache.drag!==b.drag||cache.gravity!==b.gravity||cache.parent!==b.parentBody||cache.parentVersion!==parentVersion||!sameVector(cache.position,b.position)||!sameVector(cache.velocity,b.velocity)||!sameVector(cache.velocityDelta,b.velocityDelta)){
          cache={birth:b.birth,life:b.life,drag:b.drag,gravity:b.gravity,parent:b.parentBody,parentVersion,position:b.position.slice(),velocity:b.velocity.slice(),velocityDelta:b.velocityDelta?.slice(),version:(cache?.version||0)+1,positions:new Array(17)};boundsPastSamples.set(b,cache);
        }
        cache.generation=generation;return cache;
      }
      for(const e of simulation.active){include(e.origin,2);for(const b of [...(e.rocket?[e.rocket]:[]),...e.heads]){const cache=simulation.time>=b.birth?pastSamples(b):null;for(let j=0;j<=16;j++){
          const t=b.birth+b.life*j/16,p=t>=b.birth&&t<=simulation.time?(cache.positions[j]??=sampleBody(b,t,simulation.windTimeline).position):sampleBody(b,t,simulation.windTimeline).position;if(p[1]>0)include(p);
        }}
        include(e.burstPosition,18);include(e.burstPosition.map((v,c)=>v+wind[c]*9.8+(c===1?5:0)),18);
      }
      min[1]=Math.max(0,min[1]);boundsKey=key;const centre=min.map((v,c)=>(v+max[c])*.5);return boundsCache={min,max,centre,center:centre,radius:Math.hypot(...max.map((v,c)=>(v-min[c])*.5)),active:true,predicted:true,model:'16-point analytic trajectory forecast at current wind +8m margin; 2Hz cache; smoke envelope'};
    },
    getLightClusters,getEmissionLedger,
    getRadianceBound({camera,optics={},rawPerCandela=3.6e-5,onSourceBound=null}={}){
      if(onSourceBound!==null&&typeof onSourceBound!=='function')throw new TypeError('onSourceBound must be a function or null');
      if(!camera)return{maximumRawRadiance:records.reduce((s,p)=>s+(p.unmodulatedIntensity??p.intensity??0)*Math.max(...p.colour)/Math.max(Math.PI*p.radius*p.radius,1e-8)*rawPerCandela*1.02,0),method:'authored spherical surface reference only; projected Gaussian budget requires camera',conservative:false,requiresCamera:true};
      camera.updateMatrixWorld();const w=optics.width||1200,h=optics.height||900,bins=radianceBins;bins.fill(0);let global=0,maxChannel=0,visible=0,nearFallback=0,traceOrdinal=0;
      const projection=prepareSourceProjection(camera,optics,rawPerCandela,sourceProjectionCache.get(camera));prepareFireworkDepthClip(projection);sourceProjectionCache.set(camera,projection);const bound=sourceBoundScratch;
      for(const p of records){if(p.kind==='smoke')continue;const colourMaximum=maximumRGB(p.colour);global+=(p.unmodulatedIntensity??p.intensity)*colourMaximum/(Math.PI*p.radius*p.radius)*1.02*rawPerCandela;maxChannel=Math.max(maxChannel,colourMaximum);const projected=writeSourceBound(p,projection,bound,colourMaximum);if(onSourceBound){const vector=v=>Object.freeze(Array.from(v||boundZero)),source=Object.freeze({index:traceOrdinal++,kind:p.kind,eventId:p.eventId??null,bodyId:p.sourceBody?.id??null,patternPart:p.sourceBody?.patternPart??null,position:vector(p.position),positionInputFloat32:p.position instanceof Float32Array,velocity:vector(p.velocity),stretch:vector(p.stretch),colour:vector(p.colour),radius:p.radius,intensity:p.intensity,unmodulatedIntensity:p.unmodulatedIntensity??p.intensity,sourceAge:p.sourceAge??null}),output=Object.freeze(projected?{...bound,rect:vector(bound.rect),shutterPixels:vector(bound.shutterPixels),stretchPixels:vector(bound.stretchPixels)}:{peak:0,visible:false,nearPlaneFallback:false,rect:vector(bound.rect)});onSourceBound(Object.freeze({source,bound:output,projected:!!projected}));}if(!projected||!bound.visible||fireworkCentreDepthClipped(p.position,projection))continue;visible++;nearFallback+=Number(bound.nearPlaneFallback);
        const r=bound.rect,x0=Math.max(0,Math.floor(r[0]/w*32)),x1=Math.min(31,Math.floor(r[2]/w*32)),y0=Math.max(0,Math.floor(r[1]/h*32)),y1=Math.min(31,Math.floor(r[3]/h*32));
        for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++)bins[yy*32+xx]+=bound.peak;
      }
      // Smoke and rapidly illuminated receivers are separately budgeted by
      // root from the same physical clusters. This bound describes sources.
      const clusters=getLightClusters();let smokeSum=0,smokeDepth=0,binPeak=0;
      for(const l of clusters)smokeSum+=maximumRGB(l.color)*l.referenceCandela*rawPerCandela/(l.radius*l.radius)*.24;
      for(const p of records)if(p.kind==='smoke')smokeDepth+=p.opticalDepth;
      for(let i=0;i<bins.length;i++)binPeak=Math.max(binPeak,bins[i]);
      const smokeBound=smokeSum*Math.min(1,smokeDepth),peak=binPeak*1.2+smokeBound;return boundCache={maximumRawRadiance:peak,maxRawRadiance:peak,globalFiniteSurfaceCeiling:global,globalReferenceOnly:true,ownSmokeRawBound:smokeBound,maximumEmissionRGBChannel:maxChannel,visibleSources:visible,nearPlaneFallbackSources:nearFallback,method:'32x32 conservative source overlap bins; actual pixel-integrated Gaussian peak and projected shutter/stretch extent; near crossings cover viewport; legacy globalFiniteSurfaceCeiling is a spherical reference only; root separately budgets ambient/air/receivers',conservative:true};
    },
    render({renderer,target,camera,opaqueDepth=null,reflection=false,planeY=0,frame={},optics={},air={},medium=null,legacySmoke=true}={}){
      if(disposed||!records.length)return;
      const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),autoClear=renderer.autoClear,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
      const width=target?.width||optics.width||1,height=target?.height||optics.height||1;
      const scale=frame.sceneScale??2**(frame.storageEV||0),rawPerCandela=frame.rawPerCandela??3.6e-5;
      camera.updateMatrixWorld();uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);uniforms.uProjection.value.copy(camera.projectionMatrix);uniforms.uEye.value.setFromMatrixPosition(camera.matrixWorld);uniforms.uSize.value.set(width,height);
      uniforms.uDepth.value=reflection?dummy:opaqueDepth||dummy;uniforms.uPlaneY.value=planeY;uniforms.uStorageScale.value=scale;uniforms.uRawPerCandela.value=rawPerCandela;
      uniforms.uFocalMm.value=optics.focalMm??28;uniforms.uAperture.value=optics.aperture??8;uniforms.uFocus.value=optics.focusMetres??60;uniforms.uSensorHeightMm.value=optics.sensorHeightMm??24;uniforms.uDof.value=!reflection&&optics.dof?1:0;uniforms.uShutter.value=reflection?0:(optics.shutterSeconds??1/120);uniforms.uVignette.value=!reflection&&optics.vignette?1:0;
      uniforms.uAirEnabled.value=air.enabled?1:0;for(const [name,field]of [['uBetaR','betaRayleighRGB'],['uBetaME','betaMieExtinctionRGB'],['uBetaMS','betaMieScatteringRGB'],['uSunDirection','sunDirection'],['uRawSunRGB','rawSunRGB']])uniforms[name].value.fromArray(rgbArray(air[field]));
      uniforms.uHeights.value.set(air.rayleighHeight||8000,air.aerosolHeight||1200);uniforms.uG.value=air.asymmetry??.76;
      lastTrailSampling=trailIntegration==='adaptive'?estimateTrailSampling(camera,{...optics,dof:!reflection&&optics.dof},width,height,uniforms.uShutter.value):null;
      const count=fillRecords(camera,air,rawPerCandela,uniforms.uShutter.value,medium,legacySmoke,reflection,planeY);mesh.material=reflection?reflectionMaterial:mainMaterial;
      try{renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(target);renderer.render(effectsScene,camera);lastRender={instances:count,reflection,storageEV:frame.storageEV??Math.log2(scale),rawPerCandela,width,height};}
      finally{renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;renderer.setRenderTarget(previous,face,mip);}
    },
    setQuality(patch={}){quality.trailSegments=clamp(Math.round(patch.trailSegments??quality.trailSegments),6,16);updateRecords();return{...quality};},
    diagnostics(){return{...simulation.state,...(tailColourModeRequested?{tailColour:{mode:tailColourMode,profile:THERMAL_TAIL_COLOUR_PROFILE}}:{}),clusterModel,clusterIlluminationModel:clusterModel==='moments'?'spatial-moment finite-radius point proxy; not exact area emission':'legacy age-times8 radius capped at28m',records:records.length,lastRender,quality:{...quality},radianceBound:boundCache,warnings:[...warnings],units:'reference cd + approximate emission RGB, linear scene reference once *2^storageEV; not measured pyrotechnic photometry',renderer:'independent instanced premult effects, four-segment finite air; water-hit reflection origin; sorted short segments',tailIntegration:{spatialSamples:8,...(trailIntegrationRequested?{requested:trailIntegration,effective:trailIntegration==='legacy8'?'legacy8':lastTrailSampling?'adaptive-with-legacy8-budget-fallback':'awaiting-render'}:{}),...(trailIntegration==='adaptive'?{mode:trailIntegration,spatialSamples:'positive adaptive N/N+1',estimates:lastTrailSampling}:{}),shutter:'<=1px: trace-preserving isotropic variance; >1px:3-point independent quadrature',kernelEvaluations:trailIntegration==='adaptive'?'upper limits256 local spatial evaluations /768 with large shutter; projected counters are CPU estimates, not actual GPU execution counts':'8 normal /24 large-shutter tail; heads unchanged',extraPasses:0},limits:['linear drag/burn model; no chemical or shock/fluid solve','grey smoke thin sprites; centre-depth sorting and shared near-air visibility approximation','resolved opaque depth/defocus occlusion approximation; root owns one shared bloom/vignette','subpixel tail shutter variance is a bounded angular approximation, not exact time-space convolution','star/cross-spectrum RGB is approximate CIE fit + authored bands and gamut compression']};},
    dispose(){disposed=true;geometry.dispose();mainMaterial.dispose();reflectionMaterial.dispose();dummy.dispose();rig.traverse(o=>o.geometry?.dispose());steel.dispose();rubber.dispose();},
  };
  api.configure({});return api;
}
