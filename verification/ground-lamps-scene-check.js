export async function checkGroundLampsScene(a){
  const saved={clock:a.celestial(),sun:{...a.state.parameters.sun},lens:{...a.state.parameters.lens},camera:a.state.camera,target:a.state.target,lights:a.localLights(),autoExposure:a.night().settings.autoExposure,paused:a.state.parameters.paused,fireworks:a.fireworks().settings};
  const report={date:new Date().toISOString(),checks:[],images:[]},check=(name,passed,detail={})=>report.checks.push({name,passed:!!passed,detail});
  const settle=async()=>{for(let i=0;i<32;i++)await new Promise(r=>requestAnimationFrame(r));};
  const capture=label=>report.images.push({label,image:a.screenshot(),camera:a.state.camera,target:a.state.target,P:a.photometry().storageEV,C:a.photometry().cameraEV,lights:a.localLights()});
  try{
    a.pause(true);await a.setTime({running:false});a.setFireworks({autoLaunch:false});await a.timePreset('moon');await a.setTime({running:false});
    a.setLocalLights({mode:'night',linked:false,lamps:[0,1,2].map(()=>({enabled:true,brightness:.45,color:'#ffdfa5'})),flashlight:{enabled:false}});
    await a.setNight({autoExposure:true});a.setLens({focal:28,exposure:0,dof:false});a.setCamera([-1.5,68,34],[-1.5,.6,-1]);await settle();capture('triangle-night');
    const state=a.localLights(),p=state.lights.slice(0,3);
    check('actual production has three lit point lights on three island sides',p.every(l=>l.type==='point'&&l.candela>0)&&p[0].position[0]<-10&&p[1].position[0]>10&&p[2].position[2]<-10,{lights:p});
    a.setLocalLights({index:1,brightness:.31,color:'#f6bf84'});const independent=a.localLights();
    check('independent brightness and colour remain independent',independent.lamps[1].brightness===.31&&independent.lamps[1].color==='#f6bf84'&&independent.lamps[0].brightness===.45&&independent.lamps[2].brightness===.45);
    a.setLocalLights({linked:true,index:0,brightness:.52,color:'#ffdfa5'});check('linked changes still reach all three',a.localLights().lamps.every(l=>l.brightness===.52&&l.color==='#ffdfa5'));
    a.setLocalLights({linked:false,index:0,brightness:1});a.setLocalLights({index:1,brightness:1});a.setLocalLights({index:2,brightness:1});await settle();report.maximumRange=await a.inspectRadiance();
    check('maximum ground lights keep all actual RGB textures finite and nonnegative',['opaque','composed','reflection'].every(k=>['countNaN','countInf','countNegative'].every(c=>report.maximumRange[k][c]===0)),report.maximumRange);
    a.setLocalLights({lamps:[0,1,2].map(()=>({brightness:.45}))});
    const [x,y,z]=a.localLights().lights[0].position,h=y-.108;
    a.setCamera([x+.8,h+.63,z+.95],[x,h+.09,z]);a.setLens({focal:50});await a.timePreset('day');await settle();capture('fixture-day');
    check('night policy leaves a visible non-emissive daytime fixture',a.localLights().lights.slice(0,3).every(l=>l.candela===0));
    await a.timePreset('moon');await a.setTime({running:false});await a.setNight({autoExposure:false});a.setLens({exposure:3});await settle();capture('fixture-night');report.closeRange=await a.inspectRadiance();
    check('close lamp view keeps HDR ranges finite',['opaque','composed','reflection'].every(k=>['countNaN','countInf','countNegative'].every(c=>report.closeRange[k][c]===0)));
    report.samplers=a.shaderSamplers();check('all programs link and fragment samplers stay within device limit',report.samplers.programs.every(p=>p.linked&&p.count<=report.samplers.fragmentLimit));
    report.passed=report.checks.every(c=>c.passed);report.limits=['Actual production scene/API and RGB ranges; static SDR PNGs do not validate absolute HDR nits or moving FPS.','Close night photograph uses manual exposure+3, not overview automatic exposure.','The three ground lamps are point-source approximations without source-occlusion shadow maps.'];return report;
  }finally{
    a.pause(true);a.setFireworks(saved.fireworks);a.setLocalLights(saved.lights);await a.setNight({autoExposure:saved.autoExposure});a.setLens(saved.lens);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.pause(saved.paused);
  }
}
