import {createSunShadowBinding} from './sun-shadows.js';
import {localLightGLSL,LOCAL_LIGHT_COUNT} from './local-lights.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f)=>Number.isFinite(v)?v:f;
const RAYLEIGH=[5.802e-6,13.558e-6,33.1e-6];
export const AERIAL_DEFAULTS={enabled:true,shadows:true,quality:'high',backgroundLocalScattering:0,localScatteringModel:'quadratic',aerosolScale:8,dryMie550:3.996e-6,humidity:.68,kappa:.6,
  singleScatteringAlbedo:.9,asymmetry:.76,rayleighScale:1,aerosolHeight:1200,rayleighHeight:8000,maxDistance:12000,halfResolution:.5};

// Bulk kappa-Kohler radius growth (Kelvin term neglected), followed by an
// area-growth extinction proxy. RH alone never creates aerosol when scale=0.
// kappa=.6 is prescribed mixed-marine composition, not a measured salt sample.
export function marineAirCoefficients(options={}){
  const humidity=clamp(finite(options.relativeHumidity,finite(options.humidity,.68)),0,.95);
  const kappa=clamp(finite(options.kappa,.6),0,1.4),aerosolScale=clamp(finite(options.aerosolScale,1),0,48);
  const radiusGrowth=Math.cbrt(1+kappa*humidity/Math.max(.05,1-humidity)),areaGrowth=radiusGrowth*radiusGrowth;
  const normalizedMieScale=aerosolScale*areaGrowth,dryMie550=Math.max(0,finite(options.dryMie550,3.996e-6));
  const wetMie550=dryMie550*normalizedMieScale,ssa=clamp(finite(options.singleScatteringAlbedo,.9),0,1);
  const rayleighScale=clamp(finite(options.rayleighScale,1),0,8);
  return{humidity,kappa,aerosolScale,radiusGrowth,areaGrowth,normalizedMieScale,wetMie550,
    betaRayleighRGB:RAYLEIGH.map(v=>v*rayleighScale),betaMieExtinctionRGB:[wetMie550,wetMie550,wetMie550],
    betaMieScatteringRGB:[wetMie550*ssa,wetMie550*ssa,wetMie550*ssa],singleScatteringAlbedo:ssa,
    asymmetry:clamp(finite(options.asymmetry,.76),0,.9),aerosolHeight:Math.max(50,finite(options.aerosolHeight,1200)),rayleighHeight:Math.max(1000,finite(options.rayleighHeight,8000)),
    units:'inverse metres at sea level; scale is an environmental control, not measured aerosol mass',
    model:'bulk hygroscopic radius growth and geometric-area extinction proxy; no Mie size-distribution solve'};
}

export function aerialPhaseFunctions(cosine,g=.76){
  const mu=clamp(cosine,-1,1),a=clamp(g,0,.9);
  return{rayleigh:3/(16*Math.PI)*(1+mu*mu),mie:(1-a*a)/(4*Math.PI*(1+a*a-2*a*mu)**1.5)};
}

// incidentRGB is already in the scene's stored-radiance reference. This source
// is per metre per steradian: no Lambert cosine, 1/pi, sun gain or second 2^P.
export function localAirSourceRGB({incidentRGB=[0,0,0],cosine=0,scatteringRayleigh=[0,0,0],scatteringMie=[0,0,0],asymmetry=.76}={}){
  const phase=aerialPhaseFunctions(cosine,asymmetry);
  return incidentRGB.map((value,c)=>Math.max(0,finite(value,0))*(Math.max(0,finite(scatteringRayleigh[c],0))*phase.rayleigh+Math.max(0,finite(scatteringMie[c],0))*phase.mie));
}

export function integrateHomogeneousAir({distance=0,betaExtinction=[0,0,0],sourceRGB=[0,0,0]}={}){
  const d=Math.max(0,distance),transmission=[],scattering=[];
  for(let c=0;c<3;c++){
    const sigma=Math.max(0,betaExtinction[c]),x=sigma*d,T=Math.exp(-x);
    const integral=x<1e-5?d*(1-x*.5+x*x/6):-Math.expm1(-x)/sigma;
    transmission.push(T);scattering.push(Math.max(0,sourceRGB[c])*integral);
  }
  return{transmission,scattering};
}
export function composeAerialRGB(colour,medium){return colour.map((v,c)=>v*medium.transmission[c]+medium.scattering[c]);}

function backgroundFlag(value){
  if(value===0||value===false)return 0;
  if(value===1||value===true)return 1;
  throw new TypeError('Aerial backgroundLocalScattering must be 0 or 1 (or a boolean).');
}
function localModel(value){if(value!=='quadratic'&&value!=='support')throw new RangeError("Aerial localScatteringModel must be 'quadratic' or 'support'.");return value;}

// Exact optical path through exp(-max(height,0)/H), including ground crossing.
// The small-x series avoids subtracting nearly equal endpoint densities.
export function exponentialHeightIntegral(height,verticalCosine,distance,scaleHeight){
  const y=finite(height,0),dy=clamp(finite(verticalCosine,0),-1,1),s=Math.max(0,finite(distance,0)),H=Math.max(1e-3,finite(scaleHeight,1200));
  if(s===0)return 0;
  const above=(y,dy,s)=>{const x=dy*s/H;return Math.abs(x)<1e-3?Math.exp(-y/H)*s*(1-x/2+x*x/6-x*x*x/24+x*x*x*x/120):(Math.exp(-y/H)-Math.exp(-Math.max(0,y+dy*s)/H))*H/dy;};
  const end=y+dy*s;if(y<=0&&end<=0)return s;if(y>=0&&end>=0)return Math.max(0,above(y,dy,s));
  const crossing=-y/dy;
  return Math.max(0,y<0?crossing+above(0,dy,s-crossing):above(y,dy,crossing)+s-crossing);
}

