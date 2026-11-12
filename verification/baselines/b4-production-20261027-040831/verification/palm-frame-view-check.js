// Runs only through the existing live scene API. This captures the real
// geometry/material/shadow pipeline; it is neither a coverage photoscore nor
// a frame-rate benchmark. The caller persists returned PNG data URLs.
const running=new WeakSet();
const copy=value=>structuredClone(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const vectorNear=(a,b)=>a?.length===b.length&&b.every((v,i)=>Math.abs(a[i]-v)<1e-6);
const waitFrames=async n=>{for(let i=0;i<n;i++)await new Promise(resolve=>requestAnimationFrame(resolve));};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const localSettings=s=>({mode:s.mode,linked:s.linked,lamps:copy(s.lamps),flashlight:copy(s.flashlight)});
const clockSettings=s=>({utcMs:s.utcMs,...s.observer,rate:s.rate,running:s.running,mode:s.mode,refraction:s.refraction,timeZoneOffsetMinutes:s.timeZoneOffsetMinutes});

async function imageSummary(dataURL){
  if(typeof dataURL!=='string'||!dataURL.startsWith('data:image/png;base64,'))throw Error('Scene screenshot did not return a PNG data URL');
  const image=new Image();image.src=dataURL;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,64,64);
  const pixels=context.getImageData(0,0,64,64).data;let sum=0,min=255,max=0,nonBlack=0;
  for(let i=0;i<pixels.length;i+=4){const v=Math.max(pixels[i],pixels[i+1],pixels[i+2]);if(v>1)nonBlack++;for(let c=0;c<3;c++){const x=pixels[i+c];sum+=x;min=Math.min(min,x);max=Math.max(max,x);}}
  return{width:image.naturalWidth,height:image.naturalHeight,probeSize:[64,64],meanRGB:sum/(64*64*3*255),minimum:min/255,maximum:max/255,nonBlackFraction:nonBlack/(64*64),nonBlank:nonBlack>0&&max>min,dataURLBytes:dataURL.length,scope:'Downsampled PNG validity probe only; no realism/coverage quality score'};
}

function rangeSummary(r){
  const fields=['opaque','composed','reflection'],summary={};
  for(const name of fields){const v=r?.[name];summary[name]=v?{width:v.width,height:v.height,minRGB:v.minRGB,maxRGB:v.maxRGB,countNaN:v.countNaN,countInf:v.countInf,countNegative:v.countNegative,classifierVersion:v.classifierVersion}:null;}
  return{fields:summary,passed:fields.every(name=>{const v=summary[name];return v&&v.countNaN===0&&v.countInf===0&&v.countNegative===0&&v.classifierVersion==='ieee-bits-v2';}),scope:'All RGB components of the three actual retained source textures, at this captured state only'};
}

/**
 * @param {object} a window.__ATOLL__, already initialized by the live page.
 * @param {{capture?:boolean}} options capture=true returns 24 PNG data URLs.
 * @returns {Promise<object>} locked 12-view legacy/transport AB + restoration.
 */
