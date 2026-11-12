// Read-only real-frame diagnostics. Run separately from performance benchmarks:
// GPU readback and CPU registration perturb timing. Residual != proven aliasing.
export const FLICKER_AUDIT_VERSION='2.2-browser-snapshot-path';
const srgb=Float32Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
const quantile=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(p*(s.length-1))];};
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const rms=a=>Math.sqrt(mean(a.map(x=>x*x)));
function summary(a){return {count:a.length,mean:a.length?mean(a):null,rms:a.length?rms(a):null,p95:quantile(a,.95),p99:quantile(a,.99),maximum:a.length?Math.max(...a):null};}
function blur3(a,w,h){const b=new Float32Array(a.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)s+=a[Math.max(0,Math.min(h-1,y+j))*w+Math.max(0,Math.min(w-1,x+i))];b[y*w+x]=s/9;}return b;}
function bilerp(a,w,h,x,y){x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,k=j*w+i;return(a[k]*(1-u)+a[j*w+Math.min(w-1,i+1)]*u)*(1-v)+(a[Math.min(h-1,j+1)*w+i]*(1-u)+a[Math.min(h-1,j+1)*w+Math.min(w-1,i+1)]*u)*v;}
function patchScore(a,b,w,x,y,dx,dy){let sa=0,sb=0,saa=0,error=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const av=a[(y+j)*w+x+i],bv=b[(y+j+dy)*w+x+i+dx];sa+=av;sb+=bv;saa+=av*av;error+=(av-bv)**2;}return {score:Math.max(0,error-(sa-sb)**2/25),variance:Math.max(1e-9,saa-sa*sa/25)};}
function bestShift(a,b,w,h,x,y,r){let best=Infinity,bx=0,by=0,variance=0;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(x+dx<2||x+dx>=w-2||y+dy<2||y+dy>=h-2)continue;const q=patchScore(a,b,w,x,y,dx,dy);if(q.score<best){best=q.score;bx=dx;by=dy;variance=q.variance;}}return {dx:bx,dy:by,error:best/Math.max(variance,1e-9),variance};}
function registeredResidual(current,previous,w,h,{motion='flow',maxShift=4,blockStep=12}={}){
  let error=0,hf=0,raw=0,scale=0,count=0,attempted=0,accepted=0,speed=0;
  for(let y=maxShift+3;y<h-maxShift-3;y+=blockStep)for(let x=maxShift+3;x<w-maxShift-3;x+=blockStep){
    attempted++;let dx=0,dy=0;
    if(motion!=='static'){
      const f=bestShift(current.blur,previous.blur,w,h,x,y,maxShift);
      if(f.variance<1e-7||f.error>.6)continue;
      const back=bestShift(previous.blur,current.blur,w,h,x+f.dx,y+f.dy,maxShift);
      if(Math.hypot(f.dx+back.dx,f.dy+back.dy)>1.5)continue;
      dx=f.dx;dy=f.dy;
      // Local quadratic refinement reduces integer-registration residuals.
      for(const axis of ['x','y']){
        const ex=axis==='x'?1:0,ey=axis==='y'?1:0;
        if(x+f.dx-ex<2||x+f.dx+ex>=w-2||y+f.dy-ey<2||y+f.dy+ey>=h-2)continue;
        const c=patchScore(current.blur,previous.blur,w,x,y,f.dx,f.dy).score;
        if(c<1e-12)continue; // An exact integer match must not be biased by a fit.
        const l=patchScore(current.blur,previous.blur,w,x,y,f.dx-ex,f.dy-ey).score,r=patchScore(current.blur,previous.blur,w,x,y,f.dx+ex,f.dy+ey).score;
        const d=l-2*c+r,offset=d>1e-12?Math.max(-.5,Math.min(.5,.5*(l-r)/d)):0;
        if(axis==='x')dx+=offset;else dy+=offset;
      }
    }
    // Registration is an explanatory model, not permission to invent error.
    // Reject a fitted subpixel shift if it is worse than the zero-motion model
    // on the actual, unblurred values (e.g. almost-static quantized imagery).
    if(dx!==0||dy!==0){let fitted=0,identity=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const k=(y+j)*w+x+i;fitted+=(current.y[k]-bilerp(previous.y,w,h,x+i+dx,y+j+dy))**2;identity+=(current.y[k]-previous.y[k])**2;}if(fitted>identity+1e-14){dx=0;dy=0;}}
    accepted++;speed+=Math.hypot(dx,dy);
    for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){
      const k=(y+j)*w+x+i,a=current.y[k],b=bilerp(previous.y,w,h,x+i+dx,y+j+dy);
      const ah=a-current.blur[k],bh=b-bilerp(previous.blur,w,h,x+i+dx,y+j+dy);
      error+=(a-b)**2;hf+=(ah-bh)**2;raw+=(a-previous.y[k])**2;scale+=(Math.abs(a)+Math.abs(b))*.5;count++;
    }
  }
  return {acceptedBlocks:accepted,attemptedBlocks:attempted,acceptedFraction:accepted/Math.max(1,attempted),meanMotionPixels:speed/Math.max(1,accepted),rawRms:Math.sqrt(raw/Math.max(1,count)),registeredRms:Math.sqrt(error/Math.max(1,count)),registeredHighFrequencyRms:Math.sqrt(hf/Math.max(1,count)),relativeRegisteredRms:Math.sqrt(error/Math.max(1,count))/Math.max(.005,scale/Math.max(1,count)),insufficientMotionSupport:motion!=='static'&&accepted<Math.max(3,attempted*.2)};
}
function frameLuma(frame){
  const {data,width:w,height:h}=frame,y=new Float32Array(w*h),byte=data instanceof Uint8Array||data instanceof Uint8ClampedArray,encoded=frame.encoding==='display-srgb'||byte&&frame.encoding!=='linear';let clipped=0,nonFinite=0;
  const decode=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
  for(let i=0;i<w*h;i++){let r=data[i*4],g=data[i*4+1],b=data[i*4+2];if(byte){if(r>=254||g>=254||b>=254)clipped++;if(encoded){r=srgb[r];g=srgb[g];b=srgb[b];}else{r/=255;g/=255;b/=255;}}else if(encoded){r=decode(r);g=decode(g);b=decode(b);}if(!Number.isFinite(r+g+b)){nonFinite++;r=g=b=0;}y[i]=.2126*r+.7152*g+.0722*b;}
  const blur=blur3(y,w,h);let high=0;for(let i=0;i<y.length;i++)high+=(y[i]-blur[i])**2;
  return {y,blur,mean:mean(Array.from(y)),p95:quantile(y,.95),p99:quantile(y,.99),maximum:y.reduce((a,b)=>Math.max(a,b),0),highFrequencyRms:Math.sqrt(high/y.length),clippedFraction:byte?clipped/y.length:null,nonFinite};
}
function inputDigest(input,previous){
  const data=input.data,bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);let hash=2166136261;
  for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i],16777619)>>>0;
  const out={fnv1a32:hash.toString(16).padStart(8,'0'),byteLength:bytes.length,encoding:input.encoding||null,RGBChangedPixels:null,RGBMaximumAbsoluteDifference:null,RGBDifferenceBounds:null,RGBExamples:[]};
  if(!previous)return out;
  if(previous.width!==input.width||previous.height!==input.height||previous.data.length!==data.length){out.dimensionsChanged=true;return out;}
  let changed=0,maximum=0,minX=input.width,minY=input.height,maxX=-1,maxY=-1;
  for(let k=0;k<input.width*input.height;k++){
    let difference=0;for(let c=0;c<3;c++)difference=Math.max(difference,Math.abs(data[k*4+c]-previous.data[k*4+c]));
    if(difference>0){changed++;maximum=Math.max(maximum,difference);const x=k%input.width,y=Math.floor(k/input.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(out.RGBExamples.length<6)out.RGBExamples.push({x,y,previous:Array.from(previous.data.subarray(k*4,k*4+3)),current:Array.from(data.subarray(k*4,k*4+3))});}
  }
  out.RGBChangedPixels=changed;out.RGBMaximumAbsoluteDifference=maximum;out.RGBDifferenceBounds=changed?[minX,minY,maxX,maxY]:null;return out;
}