// This bounds the positive support quadrature itself. With h=max(perp,r_eff),
// ds/dtheta divided by the shared finite inverse-square denominator is <=2/h;
// positive Gauss weights sum to an angular interval <=pi. T/cut/cone/shadow<=1.
export function supportLocalAirRadianceBound({sources=[],coefficients:air=marineAirCoefficients()}={}){
  const g=clamp(finite(air.asymmetry,.76),0,.9),phaseR=3/(8*Math.PI),phaseM=(1+g)/(4*Math.PI*(1-g)**2),maximumRGB=[0,0,0];let activeSources=0;
  for(let i=0;i<Math.min(LOCAL_LIGHT_COUNT,sources.length);i++){
    const source=sources[i],rgb=source?.rawRGB,radius=source?.radius,range=source?.range;
    if(!Array.isArray(rgb)||rgb.length<3||!rgb.every(Number.isFinite)||!Number.isFinite(radius)||!(radius>0)||!Number.isFinite(range)||!(range>0)||!rgb.some(v=>v>0))continue;
    const effectiveRadius=i<3?Math.max(.1,radius):radius;
    for(let c=0;c<3;c++){const scatter=Math.max(0,finite(air.betaRayleighRGB?.[c],0))*phaseR+Math.max(0,finite(air.betaMieScatteringRGB?.[c],0))*phaseM,value=scatter===0?0:Math.max(0,rgb[c])*(2*Math.PI/effectiveRadius)*scatter;maximumRGB[c]=Math.min(Number.MAX_VALUE,maximumRGB[c]+value);}
    activeSources++;
  }
  return{maxRGB:Math.max(...maximumRGB),maximumRGB,activeSources,phaseMaximum:{rayleigh:phaseR,mie:phaseM},reference:'raw support-quadrature bound: finite E denominator cancels theta Jacobian <=2/h; positive angular weights total <=pi; no storage exposure',limits:['Conservative quadrature bound, not a brightness multiplier or measured photometry','Source-to-sample air extinction remains omitted; cone/range/shadows only reduce this bound']};
}

// Raw-radiance bound, before scene storage exposure. At every segment and RGB
// channel, source <= Emax * phaseBound * extinction. The positive segment
// weights telescope: sum(T * (1-exp(-sigma*ds))) = 1-T <= 1. Altitude only
// lowers sigma from its sea-level maximum. This also bounds the existing
// midpoint approximation, even when a finite light occupies part of a segment.
export function localAirRadianceBound({sources=[],coefficients:air=marineAirCoefficients(),maxDistance=12000}={}){
  const phaseR=3/(8*Math.PI),g=clamp(finite(air.asymmetry,.76),0,.9),phaseM=(1+g)/(4*Math.PI*(1-g)**2);
  const distance=clamp(finite(maxDistance,12000),0,24000),incidentRGB=[0,0,0];let activeSources=0;
  for(let i=0;i<Math.min(LOCAL_LIGHT_COUNT,sources.length);i++){
    const source=sources[i],rgb=source?.rawRGB,radius=source?.radius,range=source?.range;
    if(!Array.isArray(rgb)||rgb.length<3||!rgb.every(Number.isFinite)||!Number.isFinite(radius)||!(radius>0)||!Number.isFinite(range)||!(range>0))continue;
    if(!rgb.some(v=>v>0))continue;
    const denominator=i<3?Math.max(.01,radius*radius):radius*radius;
    for(let c=0;c<3;c++)incidentRGB[c]=Math.min(Number.MAX_VALUE,incidentRGB[c]+Math.max(0,rgb[c])/denominator);
    activeSources++;
  }
  const maximumRGB=incidentRGB.map((E,c)=>{
    const r=Math.max(0,finite(air.betaRayleighRGB?.[c],0)),me=Math.max(0,finite(air.betaMieExtinctionRGB?.[c],0)),ms=Math.max(0,finite(air.betaMieScatteringRGB?.[c],0));
    const phase=Math.max(r>0?phaseR:0,me>0?phaseM*Math.min(1,ms/me):0);
    const probability=-Math.expm1(-(r+me)*distance);
    return phase===0||probability===0?0:Math.min(Number.MAX_VALUE,E*phase*probability);
  });
  return{maxRGB:Math.max(...maximumRGB),maximumRGB,activeSources,phaseMaximum:{rayleigh:phaseR,mie:phaseM},reference:'raw local Emax times phase bound and finite-path single-scattering probability; no storage exposure applied',limits:['Conservative bound on the current midpoint integration, not a prediction of average image brightness','Finite range/cone/shadows only reduce this bound; source-to-sample extinction is omitted just as in the shared local source']};
}

