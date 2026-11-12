/** Independent analytic checks for the water optics, not a GPU acceptance test.
 * Run from any directory: node verification/optics-math-check.mjs
 * The Fresnel scalar function and spectral scalar expressions are extracted
 * from the actual GLSL source, then compared with analytic limits/invariants.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {waveGLSL, waveComponents} from '../waves.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(directory);
const source = Object.fromEntries(['water.js', 'waves.js', 'caustics.js', 'main.js'].map(name => [name, fs.readFileSync(path.join(project, name), 'utf8')]));
const checks = [];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const smoothstep = (a,b,x) => {const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const add = (id,passed,details) => checks.push({id,passed:Boolean(passed),...details});
const close = (id,actual,expected,tolerance,notes) => add(id,Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,{actual,expected,tolerance,...(notes?{notes}:{})});
const normalise = a => {const l=Math.hypot(...a);return a.map(x=>x/l);};
const dot = (a,b) => a.reduce((sum,x,i)=>sum+x*b[i],0);
const refract = (incident,normal,eta) => {
  const d=dot(normal,incident),k=1-eta*eta*(1-d*d);
  return k<0?[0,0,0]:incident.map((x,i)=>eta*x-(eta*d+Math.sqrt(k))*normal[i]);
};

// Execute the actual all-scalar GLSL Fresnel body after syntax-only conversion.
const fresnelBody = source['water.js'].match(/float fresnelDielectric\(float cosI\)\s*\{([\s\S]*?)\n\s*\}/)?.[1];
if (!fresnelBody) throw new Error('Actual Fresnel function could not be extracted.');
const fresnel = new Function('cosI','clamp','sqrt','max',fresnelBody.replace(/\bfloat\b/g,'let'));
const F = cos => fresnel(cos,clamp,Math.sqrt,Math.max);
const ior = Number(fresnelBody.match(/eta\s*=\s*([.\d]+)/)?.[1]);
close('fresnel_normal_incidence',F(1),0.020373187841971414,1e-12);
close('fresnel_grazing_limit',F(0),1,1e-12);
let maxEnergyError=0,minReflectance=1,maxReflectance=0;
for(let degrees=0;degrees<=90;degrees+=0.25){
  const reflected=F(Math.cos(degrees*Math.PI/180)),transmitted=1-reflected;
  maxEnergyError=Math.max(maxEnergyError,Math.abs(reflected+transmitted-1));
  minReflectance=Math.min(minReflectance,reflected);maxReflectance=Math.max(maxReflectance,reflected);
}
add('fresnel_energy_and_bounds',maxEnergyError<1e-12&&minReflectance>=0&&maxReflectance<=1,{maxEnergyError,minReflectance,maxReflectance,notes:'R and T refer to power fractions; radiance and beam area additionally change with IOR.'});
const incident60=[Math.sin(Math.PI/3),-Math.cos(Math.PI/3),0];
const transmitted60=refract(incident60,[0,1,0],1/ior);
close('snell_air_60_degrees_to_water',Math.acos(-transmitted60[1])*180/Math.PI,40.517590622331426,1e-10);
close('refracted_ray_unit_length',Math.hypot(...transmitted60),1,1e-12);
add('shared_air_water_ior',source['water.js'].includes('refract(-V,n,1./1.333)')&&source['caustics.js'].includes('refract(-towardSun, normal, 1.0 / 1.333)'),{ior,notes:'Both observer rays and solar caustic rays use the same air/water IOR.'});

const coefficients = name => source['water.js'].match(new RegExp(`vec3 ${name}=vec3\\(([^)]+)\\)`))[1].split(',').map(Number);
const absorption=coefficients('absorption'),scattering=coefficients('scattering');
const extinction=absorption.map((x,i)=>x+scattering[i]);
const beer = distance => extinction.map(sigma=>Math.exp(-sigma*distance));
add('beer_positive_coefficients',extinction.every(x=>x>0),{absorption,scattering,extinction});
const transmissionSamples=[0,.25,1,3,10,30].map(distance=>({distance,transmission:beer(distance)}));
add('beer_path_monotonic_and_zero_path',transmissionSamples[0].transmission.every(x=>x===1)&&transmissionSamples.slice(1).every((sample,i)=>sample.transmission.every((x,c)=>x<transmissionSamples[i].transmission[c]&&x>0)),{samples:transmissionSamples});
const beerCompositionError=Math.max(...beer(5).map((x,i)=>Math.abs(x-beer(2)[i]*beer(3)[i])));
close('beer_incoming_plus_outgoing_composition',beerCompositionError,0,1e-14);
add('red_absorbs_faster_than_blue',beer(3)[0]<beer(3)[1]&&beer(3)[1]<beer(3)[2],{transmissionAt3m:beer(3)});

// Use the actual rounded GLSL component literals (rather than unrounded JS
// generation values), so the differentiation test targets shader coefficients.
const componentPattern=/spectralWave\(p,vec2\(([-\d.]+),([-\d.]+)\),([-\d.]+),([-\d.]+),([-\d.]+)\)/g;
const components=Array.from(waveGLSL.matchAll(componentPattern),m=>({direction:[Number(m[1]),Number(m[2])],k:Number(m[3]),amplitude:Number(m[4]),phase:Number(m[5])}));
const spectralBody=waveGLSL.match(/vec3 spectralWave\([\s\S]*?\)\s*\{([\s\S]*?)\n\s*\}/)[1];
const omegaExpression=spectralBody.match(/float omega=([^;]+);/)[1];
const phaseExpression=spectralBody.match(/float a=([^;]+);/)[1];
const derivativeExpression=spectralBody.match(/float derivative=([^;]+);/)[1];
const heightExpression=spectralBody.match(/return vec3\(([^,]+),direction\*derivative\);/)[1];
const omega=new Function('k','sqrt','tanh','min',`return ${omegaExpression};`);
const phaseFunction=new Function('x','z','ox','oz','directionX','directionZ','k','omega','uTime','phase',
  `return ${phaseExpression.replace('dot(p-uCurrentOffset,direction)','((x-ox)*directionX+(z-oz)*directionZ)')};`);
const derivative=new Function('amplitude','k','a','uWind','cos','sin',`return ${derivativeExpression};`);
const height=new Function('amplitude','k','a','uWind','cos','sin',`return ${heightExpression};`);
const filterPairs = {
  geometry:waveGLSL.match(/#ifdef GEOMETRY_PASS[\s\S]*?smoothstep\(([^,]+),([^,]+),k\)/).slice(1).map(Number),
  caustic:waveGLSL.match(/#ifdef CAUSTIC_LOW_QUALITY[\s\S]*?#else[\s\S]*?smoothstep\(([^,]+),([^,]+),k\)/).slice(1).map(Number),
  balanced:waveGLSL.match(/#ifdef CAUSTIC_LOW_QUALITY[\s\S]*?smoothstep\(([^,]+),([^,]+),k\)/).slice(1).map(Number),
};
function field(x,z,time,mode='full',wind=1,offset=[0,0]){
  const result=[0,0,0];
  for(const c of components){
    const weight=mode==='full'?1:1-smoothstep(...filterPairs[mode],c.k);
    const amplitude=c.amplitude*weight;
    const phase=phaseFunction(x,z,...offset,...c.direction,c.k,omega(c.k,Math.sqrt,Math.tanh,Math.min),time,c.phase);
    result[0]+=height(amplitude,c.k,phase,wind,Math.cos,Math.sin);
    const gradient=derivative(amplitude,c.k,phase,wind,Math.cos,Math.sin);
    result[1]+=c.direction[0]*gradient;result[2]+=c.direction[1]*gradient;
  }
  return result;
}
add('spectral_components_match_export',components.length===waveComponents.length&&components.length>=30,{count:components.length});
let maximumDispersionRelativeError=0;
for(const k of [1e-6,.1,1,10,30,103]){
  const observed=omega(k,Math.sqrt,Math.tanh,Math.min);
  const expected=Math.sqrt((9.81*k+.000070244*k*k*k)*Math.tanh(3*k));
  maximumDispersionRelativeError=Math.max(maximumDispersionRelativeError,Math.abs(observed/expected-1));
}
add('gravity_capillary_finite_depth_dispersion',maximumDispersionRelativeError<.0004,{
  maximumRelativeError:maximumDispersionRelativeError,tolerance:.0004,
  notes:'Actual shader expression compared with the finite-depth gravity-capillary relation; tanh argument cap4 introduces less than0.04percent frequency error.'});
const longK=1e-6;
close('shallow_long_wave_speed_limit',omega(longK,Math.sqrt,Math.tanh,Math.min)/longK,Math.sqrt(9.81*3),1e-8);
const current=[.13,-.04],sample=components[3],time0=3,phaseEpsilon=1e-5;
const atTime=t=>phaseFunction(2,-1,current[0]*t,current[1]*t,...sample.direction,sample.k,
  omega(sample.k,Math.sqrt,Math.tanh,Math.min),t,sample.phase);
const observedFrequency=-(atTime(time0+phaseEpsilon)-atTime(time0-phaseEpsilon))/(2*phaseEpsilon);
const expectedFrequency=omega(sample.k,Math.sqrt,Math.tanh,Math.min)+sample.k*dot(sample.direction,current);
close('uniform_current_doppler_shift_from_integrated_offset',observedFrequency,expectedFrequency,1e-8,
  'Tests the actual shader phase expression. Spatially varying tide/wave coupling remains approximate.');
add('resolved_hydrodynamic_height_is_wired_into_shared_field',/uniform\s+(?:highp\s+)?sampler2D\s+uHydroState\s*;/.test(waveGLSL)&&
  waveGLSL.includes('f+=vec3(resolvedHeight(p),hx,hz);'),{
  notes:'Source wiring check only. The following gradient tests cover the analytic fine-wave spectrum, not the GPU-sampled SWE texture.'});
let seed=9197;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
for(const mode of ['full','geometry','caustic','balanced']){
  let maxGradientError=0;
  for(let i=0;i<128;i++){
    const x=(random()-.5)*110,z=(random()-.5)*110,time=random()*17,eps=1e-5;
    const analytic=field(x,z,time,mode);
    const dx=(field(x+eps,z,time,mode)[0]-field(x-eps,z,time,mode)[0])/(2*eps);
    const dz=(field(x,z+eps,time,mode)[0]-field(x,z-eps,time,mode)[0])/(2*eps);
    maxGradientError=Math.max(maxGradientError,Math.abs(dx-analytic[1]),Math.abs(dz-analytic[2]));
  }
  close(`wave_gradient_${mode}_fine_spectrum_only`,maxGradientError,0,1e-6,'Central differences of the analytic fine-wave height versus its shader gradient; constant pass filter. Excludes the separate GPU SWE texture.');
}
const rippleBody=waveGLSL.match(/float ring=d-age\*([^;]+);([\s\S]*?)f\+=vec3\(h,delta\/d\*derivative\);/);
const speed=Number(rippleBody[1]);
const envelopeExpression=rippleBody[2].match(/float envelope=([^;]+);/)[1];
const ripplePhaseExpression=rippleBody[2].match(/float phase=([^;]+);/)[1];
const rippleAmplitude=rippleBody[2].match(/float a=([.\d]+)\*uRipples/)[1];
const rippleHeightExpression=rippleBody[2].match(/float h=([^;]+);/)[1];
const rippleDerivativeExpression=rippleBody[2].match(/float derivative=([^;]+);/)[1];
const envelope=new Function('ring','age','d','exp','sqrt',`return ${envelopeExpression};`);
const ripplePhase=new Function('d','age',`return ${ripplePhaseExpression};`);
const rippleHeight=new Function('ring','phase','envelope','a','d','sin','cos',`return ${rippleHeightExpression};`);
const rippleDerivative=new Function('ring','phase','envelope','a','d','sin','cos',`return ${rippleDerivativeExpression};`);
function ripple(r,age){const ring=r-age*speed,phase=ripplePhase(r,age),e=envelope(ring,age,r,Math.exp,Math.sqrt),a=Number(rippleAmplitude);return[rippleHeight(ring,phase,e,a,r,Math.sin,Math.cos),rippleDerivative(ring,phase,e,a,r,Math.sin,Math.cos)];}
const rippleK=11,rippleOmega=Math.sqrt(9.81*rippleK+.000070244*rippleK**3);
close('impulse_carrier_uses_gravity_capillary_phase',-ripplePhase(0,1),rippleOmega,1e-7);
const groupExpected=(9.81+3*.000070244*rippleK**2)/(2*rippleOmega);
close('impulse_envelope_uses_distinct_group_velocity',speed,groupExpected,1e-7);
let maxRippleGradientError=0;
for(let i=0;i<128;i++){
  const r=.01+random()*5,age=.1+random()*6,eps=1e-5;
  const numerical=(ripple(r+eps,age)[0]-ripple(r-eps,age)[0])/(2*eps);
  maxRippleGradientError=Math.max(maxRippleGradientError,Math.abs(numerical-ripple(r,age)[1]));
}
close('radial_impulse_analytic_derivative',maxRippleGradientError,0,1e-6,'Checked away from the 1 mm central regularisation.');

// Photon transport reference: a flat interface and an analytic planar bed.
// Its exact ray hit and Jacobian can be solved without the renderer's grid.
const elevation=48*Math.PI/180;
const sun=normalise([Math.cos(elevation)/Math.sqrt(2),Math.sin(elevation),Math.cos(elevation)/Math.sqrt(2)]);
const solarRay=refract(sun.map(x=>-x),[0,1,0],1/ior);
const iterations=Number(source['caustics.js'].match(/for \(int i = 0; i < (\d+); i\+\+\)/)[1]);
function tracePlanarBed(x,z,gx,gz,depth=3){
  const bed=(px,pz)=>-depth+gx*px+gz*pz;
  let t=-bed(x,z)/(-solarRay[1]),rx=x+solarRay[0]*t,rz=z+solarRay[2]*t;
  for(let i=0;i<iterations;i++){t=-bed(rx,rz)/(-solarRay[1]);rx=x+solarRay[0]*t;rz=z+solarRay[2]*t;}
  return[rx,rz];
}
function concentrationOnBed(gx,gz){
  const eps=1e-3,a=tracePlanarBed(eps,0,gx,gz),b=tracePlanarBed(-eps,0,gx,gz),c=tracePlanarBed(0,eps,gx,gz),d=tracePlanarBed(0,-eps,gx,gz);
  const dxx=(a[0]-b[0])/(2*eps),dxz=(a[1]-b[1])/(2*eps),dzx=(c[0]-d[0])/(2*eps),dzz=(c[1]-d[1])/(2*eps);
  return 1/Math.abs(dxx*dzz-dzx*dxz);
}
close('caustic_flat_interface_flat_bed_jacobian',concentrationOnBed(0,0),1,1e-10);
for(const [gx,gz] of [[.1,0],[.2,.1],[-.15,.08]]){
  const expected=1-(gx*solarRay[0]+gz*solarRay[2])/solarRay[1];
  close(`caustic_sloped_bed_${gx}_${gz}`,concentrationOnBed(gx,gz),expected,.003,'The map measures horizontal-area concentration; a sloped bed has a non-unit baseline even with flat water.');
}
const radiometricSource=/uSunIrradiance\s*\*\s*max\(uSun\.y\s*,\s*0\.\)\s*\*\s*max\(bn\.y\s*,\s*0\.\)\s*\*\s*concentration/;
add('seabed_flux_uses_entry_cosine_and_receiver_area',radiometricSource.test(source['water.js']),{notes:'Required for horizontal photon-footprint Jacobian: Ebed=Esolar*cos(thetaAir)*concentration*Nbed.y; do not multiply refracted receiver cosine again.'});
const causticConfig=source['main.js'].match(/caustics=createCaustics\([^;]+/)[0];
const extent=Number(causticConfig.match(/extent:(\d+)/)?.[1]??80),grid=Number(causticConfig.match(/gridSegments:(\d+)/)?.[1]??1024);
const spacing=2*extent/grid,nyquist=Math.PI/spacing;
add('caustic_retained_band_below_nyquist',filterPairs.caustic[1]<nyquist,{extent,grid,spacingMetres:spacing,nyquistRadiansPerMetre:nyquist,cutoff:filterPairs.caustic[1],samplesAtCutoff:2*Math.PI/filterPairs.caustic[1]/spacing,notes:'Nyquist is necessary, not sufficient for high-quality sharp caustics; a finite mesh still approximates curvature.'});
const geometryMatch=source['water.js'].match(/PlaneGeometry\((\d+),(\d+),(\d+),(\d+)\)/);
const geometrySpacing=Number(geometryMatch[1])/Number(geometryMatch[3]);
add('geometry_retained_band_below_nyquist',filterPairs.geometry[1]<Math.PI/geometrySpacing,{spacingMetres:geometrySpacing,cutoff:filterPairs.geometry[1],nyquistRadiansPerMetre:Math.PI/geometrySpacing,notes:'Applies to the inner uniform grid, not the distant stretched horizon border.'});
const rmsSlope=Math.sqrt(waveComponents.reduce((sum,c)=>sum+(c.amplitude*c.k)**2/2,0));
const rmsHeight=Math.sqrt(waveComponents.reduce((sum,c)=>sum+c.amplitude*c.amplitude/2,0));

const report={
  status:checks.every(c=>c.passed)?'passed':'failed',
  generatedAt:new Date().toISOString(),
  method:'CPU double-precision analytic checks of actual GLSL scalar expressions and source wiring. No GPU compilation, image quality, or frame-rate claim.',
  sourceSHA256:Object.fromEntries(Object.entries(source).map(([name,text])=>[name,crypto.createHash('sha256').update(text).digest('hex')])),
  summary:{passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,total:checks.length,waveComponents:waveComponents.length,rmsSlope,rmsHeightMetres:rmsHeight},
  checks,
  limits:[
    'The fine ocean is a finite analytic gravity-capillary spectrum, not a solved fluid volume; its dispersion uses the stated 3 m lagoon reference depth. Separate resolved long waves use their actual bathymetry.',
    'The radial stone impulse is an analytic moving wave packet rather than a full dispersive point-source solution.',
    'Caustic ray/heightfield intersection uses a finite sampled bed and three fixed-point refinements; steep/discontinuous receivers can require a more robust intersection method.',
    'Caustic intensity is capped and band-limited for finite texture resolution; no separate-mesh receiver caustics or volumetric multiple scattering.',
    'GPU correctness and acceptance still require rendered-frame comparison, interaction tests, and runtime performance measurement.',
    'The analytic gradient checks exclude the GPU-sampled resolved height field; its finite-difference normals and texture interpolation require GPU/visual acceptance.',
  ],
};
fs.writeFileSync(path.join(directory,'optics-math-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...report.summary,failures:checks.filter(c=>!c.passed)},null,2));
process.exitCode=report.status==='passed'?0:1;
