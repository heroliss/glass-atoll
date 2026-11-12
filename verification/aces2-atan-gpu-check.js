// QA-only. No production integration, changed official oracle, or changed colour gate.
import {runACES2GPUCheck} from './aces2-gpu-check.js';
import {runACES2AtanStageGPUCheck,ACES2AtanQAState} from './aces2-atan-stage-gpu-check.js';
import {ACCURATE_ATAN2_GLSL,ATAN_CANDIDATE_RADIANS_GATE,makeAtanFixtureCases,float32Bits} from './aces2-atan-math.js';
import {ACES2_ATAN_CANDIDATE} from './aces2-atan-candidate/candidate-descriptor.js';

/** Isolated generic numeric test, borrowing and restoring the caller-locked renderer.
 * The polynomial truncation bound is NOT the float GPU bound. The latter is a
 * separate predeclared 1e-6 rad engineering gate, including reduction/quadrants.
 */
export async function runAccurateAtan2GPUCheck(THREE,renderer){
  const {capture,restore,differences,PIXEL_PARAMS}=ACES2AtanQAState,gl=renderer.getContext(),previous=capture(THREE,renderer),owned=[],checks=[],check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,...evidence}),oldError=renderer.debug.onShaderError,oldCheck=renderer.debug.checkShaderErrors;
  const report={schema:'glass-atoll.generic-accurate-atan2-GPU.v1',dateUTC:new Date().toISOString(),nonOfficialCandidate:true,actualGPU:false,isolated:true,passed:false,checks,shaderErrors:[],glErrors:[],gateRadians:ATAN_CANDIDATE_RADIANS_GATE,candidate:ACES2_ATAN_CANDIDATE};
  function errors(label){const values=[];for(let i=0;i<16;i++){const value=gl.getError();if(value===gl.NO_ERROR)break;values.push(value);report.glErrors.push({label,value});}return values;}
  try{
    errors('entry');if(!renderer.capabilities.isWebGL2||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 and EXT_color_buffer_float are required');
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(g,p,vs,fs)=>report.shaderErrors.push({program:g.getProgramInfoLog(p),vertex:g.getShaderInfoLog(vs),fragment:g.getShaderInfoLog(fs)});renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.xr.enabled=false;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null);for(let i=0;i<renderer.capabilities.maxTextures;i++)gl.bindSampler(i,null);for(const k of PIXEL_PARAMS)gl.pixelStorei(gl[k],k==='PACK_ALIGNMENT'||k==='UNPACK_ALIGNMENT'?1:k==='UNPACK_COLORSPACE_CONVERSION_WEBGL'?gl.NONE:0);
    const cases=makeAtanFixtureCases(),width=32,height=Math.ceil(cases.length/width),input=new Float32Array(width*height*4);for(let i=0;i<cases.length;i++)input.set([cases[i].y,cases[i].x,0,1],i*4);
    const texture=new THREE.DataTexture(input,width,height,THREE.RGBAFormat,THREE.FloatType);Object.assign(texture,{internalFormat:'RGBA32F',minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,wrapS:THREE.ClampToEdgeWrapping,wrapT:THREE.ClampToEdgeWrapping,generateMipmaps:false,flipY:false,unpackAlignment:1,colorSpace:THREE.NoColorSpace,needsUpdate:true});owned.push(texture);
    const material=new THREE.RawShaderMaterial({name:'QA generic accurate atan2',glslVersion:THREE.GLSL3,uniforms:{tInput:{value:texture}},vertexShader:'precision highp float;in vec2 position;out vec2 vUv;void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}',fragmentShader:`precision highp float;precision highp int;precision highp sampler2D;uniform highp sampler2D tInput;in vec2 vUv;out vec4 colour;\n${ACCURATE_ATAN2_GLSL}\nvoid main(){vec2 xy=texture(tInput,vUv).rg;float a=qaAccurateAtan2(xy.x,xy.y);uint ab=floatBitsToUint(a);colour=vec4(a,(ab&0x7fffffffu)>0x7f800000u?1.:0.,ab==0x80000000u?1.:0.,1.);}`,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false});owned.push(material);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,3,-1,-1,3],2));owned.push(geometry);const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
    const target=new THREE.WebGLRenderTarget(width,height,{format:THREE.RGBAFormat,type:THREE.FloatType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});target.texture.internalFormat='RGBA32F';target.texture.generateMipmaps=false;target.texture.colorSpace=THREE.NoColorSpace;target.viewport.set(0,0,width,height);owned.push(target);
    renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.render(scene,camera);const actual=new Float32Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,actual);
    const program=renderer.properties.get(material).currentProgram?.program;check('generic_ES3_shader_actually_linked',!!program&&gl.getProgramParameter(program,gl.LINK_STATUS),{programLog:program?gl.getProgramInfoLog(program):'no program'});
    const attachment={componentType:gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE),redBits:gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_RED_SIZE),samples:gl.getParameter(gl.SAMPLES)};check('actual_RGBA32F_nonMSAA_output',attachment.componentType===gl.FLOAT&&attachment.redBits===32&&attachment.samples===0,attachment);
    let maximum=0,worst=null,finiteFailures=0,specialFailures=0,axisFailures=0,subnormalFailures=0;const failures=[];let nonfiniteInputs=0,subnormalInputs=0,axisCases=0;
    for(let i=0;i<cases.length;i++){
      const row=cases[i],value=actual[i*4],expected=Math.atan2(row.y,row.x),isNaNExpected=Number.isNaN(expected),error=isNaNExpected?0:Math.abs(value-expected),negativeZeroExpected=Object.is(expected,-0),nanFlag=actual[i*4+1]===1,negativeZeroFlag=actual[i*4+2]===1,axis=(row.y===0||row.x===0),subnormal=[row.x,row.y].some(v=>(float32Bits(v)&0x7fffffff)>0&&(float32Bits(v)&0x7fffffff)<0x00800000),special=![row.x,row.y].every(Number.isFinite),good=isNaNExpected?Number.isNaN(value)&&nanFlag:!nanFlag&&Number.isFinite(value)&&error<=ATAN_CANDIDATE_RADIANS_GATE&&(expected!==0||negativeZeroFlag===negativeZeroExpected);
      if(special)nonfiniteInputs++;if(axis)axisCases++;if(subnormal)subnormalInputs++;
      if(!isNaNExpected&&Number.isFinite(error)&&error>maximum){maximum=error;worst={id:row.id,inputBitsYX:[float32Bits(row.y),float32Bits(row.x)],inputYX:[row.y,row.x].map(v=>Number.isFinite(v)?(Object.is(v,-0)?'-0':v):String(v)),expectedRadians:expected,actualRadians:value,errorRadians:error};}
      if(!good){if(special)specialFailures++;else finiteFailures++;if(axis)axisFailures++;if(subnormal)subnormalFailures++;if(failures.length<16)failures.push({id:row.id,inputBitsYX:[float32Bits(row.y),float32Bits(row.x)],expected:String(expected),actual:String(value),errorRadians:Number.isFinite(error)?error:null,nanFlag,negativeZeroFlag,negativeZeroExpected});}
    }
    report.numeric={cases:cases.length,dimensions:[width,height],maximumAbsoluteRadians:maximum,worst,nonfiniteInputs,axisCases,subnormalInputs,finiteFailures,specialFailures,axisFailures,subnormalFailures,firstFailures:failures,fullFailureCount:finiteFailures+specialFailures};
    check('all_finite_quadrants_reduction_extreme_inputs_with_predeclared_1e_minus6_rad_gate',finiteFailures===0,{finiteCases:cases.length-nonfiniteInputs,maximumAbsoluteRadians:maximum,worst,finiteFailures});
    check('signed_zero_axes_and_negative_pi_convention',axisFailures===0,{axisCases,axisFailures});
    check('explicit_Infinity_and_NaN_classification',specialFailures===0,{nonfiniteInputs,specialFailures});
    check('subnormal_bit_ratio_cases_measured_not_assumed',subnormalFailures===0,{subnormalInputs,subnormalFailures,scope:'Actual GPU result includes texture transport/compiler FTZ behavior. CPU support alone does not certify all drivers.'});
    report.actualGPU=true;check('no_owned_GL_or_shader_errors',report.shaderErrors.length===0&&errors('generic').length===0,{shaderErrors:report.shaderErrors,glErrors:report.glErrors.filter(e=>e.label!=='entry')});
  }catch(error){report.failure={message:String(error.message||error),stack:String(error.stack||'')};check('generic_numeric_fixture_completes_without_fallback',false,report.failure);}
  finally{
    for(const resource of owned.reverse())try{resource.dispose();}catch(error){check('owned_generic_resource_disposal',false,{error:String(error)});}renderer.debug.onShaderError=oldError;renderer.debug.checkShaderErrors=oldCheck;
    try{restore(THREE,renderer,previous);const changed=differences(previous,capture(THREE,renderer));check('caller_full_state_restored_without_resize',changed.length===0,{changed});check('restoration_introduces_no_GL_errors',errors('restoration').length===0);}catch(error){check('caller_full_state_restored_without_resize',false,{error:String(error.stack||error)});}
  }
  report.counts={passed:checks.filter(c=>c.passed).length,total:checks.length};report.passed=checks.length>0&&checks.every(c=>c.passed);return report;
}