/** Inputs are actual top-origin RGBA ROI buffers, not screenshots with UI. */
export function createFlickerAnalyzer(regions,{warmupFrames=16}={}){
  const records=regions.map(r=>({...r,frames:[],previous:null,previousInput:null,lag:[],phase:Array.from({length:8},()=>({sum:null,count:0}))}));
  let total=0,firstState=null,staticVerified=true;const frameIntervals=[],stateTrace=[];let previousTimestamp=null;
  return {
    push({timestamp,simulationTime,cameraKey,phase=null,renderScale=null,regions:inputs}){
      total++;if(previousTimestamp!==null)frameIntervals.push(timestamp-previousTimestamp);previousTimestamp=timestamp;
      if(firstState===null)firstState={simulationTime,cameraKey,renderScale};
      if(!Number.isFinite(simulationTime)||typeof cameraKey!=='string'||simulationTime!==firstState.simulationTime||cameraKey!==firstState.cameraKey||renderScale!==firstState.renderScale)staticVerified=false;
      stateTrace.push({timestamp,simulationTime,phase,renderScale});
      for(const r of records){const input=inputs[r.name];if(!input)throw new Error('Missing ROI '+r.name);const current=frameLuma(input),digest=inputDigest(input,r.previousInput);
        if(total>warmupFrames){
          const registered=r.previous?registeredResidual(current,r.previous,input.width,input.height,r):null;
          const lag8=r.lag.length===8?Math.sqrt(current.y.reduce((s,v,i)=>s+(v-r.lag[0][i])**2,0)/current.y.length):null;
          r.frames.push({timestamp,input:digest,mean:current.mean,p95:current.p95,p99:current.p99,maximum:current.maximum,highFrequencyRms:current.highFrequencyRms,clippedFraction:current.clippedFraction,nonFinite:current.nonFinite,registered,lag8Rms:lag8});
          if(Number.isInteger(phase)&&phase>=0&&phase<8){const p=r.phase[phase];if(!p.sum)p.sum=new Float64Array(current.y.length);for(let i=0;i<current.y.length;i++)p.sum[i]+=current.y[i];p.count++;}
        }
        r.previous=current;r.previousInput=input;r.lag.push(current.y);if(r.lag.length>8)r.lag.shift();
      }
    },
    finish(){return {kind:'actual rendered ROI temporal audit; appearance residuals are not a direct noise/flicker verdict',metricVersion:FLICKER_AUDIT_VERSION,totalCapturedFrames:total,warmupFrames,staticSimulationAndCameraVerified:staticVerified,frameIntervals,frameIntervalStatistics:summary(frameIntervals),stateTrace,regions:records.map(r=>{
      const frames=r.frames,valid=frames.map(f=>f.registered).filter(x=>x&&!x.insufficientMotionSupport),means=frames.map(f=>f.mean),centre=mean(means);
      let phaseRms=null;const phases=r.phase.filter(p=>p.count>=3);
      if(staticVerified&&phases.length===8){let variance=0;for(let i=0;i<phases[0].sum.length;i++){const values=phases.map(p=>p.sum[i]/p.count),m=mean(values);variance+=mean(values.map(v=>(v-m)**2));}phaseRms=Math.sqrt(variance/phases[0].sum.length);}
      return {name:r.name,roi:{x:r.x,y:r.y,width:r.width,height:r.height},motionModel:r.motion||'flow',measuredFrames:frames.length,uniqueInputHashes:new Set(frames.map(f=>f.input.fnv1a32)).size,framesWithRGBChanges:frames.filter(f=>f.input.RGBChangedPixels>0).length,rawRGBChangedPixels:summary(frames.map(f=>f.input.RGBChangedPixels).filter(x=>x!==null)),maximumRawRGBDifference:Math.max(0,...frames.map(f=>f.input.RGBMaximumAbsoluteDifference||0)),meanLuma:summary(means),relativeMeanLumaVariation:rms(means.map(x=>x-centre))/Math.max(.005,centre),p99Luma:summary(frames.map(f=>f.p99)),highFrequencySpatialEnergy:summary(frames.map(f=>f.highFrequencyRms)),motionCorrectedResidual:summary(valid.map(x=>x.registeredRms)),motionCorrectedHighFrequencyResidual:summary(valid.map(x=>x.registeredHighFrequencyRms)),rawResidual:summary(valid.map(x=>x.rawRms)),meanAcceptedBlockFraction:mean(frames.map(f=>f.registered?.acceptedFraction||0)),invalidMotionPairs:frames.length-valid.length,phaseCounts:r.phase.map(p=>p.count),staticEightPhaseSpatialRms:phaseRms,lag8Rms:summary(frames.filter(f=>f.lag8Rms!==null).map(f=>f.lag8Rms)),frames};}),limits:['Readback and CPU registration perturb frame intervals: do not use this as a performance benchmark.','Canvas samples are tone-mapped display-sRGB decoded to linear display values, not scene radiance.','Block translation with forward/back rejection is a limited optical-flow approximation; deformation, occlusion, specular appearance and true water motion can remain in residuals.','Use static phase-locked tests and identical-time supersampled/shutter references before attributing residuals to aliasing.','Mean/percentile/energy tracks are descriptive; no automatic pass or claim that all temporal change is noise.','Default independent-rAF scheduling is only an assumption for preserveDrawingBuffer=false. Prefer a hook inside the same main frame immediately after its final draw.','Input hashes are diagnostic FNV, not cryptographic evidence; exact RGB change counts and examples audit the underlying captured buffers.']};}
  };
}

