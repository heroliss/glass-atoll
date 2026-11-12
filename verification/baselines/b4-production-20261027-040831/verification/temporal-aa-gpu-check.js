// Functional readback of the actual selective resolve shader. Run between
// frame benchmarks; this is not a visual alias/ghosting or performance verdict.
export function runTemporalResolveCheck(THREE,renderer,fragmentShader){
  const n=24,near=.1,far=100,depthMetres=10;
  const camera=new THREE.PerspectiveCamera(60,1,near,far);camera.updateMatrixWorld();
  const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const encodedDepth=(far-near*far/depthMetres)/(far-near);
  const resources=[],checks=[];
  const target=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,depthBuffer:false,count:/tHistoryMetadata/.test(fragmentShader)?2:1});resources.push(target);
  const dataTexture=(data,format=THREE.RGBAFormat)=>{const t=new THREE.DataTexture(data,n,n,format,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;resources.push(t);return t;};
  const currentData=new Float32Array(n*n*4),historyData=new Float32Array(n*n*4),depthData=new Float32Array(n*n).fill(encodedDepth),ageData=new Float32Array(n*n);
  const current=dataTexture(currentData),history=dataTexture(historyData),depth=dataTexture(depthData,THREE.RedFormat),age=dataTexture(ageData,THREE.RedFormat);
  const uniforms={tCurrent:{value:current},tCurrentDepth:{value:depth},tHistory:{value:history},tHistoryMetadata:{value:age},uSize:{value:new THREE.Vector2(n,n)},uInverseCurrentVP:{value:vp.clone().invert()},uPreviousVP:{value:vp.clone()},uPreviousView:{value:camera.matrixWorldInverse.clone()},uNear:{value:near},uFar:{value:far},uHistoryValid:{value:1},uHistoryWeight:{value:.84},uWind:{value:0},uMotionDelta:{value:0},uProjectionScale:{value:100},uVegetationEnabled:{value:1},uWaterEnabled:{value:0}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader});resources.push(material);
  const geometry=new THREE.PlaneGeometry(2,2);resources.push(geometry);
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,material));
  const readCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),buffer=new Float32Array(n*n*4);
  const oldTarget=renderer.getRenderTarget(),oldFace=renderer.getActiveCubeFace(),oldMip=renderer.getActiveMipmapLevel();
  const oldViewport=renderer.getViewport(new THREE.Vector4()),oldScissor=renderer.getScissor(new THREE.Vector4()),oldScissorTest=renderer.getScissorTest(),oldAutoClear=renderer.autoClear;
  const fill=(array,fn)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++)array.set(fn(x,y),(y*n+x)*4);};
  function run(){current.needsUpdate=history.needsUpdate=age.needsUpdate=true;renderer.setRenderTarget(target);renderer.render(scene,readCamera);renderer.readRenderTargetPixels(target,0,0,n,n,buffer);return buffer.slice();}
  function check(id,result,expected,tolerance=2e-5){let error=0,nonFinite=0;for(let i=0;i<result.length;i+=4)for(let c=0;c<3;c++){const v=result[i+c];if(!Number.isFinite(v))nonFinite++;error=Math.max(error,Math.abs(v-expected(i/4,c)));}checks.push({id,passed:nonFinite===0&&error<=tolerance,maximumRGBError:error,nonFinite,tolerance});}
  try{
    fill(currentData,()=>[.4,.6,.2,1]);fill(historyData,()=>[30,0,0,depthMetres]);
    check('untagged_water_sky_sand_bypass_history_exactly',run(),(_,c)=>[.4,.6,.2][c]);
    ageData.fill(1/255);
    fill(currentData,()=>[2,4,1,.25]);fill(historyData,()=>[2,4,1,depthMetres]);
    check('linear_hdr_above_one_survives_without_tone_mapping',run(),(_,c)=>[2,4,1][c]);
    fill(currentData,()=>[.4,.6,.2,.25]);fill(historyData,()=>[30,0,0,depthMetres]);uniforms.uHistoryValid.value=0;
    check('first_frame_does_not_read_uninitialized_history',run(),(_,c)=>[.4,.6,.2][c]);uniforms.uHistoryValid.value=1;
    fill(historyData,()=>[30,0,0,50]);
    check('disoccluded_depth_rejects_stale_foreground_history',run(),(_,c)=>[.4,.6,.2][c]);
    fill(historyData,()=>[30,0,0,depthMetres]);uniforms.uPreviousVP.value.elements[12]+=100;
    check('offscreen_camera_reprojection_uses_current_frame',run(),(_,c)=>[.4,.6,.2][c]);uniforms.uPreviousVP.value.copy(vp);
    check('neighborhood_variance_box_removes_foreign_history_colour',run(),(_,c)=>[.4,.6,.2][c]);
    fill(currentData,(x,y)=>[.4,.6,.2,x>8&&x<15&&y>8&&y<15?.25:1]);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)ageData[y*n+x]=x>=7&&x<=16&&y>=7&&y<=16?1/255:0;
    const local=run();let outsideError=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(x<7||x>16||y<7||y>16)for(let c=0;c<3;c++)outsideError=Math.max(outsideError,Math.abs(local[(y*n+x)*4+c]-[.4,.6,.2][c]));
    checks.push({id:'one_pixel_mask_dilation_does_not_spread_across_scene',passed:outsideError<2e-5,maximumOutsideError:outsideError});
    fill(currentData,x=>{const v=.2+x*.035;return[v,v*.9,v*.8,.25];});fill(historyData,x=>{const v=.2+x*.035+.02;return[v,v*.9,v*.8,depthMetres];});
    ageData.fill(1/255);
    uniforms.uMotionDelta.value=.04;uniforms.uWind.value=0;const slow=run();uniforms.uWind.value=5;const fast=run();
    const at=((n/2)*n+n/2)*4,desired=currentData[at],slowError=Math.abs(slow[at]-desired),fastError=Math.abs(fast[at]-desired);
    checks.push({id:'high_wind_increases_current_frame_response',passed:slowError>1e-5&&fastError<slowError*.5,slowWindError:slowError,highWindError:fastError});
  }finally{
    renderer.setRenderTarget(oldTarget,oldFace,oldMip);renderer.autoClear=oldAutoClear;
    for(const resource of resources)resource.dispose();
  }
  const rendererStateRestored=renderer.getRenderTarget()===oldTarget&&renderer.getActiveCubeFace()===oldFace&&renderer.getActiveMipmapLevel()===oldMip&&renderer.getViewport(new THREE.Vector4()).equals(oldViewport)&&renderer.getScissor(new THREE.Vector4()).equals(oldScissor)&&renderer.getScissorTest()===oldScissorTest&&renderer.autoClear===oldAutoClear;
  checks.push({id:'renderer_target_face_mip_viewport_scissor_restored',passed:rendererStateRestored});
  return {kind:'actual selective temporal resolve GPU functional readback',passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,fixture:{width:n,height:n,linearDepthMetres:depthMetres},checks,limits:['Synthetic GPU functionality only; actual foliage aliasing, wind/camera ghosting and frame time need scene acceptance.','Camera-depth reprojection has no moving-object motion vectors.']};
}
