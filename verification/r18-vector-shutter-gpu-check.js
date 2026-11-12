// ROOT ONLY: one existing renderer under its exclusive QA lock. This module
// never creates a WebGL context, resizes a canvas, or advances a live show.
const size=32,raw=1e-4,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const copy=v=>JSON.parse(JSON.stringify(v));
const f32=v=>Math.fround(v),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

// Independent erf evaluation by32-point Gauss-Legendre integration. It does
// not copy the production shader's five-coefficient erf approximation.
const quadrature=(()=>{
 const n=32,x=new Float64Array(n),w=new Float64Array(n);
 for(let i=0;i<n/2;i++){
  let z=Math.cos(Math.PI*(i+.75)/(n+.5)),derivative=0;
  for(let j=0;j<16;j++){let p=1,q=0;for(let k=1;k<=n;k++){const r=q;q=p;p=((2*k-1)*z*q-(k-1)*r)/k;}derivative=n*(z*p-q)/(z*z-1);const next=z-p/derivative;if(Math.abs(next-z)<2e-16){z=next;break;}z=next;}
  x[i]=-z;x[n-1-i]=z;w[i]=w[n-1-i]=2/((1-z*z)*derivative*derivative);
 }
 return{x,w};
})();
export function vectorShutterOracleErf(value){
 if(!Number.isFinite(value))return Math.sign(value);if(value===0)return 0;
 const a=Math.abs(value);if(a>=8)return Math.sign(value);
 let sum=0;for(let i=0;i<32;i++){const t=a*.5*(quadrature.x[i]+1);sum+=quadrature.w[i]*Math.exp(-t*t);}
 return Math.sign(value)*a/Math.sqrt(Math.PI)*sum;
}
function pixelGaussian(x,y,sigma){
 const d=sigma*Math.SQRT2,cdf=(p)=>vectorShutterOracleErf((p+.5)/d)-vectorShutterOracleErf((p-.5)/d);
 return Math.max(0,.25*cdf(x)*cdf(y));
}
function project(M,p){const a=[...p,1],r=row=>a.reduce((s,v,c)=>s+M[c*4+row]*v,0),w=Math.max(r(3),1e-5);return[r(0)/w*size*.5,r(1)/w*size*.5,r(3)];}

export function makeVectorShutterCases(){
 const rgb=Array.from({length:8},(_,i)=>i<4?[3,.2,0]:[.1,2,.4]);
 const base={name:'candidate-static-two-colour',centre:[0,0,-4],velocity:[0,0,0],stretch:[0,0,0],colour:[1,1,1],radius:.09,shapeZ:1,vector:true,shutter:.25,legacyShutter:.25,adaptive:false,rgb,t:[1,1,1],scalar:[1,1,1,1,1,1,1,1]};
 return[
  copy(base),{...copy(base),name:'candidate-shapeZ37-no-second-I',shapeZ:37},
  {...copy(base),name:'candidate-moving-head-joint-colour',velocity:[2.4,.8,0]},
  {...copy(base),name:'candidate-fixed8-spatial-tail-times8-RGB',velocity:[2.4,.8,0],stretch:[.8,.3,0]},
  {...copy(base),name:'candidate-adaptive-positive-spatial-times8-RGB',velocity:[2.4,.8,0],stretch:[1.5,.35,0],adaptive:true},
  {...copy(base),name:'candidate-vertex-T-once',t:[f32(.2),f32(.5),f32(.8)]},
  {...copy(base),name:'legacy-scalar-isolation',vector:false,shapeZ:2.5,colour:[.3,.8,.1],velocity:[2.4,.8,0],shutter:.05,legacyShutter:.25,scalar:[1,.5,.2,1,1,.3,.6,.4]}
 ];
}