export async function comparePalmFrames(a,{capture=true}={}){
  const methods=['pause','setTime','celestial','setSun','setCamera','setGraphics','setQuality','setLens','setLocalLights','localLights','palmFrameDiagnostics','setPalmFrameMode','inspectRadiance','shaderSamplers','screenshot'];
  for(const name of methods)if(typeof a?.[name]!=='function')throw new TypeError(`Live scene API is missing ${name}()`);
  if(!a.state?.ready)throw Error('Wait for the actual scene to finish initialization');
  if(running.has(a))throw Error('A palm view comparison is already running on this scene');
  const initial=copy(a.state),saved={state:initial,clock:copy(a.celestial()),sun:copy(initial.parameters.sun),weather:copy(initial.parameters.weather),weatherState:copy(a.weather?.()),quality:initial.parameters.qualityPreset,qualityCustom:initial.parameters.qualityCustom,graphics:copy(initial.parameters.graphics),lens:copy(initial.parameters.lens),lights:localSettings(a.localLights()),palm:copy(a.palmFrameDiagnostics()),night:copy(a.night?.().settings)};
  const originalMode=saved.palm.mode;
  if(!['legacy','transport'].includes(originalMode))throw Error('Palm diagnostics must expose the current legacy/transport mode');
  const viewport=()=>({css:[innerWidth,innerHeight],dpr:devicePixelRatio,render:[a.state.lens.width,a.state.lens.height],output:[a.state.lens.outputWidth??a.state.lens.width,a.state.lens.outputHeight??a.state.lens.height],renderScale:a.state.renderScale});
  const checks=[],images=[],samplerAudits={},radianceAudits={},restorationErrors=[];
  const check=(name,passed,detail={})=>checks.push({name,passed:!!passed,detail});
  const report={date:new Date().toISOString(),kind:'Real scene legacy/transport palm cross-section visual AB',scope:'12 locked viewpoints, actual uploaded geometry, ordinary materials/lights/shadows and SDR screenshot pipeline. No FPS claim and no photo-realism score.',views:[],images,samplerAudits,radianceAudits,checks,saved:{time:initial.time,paused:initial.parameters.paused,clock:saved.clock,sun:saved.sun,camera:initial.camera,target:initial.target,quality:saved.quality,qualityCustom:saved.qualityCustom,graphics:saved.graphics,weather:saved.weather,lighting:saved.lights,palm:saved.palm},limits:['Two settled requestAnimationFrames after each mode/camera change, then a forced actual SDR scene render for the PNG; this does not measure temporal ghosting or long-term convergence.','Screenshots exercise real geometry; image validity and numerical range checks are not perceptual realism tests.','GI is disabled for both modes because its source patches are built from the original geometry. Direct sunlight and both variants use the same source/time/weather; local lamps and flashlight are off.','All 12 camera positions are 55m from target [0,10,0]; eye heights are absolute world metres, with horizontal radius derived from that fixed 3D orbit radius.','Returned SDR PNGs cannot verify actual HDR panel luminance. Rendering/encoding and diagnostic readback costs are excluded from any performance claim.']};
  running.add(a);
  try{
    a.pause(true);await a.setTime({running:false});
    await a.setGraphics({indirect:'off'});
    a.setLocalLights({mode:'off',flashlight:{enabled:false}});
    a.setSun({azimuth:100,elevation:48,intensity:1});
    // setSun schedules a discrete environment refresh at 170ms. Let that
    // finish before either side of the first adjacent A/B pair is captured.
    await delay(220);await waitFrames(2);
    const locked={time:a.state.time,utcMs:a.celestial().utcMs,mode:a.celestial().mode,sun:copy(a.state.parameters.sun),weather:copy(a.state.parameters.weather),weatherCurrent:copy(a.weather?.().current),quality:a.state.parameters.qualityPreset,sampling:copy(a.state.parameters.renderSampling),lens:copy(a.state.parameters.lens),viewport:viewport()};
    report.locked=locked;report.activeOtherEffects=a.fireworks?.().active??null;
    if(report.activeOtherEffects)report.limits.push('Existing active fireworks remain frozen rather than being deleted; see activeOtherEffects. They are identical in each adjacent geometry pair.');
    check('setup locks pause/clock/sun and disables GI/flashlight/ground lamps',a.state.parameters.paused&&a.celestial().running===false&&same(locked.sun,{azimuth:100,elevation:48,intensity:1})&&a.state.parameters.graphics.indirect==='off'&&a.localLights().mode==='off'&&!a.localLights().flashlight.enabled);
    for(const eyeY of [2.5,14,45])for(const azimuth of [0,90,180,270]){
      const target=[0,10,0],radius=55,horizontalRadius=Math.sqrt(radius*radius-(eyeY-target[1])**2),angle=azimuth*Math.PI/180,position=[horizontalRadius*Math.sin(angle),eyeY,-horizontalRadius*Math.cos(angle)];
      const viewId=`eye-${String(eyeY).replace('.','p')}-az-${String(azimuth).padStart(3,'0')}`,view={id:viewId,eyeY,azimuth,radius,horizontalRadius,position,target,pair:[]};report.views.push(view);
      for(const mode of ['legacy','transport']){
        a.setCamera(position,target);
        // Even the first baseline may already be active. Force a real change
        // before capture so both sides start with the same reset history;
        // the intermediate geometry is never drawn or used to rebuild GI.
        if(a.palmFrameDiagnostics().mode===mode)a.setPalmFrameMode(mode==='legacy'?'transport':'legacy');
        const switchResult=a.setPalmFrameMode(mode);await waitFrames(2);
        if(!same(viewport(),locked.viewport))throw Error(`Viewport/resolution changed during ${viewId}/${mode}; AB is not comparable`);
        const image=capture?a.screenshot():null,state=copy(a.state),clock=a.celestial(),id=`${viewId}-${mode}`;
        const png=capture?await imageSummary(image):null;
        const snapshot={id,viewId,mode,positionRequested:position,targetRequested:target,camera:state.camera,target:state.target,eyeY,azimuth,orbitRadius:Math.hypot(...state.camera.map((v,i)=>v-target[i])),time:state.time,utcMs:clock.utcMs,paused:state.parameters.paused,sun:state.parameters.sun,weather:state.parameters.weather,weatherCurrent:copy(a.weather?.().current),quality:state.parameters.qualityPreset,sampling:state.parameters.renderSampling,graphics:state.parameters.graphics,lighting:localSettings(a.localLights()),viewport:viewport(),lens:{focalMm:state.lens.focalMm,aperture:state.lens.aperture,width:state.lens.width,height:state.lens.height,outputWidth:state.lens.outputWidth,outputHeight:state.lens.outputHeight,samples:state.lens.samples,depthOfField:state.lens.depthOfField,historyWeight:state.lens.temporal?.historyWeight,stillFrames:state.lens.temporal?.stillFrames},photometry:copy(a.photometry?.()),geometry:copy(a.palmFrameDiagnostics()),switchResult,png};
        view.pair.push(snapshot);if(capture)images.push({id,viewId,mode,image,png});
        const lockedState=state.time===locked.time&&clock.utcMs===locked.utcMs&&clock.running===false&&clock.mode===locked.mode&&state.parameters.paused&&same(state.parameters.sun,locked.sun)&&same(state.parameters.weather,locked.weather)&&same(snapshot.weatherCurrent,locked.weatherCurrent)&&state.parameters.qualityPreset===locked.quality&&same(state.parameters.renderSampling,locked.sampling)&&same(state.parameters.lens,locked.lens)&&state.parameters.graphics.indirect==='off'&&snapshot.lighting.mode==='off'&&!snapshot.lighting.flashlight.enabled;
        check(`${id}: physical/source/weather/quality/photo settings locked`,lockedState);
        check(`${id}: actual camera and uploaded frame mode match request`,vectorNear(state.camera,position)&&vectorNear(state.target,target)&&Math.abs(snapshot.orbitRadius-radius)<1e-6&&snapshot.geometry.mode===mode);
        if(capture)check(`${id}: nonblank actual PNG at fixed output size`,png.nonBlank&&png.width===locked.viewport.output[0]&&png.height===locked.viewport.output[1],png);
        // At least one paired near-shore view uses all-pixel numerical reads
        // and linked shader introspection; no proxy coverage pass is used.
        if(eyeY===2.5&&azimuth===0){
          const ranges=await a.inspectRadiance(),samplers=a.shaderSamplers();radianceAudits[mode]={viewId,full:ranges,summary:rangeSummary(ranges)};samplerAudits[mode]={viewId,...samplers};
          check(`${mode}: shore actual opaque/composed/reflection RGB finite and nonnegative`,radianceAudits[mode].summary.passed,radianceAudits[mode].summary);
          check(`${mode}: actual linked programs respect fragment sampler limit`,samplers.programs.length>0&&samplers.programs.every(p=>p.linked&&p.count<=samplers.fragmentLimit),{fragmentLimit:samplers.fragmentLimit,programs:samplers.programs.length,maximum:Math.max(...samplers.programs.map(p=>p.count))});
        }
      }
      check(`${viewId}: adjacent AB has identical camera/time/source settings`,same(view.pair[0].camera,view.pair[1].camera)&&same(view.pair[0].target,view.pair[1].target)&&view.pair[0].time===view.pair[1].time&&view.pair[0].utcMs===view.pair[1].utcMs&&same(view.pair[0].sun,view.pair[1].sun)&&same(view.pair[0].weatherCurrent,view.pair[1].weatherCurrent)&&same(view.pair[0].viewport,view.pair[1].viewport));
    }
    check('all 12 viewpoints include both real geometry modes',report.views.length===12&&report.views.every(v=>v.pair.length===2)&&(!capture||images.length===24));
  }catch(error){report.error=String(error.stack||error);check('comparison completed without runtime exception',false,{error:report.error});}
  finally{
    const restore=async(name,fn)=>{try{await fn();return true;}catch(error){restorationErrors.push({step:name,error:String(error.stack||error)});return false;}};
    await restore('pause during restore',()=>a.pause(true));
    await restore('disable GI before restoring geometry',()=>a.setGraphics({indirect:'off'}));
    const geometryRestored=await restore('original uploaded geometry before GI',()=>a.setPalmFrameMode(originalMode));
    // For a stock profile, reapplying it also restores its non-custom UI flag.
    // For an original custom profile, nothing except GI was changed: keep its
    // original resource sampling and restore that field through setGraphics.
    if(geometryRestored){
      if(!saved.qualityCustom)await restore('stock quality profile',()=>a.setQuality(saved.quality));
      await restore('graphics including original GI',()=>a.setGraphics(saved.graphics));
    }else report.limits.push('Geometry restoration failed: original GI was deliberately not re-enabled. The scene remains paused for manual recovery.');
    await restore('lens',()=>a.setLens(saved.lens));
    await restore('lamps and flashlight',()=>a.setLocalLights(saved.lights));
    await restore('saved artistic sun parameters',()=>a.setSun(saved.sun));
    await restore('UTC/location/rate/mode/clock-running',()=>a.setTime(clockSettings(saved.clock)));
    await restore('camera and target',()=>a.setCamera(initial.camera,initial.target));
    await restore('settle restored paused scene',()=>waitFrames(2));
    const restored=copy(a.state);report.restoration={errors:restorationErrors,beforeResume:{time:restored.time,camera:restored.camera,target:restored.target,parameters:restored.parameters,clock:copy(a.celestial()),palm:copy(a.palmFrameDiagnostics()),lighting:localSettings(a.localLights())}};
    check('restored baseline geometry/settings before resuming',restorationErrors.length===0&&a.palmFrameDiagnostics().mode===originalMode&&same(restored.parameters.sun,saved.sun)&&same(restored.parameters.weather,saved.weather)&&same(restored.parameters.graphics,saved.graphics)&&same(restored.parameters.lens,saved.lens)&&restored.parameters.qualityPreset===saved.quality&&restored.parameters.qualityCustom===saved.qualityCustom&&same(localSettings(a.localLights()),saved.lights)&&vectorNear(restored.camera,initial.camera)&&vectorNear(restored.target,initial.target)&&same(clockSettings(a.celestial()),clockSettings(saved.clock))&&restored.time===initial.time);
    if(!restorationErrors.length)await restore('original global pause',()=>a.pause(initial.parameters.paused));
    report.restoration.originalPauseRestored=a.state.parameters.paused===initial.parameters.paused;
    check('original global pause restored',report.restoration.originalPauseRestored);
    running.delete(a);
  }
  report.passed=checks.every(c=>c.passed);report.passedCount=checks.filter(c=>c.passed).length;report.total=checks.length;report.imageCount=images.length;
  return report;
}
