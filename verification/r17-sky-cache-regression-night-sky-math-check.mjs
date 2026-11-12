import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createNightSky,nightEphemeris,nightDefaults,recommendedNightExposure,sanitizeNight,FULL_MOON_SOLAR_RATIO} from '../night-sky.js';
import {createAtmosphere,solarTransmittance,exponentialAtmosphereColumn} from '../sky.js';

const checks=[],add=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence}),close=(id,a,b,t)=>add(id,Math.abs(a-b)<=t,{actual:a,expected:b,tolerance:t});
const sky=createAtmosphere(THREE,{weather:{coverage:0}}),night=createNightSky(THREE);
const matrix=night.uniforms.uEquatorialRotation.value;
close('J2000_local_rotation_has_positive_unit_determinant_not_mirrored',matrix.determinant(),1,1e-12);
const inverse=matrix.clone().transpose(),product=matrix.clone().multiply(inverse).elements;
close('celestial_rotation_is_orthonormal',Math.max(...product.map((v,i)=>Math.abs(v-([0,4,8].includes(i)?1:0)))),0,1e-12);
// Local zenith transformed into equatorial-of-date should have dec=latitude;
// J2000 precession26years is explicitly allowed, not silently called exact.
const zenith=new THREE.Vector3(0,1,0).applyMatrix3(matrix),zenithDec=Math.asin(zenith.z)*180/Math.PI;
add('zenith_declination_near_observer_latitude',Math.abs(zenithDec-nightDefaults.latitude)<.3,{declinationJ2000Degrees:zenithDec,latitudeDegrees:nightDefaults.latitude});
night.update(15);const nearExact=createNightSky(THREE,{date:'2026-10-26T14:00:15Z'}),rotationError=Math.max(...night.uniforms.uEquatorialRotation.value.elements.map((v,i)=>Math.abs(v-nearExact.uniforms.uEquatorialRotation.value.elements[i])));
add('continuous_inter_ephemeris_rotation_matches_fresh_transform',rotationError<5e-6,{maximumMatrixDifference:rotationError,elapsedSeconds:15,notes:'Bounded Earth-axis approximation between30s ephemerides; this is not a sub-arcsecond planetarium claim.'});
const beforeDate=night.state.currentDate;night.setNight({rotationDegrees:45});
add('direction_control_does_not_reset_the_date_clock',night.state.currentDate===beforeDate,{before:beforeDate,after:night.state.currentDate});
night.setNight({date:'2026-08-13T14:00:00Z'});add('explicit_date_is_anchored_to_current_simulation_time',night.state.currentDate==='2026-08-13T14:00:00.000Z',{actual:night.state.currentDate});
const full=nightEphemeris(),dark=nightEphemeris({...nightDefaults,date:'2026-08-13T14:00:00Z'});
add('default_is_correctly_identified_as_near_full_moon',full.moonPhase>.99&&full.moonAltitudeDegrees>50,{phase:full.moonPhase,altitudeDegrees:full.moonAltitudeDegrees,azimuthDegrees:full.moonAzimuthDegrees,source:'Vendored AstronomyEngine; validates API/frame integration, not an independent numerical lunar ephemeris.'});
add('dark_sky_preset_has_crescent_below_horizon',dark.moonPhase<.02&&dark.moonAltitudeDegrees<-40,{phase:dark.moonPhase,altitudeDegrees:dark.moonAltitudeDegrees});
add('night_settings_bound_numeric_values_and_reject_invalid_date',sanitizeNight({latitude:100,date:'not-a-date'}).latitude===89.8&&sanitizeNight({date:'not-a-date'}).date===nightDefaults.date);

const exposures=[10,0,-6,-12,-18,-40].map(e=>({elevation:e,full:recommendedNightExposure(e,full.moonSourceRatio,full.moonAltitudeDegrees),dark:recommendedNightExposure(e,dark.moonSourceRatio,dark.moonAltitudeDegrees)}));
add('day_to_night_exposure_is_monotonic_and_finite',exposures.every((v,i)=>Number.isFinite(v.full)&&Number.isFinite(v.dark)&&(i===0||v.full>=exposures[i-1].full&&v.dark>=exposures[i-1].dark)),{exposures});
close('dark_sky_target21EV',recommendedNightExposure(-25,0,-90),21,1e-12);
close('automatic_exposure_disabled_means_no_hidden_boost',recommendedNightExposure(-25,FULL_MOON_SOLAR_RATIO,55,false),0,0);
const discontinuities=[0,-6,-12,-18,10].map(e=>({e,delta:Math.abs(recommendedNightExposure(e-1e-5,0,-90)-recommendedNightExposure(e+1e-5,0,-90))}));
add('exposure_piecewise_boundaries_are_continuous',discontinuities.every(v=>v.delta<1e-7),{discontinuities});

