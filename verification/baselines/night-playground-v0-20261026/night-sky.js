// Celestial directions come from the locally vendored MIT Astronomy Engine.
// The stellar atlas is NASA SVS4851, linear catalog data, not a landscape photo.
import * as Astronomy from './assets/night/astronomy.js';

const RAD=Math.PI/180,TAU=2*Math.PI,AU_KM=149597870.7;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const FULL_MOON_SOLAR_RATIO=2.2e-6;
export const NIGHT_STAR_SCALE=2e-7;
export const nightDefaults=Object.freeze({latitude:4.5,longitude:118.6,height:2,date:'2026-10-26T14:00:00.000Z',rotationDegrees:0,automaticExposure:true,moonIntensity:1,starIntensity:1});
export function sanitizeNight(patch={},previous=nightDefaults){
  const n={...previous};
  for(const [key,a,b]of [['latitude',-89.8,89.8],['longitude',-180,180],['height',0,5000],['moonIntensity',0,2],['starIntensity',0,4]])if(Number.isFinite(patch[key]))n[key]=clamp(patch[key],a,b);
  if(Number.isFinite(patch.rotationDegrees))n.rotationDegrees=((patch.rotationDegrees+180)%360+360)%360-180;
  if(typeof patch.automaticExposure==='boolean')n.automaticExposure=patch.automaticExposure;
  if(patch.date!==undefined){const d=new Date(patch.date);if(Number.isFinite(d.getTime()))n.date=d.toISOString();}
  return n;
}
const yaw=(v,degrees)=>{const a=-degrees*RAD,c=Math.cos(a),s=Math.sin(a);return [c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]];};
// East/up/SOUTH is a right-handed local frame. East/up/north would mirror the
// catalog when seen through a conventional Three.js camera.
const horizontalDirection=(altitude,azimuth)=>{const e=altitude*RAD,a=azimuth*RAD;return[Math.cos(e)*Math.sin(a),Math.sin(e),-Math.cos(e)*Math.cos(a)];};
export function nightEphemeris(settings=nightDefaults,elapsedSeconds=0){
  const n=sanitizeNight(settings),date=new Date(new Date(n.date).getTime()+elapsedSeconds*1000),observer=new Astronomy.Observer(n.latitude,n.longitude,n.height);
  const moon=Astronomy.Equator(Astronomy.Body.Moon,date,observer,true,true),moonH=Astronomy.Horizon(date,observer,moon.ra,moon.dec,'normal'),illumination=Astronomy.Illumination(Astronomy.Body.Moon,date);
  const sun=Astronomy.Equator(Astronomy.Body.Sun,date,observer,true,true),sunH=Astronomy.Horizon(date,observer,sun.ra,sun.dec,'normal');
  const rotation=Astronomy.Rotation_HOR_EQJ(date,observer),basis=[[0,-1,0],[0,0,1],[-1,0,0]].map(v=>Astronomy.RotateVector(rotation,new Astronomy.Vector(...v,date)));
  const pole=Astronomy.RotationAxis(Astronomy.Body.Moon,date).north;
  const poleH=Astronomy.RotateVector(Astronomy.Rotation_EQJ_HOR(date,observer),pole),moonPole=yaw([-poleH.y,poleH.z,-poleH.x],n.rotationDegrees);
  const libration=Astronomy.Libration(date);
  return {date:date.toISOString(),settings:n,worldToEquatorialColumns:basis.map(v=>[v.x,v.y,v.z]),moonDirection:yaw(horizontalDirection(moonH.altitude,moonH.azimuth),n.rotationDegrees),moonNorth:moonPole,
    astronomicalSunDirection:yaw(horizontalDirection(sunH.altitude,sunH.azimuth),n.rotationDegrees),moonAltitudeDegrees:moonH.altitude,moonAzimuthDegrees:(moonH.azimuth+n.rotationDegrees+360)%360,moonPhase:illumination.phase_fraction,moonPhaseAngleRadians:illumination.phase_angle*RAD,moonMagnitude:illumination.mag,
    moonSourceRatio:FULL_MOON_SOLAR_RATIO*Math.pow(10,-.4*(illumination.mag+12.74))*n.moonIntensity,
    moonAngularRadius:Math.asin(1737.4/(moon.dist*AU_KM)),moonLibrationRadians:[libration.elon*RAD,libration.elat*RAD],siderealHours:Astronomy.SiderealTime(date),
    coordinates:'Right-handed world+X=east,+Y=up,-Z=north before rotationDegrees; atlasICRF/J2000. Positive rotationDegrees increases geographic azimuth. Ephemeris includes topocentric lunar parallax and normal refraction; atlas rays have no per-star atmospheric refraction.',
    limits:['Sun slider is an independent artistic direction, not this timestamp ephemeris Sun.','NASA atlas colors and plotted sizes are visualization data, not absolute photometric radiance.','Lunar texture uses approximate libration and Lambert shading, not resolved terrain/Hapke transport.']};
}

