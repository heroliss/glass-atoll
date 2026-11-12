from pathlib import Path
root=Path(__file__).resolve().parent
old=(root/'r21-contact-support-gpu-check.js').read_text(encoding='utf8')
guards=old[old.index('function capture('):old.index('export async function runContactSupportGPUCheck')]
new='''// ROOT ONLY: at most four32x32 actual-shader draws under the existing
// renderer's exclusive QA lock. Reuses the sealed R21 state guard, not its
// contact fixture. No new context, resize, live-show mutation or shader copy.
import {createFireworkEvent,sampleBody} from '../fireworks-physics.js';
import {referenceVectorShutterPixels} from './r18-vector-shutter-gpu-check.js';
const size=32,raw=1e-4;
const demand=(x,m)=>{if(!x)throw new Error(m);};
const flatSurface={minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,clearanceMetres:.03,heightAt:()=>0,boundAtHorizontalRegion:()=>({minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,certifiedSeaOnly:true,planeHeight:0})};
function fillHost(){return{autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(t){this.target=t;},render(){}};}
function makeCamera(T,centre,reflection){const c=new T.PerspectiveCamera(50,1,.1,1000);c.position.set(centre[0],reflection?-2:2,centre[2]-24);c.lookAt(...centre);c.updateMatrixWorld();return c;}
function prepareActualFactory(T,createFireworks){
 const fw=createFireworks(T,{terrainHeight:()=>0,origin:[29,0,7],sourceVisibility:'none',clusterModel:'moments',trailIntegration:'legacy8',airSurface:flatSurface});
 try{
  fw.configure({type:'chrysanthemum',effectProfile:'powered-bees-v1',autoDirection:false,azimuth:110,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0,starDragModel:'bounded-descent'});
  const launch=fw.launch({seed:42});demand(launch.accepted,'Isolated powered launch rejected');const actual=fw.diagnostics().lastLaunch;
  const event=createFireworkEvent({type:actual.type,effectProfile:'powered-bees-v1',seed:actual.seed,time:actual.time,origin:[...actual.origin],azimuth:actual.azimuth,elevation:actual.elevation,burstOrientation:actual.burstOrientation,starDragModel:'bounded-descent'}),body=event.heads.find(b=>b.thrustProfile),S=1/120;
  demand(body,'Actual candidate has no motor');const knot=body.thrustProfile.cells.find(c=>c.toAge>.5&&c.toAge<.9).toAge,now=body.birth+knot+S*.25;fw.update({time:now,windVector:[0,0,0]});
  const provider=fw.smokeSourceProvider.sampleBody(actual.id,{bodyId:body.id,time:now}),pose=sampleBody(body,now);demand(provider.position.every((v,c)=>Math.abs(v-pose.position[c])<1e-10),'Actual provider and detached current pose disagree');
  return{fw,body,S,now,knot,launch:actual,pose};
 }catch(e){fw.dispose();throw e;}
}
function selectRows(T,fixture,camera,S,reflection){
 const traces=[];fixture.fw.getRadianceBound({camera,optics:{width:size,height:size,shutterSeconds:S},rawPerCandela:raw,onSourceBound:x=>traces.push(x)});
 const selected=traces.filter(t=>t.source.bodyId===fixture.body.id&&Math.abs(t.source.sourceAge-(fixture.now-fixture.body.birth))<1e-10&&t.source.vectorEmission);
 demand(selected.length===(S>0?2:1),'Expected force-knot split into2positive head intervals, or1instant source');for(const t of selected){const clip=new T.Vector3(...t.source.position).project(camera);demand(clip.z>=-1&&clip.z<=1,'Selected powered anchor outside actual clip depth');}
 fixture.fw.render({renderer:fillHost(),target:{width:size,height:size},camera,reflection,legacySmoke:false,optics:{width:size,height:size,shutterSeconds:S,dof:false,vignette:false},frame:{storageEV:0,rawPerCandela:raw}});
 const mesh=fixture.fw.effectsScene.children.find(o=>o.isMesh),g=mesh.geometry,u=mesh.material.uniforms,original=g.instanceCount,indices=[];
 for(const trace of selected){const s=trace.source,matches=[];for(let i=0;i<original;i++)if(g.getAttribute('aShape').array[i*4+3]<0&&g.getAttribute('aShape').array[i*4+1]===Math.fround(s.radius)&&s.position.every((v,c)=>g.getAttribute('aCentre').array[i*3+c]===Math.fround(v)))matches.push(i);demand(matches.length===1,'Unique trace-to-actual-upload row required');indices.push(matches[0]);}
 const saved=Object.fromEntries(Object.entries(g.attributes).filter(([n])=>n!=='position').map(([n,a])=>[n,indices.map(i=>a.array.slice(i*a.itemSize,(i+1)*a.itemSize))]));
 for(const[n,parts]of Object.entries(saved)){const a=g.getAttribute(n);parts.forEach((part,i)=>a.array.set(part,i*a.itemSize));a.clearUpdateRanges();a.addUpdateRange(0,selected.length*a.itemSize);a.needsUpdate=true;}g.instanceCount=selected.length;
 const oracle=new Float64Array(size*size*4),inputs=[];
 for(let i=0;i<selected.length;i++){
  const read=(n,k)=>Array.from(g.getAttribute(n).array.slice(i*k,(i+1)*k)),packed=Array.from({length:6},(_,j)=>read('aTemporal'+j,4)).flat(),shape=read('aShape',4),input={centre:read('aCentre',3),velocity:read('aVelocity',3),stretch:read('aStretch',3),colour:read('aColour',3),radius:shape[1],shapeZ:shape[2],vector:true,shutter:u.uShutter.value,legacyShutter:u.uLegacyShutter.value,adaptive:false,rgb:Array.from({length:8},(_,j)=>packed.slice(j*3,j*3+3)),t:[1,1,1],scalar:new Array(8).fill(0)};
  demand(input.rgb.flat().some(v=>v>0),'Powered source dark at chosen fixture phase');const expected=referenceVectorShutterPixels(T,camera,input).pixels;for(let j=0;j<oracle.length;j++)oracle[j]+=expected[j];inputs.push(input);
 }
 return{mesh,original,oracle,inputs,traces:selected};
}
'''+guards+'''
export async function runPoweredOpticsGPUCheck(THREE,renderer,{createFireworks,parentLocked=false}={}){
 if(!parentLocked||typeof createFireworks!=='function')throw new Error('Existing exclusive renderer QA lock required');
 const gl=renderer.getContext(),report={schema:'glass-atoll.r22-powered-optics-GPU.v1',dateUTC:new Date().toISOString(),actualGPU:false,checks:[],cases:[],glErrors:[],shaderErrors:[],readbackBytes:0},check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,...evidence});
 let saved,fixture,target,stop=false,query=null,queryActive=false,timer=null;const oldShader=renderer.debug.onShaderError,oldCheck=renderer.debug.checkShaderErrors;
 const errors=label=>{const values=[];for(let i=0;i<16;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;values.push(e);}if(values.length||gl.isContextLost()){report.glErrors.push({label,errors:values,lost:gl.isContextLost()});stop=true;}return values;};
 try{
  errors('entry');demand(!stop,'Entry GL gate failed');saved=capture(THREE,renderer,gl);demand(gl.getExtension('EXT_color_buffer_float'),'RGBA32F unavailable');
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');timer=ext&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)?ext:null;report.timerAvailable=!!timer;
  renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(g,p,v,f)=>{stop=true;report.shaderErrors.push({program:g.getProgramInfoLog(p),vertex:g.getShaderInfoLog(v),fragment:g.getShaderInfoLog(f)});};
  fixture=prepareActualFactory(THREE,createFireworks);report.fixture={bodyId:fixture.body.id,seed:fixture.launch.seed,birth:fixture.body.birth,now:fixture.now,knot:fixture.knot,motorEnd:fixture.body.thrustProfile.motorEndAge,providerCurrentPose:fixture.pose.position};
  target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,samples:0});target.texture.colorSpace=THREE.NoColorSpace;
  renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.setClearColor(0,0);
  for(const reflection of [false,true])for(const S of [fixture.S,0]){
   if(stop)break;const camera=makeCamera(THREE,fixture.pose.position,reflection),selected=selectRows(THREE,fixture,camera,S,reflection),pixels=new Float32Array(size*size*4);pixels.fill(NaN);
   renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear(true,false,false);const start=performance.now();if(timer){query=gl.createQuery();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);queryActive=true;}try{renderer.render(fixture.fw.effectsScene,camera);report.actualGPU=true;}finally{if(queryActive){gl.endQuery(timer.TIME_ELAPSED_EXT);queryActive=false;}}errors('actual draw');demand(!stop,'First draw GL/shader fault');
   demand(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'RGBA32F framebuffer incomplete');const program=renderer.properties.get(selected.mesh.material).currentProgram;if(program)demand(gl.getProgramParameter(program.program,gl.LINK_STATUS),'Actual finite-effects shader link failed');
   gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,size,size,gl.RGBA,gl.FLOAT,pixels);report.readbackBytes+=pixels.byteLength;errors('readback');demand(!stop,'First readback fault');
   let gpuMs=null;if(query){let ready=false;const deadline=performance.now()+1500;for(let i=0;i<60&&performance.now()<deadline;i++){if(gl.isContextLost())break;if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){ready=true;break;}await new Promise(requestAnimationFrame);}const disjoint=gl.getParameter(timer.GPU_DISJOINT_EXT);if(ready&&!disjoint)gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);query=null;if(!ready||disjoint||gpuMs>25){stop=true;report.stopped=gpuMs>25?'Actual isolated draw exceeded25ms':'Timer incomplete/disjoint; no more draws';}}
   const delta=difference(pixels,selected.oracle),bound=selected.traces.reduce((v,t)=>v+t.bound.peak,0),actualPeak=Math.max(...pixels.filter((_,i)=>i%4!==3)),evidence={reflection,shutter:S,instances:selected.inputs.length,originalRows:selected.original,difference:delta,actualPeak,sourceBoundPeakSum:bound,sourceBoundEnclosesPeak:actualPeak<=bound+2e-7,submitAndReadMs:performance.now()-start,gpuMs,traces:selected.traces};
   report.cases.push(evidence);check((reflection?'mirror':'main')+' '+(S?'force-split':'instant')+' actual shader vs supplied-bin oracle',delta.passed&&evidence.sourceBoundEnclosesPeak&&actualPeak>0,evidence);if(!report.checks.at(-1).passed)stop=true;
  }
  check('four bounded actual powered-head draws completed',!stop&&report.cases.length===4);
 }catch(e){check('bounded powered GPU helper completes',false,{error:String(e.stack??e)});}
 finally{
  if(query){if(queryActive)try{gl.endQuery(timer.TIME_ELAPSED_EXT);}catch{}try{gl.deleteQuery(query);}catch{}}
  try{fixture?.fw.dispose();target?.dispose();}catch(e){check('owned disposal',false,{error:String(e)});}
  renderer.debug.onShaderError=oldShader;renderer.debug.checkShaderErrors=oldCheck;if(saved)try{restore(THREE,renderer,gl,saved);check('outer renderer/FBO/MRT/PACK state restored',sameState(saved,capture(THREE,renderer,gl)));}catch(e){check('state restored',false,{error:String(e)});}errors('exit');
 }
 check('no GL or shader faults',!report.glErrors.length&&!report.shaderErrors.length);report.passed=report.checks.length>0&&report.checks.every(c=>c.passed);report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};
 report.limits=['Four isolated32x32current-renderer draws; same production shader, two force-partitioned head rows vs one instantaneous row, main and mirror.','Oracle independently evaluates Gaussian transport of supplied actual bins; CPU motion/bin correctness is verified separately, not a full physical path integral.','No smokeT(t), air/depth/DOF/camera history, nonlinear stretch or whole-show composition/FPS admission.','Existing R21 FBO/PACK state guard reused; no new graphics context or canvas resize.'];return report;
}
'''
(root/'r22-powered-optics-gpu-check.js').write_text(new,encoding='utf8')
print('Generated bounded R22 helper from sealed state guard')