const lighting=[];
for(const elevation of [48,0,-6,-12,-25,-40]){
  sky.setSun({elevation,azimuth:100,intensity:1});const l=sky.lighting();
  lighting.push({elevation,physicalSun:l.physicalSunStrength,physicalMoon:l.physicalMoonStrength,preExposureEV:l.preExposureEV,skyTintPhysical:l.skyTintPhysical.toArray(),keyIsMoon:l.keyIsMoon});
  const physicalReconstruction=l.keyColor.toArray().map(v=>v*l.physicalKeyStrength),storedReconstruction=l.keyColor.toArray().map(v=>v*l.keyStrength/l.preExposureScale);
  close(`key_radiometry_before_after_preexposure_${elevation}`,Math.max(...physicalReconstruction.map((v,i)=>Math.abs(v-storedReconstruction[i]))),0,1e-12);
}
add('direct_solar_irradiance_zero_below_horizon',lighting.filter(v=>v.elevation<=-6).every(v=>v.physicalSun===0),{lighting});
add('deep_night_water_ambient_tint_has_no_daylight_floor',lighting.find(v=>v.elevation===-25).skyTintPhysical.every(v=>v<2e-6),{nightTint:lighting.find(v=>v.elevation===-25).skyTintPhysical});
sky.setNight({date:'2026-08-13T14:00:00Z'});const moonless=sky.lighting();
add('moonless_physical_ambient_is_starlight_scale_and_direct_lights_off',moonless.physicalSunStrength===0&&moonless.physicalMoonStrength===0&&moonless.skyTintPhysical.toArray().every(v=>v>0&&v<2e-8),{physicalTint:moonless.skyTintPhysical.toArray(),physicalSun:moonless.physicalSunStrength,physicalMoon:moonless.physicalMoonStrength});
add('FP16_storage_sees_preexposed_values_instead_of_underflow',moonless.skyTintPhysical.toArray().every(v=>v<2**-24)&&moonless.skyTint.toArray().every(v=>v>1e-4),{physical:moonless.skyTintPhysical.toArray(),stored:moonless.skyTint.toArray(),minimumPositiveFP16:2**-24,notes:'CPU range check. Actual FP16 rendered radiance/readback is separately required.'});
sky.setNight({automaticExposure:false});const off=sky.lighting();close('atmosphere_auto_off_preexposureEV_is_zero',off.preExposureEV,0,0);close('atmosphere_auto_off_preexposureScale_is_one',off.preExposureScale,1,0);

// Independent quadrature of the original spherical exponential integral,
// rather than checking the Chapman approximation against itself.
const quadrature=(h,mu,H)=>{
  const radius=6360000+h,maxDistance=1600000,steps=16384,ds=maxDistance/steps;
  let sum=0;for(let i=0;i<steps;i++){const s=(i+.5)*ds,alt=Math.sqrt(radius*radius+s*s+2*radius*mu*s)-6360000;sum+=Math.exp(-alt/H)*ds;}return sum;
};
const columns=[];
for(const height of [2,1000,12000])for(const mu of [0,.1,.5,1])for(const H of [1200,8000]){
  const observed=exponentialAtmosphereColumn(height,mu,H),reference=quadrature(height,mu,H);columns.push({height,mu,H,observed,reference,relativeError:Math.abs(observed/reference-1)});
}
add('Chapman_spherical_columns_agree_with_independent_integral',columns.every(v=>v.relativeError<.015),{maximumRelativeError:Math.max(...columns.map(v=>v.relativeError)),cases:columns});
close('spherical_horizon_column_is_finite',Number.isFinite(exponentialAtmosphereColumn(2,0,8000))?0:1,0,0);
for(const elevation of [-40,-18,-6])close(`geometric_Earth_blocks_low_observer_solar_flux_${elevation}`,Math.max(...solarTransmittance(elevation*Math.PI/180)),0,0);

const sourceHashes=Object.fromEntries(['sky.js','night-sky.js','weather.js','assets/night/astronomy.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+f,import.meta.url))).digest('hex')]));
const report={date:new Date().toISOString(),cloudShapeBlend:sky.uniforms.uCloudShapeBlend.value,status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length,failed:checks.filter(c=>!c.passed).length},sourceHashes,checks,limits:['CPU astronomy/frame/math checks; not actual GPU sky, cloud shape, star image or FPS acceptance.','AstronomyEngine API outputs are not an independent lunar ephemeris oracle.','Parabolic Chapman+ozone-column approximation and8-step single scattering are not a full multiple-scattering atmosphere.','16-ray clear-sky irradiance estimate ignores detailed cloud hemisphere occlusion and directional stellar irradiance variations.']};
fs.writeFileSync(new URL('./r17-sky-cache-regression-night-sky-math-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...report.summary,failures:checks.filter(c=>!c.passed)},null,2));
sky.dispose();night.dispose();nearExact.dispose();if(report.status!=='passed')process.exitCode=1;