// Stops relative to this application's daytime calibration. The renderer must
// apply preExposure before FP16 storage; OutputPass subtracts preExposureEV.
export function recommendedNightExposure(solarElevationDegrees,moonSourceRatio=0,moonAltitudeDegrees=-90,automatic=true){
  if(!automatic)return 0;
  const moonIllumination=clamp(moonSourceRatio/FULL_MOON_SOLAR_RATIO*Math.max(0,Math.sin(moonAltitudeDegrees*RAD)),0,1);
  const darkEV=21-3.8*Math.sqrt(moonIllumination),e=solarElevationDegrees;
  if(e>=10)return 0;
  if(e>=0)return 2*(1-smooth(0,10,e));
  if(e>=-6)return 2+6*smooth(0,6,-e);
  if(e>=-12)return 8+6*smooth(6,12,-e);
  return 14+(darkEV-14)*smooth(12,18,-e);
}

export const nightSkyGLSL=/* glsl */`
  uniform highp sampler2D uNightStarMap,uMoonMap;
  uniform mat3 uEquatorialRotation;
  uniform vec3 uMoonDirection,uMoonRight,uMoonNorth,uMoonSunDirection;
  uniform vec2 uMoonLibration;
  uniform float uNightStarScale,uMoonRadius,uMoonRadiance;
  vec3 celestialRadiance(vec3 rd,vec3 viewTransmission,float diskEnabled){
    vec3 eq=normalize(uEquatorialRotation*rd);
    // NASA: atlas centerRA0, RA increases left. Both HDR and albedo textures
    // are explicitly flipY=true, so north is textureV1.
    vec2 uv=vec2(.5-atan(eq.y,eq.x)/6.28318530718,.5+asin(clamp(eq.z,-1.,1.))/3.14159265359);
    vec2 dx=dFdx(uv),dy=dFdy(uv);
    dx.x-=round(dx.x);dy.x-=round(dy.x);
    vec3 stars=textureGrad(uNightStarMap,uv,dx,dy).rgb*uNightStarScale;
    float cosine=dot(rd,uMoonDirection),edge=cos(uMoonRadius),aa=max(fwidth(cosine),1e-8);
    float disc=smoothstep(edge-aa,edge+aa,cosine);
    vec3 lunar=vec3(0.);
    if(disc>0.0&&diskEnabled>0.0){
      vec2 p=vec2(dot(rd,uMoonRight),dot(rd,uMoonNorth))/sin(uMoonRadius);
      float z=sqrt(max(0.,1.-min(.999999,dot(p,p))));
      vec3 normal=normalize(uMoonRight*p.x+uMoonNorth*p.y-uMoonDirection*z);
      vec3 surface=vec3(p.x,p.y*cos(uMoonLibration.y)+z*sin(uMoonLibration.y),z*cos(uMoonLibration.y)-p.y*sin(uMoonLibration.y));
      vec2 moonUV=vec2(.5+(atan(surface.x,surface.z)+uMoonLibration.x)/6.28318530718,.5+asin(clamp(surface.y,-1.,1.))/3.14159265359);
      vec3 albedo=textureLod(uMoonMap,moonUV,0.).rgb;
      lunar=albedo*2.4*max(dot(normal,uMoonSunDirection),0.)*uMoonRadiance*disc*diskEnabled;
    }
    return (stars*(1.-disc*diskEnabled)+lunar)*viewTransmission;
  }
`;

