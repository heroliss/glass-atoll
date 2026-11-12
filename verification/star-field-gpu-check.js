import {starFieldGLSL} from '../star-field.js';
// Uses actual uploaded catalogue/lookup textures, shared production GLSL and
// isolated Float32 point-only output; never creates or controls a browser.
export async function runStarFieldCheck(THREE,renderer,atmosphere){
  await atmosphere.ready;
  const source=atmosphere.uniforms;if(source.uStarCatalogueReady.value!==1)return {status:'failed',reason:'Catalogue not loaded'};
  const points=source.uStarCatalogue.value.image.data,pointCount=atmosphere.getNightState().starField.pointCount;
  let brightest=0,dim=0,seam=0,seamScore=Infinity;
  for(let i=0;i<pointCount;i++){
    if(points[i*12+7]<points[brightest*12+7])brightest=i;
    if(Math.abs(points[i*12+7]-7.5)<Math.abs(points[dim*12+7]-7.5))dim=i;
    if(points[i*12+7]>8.5)continue;
    const a=[0,1,2].map(c=>Math.abs(points[i*12+c])).sort((a,b)=>b-a),score=a[0]-a[1];
    if(score<seamScore){seamScore=score;seam=i;}
  }
  const selected=[brightest,dim,seam],size=64,delta=.0004;
  const saved={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),auto:renderer.autoClear,tone:renderer.toneMapping};
  const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const uniforms=Object.fromEntries(Object.entries(source).filter(([k])=>k.startsWith('uStar')).map(([k,u])=>[k,{value:u.value?.clone?.()??u.value}]));
  Object.assign(uniforms,{testDirection:{value:new THREE.Vector3()},testEast:{value:new THREE.Vector3()},testNorth:{value:new THREE.Vector3()},testPhase:{value:new THREE.Vector2()},testOutputScale:{value:1}});
  uniforms.uStarDiffuseScale.value=0;uniforms.uStarTwinkle.value=0;uniforms.uStarF0.value=1e-4;
  const material=new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,toneMapped:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;uniform vec3 testDirection,testEast,testNorth;uniform vec2 testPhase;uniform float testOutputScale;${starFieldGLSL}
    void main(){vec2 p=(gl_FragCoord.xy-vec2(32.)-testPhase)*.0004;vec3 ray=normalize(testDirection+testEast*p.x+testNorth*p.y);vec3 c=catalogueStellarRadiance(ray,vec2(.5),vec2(0.),vec2(0.),1.);gl_FragColor=vec4(c*testOutputScale,1.);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material),scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(mesh);const pixels=new Float32Array(size*size*4),frames=[],checks=[];
  const profiles=[];
  try{
    renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(target);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);
    for(const index of selected)for(const year of [0,26.82,200])for(const phase of [[0,0],[.23,.41]]){
      const k=index*12,d=new THREE.Vector3(points[k],points[k+1],points[k+2]).addScaledVector(new THREE.Vector3(points[k+4],points[k+5],points[k+6]),year).normalize();
      const east=new THREE.Vector3().crossVectors(Math.abs(d.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),d).normalize(),north=new THREE.Vector3().crossVectors(d,east).normalize();
      uniforms.testDirection.value.copy(d);uniforms.testEast.value.copy(east);uniforms.testNorth.value.copy(north);uniforms.testPhase.value.set(...phase);uniforms.uStarYears.value=year;uniforms.uStarDebugIndex.value=index;
      renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
      const integral=[0,0,0];let invalid=0;const profile=[];
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const p=(x+.5-32-phase[0])*delta,q=(y+.5-32-phase[1])*delta,omega=delta*delta/Math.pow(1+p*p+q*q,1.5);
        for(let c=0;c<3;c++){const value=pixels[(y*size+x)*4+c];if(!Number.isFinite(value)||value< -1e-5)invalid++;integral[c]+=value*omega;}
        if(year===0&&phase[0]===0)profile.push((pixels[(y*size+x)*4]*.2126+pixels[(y*size+x)*4+1]*.7152+pixels[(y*size+x)*4+2]*.0722));
      }
      const expected=[0,1,2].map(c=>points[k+8+c]*Math.pow(10,-.4*points[k+7])*uniforms.uStarF0.value),error=Math.max(...integral.map((v,c)=>Math.abs(v/expected[c]-1)));
      frames.push({index,magnitude:points[k+7],year,phase,integralRGB:integral,expectedRGB:expected,maxRelativeError:error,invalid});
      if(profile.length&&index!==seam){const total=profile.reduce((s,v)=>s+v,0);profiles.push({index,values:profile.map(v=>v/total)});}
    }
    checks.push({id:'production_catalogue_shader_is_finite',passed:frames.every(f=>f.invalid===0)});
    checks.push({id:'point_flux_preserved_over_phase_epoch_and_cube_face_boundary',passed:frames.every(f=>f.maxRelativeError<.02),maximumRelativeError:Math.max(...frames.map(f=>f.maxRelativeError)),limit:.02});
    const profileError=profiles.length>=2?Math.max(...profiles[0].values.map((v,i)=>Math.abs(v-profiles[1].values[i]))):Infinity;
    checks.push({id:'dim_m7p5_and_bright_star_have_same_normalized_psf',passed:profileError<.004,maximumNormalizedPixelDifference:profileError});
    checks.push({id:'test_includes_actual_cube_face_seam_star',passed:seamScore<.001,axisDifference:seamScore,index:seam});
    return {status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,frames,limits:['Actual production GLSL + uploaded data, isolated Float32 without clouds/air/display/DOF','Full scene cloud occlusion, HDR chain, all view footprints and performance still require root visual/runtime acceptance']};
  }finally{renderer.setRenderTarget(saved.target);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.test);renderer.autoClear=saved.auto;renderer.toneMapping=saved.tone;target.dispose();material.dispose();mesh.geometry.dispose();}
}
