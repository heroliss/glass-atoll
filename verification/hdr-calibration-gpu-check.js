import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createHDROutput,createHDRReadbackBridge,decodeFloat16,HDR_UPLOAD_WGSL} from '../hdr-output.js';

// The oracle is the unmodified vendored OutputPass rendered to a Float32 target.
// It does not import/re-evaluate hdrMapLinear or sdrFilmicAnchor.
const decodeSRGB=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;

export async function runHDRCalibrationCheck(THREE){
  const report={startedAt:new Date().toISOString(),checks:[],errors:[],glErrors:[],limits:[
    'The nit conversion is conditional on the browser/Windows SDR reference white; not a photometer measurement.',
    'Independent SDR oracle is the original vendored Three OutputPass, not the new mapping helper.',
    '700/1270 are calibration test targets; 1200 is explicitly a manual example, not a detected monitor value.',
    'CPU submission/readback wall time and cadence fixtures are not actual scene FPS.'
  ]};
  const add=(name,passed,details={})=>report.checks.push({name,passed:Boolean(passed),...details});
  let renderer=null,output=null,device=null,source=null,oracleTarget=null,geometry=null,material=null,referencePass=null,bridge=null;
  const start=performance.now();
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:false});renderer.setPixelRatio(2);renderer.setSize(16,16,false);
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.76;
    const gl=renderer.getContext(),initialFormat=gl.drawingBufferFormat;
    source=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType,depthBuffer:false});oracleTarget=new THREE.WebGLRenderTarget(16,16,{type:THREE.FloatType,depthBuffer:false});
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{uColour:{value:new THREE.Vector3()},uMode:{value:0}},vertexShader:'precision highp float;in vec3 position;out vec2 uv;void main(){uv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
      fragmentShader:'precision highp float;uniform vec3 uColour;uniform float uMode;in vec2 uv;out vec4 colour;void main(){vec3 c=uColour;if(uMode>.5){if(uv.y>.5)c=uv.x<.5?vec3(.18):vec3(2.,.5,.25);else c=uv.x<.5?vec3(.001,.0031308,.01):vec3(8.,1.,.1);}colour=vec4(c,1.);}'});
    const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
    const draw=(colour,mode=0)=>{material.uniforms.uColour.value.set(...colour);material.uniforms.uMode.value=mode;renderer.setRenderTarget(source);renderer.render(scene,camera);};
    referencePass=new OutputPass();referencePass.renderToScreen=false;
    function officialSDROracle(exposure){
      const colourSpace=renderer.outputColorSpace;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMappingExposure=exposure;
      try{referencePass.render(renderer,oracleTarget,source);renderer.setRenderTarget(oracleTarget);const data=new Float32Array(16*16*4);gl.readPixels(0,0,16,16,gl.RGBA,gl.FLOAT,data);return Array.from(data.slice((8*16+8)*4,(8*16+8)*4+3));}
      finally{renderer.outputColorSpace=colourSpace;}
    }
    output=await createHDROutput(THREE,renderer,{mount:null,maxHz:60,paperWhiteNits:280,peakNits:1270,sdrWhiteNits:280,calibrationSource:'explicit-test-target'});report.support=output.support;
    add('availability requires both confirmed extended canvas and HDR display',output.state.available===(output.support.apiAvailable&&matchMedia('(dynamic-range: high)').matches));
    add('native external copy independently retains values above one',output.support.floatCanvasCopy?.preserved,{probe:output.support.floatCanvasCopy});
    if(!output.support.available){add('unavailable display refuses enable',await output.setEnabled(true)===false&&!output.enabled);report.skipped='Display/API unavailable; no fake HDR override.';return report;}
    const pending=output.setEnabled(true);await output.setEnabled(false);const stale=await pending;
    add('concurrent first enable cannot override a later disable',stale===false&&!output.enabled&&gl.drawingBufferFormat===initialFormat,{stale,format:gl.drawingBufferFormat});
    const enabled=await output.setEnabled(true);add('real native HDR presentation enables',enabled&&output.state.mode==='float-canvas-external-copy',{mode:output.state.mode});if(!enabled||output.state.mode!=='float-canvas-external-copy')return report;
    const adapter=await navigator.gpu.requestAdapter();device=await adapter.requestDevice();
    async function capture(){
      const w=output.canvas.width,h=output.canvas.height,row=Math.ceil(w*8/256)*256;
      const texture=device.createTexture({size:[w,h],format:'rgba16float',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.COPY_SRC|GPUTextureUsage.RENDER_ATTACHMENT}),buffer=device.createBuffer({size:row*h,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
      device.pushErrorScope('validation');device.queue.copyExternalImageToTexture({source:output.canvas},{texture,colorSpace:'srgb',premultipliedAlpha:false},[w,h]);
      const encoder=device.createCommandEncoder();encoder.copyTextureToBuffer({texture},{buffer,bytesPerRow:row},[w,h]);device.queue.submit([encoder.finish()]);const validation=await device.popErrorScope();if(validation)throw new Error(validation.message);
      try{await buffer.mapAsync(GPUMapMode.READ);const data=new Uint16Array(buffer.getMappedRange()).slice();return {w,h,pixel(x,y){return Array.from(data.slice(y*row/2+x*4,y*row/2+x*4+4),decodeFloat16);}};}
      finally{texture.destroy();buffer.destroy();}
    }
    function present(exposure=1,time=performance.now(),force=true){return output.present(source,time,{exposure,force});}
    const samples=[];
    for(const [colour,exposure]of [[[0,0,0],1],[[.01,.03,.07],1],[[.18,.18,.18],1],[[.8,.3,.05],1],[[1,.5,.2],1],[[.18,.18,.18],.76]]){
      draw(colour);const oracle=officialSDROracle(exposure);present(exposure);const image=await capture(),code=image.pixel(8,8),nits=code.slice(0,3).map(value=>decodeSRGB(value)*280),expected=oracle.map(value=>value*280),error=nits.map((value,c)=>value-expected[c]);
      samples.push({colour,exposure,vendorSDRLinear:oracle,encodedPixel:code,expectedNits:expected,decodedNits:nits,errorNits:error});
    }
    add('dark and middle tones match original SDR OutputPass and exposure once',samples.every(sample=>sample.errorNits.every((value,c)=>Math.abs(value)<=.05+.004*sample.expectedNits[c])),{samples,oracle:'Unmodified vendor OutputPass into Float32 linear target, then independent IEC sRGB inverse and OS-white units.'});
    add('black remains black and opaque',samples[0].encodedPixel.slice(0,3).every(value=>value===0)&&samples[0].encodedPixel[3]===1);
    output.configure({paperWhiteNits:203,peakNits:1270,sdrWhiteNits:280});draw([.18,.18,.18]);const anchor=officialSDROracle(1);present();const paperImage=await capture(),paper=paperImage.pixel(8,8).slice(0,3).map(value=>decodeSRGB(value)*280),expectedPaper=anchor.map(value=>value*203);
    add('manual 203-nit paper white uses nit ratio, not a second exposure',paper.every((value,c)=>Math.abs(value-expectedPaper[c])<.05+.004*expectedPaper[c]),{decodedNits:paper,expectedNits:expectedPaper,paperWhiteNits:203,sdrWhiteNits:280});
    const peaks=[];
    for(const peakNits of [700,1200,1270]){
      output.configure({paperWhiteNits:280,peakNits,sdrWhiteNits:280});draw([10000,10000,10000]);present();const image=await capture(),code=image.pixel(8,8),nits=code.slice(0,3).map(value=>decodeSRGB(value)*280);
      const valid=nits.every(value=>Number.isFinite(value)&&value<=peakNits*1.004&&Math.abs(value-peakNits)<=peakNits*.004);
      peaks.push({targetPeakNits:peakNits,encoded:code,decodedNits:nits,manualExample:peakNits===1200});add('bright neutral approaches bounded '+peakNits+'-nit target',valid,peaks.at(-1));
    }
    report.nitTargets=peaks;
    output.configure({paperWhiteNits:280,peakNits:1270,sdrWhiteNits:280});draw([0,0,0],1);present();const native=await capture(),points=[[8,8],[24,8],[8,24],[24,24]],nativeSamples=points.map(([x,y])=>native.pixel(x,y));
    add('HDR colours remain finite opaque and within selected RGB peak',nativeSamples.every(pixel=>pixel.every(Number.isFinite)&&pixel[3]===1&&pixel.slice(0,3).every(value=>value>=0&&decodeSRGB(value)*280<=1270*1.004)),{pixels:nativeSamples});
    bridge=createHDRReadbackBridge(THREE,renderer);const packBefore=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),readTargetBefore=renderer.getRenderTarget();bridge.enqueue(source,performance.now(),{exposure:1});let frame=null;for(let i=0;i<100&&!frame;i++){await new Promise(resolve=>setTimeout(resolve,5));frame=bridge.poll();}
    add('PBO reads true linear HDR before any display mapping',frame&&Math.abs(frame.data[(2*16+12)*4]-8)<.01,{readback:frame?Array.from(frame.data.slice((2*16+12)*4,(2*16+12)*4+4)):null});
    add('PBO restores input target and pack binding',renderer.getRenderTarget()===readTargetBefore&&gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING)===packBefore);
    if(frame){
      const input=device.createTexture({size:[16,16],format:'rgba32float',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING}),destination=device.createTexture({size:[32,32],format:'rgba16float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),parameters=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),buffer=device.createBuffer({size:256*32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      try{
        device.pushErrorScope('validation');device.queue.writeTexture({texture:input},frame.data,{bytesPerRow:256},[16,16]);device.queue.writeBuffer(parameters,0,new Float32Array([32,32,1,1270/280,1,0,0,0]));
        const shader=device.createShaderModule({code:HDR_UPLOAD_WGSL}),layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:'unfilterable-float'}},{binding:1,visibility:GPUShaderStage.FRAGMENT,buffer:{type:'uniform'}}]}),pipeline=await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[layout]}),vertex:{module:shader,entryPoint:'vertexMain'},fragment:{module:shader,entryPoint:'fragmentMain',targets:[{format:'rgba16float'}]}});
        const group=device.createBindGroup({layout,entries:[{binding:0,resource:input.createView()},{binding:1,resource:{buffer:parameters}}]}),encoder=device.createCommandEncoder(),pass=encoder.beginRenderPass({colorAttachments:[{view:destination.createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();encoder.copyTextureToBuffer({texture:destination},{buffer,bytesPerRow:256},[32,32]);device.queue.submit([encoder.finish()]);const error=await device.popErrorScope();if(error)throw new Error(error.message);
        await buffer.mapAsync(GPUMapMode.READ);const data=new Uint16Array(buffer.getMappedRange()),pixels=points.map(([x,y])=>Array.from(data.slice(y*128+x*4,y*128+x*4+4),decodeFloat16));
        add('PBO WGSL agrees with native bridge and GL-row orientation',pixels.every((pixel,index)=>pixel.every((value,c)=>Math.abs(value-nativeSamples[index][c])<.006)),{native:nativeSamples,pbo:pixels,note:'Cross-implementation consistency; independent correctness oracle is the vendor SDR/nit tests above.'});
      }finally{input.destroy();destination.destroy();parameters.destroy();buffer.destroy();}
    }
    renderer.setViewport(1,2,10,11);renderer.setScissor(2,1,9,10);renderer.setScissorTest(true);renderer.autoClear=false;renderer.setRenderTarget(source);
    const state=()=>({target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear}),before=state();present();const after=state();
    add('renderer target viewport scissor and DPR state are restored',before.target===after.target&&JSON.stringify({...before,target:null})===JSON.stringify({...after,target:null}));
    const count=output.state.presentedFrames,last=output.state.lastPresentationTimestamp;add('throttle retains HDR routing',output.present(source,last+.1)===true&&output.state.presentedFrames===count);
    output.configure({maxHz:60});const base=performance.now()+100,beforeCadence=output.state.presentedFrames;present(1,base,true);for(let i=1;i<=9;i++)present(1,base+i*1000/90,false);
    add('60Hz cap retains fractional cadence on 90Hz synthetic input',output.state.presentedFrames-beforeCadence===7,{presentedIncludingInitial:output.state.presentedFrames-beforeCadence,expected:7,note:'Scheduling fixture, not measured FPS.'});
    renderer.setSize(20,12,false);output.setSize(40,24);draw([.18,.18,.18]);present();const resized=await capture();add('resize preserves full physical HDR dimensions and valid content',resized.w===40&&resized.h===24&&resized.pixel(20,12).slice(0,3).every(value=>value>0),{width:resized.w,height:resized.h});
    report.presentation=output.state;await output.setEnabled(false);add('disabling restores original SDR drawing-buffer format',!output.enabled&&gl.drawingBufferFormat===initialFormat&&output.canvas.style.display==='none',{initialFormat,restored:gl.drawingBufferFormat});
    for(let i=0;i<16;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;report.glErrors.push('0x'+error.toString(16));}add('no WebGL errors',report.glErrors.length===0);
  }catch(error){report.errors.push(String(error?.stack||error));}
  finally{bridge?.dispose();output?.dispose();device?.destroy();source?.dispose();oracleTarget?.dispose();geometry?.dispose();material?.dispose();referencePass?.dispose();renderer?.dispose();renderer?.forceContextLoss();report.wallTimeMs=performance.now()-start;report.cleanup='Own unmounted contexts/devices/resources disposed; no app renderer used.';report.passed=report.errors.length===0&&report.glErrors.length===0&&report.checks.length>0&&report.checks.every(check=>check.passed);}
  return report;
}
