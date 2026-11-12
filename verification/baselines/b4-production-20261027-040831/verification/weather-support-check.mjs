import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createAtmosphere} from '../sky.js';
const a=createAtmosphere(THREE);a.uniforms.uCloudWeatherOrigin.value.set(.421875,.734375);
const R=6360000,cam=[-60,8,-51],observer=[cam[0],R+cam[1],cam[2]];
const mod=(x,n)=>((x%n)+n)%n;let tested=0,falseRejections=0,nonzero=0;const fractions=[],steps=[];
let randomSeed=23179;const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)|0;return(randomSeed>>>0)/4294967296;};
for(const time of [0,600]){
  a.update({time,wind:1.8});const u=a.uniforms,mips=u.uCloudSupport.value.mipmaps;
  for(const coverage of [.35,.85]){
    a.setWeather({coverage},{immediate:true});
    for(let ray=0;ray<256;ray++){
      const az=random()*Math.PI*2,elevation=(.2+random()*55)*Math.PI/180,rd=[Math.sin(az)*Math.cos(elevation),Math.sin(elevation),Math.cos(az)*Math.cos(elevation)];
      const r=Math.hypot(...observer),b=observer[0]*rd[0]+observer[1]*rd[1]+observer[2]*rd[2];
      const sphereExit=radius=>-b+Math.sqrt(Math.max(0,b*b-(r-radius)*(r+radius)));
      const entry=Math.max(0,sphereExit(R+u.uCloudBase.value)),exit=Math.min(60000,sphereExit(R+u.uCloudTop.value));
      if(exit<=entry)continue;
      const ds=(exit-entry)/32,shear=u.uCloudShearOffset.value;
      const footprint=ds*Math.max(Math.abs(rd[0])+Math.abs(shear.x)*.001,Math.abs(rd[2])+Math.abs(shear.y)*.001);
      const level=Math.max(0,Math.min(9,Math.ceil(Math.log2(Math.max(1,footprint/125))))),mip=mips[level];
      let start=exit,end=entry;
      for(let i=0;i<32;i++){
        const distance=entry+(i+.5)*ds,p=[cam[0]+rd[0]*distance,cam[1]+rd[1]*distance,cam[2]+rd[2]*distance],height=Math.hypot(p[0],R+p[1],p[2])-R-u.uCloudBase.value;
        const wx=(p[0]-u.uCloudOffset.value.x-shear.x*height/1000)/64000+u.uCloudWeatherOrigin.value.x;
        const wz=(p[2]-u.uCloudOffset.value.y-shear.y*height/1000)/64000+u.uCloudWeatherOrigin.value.y;
        const possible=mip.data[(mod(Math.floor(wz*mip.width),mip.width)*mip.width+mod(Math.floor(wx*mip.width),mip.width))*4]/255;
        if(possible>=.44-.40*coverage){start=Math.min(start,entry+i*ds);end=Math.max(end,entry+(i+1)*ds);}
      }
      if(end>start){fractions.push((end-start)/(exit-entry));steps.push((end-start)/64);}
      for(let i=0;i<512;i++){
        const d=entry+(i+.5)/512*(exit-entry),density=a.cloudDensityAt([cam[0]+rd[0]*d,cam[1]+rd[1]*d,cam[2]+rd[2]*d],time);
        tested++;if(density>1e-6){nonzero++;if(d<start-1e-6||d>end+1e-6)falseRejections++;}
      }
    }
  }
}
fractions.sort((a,b)=>a-b);steps.sort((a,b)=>a-b);
const result={date:new Date().toISOString(),cloudShapeBlend:a.uniforms.uCloudShapeBlend.value,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../sky.js',import.meta.url))).digest('hex'),passed:falseRejections===0,testedDensitySamples:tested,positiveDensitySamples:nonzero,falseRejections,retainedRayCount:fractions.length,medianRetainedFraction:fractions[Math.floor(fractions.length/2)],medianFinalStepMetres:steps[Math.floor(steps.length/2)],supportBytes:a.diagnostics().supportBytes,note:'CPU sample check complements the conservative max-mip construction proof; it is not an exhaustive proof over all rays/parameters or a GPU timing measurement.'};
fs.writeFileSync(new URL('./weather-support-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));a.dispose();if(!result.passed)process.exitCode=1;
