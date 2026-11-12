// Same-world-cloud photographs of the narrow C2 base-continuity change.
export async function compareCloudBaseViews(a){
  const saved={clock:a.celestial(),sun:{...a.state.parameters.sun},lens:{...a.state.parameters.lens},weather:{...a.state.parameters.weather},camera:a.state.camera,target:a.state.target,flag:a.atmosphere().diagnostics.cloudBaseContinuity,paused:a.state.parameters.paused},images=[];
  const cases=[{name:'fair',settings:{humidity:.68,temperature:29,coverage:.35,thickness:950,shear:1.1},xz:[-750,7500]},{name:'humid',settings:{humidity:.95,temperature:28,coverage:.9,thickness:1800,shear:1.8},xz:[-6000,-9000]}];
  try{
    a.pause(true);await a.setTime({running:false});a.setSun({azimuth:100,elevation:48,intensity:1});a.setLens({focal:70,exposure:0,dof:false});
    for(const c of cases){a.setWeather(c.settings);const d=a.atmosphere().diagnostics,targetAltitude=d.cloudBaseMetres+(d.cloudTopMetres-d.cloudBaseMetres)*.35,eye=[-48,12,-40],cloud=[c.xz[0],targetAltitude-(c.xz[0]**2+c.xz[1]**2)/(2*6360000),c.xz[1]],direction=cloud.map((v,i)=>v-eye[i]),distance=Math.hypot(...direction);a.setCamera(eye,eye.map((v,i)=>v+direction[i]/distance*100));
      if(a.state.camera.some((v,i)=>Math.abs(v-eye[i])>1e-8))throw new Error('Cloud comparison observer was moved by orbit constraints');
      for(const flag of [0,1]){
        a.setCloudBaseContinuity(flag);await new Promise(r=>setTimeout(r,1000));
        images.push({id:'low-'+c.name+'-'+flag,image:a.screenshot(),flag,time:a.state.time,camera:a.state.camera,target:a.state.target,cloudWorldPoint:cloud,lens:a.state.parameters.lens,sky:a.atmosphere().diagnostics,photometry:a.photometry(),range:await a.inspectRadiance()});
      }
    }
    return{date:new Date().toISOString(),images,limits:['Actual paused production scene, same world-cloud centres and exposure; not a calibrated reference photograph','The change affects the narrow lowest5.2%of the layer; it does not redesign all cloud silhouettes','One-second settling permits cube/cache/PMREM work; separate timing helper is needed for performance']};
  }finally{
    a.pause(true);a.setCloudBaseContinuity(saved.flag);a.setWeather(saved.weather);a.setLens(saved.lens);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.pause(saved.paused);
  }
}