/** Root calls during a callback AFTER its ordinary render; no extra lens draw. */
export function captureCanvasRegions(canvas,regions){
  const gl=canvas.getContext('webgl2');if(!gl)throw new Error('Existing WebGL2 canvas required');
  const old=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer=gl.getParameter(gl.READ_BUFFER),pack=gl.getParameter(gl.PACK_ALIGNMENT),out={};
  try{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.readBuffer(gl.BACK);gl.pixelStorei(gl.PACK_ALIGNMENT,1);
    for(const r of regions){const x=Math.round(r.x),y=Math.round(r.y),width=Math.round(r.width),height=Math.round(r.height);if(x<0||y<0||x+width>canvas.width||y+height>canvas.height)throw new Error('ROI outside physical canvas: '+r.name);const raw=new Uint8Array(width*height*4),data=new Uint8Array(raw.length);gl.readPixels(x,canvas.height-y-height,width,height,gl.RGBA,gl.UNSIGNED_BYTE,raw);for(let j=0;j<height;j++)data.set(raw.subarray((height-1-j)*width*4,(height-j)*width*4),j*width*4);out[r.name]={data,width,height,encoding:'display-srgb'};}
  }finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,old);gl.readBuffer(readBuffer);gl.pixelStorei(gl.PACK_ALIGNMENT,pack);}
  return out;
}

