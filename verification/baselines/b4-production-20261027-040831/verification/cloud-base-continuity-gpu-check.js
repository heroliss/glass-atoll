import {deriveWeather} from '../weather.js';

// Actual production density GLSL and production CPU closure. Own probe target
// and3samplers only; never changes live weather, continuity or sampling.
export function runCloudBaseContinuityGPUCheck(THREE,renderer,atmosphere){
  if(!atmosphere?.uniforms?.uCloudBaseContinuity||typeof atmosphere.setCloudBaseContinuity!=='function')throw new Error('Reload the new continuity0 sky before running this fixture');
  const gl=renderer.getContext();if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('Float32 target unavailable');
  const original=atmosphere.captureSnapshot(),clone=v=>v?.isTexture?v:v?.clone?v.clone():Array.isArray(v)?v.map(clone):v;
  const makeState=(profile,shape,flag)=>{const s={...original,uniforms:Object.fromEntries(Object.entries(original.uniforms).map(([k,v])=>[k,clone(v)]))};Object.assign(s.uniforms,{uCloudBase:profile.cloudBase,uCloudTop:profile.cloudTop,uCloudCoverage:profile.coverage,uCloudMoisture:profile.moisture,uCloudShapeBlend:shape,uCloudBaseContinuity:flag});return s;};
  const count=1984,data=new Float32Array(count*4),texture=new THREE.DataTexture(data,count,1,THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
  const uniforms=Object.fromEntries(Object.entries(original.uniforms).map(([k,v])=>[k,{value:clone(v)}]));uniforms.uAuditPoints={value:texture};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;uniform highp sampler2D uAuditPoints;${atmosphere.cloudShadowGLSL}
    void main(){vec3 p=texelFetch(uAuditPoints,ivec2(int(gl_FragCoord.x),0),0).xyz;gl_FragColor=vec4(atmosphereCloudDensity(p,uCloudTime,0.),cloudAltitude(p),0.,1.);}`});
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);scene.add(new THREE.Mesh(geometry,material));
  const target=new THREE.WebGLRenderTarget(count,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false}),previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),vp=new THREE.Vector4(...gl.getParameter(gl.VIEWPORT)),sc=new THREE.Vector4(...gl.getParameter(gl.SCISSOR_BOX)),scTest=gl.isEnabled(gl.SCISSOR_TEST),auto=renderer.autoClear,xr=renderer.xr.enabled,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate,clear=renderer.getClearColor(new THREE.Color()).clone(),alpha=renderer.getClearAlpha();
  const previousMetadata=previous?{viewport:previous.viewport.clone(),scissor:previous.scissor.clone(),scissorTest:previous.scissorTest}:null;
  const checks=[],profiles=[],check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence}),R=6360000,point=(x,h,z)=>[x,Math.sqrt((R+h)**2-x*x-z*z)-R,z];let seed=54139;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const setUniforms=s=>{for(const [key,value]of Object.entries(s.uniforms))uniforms[key].value=clone(value);};
  function draw(state){setUniforms(state);renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);const values=new Float32Array(count*4);renderer.readRenderTargetPixels(target,0,0,count,1,values);return values;}
  try{
    renderer.autoClear=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.state.setScissorTest(false);renderer.setClearColor(0,0);
    for(const [name,input]of [['fair',{temperature:29,humidity:.68,coverage:.35,thickness:950}],['humid',{temperature:28,humidity:.95,coverage:.9,thickness:1800}]]){
      const p=deriveWeather(input),H=p.thickness,searchState=makeState(p,2,0);let best={mass:-1,x:0,z:0};
      atmosphere.withSnapshot(searchState,()=>{for(let z=-12000;z<=12000;z+=750)for(let x=-12000;x<=12000;x+=750){let mass=0;for(const h of [.15,.3,.45,.6])mass+=atmosphere.cloudDensityAt(point(x,p.cloudBase+h*H,z));if(mass>best.mass)best={mass,x,z};}});
      const points=[],meta=[];for(const [ax,az]of [[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2]])for(let i=0;i<64;i++){const d=(i/63-.5)*3000,x=best.x+ax*d,z=best.z+az*d;for(const epsilon of [-.01,.001,.01,.1,1,10,.052*H,H-.01,H+.01]){points.push(point(x,p.cloudBase+epsilon,z));meta.push({epsilon});}}
      while(points.length<count){const h=p.cloudBase+(-.01+random()*1.02)*H;points.push(point(best.x+(random()-.5)*3000,h,best.z+(random()-.5)*3000));meta.push({epsilon:h-p.cloudBase});}
      for(let i=0;i<count;i++){data.set(points[i],i*4);data[i*4+3]=1;}texture.needsUpdate=true;
      const uploaded=points.map((_,i)=>Array.from(data.subarray(i*4,i*4+3))),stats=[];
      for(const shape of [0,1,1.5,2]){
        const values=[],cpu=[];for(const flag of [0,1]){const state=makeState(p,shape,flag);values.push(draw(state));cpu.push(atmosphere.withSnapshot(state,()=>uploaded.map(q=>atmosphere.cloudDensityAt(q))));}
        let nonfinite=0,negative=0,maxError=0,error2=0,increases=0,legacyDifferences=0,highDifferences=0,nearA=0,nearB=0;
        for(let flag=0;flag<2;flag++)for(let i=0;i<count;i++){const v=values[flag][i*4],error=Math.abs(v-cpu[flag][i]);nonfinite+=!Number.isFinite(v);negative+=v<0;maxError=Math.max(maxError,error);error2+=error*error;}
        for(let i=0;i<count;i++){const A=values[0][i*4],B=values[1][i*4],altitude=values[1][i*4+1],h=(altitude-Math.fround(p.cloudBase))/Math.fround(H);increases+=B>A+2e-6;if(shape<=1)legacyDifferences+=A!==B;if(h>=.052+2e-6)highDifferences+=A!==B;if(meta[i].epsilon>0&&meta[i].epsilon<=.01){nearA=Math.max(nearA,A);nearB=Math.max(nearB,B);}}
        const rms=Math.sqrt(error2/(2*count));check(`${name}_shape${shape}_actual_GPU_CPU_baseLOD_finite_parity`,nonfinite===0&&negative===0&&maxError<.01&&rms<.002,{points:count,nonfinite,negative,maxAbsoluteError:maxError,rmsAbsoluteError:rms,tolerance:{maximum:.01,rms:.002}});
        check(`${name}_shape${shape}_GPU_density_does_not_increase_and_high_layer_unchanged`,increases===0&&highDifferences===0,{increases,highDifferences});
        if(shape<=1)check(`${name}_legacy_shape${shape}_GPU_flag_preserves_pixels_bitwise`,legacyDifferences===0,{different:legacyDifferences});
        if(shape===2)check(`${name}_C2_GPU_removes_actual_inner_base_jump`,nearA>.001&&nearB<1e-5,{maximumLegacyFirstCentimetre:nearA,maximumCandidateFirstCentimetre:nearB,scope:'actual uploadedFloat32 spherical positions;1e-5 allows highp coordinate rounding, not a display threshold'});
        stats.push({shape,nonfinite,negative,maxError,rms,increases,legacyDifferences,highDifferences,nearA,nearB});
      }
      profiles.push({name,weather:p,best,stats});
    }
    check('probe_uses_only3samplers_within_actual_fragment_limit',gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)>=3,{probeSamplerCount:3,actualFragmentLimit:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)});
  }finally{
    target.dispose();texture.dispose();geometry.dispose();material.dispose();
    if(previous){previous.viewport.copy(vp);previous.scissor.copy(sc);previous.scissorTest=scTest;}renderer.setRenderTarget(previous,face,mip);if(previous){previous.viewport.copy(previousMetadata.viewport);previous.scissor.copy(previousMetadata.scissor);previous.scissorTest=previousMetadata.scissorTest;}
    renderer.setClearColor(clear,alpha);renderer.autoClear=auto;renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;renderer.state.viewport(vp);renderer.state.scissor(sc);renderer.state.setScissorTest(scTest);
  }
  const current=atmosphere.captureSnapshot();check('live_continuity_shape_snapshot_and_renderer_state_restored',current.cloudDensityKey===original.cloudDensityKey&&current.uniforms.uCloudBaseContinuity===original.uniforms.uCloudBaseContinuity&&renderer.getRenderTarget()===previous&&Array.from(gl.getParameter(gl.VIEWPORT)).every((v,i)=>v===vp.getComponent(i))&&Array.from(gl.getParameter(gl.SCISSOR_BOX)).every((v,i)=>v===sc.getComponent(i))&&gl.isEnabled(gl.SCISSOR_TEST)===scTest);
  return{date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,profiles,scope:'actual shared production density GLSL vs production CPU closure in ownedFloat32 target; live snapshot preserved',limits:['No whole-sky or island visual/performance acceptance','Uses same3D/weather textures; CPU/GPU parity is formula+precision validation, not an independent cloud model','No new texture sampler added to runtime; this independent probe uses3samplers only','Candidate remains default0 until parent visual/GPU approval']};
}
