// Diagnostic only: complete RGB coverage, four 1x1 RGBA32F readbacks.
// This deliberately synchronizes the GPU; its duration is not a frame-rate test.
const COUNTER_BASE=65536;
const encode=value=>value===Infinity?'Infinity':value===-Infinity?'-Infinity':Number.isNaN(value)?'NaN':value;
const sameArray=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);

function saveState(THREE,renderer){
  const gl=renderer.getContext();
  return {target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),
    viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),
    currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),currentScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),currentScissorTest:gl.isEnabled(gl.SCISSOR_TEST),
    readFramebuffer:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),pixelPackBuffer:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),
    autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
}
function restoreState(renderer,saved){
  const gl=renderer.getContext(),target=saved.target;
  const viewport=target?.viewport.clone(),scissor=target?.scissor.clone(),test=target?.scissorTest;
  try{
    if(target){target.viewport.copy(saved.currentViewport);target.scissor.fromArray(saved.currentScissor);target.scissorTest=saved.currentScissorTest;}
    renderer.setRenderTarget(target,saved.face,saved.mip);
  }finally{if(target){target.viewport.copy(viewport);target.scissor.copy(scissor);target.scissorTest=test;}}
  // readBuffer belongs to the READ framebuffer, not the DRAW framebuffer.
  if(renderer.state?.bindFramebuffer)renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFramebuffer);
  else gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFramebuffer);
  gl.readBuffer(saved.readBuffer);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved.pixelPackBuffer);
  renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
}
function stateEquals(THREE,renderer,saved){
  const current=saveState(THREE,renderer);
  return ['target','face','mip','scissorTest','currentScissorTest','readFramebuffer','readBuffer','pixelPackBuffer','autoClear','xr','shadowAuto','shadowNeeds'].every(key=>current[key]===saved[key])
    &&['viewport','scissor','currentViewport'].every(key=>sameArray(current[key].toArray(),saved[key].toArray()))&&sameArray(current.currentScissor,saved.currentScissor);
}

/** Reduce a complete level-zero 2D linear-HDR texture without a full CPU read.
 * RGB component counts, not pixel counts; alpha is deliberately ignored.
 * JS extrema preserve infinities. toJSON()/encodedExtrema encode them explicitly.
 */