export function createAerialPerspective(THREE,renderer,{camera,atmosphere=null,sunLight=null,localLights=null}={}){
  if(!camera?.isPerspectiveCamera)throw new Error('Aerial perspective requires a standard perspective camera.');
  const configuration={...AERIAL_DEFAULTS},binding=createSunShadowBinding(THREE,sunLight),sampling={steps:null,shadowTaps:null};
  const hasLocalLights=!!localLights?.uniforms;
  let width=1,height=1,halfWidth=1,halfHeight=1,frames=0,lastTime=0,lastCPU=0,disposed=false;
  let coefficients=marineAirCoefficients(configuration);
  const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);white.needsUpdate=true;
  const volumeTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,count:2,depthBuffer:false,stencilBuffer:false});
  volumeTarget.textures[0].name='Aerial single scatter / view depth';volumeTarget.textures[1].name='Aerial RGB transmittance';
  for(const texture of volumeTarget.textures){texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.NearestFilter;}
  const compositeTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});compositeTarget.texture.colorSpace=THREE.NoColorSpace;compositeTarget.texture.name='Unified linear HDR aerial perspective';
  const uniforms={...binding.uniforms,...(hasLocalLights?localLights.uniforms:{}),
    uColour:{value:null},uDepth:{value:null},uScatter:{value:volumeTarget.textures[0]},uTransmission:{value:volumeTarget.textures[1]},
    uSize:{value:new THREE.Vector2(1,1)},uHalfSize:{value:new THREE.Vector2(1,1)},uInverseProjection:{value:new THREE.Matrix4()},uCameraWorld:{value:new THREE.Matrix4()},uEye:{value:new THREE.Vector3()},
    uBetaR:{value:new THREE.Vector3()},uBetaME:{value:new THREE.Vector3()},uBetaMS:{value:new THREE.Vector3()},uHeights:{value:new THREE.Vector2(8000,1200)},
    uSunRGB:{value:new THREE.Vector3(3.6,3.6,3.6)},uSunDirection:{value:new THREE.Vector3(.4,.8,.3).normalize()},
    uMaxDistance:{value:12000},uAsymmetry:{value:.76},uSteps:{value:8},uShadowTaps:{value:2},uCopy:{value:0},uVolumeShadows:{value:1},uBackgroundLocalScattering:{value:0},uLocalScatteringModel:{value:0},
    uCloudShadowMap:{value:white},uCloudShadowFar:{value:white},uCloudShadowExtent:{value:256},uCloudShadowFarExtent:{value:8192},
  };
  const vertex=/* glsl */`precision highp float;in vec3 position;out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}`;
  const mediumGLSL=/* glsl */`
    precision highp float;precision highp int;
    uniform highp sampler2D uDepth,uCloudShadowMap,uCloudShadowFar,uSunShadowMap;
    uniform mat4 uInverseProjection,uCameraWorld,uSunShadowMatrix;
    uniform vec3 uEye,uBetaR,uBetaME,uBetaMS,uSunRGB,uSunDirection;
    uniform vec2 uSize,uHalfSize,uHeights,uSunShadowSize;
    uniform float uMaxDistance,uAsymmetry,uCloudShadowExtent,uCloudShadowFarExtent;
    uniform float uSunShadowEnabled,uSunShadowBias,uSunShadowIntensity,uSunShadowRadius;
    uniform int uSteps,uShadowTaps,uVolumeShadows,uBackgroundLocalScattering,uLocalScatteringModel;
    #include <packing>
    ${hasLocalLights?(localLights.glsl||localLightGLSL):''}
    vec3 viewPoint(vec2 uv,float depth){vec4 p=uInverseProjection*vec4(uv*2.-1.,depth*2.-1.,1.);return p.xyz/p.w;}
    vec3 worldPoint(vec2 uv,float depth){return (uCameraWorld*vec4(viewPoint(uv,depth),1.)).xyz;}
    float cachedCloud(vec3 p){
      vec2 projected=p.xz-uSunDirection.xz*max(0.,p.y-1.)/max(.08,uSunDirection.y);
      vec2 nearUV=projected/(2.*uCloudShadowExtent)+.5,farUV=projected/(2.*uCloudShadowFarExtent)+.5;
      float covered=1.-smoothstep(.45,.495,max(abs(nearUV.x-.5),abs(nearUV.y-.5)));
      return mix(textureLod(uCloudShadowFar,clamp(farUV,vec2(.002),vec2(.998)),0.).r,textureLod(uCloudShadowMap,clamp(nearUV,vec2(.001),vec2(.999)),0.).r,covered);
    }
    float treeVisibility(vec3 p){
      if(uSunShadowEnabled<.5)return 1.;
      vec4 h=uSunShadowMatrix*vec4(p,1.);vec3 c=h.xyz/max(h.w,1e-6);
      if(c.z<0.||c.z>1.||any(lessThan(c.xy,vec2(0.)))||any(greaterThan(c.xy,vec2(1.))))return 1.;
      float result=0.;
      for(int i=0;i<2;i++){
        if(i>=uShadowTaps)break;
        vec2 offset=uShadowTaps==1?vec2(0.):vec2(i==0?-.45:.45,.15)*max(1.,uSunShadowRadius)/uSunShadowSize;
        vec2 uv=c.xy+offset;
        float visible=1.;
        if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))visible=step(c.z+uSunShadowBias,unpackRGBAToDepth(textureLod(uSunShadowMap,uv,0.)));
        result+=visible;
      }
      return mix(1.,result/float(uShadowTaps),clamp(uSunShadowIntensity,0.,1.));
    }
    void coefficientsAt(vec3 p,out vec3 extinction,out vec3 scatteringR,out vec3 scatteringM){
      float altitude=max(0.,p.y),r=exp(-altitude/uHeights.x),m=exp(-altitude/uHeights.y);
      scatteringR=uBetaR*r;scatteringM=uBetaMS*m;extinction=scatteringR+uBetaME*m;
    }
    vec3 segmentIntegral(vec3 sigma,float ds){
      vec3 x=sigma*ds;
      vec3 exact=(1.-exp(-x))/max(sigma,vec3(1e-12));
      return mix(exact,ds*(1.-x*.5+x*x/6.),lessThan(x,vec3(1e-4)));
    }
    vec3 sourceAt(vec3 p,vec3 direction,vec3 scatterR,vec3 scatterM){
      float mu=clamp(dot(direction,uSunDirection),-1.,1.);
      float phaseR=3./(16.*3.141592653589793)*(1.+mu*mu);
      float g=uAsymmetry,phaseM=(1.-g*g)/(4.*3.141592653589793*pow(max(1e-5,1.+g*g-2.*g*mu),1.5));
      // uSunRGB is already the scene's atmospheric-transmitted sunlight.
      // Apply local tree/cloud visibility ONCE; no second upper-atmosphere ray.
      float visibility=uVolumeShadows==1?cachedCloud(p)*treeVisibility(p):1.;
      vec3 source=uSunRGB*(scatterR*phaseR+scatterM*phaseM)*visibility;
      ${hasLocalLights?`
      for(int i=0;i<${LOCAL_LIGHT_COUNT};i++){
        vec3 colour=uLocalColour[i].rgb,position=uLocalPosition[i].xyz;
        float power=max(max(colour.r,colour.g),colour.b),range=uLocalCone[i].z;
        if(!(power>0.)||!(range>0.)||isinf(range)||any(isnan(colour))||any(isinf(colour))||any(isnan(uLocalPosition[i]))||any(isinf(uLocalPosition[i])))continue;
        vec3 delta=position-p;float distanceSquared=dot(delta,delta);
        if(distanceSquared>=range*range)continue;
        vec3 localL;
        // localIncident includes finite-radius inverse square, range/cone and
        // the shared flashlight shadow. Its RGB already includes sceneScale.
        vec3 E=localIncident(p,i,localL);
        float localMu=clamp(dot(direction,localL),-1.,1.);
        float localR=3./(16.*3.141592653589793)*(1.+localMu*localMu);
        float localM=(1.-g*g)/(4.*3.141592653589793*pow(max(1e-5,1.+g*g-2.*g*localMu),1.5));
        source+=E*(scatterR*localR+scatterM*localM);
      }`:''}
      return source;
    }
    void integrateAir(vec3 endpoint,int steps,out vec3 T,out vec3 S){
      vec3 ray=endpoint-uEye;float distance=min(length(ray),uMaxDistance);vec3 direction=normalize(ray);
      T=vec3(1.);S=vec3(0.);
      for(int i=0;i<8;i++){
        if(i>=steps)break;
        float a=float(i)/float(steps),b=float(i+1)/float(steps);
        // More samples near the observer preserve local tree-volume shadows.
        float start=a*a*distance,end=b*b*distance,ds=end-start;
        vec3 p=uEye+direction*((start+end)*.5),extinction,scatterR,scatterM;
        coefficientsAt(p,extinction,scatterR,scatterM);
        S+=T*sourceAt(p,direction,scatterR,scatterM)*segmentIntegral(extinction,ds);
        T*=exp(-extinction*ds);
      }
    }
    // The sky shader has already integrated global atmospheric sunlight. Only
    // this local source is missing there; never apply its global T or S twice.
    bool backgroundLocalActive(){
      ${hasLocalLights?`
      for(int i=0;i<${LOCAL_LIGHT_COUNT};i++){
        vec3 colour=uLocalColour[i].rgb;float range=uLocalCone[i].z;
        if(max(max(colour.r,colour.g),colour.b)>0.&&range>0.&&!isinf(range)&&!any(isnan(colour))&&!any(isinf(colour))&&!any(isnan(uLocalPosition[i]))&&!any(isinf(uLocalPosition[i])))return true;
      }`:''}
      return false;
    }
    vec3 backgroundLocalSourceAt(vec3 p,vec3 direction,vec3 scatterR,vec3 scatterM){
      vec3 source=vec3(0.);float g=uAsymmetry;
      ${hasLocalLights?`
      for(int i=0;i<${LOCAL_LIGHT_COUNT};i++){
        vec3 colour=uLocalColour[i].rgb,position=uLocalPosition[i].xyz;
        float power=max(max(colour.r,colour.g),colour.b),range=uLocalCone[i].z;
        if(!(power>0.)||!(range>0.)||isinf(range)||any(isnan(colour))||any(isinf(colour))||any(isnan(uLocalPosition[i]))||any(isinf(uLocalPosition[i])))continue;
        vec3 delta=position-p;float distanceSquared=dot(delta,delta);
        if(distanceSquared>=range*range)continue;
        vec3 localL,E=localIncident(p,i,localL);
        float localMu=clamp(dot(direction,localL),-1.,1.);
        float localR=3./(16.*3.141592653589793)*(1.+localMu*localMu);
        float localM=(1.-g*g)/(4.*3.141592653589793*pow(max(1e-5,1.+g*g-2.*g*localMu),1.5));
        source+=E*(scatterR*localR+scatterM*localM);
      }`:''}
      return source;
    }
    void integrateBackgroundLocalAir(vec3 endpoint,int steps,out vec3 S){
      vec3 ray=endpoint-uEye;float distance=min(length(ray),uMaxDistance);vec3 direction=normalize(ray),T=vec3(1.);S=vec3(0.);
      for(int i=0;i<8;i++){
        if(i>=steps)break;
        float a=float(i)/float(steps),b=float(i+1)/float(steps);
        float start=a*a*distance,end=b*b*distance,ds=end-start;
        vec3 p=uEye+direction*((start+end)*.5),extinction,scatterR,scatterM;
        coefficientsAt(p,extinction,scatterR,scatterM);
        S+=T*backgroundLocalSourceAt(p,direction,scatterR,scatterM)*segmentIntegral(extinction,ds);
        T*=exp(-extinction*ds);
      }
    }
    float aboveHeightIntegral(float y,float dy,float s,float H){
      float x=dy*s/H;
      if(abs(x)<.001)return exp(-y/H)*s*(1.-x*.5+x*x/6.-x*x*x/24.+x*x*x*x/120.);
      return (exp(-y/H)-exp(-max(0.,y+dy*s)/H))*H/dy;
    }
    float heightIntegral(float y,float dy,float s,float H){
      if(s<=0.)return 0.;float end=y+dy*s;
      if(y<=0.&&end<=0.)return s;
      if(y>=0.&&end>=0.)return max(0.,aboveHeightIntegral(y,dy,s,H));
      float crossing=-y/dy;
      return max(0.,y<0.?crossing+aboveHeightIntegral(0.,dy,s-crossing,H):aboveHeightIntegral(y,dy,crossing,H)+s-crossing);
    }
    vec3 localViewTransmission(float s,vec3 direction){
      float r=heightIntegral(uEye.y,direction.y,s,uHeights.x),m=heightIntegral(uEye.y,direction.y,s,uHeights.y);
      return exp(-uBetaR*r-uBetaME*m);
    }
    vec3 solarSourceAt(vec3 p,vec3 direction,vec3 scatterR,vec3 scatterM){
      float mu=clamp(dot(direction,uSunDirection),-1.,1.);
      float phaseR=3./(16.*3.141592653589793)*(1.+mu*mu);
      float g=uAsymmetry,phaseM=(1.-g*g)/(4.*3.141592653589793*pow(max(1e-5,1.+g*g-2.*g*mu),1.5));
      float visibility=uVolumeShadows==1?cachedCloud(p)*treeVisibility(p):1.;
      return uSunRGB*(scatterR*phaseR+scatterM*phaseM)*visibility;
    }
    void integrateSolarAir(vec3 endpoint,int steps,out vec3 T,out vec3 S){
      vec3 ray=endpoint-uEye;float distance=min(length(ray),uMaxDistance);vec3 direction=normalize(ray);T=vec3(1.);S=vec3(0.);
      for(int i=0;i<8;i++){
        if(i>=steps)break;float a=float(i)/float(steps),b=float(i+1)/float(steps),start=a*a*distance,end=b*b*distance,ds=end-start;
        vec3 p=uEye+direction*((start+end)*.5),extinction,scatterR,scatterM;coefficientsAt(p,extinction,scatterR,scatterM);
        S+=T*solarSourceAt(p,direction,scatterR,scatterM)*segmentIntegral(extinction,ds);T*=exp(-extinction*ds);
      }
    }
    const float GL6X[8]=float[8](-.932469514203152,-.661209386466265,-.238619186083197,.238619186083197,.661209386466265,.932469514203152,0.,0.);
    const float GL6W[8]=float[8](.171324492379170,.360761573048139,.467913934572691,.467913934572691,.360761573048139,.171324492379170,0.,0.);
    const float GL8X[8]=float[8](-.960289856497536,-.796666477413627,-.525532409916329,-.183434642495650,.183434642495650,.525532409916329,.796666477413627,.960289856497536);
    const float GL8W[8]=float[8](.101228536290376,.222381034453374,.313706645877887,.362683783378362,.362683783378362,.313706645877887,.222381034453374,.101228536290376);
    void integrateSupportLocalAir(vec3 endpoint,out vec3 S){
      S=vec3(0.);
      ${hasLocalLights?`
      vec3 ray=endpoint-uEye;float distance=min(length(ray),uMaxDistance);vec3 direction=normalize(ray);int nodes=uSteps<=6?6:8;float g=uAsymmetry;
      for(int light=0;light<${LOCAL_LIGHT_COUNT};light++){
        vec3 colour=uLocalColour[light].rgb,position=uLocalPosition[light].xyz;float range=uLocalCone[light].z;
        if(!(max(max(colour.r,colour.g),colour.b)>0.)||!(range>0.)||isinf(range)||any(isnan(colour))||any(isinf(colour))||any(isnan(uLocalPosition[light]))||any(isinf(uLocalPosition[light])))continue;
        vec3 centre=position-uEye;float closest=dot(centre,direction);vec3 perpendicular=centre-direction*closest;
        // Subtract vectors before squaring: |centre|^2-closest^2 loses the
        // small perpendicular distance for far, almost-collinear lights.
        float perp2=dot(perpendicular,perpendicular),disc=range*range-perp2;
        if(disc<=0.)continue;float reach=sqrt(disc),lo=max(0.,closest-reach),hi=min(distance,closest+reach);if(hi<=lo)continue;
        float radius=max(abs(uLocalPosition[light].w),1e-8);if(light<3)radius=max(radius,.1);
        float h=sqrt(max(perp2,radius*radius)),a=atan((lo-closest)/h),b=atan((hi-closest)/h),middle=clamp(0.,a,b);
        for(int panel=0;panel<2;panel++){
          float start=panel==0?a:middle,end=panel==0?middle:b,halfAngle=(end-start)*.5,midAngle=(start+end)*.5;if(halfAngle<=0.)continue;
          for(int k=0;k<8;k++){
            if(k>=nodes)break;float node=nodes==6?GL6X[k]:GL8X[k],weight=nodes==6?GL6W[k]:GL8W[k],angle=midAngle+halfAngle*node,t=tan(angle),s=closest+h*t,jacobian=h*(1.+t*t);
            vec3 p=uEye+direction*s,extinction,scatterR,scatterM;coefficientsAt(p,extinction,scatterR,scatterM);
            vec3 localL,E=localIncident(p,light,localL);float mu=clamp(dot(direction,localL),-1.,1.),pr=3./(16.*3.141592653589793)*(1.+mu*mu),pm=(1.-g*g)/(4.*3.141592653589793*pow(max(1e-5,1.+g*g-2.*g*mu),1.5));
            S+=localViewTransmission(s,direction)*E*(scatterR*pr+scatterM*pm)*(halfAngle*weight*jacobian);
          }
        }
      }`:''}
    }
    void integrateSelectedAir(vec3 endpoint,int steps,out vec3 T,out vec3 S){
      if(uLocalScatteringModel==0||uBackgroundLocalScattering!=1){integrateAir(endpoint,steps,T,S);return;}
      integrateSolarAir(endpoint,steps,T,S);vec3 localS;integrateSupportLocalAir(endpoint,localS);S+=localS;
    }
    void integrateSelectedBackgroundLocalAir(vec3 endpoint,out vec3 S){
      if(uLocalScatteringModel==0)integrateBackgroundLocalAir(endpoint,uSteps,S);
      else integrateSupportLocalAir(endpoint,S);
    }
  `;
  const integration=/* glsl */`${mediumGLSL}
    in vec2 vUv;layout(location=0) out vec4 scatterOutput;layout(location=1) out vec4 transmissionOutput;
    void main(){
      ivec2 base=ivec2(gl_FragCoord.xy)*2,fullSize=ivec2(uSize);float nearest=1.;ivec2 selected=clamp(base,ivec2(0),fullSize-1);
      for(int y=0;y<2;y++)for(int x=0;x<2;x++){
        ivec2 coordinate=clamp(base+ivec2(x,y),ivec2(0),fullSize-1);float depth=texelFetch(uDepth,coordinate,0).r;
        if(depth<nearest){nearest=depth;selected=coordinate;}
      }
      if(nearest>=.9999999){
        if(uBackgroundLocalScattering!=1||!backgroundLocalActive()){scatterOutput=vec4(0.,0.,0.,-1.);transmissionOutput=vec4(1.);return;}
        vec2 uv=(vec2(selected)+.5)/uSize;vec3 S;
        integrateSelectedBackgroundLocalAir(worldPoint(uv,1.),S);
        // -2 is valid local-only sky; -1 remains the legacy empty sky marker.
        scatterOutput=vec4(S,-2.);transmissionOutput=vec4(1.);return;
      }
      vec2 uv=(vec2(selected)+.5)/uSize;vec3 eyePoint=viewPoint(uv,nearest),T,S;
      integrateSelectedAir((uCameraWorld*vec4(eyePoint,1.)).xyz,uSteps,T,S);
      scatterOutput=vec4(S,max(0.,-eyePoint.z));transmissionOutput=vec4(T,1.);
    }
  `;
  const composite=/* glsl */`${mediumGLSL}
    uniform highp sampler2D uColour,uScatter,uTransmission;
    uniform int uCopy;in vec2 vUv;out vec4 fragColor;
    void main(){
      ivec2 full=clamp(ivec2(gl_FragCoord.xy),ivec2(0),ivec2(uSize)-1);vec4 colour=texelFetch(uColour,full,0);
      float depth=texelFetch(uDepth,full,0).r;
      if(uCopy==1){fragColor=colour;return;}
      if(depth>=.9999999){
        if(uBackgroundLocalScattering!=1||!backgroundLocalActive()){fragColor=colour;return;}
        vec2 grid=vUv*uHalfSize-.5;ivec2 corner=ivec2(floor(grid));vec2 f=fract(grid);vec3 S=vec3(0.);float weights=0.;
        for(int y=0;y<2;y++)for(int x=0;x<2;x++){
          ivec2 coordinate=clamp(corner+ivec2(x,y),ivec2(0),ivec2(uHalfSize)-1);vec4 scatter=texelFetch(uScatter,coordinate,0);
          float spatial=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y),weight=scatter.a< -1.5?spatial:0.;
          S+=scatter.rgb*weight;weights+=weight;
        }
        if(weights>1e-4)S/=weights;
        else integrateSelectedBackgroundLocalAir(worldPoint(vUv,1.),S);
        fragColor=vec4(colour.rgb+S,colour.a);return;
      }
      vec3 eyePoint=viewPoint(vUv,depth);float viewDepth=max(0.,-eyePoint.z);
      vec2 grid=vUv*uHalfSize-.5;ivec2 corner=ivec2(floor(grid));vec2 f=fract(grid);
      vec3 S=vec3(0.),T=vec3(0.);float weights=0.;
      for(int y=0;y<2;y++)for(int x=0;x<2;x++){
        ivec2 coordinate=clamp(corner+ivec2(x,y),ivec2(0),ivec2(uHalfSize)-1);vec4 scatter=texelFetch(uScatter,coordinate,0);
        float spatial=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);
        float bilateral=exp(-abs(scatter.a-viewDepth)/max(.30,.015*viewDepth));
        float weight=scatter.a<0.?0.:spatial*bilateral;
        S+=scatter.rgb*weight;T+=texelFetch(uTransmission,coordinate,0).rgb*weight;weights+=weight;
      }
      if(weights>1e-4){S/=weights;T/=weights;}
      else integrateSelectedAir((uCameraWorld*vec4(eyePoint,1.)).xyz,1,T,S);
      fragColor=vec4(colour.rgb*T+S,colour.a);
    }
  `;
  const integrationMaterial=new THREE.RawShaderMaterial({name:'Finite marine-air single scattering / half resolution',glslVersion:THREE.GLSL3,uniforms,vertexShader:vertex,fragmentShader:integration,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
  const compositeMaterial=new THREE.RawShaderMaterial({name:'Depth-aware aerial reconstruction / linear HDR',glslVersion:THREE.GLSL3,uniforms,vertexShader:vertex,fragmentShader:composite,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const scene=new THREE.Scene(),passCamera=new THREE.Camera(),quad=new THREE.Mesh(geometry,integrationMaterial);quad.frustumCulled=false;scene.add(quad);
  function applyCoefficients(){
    coefficients=marineAirCoefficients(configuration);uniforms.uBetaR.value.fromArray(coefficients.betaRayleighRGB);uniforms.uBetaME.value.fromArray(coefficients.betaMieExtinctionRGB);uniforms.uBetaMS.value.fromArray(coefficients.betaMieScatteringRGB);
    uniforms.uHeights.value.set(coefficients.rayleighHeight,coefficients.aerosolHeight);uniforms.uAsymmetry.value=coefficients.asymmetry;uniforms.uMaxDistance.value=configuration.maxDistance;
    const high=configuration.quality==='high';uniforms.uSteps.value=sampling.steps??(high?8:6);uniforms.uShadowTaps.value=sampling.shadowTaps??(high?2:1);
    uniforms.uVolumeShadows.value=configuration.shadows?1:0;
    uniforms.uBackgroundLocalScattering.value=configuration.backgroundLocalScattering;
    uniforms.uLocalScatteringModel.value=configuration.localScatteringModel==='support'?1:0;
  }
  function setSize(w,h){
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1)throw new Error('Aerial dimensions must be finite positive physical pixels.');
    const limit=renderer.capabilities.maxTextureSize;width=clamp(Math.round(w),1,limit);height=clamp(Math.round(h),1,limit);halfWidth=Math.ceil(width/2);halfHeight=Math.ceil(height/2);
    volumeTarget.setSize(halfWidth,halfHeight);compositeTarget.setSize(width,height);uniforms.uSize.value.set(width,height);uniforms.uHalfSize.value.set(halfWidth,halfHeight);
  }
  function configure(patch={}){
    if(Object.hasOwn(patch,'backgroundLocalScattering'))backgroundFlag(patch.backgroundLocalScattering);
    if(Object.hasOwn(patch,'localScatteringModel'))localModel(patch.localScatteringModel);
    Object.assign(configuration,patch);configuration.enabled=Boolean(configuration.enabled);configuration.shadows=Boolean(configuration.shadows);configuration.aerosolScale=clamp(finite(configuration.aerosolScale,8),0,48);
    configuration.maxDistance=clamp(finite(configuration.maxDistance,12000),1,24000);configuration.quality=configuration.quality==='high'?'high':'balanced';configuration.backgroundLocalScattering=backgroundFlag(configuration.backgroundLocalScattering);applyCoefficients();return diagnostics();
  }
  function setBackgroundLocalScattering(value){return configure({backgroundLocalScattering:value});}
  function setLocalScatteringModel(value){return configure({localScatteringModel:localModel(value)});}
  function getRadianceBound(){
    if(!configuration.enabled||!hasLocalLights||configuration.backgroundLocalScattering!==1)return{maxRGB:0,maximumRGB:[0,0,0],activeSources:0,reference:'Optional local-air QA candidate inactive'};
    return(configuration.localScatteringModel==='support'?supportLocalAirRadianceBound:localAirRadianceBound)({sources:localLights.records||[],coefficients,maxDistance:configuration.maxDistance});
  }
  function setSampling(patch={}){
    const next={...sampling};
    for(const [key,max]of [['steps',8],['shadowTaps',2]])if(Object.hasOwn(patch,key)){
      if(patch[key]===null)next[key]=null;
      else{if(!Number.isFinite(patch[key]))throw new TypeError(`Aerial ${key} must be finite, or null to restore quality defaults`);next[key]=clamp(Math.round(patch[key]),1,max);}
    }
    Object.assign(sampling,next);applyCoefficients();return diagnostics();
  }
  function update({time=lastTime,weather=null,sunDirection=null,quality=null,sunLight:light=null}={}){
    lastTime=finite(time,lastTime);if(light)sunLight=light;
    const current=weather?.current||weather||atmosphere?.getWeatherState?.().current;
    if(current){configuration.humidity=finite(current.relativeHumidity,finite(current.humidity,configuration.humidity));}
    if(quality)configuration.quality=quality==='high'?'high':'balanced';
    for(const key of ['uCloudShadowMap','uCloudShadowFar','uCloudShadowExtent','uCloudShadowFarExtent'])if(atmosphere?.uniforms?.[key])uniforms[key]=atmosphere.uniforms[key];
    const direction=sunDirection?.value||sunDirection||atmosphere?.uniforms?.sunPosition?.value;
    if(direction?.isVector3)uniforms.uSunDirection.value.copy(direction).normalize();
    if(sunLight){uniforms.uSunRGB.value.set(sunLight.color.r,sunLight.color.g,sunLight.color.b).multiplyScalar(Math.max(0,sunLight.intensity));binding.update(sunLight);}
    else if(atmosphere?.lighting){const light=atmosphere.lighting();uniforms.uSunRGB.value.set(light.sunColor.r,light.sunColor.g,light.sunColor.b).multiplyScalar(3.6*light.sunStrength);}
    applyCoefficients();
  }
  function render({colour,depth,width:w=width,height:h=height,output=null}={}){
    if(disposed)throw new Error('Aerial perspective is disposed.');
    const input=colour?.texture||colour,depthInput=depth?.texture||depth;
    if(!input)throw new Error('Aerial perspective requires a linear HDR colour texture.');
    if(!configuration.enabled&&!output)return input;
    if(!depthInput)throw new Error('Aerial perspective requires standard perspective depth.');
    if(w!==width||h!==height)setSize(w,h);
    const destination=output||compositeTarget;
    if(destination.texture===input)throw new Error('Aerial output must not alias the input texture.');
    if(destination.width!==width||destination.height!==height)throw new Error('Aerial output dimensions must match colour/depth dimensions.');
    camera.updateMatrixWorld();uniforms.uInverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);uniforms.uEye.value.setFromMatrixPosition(camera.matrixWorld);
    uniforms.uColour.value=input;uniforms.uDepth.value=depthInput;uniforms.uCopy.value=configuration.enabled?0:1;binding.update(sunLight);
    const gl=renderer.getContext(),saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),currentScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),currentScissorTest:gl.isEnabled(gl.SCISSOR_TEST),autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
    const start=performance.now();
    try{
      renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
      // RenderTarget viewport/scissor are already PHYSICAL pixels. Calling
      // renderer.setViewport here would multiply them by the canvas DPR again.
      if(configuration.enabled){quad.material=integrationMaterial;renderer.setRenderTarget(volumeTarget);renderer.render(scene,passCamera);}
      quad.material=compositeMaterial;renderer.setRenderTarget(destination);renderer.render(scene,passCamera);frames++;
    }finally{
      // Preserve both the logical canvas viewport and a possibly overridden
      // current offscreen viewport; no public setViewport/scissor call is used.
      const previousViewport=saved.target?.viewport.clone(),previousScissor=saved.target?.scissor.clone(),previousScissorTest=saved.target?.scissorTest;
      if(saved.target){saved.target.viewport.copy(saved.currentViewport);saved.target.scissor.fromArray(saved.currentScissor);saved.target.scissorTest=saved.currentScissorTest;}
      try{renderer.setRenderTarget(saved.target,saved.face,saved.mip);}
      finally{if(saved.target){saved.target.viewport.copy(previousViewport);saved.target.scissor.copy(previousScissor);saved.target.scissorTest=previousScissorTest;}}
      renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;lastCPU=performance.now()-start;
    }
    return destination.texture;
  }
  function diagnostics(){return{enabled:configuration.enabled,shadows:configuration.shadows,quality:configuration.quality,dimensions:[width,height],integrationDimensions:[halfWidth,halfHeight],steps:uniforms.uSteps.value,treeShadowTapsPerStep:uniforms.uShadowTaps.value,frames,time:lastTime,coefficients:{...coefficients},maxDistanceMetres:configuration.maxDistance,
    samplingOverride:{...sampling},backgroundLocalScattering:configuration.backgroundLocalScattering,localScatteringModel:configuration.localScatteringModel,supportSamplesPerIntersectedLight:configuration.localScatteringModel==='support'&&configuration.backgroundLocalScattering===1?2*(uniforms.uSteps.value<=6?6:8):0,localLightsEnabled:hasLocalLights,localLightCount:hasLocalLights?LOCAL_LIGHT_COUNT:0,
    declaredSamplerBudget:{integration:hasLocalLights?5:4,composite:hasLocalLights?8:7},
    estimatedTargetBytes:width*height*8+halfWidth*halfHeight*16,lastCpuSubmitMilliseconds:lastCPU,gpuMilliseconds:null,
    source:'Shared scene sunlight after upper-atmosphere attenuation plus finite local incident RGB already multiplied by sceneScale; each uses Rayleigh/HG phase once',
    integration:configuration.localScatteringModel==='support'&&configuration.backgroundLocalScattering===1?'Solar T/S retain quadratic segments; local S uses range-sphere support, split closest-approach theta Gauss and analytic exponential-height view attenuation; half-res depth-class reconstruction':'Quadratically spaced finite-distance analytic segments; half-res RGB scattering/transmission, depth-aware 4-neighbour reconstruction',
    limits:[configuration.localScatteringModel==='support'?'At most6 lights times2 panels times6/8 positive Gauss nodes; no multiple scattering or full radiative transfer':'At most8-step single scattering; no multiple-scattering or full atmospheric radiative transfer','Local incident uses shared punctual finite-radius/range/cone falloff; source-to-sample air extinction is not separately integrated','Only the shared flashlight has local source shadows; ground lamps and two burst clusters retain their shared lighting approximation',configuration.backgroundLocalScattering===1?'Background sky adds local S only; global sky T/S are retained. Sky/opaque use separate reconstruction classes':'Sky depth bypasses the pass to avoid duplicate sky extinction',configuration.localScatteringModel==='support'?'Opaque edge fallback retains one solar midpoint; local support node count is identical on sky/opaque paths':'Opaque depth-edge fallback uses one midpoint; local sky fallback uses the configured segment count','No temporal random jitter/history; the pass does not hide motion with accumulation','Hygroscopic area growth is a prescribed aerosol proxy, not measured composition or a full Mie calculation','CPU submission time is not GPU cost or scene FPS']};}
  function dispose(){if(disposed)return;disposed=true;volumeTarget.dispose();compositeTarget.dispose();integrationMaterial.dispose();compositeMaterial.dispose();geometry.dispose();binding.dispose();white.dispose();}
  applyCoefficients();update();
  return{setSize,configure,setSampling,setBackgroundLocalScattering,setLocalScatteringModel,getRadianceBound,update,render,diagnostics,dispose,get target(){return compositeTarget;},get volumeTarget(){return volumeTarget;},get uniforms(){return uniforms;}};
}
