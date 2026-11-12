// QA only: reads the ACTUAL interpolants of the unchanged production shader.
// The original requested-centre precision failure remains separate evidence.
export async function runAdaptiveTrailVaryingProbe(THREE,renderer){
  if(!renderer?.isWebGLRenderer)throw Error('An existing WebGL renderer is required');
  const oracle=await fetch(new URL('./gaussian-streak-oracle.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Independent oracle unavailable');return r.json();});
  const {createFireworks}=await import('../../fireworks.js');
  const gl=renderer.getContext(),errors=()=>{const out=[];for(let i=0;i<16;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;out.push(e);}return out;};
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,shadowAuto:renderer.shadowMap.autoUpdate,shadowDirty:renderer.shadowMap.needsUpdate,program:gl.getParameter(gl.CURRENT_PROGRAM),vao:gl.getParameter(gl.VERTEX_ARRAY_BINDING),readFBO:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER)};
  const report={schema:'glass-atoll.adaptive-tail-varying-probe.v2',dateUTC:new Date().toISOString(),actualGPU:true,subpixelBits:gl.getParameter(gl.SUBPIXEL_BITS),entryErrors:errors(),checks:[],fixtures:[]};
  const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
  const width=128,height=128,target=new THREE.WebGLRenderTarget(width,height,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false}),camera=new THREE.PerspectiveCamera(40,1,.15,24000),f=createFireworks(THREE),pixel=new Float32Array(4);
  let probeMaterial=null,material=null,mesh=null;
  try{
    report.floatBlend=!!gl.getExtension('EXT_float_blend');if(!report.floatBlend)throw Error('RGBA32F additive fixture requires EXT_float_blend');
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    camera.filmGauge=36;camera.setFocalLength(28);camera.position.set(0,0,0);camera.lookAt(0,0,-100);camera.updateMatrixWorld();
    f.configure({autoLaunch:false,trailIntegration:'adaptive'});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'palm',seed:42});f.update({time:launch.burstTime+.8,windVector:[0,0,0]});
    const optics={width,height,focalMm:28,sensorHeightMm:camera.getFilmHeight(),aperture:8,focusMetres:100,shutterSeconds:0,dof:false,vignette:false};
    f.render({renderer,target,camera,frame:{storageEV:0,sceneScale:1,rawPerCandela:1},optics,air:{enabled:false},legacySmoke:false});
    mesh=f.effectsScene.children[0];const geometry=mesh.geometry;material=mesh.material;
    const pixelScale=Math.abs(camera.projectionMatrix.elements[5])*height*.5/100;
    probeMaterial=material.clone();probeMaterial.uniforms={...material.uniforms,uQAProbeStage:{value:0}};
    const marker='outColour=vec4(rgb*uStorageScale*vignette,alpha);';
    if(material.fragmentShader.split(marker).length!==2)throw Error('Production output marker changed; refuse approximate instrumentation');
    const hasPhysicalCentre=material.fragmentShader.includes('flat in vec2 vTrailCentre;');report.hasPhysicalCentre=hasPhysicalCentre;
    probeMaterial.fragmentShader=material.fragmentShader.replace('out vec4 outColour;','out vec4 outColour;uniform int uQAProbeStage;').replace(marker,`${marker}
      if(uQAProbeStage==1)outColour=vec4(vOffset,vSigma,vOriginalSigma);
      else if(uQAProbeStage==2)outColour=vec4(vMotion,vTrailSampling.xy);
      else if(uQAProbeStage==3)outColour=vec4(vTrailSampling.zw,vDistance,vOmega);
      else if(uQAProbeStage==4)outColour=vec4(vWorld,1.);
      ${hasPhysicalCentre?'else if(uQAProbeStage==5)outColour=vec4(vTrailCentre,gl_FragCoord.xy);':''}`);
    probeMaterial.needsUpdate=true;
    function attr(name,values){const a=geometry.getAttribute(name);a.array.set(values,0);a.needsUpdate=true;}
    function setup(fixture){
      const {motion,pixelOffset,sigma}=fixture,centre=[(.5-pixelOffset[0])/pixelScale,(.5-pixelOffset[1])/pixelScale,-100],radius=Math.sqrt(Math.max(0,(sigma*sigma-.0784)*2))/pixelScale;
      attr('aCentre',centre);attr('aVelocity',[0,0,0]);attr('aStretch',[motion[0]/pixelScale,motion[1]/pixelScale,0]);attr('aColour',[1,.5,.25]);attr('aShape',[0,radius,1,0]);attr('aSmokeLight',[0,0,0]);attr('aTemporal0',[1,1,1,1]);attr('aTemporal1',[1,1,1,1]);geometry.instanceCount=1;
      const slope2=(centre[0]*centre[0]+centre[1]*centre[1])/10000,omega=4/(width*height*Math.abs(camera.projectionMatrix.elements[0]*camera.projectionMatrix.elements[5]))/(1+slope2)**1.5;
      return {centre,amplitude:1/((10000+centre[0]*centre[0]+centre[1]*centre[1])*omega)};
    }
    function draw(stage=null){mesh.material=stage===null?material:probeMaterial;if(stage!==null)probeMaterial.uniforms.uQAProbeStage.value=stage;renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.render(f.effectsScene,camera);renderer.readRenderTargetPixels(target,width/2,height/2,1,1,pixel);return [...pixel];}
    let maxInstrumentationDelta=0,maxOffsetDrift=0,maxPhysicalOffsetDrift=0;
    for(let index=0;index<oracle.fixtures.length;index++){
      const fixture=oracle.fixtures[index],setupInfo=setup(fixture),original=draw(),instrumented=draw(0),offsetSigma=draw(1),motionN=draw(2),blendDistanceOmega=draw(3),world=draw(4);
      let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(original[c]-instrumented[c]));maxInstrumentationDelta=Math.max(maxInstrumentationDelta,delta);
      const offsetDrift=offsetSigma.slice(0,2).map((v,i)=>v-fixture.pixelOffset[i]);maxOffsetDrift=Math.max(maxOffsetDrift,...offsetDrift.map(Math.abs));
      const measuredAmplitude=1/(blendDistanceOmega[2]**2*blendDistanceOmega[3]);
      let physicalCentre=null,physicalOffset=null,physicalOffsetDrift=null;if(hasPhysicalCentre){physicalCentre=draw(5);physicalOffset=[physicalCentre[2]-physicalCentre[0],physicalCentre[3]-physicalCentre[1]];physicalOffsetDrift=physicalOffset.map((v,i)=>v-fixture.pixelOffset[i]);maxPhysicalOffsetDrift=Math.max(maxPhysicalOffsetDrift,...physicalOffsetDrift.map(Math.abs));}
      report.fixtures.push({index,requested:{pixelOffset:fixture.pixelOffset,motion:fixture.motion,sigma:fixture.sigma},requestedCandidate:fixture.candidateLocalShaderErf,original,instrumented,instrumentationMaximumDelta:delta,actual:{pixelOffset:offsetSigma.slice(0,2),sigma:offsetSigma[2],originalSigma:offsetSigma[3],motion:motionN.slice(0,2),N:motionN.slice(2),blend:blendDistanceOmega[0],adaptive:blendDistanceOmega[1],distance:blendDistanceOmega[2],omega:blendDistanceOmega[3],world:world.slice(0,3),...(hasPhysicalCentre?{projectedCentre:physicalCentre.slice(0,2),fragmentCentre:physicalCentre.slice(2),physicalOffset}: {})},offsetDrift,...(hasPhysicalCentre?{physicalOffsetDrift}:{}),idealAmplitude:setupInfo.amplitude,measuredAmplitude,normalizedWithIdeal:original[0]/setupInfo.amplitude,normalizedWithActual:original[0]/measuredAmplitude});
    }
    report.summary={fixtures:report.fixtures.length,maximumInstrumentationDelta:maxInstrumentationDelta,maximumAbsoluteOffsetDrift:maxOffsetDrift,...(hasPhysicalCentre?{maximumPhysicalOffsetDrift:maxPhysicalOffsetDrift}:{})};
    check('QA instrumented endpoint remains bitexact to the unchanged production endpoint',maxInstrumentationDelta===0,report.summary);
    check('actual interpolants and amplitudes are finite with positive sigma and sample counts',report.fixtures.every(r=>[...r.actual.pixelOffset,...r.actual.motion,r.actual.sigma,...r.actual.N,r.measuredAmplitude,r.normalizedWithActual].every(Number.isFinite)&&r.actual.sigma>0&&r.actual.N.every(v=>v>=8)),{fixtures:report.fixtures.length});
    report.operationErrors=errors();check('no new WebGL errors',report.operationErrors.length===0,report.operationErrors);
  }catch(e){report.failure={message:String(e.message||e),stack:String(e.stack||'')};check('probe completes',false,report.failure);}
  finally{
    if(mesh&&material)mesh.material=material;probeMaterial?.dispose();f.dispose();target.dispose();renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.setClearColor(saved.clear,saved.alpha);renderer.autoClear=saved.autoClear;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowDirty;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFBO);gl.readBuffer(saved.readBuffer);gl.useProgram(saved.program);gl.bindVertexArray(saved.vao);
    report.restorationErrors=errors();report.stateRestored=renderer.getRenderTarget()===saved.target&&renderer.getActiveCubeFace()===saved.face&&renderer.getActiveMipmapLevel()===saved.mip&&renderer.getViewport(new THREE.Vector4()).equals(saved.viewport)&&renderer.getScissor(new THREE.Vector4()).equals(saved.scissor)&&renderer.getScissorTest()===saved.scissorTest&&renderer.autoClear===saved.autoClear&&gl.getParameter(gl.CURRENT_PROGRAM)===saved.program&&gl.getParameter(gl.VERTEX_ARRAY_BINDING)===saved.vao&&gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)===saved.readFBO&&gl.getParameter(gl.READ_BUFFER)===saved.readBuffer;
    check('caller renderer and raw bindings restored',report.stateRestored&&report.restorationErrors.length===0,{stateRestored:report.stateRestored,errors:report.restorationErrors});
  }
  report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);report.limits=['Diagnostic instrumentation only; requested pixel centre goldens and the original failure are unchanged.','Actual-interpolant oracle agreement would identify the integration arithmetic, not certify that raster-interpolated offsets equal the physical projected centre.','No source state, runtime shader, tolerance or oracle asset is modified.'];return report;
}
