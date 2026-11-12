// Actual paused main-scene/lens draw only. No water captures, HDR bridge,
// CPU-to-FPS conversion, coverage proxy, or perceptual acceptance threshold.
const running=new WeakSet();
const clone=value=>structuredClone(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const frames=async n=>{for(let i=0;i<n;i++)await new Promise(r=>requestAnimationFrame(r));};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const lights=s=>({mode:s.mode,linked:s.linked,lamps:clone(s.lamps),flashlight:clone(s.flashlight)});
const clock=s=>({utcMs:s.utcMs,...s.observer,rate:s.rate,running:s.running,mode:s.mode,refraction:s.refraction,timeZoneOffsetMinutes:s.timeZoneOffsetMinutes});
const near=(a,b)=>a?.length===b.length&&b.every((v,i)=>Math.abs(a[i]-v)<1e-6);
function statistics(values){const s=values.slice().sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.ceil(p*s.length)-1)];return{count:s.length,meanMs:s.reduce((a,b)=>a+b,0)/s.length,medianMs:(s[(s.length-1)>>1]+s[s.length>>1])*.5,p95Ms:q(.95),minimumMs:s[0],maximumMs:s.at(-1)};}

/**
 * Root passes the actual THREE/renderer/API and synchronous
 * () => lens.render(scene, distance, {sdr:true}). No screenshot/readPixels
 * belongs inside drawSDR. Invoke outside a production frame callback.
 */
