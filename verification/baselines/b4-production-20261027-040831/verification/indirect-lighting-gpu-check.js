// Actual Float32 shader lookup parity; import only from an already initialized
// application. This never navigates a browser or changes runtime GI settings.
export async function runIndirectLightingGPUCheck(THREE,renderer,indirect){
  await indirect.ready;
  const points=[[-20,1,0],[-10,8,-5],[0,2,0],[15,1,8],[25,5,-12],[0,15,0],[-34,.2,-24],[34,18,24],[39,2,0],[100,2,0]],normals=[[0,1,0],[0,-1,0],[1,0,0],[0,0,1]];
  const rows=[];for(const p of points)for(const n of normals)rows.push({p,n});
  const positions=rows.map(r=>new THREE.Vector3(...r.p)),directions=rows.map(r=>new THREE.Vector3(...r.n));
  const target=new THREE.WebGLRenderTarget(rows.length,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const material=new THREE.ShaderMaterial({uniforms:{...indirect.uniforms,uProbePositions:{value:positions},uProbeNormals:{value:directions}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`${indirect.glsl}\nuniform vec3 uProbePositions[40],uProbeNormals[40];void main(){int i=int(gl_FragCoord.x);gl_FragColor=vec4(getIndirectIrradiance(uProbePositions[i],uProbeNormals[i]),1.);}`});
  const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.frustumCulled=false;scene.add(mesh);
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,clearColor:renderer.getClearColor(new THREE.Color()),clearAlpha:renderer.getClearAlpha(),xr:renderer.xr.enabled};
  const pixels=new Float32Array(rows.length*4);let maxError=0,nonFinite=0,rms=0;
  try{
    renderer.xr.enabled=false;renderer.autoClear=true;renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.setViewport(0,0,rows.length,1);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,rows.length,1,pixels);
    for(let i=0;i<rows.length;i++){
      const cpu=indirect.sampleIrradiance(rows[i].p,rows[i].n),gpu=Array.from(pixels.slice(i*4,i*4+3));rows[i]={...rows[i],cpu,gpu};
      for(let c=0;c<3;c++){if(!Number.isFinite(gpu[c]))nonFinite++;const e=Math.abs(cpu[c]-gpu[c]);maxError=Math.max(maxError,e);rms+=e*e;}
    }
  }finally{
    renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.autoClear=saved.autoClear;renderer.setClearColor(saved.clearColor,saved.clearAlpha);renderer.xr.enabled=saved.xr;mesh.geometry.dispose();material.dispose();target.dispose();
  }
  return {passed:nonFinite===0&&maxError<2e-4,samples:rows.length,nonFinite,maxError,rmsError:Math.sqrt(rms/(rows.length*3)),tolerance:2e-4,rows,scope:'actual identical uniform bank and GLSL versus CPU lookup; not a path-traced lighting reference or frame-time benchmark'};
}