/** Browser image-snapshot path, independently comparable with toDataURL PNG.
 * Each ROI reuses its own offscreen 2D surface. No WebGL state is touched. */
export function createBrowserSnapshotReader(){
  const cache=new Map();
  return {read(canvas,regions){
    const out={};
    for(const r of regions){
      const x=Math.round(r.x),y=Math.round(r.y),width=Math.round(r.width),height=Math.round(r.height);
      if(x<0||y<0||width<1||height<1||x+width>canvas.width||y+height>canvas.height)throw new Error('ROI outside physical canvas: '+r.name);
      let item=cache.get(r.name);
      if(!item){
        const surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas');surface.width=width;surface.height=height;
        const context=surface.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});if(!context)throw new Error('Browser 2D snapshot context unavailable');
        item={surface,context};cache.set(r.name,item);
      }
      if(item.surface.width!==width||item.surface.height!==height){item.surface.width=width;item.surface.height=height;}
      const ctx=item.context;ctx.globalCompositeOperation='copy';ctx.imageSmoothingEnabled=false;
      ctx.drawImage(canvas,x,y,width,height,0,0,width,height);
      const pixels=ctx.getImageData(0,0,width,height,{colorSpace:'srgb'});
      // Own a CPU copy before the offscreen surface is reused/disposed.
      out[r.name]={data:new Uint8ClampedArray(pixels.data),width,height,encoding:'display-srgb'};
    }
    return out;
  },get state(){return [...cache.entries()].map(([name,{surface,context}])=>({name,size:[surface.width,surface.height],contextAttributes:context.getContextAttributes?.()||null}));},dispose(){for(const {surface} of cache.values()){surface.width=surface.height=1;}cache.clear();}};
}

/** Default scheduling assumes the main rAF callback was queued first. A root
 * frame-probe hook can supply schedule(callback) for an explicit after-draw tap. */