export function createNightSky(THREE,initial={}){
  let settings=sanitizeNight(initial),lastTime=0,dateAnchorTime=0,anchorSim=0,anchor=null,disposed=false,loadError=null,loaded=false;
  const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);black.needsUpdate=true;
  const uniforms={uNightStarMap:{value:black},uMoonMap:{value:black},uEquatorialRotation:{value:new THREE.Matrix3()},uMoonDirection:{value:new THREE.Vector3()},uMoonRight:{value:new THREE.Vector3()},uMoonNorth:{value:new THREE.Vector3()},uMoonSunDirection:{value:new THREE.Vector3()},uMoonLibration:{value:new THREE.Vector2()},uNightStarScale:{value:NIGHT_STAR_SCALE},uMoonRadius:{value:.0047},uMoonRadiance:{value:0}};
  let current;
  function refresh(time){
    current=nightEphemeris(settings,time-dateAnchorTime);anchor=current;anchorSim=time;
    uniforms.uMoonDirection.value.fromArray(current.moonDirection);
    const north=new THREE.Vector3().fromArray(current.moonNorth),moon=uniforms.uMoonDirection.value;
    north.addScaledVector(moon,-north.dot(moon)).normalize();
    uniforms.uMoonNorth.value.copy(north);uniforms.uMoonRight.value.crossVectors(moon,north).normalize();
    uniforms.uMoonSunDirection.value.fromArray(current.astronomicalSunDirection);uniforms.uMoonLibration.value.fromArray(current.moonLibrationRadians);uniforms.uMoonRadius.value=current.moonAngularRadius;
    const a=current.moonPhaseAngleRadians,lambert=Math.max(.0001,(Math.sin(a)+(Math.PI-a)*Math.cos(a))/Math.PI);
    // Only correct the non-Lambert phase-brightness relation, not local shape.
    uniforms.uMoonRadiance.value=32000*current.moonSourceRatio/lambert;
  }
  function update(time=lastTime,force=false){
    if(!Number.isFinite(time))return;
    if(!anchor||force||Math.abs(time-anchorSim)>=30)refresh(time);
    // Earth rotation is continuous between the more expensive ephemerides.
    const angle=(time-anchorSim)*7.2921150e-5,c=Math.cos(angle),s=Math.sin(angle),columns=anchor.worldToEquatorialColumns;
    const basis=columns.map(v=>[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]]),yawAngle=-settings.rotationDegrees*RAD,cy=Math.cos(yawAngle),sy=Math.sin(yawAngle);
    const east=basis[0],up=basis[1],north=basis[2];
    const x=east.map((v,i)=>cy*v+sy*north[i]),z=east.map((v,i)=>-sy*v+cy*north[i]);
    uniforms.uEquatorialRotation.value.set(x[0],up[0],z[0],x[1],up[1],z[1],x[2],up[2],z[2]);
    uniforms.uNightStarScale.value=NIGHT_STAR_SCALE*settings.starIntensity;lastTime=time;
  }
  function setNight(patch={}){
    if(patch.date!==undefined&&Number.isFinite(new Date(patch.date).getTime()))dateAnchorTime=lastTime;
    settings=sanitizeNight(patch,settings);update(lastTime,true);return state();
  }
  const state=()=>({...current,settings:{...settings},currentDate:new Date(new Date(settings.date).getTime()+(lastTime-dateAnchorTime)*1000).toISOString(),loaded,loadError,starMap:'NASA SVS4851,4096x2048 linear HDR,local',lunarMap:'NASA SVS4720,LRO1024x512,local',starScale:NIGHT_STAR_SCALE*settings.starIntensity,ephemerisRefreshSeconds:30});
  update(0,true);
  let starTexture=null,moonTexture=null;
  const ready=typeof document==='undefined'?Promise.resolve({loaded:false,reason:'Node CPU-only context'}):Promise.all([
    import('./vendor/addons/loaders/HDRLoader.js').then(({HDRLoader})=>new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(new URL('./assets/night/starmap_2020_4k.hdr',import.meta.url).href)),
    new THREE.TextureLoader().loadAsync(new URL('./assets/night/lroc_color_poles_1k.jpg',import.meta.url).href)
  ]).then(([stars,moon])=>{
    if(disposed){stars.dispose();moon.dispose();return{loaded:false,disposed:true};}
    starTexture=stars;moonTexture=moon;
    stars.colorSpace=THREE.LinearSRGBColorSpace;stars.flipY=true;stars.generateMipmaps=true;stars.minFilter=THREE.LinearMipmapLinearFilter;stars.magFilter=THREE.LinearFilter;stars.wrapS=THREE.RepeatWrapping;stars.wrapT=THREE.ClampToEdgeWrapping;stars.anisotropy=4;stars.needsUpdate=true;
    moon.colorSpace=THREE.SRGBColorSpace;moon.flipY=true;moon.generateMipmaps=true;moon.minFilter=THREE.LinearMipmapLinearFilter;moon.magFilter=THREE.LinearFilter;moon.wrapS=THREE.RepeatWrapping;moon.wrapT=THREE.ClampToEdgeWrapping;moon.needsUpdate=true;
    stars.name='NASA catalog stellar radiance + Milky Way / ICRF J2000';moon.name='NASA LRO lunar albedo';uniforms.uNightStarMap.value=stars;uniforms.uMoonMap.value=moon;loaded=true;return state();
  }).catch(error=>{loadError=String(error);throw error;});
  // Retain rejection on ready for callers while avoiding an unhandled global
  // promise if a CPU-only client intentionally does not await asset loading.
  ready.catch(()=>{});
  return{uniforms,ready,update,setNight,get state(){return state();},get physical(){return current;},get settings(){return {...settings};},dispose(){if(disposed)return;disposed=true;starTexture?.dispose();moonTexture?.dispose();black.dispose();}};
}