// Full global positive spatial sums, rather than the shader's per-pixel
// clipped local subset. Viewport/quad clipping is accounted for explicitly.
export function referenceVectorShutterPixels(THREE,camera,input){
 const p=copy(input);for(const k of ['centre','velocity','stretch','colour','t','scalar'])p[k]=p[k].map(f32);p.rgb=p.rgb.map(a=>a.map(f32));p.radius=f32(p.radius);p.shapeZ=f32(p.shapeZ);
 camera.updateMatrixWorld();const M=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements.map(f32),P=camera.projectionMatrix.elements.map(f32),eye=camera.getWorldPosition(new THREE.Vector3()).toArray().map(f32),projected=project(M,p.centre),depth=Math.max(projected[2],.001),sigma=Math.sqrt(.0784+(p.radius*Math.abs(P[5])*size*.5/depth*.70710678)**2);
 const delta=(v,S)=>{const a=project(M,p.centre.map((x,c)=>x+v[c]*S*.5)),b=project(M,p.centre.map((x,c)=>x-v[c]*S*.5));return[a[0]-b[0],a[1]-b[1]];};
 const S=f32(p.vector?p.shutter:p.legacyShutter),shutter=delta(p.velocity,S),trail=dot(p.stretch,p.stretch)>1e-12,motion=trail?delta(p.stretch,1):shutter,L=Math.hypot(...motion),explicit=trail&&(p.vector?S>0:Math.hypot(...shutter)>1),finalSigma=trail&&!p.vector&&!explicit?Math.sqrt(sigma*sigma+dot(shutter,shutter)/24):sigma;
 const centre=[projected[0]+size*.5,projected[1]+size*.5],extent=[0,1].map(c=>3.65*finalSigma+Math.abs(motion[c])*.5+(explicit?Math.abs(shutter[c])*.5:0)+.65),ndc=projected.slice(0,2).map(v=>v*2/size),omega=4/(size*size*Math.abs(P[0]*P[5]))/(1+(ndc[0]/P[0])**2+(ndc[1]/P[5])**2)**1.5,distance=Math.max(p.radius,Math.hypot(...p.centre.map((x,c)=>x-eye[c]))),scale=f32(raw)/(distance*distance*omega),expected=new Float64Array(size*size*4);
 let n0=8,n1=8,blend=0,adaptive=false;
 if(trail&&p.adaptive&&L>1e-4){const x=Math.max(7,L/(.5*Math.max(1,finalSigma)));n0=Math.floor(x)+1;n1=n0+1;const f=x-Math.floor(x);blend=f*f*f*(f*(f*6-15)+10);const axis=motion.map(v=>v/L),support=.5*(Math.abs(axis[0])+Math.abs(axis[1]))+6*finalSigma+.02+(explicit?.38729833462*Math.abs(dot(shutter,axis)):0),local=Math.min(n1,Math.ceil(2*support*n1/L)+4);adaptive=n1<=65536&&local<=128;}
 const spatial=(qx,qy,tx,ty,n)=>{let sum=0;for(let j=0;j<n;j++){const s=(j+.5)/n-.5;sum+=pixelGaussian(qx-motion[0]*s-tx,qy-motion[1]*s-ty,finalSigma);}return sum/n;};
 const kernel=(qx,qy,tx,ty)=>!trail?pixelGaussian(qx-tx,qy-ty,finalSigma):adaptive?(1-blend)*spatial(qx,qy,tx,ty,n0)+blend*spatial(qx,qy,tx,ty,n1):spatial(qx,qy,tx,ty,8);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const qx=x+.5-centre[0],qy=y+.5-centre[1],o=(y*size+x)*4;if(Math.abs(qx)>extent[0]||Math.abs(qy)>extent[1])continue;
  const value=[0,0,0];
  for(let i=0;i<8;i++){const t=(i+.5)/8-.5,k=kernel(qx,qy,shutter[0]*t,shutter[1]*t)*.125;for(let c=0;c<3;c++)value[c]+=(p.vector?p.rgb[i][c]:p.shapeZ*p.colour[c]*p.scalar[i])*k;}
  for(let c=0;c<3;c++)expected[o+c]=value[c]*scale*(p.vector?p.colour[c]:1)*p.t[c];
 }
 return{pixels:expected,projection:{centre,depth,distance,omega,sigma:finalSigma,shutterPixels:shutter,spatialPixels:motion,extentPixels:extent,adaptive,n0,n1,blend},model:'Independent numerical-erf pixel Gaussian and complete positive spatial sums, joint8RGBtime; no production shader copy'};
}

