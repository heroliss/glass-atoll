import {nightSkyGLSL} from '../night-sky.js';
import {referenceNightSkyGLSL} from './baselines/celestial-zero-reference-glsl.js';

// QA only. Invoke outside a production render callback with a fixed/paused
// scene. Queries never enclose an await or readPixels, and never nest.
export async function runCelestialZeroCostCheck(THREE,renderer,atmosphere,{camera,width,height,cubePosition=[0,2,0]}={}){
  if(!camera?.isPerspectiveCamera)throw new TypeError('Pass the actual fixed main perspective camera');
  await atmosphere.ready;
  const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext)return {status:'unavailable',reason:'EXT_disjoint_timer_query_webgl2 unavailable'};
  if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return {status:'unavailable',reason:'Another TIME_ELAPSED query is active; invoke outside production frame'};
  if(atmosphere.uniforms.uStarCatalogueReady.value!==1)return {status:'unavailable',reason:'Catalogue not loaded'};
  const drawing=renderer.getDrawingBufferSize(new THREE.Vector2());width=Math.round(width??drawing.x);height=Math.round(height??drawing.y);
  const snapshot=atmosphere.captureSnapshot(),uniforms={uTestInverseProjection:{value:new THREE.Matrix4()},uTestWorldRotation:{value:new THREE.Matrix3()},uTestHorizon:{value:0},uTestSize:{value:new THREE.Vector2()}};
  const vertex='void main(){gl_Position=vec4(position.xy,0.,1.);}';
  const fragment=optimized=>`precision highp float;uniform mat4 uTestInverseProjection;uniform mat3 uTestWorldRotation;uniform float uTestHorizon;uniform vec2 uTestSize;
    ${optimized?nightSkyGLSL:referenceNightSkyGLSL}
    void main(){vec2 p=gl_FragCoord.xy/uTestSize*2.-1.;vec4 local=uTestInverseProjection*vec4(p,1.,1.);vec3 rd=normalize(uTestWorldRotation*(local.xyz/local.w));float visible=smoothstep(uTestHorizon-.0002,uTestHorizon+.0002,rd.y);vec3 c=${optimized?'celestialRadiance(rd,vec3(.73,.82,.91),1.,visible)':'celestialRadiance(rd,vec3(.73,.82,.91),1.)*visible'};gl_FragColor=vec4(c,1.);}`;
  const materials=[false,true].map(optimized=>new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment(optimized),depthTest:false,depthWrite:false,toneMapped:false}));
  const scene=new THREE.Scene(),quadCamera=new THREE.Camera(),geometry=new THREE.PlaneGeometry(2,2),mesh=new THREE.Mesh(geometry,materials[0]);mesh.frustumCulled=false;scene.add(mesh);
  const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,samples:0});
  const cube=new THREE.CubeCamera(.1,24000,null);cube.coordinateSystem=renderer.coordinateSystem??THREE.WebGLCoordinateSystem;cube.updateCoordinateSystem();cube.position.fromArray(cubePosition);cube.updateMatrixWorld(true);
  camera.updateMatrixWorld();
  const views=[{name:'actual_main_projection_full_rectangle',camera:camera.clone(),width,height},...cube.children.map((c,i)=>({name:['cube_positive_x','cube_negative_x','cube_positive_y','cube_negative_y','cube_positive_z','cube_negative_z'][i],camera:c,width:256,height:256}))];
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,toneMapping:renderer.toneMapping};
  const queries=new Set(),results=[];
  function restoreRenderer(){
    renderer.autoClear=saved.autoClear;renderer.toneMapping=saved.toneMapping;renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
    if(saved.target){const v=saved.target.viewport.clone();try{saved.target.viewport.copy(saved.currentViewport);renderer.setRenderTarget(saved.target,saved.face,saved.mip);}finally{saved.target.viewport.copy(v);}}else renderer.setRenderTarget(null,saved.face,saved.mip);
  }
  function summary(values){const a=values.slice().sort((x,y)=>x-y),q=p=>a[Math.min(a.length-1,Math.floor(p*(a.length-1)))];return {count:a.length,min:a[0],p50:q(.5),p90:q(.9),p95:q(.95),max:a.at(-1),mean:a.reduce((s,v)=>s+v,0)/a.length};}
  function zeroRatio(c,horizon){
    const ip=c.projectionMatrixInverse.elements,m=c.matrixWorld.elements;let zero=0,partial=0;
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const u=(x+.5)/32-1,v=(y+.5)/32-1,w=ip[3]*u+ip[7]*v+ip[11]+ip[15];
      const a=(ip[0]*u+ip[4]*v+ip[8]+ip[12])/w,b=(ip[1]*u+ip[5]*v+ip[9]+ip[13])/w,d=(ip[2]*u+ip[6]*v+ip[10]+ip[14])/w;
      const wx=m[0]*a+m[4]*b+m[8]*d,wy=m[1]*a+m[5]*b+m[9]*d,wz=m[2]*a+m[6]*b+m[10]*d,ry=wy/Math.hypot(wx,wy,wz);
      if(ry<=horizon-.0002)zero++;else if(ry<horizon+.0002)partial++;
    }
    return {grid:[64,64],samples:4096,exactZeroWeightFractionEstimate:zero/4096,partialWeightFractionEstimate:partial/4096};
  }
  async function collect(batch){
    const started=performance.now();
    while(batch.some(q=>!gl.getQueryParameter(q.query,gl.QUERY_RESULT_AVAILABLE))){
      if(performance.now()-started>10000)throw new Error('GPU query timeout; no timing claim');
      await new Promise(resolve=>setTimeout(resolve,1));
    }
    if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('GPU disjoint; discard timings');
    const values=[[],[]];for(const q of batch){values[q.variant].push(gl.getQueryParameter(q.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q.query);queries.delete(q.query);}return values;
  }
  try{
    for(const view of views){
      let viewInfo;
      atmosphere.withSnapshot(snapshot,()=>{
        viewInfo=atmosphere.prepareStarView(renderer,view.camera,{width:view.width,height:view.height,optics:{shutterSeconds:1/120}});
        for(const [k,u]of Object.entries(atmosphere.uniforms))uniforms[k]={value:u.value?.clone?.()??u.value};
      });
      uniforms.uTestInverseProjection.value.copy(view.camera.projectionMatrixInverse);uniforms.uTestWorldRotation.value.setFromMatrix4(view.camera.matrixWorld);uniforms.uTestSize.value.set(view.width,view.height);
      const eye=view.camera.getWorldPosition(new THREE.Vector3()),horizon=-Math.sqrt(2*Math.max(2,eye.y)/6360000);uniforms.uTestHorizon.value=horizon;
      target.setSize(view.width,view.height);renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.setViewport(0,0,view.width,view.height);
      for(let warm=0;warm<8;warm++){mesh.material=materials[warm%2];renderer.render(scene,quadCamera);}
      const batch=[];
      // Alternating pair order limits systematic cache/clock drift. All draws
      // are submitted synchronously, so a production rAF cannot nest a query.
      for(let sample=0;sample<24;sample++)for(let order=0;order<2;order++){
        if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))throw new Error('Nested external GPU query detected');
        const variant=(sample+order)%2,query=gl.createQuery();queries.add(query);mesh.material=materials[variant];
        gl.beginQuery(ext.TIME_ELAPSED_EXT,query);try{renderer.render(scene,quadCamera);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);}
        batch.push({variant,query});
      }
      restoreRenderer();const values=await collect(batch),baseline=summary(values[0]),candidate=summary(values[1]);
      const table=atmosphere.getNightState().starField.tables?.find(t=>t.name===viewInfo.table);
      results.push({name:view.name,actualRT:{width:view.width,height:view.height,format:'RGBA16F',samples:0,depthBuffer:false},camera:{position:eye.toArray(),projection:view.camera.projectionMatrix.toArray()},viewInfo,candidateAverage:table?.meanCandidates,...zeroRatio(view.camera,horizon),baselineGPUms:baseline,candidateGPUms:candidate,meanChangePercent:100*(candidate.mean/baseline.mean-1),rawGPUms:{baseline:values[0],candidate:values[1]}});
    }
    return {date:new Date().toISOString(),status:'measured',queriesPerVariantPerView:24,results,currentData:{utcMs:snapshot.utcMs,physicalTime:snapshot.time,physicalSkyRevision:snapshot.physicalSkyRevision,pointCount:atmosphere.getNightState().starField.pointCount,physicalStarTime:snapshot.uniforms.uStarPhysicalTime,stellarYears:snapshot.uniforms.uStarYears,shutterSeconds:1/120},timer:'EXT_disjoint_timer_query_webgl2; nanoseconds converted to ms; no readPixels in timing',
      limits:['Isolated full-rectangle celestial stage with fixed transmission; main terrain occlusion, clouds, atmospheric integration and MSAA cost are absent','GPU query duration does not establish full-scene FPS or PMREM-stage latency','Zero fraction is a labelled64x64 CPU angular estimate, not a readback of exact covered pixels','Same frozen celestial data/physical phase and actual main/cube projections for both programs; no production runtime setting changes']};
  }catch(error){return {date:new Date().toISOString(),status:'inconclusive',reason:String(error),results};}
  finally{restoreRenderer();for(const q of queries)gl.deleteQuery(q);target.dispose();geometry.dispose();materials.forEach(m=>m.dispose());}
}
