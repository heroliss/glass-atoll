// Diagnostic sequences for the actual selective resolve shader. These fixtures
// isolate metadata interpolation and a one-frame subpixel coverage loss; they
// do not claim real-scene motion-vector or perceptual acceptance.
export function runTemporalSequenceCheck(THREE,renderer,fragmentShader){
  const n=32,near=.1,far=1000,z=230,resources=[],checks=[];
  const camera=new THREE.PerspectiveCamera(54.43222311461495,1,near,far);camera.updateMatrixWorld();
  const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const encoded=(far-near*far/z)/(far-near);
  const makeTexture=(data,format=THREE.RGBAFormat,filter=THREE.NearestFilter)=>{const t=new THREE.DataTexture(data,n,n,format,THREE.FloatType);t.minFilter=t.magFilter=filter;t.needsUpdate=true;resources.push(t);return t;};
  const currentData=new Float32Array(n*n*4),historyData=new Float32Array(n*n*4),depthData=new Float32Array(n*n).fill(encoded),ageData=new Float32Array(n*n);
  const current=makeTexture(currentData),history=makeTexture(historyData,THREE.RGBAFormat,THREE.LinearFilter),depth=makeTexture(depthData,THREE.RedFormat),age=makeTexture(ageData,THREE.RedFormat);
  const usesAge=/tHistoryMetadata/.test(fragmentShader);
  const target=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,depthBuffer:false,count:usesAge?2:1});resources.push(target);
  if(usesAge){const t=target.textures[1];t.type=THREE.UnsignedByteType;t.format=THREE.RedFormat;t.internalFormat='R8';t.minFilter=t.magFilter=THREE.NearestFilter;}
  const uniforms={tCurrent:{value:current},tCurrentDepth:{value:depth},tHistory:{value:history},tHistoryMetadata:{value:age},uSize:{value:new THREE.Vector2(n,n)},uInverseCurrentVP:{value:vp.clone().invert()},uPreviousVP:{value:vp.clone()},uPreviousView:{value:camera.matrixWorldInverse.clone()},uNear:{value:near},uFar:{value:far},uHistoryValid:{value:1},uHistoryWeight:{value:.84},uWind:{value:0},uMotionDelta:{value:1/60},uProjectionScale:{value:1256.111111},uVegetationEnabled:{value:1},uWaterEnabled:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader});resources.push(material);
  const geometry=new THREE.PlaneGeometry(2,2);resources.push(geometry);const scene=new THREE.Scene(),quad=new THREE.Mesh(geometry,material);scene.add(quad);
  const view=new THREE.OrthographicCamera(-1,1,1,-1,0,1),output=new Float32Array(n*n*4),metadata=new Uint8Array(n*n);
  // QA-only copy: normalized R8 is sampled into RGBA32F so readback uses the
  // portable RGBA/FLOAT path rather than implementation-specific RED reads.
  const metadataCopyTarget=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,depthBuffer:false});resources.push(metadataCopyTarget);
  const metadataCopy=new THREE.ShaderMaterial({uniforms:{tMetadata:{value:usesAge?target.textures[1]:current}},depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tMetadata;void main(){gl_FragColor=vec4(texture2D(tMetadata,vUv).r,0.,0.,1.);}'});resources.push(metadataCopy);
  const metadataRead=new Float32Array(n*n*4);
  const previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),autoClear:renderer.autoClear};
  function fill(fn){for(let y=0;y<n;y++)for(let x=0;x<n;x++)currentData.set(fn(x,y),(y*n+x)*4);}
  function draw(){current.needsUpdate=history.needsUpdate=depth.needsUpdate=age.needsUpdate=true;quad.material=material;renderer.setRenderTarget(target);renderer.render(scene,view);renderer.readRenderTargetPixels(target,0,0,n,n,output);if(usesAge){quad.material=metadataCopy;renderer.setRenderTarget(metadataCopyTarget);renderer.render(scene,view);renderer.readRenderTargetPixels(metadataCopyTarget,0,0,n,n,metadataRead);for(let i=0;i<n*n;i++)metadata[i]=Math.round(metadataRead[i*4]*255);quad.material=material;}return output;}
  const std=a=>{const m=a.reduce((s,x)=>s+x,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);};
  let boundary,sequence;
  try{
    // Current geometry is tagged at both probes. The history colour is smooth
    // across an edge, while its validity/depth changes from z to zero. A half
    // pixel camera reprojection must not invent a depth z/2 and reject the edge.
    fill(x=>{const c=.2+x*.02;return[c,c*.9,c*.8,.25];});
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,c=.2+x*.02+.01;historyData.set([c,c*.9,c*.8,x<16?z:0],i);ageData[y*n+x]=x<16?1/255:0;}
    // Clip x is divided by homogeneous w (=z at this fixture), so include z.
    // Omitting it would move by only 0.5/z pixels and fail to exercise filtering.
    uniforms.uPreviousVP.value.elements[12]+=(z/n);draw();
    const inside=(16*n+14)*4,edge=(16*n+15)*4,insideChange=Math.abs(output[inside]-currentData[inside]),edgeChange=Math.abs(output[edge]-currentData[edge]);
    boundary={halfPixelReprojection:true,insideHistoryContribution:insideChange,edgeHistoryContribution:edgeChange,edgeToInsideRatio:edgeChange/Math.max(insideChange,1e-10),falseRejectionObserved:insideChange>1e-4&&edgeChange<insideChange*.1};
    checks.push({id:'depth_validity_is_not_linearly_blended_with_zero',passed:!boundary.falseRejectionObserved,...boundary});
    uniforms.uPreviousVP.value.copy(vp);historyData.fill(0);ageData.fill(0);uniforms.uHistoryValid.value=0;
    const raw=[],resolved=[],alpha=[],ages=[];
    for(let frame=0;frame<48;frame++){
      // One isolated thin leaflet receives one of four coverage samples, then
      // misses all samples for one frame out of four. RGB and alpha are exactly
      // the same multisample arithmetic used by the runtime coverage tag.
      const present=frame%4!==2;
      fill((x,y)=>{const covered=present&&x===15&&y>=8&&y<=23?.25:0,c=.8*(1-covered)+.3*covered;return[c,c*.9,c*.8,1-.75*covered];});
      draw();const p=(16*n+15)*4;
      if(frame>=8){raw.push(currentData[p]);resolved.push(output[p]);alpha.push(output[p+3]);ages.push(usesAge?metadata[16*n+15]:null);}
      historyData.set(output);if(usesAge)for(let i=0;i<n*n;i++)ageData[i]=metadata[i]/255;
      uniforms.uHistoryValid.value=1;
    }
    sequence={frames:48,measuredAfterWarmup:40,coverageLossPeriod:4,rawStd:std(raw),resolvedStd:std(resolved),ratio:std(resolved)/std(raw),zeroDepthFrames:alpha.filter(v=>v<=0).length,raw,resolved,historyDepth:alpha,metadata:usesAge?ages:null};
    checks.push({id:'one_frame_coverage_loss_keeps_bounded_history',passed:sequence.zeroDepthFrames===0&&sequence.resolvedStd<sequence.rawStd*.9,zeroDepthFrames:sequence.zeroDepthFrames,stdRatio:sequence.ratio});
    // A vanished feature must not be retained indefinitely.
    const vanished=[];
    for(let frame=0;frame<7;frame++){
      fill(()=>[.8,.72,.64,1]);draw();const p=(16*n+15)*4;vanished.push({frame:frame+1,rgb:output[p],depth:output[p+3],age:usesAge?metadata[16*n+15]:null});historyData.set(output);if(usesAge)for(let i=0;i<n*n;i++)ageData[i]=metadata[i]/255;
    }
    checks.push({id:'vanished_leaf_history_expires_within_three_missing_frames',passed:vanished[2].depth===0&&Math.abs(vanished[2].rgb-.8)<2e-5,frames:vanished});
    // The bridge must not smear a leaf during rapid camera movement or across
    // a new foreground occluder, even when its previous metadata is valid.
    const p=(16*n+15)*4;
    historyData.fill(0);ageData.fill(0);historyData.set([.3,.27,.24,z],p);ageData[16*n+15]=1/255;
    fill(()=>[.8,.72,.64,1]);uniforms.uPreviousVP.value.elements[12]+=4*z/n;draw();
    checks.push({id:'missing_coverage_bridge_rejects_two_pixel_camera_motion',passed:output[p+3]===0&&Math.abs(output[p]-.8)<2e-5,depth:output[p+3],rgb:output[p]});
    uniforms.uPreviousVP.value.copy(vp);depthData.fill((far-near*far/100)/(far-near));draw();
    checks.push({id:'missing_coverage_bridge_rejects_new_foreground_occluder',passed:output[p+3]===0&&Math.abs(output[p]-.8)<2e-5,depth:output[p+3],rgb:output[p]});
  }finally{renderer.setRenderTarget(previous.target,previous.face,previous.mip);renderer.autoClear=previous.autoClear;for(const r of resources)r.dispose();}
  checks.push({id:'renderer_state_restored',passed:renderer.getRenderTarget()===previous.target&&renderer.getActiveCubeFace()===previous.face&&renderer.getActiveMipmapLevel()===previous.mip&&renderer.getViewport(new THREE.Vector4()).equals(previous.viewport)&&renderer.getScissor(new THREE.Vector4()).equals(previous.scissor)&&renderer.getScissorTest()===previous.test&&renderer.autoClear===previous.autoClear});
  return {kind:'actual GPU temporal metadata and coverage-loss diagnostic sequences',usesAgeMetadata:usesAge,passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,boundary,sequence,limits:['Synthetic MSAA arithmetic and camera reprojection fixture; real wind/camera video still required.','A fixture failure identifies this mechanism, not all sources of observed foliage flicker.']};
}