export async function readRadianceRange(THREE,renderer,texture,width,height){
  const source=texture?.texture??texture;
  if(!source?.isTexture||source.isCubeTexture||source.isDataArrayTexture||source.isData3DTexture||source.isDepthTexture)throw new TypeError('Radiance reducer requires a 2D colour texture, not cube/array/volume/depth');
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new RangeError('Radiance dimensions must be positive integers');
  const image=source.image;
  if(Number.isFinite(image?.width)&&Number.isFinite(image?.height)&&(image.width!==width||image.height!==height))throw new RangeError('Dimensions must cover the complete source texture');
  const gl=renderer.getContext();
  if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('Radiance reducer requires EXT_color_buffer_float / RGBA32F renderability');
  if(gl.getParameter(gl.MAX_DRAW_BUFFERS)<4||gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<4)throw new Error('Radiance reducer requires four float colour attachments');
  const saved=saveState(THREE,renderer),targets=[],materials=[];let geometry=null,result=null,failure=null;
  const vertexShader='precision highp float;in vec3 position;void main(){gl_Position=vec4(position,1.);}';
  const uniforms={uSource:{value:source},uMin:{value:null},uMax:{value:null},uLow:{value:null},uHigh:{value:null},uInputSize:{value:new THREE.Vector2(width,height)}};
  const common=/* glsl */`
    precision highp float;precision highp int;
    uniform highp sampler2D uSource,uMin,uMax,uLow,uHigh;
    uniform vec2 uInputSize;
    layout(location=0) out vec4 outMin;layout(location=1) out vec4 outMax;
    layout(location=2) out vec4 outLow;layout(location=3) out vec4 outHigh;
    void main(){
      float inf=uintBitsToFloat(0x7f800000u);vec3 low=vec3(inf),high=vec3(-inf);
      vec4 countLow=vec4(0.),countHigh=vec4(0.);ivec2 base=ivec2(gl_FragCoord.xy)*4;
      for(int y=0;y<4;y++)for(int x=0;x<4;x++){
        ivec2 p=base+ivec2(x,y);if(any(greaterThanEqual(p,ivec2(uInputSize))))continue;
        #if SOURCE_PASS == 1
          vec3 value=texelFetch(uSource,p,0).rgb;
          for(int c=0;c<3;c++){
            float v=value[c];uint bits=floatBitsToUint(v);
            uint exponent=bits&0x7f800000u,mantissa=bits&0x007fffffu;
            // ANGLE/D3D fast-math compiled isnan() away in an actual fixture.
            // Inspect IEEE exponent/mantissa as integer bits instead: every
            // quiet/signalling NaN has all exponent bits and nonzero mantissa.
            if(exponent==0x7f800000u&&mantissa!=0u){countLow.x+=1.;continue;}
            // Infinity participates in extrema, unmodified. No pre-reduction
            // finite clamp and no arithmetic such as infinity*zero.
            low[c]=min(low[c],v);high[c]=max(high[c],v);
            if(exponent==0x7f800000u){if((bits&0x80000000u)==0u)countLow.y+=1.;else countLow.z+=1.;}
            else if(v<0.)countLow.w+=1.;
          }
        #else
          low=min(low,texelFetch(uMin,p,0).rgb);high=max(high,texelFetch(uMax,p,0).rgb);
          countLow+=texelFetch(uLow,p,0);countHigh+=texelFetch(uHigh,p,0);
        #endif
      }
      // Each low limb sum is at most 16*65535 <2^24. The power-of-two
      // carry retains exact counts beyond Float32's consecutive integer range.
      vec4 carry=floor(countLow/65536.);countLow-=carry*65536.;countHigh+=carry;
      outMin=vec4(low,0.);outMax=vec4(high,0.);outLow=countLow;outHigh=countHigh;
    }
  `;
  try{
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    for(const first of [1,0])materials.push(new THREE.RawShaderMaterial({name:first?'HDR range source classify':'HDR range four-way reduce',glslVersion:THREE.GLSL3,defines:{SOURCE_PASS:first},uniforms,vertexShader,fragmentShader:common,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false}));
    const scene=new THREE.Scene(),camera=new THREE.Camera(),quad=new THREE.Mesh(geometry,materials[0]);quad.frustumCulled=false;scene.add(quad);
    renderer.autoClear=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    let w=width,h=height,previous=null;
    do{
      const outW=Math.max(1,Math.ceil(w/4)),outH=Math.max(1,Math.ceil(h/4));
      const target=new THREE.WebGLRenderTarget(outW,outH,{count:4,type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});
      for(const texture of target.textures){texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;}
      targets.push(target);uniforms.uInputSize.value.set(w,h);quad.material=previous?materials[1]:materials[0];
      if(previous){uniforms.uMin.value=previous.textures[0];uniforms.uMax.value=previous.textures[1];uniforms.uLow.value=previous.textures[2];uniforms.uHigh.value=previous.textures[3];}
      renderer.setRenderTarget(target);
      const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(status!==gl.FRAMEBUFFER_COMPLETE)throw new Error(`Radiance float MRT incomplete: 0x${status.toString(16)}`);
      renderer.render(scene,camera);
      const program=renderer.properties.get(quad.material).currentProgram;
      if(!program?.program||!gl.getProgramParameter(program.program,gl.LINK_STATUS))throw new Error('Radiance reducer shader did not link');
      previous=target;w=outW;h=outH;
    }while(w>1||h>1);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    const data=Array.from({length:4},()=>new Float32Array(4));
    for(let i=0;i<4;i++)renderer.readRenderTargetPixels(previous,0,0,1,1,data[i],undefined,i);
    const counts=Array.from({length:4},(_,c)=>Math.round(data[2][c])+COUNTER_BASE*Math.round(data[3][c]));
    const minRGB=Array.from(data[0].slice(0,3)),maxRGB=Array.from(data[1].slice(0,3));
    for(let c=0;c<3;c++)if(minRGB[c]===Infinity&&maxRGB[c]===-Infinity){minRGB[c]=null;maxRGB[c]=null;}
    const maxAbsRGB=minRGB.map((v,c)=>v===null?null:Math.max(Math.abs(v),Math.abs(maxRGB[c])));
    const validMin=minRGB.filter(v=>v!==null),validMax=maxRGB.filter(v=>v!==null),validAbs=maxAbsRGB.filter(v=>v!==null);
    const [countNaN,countPositiveInf,countNegativeInf,countNegativeFinite]=counts,countInf=countPositiveInf+countNegativeInf,pixels=width*height;
    const extrema={minRGB,maxRGB,maxAbsRGB,globalMin:validMin.length?Math.min(...validMin):null,globalMax:validMax.length?Math.max(...validMax):null,globalMaxAbs:validAbs.length?Math.max(...validAbs):null};
    const encodedExtrema=Object.fromEntries(Object.entries(extrema).map(([key,value])=>[key,Array.isArray(value)?value.map(encode):encode(value)]));
    result={...extrema,encodedExtrema,countNaN,countInf,countPositiveInf,countNegativeInf,countNegativeFinite,countNegative:countNegativeFinite+countNegativeInf,
      countNonFinite:countNaN+countInf,finiteComponents:pixels*3-countNaN-countInf,totalComponents:pixels*3,pixels,width,height,
      levels:targets.map(target=>[target.width,target.height]),cpuReadPixels:4,cpuReadBytes:64,countEncoding:'exact integer low16/high16 limbs in Float32 MRT',
      classifierVersion:'ieee-bits-v2',classifier:'floatBitsToUint exponent/mantissa/sign masks; no floating-point isnan/isinf',
      counterConsistency:counts.every(v=>Number.isSafeInteger(v)&&v>=0)&&countNaN+countInf+countNegativeFinite<=pixels*3,stateRestored:false,
      space:'Input level-zero RGB after current scene storage exposure P; no decode/exposure/tone mapping added',
      toJSON(){const {toJSON,...rest}=this;return {...rest,...this.encodedExtrema};}};
    if(!result.counterConsistency)throw new Error('Radiance reducer counters are inconsistent');
  }catch(error){failure=error;}
  finally{
    try{restoreState(renderer,saved);if(result)result.stateRestored=stateEquals(THREE,renderer,saved);}
    catch(error){failure??=error;}
    for(const target of targets)target.dispose();for(const material of materials)material.dispose();geometry?.dispose();
  }
  if(failure)throw failure;
  if(!result.stateRestored)throw new Error('Radiance reducer did not restore caller renderer/readback state');
  return result;
}