export async function runCanvasFlickerAudit({canvas,regions,getState=()=>({}),frames=120,warmupFrames=16,schedule=callback=>requestAnimationFrame(callback),captureMethod='raw-webgl-readPixels',signal=null,label=''}={}){
  if(!canvas||!regions?.length)throw new Error('canvas and named physical-pixel ROIs required');
  if(!['raw-webgl-readPixels','browser-2d-snapshot'].includes(captureMethod))throw new Error('Unknown capture method '+captureMethod);
  const analyzer=createFlickerAnalyzer(regions,{warmupFrames}),capturedFrames=[],snapshotReader=captureMethod==='browser-2d-snapshot'?createBrowserSnapshotReader():null;let captured=0,initialState=null,finalState=null,snapshotContexts=null;
  // Defer registration/sorting until capture is finished. Keeping CPU analysis
  // out of the sampling callbacks avoids needlessly changing the next dt.
  try{await new Promise((resolve,reject)=>{const next=timestamp=>{try{if(signal?.aborted)throw new Error('Flicker audit aborted');const s=getState()||{},temporal=s.lens?.temporal,phase=temporal?.active&&temporal.historyFrames>0?(temporal.historyFrames-1)%8:null;finalState={time:s.time,camera:s.camera,target:s.target,renderScale:s.renderScale,parameters:s.parameters,lens:s.lens};if(initialState===null)initialState=finalState;capturedFrames.push({timestamp:Number.isFinite(timestamp)?timestamp:performance.now(),simulationTime:s.time,cameraKey:JSON.stringify([s.camera,s.target,s.parameters]),phase,renderScale:s.renderScale,regions:snapshotReader?snapshotReader.read(canvas,regions):captureCanvasRegions(canvas,regions)});if(++captured>=frames)resolve();else schedule(next);}catch(e){reject(e);}};schedule(next);});}
  finally{snapshotContexts=snapshotReader?.state||null;snapshotReader?.dispose();}
  for(let i=0;i<capturedFrames.length;i++){analyzer.push(capturedFrames[i]);if(i%8===7)await new Promise(resolve=>setTimeout(resolve,0));}
  return {label,captureMethod,snapshotContexts,capturedAt:new Date().toISOString(),canvasPhysicalSize:[canvas.width,canvas.height],initialState,finalState,...analyzer.finish()};
}

/** Optional scene-linear RT reader. A tiny QA-only RGBA32F copy makes HalfFloat
 * and normalized source formats readable without platform-specific read types.
 * Source encoding is explicit: NoColorSpace alone does NOT mean linear values.
 * This reader adds copy/readback cost; never include it in a production bench. */
export function createTargetRegionReader(THREE,renderer){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const uniforms={uSource:{value:null},uMin:{value:new THREE.Vector2()},uScale:{value:new THREE.Vector2(1,1)}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D uSource;uniform vec2 uMin,uScale;void main(){gl_FragColor=textureLod(uSource,uMin+vUv*uScale,0.);}'});
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);scene.add(new THREE.Mesh(geometry,material));
  return {read(source,regions,{encoding='linear'}={}){
    if(!source?.isWebGLRenderTarget)throw new Error('Pass the actual source render target');
    const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),scissor=renderer.getScissorTest(),autoClear=renderer.autoClear,out={};
    try{renderer.setScissorTest(false);renderer.autoClear=true;uniforms.uSource.value=source.texture;
      for(const r of regions){const x=Math.round(r.x),y=Math.round(r.y),width=Math.round(r.width),height=Math.round(r.height);if(x<0||y<0||x+width>source.width||y+height>source.height)throw new Error('ROI outside target: '+r.name);target.setSize(width,height);uniforms.uMin.value.set(x/source.width,1-(y+height)/source.height);uniforms.uScale.value.set(width/source.width,height/source.height);renderer.setRenderTarget(target);renderer.render(scene,camera);const raw=new Float32Array(width*height*4),data=new Float32Array(raw.length);renderer.readRenderTargetPixels(target,0,0,width,height,raw);for(let j=0;j<height;j++)data.set(raw.subarray((height-1-j)*width*4,(height-j)*width*4),j*width*4);out[r.name]={data,width,height,encoding};}
    }finally{renderer.setRenderTarget(previous,face,mip);renderer.setScissorTest(scissor);renderer.autoClear=autoClear;}
    return out;
  },dispose(){target.dispose();material.dispose();geometry.dispose();}};
}