export async function runPalmFrameCostGPUCheck(THREE,renderer,a,drawSDR){
  if(typeof drawSDR!=='function')throw new TypeError('Pass a synchronous actual SDR main-lens draw');
  for(const key of ['pause','setTime','celestial','setSun','setCamera','setGraphics','setQuality','setLens','setLocalLights','localLights','palmFrameDiagnostics','setPalmFrameMode'])if(typeof a?.[key]!=='function')throw new TypeError(`Scene API missing ${key}()`);
  if(!a.state?.ready)throw Error('Actual scene not initialized');
  if(running.has(renderer))throw Error('Palm cost check already running on this renderer');
  const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext)return{date:new Date().toISOString(),status:'unavailable',reason:'EXT_disjoint_timer_query_webgl2 unavailable; no CPU substitute',results:[]};
  if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return{date:new Date().toISOString(),status:'unavailable',reason:'Another TIME_ELAPSED query is active; invoke outside production frame',results:[]};
  if(gl.getParameter(ext.GPU_DISJOINT_EXT))return{date:new Date().toISOString(),status:'unavailable',reason:'GPU currently disjoint; no timing accepted',results:[]};
  const initial=clone(a.state),original={clock:clone(a.celestial()),sun:clone(initial.parameters.sun),graphics:clone(initial.parameters.graphics),lens:clone(initial.parameters.lens),quality:initial.parameters.qualityPreset,custom:initial.parameters.qualityCustom,lighting:lights(a.localLights()),mode:a.palmFrameDiagnostics().mode};
  if(!['legacy','transport'].includes(original.mode))throw Error('Palm diagnostics must identify the active mode');
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,toneMapping:renderer.toneMapping,toneMappingExposure:renderer.toneMappingExposure,shadowAuto:renderer.shadowMap.autoUpdate,shadowDirty:renderer.shadowMap.needsUpdate,xr:renderer.xr.enabled,clearColour:renderer.getClearColor(new THREE.Color()).clone(),clearAlpha:renderer.getClearAlpha()};
  const queries=new Set(),checks=[],results=[],restorationErrors=[],started=performance.now(),deadline=started+12000;
  const check=(name,passed,detail={})=>checks.push({name,passed:!!passed,detail});
  const viewport=()=>({css:[innerWidth,innerHeight],dpr:devicePixelRatio,render:[a.state.lens.width,a.state.lens.height],output:[a.state.lens.outputWidth,a.state.lens.outputHeight],scale:a.state.renderScale,samples:a.state.lens.samples});
  const report={date:new Date().toISOString(),status:'inconclusive',scope:'Real paused SDR main scene plus lens GPU work only; excludes water/reflection captures, full-frame CPU, HDR bridge and ordinary frame scheduling. Not scene FPS or photo acceptance.',timer:'EXT_disjoint_timer_query_webgl2 nanoseconds / 1e6; no await or readback enclosed by any query',samplesPerVariantPerView:16,blocks:2,samplesPerBlock:8,untimedWarmDrawsPerBlockVariant:4,results,checks,original:{physicalTime:initial.time,paused:initial.parameters.paused,clock:original.clock,geometry:original.mode,quality:original.quality,custom:original.custom},limits:['Two blocks reverse order: legacy→transport, then transport→legacy. This reduces ordering bias but is not a randomized long-run hardware benchmark.','Each variant gets two real rAF settles and four untimed direct draws after a fresh history reset. Sixteen timed direct draws per variant/view.','The synchronous callback must explicitly request SDR and must not include water.render, screenshots, readPixels or asynchronous work.','Ordinary paused rAFs can execute while waiting for query availability, outside measured query intervals. GPU clock/cache state may still vary.','No subjective quality or FPS threshold is inferred from finite timing results.']};
  function restoreRenderer(){
    renderer.autoClear=saved.autoClear;renderer.autoClearColor=saved.autoClearColor;renderer.autoClearDepth=saved.autoClearDepth;renderer.autoClearStencil=saved.autoClearStencil;renderer.toneMapping=saved.toneMapping;renderer.toneMappingExposure=saved.toneMappingExposure;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowDirty;renderer.xr.enabled=saved.xr;renderer.setClearColor(saved.clearColour,saved.clearAlpha);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
    if(saved.target){const v=saved.target.viewport.clone();try{saved.target.viewport.copy(saved.currentViewport);renderer.setRenderTarget(saved.target,saved.face,saved.mip);}finally{saved.target.viewport.copy(v);}}else renderer.setRenderTarget(null,saved.face,saved.mip);
  }
  function assertIdle(){if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))throw Error('External TIME_ELAPSED query active; no nested query submitted');if(gl.isContextLost())throw Error('WebGL context lost; timing invalid');if(performance.now()>deadline)throw Error('Bounded 12s check expired; completed rows retained without full measurement claim');}
  function draw(){const result=drawSDR();if(result?.then)throw Error('drawSDR must be synchronous; asynchronous GPU scope is unsupported');}
  async function collect(batch){
    gl.flush();
    while(batch.some(q=>!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))){if(performance.now()>deadline)throw Error('GPU query timeout; no elapsed CPU fallback');if(gl.isContextLost())throw Error('WebGL context lost during query collection');await sleep(1);}
    if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('GPU disjoint; discard all timing claims');
    const values=batch.map(q=>Number(gl.getQueryParameter(q,gl.QUERY_RESULT))/1e6);
    for(const q of batch){gl.deleteQuery(q);queries.delete(q);}
    if(!values.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid/zero GPU timer result; no replacement with CPU submission duration');return values;
  }
  running.add(renderer);
  try{
    a.pause(true);await a.setTime({running:false});await a.setGraphics({indirect:'off'});a.setLocalLights({mode:'off',flashlight:{enabled:false}});a.setSun({azimuth:100,elevation:48,intensity:1});await sleep(220);await frames(2);
    const locked={time:a.state.time,utcMs:a.celestial().utcMs,mode:a.celestial().mode,sun:clone(a.state.parameters.sun),weather:clone(a.state.parameters.weather),weatherCurrent:clone(a.weather?.().current),sampling:clone(a.state.parameters.renderSampling),quality:a.state.parameters.qualityPreset,viewport:viewport()};report.locked=locked;
    const fixedView=(eyeY,azimuth)=>{const angle=azimuth*Math.PI/180,r=Math.sqrt(55**2-(eyeY-10)**2);return{position:[r*Math.sin(angle),eyeY,-r*Math.cos(angle)],target:[0,10,0],radiusMetres:55,eyeY,azimuth};};
    const views=[{id:'low-2p5-az0',...fixedView(2.5,0),focalMm:28},{id:'mid-14-az90',...fixedView(14,90),focalMm:28},{id:'HD-close-crown',position:[21,14.5,6],target:[7.6,12.2,-1.6],focalMm:50}];
    const verify=(view,mode)=>{
      const s=a.state,c=a.celestial(),l=a.localLights();
      const valid=s.parameters.paused&&s.time===locked.time&&c.utcMs===locked.utcMs&&!c.running&&c.mode===locked.mode&&same(s.parameters.sun,locked.sun)&&same(s.parameters.weather,locked.weather)&&same(a.weather?.().current,locked.weatherCurrent)&&same(s.parameters.renderSampling,locked.sampling)&&s.parameters.qualityPreset===locked.quality&&s.parameters.graphics.indirect==='off'&&l.mode==='off'&&!l.flashlight.enabled&&same(viewport(),locked.viewport)&&near(s.camera,view.position)&&near(s.target,view.target)&&s.parameters.lens.focal===view.focalMm&&!s.parameters.lens.dof&&a.palmFrameDiagnostics().mode===mode;
      if(!valid)throw Error(`Scene/time/source/camera/viewport lock changed in ${view.id}/${mode}`);
      return{time:s.time,utcMs:c.utcMs,camera:s.camera,target:s.target,lens:clone(s.lens),geometry:clone(a.palmFrameDiagnostics()),photometry:clone(a.photometry?.())};
    };
    for(const view of views){
      a.setCamera(view.position,view.target);a.setLens({...original.lens,focal:view.focalMm,dof:false});
      const raw={legacy:[],transport:[]},blocks=[];let metadata;
      for(let block=0;block<2;block++)for(const mode of (block===0?['legacy','transport']:['transport','legacy'])){
        assertIdle();
        if(a.palmFrameDiagnostics().mode===mode)a.setPalmFrameMode(mode==='legacy'?'transport':'legacy');
        a.setPalmFrameMode(mode);await frames(2);assertIdle();metadata=verify(view,mode);
        for(let warm=0;warm<4;warm++)draw();
        const batch=[];
        // The entire batch is synchronous. A production rAF cannot start its
        // own query between begin/end, and each query encloses exactly one draw.
        for(let sample=0;sample<8;sample++){
          assertIdle();const q=gl.createQuery();if(!q)throw Error('Unable to allocate GPU timer query');queries.add(q);
          gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{draw();}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);}batch.push(q);
        }
        restoreRenderer();const values=await collect(batch);raw[mode].push(...values);blocks.push({block,mode,stats:statistics(values),gpuMs:values});verify(view,mode);check(`${view.id}/${block}/${mode}: actual source/time/camera lock held`,true);
      }
      const legacy=statistics(raw.legacy),transport=statistics(raw.transport);
      results.push({view,viewport:locked.viewport,metadata,legacyGPU:legacy,transportGPU:transport,transportOverLegacy:{mean:transport.meanMs/legacy.meanMs,median:transport.medianMs/legacy.medianMs,p95:transport.p95Ms/legacy.p95Ms},meanChangePercent:(transport.meanMs/legacy.meanMs-1)*100,blocks,rawGPUms:raw});
    }
    check('96 actual draw queries collected without disjoint/nonfinite substitution',results.length===3&&results.every(r=>r.legacyGPU.count===16&&r.transportGPU.count===16));report.status='measured';
  }catch(error){report.reason=String(error.stack||error);check('GPU cost run completed',false,{error:report.reason});report.status='inconclusive';if(/disjoint/i.test(report.reason)){report.allTimingInvalid=true;report.limits.push('A disjoint event invalidates earlier rows too; retained numbers are diagnostic, not accepted timing.');}}
  finally{
    for(const q of queries)gl.deleteQuery(q);queries.clear();
    const restore=async(name,fn)=>{try{await fn();return true;}catch(error){restorationErrors.push({step:name,error:String(error.stack||error)});return false;}};
    try{
      await restore('pause',()=>a.pause(true));await restore('GI off before original geometry',()=>a.setGraphics({indirect:'off'}));const geometry=await restore('original geometry',()=>a.setPalmFrameMode(original.mode));
      if(geometry){if(!original.custom)await restore('stock quality',()=>a.setQuality(original.quality));await restore('original graphics/GI',()=>a.setGraphics(original.graphics));}
      await restore('lens',()=>a.setLens(original.lens));await restore('lamps/flashlight',()=>a.setLocalLights(original.lighting));await restore('artistic sun preference',()=>a.setSun(original.sun));await restore('clock/location',()=>a.setTime(clock(original.clock)));await restore('camera',()=>a.setCamera(initial.camera,initial.target));await restore('settle restored scene',()=>frames(2));
      const state=a.state;check('original scene restored before resuming',restorationErrors.length===0&&a.palmFrameDiagnostics().mode===original.mode&&state.time===initial.time&&same(clock(a.celestial()),clock(original.clock))&&same(state.parameters.sun,original.sun)&&same(state.parameters.weather,initial.parameters.weather)&&same(state.parameters.graphics,original.graphics)&&same(state.parameters.lens,original.lens)&&state.parameters.qualityPreset===original.quality&&state.parameters.qualityCustom===original.custom&&near(state.camera,initial.camera)&&near(state.target,initial.target)&&same(lights(a.localLights()),original.lighting));
      if(!restorationErrors.length)await restore('global pause',()=>a.pause(initial.parameters.paused));
      report.restoration={errors:restorationErrors,originalPauseRestored:a.state.parameters.paused===initial.parameters.paused};
      await restore('renderer state',restoreRenderer);
      check('original global pause and renderer state restored',report.restoration.originalPauseRestored&&restorationErrors.length===0&&renderer.getRenderTarget()===saved.target&&renderer.getActiveCubeFace()===saved.face&&renderer.getActiveMipmapLevel()===saved.mip&&renderer.getViewport(new THREE.Vector4()).equals(saved.viewport)&&renderer.getScissor(new THREE.Vector4()).equals(saved.scissor)&&renderer.getScissorTest()===saved.scissorTest&&renderer.toneMapping===saved.toneMapping&&renderer.toneMappingExposure===saved.toneMappingExposure&&renderer.autoClear===saved.autoClear&&renderer.xr.enabled===saved.xr);
    }finally{running.delete(renderer);}
  }
  report.wallSeconds=(performance.now()-started)/1000;report.passed=report.status==='measured'&&checks.every(c=>c.passed);report.passedCount=checks.filter(c=>c.passed).length;report.total=checks.length;report.interpretation='passed means a complete, state-checked GPU timing collection; it does not select the better image or establish a scene FPS target.';
  return report;
}