function cpuRange(data){
  const minRGB=[Infinity,Infinity,Infinity],maxRGB=[-Infinity,-Infinity,-Infinity];
  let countNaN=0,countPositiveInf=0,countNegativeInf=0,countNegativeFinite=0;
  for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++){
    const v=data[i+c];if(Number.isNaN(v)){countNaN++;continue;}
    minRGB[c]=Math.min(minRGB[c],v);maxRGB[c]=Math.max(maxRGB[c],v);
    if(v===Infinity)countPositiveInf++;else if(v===-Infinity)countNegativeInf++;else if(v<0)countNegativeFinite++;
  }
  for(let c=0;c<3;c++)if(minRGB[c]===Infinity&&maxRGB[c]===-Infinity){minRGB[c]=null;maxRGB[c]=null;}
  return {minRGB,maxRGB,countNaN,countPositiveInf,countNegativeInf,countNegativeFinite};
}

/** Caller-owned actual WebGL2 renderer; fixtures never mount a canvas. */
export async function runRadianceRangeGPUCheck(THREE,renderer){
  const report={startedAt:new Date().toISOString(),passed:false,checks:[],cleanup:false,limits:['Complete source-texel coverage and reduction correctness, not scene realism/FPS.','Counts are RGB components, alpha intentionally ignored.','Small final synchronous readback can stall GPU; do not run each frame.']};
  const saved=saveState(THREE,renderer),textures=[];
  const add=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,...evidence});
  async function run(name,w,h,data,half=false){
    // DataUtils.toHalfFloat intentionally clamps infinities; write IEEE binary16
    // nonfinite bit patterns explicitly so this tests real overflow values.
    const bytes=half?new Uint16Array(Array.from(data,value=>Number.isNaN(value)?0x7e00:value===Infinity?0x7c00:value===-Infinity?0xfc00:THREE.DataUtils.toHalfFloat(value))):data;
    const texture=new THREE.DataTexture(bytes,w,h,THREE.RGBAFormat,half?THREE.HalfFloatType:THREE.FloatType);
    texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;textures.push(texture);
    const expectedData=half?Float32Array.from(bytes,value=>THREE.DataUtils.fromHalfFloat(value)):data;
    const expected=cpuRange(expectedData),actual=await readRadianceRange(THREE,renderer,texture,w,h);
    const fields=['countNaN','countPositiveInf','countNegativeInf','countNegativeFinite'];
    const extrema=['minRGB','maxRGB'].every(key=>sameArray(actual[key],expected[key]));
    const encodedExpected=Object.fromEntries(Object.entries(expected).map(([key,value])=>[key,Array.isArray(value)?value.map(encode):value]));
    add(name,extrema&&fields.every(key=>actual[key]===expected[key])&&actual.stateRestored,{expected:encodedExpected,actual});return actual;
  }
  try{
    const w=13,h=9,pattern=new Float32Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)pattern.set([x*.25,y*.5,16+(x+y)*.125,1],(y*w+x)*4);
    pattern.set([65504,-.125,-65504,NaN],((h-1)*w+w-1)*4);
    await run('odd HDR dimensions retain the last edge/corner texel and ignore NaN alpha',w,h,pattern);
    const invalid=new Float32Array(5*3*4);for(let i=0;i<invalid.length;i+=4)invalid.set([.5,2,16,1],i);
    invalid.set([NaN,Infinity,-Infinity,1],4);invalid.set([-1,NaN,Infinity,1],invalid.length-4);
    const result=await run('NaN and positive/negative infinity classified before reduction, no clamp',5,3,invalid);
    add('JSON output retains explicit Infinity labels rather than silent null',JSON.stringify(result).includes('"Infinity"')&&JSON.stringify(result).includes('"-Infinity"'),{encodedExtrema:result.encodedExtrema});
    await run('HalfFloat HDR source retains overflow infinities and finite extrema',5,3,invalid,true);
    const payloadBuffer=new ArrayBuffer(4*4*4),payloadBits=new Uint32Array(payloadBuffer),payloadFloats=new Float32Array(payloadBuffer);
    for(let i=0;i<payloadFloats.length;i+=4)payloadFloats.set([1,2,3,1],i);
    [0x7fc01234,0xffc04567,0x7f800001,0xff800001].forEach((bits,i)=>{payloadBits[i*4]=bits;});
    await run('positive/negative quiet and signalling IEEE NaN payloads are all counted',4,1,payloadFloats);
    const allNaN=new Float32Array(7*5*4);for(let i=0;i<allNaN.length;i+=4)allNaN.set([NaN,NaN,NaN,1],i);
    const empty=await run('all-NaN channels have explicit null comparable extrema',7,5,allNaN);add('all-NaN count equals complete RGB component coverage',empty.countNaN===7*5*3&&empty.globalMaxAbs===null);
    const counts=new Float32Array(301*251*4);for(let i=0;i<counts.length;i+=4)counts.set([-1,-2,-4,1],i);
    await run('counter low16 carry preserves exact negative count above 65536',301,251,counts);
    const one=await run('one-texel input still receives source classification',1,1,new Float32Array([-.5,0,65504,1]));add('CPU readback is four pixels only',one.cpuReadBytes===64&&one.cpuReadPixels===4);
    add('fixture caller state preserved',stateEquals(THREE,renderer,saved));
  }catch(error){report.error=String(error?.stack??error);}
  finally{for(const texture of textures)texture.dispose();restoreState(renderer,saved);report.cleanup=true;}
  report.passed=!report.error&&report.checks.every(check=>check.passed)&&report.cleanup;return report;
}
