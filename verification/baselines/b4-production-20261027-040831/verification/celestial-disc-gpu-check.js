// Root may run in the existing GL context. No browser is created here.
import {celestialDiscGLSL} from '../night-sky.js';
export function runCelestialDiscCheck(THREE,renderer){
  const saved={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,tone:renderer.toneMapping};
  const size=128,target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const uniforms={roll:{value:0},offset:{value:new THREE.Vector2()},radiusPixels:{value:9}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;uniform float roll,radiusPixels;uniform vec2 offset;${celestialDiscGLSL}
    void main(){vec2 p=(gl_FragCoord.xy-vec2(64.)-offset)/1800.;float c=cos(roll),s=sin(roll);p=mat2(c,s,-s,c)*p;vec3 ray=normalize(vec3(p,1.));float mask=celestialDiscCoverage(ray,vec3(0.,0.,1.),atan(radiusPixels/1800.));gl_FragColor=vec4(vec3(mask),1.);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material),scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(mesh);
  const checks=[],frames=[];const read=new Float32Array(size*size*4);let maxAreaError=0,maxCentroidError=0,minFlux=Infinity,maxFlux=0;
  try{
    renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(target);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);
    for(const radius of [2.5,5,9,17])for(const angle of [0,Math.PI/8,Math.PI/4])for(const phase of [[0,0],[.23,.41]]){
      uniforms.roll.value=angle;uniforms.offset.value.set(...phase);uniforms.radiusPixels.value=radius;renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,read);
      let flux=0,xsum=0,ysum=0,invalid=0;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){const f=read[(y*size+x)*4];if(!Number.isFinite(f)||f<0||f>1)invalid++;flux+=f;xsum+=f*(x+.5);ysum+=f*(y+.5);}
      const expected=Math.PI*radius*radius,error=Math.abs(flux/expected-1),centre=Math.hypot(xsum/flux-64-phase[0],ysum/flux-64-phase[1]);
      frames.push({radius,roll:angle,phase,flux,expectedArea:expected,relativeAreaError:error,centroidErrorPixels:centre,invalid});maxAreaError=Math.max(maxAreaError,error);maxCentroidError=Math.max(maxCentroidError,centre);
      if(radius===9){minFlux=Math.min(minFlux,flux);maxFlux=Math.max(maxFlux,flux);}
    }
    checks.push({id:'all_masks_finite_and_bounded',passed:frames.every(f=>f.invalid===0)});
    checks.push({id:'disc_integral_within_small_disc_quadrature_tolerance',passed:maxAreaError<.045,maxAreaError,limit:.045});
    checks.push({id:'subpixel_centroid_is_continuous',passed:maxCentroidError<.09,maxCentroidError,limitPixels:.09});
    checks.push({id:'L2_coverage_has_no_roll_dependent_flux',passed:(maxFlux-minFlux)/((maxFlux+minFlux)/2)<.01,relativeVariation:(maxFlux-minFlux)/((maxFlux+minFlux)/2)});
    return {status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,frames,limits:['Actual shared sky/Moon angular-SDF mask in isolated Float32 RT; not HDR post-processing or visual sky acceptance','Smoothstep L2 coverage approximates square-pixel area; it is not exact subpixel disc integration']};
  }finally{renderer.setRenderTarget(saved.target);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.autoClear=saved.autoClear;renderer.toneMapping=saved.tone;target.dispose();material.dispose();mesh.geometry.dispose();}
}