function capture(THREE,r,g){const t=r.getRenderTarget(),n=g.getParameter(g.MAX_DRAW_BUFFERS);return{target:t,face:r.getActiveCubeFace(),mip:r.getActiveMipmapLevel(),viewport:r.getViewport(new THREE.Vector4()),scissor:r.getScissor(new THREE.Vector4()),test:r.getScissorTest(),actualViewport:Array.from(g.getParameter(g.VIEWPORT)),actualScissor:Array.from(g.getParameter(g.SCISSOR_BOX)),actualTest:g.isEnabled(g.SCISSOR_TEST),draw:g.getParameter(g.DRAW_FRAMEBUFFER_BINDING),read:g.getParameter(g.READ_FRAMEBUFFER_BINDING),readBuffer:g.getParameter(g.READ_BUFFER),drawBuffers:Array.from({length:n},(_,i)=>g.getParameter(g.DRAW_BUFFER0+i)),clear:r.getClearColor(new THREE.Color()).clone(),alpha:r.getClearAlpha(),auto:r.autoClear,autoColour:r.autoClearColor,autoDepth:r.autoClearDepth,autoStencil:r.autoClearStencil,tone:r.toneMapping,exposure:r.toneMappingExposure,output:r.outputColorSpace,xr:r.xr.enabled,shadow:{...r.shadowMap},targetViewport:t?.viewport.clone(),targetScissor:t?.scissor.clone(),targetTest:t?.scissorTest,packBuffer:g.getParameter(g.PIXEL_PACK_BUFFER_BINDING),pack:[g.PACK_ALIGNMENT,g.PACK_ROW_LENGTH,g.PACK_SKIP_PIXELS,g.PACK_SKIP_ROWS].map(k=>g.getParameter(k))};}
function restore(THREE,r,g,p){
 r.autoClear=p.auto;r.autoClearColor=p.autoColour;r.autoClearDepth=p.autoDepth;r.autoClearStencil=p.autoStencil;r.toneMapping=p.tone;r.toneMappingExposure=p.exposure;r.outputColorSpace=p.output;r.xr.enabled=p.xr;Object.assign(r.shadowMap,p.shadow);r.setClearColor(p.clear,p.alpha);r.setViewport(p.viewport);r.setScissor(p.scissor);r.setScissorTest(p.test);
 try{if(p.target?.viewport)p.target.viewport.fromArray(p.actualViewport);if(p.target?.scissor){p.target.scissor.fromArray(p.actualScissor);p.target.scissorTest=p.actualTest;}r.setRenderTarget(p.target,p.face,p.mip);}finally{if(p.targetViewport)p.target.viewport.copy(p.targetViewport);if(p.targetScissor){p.target.scissor.copy(p.targetScissor);p.target.scissorTest=p.targetTest;}}
 r.state.bindFramebuffer(g.DRAW_FRAMEBUFFER,p.draw);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,p.draw);let n=p.draw===null?1:p.drawBuffers.length;while(n>1&&p.drawBuffers[n-1]===g.NONE)n--;g.drawBuffers(p.drawBuffers.slice(0,n));r.state.bindFramebuffer(g.READ_FRAMEBUFFER,p.read);g.bindFramebuffer(g.READ_FRAMEBUFFER,p.read);g.readBuffer(p.readBuffer);
 g.bindBuffer(g.PIXEL_PACK_BUFFER,p.packBuffer);[g.PACK_ALIGNMENT,g.PACK_ROW_LENGTH,g.PACK_SKIP_PIXELS,g.PACK_SKIP_ROWS].forEach((k,i)=>g.pixelStorei(k,p.pack[i]));r.state.viewport(new THREE.Vector4().fromArray(p.actualViewport));r.state.scissor(new THREE.Vector4().fromArray(p.actualScissor));r.state.setScissorTest(p.actualTest);
}
function sameState(a,b){return a.target===b.target&&a.face===b.face&&a.mip===b.mip&&a.viewport.equals(b.viewport)&&a.scissor.equals(b.scissor)&&a.clear.equals(b.clear)&&['test','actualTest','draw','read','readBuffer','alpha','auto','autoColour','autoDepth','autoStencil','tone','exposure','output','xr','targetTest','packBuffer'].every(k=>a[k]===b[k])&&['actualViewport','actualScissor','drawBuffers','pack'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]))&&JSON.stringify(a.shadow)===JSON.stringify(b.shadow)&&(!a.targetViewport||a.targetViewport.equals(b.targetViewport))&&(!a.targetScissor||a.targetScissor.equals(b.targetScissor));}
function difference(actual,expected){let finite=true,maxAbs=0,peak=0,sumActual=[0,0,0],sumExpected=[0,0,0],minimum=Infinity,maxAlpha=0,maxVisibleRelative=0;
 for(let i=0;i<expected.length;i+=4)for(let c=0;c<3;c++){const a=actual[i+c],e=expected[i+c];finite&&=Number.isFinite(a);minimum=Math.min(minimum,a);maxAbs=Math.max(maxAbs,Math.abs(a-e));peak=Math.max(peak,Math.abs(e));sumActual[c]+=a;sumExpected[c]+=e;maxAlpha=Math.max(maxAlpha,Math.abs(actual[i+3]));}
 for(let i=0;i<expected.length;i+=4)for(let c=0;c<3;c++)if(expected[i+c]>peak*1e-4)maxVisibleRelative=Math.max(maxVisibleRelative,Math.abs(actual[i+c]-expected[i+c])/expected[i+c]);
 const fluxRelative=sumActual.map((v,c)=>Math.abs(v-sumExpected[c])/Math.max(sumExpected[c],1e-15)),normalizedByPeak=maxAbs/Math.max(peak,1e-15);
 return{finite,minimum,maxAbs,expectedPeak:peak,normalizedByPeak,maxVisibleRelative,sumActual,sumExpected,fluxRelative,maxAlpha,tolerance:{maximumAbsolute:2e-7,maximumNormalizedByPeak:.003,maximumFluxRelative:.003},passed:finite&&minimum>=-1e-12&&maxAlpha===0&&maxAbs<=2e-7&&normalizedByPeak<=.003&&fluxRelative.every(v=>v<=.003)};
}

