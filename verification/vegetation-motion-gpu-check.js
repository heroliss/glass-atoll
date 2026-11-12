import {vegetationWindGLSL} from '../vegetation.js';
import {deformGroveVertexCPU} from '../vegetation-stability.js';

// Run from the initialized scene, between benchmarks. Never navigates a tab.
export function runVegetationMotionGPUCheck(THREE,renderer,grove,camera,resolveShader,{time=grove.userData.temporalAA.time.value}={}){
  const checks=[],resources=[],gl=renderer.getContext(),saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,clearColor:renderer.getClearColor(new THREE.Color()),clearAlpha:renderer.getClearAlpha(),xr:renderer.xr.enabled};
  const add=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence});
  camera.updateMatrixWorld();grove.updateMatrixWorld(true);
  try{
    renderer.xr.enabled=false;renderer.autoClear=true;renderer.setScissorTest(false);renderer.setClearColor(0,0);
    const source=grove.children.find(m=>/pinnae/i.test(m.name)),g=source.geometry,indices=[],p=new THREE.Vector3();
    const stride=Math.max(1,Math.floor(g.attributes.position.count/1500));
    for(let i=0;i<g.attributes.position.count&&indices.length<32;i+=stride){p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(source.matrixWorld).project(camera);if(Math.abs(p.x)<.95&&Math.abs(p.y)<.95&&p.z>-1&&p.z<1)indices.push(i);}
    if(indices.length<4)throw new Error('Motion check needs at least four visible palm vertices; use the ordinary island view.');
    const count=indices.length,geometry=new THREE.BufferGeometry();resources.push(geometry);
    for(const [name,a]of Object.entries(g.attributes)){if(name==='tangent'||name==='uv'||name==='normal'||name==='color')continue;const out=new Float32Array(count*a.itemSize);indices.forEach((v,j)=>out.set(a.array.subarray(v*a.itemSize,(v+1)*a.itemSize),j*a.itemSize));geometry.setAttribute(name,new THREE.BufferAttribute(out,a.itemSize));}
    geometry.setAttribute('aProbeClip',new THREE.Float32BufferAttribute(indices.flatMap((_,i)=>[-1+2*(i+.5)/count,0]),2));
    const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),previousCamera=camera.clone();previousCamera.position.x+=.25;previousCamera.updateMatrixWorld();
    const movedVP=new THREE.Matrix4().multiplyMatrices(previousCamera.projectionMatrix,previousCamera.matrixWorldInverse);
    const direction=grove.userData.windDirection.value.clone(),uniforms={uGroveTime:{value:time},uGroveWindStrength:{value:1.8},uGroveWindDebug:{value:1},uGroveWindDirection:{value:direction},uTestTime:{value:time},uTestPreviousTime:{value:time},uTestWind:{value:1.8},uTestPreviousWind:{value:1.8},uTestVP:{value:vp.clone()},uTestPreviousVP:{value:vp.clone()},uTestModel:{value:source.matrixWorld.clone()},uOutputMode:{value:0}};
    const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
      vertexShader:`${vegetationWindGLSL}\nattribute vec2 aProbeClip;uniform float uTestTime,uTestPreviousTime,uTestWind,uTestPreviousWind;uniform mat4 uTestVP,uTestPreviousVP,uTestModel;varying vec3 vTestPosition;varying vec3 vTestMotion;
      void main(){mat3 a,b;vec3 now=groveDeformAt(position,a,uTestTime,uTestWind,uGroveWindDirection);vec3 old=groveDeformAt(position,b,uTestPreviousTime,uTestPreviousWind,uGroveWindDirection);vec4 c=uTestVP*uTestModel*vec4(now,1.);vec4 o=uTestPreviousVP*uTestModel*vec4(old,1.);vTestPosition=now;vTestMotion=vec3((c.xy/c.w-o.xy/o.w)*.5,o.w);gl_Position=vec4(aProbeClip,0.,1.);gl_PointSize=1.;}`,
      fragmentShader:'uniform float uOutputMode;varying vec3 vTestPosition,vTestMotion;void main(){gl_FragColor=vec4(uOutputMode<.5?vTestPosition:vTestMotion,1.);}'});resources.push(material);
    const scene=new THREE.Scene(),points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
    const target=new THREE.WebGLRenderTarget(count,1,{type:THREE.FloatType,depthBuffer:false});resources.push(target);
    const pixels=new Float32Array(count*4),cases=[{id:'zero_wind_has_zero_motion',wind:0,dt:1/30},{id:'wind_debug_zero_has_zero_motion',wind:5,debug:0,dt:1/30},{id:'analytic_wind_1p8_matches_cpu',wind:1.8,dt:1/60},{id:'analytic_wind_5_matches_cpu',wind:5,dt:1/30},{id:'camera_motion_matches_cpu',wind:1.8,dt:0,moved:true},{id:'reset_same_pose_has_zero_motion',wind:1.8,dt:0}];
    for(const test of cases){
      const debug=test.debug??1,oldVP=test.moved?movedVP:vp;uniforms.uGroveWindDebug.value=debug;uniforms.uTestWind.value=uniforms.uTestPreviousWind.value=test.wind;uniforms.uTestPreviousTime.value=time-test.dt;uniforms.uTestPreviousVP.value.copy(oldVP);
      let positionError=0,motionError=0,velocityError=0,nonFinite=0,magnitude=0;
      for(let mode=0;mode<2;mode++){
        uniforms.uOutputMode.value=mode;renderer.setRenderTarget(target);renderer.render(scene,new THREE.Camera());renderer.readRenderTargetPixels(target,0,0,count,1,pixels);
        indices.forEach((index,j)=>{
          const now=deformGroveVertexCPU(g,index,{time,wind:test.wind,windDebug:debug,direction:direction.toArray()}),old=deformGroveVertexCPU(g,index,{time:time-test.dt,wind:test.wind,windDebug:debug,direction:direction.toArray()});
          const c=new THREE.Vector4(...now,1).applyMatrix4(source.matrixWorld).applyMatrix4(vp),o=new THREE.Vector4(...old,1).applyMatrix4(source.matrixWorld).applyMatrix4(oldVP),expected=mode===0?now:[(c.x/c.w-o.x/o.w)*.5,(c.y/c.w-o.y/o.w)*.5,o.w];
          for(let k=0;k<3;k++){const value=pixels[j*4+k];if(!Number.isFinite(value))nonFinite++;const error=Math.abs(value-expected[k]);if(mode===0)positionError=Math.max(positionError,error);else{motionError=Math.max(motionError,error);if(k<2)velocityError=Math.max(velocityError,error);}}
          if(mode===1)magnitude=Math.max(magnitude,Math.hypot(pixels[j*4],pixels[j*4+1]));
        });
      }
      const zero=test.id.includes('zero_motion'),passed=nonFinite===0&&positionError<.002&&motionError<.002&&velocityError<2e-5&&(!zero||magnitude<2e-6)&&(!test.moved||magnitude>1e-5);
      add(test.id,passed,{samples:count,maximumPositionErrorMetres:positionError,maximumVelocityDepthError:motionError,maximumVelocityUVError:velocityError,maximumVelocityUV:magnitude,nonFinite});
    }

    // Actual multisample MRT resolve: a constant vector must survive a partially
    // covered leaf edge after xyz/alpha normalization, not shrink by coverage.
    const msaa=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType,count:3,samples:Math.min(4,renderer.capabilities.maxSamples),depthBuffer:false});
    msaa.textures[2].format=THREE.RedFormat;msaa.textures[2].internalFormat='R16F';msaa.textures[2].minFilter=msaa.textures[2].magFilter=THREE.NearestFilter;resources.push(msaa);
    const edgeGeometry=new THREE.PlaneGeometry(2,2);resources.push(edgeGeometry);
    const edgeMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'void main(){gl_Position=vec4(position.x*.5+.125,position.y,0.,1.);}',fragmentShader:'layout(location=1) out vec4 velocity;layout(location=2) out float depth;void main(){gl_FragColor=vec4(.2,.4,.1,.25);velocity=vec4(.03,-.02,12.,1.);depth=14.;}'});resources.push(edgeMaterial);
    const edgeScene=new THREE.Scene();edgeScene.add(new THREE.Mesh(edgeGeometry,edgeMaterial));renderer.setRenderTarget(msaa);renderer.render(edgeScene,new THREE.Camera());
    // Sample half-float/R16F through a Float32 copy target. Direct HALF_FLOAT
    // readPixels support is implementation-dependent and is not assumed.
    const copyTarget=new THREE.WebGLRenderTarget(8,8,{type:THREE.FloatType,depthBuffer:false});resources.push(copyTarget);
    const copyUniforms={tMotion:{value:msaa.textures[1]},tDepth:{value:msaa.textures[2]},uDepth:{value:0}};
    const copyMaterial=new THREE.ShaderMaterial({uniforms:copyUniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform highp sampler2D tMotion,tDepth;uniform float uDepth;varying vec2 vUv;void main(){gl_FragColor=uDepth<.5?texture(tMotion,vUv):vec4(texture(tDepth,vUv).r,0.,0.,1.);}'});resources.push(copyMaterial);
    const copyScene=new THREE.Scene();copyScene.add(new THREE.Mesh(edgeGeometry,copyMaterial));renderer.setRenderTarget(copyTarget);renderer.render(copyScene,new THREE.Camera());
    const covered=new Float32Array(8*8*4),currentDepths=new Float32Array(8*8*4);renderer.readRenderTargetPixels(copyTarget,0,0,8,8,covered);copyUniforms.uDepth.value=1;renderer.render(copyScene,new THREE.Camera());renderer.readRenderTargetPixels(copyTarget,0,0,8,8,currentDepths);
    let partial=0,normalizationError=0,currentDepthError=0;
    for(let i=0;i<64;i++){const a=covered[i*4+3];if(a>.01&&a<.99){partial++;for(let c=0;c<3;c++)normalizationError=Math.max(normalizationError,Math.abs(covered[i*4+c]/a-[.03,-.02,12][c]));currentDepthError=Math.max(currentDepthError,Math.abs(currentDepths[i*4]/a-14));}}
    add('actual_msaa_mrt_partial_coverage_recovers_velocity_and_depth',partial>0&&normalizationError<.003&&currentDepthError<.003,{samples:msaa.samples,partiallyCoveredPixels:partial,maximumDecodedError:normalizationError,maximumCurrentDepthError:currentDepthError});

    if(resolveShader){
      const n=24,near=.1,far=100,depth=10,c=new THREE.PerspectiveCamera(60,1,near,far);c.updateMatrixWorld();const matrix=new THREE.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse);
      const data=()=>new Float32Array(n*n*4),currentData=data(),historyData=data(),motionData=data(),motionDepthData=new Float32Array(n*n),depthData=new Float32Array(n*n).fill((far-near*far/depth)/(far-near)),ageData=new Float32Array(n*n).fill(1/255);
      const texture=(array,format=THREE.RGBAFormat)=>{const t=new THREE.DataTexture(array,n,n,format,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;resources.push(t);return t;};
      const current=texture(currentData),history=texture(historyData),motion=texture(motionData),motionDepth=texture(motionDepthData,THREE.RedFormat),depthTex=texture(depthData,THREE.RedFormat),age=texture(ageData,THREE.RedFormat);
      const u={tCurrent:{value:current},tCurrentDepth:{value:depthTex},tHistory:{value:history},tHistoryMetadata:{value:age},tVegetationMotion:{value:motion},tVegetationDepth:{value:motionDepth},uVegetationMotionEnabled:{value:1},uSize:{value:new THREE.Vector2(n,n)},uInverseCurrentVP:{value:matrix.clone().invert()},uPreviousVP:{value:matrix.clone()},uPreviousView:{value:c.matrixWorldInverse.clone()},uNear:{value:near},uFar:{value:far},uHistoryValid:{value:1},uHistoryWeight:{value:.84},uWind:{value:5},uMotionDelta:{value:1/30},uProjectionScale:{value:1152},uVegetationEnabled:{value:1},uWaterEnabled:{value:0}};
      const m=new THREE.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:resolveShader});resources.push(m);
      const plane=new THREE.PlaneGeometry(2,2);resources.push(plane);const s=new THREE.Scene();s.add(new THREE.Mesh(plane,m));const out=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,count:2,depthBuffer:false});resources.push(out);const buffer=new Float32Array(n*n*4),at=(12*n+12)*4;
      function fill(velocity=1/n,previousDepth=depth,coverage=1,historyShift=1){for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,v=.25+x*.01,h=.25+(x+historyShift)*.01;currentData.set([v,v*.9,v*.8,.25],i);historyData.set([h,h*.9,h*.8,depth],i);motionData.set([velocity*coverage,0,previousDepth*coverage,coverage],i);motionDepthData[y*n+x]=depth*coverage;}current.needsUpdate=history.needsUpdate=motion.needsUpdate=motionDepth.needsUpdate=true;}
      function run(){renderer.setRenderTarget(out);renderer.render(s,new THREE.Camera());renderer.readRenderTargetPixels(out,0,0,n,n,buffer);return Array.from(buffer.slice(at,at+3));}
      u.uWind.value=0;fill();const tracked=run(),expected=Array.from(currentData.slice(at,at+3));u.uVegetationMotionEnabled.value=0;const untracked=run();u.uVegetationMotionEnabled.value=1;u.uWind.value=5;
      add('motion_resolve_tracks_one_pixel_wind_translation',Math.max(...tracked.map((v,i)=>Math.abs(v-expected[i])))<3e-5&&Math.abs(untracked[0]-expected[0])>.002,{tracked,expected,untracked});
      // A genuine zero vector must keep valid history even at high wind;
      // it must not inherit the unrelated world-speed guess.
      fill(0,depth,1,.5);const kept=run();add('valid_zero_velocity_does_not_use_global_wind_penalty',kept[0]>expected[0]+.002,{current:expected,output:kept});
      fill(1/n,depth,.25);const partialMotion=run();add('resolve_normalizes_motion_msaa_coverage',Math.max(...partialMotion.map((v,i)=>Math.abs(v-expected[i])))<3e-5,{output:partialMotion,expected});
      depthData.fill(1);depthTex.needsUpdate=true;fill(0,depth,.25,.5);const repaired=run();add('real_current_leaf_depth_repairs_background_msaa_depth',Math.abs(buffer[at+3]-depth)<.002&&repaired[0]>expected[0]+.002,{output:repaired,storedCurrentDepth:buffer[at+3],trueCurrentDepth:depth,mainDepth:far});depthData.fill((far-near*far/depth)/(far-near));depthTex.needsUpdate=true;
      fill(1/n,50);const rejected=run();add('motion_previous_depth_rejects_disocclusion',Math.max(...rejected.map((v,i)=>Math.abs(v-expected[i])))<3e-5,{output:rejected,expected});
      fill(2,depth);const offscreen=run();add('motion_outside_image_rejects_history',Math.max(...offscreen.map((v,i)=>Math.abs(v-expected[i])))<3e-5,{output:offscreen,expected});
    }
  }finally{
    renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.autoClear=saved.autoClear;renderer.setClearColor(saved.clearColor,saved.clearAlpha);renderer.xr.enabled=saved.xr;for(const r of resources)r.dispose();
  }
  const restored=renderer.getRenderTarget()===saved.target&&renderer.getViewport(new THREE.Vector4()).equals(saved.viewport)&&renderer.getScissor(new THREE.Vector4()).equals(saved.scissor)&&renderer.getScissorTest()===saved.scissorTest&&renderer.autoClear===saved.autoClear&&renderer.xr.enabled===saved.xr;
  add('renderer_state_restored',restored);
  return {passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,scope:'actual analytic wind GPU versus CPU, multisample MRT normalization and actual resolve depth/UV functionality; animated canopy appearance and frame time remain separate acceptance'};
}