/** Instrument the LIVE water material, not a reimplemented wave equation.
 * No runtime file is edited. Root supplies water/camera from its closure.
 * ROIs must be visible open water: this auxiliary draw has no island occluder.
 * Returns actual mip-moment/pixel/shutter variance budget before tone mapping. */
export function createWaterVarianceProbe(THREE,renderer,water,camera,{baseVariance=.00011081125}={}){
  const original=water.mesh.material,marker='gl_FragColor=vec4(colour,1.);';
  if(!original.fragmentShader.includes(marker)||!original.fragmentShader.includes('float pixelNormalVariance='))throw new Error('Live water shader layout changed; update probe instrumentation explicitly');
  const fragment=original.fragmentShader.replace(marker,'gl_FragColor=vec4(unresolvedSlopeVariance,pixelNormalVariance,temporalNormalVariance,opticalFootprint);').replace('#include <tonemapping_fragment>','').replace('#include <colorspace_fragment>','');
  const material=new THREE.ShaderMaterial({uniforms:original.uniforms,defines:{...original.defines},vertexShader:original.vertexShader,fragmentShader:fragment,side:original.side,depthTest:true,depthWrite:true,toneMapped:false});
  const mesh=new THREE.Mesh(water.mesh.geometry,material);mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;
  const scene=new THREE.Scene();scene.add(mesh);
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}),reader=createTargetRegionReader(THREE,renderer);
  return {read(regions){
    const size=water.uniforms.uResolution.value,w=Math.round(size.x),h=Math.round(size.y),previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),test=renderer.getScissorTest(),clear=renderer.autoClear,shadowDirty=renderer.shadowMap.needsUpdate;
    let samples;
    try{renderer.setScissorTest(false);renderer.autoClear=true;renderer.shadowMap.needsUpdate=false;target.setSize(w,h);mesh.matrix.copy(water.mesh.matrixWorld);renderer.setRenderTarget(target);renderer.render(scene,camera);samples=reader.read(target,regions,{encoding:'linear'});}
    finally{renderer.setRenderTarget(previous,face,mip);renderer.setScissorTest(test);renderer.autoClear=clear;renderer.shadowMap.needsUpdate=shadowDirty;}
    const domains=water.uniforms.uWaveDomains.value.toArray(),resolution=water.uniforms.uWaveResolution.value;
    return {kind:'actual live water shader linear variance/footprint readback',internalSize:[w,h],baseVariance,windFactor:water.uniforms.uWind.value,glintAA:water.uniforms.uGlintAA.value,domains,resolution,regions:regions.map(region=>{
      const values=samples[region.name].data,unresolved=[],pixel=[],shutter=[],footprint=[],extraFraction=[],lods=domains.map(()=>[]);let invalid=0;
      for(let i=0;i<values.length;i+=4){const a=values[i],b=values[i+1],c=values[i+2],f=values[i+3];if(!Number.isFinite(a+b+c+f)||f<=0){invalid++;continue;}unresolved.push(a);pixel.push(b);shutter.push(c);footprint.push(f);extraFraction.push((b+c)/Math.max(1e-9,baseVariance+a));for(let j=0;j<domains.length;j++)lods[j].push(Math.min(Math.log2(resolution),Math.max(0,Math.log2(Math.max(.028,f*1.15)*resolution/domains[j]))));}
      return {name:region.name,roi:{x:region.x,y:region.y,width:region.width,height:region.height},invalid,unresolvedVariance:summary(unresolved),pixelVariance:summary(pixel),shutterVariance:summary(shutter),worldPixelFootprintMetres:summary(footprint),switchExtraFractionOfExistingVariance:summary(extraFraction),cascadeLod:lods.map(summary)};
    }),limits:['One auxiliary live-shader draw, not a whole-frame timing measurement.','Use only ROIs known to be visible water; no foreground occluders are drawn in this diagnostic scene.','baseVariance is explicit and must match the live shader constant if its formula changes.','Moment variance versus reference integration must still be judged in directional/temporal context.']};
  },dispose(){target.dispose();reader.dispose();material.dispose();}};
}