export async function runVectorShutterGPUCheck(THREE,renderer,{createFireworks,parentLocked=false,maxCases=7}={}){
 if(!parentLocked||typeof createFireworks!=='function')throw new Error('Existing renderer exclusive QA lock and current isolated FW factory required');
 if(!Number.isSafeInteger(maxCases)||maxCases<1||maxCases>7)throw new RangeError('At most7 single-instance main-material cases');
 const gl=renderer.getContext(),report={schema:'glass-atoll.r18-vector-shutter-GPU.v1',dateUTC:new Date().toISOString(),actualGPU:false,checks:[],cases:[],glErrors:[],shaderErrors:[],readbackBytes:0},check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,...evidence});
 let saved=null,fw=null,target=null,depth=null,transmission=null,query=null,queryActive=false,stop=false;
 const oldShader=renderer.debug.onShaderError,oldCheck=renderer.debug.checkShaderErrors;
 function errors(label){const a=[];for(let i=0;i<16;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;a.push(e);}if(a.length||gl.isContextLost()){report.glErrors.push({label,errors:a,contextLost:gl.isContextLost()});stop=true;report.stopped='GL/context error; no further fixture dispatched';}return a;}
 try{
  errors('entry');if(stop)throw new Error('Entry GL errors');saved=capture(THREE,renderer,gl);
  report.caps={maxVertexAttribs:gl.getParameter(gl.MAX_VERTEX_ATTRIBS),maxVaryingVectors:gl.getParameter(gl.MAX_VARYING_VECTORS),maxVertexOutputComponents:gl.getParameter(gl.MAX_VERTEX_OUTPUT_COMPONENTS),maxFragmentInputComponents:gl.getParameter(gl.MAX_FRAGMENT_INPUT_COMPONENTS),maxVertexTextureUnits:gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),floatTarget:!!gl.getExtension('EXT_color_buffer_float')};
  if(!report.caps.floatTarget||report.caps.maxVertexAttribs<13||report.caps.maxVertexTextureUnits<1)throw new Error('Required13attributes/vertex-texture/RGBA32F support unavailable');
  const timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2'),timer=timerExtension&&!gl.getQuery(timerExtension.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)?timerExtension:null;report.timerAvailable=!!timer;
  renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(g,p,v,f)=>{stop=true;report.shaderErrors.push({program:g.getProgramInfoLog(p),vertex:g.getShaderInfoLog(v),fragment:g.getShaderInfoLog(f)});};
  fw=createFireworks(THREE,{terrainHeight:()=>0,origin:[0,0,0],sourceVisibility:'none'});const meshes=fw.effectsScene.children.filter(o=>o.isMesh);
  if(meshes.length!==1)throw new Error('Expected one actual finite effects mesh');const mesh=meshes[0],material=mesh.material,geometry=mesh.geometry,u=material.uniforms;
  const required={position:3,aCentre:3,aVelocity:3,aStretch:3,aColour:3,aShape:4,aSmokeLight:3,aTemporal0:4,aTemporal1:4,aTemporal2:4,aTemporal3:4,aTemporal4:4,aTemporal5:4};
  for(const[name,itemSize]of Object.entries(required))if(geometry.getAttribute(name)?.itemSize!==itemSize)throw new Error('Actual FW geometry attribute mismatch: '+name);
  if(!material.isRawShaderMaterial||!u.uLegacyShutter||!u.uSourceTransmissionEnabled)throw new Error('Current vector candidate FW material not loaded');
  report.actualAttributeLocations=Object.keys(required).length;report.material={name:material.name,actualOwnedFactoryMaterial:true,shaderCopied:false,vertexCharacters:material.vertexShader.length,fragmentCharacters:material.fragmentShader.length};
  const camera=new THREE.PerspectiveCamera(50,1,.1,50);camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld();
  target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,samples:0});target.texture.colorSpace=THREE.NoColorSpace;target.viewport.set(0,0,size,size);target.scissorTest=false;
  depth=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);depth.needsUpdate=true;depth.minFilter=depth.magFilter=THREE.NearestFilter;depth.generateMipmaps=false;
  transmission=new THREE.DataTexture(new Float32Array([.2,.5,.8,1]),1,1,THREE.RGBAFormat,THREE.FloatType);transmission.needsUpdate=true;transmission.minFilter=transmission.magFilter=THREE.NearestFilter;transmission.generateMipmaps=false;
  u.uViewProjection.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);u.uProjection.value.copy(camera.projectionMatrix);u.uEye.value.set(0,0,0);u.uSize.value.set(size,size);u.uDepth.value=depth;u.uStorageScale.value=1;u.uRawPerCandela.value=raw;u.uDof.value=0;u.uVignette.value=0;u.uAirEnabled.value=0;u.uFocalMm.value=28;u.uAperture.value=8;u.uFocus.value=4;u.uSensorHeightMm.value=24;u.uSourceTransmission.value=transmission;u.uSourceTransmissionSize.value.set(1,1);
  renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.setClearColor(0,0);
  const fixtures=makeVectorShutterCases().slice(0,maxCases),readbacks=[];
  for(const fixture of fixtures){
   if(stop)break;
   for(const[name,value]of Object.entries({aCentre:fixture.centre,aVelocity:fixture.velocity,aStretch:fixture.stretch,aColour:fixture.colour,aShape:[0,fixture.radius,fixture.shapeZ,fixture.vector?-1:0],aSmokeLight:[0,0,0]})){const a=geometry.getAttribute(name);a.array.set(value,0);a.needsUpdate=true;}
   const packed=fixture.vector?fixture.rgb.flat():[...fixture.scalar,...new Array(16).fill(991)];for(let i=0;i<6;i++){const a=geometry.getAttribute('aTemporal'+i);a.array.set(packed.slice(i*4,i*4+4),0);a.needsUpdate=true;}
   geometry.instanceCount=1;u.uShutter.value=fixture.shutter;u.uLegacyShutter.value=fixture.legacyShutter;u.uTrailAdaptive.value=fixture.adaptive?1:0;u.uSourceTransmissionEnabled.value=fixture.t.some(v=>v!==1)?1:0;
   const oracle=referenceVectorShutterPixels(THREE,camera,fixture),pixels=new Float32Array(size*size*4);pixels.fill(NaN);
   renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear(true,false,false);const started=performance.now();
   if(timer){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);queryActive=true;}
   try{renderer.render(fw.effectsScene,camera);report.actualGPU=true;}finally{if(queryActive){gl.endQuery(timer.TIME_ELAPSED_EXT);queryActive=false;}}
   const submitMs=performance.now()-started;errors(fixture.name+' draw');if(stop)throw new Error('First shader/GL gate failed');
   if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Single32x32RGBA32F framebuffer incomplete');const program=renderer.properties.get(material).currentProgram;if(program&&!gl.getProgramParameter(program.program,gl.LINK_STATUS))throw new Error('Actual finite effects material failed to link');
   gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,pixels);report.readbackBytes+=pixels.byteLength;errors(fixture.name+' readback');
   let gpuMs=null;
   if(query){let ready=false;for(let i=0;i<60;i++){if(gl.isContextLost())break;if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){ready=true;break;}await new Promise(requestAnimationFrame);}const disjoint=gl.getParameter(timer.GPU_DISJOINT_EXT);if(ready&&!disjoint)gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);query=null;if(!ready||disjoint||gpuMs>25){stop=true;report.stopped=gpuMs>25?'Actual isolated draw exceeded25ms':'Timer unavailable/disjoint; no further fixture';}}
   const d=difference(pixels,oracle.pixels);report.cases.push({name:fixture.name,instances:1,size:[size,size],draws:1,submitMs,gpuMs,difference:d,projection:oracle.projection});readbacks.push(pixels);check(fixture.name+' actual material matches independent jointRGB Gaussian oracle',d.passed,{difference:d});if(!d.passed){stop=true;report.stopped='Single-instance optical gate failed';}if(stop)break;
  }
  if(readbacks.length>=2){let delta=0;for(let i=0;i<readbacks[0].length;i++)delta=Math.max(delta,Math.abs(readbacks[0][i]-readbacks[1][i]));check('candidate shape.z37 does not multiply referenceRGB by I again',delta===0,{maximumDifference:delta});}
  if(readbacks.length>=6){let delta=0,peak=0;const T=[f32(.2),f32(.5),f32(.8)];for(let i=0;i<readbacks[0].length;i+=4)for(let c=0;c<3;c++){delta=Math.max(delta,Math.abs(readbacks[5][i+c]-readbacks[0][i+c]*T[c]));peak=Math.max(peak,readbacks[0][i+c]);}check('actual gl_InstanceID vertex T multiplies RGB exactly once',delta<=Math.max(1e-9,peak*3e-6),{maximumAbsolute:delta,normalizedByUnattenuatedPeak:delta/Math.max(peak,1e-15)});}
  check('requested bounded single-instance cases complete without guard stop',!stop&&report.cases.length===fixtures.length,{requested:fixtures.length,completed:report.cases.length,stopped:report.stopped??null});
 }catch(error){report.failure=String(error?.stack??error);check('bounded actual FW vector helper completes',false,{error:report.failure});}
 finally{
  if(query){if(queryActive)try{gl.endQuery(gl.getExtension('EXT_disjoint_timer_query_webgl2').TIME_ELAPSED_EXT);queryActive=false;}catch{}try{gl.deleteQuery(query);}catch{}}
  // Only owned resources are disposed. Restore the previously active FBOs and
  // selections AFTER disposal so deallocation cannot invalidate the capture.
  try{fw?.dispose();target?.dispose();depth?.dispose();transmission?.dispose();}catch(error){check('owned resources dispose cleanly',false,{error:String(error)});}
  renderer.debug.onShaderError=oldShader;renderer.debug.checkShaderErrors=oldCheck;
  if(saved){try{restore(THREE,renderer,gl,saved);check('outer renderer/FBO/MRT/READ_BUFFER/viewport/scissor/PACK/XR restored',sameState(saved,capture(THREE,renderer,gl)));}catch(error){check('outer renderer state restored',false,{error:String(error?.stack??error)});}}
  errors('exit/restore/dispose');
 }
 check('no shader or GL faults',report.shaderErrors.length===0&&report.glErrors.length===0);report.passed=report.checks.length>0&&report.checks.every(c=>c.passed);report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.limits=['At most7 actual main-material single-instance32x32 draws; no show, medium field, new context, canvas resize or repeated stress loop.','Scalar/colour profile time correctness belongs to CPU integration fixtures; this helper tests the supplied8RGB bins and actual shader transport.','Independent numerical erf and full spatial sums compare the production GLSL approximation; tolerances include Float32 projection/interpolation and six-sigma omitted tails.','Not a reflection-material compile, corner/near-plane/depth/DOF/P-bound proof, changingT(t) test, receiver temporal integration or nativeFPS admission.','Timer polls do not submit draws; when timing is available any draw over25ms stops the remaining cases.'];return report;
}
