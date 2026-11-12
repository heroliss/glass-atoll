// Independent, unattached WebGL2 context. No main-renderer state is touched.
// GPU timestamps wrap both FSR draws, not CPU submission or shader warmup.
export async function runFSRCheck(THREE,createSpatialUpscaler,{
  samples=31,warmupFrames=12,budgetMs=1,includePNG=true,timeoutMs=6000,
}={}) {
  const report={
    kind:'FSR1 EASU + RCAS functional readback and independent-context GPU timing',
    passed:false,functionalPassed:false,checks:[],shaderErrors:[],glErrors:[],
    timing:{available:false,unit:'GPU milliseconds',cpuSubmitIsNotGpu:true},
    budget:{targetMs:budgetMs,passed:false},pattern:null,cleanup:{disposed:false,contextLossRequested:false},
  };
  let renderer,upscaler,gl;const textures=[],queries=[];
  const check=(name,passed,details={})=>{report.checks.push({name,passed,...details});return passed;};
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const percentile=(values,p)=>{const a=[...values].sort((x,y)=>x-y),f=(a.length-1)*p,i=Math.floor(f);return a[i]+(a[Math.min(i+1,a.length-1)]-a[i])*(f-i);};
  try {
    const canvas=typeof document!=='undefined'?document.createElement('canvas'):new OffscreenCanvas(1,1);
    renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(1);renderer.setSize(16,16,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
    renderer.debug.checkShaderErrors=true;
    renderer.debug.onShaderError=(context,program,vertex,fragment)=>{
      report.shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});
    };
    gl=renderer.getContext();gl.disable(gl.DITHER);
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    report.context={webgl2:!!renderer.capabilities.isWebGL2,version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),attributes:gl.getContextAttributes(),appendedToDOM:!!canvas.isConnected,fixedFunctionDither:false};
    upscaler=createSpatialUpscaler(THREE,renderer);await upscaler.ready;

    function texture(width,height,pixel) {
      const bytes=new Uint8Array(width*height*4);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const c=pixel(x,y,width,height),i=(y*width+x)*4;
        bytes[i]=c[0];bytes[i+1]=c[1];bytes[i+2]=c[2];bytes[i+3]=255;
      }
      const t=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
      t.colorSpace=THREE.NoColorSpace;t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.flipY=false;t.needsUpdate=true;textures.push(t);
      return {texture:t,bytes,width,height};
    }
    function renderRead(input,outWidth,outHeight) {
      renderer.setSize(outWidth,outHeight,false);upscaler.setSize(input.width,input.height,outWidth,outHeight);upscaler.render(input);
      const pixels=new Uint8Array(outWidth*outHeight*4);gl.readPixels(0,0,outWidth,outHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
    }
    function flatError(pixels,rgb) {
      let maximum=0,wrongAlpha=0;
      for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++)maximum=Math.max(maximum,Math.abs(pixels[i+c]-rgb[c]));if(pixels[i+3]!==255)wrongAlpha++;}
      return {maximumByteError:maximum,firstRGBA:Array.from(pixels.slice(0,4)),wrongAlpha};
    }

    const rgb=[73,128,191],flat=texture(7,5,()=>rgb),flatPixels=renderRead(flat,28,20),flatResult=flatError(flatPixels,rgb);
    check('perceptual RGB flat field survives without double gamma/tone mapping',flatResult.maximumByteError<=1&&flatResult.wrongAlpha===0,{expectedRGB:rgb,...flatResult});
    for(const [name,rgb] of [['black',[0,0,0]],['white',[255,255,255]]]){
      const input=texture(8,8,()=>rgb),pixels=renderRead(input,16,16),result=flatError(pixels,rgb);
      check(`${name} limit remains ${name}, not invalid/blackened output`,result.maximumByteError===0&&result.wrongAlpha===0,{expectedRGB:rgb,...result});
    }
    const native=texture(47,31,(x,y)=>[(x*17+y*3)&255,(x*7+y*29)&255,(x*13+y*11)&255]);
    const nativePixels=renderRead(native,47,31);let changedBytes=0,maximumNativeError=0;
    for(let i=0;i<nativePixels.length;i++){const error=Math.abs(nativePixels[i]-native.bytes[i]);if(error)changedBytes++;maximumNativeError=Math.max(maximumNativeError,error);}
    check('native size bypass is byte-exact including orientation',changedBytes===0&&upscaler.state.bypass,{changedBytes,maximumByteError:maximumNativeError,mode:upscaler.state.mode});

    const ramp=texture(96,60,(x,y,w)=>{const v=Math.round(x/(w-1)*255);return[v,v,v];});
    const rampPixels=renderRead(ramp,128,80),row=40,values=[];let largestDownstep=0,absoluteError=0,channelDisagreement=0;
    for(let x=0;x<128;x++){
      const i=(row*128+x)*4,v=rampPixels[i];values.push(v);
      if(x)largestDownstep=Math.max(largestDownstep,values[x-1]-v);
      const src=Math.max(0,Math.min(95,(x+.5)*96/128-.5));absoluteError+=Math.abs(v-src/95*255);
      channelDisagreement=Math.max(channelDisagreement,Math.abs(v-rampPixels[i+1]),Math.abs(v-rampPixels[i+2]));
    }
    const rampResult={largestDownstep,meanAbsoluteByteError:absoluteError/128,uniqueValues:new Set(values).size,left:values[0],right:values.at(-1),channelDisagreement};
    check('gradient remains bounded, monotonic within quantization, and non-black',largestDownstep<=2&&rampResult.meanAbsoluteByteError<3&&rampResult.uniqueValues>64&&rampResult.left<=2&&rampResult.right>=253&&channelDisagreement<=1,rampResult);

    const edge=texture(96,60,(x,y,w,h)=>{
      const a=x/w,b=y/h,diagonal=a>.19+b*.66;
      return diagonal?[Math.round(195+40*a),Math.round(148+48*b),Math.round(55+25*a)]:[Math.round(18+25*b),Math.round(65+42*a),Math.round(122+65*b)];
    });
    const edgePixels=renderRead(edge,128,80);let min=255,max=0,sum=0,blackPixels=0,whitePixels=0;
    for(let i=0;i<edgePixels.length;i+=4){for(let c=0;c<3;c++){const v=edgePixels[i+c];min=Math.min(min,v);max=Math.max(max,v);sum+=v;}if(edgePixels[i]===0&&edgePixels[i+1]===0&&edgePixels[i+2]===0)blackPixels++;if(edgePixels[i]===255&&edgePixels[i+1]===255&&edgePixels[i+2]===255)whitePixels++;}
    const edgeResult={minimumByte:min,maximumByte:max,meanByte:sum/(128*80*3),blackPixels,whitePixels};
    check('diagonal edge is bounded with meaningful non-black/non-white content',min>=0&&max<=255&&edgeResult.meanByte>35&&edgeResult.meanByte<220&&blackPixels<10&&whitePixels<10,edgeResult);
    if(includePNG&&canvas.toDataURL)report.pattern={width:128,height:80,dataURL:canvas.toDataURL('image/png'),note:'Authored encoded RGB edge/gradient fixture, not photographic quality acceptance.'};

    const extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    report.timing.extensionAvailable=!!extension;
    if(extension){
      samples=Math.max(8,Math.min(60,Math.round(samples)));warmupFrames=Math.max(4,Math.min(30,Math.round(warmupFrames)));
      const input=texture(1080,675,(x,y,w,h)=>{
        const a=x/(w-1),b=y/(h-1),v=.5+.5*Math.sin(a*17+b*11);
        return [Math.round(28+180*a),Math.round(24+160*b),Math.round(30+145*v)];
      });
      renderer.setSize(1440,900,false);upscaler.setSize(1080,675,1440,900);
      for(let i=0;i<warmupFrames;i++)upscaler.render(input);
      gl.finish(); // Exclude uploads, compilation, and warmup from timestamps.
      if(gl.getParameter(extension.GPU_DISJOINT_EXT))throw new Error('GPU timestamp state disjoint before measurement.');
      for(let i=0;i<samples;i++){
        const query=gl.createQuery();queries.push(query);
        gl.beginQuery(extension.TIME_ELAPSED_EXT,query);
        try{upscaler.render(input);}finally{gl.endQuery(extension.TIME_ELAPSED_EXT);}
      }
      gl.flush();const deadline=performance.now()+timeoutMs;
      while(!queries.every(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))){
        if(gl.getParameter(extension.GPU_DISJOINT_EXT))throw new Error('GPU timestamp state became disjoint.');
        if(performance.now()>deadline)throw new Error('Timed out waiting for GPU timestamps.');
        await pause(8);
      }
      const disjoint=!!gl.getParameter(extension.GPU_DISJOINT_EXT);
      const milliseconds=queries.map(q=>Number(gl.getQueryParameter(q,gl.QUERY_RESULT))/1e6);
      const valid=!disjoint&&milliseconds.every(v=>Number.isFinite(v)&&v>0);
      const mean=milliseconds.reduce((a,b)=>a+b,0)/milliseconds.length,median=percentile(milliseconds,.5),p95=percentile(milliseconds,.95);
      report.timing={...report.timing,available:valid,disjoint,input:[1080,675],output:[1440,900],passesPerSample:2,sampleCount:milliseconds.length,warmupFrames,minimumMs:Math.min(...milliseconds),maximumMs:Math.max(...milliseconds),meanMs:mean,medianMs:median,p95Ms:p95,samplesMs:milliseconds,note:'Two complete GPU draws and target switches in this independent GL context. Shader warmup and CPU submit duration excluded.'};
      report.budget={targetMs:budgetMs,medianWithinBudget:valid&&median<=budgetMs,p95WithinBudget:valid&&p95<=budgetMs,allWithinBudget:valid&&Math.max(...milliseconds)<=budgetMs,passed:valid&&median<=budgetMs&&p95<=budgetMs};
    }else report.timing.note='GPU timing extension unavailable; no CPU substitute and no claim that the GPU budget passed.';
    for(let i=0;i<16;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;report.glErrors.push('0x'+error.toString(16));}
    report.upscaler={...upscaler.state};
    report.functionalPassed=report.checks.every(c=>c.passed)&&report.shaderErrors.length===0&&report.glErrors.length===0;
    report.passed=report.functionalPassed&&report.budget.passed;
    report.recommendedEnable=report.passed;
    report.decision=report.passed?'Candidate meets functional and strict 1 ms median/p95 GPU budget in this check. Still inspect the actual scene.':'Keep native by default until functional issues or measured GPU budget are resolved.';
  }catch(error){report.error=String(error?.stack||error);report.recommendedEnable=false;report.decision='Keep native; this independent check did not complete successfully.';}
  finally{
    for(const query of queries)try{gl?.deleteQuery(query);}catch{}
    for(const texture of textures)try{texture.dispose();}catch{}
    try{upscaler?.dispose();}catch{}
    try{renderer?.dispose();report.cleanup.disposed=!!renderer;}catch{}
    try{renderer?.forceContextLoss();report.cleanup.contextLossRequested=!!renderer;}catch{}
  }
  return report;
}