/** Caller must exclusively own renderer. Defaults run generic atan fixtures,
 * unchanged official 963-sample gates at all3 peaks, then the frozen3-input trace.
 * Optional timer is the existing tiny64x16 isolated GPU timer, not scene FPS.
 */
export async function runACES2AtanCandidateGPUCheck(THREE,renderer,{runAtanFixtures=true,run963=true,runStages=true,targets=[100,700,1270],measurePerformance=false,timingSamples=12,browserSDRWhiteNits=280}={}){
  const report={schema:'glass-atoll.aces2-accurate-atan-candidate-GPU.v1',dateUTC:new Date().toISOString(),nonOfficialCandidate:true,productionIntegrated:false,candidate:ACES2_ATAN_CANDIDATE,passed:false,actualGPU:false,isolated:true,originalEvidence:'aces2-gpu-first.json remains52/53; no original shader, asset, tolerance or report changed.',results:{},limits:['This tests a non-official generic arithmetic candidate, not an official OCIO certification or HDR canvas presentation.','The original colour thresholds, official Float32 inputs/CPU results, hue tables and unit/OETF gates are reused unchanged.','Stage trace must still match its uninstrumented candidate endpoint bit-for-bit.','Any timer is the tiny isolated QA transform, not production frame time; production integration is not authorized.']};
  // Verify the generated manifest itself before giving it to the unmodified423 loader.
  const response=await fetch(new URL('./aces2-atan-candidate/export-report.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('Candidate metadata fetch failed '+response.status);const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==ACES2_ATAN_CANDIDATE.indexSHA256)throw Error('Candidate manifest SHA changed');
  if(runAtanFixtures)report.results.atan=await runAccurateAtan2GPUCheck(THREE,renderer);
  if(run963){report.results.colour=await runACES2GPUCheck(THREE,renderer,{targets,baseURL:new URL('./aces2-atan-candidate/',import.meta.url),browserSDRWhiteNits,measurePerformance,timingSamples});report.results.colour.nonOfficialCandidate=true;report.results.colour.candidateInterpretation='Unmodified423 numerical machinery applied to the explicitly non-official atan-only candidate; original official reference remains52/53.';}
  if(runStages)report.results.stages=await runACES2AtanStageGPUCheck(THREE,renderer);
  const rows=Object.values(report.results);report.counts={passed:rows.reduce((n,r)=>n+(r.counts?.passed??0),0),total:rows.reduce((n,r)=>n+(r.counts?.total??0),0)};report.passed=rows.length>0&&rows.every(r=>r.passed);report.actualGPU=rows.length>0&&rows.every(r=>r.actualGPU);return report;
}
