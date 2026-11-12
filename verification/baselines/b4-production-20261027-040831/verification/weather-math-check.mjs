import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import { createAtmosphere,solarTransmittance } from '../sky.js';
import { createWeatherController,deriveWeather,dewPointCelsius } from '../weather.js';

const checks=[];
function check(name,condition,evidence){checks.push({name,passed:!!condition,evidence});}
const sea=createAtmosphere(THREE,{weather:{humidity:.68,temperature:29,thickness:950,coverage:.35}});
sea.uniforms.uCloudWeatherOrigin.value.set(.4384765625,.7822265625);
const initial=sea.getWeatherState().current;
check('dewpoint equals temperature at saturation',Math.abs(dewPointCelsius(29,1)-29)<1e-10,dewPointCelsius(29,1));
const humid=deriveWeather({humidity:.9,temperature:29}),dry=deriveWeather({humidity:.4,temperature:29});
check('surface RH lowers estimated LCL',humid.cloudBase<initial.cloudBase&&initial.cloudBase<dry.cloudBase,{humid:humid.cloudBase,normal:initial.cloudBase,dry:dry.cloudBase});
const manual=deriveWeather({humidity:.9,temperature:29,cloudBase:1400,thickness:1200});
check('manual metre-based cloud base respected',manual.cloudBase===1400&&manual.cloudTop===2600,manual);
let finite=true,nonzero=0,sum=0,maximum=0,probes=0,below=0,above=0;
for(let z=-30000;z<=30000;z+=600)for(let x=-30000;x<=30000;x+=600){
  for(const height of [.1,.35,.65]){
    const v=sea.cloudDensityAt([x,initial.cloudBase+initial.thickness*height,z]);
    finite&&=Number.isFinite(v)&&v>=0&&v<=1.21;nonzero+=v>.001;sum+=v;maximum=Math.max(maximum,v);probes++;
  }
  const sphericalY=altitude=>Math.sqrt((6360000+altitude)**2-x*x-z*z)-6360000;
  below+=sea.cloudDensityAt([x,sphericalY(initial.cloudBase-1),z]);above+=sea.cloudDensityAt([x,sphericalY(initial.cloudTop+1),z]);
}
check('multi-height density finite and bounded',finite,{probes,nonzero,nonzeroFraction:nonzero/probes,mean:sum/probes,maximum});
check('cloud confined above condensation base and below layer top',below===0&&above===0,{below,above});
const rgb=[];
for(const elevation of [5,15,48,80]){
  sea.setSun({azimuth:100,elevation});const l=sea.lighting();
  rgb.push({elevation,rgb:l.sunColor.toArray().map(x=>x*l.sunStrength),transmission:solarTransmittance(elevation*Math.PI/180)});
}
check('solar RGB finite and reference preserved',rgb.every(v=>v.rgb.every(Number.isFinite))&&Math.abs(rgb[2].rgb[0]-1)<1e-8,rgb);
sea.setWeather({coverage:0},{immediate:true});
let clearSum=0;
for(let i=0;i<100;i++)clearSum+=sea.cloudDensityAt([i*130,1300,-i*70]);
check('coverage zero disables cloud and its shadow',clearSum===0&&sea.cloudShadowAt([0,1,0])===1,{densitySum:clearSum,shadow:sea.cloudShadowAt([0,1,0])});
sea.setWeather({coverage:.35},{immediate:true});
sea.update({time:10,wind:1.8});
const d=sea.diagnostics(),expected=Math.hypot(.936,.352)*1.8*1.6*10;
check('integrated advection uses actual shared wind',Math.abs(Math.hypot(...d.offsetMetres)-expected)<1e-8,{offset:d.offsetMetres,expected});
check('wind shear is height dependent, not a world translation',Math.abs(Math.hypot(...d.shearOffsetMetresPerKilometre)-11)<1e-8,d.shearOffsetMetresPerKilometre);
const transition=createWeatherController({humidity:.68,temperature:29});transition.setWeather({humidity:.9});
const start=transition.state().current.cloudBase,middle=transition.update(.1).cloudBase,end=transition.state().target.cloudBase;
check('weather change does not instantaneously teleport cloud base',end<middle&&middle<start,{start,middle,end});
const result={date:new Date().toISOString(),cloudShapeBlend:sea.uniforms.uCloudShapeBlend.value,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../sky.js',import.meta.url))).digest('hex'),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,diagnostics:sea.diagnostics(),limits:'CPU math/constructor checks only. Actual GPU compile, visual morphology, reflection/shadow agreement and >=60 fps need renderer acceptance.'};
fs.writeFileSync(new URL('./weather-math-check.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({passed:result.passed,checks:result.passedCount,total:result.total,density:checks[3].evidence,initialWeather:initial}));
sea.dispose();if(!result.passed)process.exitCode=1;
