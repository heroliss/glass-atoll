// Shared by geometry, optical normals, and refracted sunlight. Metres/seconds.
// Gravity-capillary dispersion: omega²=(g*k+sigma/rho*k³)*tanh(k*h).
// h=3 m is the fine-wave reference depth. Resolved long waves use bathymetry.
// Several non-commensurate directions in each band are essential: two dominant
// perpendicular sine waves focus sunlight into an artificial tartan pattern.
let seed=40319;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
const bands=[[.35,.8,3,.015],[1.2,3.,4,.025],[4.,8.,6,.045],[8.,12.,6,.055],[12.,19.,8,.075],[22.,103.,8,.095]];
export const waveComponents=[];
for(const [lo,hi,count,slopeRMS] of bands){
  for(let i=0;i<count;i++){
    const k=lo*Math.pow(hi/lo,(i+.15+random()*.7)/count);
    const angle=i*2.39996323+random()*1.6+lo;
    const amplitude=slopeRMS*Math.sqrt(2/count)/k;
    waveComponents.push({k,amplitude,angle,phase:random()*Math.PI*2});
  }
}
const gl=x=>Number(x).toFixed(8);
const spectralSum=waveComponents.map(w=>`f+=spectralWave(p,vec2(${gl(Math.cos(w.angle))},${gl(Math.sin(w.angle))}),${gl(w.k)},${gl(w.amplitude)},${gl(w.phase)});`).join('\n');
export const waveGLSL=/* glsl */`
  uniform float uTime;
  uniform vec4 uRipples[8];
  uniform float uWind;
  uniform vec2 uMeanCurrent;
  uniform vec2 uCurrentOffset;
  uniform vec2 uRippleOffsets[8];
  uniform sampler2D uHydroState;
  uniform float uHydroExtent;
  uniform float uHydroResolution;
  uniform float uHydroEnabled;
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
    float mask=1.-smoothstep(uHydroExtent*.84,uHydroExtent*.98,max(abs(p.x),abs(p.y)));
    return texture2D(uHydroState,p/(2.*uHydroExtent)+.5).r*mask;
  }
  vec3 waterField(vec2 p){
    vec3 f=vec3(0.);
    ${spectralSum}
    for(int i=0;i<8;i++){
      float age=uTime-uRipples[i].z;
      if(age>0. && age<8.){
        vec2 delta=p-uRipples[i].xy-uCurrentOffset+uRippleOffsets[i];
        float d=max(length(delta),.001);
        float ring=d-age*.68;
        float envelope=exp(-ring*ring*4.0)*exp(-age*.38)/sqrt(1.+d);
        float a=.065*uRipples[i].w;
        float h=sin(ring*11.)*envelope*a;
        float derivative=(11.*cos(ring*11.)-8.*ring*sin(ring*11.)-.5*sin(ring*11.)/(1.+d))*envelope*a;
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
