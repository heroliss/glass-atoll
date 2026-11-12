// Shared by geometry, optical normals, and refracted sunlight. Metres/seconds.
// Gravity-capillary dispersion: omega²=(g*k+sigma/rho*k³)*tanh(k*h).
// h=3 m is the fine-wave reference depth. Resolved long waves use bathymetry.
// A dense seeded directional spectrum is evaluated once into four periodic GPU
// fields. Incommensurate domains prevent a shared short repeat, while mipmapped
// slope moments retain the unresolved energy for the water BRDF.
let seed=40319;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
export const waveCascades=[
  {domain:521,lo:.12,hi:.65,count:64,slopeRMS:.006},
  {domain:137,lo:.65,hi:3,count:64,slopeRMS:.025},
  {domain:29,lo:3,hi:14,count:64,slopeRMS:.055},
  {domain:5.3,lo:14,hi:100,count:64,slopeRMS:.090},
];
export const waveComponents=[];
for(let cascade=0;cascade<waveCascades.length;cascade++){
  const band=waveCascades[cascade],modes=[],seen=new Set();
  for(let i=0;i<band.count;i++){
    let modeX,modeZ,k,angle,key;
    do{
      const targetK=band.lo*Math.pow(band.hi/band.lo,random());
      const gaussian=Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());
      // A broad local wind sea plus a weaker crossing swell. Independent
      // phases and Rayleigh amplitudes produce short, irregular crest groups.
      angle=random()<.77?.36+gaussian*.52:-.68+gaussian*.30;
      modeX=Math.round(Math.cos(angle)*targetK*band.domain/(2*Math.PI));
      modeZ=Math.round(Math.sin(angle)*targetK*band.domain/(2*Math.PI));
      k=2*Math.PI*Math.hypot(modeX,modeZ)/band.domain;key=`${modeX},${modeZ}`;
    }while(k<band.lo||k>band.hi||seen.has(key));
    seen.add(key);angle=Math.atan2(modeZ,modeX);
    const amplitude=Math.sqrt(-2*Math.log(Math.max(1e-9,random())))/k;
    modes.push({k,amplitude,angle,phase:random()*2*Math.PI,modeX,modeZ,cascade,domain:band.domain});
  }
  const measured=Math.sqrt(modes.reduce((sum,w)=>sum+(w.amplitude*w.k)**2/2,0));
  for(const mode of modes){mode.amplitude*=band.slopeRMS/measured;waveComponents.push(mode);}
}
export const waveStatistics={components:waveComponents.length,rmsSlope:Math.sqrt(waveComponents.reduce((s,w)=>s+(w.amplitude*w.k)**2/2,0)),rmsHeight:Math.sqrt(waveComponents.reduce((s,w)=>s+w.amplitude*w.amplitude/2,0))};
waveStatistics.significantHeight=4*waveStatistics.rmsHeight;
waveStatistics.specularExposureSeconds=1/120;
waveStatistics.temporalSlopeVariance=waveComponents.reduce((sum,w)=>{const omega=Math.sqrt((9.81*w.k+.000070244*w.k**3)*Math.tanh(Math.min(w.k*3,4)));return sum+.5*(w.amplitude*w.k*omega)**2;},0)*waveStatistics.specularExposureSeconds**2/12;
// Cox–Munk's measured total slope variance grows approximately linearly with
// wind speed. Wave amplitude therefore grows with sqrt(variance), not speed.
// Below a very light breeze we fade this authored wind sea away; swell remains.
export function waveWindFactor(speed){const u=Math.max(0,Number(speed)||0),t=Math.min(1,u/.35);return Math.sqrt((.003+.00512*u)/(.003+.00512*1.8))*t*t*(3-2*t);}
const gl=x=>Number(x).toFixed(8);
const spectralSum=waveComponents.map(w=>`f+=spectralWave(p,vec2(${gl(Math.cos(w.angle))},${gl(Math.sin(w.angle))}),${gl(w.k)},${gl(w.amplitude)},${gl(w.phase)});`).join('\n');
export const waveGLSL=/* glsl */`
  uniform float uTime;
  uniform vec4 uRipples[8];
  uniform float uWind;
  uniform vec2 uMeanCurrent;
  uniform vec2 uCurrentOffset;
  uniform vec2 uRippleOffsets[8];
  uniform highp sampler2D uHydroState;
  uniform float uHydroExtent;
  uniform float uHydroResolution;
  uniform float uHydroEnabled;
  uniform highp sampler2D uWave0,uWave1,uWave2,uWave3;
  uniform vec4 uWaveDomains;
  uniform float uWaveResolution;
  float unresolvedSlopeVariance=0.;
  #ifdef OPTICAL_PASS
    float opticalFootprint=0.;
  #endif
  vec3 spectralWave(vec2 p,vec2 direction,float k,float amplitude,float phase){
    #ifdef OPTICAL_PASS
      amplitude*=1.-smoothstep(1.,3.14159,k*opticalFootprint);
    #endif
    #ifdef CAUSTICS_PASS
      #ifdef CAUSTIC_LOW_QUALITY
        amplitude*=1.-smoothstep(6.,10.,k);
      #else
        amplitude*=1.-smoothstep(12.,19.,k);
      #endif
    #endif
    #ifdef GEOMETRY_PASS
      amplitude*=1.-smoothstep(5.,9.,k);
    #endif
    float omega=sqrt((9.81*k+0.000070244*k*k*k)*tanh(min(k*3.,4.)));
    float a=dot(p-uCurrentOffset,direction)*k-omega*uTime+phase;
    float derivative=amplitude*k*cos(a)*uWind;
    return vec3(amplitude*sin(a)*uWind,direction*derivative);
  }
  float resolvedHeight(vec2 p){
    if(uHydroEnabled<.5)return 0.;
    if(max(abs(p.x),abs(p.y))>=uHydroExtent*.98)return 0.;
    float mask=1.-smoothstep(uHydroExtent*.84,uHydroExtent*.98,max(abs(p.x),abs(p.y)));
    return textureLod(uHydroState,p/(2.*uHydroExtent)+.5,0.0).r*mask;
  }
  vec4 spectrumSample(highp sampler2D field,vec2 p,float domain,float footprint){
    float lod=max(0.,log2(max(1.,footprint*uWaveResolution/domain)));
    return textureLod(field,(p-uCurrentOffset)/domain,lod);
  }
  vec3 sampledSpectrum(vec2 p){
    float footprint=.028;
    #ifdef OPTICAL_PASS
      footprint=max(.028,opticalFootprint*1.15);
    #endif
    #ifdef GEOMETRY_PASS
      footprint=.40;
    #endif
    #ifdef CAUSTICS_PASS
      #ifdef CAUSTIC_LOW_QUALITY
        footprint=.32;
      #else
        footprint=.12;
      #endif
    #endif
    vec4 a=spectrumSample(uWave0,p,uWaveDomains.x,footprint);
    vec4 b=spectrumSample(uWave1,p,uWaveDomains.y,footprint);
    vec4 c=spectrumSample(uWave2,p,uWaveDomains.z,footprint);
    vec4 d=spectrumSample(uWave3,p,uWaveDomains.w,footprint);
    // E(|s|²) - |E(s)|²: missing fine slopes broaden reflection instead of
    // vanishing into a mirror. Each independent cascade contributes variance.
    unresolvedSlopeVariance=max(0.,a.w-dot(a.yz,a.yz))+max(0.,b.w-dot(b.yz,b.yz))+max(0.,c.w-dot(c.yz,c.yz))+max(0.,d.w-dot(d.yz,d.yz));
    unresolvedSlopeVariance*=uWind*uWind;
    return (a.xyz+b.xyz+c.xyz+d.xyz)*uWind;
  }
  vec3 waterField(vec2 p){
    vec3 f=vec3(0.);
    #ifdef BAKED_WAVE_TEXTURES
    f=sampledSpectrum(p);
    #else
    ${spectralSum}
    #endif
    for(int i=0;i<8;i++){
      float age=uTime-uRipples[i].z;
      if(age>0. && age<8.){
        vec2 delta=p-uRipples[i].xy-uCurrentOffset+uRippleOffsets[i];
        float d=max(length(delta),.001);
        // A gravity-capillary packet has distinct phase and group velocities.
        // k=11 rad/m in the same 3 m reference layer: cp≈.945, cg≈.473 m/s.
        float ring=d-age*.47320299;
        float phase=11.*d-10.39247299*age;
        float envelope=exp(-ring*ring*4.0)*exp(-age*.38)/sqrt(1.+d);
        float a=.065*uRipples[i].w;
        float h=sin(phase)*envelope*a;
        float derivative=(11.*cos(phase)-8.*ring*sin(phase)-.5*sin(phase)/(1.+d))*envelope*a;
        f+=vec3(h,delta/d*derivative);
      }
    }
    if(uHydroEnabled>.5){
      float stepSize=2.*uHydroExtent/uHydroResolution;
      float hx=(resolvedHeight(p+vec2(stepSize,0))-resolvedHeight(p-vec2(stepSize,0)))/(2.*stepSize);
      float hz=(resolvedHeight(p+vec2(0,stepSize))-resolvedHeight(p-vec2(0,stepSize)))/(2.*stepSize);
      f+=vec3(resolvedHeight(p),hx,hz);
    }
    return f;
  }
  float surface(vec2 p){return waterField(p).x;}
  vec3 surfaceNormal(vec2 p){vec3 f=waterField(p);return normalize(vec3(-f.y,1.,-f.z));}
`;
