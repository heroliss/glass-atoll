import {waveComponents,waveCascades} from '../waves.js';
import {createWaveSpectrum} from '../spectral-waves.js';

// Synchronous readback inside an async API: no await yields allow an animation
// frame to change the active spectrum halfway through its CPU comparison.
export async function runSpectrumCheck(THREE,renderer,waveSpectrum,{sampleTexels=256,longTime=30000}={}){
  const started=performance.now();
  const report={kind:'Actual GPU Fourier spectrum / independent CPU double-precision oracle',passed:false,
    checks:[],fields:[],longTimeFields:[],shaderErrors:[],glErrors:[],preexistingGlErrors:[],
    restoration:{activeSpectrumUnchanged:false,rendererStateRestored:false,ownedResourcesDisposed:false},
    numericModel:{
      half:'One adjacent FP16 ULP covers either nearest or directed/truncating conversion. Normal spacing = 2^(floor(log2(abs(x)))-10); subnormal spacing = 2^-24.',
      moment:'deltaW + 2*abs(sx)*deltaX + deltaX^2 + 2*abs(sz)*deltaZ + deltaZ^2, plus gamma32(3) for the original dot product.',
      mip:'Ideal double-precision average of original stored base texels. A 2x2 hardware reduction may round intermediate lerps at the source FP16 precision: pair(A,B) has E=(EA+EB)/2 + gamma32(2)*average(abs(center)+E) + ULP16(upperMagnitude); apply the pair operation twice, taking the larger row-first/column-first interval. A separately authored cancellation fixture checks this model.',
      mipScope:'The black-box mip generator is not assumed to use CPU-style FP32 summation. The source-format intermediate-precision model is conservative and checked independently; fitting that bound does not identify the vendor internal arithmetic or prove that it literally uses FP16 ALUs.',
      bilinear:'Local partial derivatives times bounded weight error, including the cross term, plus at most one FP16 ULP at each of two lerp stages and FP32 arithmetic/coordinate error. Values across +/-epsilon are not required to be identical.',
      fractionalWeightBits:8,weightError:'One 8-fractional-bit ULP (1/256), rather than a fitted absolute signal tolerance; independently checked with a known ramp fixture.',
      source:'https://docs.nvidia.com/cuda/archive/12.9.1/cuda-c-programming-guide/index.html#linear-filtering',
      scope:'The NVIDIA guide documents its texture-unit 8-bit fractional weights. Applying this bound to the current WebGL driver is a hardware-path inference guarded by calibration, not a universal WebGL precision guarantee.',
      correction:'THREE r180 DataUtils.toHalfFloat shifts away mantissa bits (truncation); it is not a round-to-nearest-even oracle for GPU mip generation. No DataUtils half conversion is used in this check.',
    },
    limits:[
      'This is a 256-mode directional Fourier synthesis check, not an FFT, nonlinear wave solver, SWE validation or visual realism assessment.',
      'CPU oracle uses the original double-precision mode constants; tolerances allow half-float storage, float shader arithmetic and mip quantization.',
      'Base-level finite/sign scans cover every texel. Fourier comparisons use a deterministic subset including corners and boundary texels.',
      'The 30000-second test uses a temporary instance of the same factory on the same renderer. The active instance time, phase buffers, textures and update counter are never changed.',
      'A successful periodic/mip check does not prove the absence of all temporal aliasing, visible repetition or camera-dependent shimmer.',
      'The mip oracle checks a 2x2 box-reduction model with propagated FP16 bounds. A different legal driver reduction kernel would need its own oracle, rather than silently widening these bounds.',
      'Readback and CPU execution durations are not GPU timings or scene FPS. This check allocates temporary offscreen targets and briefly blocks the main JS thread.',
    ]};
  const check=(name,passed,details={})=>report.checks.push({name,passed:!!passed,...details});
  let gl,copyTarget,material,geometry,temporarySpectrum,filterFixture,mipFixtureTexture,mipFixtureTarget;
  const saved={};
  const errors=(stage,out=report.glErrors)=>{
    if(!gl)return;
    for(let i=0;i<32;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;out.push({stage,code:'0x'+e.toString(16)});}
  };
  const snapshot=()=>JSON.parse(JSON.stringify(waveSpectrum.state));
  const accum=()=>({count:0,squared:0,absolute:0,maximum:0,failures:0,worst:null,maximumRatio:0,worstRatio:null,firstFailure:null});
  function addError(a,actual,expected,tolerance,where){
    const error=Math.abs(actual-expected);a.count++;a.squared+=error*error;a.absolute+=error;
    if(error>a.maximum){a.maximum=error;a.worst={...where,actual,expected,tolerance};}
    const ratio=error/Math.max(tolerance,Number.MIN_VALUE);
    if(ratio>a.maximumRatio){a.maximumRatio=ratio;a.worstRatio={...where,actual,expected,tolerance,ratio};}
    if(!Number.isFinite(actual)||error>tolerance){a.failures++;a.firstFailure||={...where,actual,expected,tolerance,ratio};}
  }
  const summary=a=>({count:a.count,maximumAbsoluteError:a.maximum,rmsError:Math.sqrt(a.squared/Math.max(1,a.count)),meanAbsoluteError:a.absolute/Math.max(1,a.count),outsideTolerance:a.failures,worst:a.worst,maximumBoundRatio:a.maximumRatio,worstBoundRatio:a.worstRatio,firstFailure:a.firstFailure});
  const tolerance=(expected,channel)=>channel===3?2e-7+.006*Math.abs(expected):2.5e-6+.004*Math.abs(expected);
  // A full adjacent FP16 spacing bounds either round-to-nearest or truncation.
  // Subnormal spacing is CONSTANT 2^-24, not proportional to the small value.
  const halfSpacing=value=>Math.abs(value)<2**-14?2**-24:2**(Math.floor(Math.log2(Math.abs(value)))-10);
  const gamma32=operations=>operations*2**-24/(1-operations*2**-24);
  function boxInterval(values,bounds){
    const pair=(a,b)=>{
      const center=(a.center+b.center)*.5,inherited=(a.error+b.error)*.5;
      const arithmetic=gamma32(2)*(Math.abs(a.center)+a.error+Math.abs(b.center)+b.error)*.5;
      return{center,error:inherited+arithmetic+halfSpacing(Math.abs(center)+inherited+arithmetic)};
    };
    const p=values.map((center,i)=>({center,error:bounds[i]}));
    const row=pair(pair(p[0],p[1]),pair(p[2],p[3])),column=pair(pair(p[0],p[2]),pair(p[1],p[3]));
    return{center:values.reduce((s,v)=>s+v,0)*.25,error:Math.max(row.error,column.error)};
  }
  function halfBits(value){
    const sign=value<0?0x8000:0,magnitude=Math.min(65504,Math.abs(value));if(magnitude===0)return sign;
    const step=halfSpacing(magnitude),scaled=magnitude/step,lower=Math.floor(scaled),fraction=scaled-lower;
    const integer=lower+(fraction>.5||(fraction===.5&&(lower&1))?1:0),quantized=integer*step;
    if(quantized<2**-14)return sign|Math.round(quantized/2**-24);
    const exponent=Math.floor(Math.log2(quantized));return sign|((exponent+15)<<10)|Math.round((quantized/2**exponent-1)*1024);
  }
  function halfValue(bits){const sign=bits&0x8000?-1:1,e=(bits>>10)&31,m=bits&1023;return sign*(e===0?m*2**-24:(1+m/1024)*2**(e-15));}
  function varianceAllowance(sx,sz,moment,bounds=null){
    const dx=bounds?.[0]??halfSpacing(sx),dz=bounds?.[1]??halfSpacing(sz),dw=bounds?.[2]??halfSpacing(moment);
    return dw+2*Math.abs(sx)*dx+dx*dx+2*Math.abs(sz)*dz+dz*dz
      +(bounds?0:gamma32(3)*((Math.abs(sx)+dx)**2+(Math.abs(sz)+dz)**2));
  }
  const modeGroups=waveCascades.map((band,cascade)=>waveComponents.filter(w=>w.cascade===cascade).map(w=>({
    amplitude:w.amplitude,kx:2*Math.PI*w.modeX/band.domain,kz:2*Math.PI*w.modeZ/band.domain,
    omega:Math.sqrt((9.81*w.k+.000070244*w.k**3)*Math.tanh(Math.min(w.k*3,4))),phase:w.phase,
  })));
  function oracle(cascade,x,z,time){
    let height=0,sx=0,sz=0;
    for(const w of modeGroups[cascade]){
      // Double-precision wrapping is independent of the uploaded float phases.
      const phase=((w.phase-w.omega*time)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      const a=w.kx*x+w.kz*z+phase,c=Math.cos(a);
      height+=w.amplitude*Math.sin(a);sx+=w.amplitude*w.kx*c;sz+=w.amplitude*w.kz*c;
    }
    return[height,sx,sz,sx*sx+sz*sz];
  }
  function sampleCoordinates(n){
    const points=[],seen=new Set();
    const add=(x,y)=>{const key=y*n+x;if(!seen.has(key)){seen.add(key);points.push([x,y]);}};
    for(const x of [0,1,Math.floor(n/2),n-2,n-1])for(const y of [0,1,Math.floor(n/2),n-2,n-1])add(x,y);
    let seed=48271;const count=Math.min(n*n,Math.max(32,Math.min(2048,Math.round(sampleTexels))));
    // Use high PRNG bits: alternating low LCG bits on a power-of-two grid
    // would visit only half the columns and could stall a uniqueness loop.
    let attempts=0;
    while(points.length<count&&attempts++<count*32){seed=(Math.imul(seed,1664525)+1013904223)|0;const x=(seed>>>16)%n;seed=(Math.imul(seed,1664525)+1013904223)|0;add(x,(seed>>>16)%n);}
    for(let y=0;points.length<count&&y<n;y++)for(let x=0;points.length<count&&x<n;x++)add(x,y);
    return points;
  }
  function scan(array,physicalBounds=null){
    const minimum=[Infinity,Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity,-Infinity];
    const mean=[0,0,0,0],positive=[0,0,0,0],negative=[0,0,0,0];
    let nonFinite=0,minVariance=Infinity,maxVariance=-Infinity,varianceFailures=0,slopeEnergy=0,positiveVariance=0,worstVarianceViolation=null,largestVarianceBoundRatio=0;
    for(let i=0;i<array.length;i+=4){
      for(let c=0;c<4;c++){
        const v=array[i+c];if(!Number.isFinite(v)){nonFinite++;continue;}
        minimum[c]=Math.min(minimum[c],v);maximum[c]=Math.max(maximum[c],v);mean[c]+=v;if(v>0)positive[c]++;if(v<0)negative[c]++;
      }
      const squared=array[i+1]**2+array[i+2]**2,variance=array[i+3]-squared;
      const halfRoundAllowance=varianceAllowance(array[i+1],array[i+2],array[i+3],physicalBounds?[physicalBounds[i+1],physicalBounds[i+2],physicalBounds[i+3]]:null);
      const boundRatio=Math.max(0,-variance)/halfRoundAllowance;
      if(boundRatio>largestVarianceBoundRatio){largestVarianceBoundRatio=boundRatio;worstVarianceViolation={texelIndex:i/4,sx:array[i+1],sz:array[i+2],moment:array[i+3],rawVariance:variance,allowance:halfRoundAllowance,ratio:boundRatio};}
      if(variance < -halfRoundAllowance)varianceFailures++;
      minVariance=Math.min(minVariance,variance);maxVariance=Math.max(maxVariance,variance);
      slopeEnergy+=squared;positiveVariance+=Math.max(0,variance);
    }
    const pixels=array.length/4;
    return{pixels,nonFinite,minimum,maximum,mean:mean.map(v=>v/pixels),positive,negative,meanSlopeEnergy:slopeEnergy/pixels,
      variance:{minimumRaw:minVariance,maximumRaw:maxVariance,meanClamped:positiveVariance/pixels,negativeBeyondHalfRoundAllowance:varianceFailures,largestBoundRatio:largestVarianceBoundRatio,worstBoundRatio:worstVarianceViolation,allowance:physicalBounds?'Propagated per-channel FP16/filter intervals inserted into deltaW+2|sx|deltaX+deltaX^2+2|sz|deltaZ+deltaZ^2':'ULP16(w) + 2|sx|ULP16(sx) + ULP16(sx)^2 + 2|sz|ULP16(sz) + ULP16(sz)^2 + gamma32(3)*upperSlopeSquared; subnormal ULP16=2^-24'}};
  }
  function bilinear(array,n,u,v){
    const px=u*n-.5,py=v*n-.5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
    const wrap=x=>(x%n+n)%n,out=[],bounds=[];
    for(let c=0;c<4;c++){
      const at=(x,y)=>array[(wrap(y)*n+wrap(x))*4+c];
      const a=at(x0,y0),b=at(x0+1,y0),d=at(x0,y0+1),e=at(x0+1,y0+1);
      const top=a*(1-fx)+b*fx,bottom=d*(1-fx)+e*fx,result=top*(1-fy)+bottom*fy;
      const delta=1/256+gamma32(4)*n*Math.max(1,Math.abs(u),Math.abs(v));
      const df=Math.abs((b-a)*(1-fy)+(e-d)*fy),dg=Math.abs(bottom-top),cross=Math.abs(a-b-d+e);
      const weights=df*delta+dg*delta+cross*delta*delta;
      const first=(1-fy)*halfSpacing(Math.abs(top)+Math.abs(b-a)*delta)+fy*halfSpacing(Math.abs(bottom)+Math.abs(e-d)*delta);
      const final=halfSpacing(Math.abs(result)+weights+first);
      const floatError=gamma32(8)*Math.max(Math.abs(a),Math.abs(b),Math.abs(d),Math.abs(e));
      out.push(result);bounds.push(weights+first+final+floatError);
    }
    return{values:out,bounds};
  }
  try{
    if(!renderer?.isWebGLRenderer||!waveSpectrum?.targets?.length)throw new Error('Pass the actual WebGLRenderer and initialized waveSpectrum.');
    gl=renderer.getContext();errors('before check',report.preexistingGlErrors);
    saved.target=renderer.getRenderTarget();saved.face=renderer.getActiveCubeFace();saved.mip=renderer.getActiveMipmapLevel();
    saved.viewport=renderer.getViewport(new THREE.Vector4());saved.scissor=renderer.getScissor(new THREE.Vector4());saved.scissorTest=renderer.getScissorTest();
    saved.autoClear=renderer.autoClear;saved.xrEnabled=renderer.xr.enabled;
    saved.shadowAuto=renderer.shadowMap.autoUpdate;saved.shadowNeeds=renderer.shadowMap.needsUpdate;
    saved.infoAutoReset=renderer.info.autoReset;saved.infoRender={...renderer.info.render};
    saved.checkShaderErrors=renderer.debug.checkShaderErrors;saved.onShaderError=renderer.debug.onShaderError;
    saved.spectrum=snapshot();saved.textureUUIDs=waveSpectrum.targets.map(t=>t.texture.uuid);
    report.before={spectrum:saved.spectrum,targetUUID:saved.target?.uuid||null,cubeFace:saved.face,mipLevel:saved.mip};
    report.context={webgl2:!!renderer.capabilities.isWebGL2,version:gl.getParameter(gl.VERSION),maxVertexTextures:renderer.capabilities.maxVertexTextures};
    check('WebGL2 and an initialized finite active spectrum time',renderer.capabilities.isWebGL2&&Number.isFinite(saved.spectrum.time),{time:saved.spectrum.time});
    if(!Number.isFinite(saved.spectrum.time))throw new Error('Update the active spectrum before running its readback check.');
    const n=waveSpectrum.targets[0].width,maxLod=Math.floor(Math.log2(n));
    const dimensionsOK=waveSpectrum.targets.length===4&&waveSpectrum.targets.every(t=>t.width===n&&t.height===n&&t.texture.type===THREE.HalfFloatType)&&Number.isInteger(Math.log2(n));
    check('Four power-of-two RGBA half-float fields match the declared domains',dimensionsOK&&saved.spectrum.domainsMetres.every((d,i)=>Math.abs(d-waveCascades[i].domain)<1e-9),{resolution:n,domains:saved.spectrum.domainsMetres,modesPerCascade:modeGroups.map(g=>g.length),totalModes:waveComponents.length});
    if(!dimensionsOK)throw new Error('Expected four square power-of-two HalfFloat targets.');
    renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.info.autoReset=false;
    renderer.debug.checkShaderErrors=true;
    renderer.debug.onShaderError=(context,program,vertex,fragment)=>{
      report.shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});
      saved.onShaderError?.(context,program,vertex,fragment);
    };
    copyTarget=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});copyTarget.texture.colorSpace=THREE.NoColorSpace;
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
      uniforms:{uInput:{value:null},uLevel:{value:0},uMode:{value:0},uOriginUV:{value:new THREE.Vector2()},uScaleUV:{value:new THREE.Vector2(1,1)}},
      vertexShader:'precision highp float;in vec3 position;out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
      fragmentShader:'precision highp float;precision highp int;uniform highp sampler2D uInput;uniform int uLevel,uMode;uniform vec2 uOriginUV,uScaleUV;in vec2 vUv;out vec4 fragColor;void main(){if(uMode==0)fragColor=texelFetch(uInput,ivec2(gl_FragCoord.xy),uLevel);else fragColor=textureLod(uInput,uOriginUV+vUv*uScaleUV,float(uLevel));}'});
    const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
    function read(texture,width,height,level=0,mode=0,origin=[0,0],scale=[1,1]){
      copyTarget.setSize(width,height);material.uniforms.uInput.value=texture;material.uniforms.uLevel.value=level;material.uniforms.uMode.value=mode;
      material.uniforms.uOriginUV.value.fromArray(origin);material.uniforms.uScaleUV.value.fromArray(scale);
      renderer.setRenderTarget(copyTarget);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.render(scene,camera);
      const data=new Float32Array(width*height*4);renderer.readRenderTargetPixels(copyTarget,0,0,width,height,data);return data;
    }
    // Independent known 2x2 ramp: R=fractionX, G=fractionY. Its inputs are
    // exactly representable half floats, with no Fourier or mip oracle involved.
    filterFixture=new THREE.DataTexture(new Uint16Array([0,0,0,0,0x3c00,0,0,0,0,0x3c00,0,0,0x3c00,0x3c00,0,0]),2,2,THREE.RGBAFormat,THREE.HalfFloatType);
    filterFixture.minFilter=filterFixture.magFilter=THREE.LinearFilter;filterFixture.generateMipmaps=false;filterFixture.colorSpace=THREE.NoColorSpace;filterFixture.needsUpdate=true;
    const calibration=read(filterFixture,257,37,0,1,[.25,.25],[.5,.5]);let filterMaximumError=0,filterBoundRatio=0,filterFailures=0;
    for(let y=0;y<37;y++)for(let x=0;x<257;x++)for(let c=0;c<2;c++){
      const expected=c===0?(x+.5)/257:(y+.5)/37,actual=calibration[(y*257+x)*4+c];
      const bound=1/256+halfSpacing(expected)+gamma32(8),error=Math.abs(actual-expected);
      filterMaximumError=Math.max(filterMaximumError,error);filterBoundRatio=Math.max(filterBoundRatio,error/bound);
      if(!Number.isFinite(actual)||error>bound)filterFailures++;
    }
    report.filterCalibration={dimensions:[257,37],scalarComparisons:257*37*2,maximumAbsoluteError:filterMaximumError,maximumBoundRatio:filterBoundRatio,outsideBound:filterFailures,model:'8 fractional weight bits, one FP16 ULP output conversion and FP32 arithmetic'};
    check('Independent 2x2 ramp calibrates the hardware bilinear precision bound',filterFailures===0,report.filterCalibration);
    // Independent source texture, not values copied from the failing spectrum.
    // Three positive/negative half inputs and a fourth cancelling input create
    // near-zero outputs across four scales and many unrelated mantissas.
    const fixtureSize=64,fixtureHalf=new Uint16Array(fixtureSize*fixtureSize*4),fixtureValues=new Float32Array(fixtureHalf.length);
    let fixtureSeed=987631;const fixtureRandom=()=>{fixtureSeed=(Math.imul(fixtureSeed,1664525)+1013904223)|0;return(fixtureSeed>>>0)/4294967296;};
    for(let y=0;y<fixtureSize;y+=2)for(let x=0;x<fixtureSize;x+=2)for(let c=0;c<4;c++){
      const a=.03+.07*fixtureRandom(),b=-.01-.09*fixtureRandom(),d=(fixtureRandom()-.5)*.04;
      const values=[a,b,d,-a-b-d+(fixtureRandom()-.5)*.0002],scale=10**-c;
      const at=[(y*fixtureSize+x)*4+c,(y*fixtureSize+x+1)*4+c,((y+1)*fixtureSize+x)*4+c,((y+1)*fixtureSize+x+1)*4+c];
      for(let k=0;k<4;k++){fixtureHalf[at[k]]=halfBits(values[k]*scale);fixtureValues[at[k]]=halfValue(fixtureHalf[at[k]]);}
    }
    mipFixtureTexture=new THREE.DataTexture(fixtureHalf,fixtureSize,fixtureSize,THREE.RGBAFormat,THREE.HalfFloatType);
    mipFixtureTexture.minFilter=mipFixtureTexture.magFilter=THREE.NearestFilter;mipFixtureTexture.generateMipmaps=false;mipFixtureTexture.colorSpace=THREE.NoColorSpace;mipFixtureTexture.needsUpdate=true;
    mipFixtureTarget=new THREE.WebGLRenderTarget(fixtureSize,fixtureSize,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});mipFixtureTarget.texture.colorSpace=THREE.NoColorSpace;
    material.uniforms.uInput.value=mipFixtureTexture;material.uniforms.uMode.value=0;material.uniforms.uLevel.value=0;
    renderer.setRenderTarget(mipFixtureTarget);renderer.setViewport(0,0,fixtureSize,fixtureSize);renderer.setScissorTest(false);renderer.render(scene,camera);
    const fixtureBase=new Float32Array(fixtureValues.length);gl.readPixels(0,0,fixtureSize,fixtureSize,gl.RGBA,gl.FLOAT,fixtureBase);
    let fixtureSourceError=0;for(let i=0;i<fixtureBase.length;i++)fixtureSourceError=Math.max(fixtureSourceError,Math.abs(fixtureBase[i]-fixtureValues[i]));
    check('Authored cancellation fixture arrives in FP16 without source changes',fixtureSourceError===0,{maximumError:fixtureSourceError});
    renderer.setRenderTarget(mipFixtureTarget,0,1);const fixtureMip=new Float32Array(fixtureSize*fixtureSize);gl.readPixels(0,0,fixtureSize/2,fixtureSize/2,gl.RGBA,gl.FLOAT,fixtureMip);
    let oldFailures=0,newFailures=0,oldMaximumRatio=0,newMaximumRatio=0;const cancellationExamples=[];
    for(let y=0;y<fixtureSize/2;y++)for(let x=0;x<fixtureSize/2;x++)for(let c=0;c<4;c++){
      const a=(y*2*fixtureSize+x*2)*4+c,parents=[fixtureValues[a],fixtureValues[a+4],fixtureValues[a+fixtureSize*4],fixtureValues[a+fixtureSize*4+4]],reference=boxInterval(parents,[0,0,0,0]);
      const actual=fixtureMip[(y*(fixtureSize/2)+x)*4+c],error=Math.abs(actual-reference.center),arithmetic=gamma32(4)*parents.reduce((s,v)=>s+Math.abs(v),0)*.25;
      const fp32OnlyBound=arithmetic+halfSpacing(Math.abs(reference.center)+arithmetic);
      oldMaximumRatio=Math.max(oldMaximumRatio,error/fp32OnlyBound);newMaximumRatio=Math.max(newMaximumRatio,error/reference.error);
      if(error>fp32OnlyBound){oldFailures++;if(cancellationExamples.length<8)cancellationExamples.push({parents,ideal:reference.center,actual,error,fp32OnlyBound,fp16LerpBound:reference.error});}
      if(!Number.isFinite(actual)||error>reference.error)newFailures++;
    }
    report.mipCancellationCalibration={dimensions:[fixtureSize,fixtureSize],scalarComparisons:fixtureMip.length,fp32OnlyBoundFailures:oldFailures,fp32OnlyMaximumRatio:oldMaximumRatio,fp32OnlyModelRejectedByFixture:oldFailures>0,fp16LerpBoundFailures:newFailures,fp16LerpMaximumRatio:newMaximumRatio,examples:cancellationExamples,note:'Independent exact-half inputs; does not tune a constant to any spectrum phase. Rejecting the FP32-only model does not identify the driver internal arithmetic.'};
    check('Independent mip cancellation fixture fits the FP16 intermediate-lerp interval',newFailures===0,report.mipCancellationCalibration);
    const points=sampleCoordinates(n),baseFields=[];
    function compareFourier(targets,time,label){
      const fields=[];
      for(let cascade=0;cascade<4;cascade++){
        const copied=read(targets[cascade].texture,n,n);
        // Independent native FLOAT readback bypasses sampler precision entirely.
        renderer.setRenderTarget(targets[cascade]);const data=new Float32Array(n*n*4);gl.readPixels(0,0,n,n,gl.RGBA,gl.FLOAT,data);
        let copiedMaximumError=0;for(let i=0;i<data.length;i++)copiedMaximumError=Math.max(copiedMaximumError,Math.abs(copied[i]-data[i]));
        check(`${label}: cascade ${cascade} highp sampler copy equals native FLOAT readback`,copiedMaximumError===0,{maximumError:copiedMaximumError});
        const stats=scan(data),metrics=Array.from({length:4},accum),domain=waveCascades[cascade].domain;
        for(const [x,y]of points){
          const reference=oracle(cascade,(x+.5)/n*domain,(y+.5)/n*domain,time),i=(y*n+x)*4;
          for(let c=0;c<4;c++)addError(metrics[c],data[i+c],reference[c],tolerance(reference[c],c),{texel:[x,y],channel:c});
        }
        const metric=metrics.map(summary),signed=stats.positive.slice(0,3).every(v=>v>0)&&stats.negative.slice(0,3).every(v=>v>0);
        check(`${label}: cascade ${cascade} finite signed height/slopes and nonnegative moment`,stats.nonFinite===0&&signed&&stats.minimum[3]>=0&&stats.variance.negativeBeyondHalfRoundAllowance===0,{cascade,nonFinite:stats.nonFinite,minimum:stats.minimum,maximum:stats.maximum,variance:stats.variance});
        check(`${label}: cascade ${cascade} CPU Fourier at matching texel centres`,metric.every(m=>m.outsideTolerance===0),{cascade,time,comparedTexels:points.length,channels:metric});
        fields.push({cascade,domainMetres:domain,time,scan:stats,cpuComparison:metric});
        if(label==='active')baseFields.push(data);
      }
      return fields;
    }
    report.fields=compareFourier(waveSpectrum.targets,saved.spectrum.time,'active');errors('active field readback');
    const levels=[...new Set([1,3,6,maxLod].filter(l=>l<=maxLod))];
    for(let cascade=0;cascade<4;cascade++){
      const target=waveSpectrum.targets[cascade],base=baseFields[cascade];let expected=base,size=n;
      let comparisonBounds=new Float64Array(base.length),physicalInputBounds=new Float64Array(base.length);
      for(let i=0;i<base.length;i+=4){
        for(let c=0;c<4;c++)physicalInputBounds[i+c]=halfSpacing(base[i+c]);
        physicalInputBounds[i+3]+=gamma32(3)*((Math.abs(base[i+1])+halfSpacing(base[i+1]))**2+(Math.abs(base[i+2])+halfSpacing(base[i+2]))**2);
      }
      const mips=[];
      for(let level=1;level<=maxLod;level++){
        const nextSize=size/2,next=new Float64Array(nextSize*nextSize*4),nextBounds=new Float64Array(next.length),nextPhysicalInputs=new Float64Array(next.length);
        for(let y=0;y<nextSize;y++)for(let x=0;x<nextSize;x++)for(let c=0;c<4;c++){
          const a=((2*y)*size+2*x)*4+c,j=(y*nextSize+x)*4+c,children=[a,a+4,a+size*4,a+size*4+4];
          const reduced=boxInterval(children.map(k=>expected[k]),children.map(k=>comparisonBounds[k]));
          next[j]=reduced.center;nextBounds[j]=reduced.error;nextPhysicalInputs[j]=children.reduce((s,k)=>s+physicalInputBounds[k],0)*.25;
        }
        expected=next;comparisonBounds=nextBounds;physicalInputBounds=nextPhysicalInputs;size=nextSize;if(!levels.includes(level))continue;
        // Use textureLod at the true mip texel centres, rather than assuming
        // generateMipmaps or the minFilter option means mips really exist.
        const sampled=read(target.texture,size,size,level,1);
        // Attach the existing mip to the renderer's scratch framebuffer and
        // read it natively. No draw, clear or mip regeneration is performed.
        renderer.setRenderTarget(target,0,level);const actual=new Float32Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,actual);
        let mipSampleError=0;for(let i=0;i<actual.length;i++)mipSampleError=Math.max(mipSampleError,Math.abs(actual[i]-sampled[i]));
        check(`cascade ${cascade}: textureLod ${level} at texel centres equals native mip readback`,mipSampleError===0,{maximumError:mipSampleError});
        const physicalBounds=Float64Array.from(comparisonBounds,(bound,i)=>bound+physicalInputBounds[i]),stats=scan(actual,physicalBounds),metrics=Array.from({length:4},accum);
        for(let i=0;i<actual.length;i++)addError(metrics[i%4],actual[i],expected[i],comparisonBounds[i],{texelIndex:Math.floor(i/4),channel:i%4});
        const comparison=metrics.map(summary),passed=stats.nonFinite===0&&stats.variance.negativeBeyondHalfRoundAllowance===0&&comparison.every(m=>m.outsideTolerance===0);
        const cancellationDiagnostics=level===1?comparison.flatMap((metric,c)=>{
          if(!metric.firstFailure)return[];
          const indices=[...new Set([metric.firstFailure.texelIndex,metric.worstBoundRatio.texelIndex])];
          return indices.map(index=>{
            const x=index%size,y=Math.floor(index/size),a=((2*y)*n+2*x)*4+c;
            const parents=[base[a],base[a+4],base[a+n*4],base[a+n*4+4]],ideal=parents.reduce((s,v)=>s+v,0)/4;
            const flushParents=parents.map(v=>Math.abs(v)<2**-14?0:v),flushAverage=flushParents.reduce((s,v)=>s+v,0)/4;
            return{channel:c,texel:[x,y],parents,subnormalParents:parents.map(v=>Math.abs(v)>0&&Math.abs(v)<2**-14),idealAverage:ideal,averageIfSubnormalInputsFlush:flushAverage,native:actual[index*4+c],sampled:sampled[index*4+c],nativeMinusIdeal:actual[index*4+c]-ideal,nativeMinusFlushAverage:actual[index*4+c]-flushAverage};
          });
        }):[];
        check(`cascade ${cascade}: actual textureLod ${level} is averaged with valid slope variance`,passed,{cascade,level,dimensions:[size,size],scan:stats,channels:comparison});
        mips.push({level,dimensions:[size,size],scan:stats,cpuComparison:comparison,cancellationDiagnostics});
      }
      const coarse=mips.at(-1)?.scan,baseStats=report.fields[cascade].scan;
      check(`cascade ${cascade}: coarse mip removes resolved gradients but retains slope energy`,coarse&&coarse.meanSlopeEnergy<baseStats.meanSlopeEnergy*.2&&coarse.mean[3]>baseStats.mean[3]*.5&&coarse.mean[3]<baseStats.mean[3]*1.5,{baseMeanGradientSquared:baseStats.meanSlopeEnergy,coarseMeanGradientSquared:coarse?.meanSlopeEnergy,baseMeanSlopeSquared:baseStats.mean[3],coarseMeanSlopeSquared:coarse?.mean[3]});
      report.fields[cascade].mips=mips;
      const ordinary=read(target.texture,16,16,0,1),shiftX=read(target.texture,16,16,0,1,[1,0]),shiftZ=read(target.texture,16,16,0,1,[0,1]);
      let periodicError=0;for(let i=0;i<ordinary.length;i++)periodicError=Math.max(periodicError,Math.abs(ordinary[i]-shiftX[i]),Math.abs(ordinary[i]-shiftZ[i]));
      // Binary-exact 1/128-texel offsets on each side avoid mistaking allowed
      // fixed-point bilinear interpolation precision for a wrapping defect.
      const eps=1/(n*64),seamMetrics=Array.from({length:4},accum);let maximumAcrossSeam=0;
      for(const axis of [0,1]){
        const width=axis===0?2:32,height=axis===0?32:2,origin=axis===0?[-eps,0]:[0,-eps],scale=axis===0?[eps*2,1]:[1,eps*2];
        const actual=read(target.texture,width,height,0,1,origin,scale);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const uv=[origin[0]+(x+.5)/width*scale[0],origin[1]+(y+.5)/height*scale[1]],reference=bilinear(base,n,...uv),i=(y*width+x)*4;
          for(let c=0;c<4;c++)addError(seamMetrics[c],actual[i+c],reference.values[c],reference.bounds[c],{axis,texel:[x,y],channel:c});
          if(axis===0&&x===1)for(let c=0;c<4;c++)maximumAcrossSeam=Math.max(maximumAcrossSeam,Math.abs(actual[i+c]-actual[i-4+c]));
          if(axis===1&&y===1)for(let c=0;c<4;c++)maximumAcrossSeam=Math.max(maximumAcrossSeam,Math.abs(actual[i+c]-actual[i-width*4+c]));
        }
      }
      const seamComparison=seamMetrics.map(summary);
      check(`cascade ${cascade}: ${waveCascades[cascade].domain} m period repeats continuously across both axes`,periodicError<=3e-6&&seamComparison.every(m=>m.outsideTolerance===0),{periodicMaximumError:periodicError,seamEpsilonInUV:eps,maximumAcrossSeam,seamBilinearCPUComparison:seamComparison});
      report.fields[cascade].periodicity={periodicMaximumError:periodicError,seamEpsilonInUV:eps,maximumAcrossSeam,comparison:seamComparison};
    }
    errors('mip and periodicity probes');
    temporarySpectrum=createWaveSpectrum(THREE,renderer,{resolution:n});temporarySpectrum.update(longTime,true);
    report.longTime={seconds:longTime,state:temporarySpectrum.state,activeInstanceMutated:false};
    report.longTimeFields=compareFourier(temporarySpectrum.targets,longTime,'long-time wrapped phases');errors('30000-second fixture');
  }catch(error){report.error=String(error?.stack||error);}
  finally{
    try{temporarySpectrum?.dispose();material?.dispose();geometry?.dispose();copyTarget?.dispose();filterFixture?.dispose();mipFixtureTexture?.dispose();mipFixtureTarget?.dispose();report.restoration.ownedResourcesDisposed=true;}catch(error){report.restoration.disposeError=String(error);}
    if(saved.spectrum){
      const after=snapshot();report.after={spectrum:after};
      report.restoration.activeSpectrumUnchanged=JSON.stringify(after)===JSON.stringify(saved.spectrum)&&waveSpectrum.targets.every((t,i)=>t.texture.uuid===saved.textureUUIDs[i]);
      check('Active spectrum time/state/targets remain exactly unchanged',report.restoration.activeSpectrumUnchanged,{beforeTime:saved.spectrum.time,afterTime:after.time,beforeUpdates:saved.spectrum.updates,afterUpdates:after.updates});
    }
    if(saved.viewport)try{
      renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
      renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xrEnabled;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
      renderer.info.autoReset=saved.infoAutoReset;Object.assign(renderer.info.render,saved.infoRender);
      renderer.debug.checkShaderErrors=saved.checkShaderErrors;renderer.debug.onShaderError=saved.onShaderError;
      const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
      report.restoration.rendererStateRestored=renderer.getRenderTarget()===saved.target&&renderer.getActiveCubeFace()===saved.face&&renderer.getActiveMipmapLevel()===saved.mip&&viewport.equals(saved.viewport)&&scissor.equals(saved.scissor)&&renderer.getScissorTest()===saved.scissorTest;
      check('Restore renderer target/cube face/mip/viewport/scissor',report.restoration.rendererStateRestored,{targetUUID:renderer.getRenderTarget()?.uuid||null,cubeFace:renderer.getActiveCubeFace(),mipLevel:renderer.getActiveMipmapLevel()});
    }catch(error){report.restoration.error=String(error);}
    errors('after restoration');
    report.elapsedCpuWallMilliseconds=performance.now()-started;
    report.passed=!report.error&&report.checks.length>0&&report.checks.every(c=>c.passed)&&report.shaderErrors.length===0&&report.glErrors.length===0&&report.restoration.ownedResourcesDisposed&&report.restoration.activeSpectrumUnchanged&&report.restoration.rendererStateRestored;
  }
  return report;
}
