// Root-only, fixed inputs on the existing exclusively locked renderer.
import {createOpticalBloom} from '../../optical-bloom.js';
import {captureLightNativeState,restoreLightNativeState,sameLightNativeState} from '../../pyro-smoke-light-native-state.js';
const size=128,demand=(x,m)=>{if(!x)throw Error(m);};
let active=false;
export async function runBloomGaussianGPUCheck(THREE,renderer,{parentLocked=false}={}){
  demand(parentLocked&&!active,'Existing exclusive parent renderer lock required');active=true;
  const report={schema:'glass-atoll.gaussian-bloom-native.v1',actualGPU:false,passed:false,rows:[],glErrors:[],shaderErrors:[],limits:{size,operators:4,maximumOperatorGPUms:25,maximumFluxRelativeError:.02,maximumConstantRelativeError:.005},scope:'Fixed constant and bright interior impulse; actual shared GPU, finite sensor and FP16 pyramid. Not full-scene performance or unbounded exposure proof.'};
  const gl=renderer.getContext();let saved,program,vao,oldHook,oldCheck,ext,query=null,queryActive=false,geometry,material,target,source,bloom;const captured=[];
  function errors(stage){const values=[];for(let i=0;i<16;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;values.push(e);}if(values.length||gl.isContextLost()){report.glErrors.push({stage,values,lost:gl.isContextLost()});throw Error('Native GL health gate failed');}}
  function stats(pixels){const sum=[0,0,0],maximum=[0,0,0];let minimum=Infinity,nonFinite=0;for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++){const v=pixels[i+c];if(!Number.isFinite(v))nonFinite++;sum[c]+=v;maximum[c]=Math.max(maximum[c],v);minimum=Math.min(minimum,v);}return{sum,maximum,minimum,nonFinite};}
  function angularVariation(pixels){return[8,16,24,32,40,48].map(radius=>{const v=[];for(let i=0;i<64;i++){const t=i*Math.PI/32,x=Math.round(64+radius*Math.cos(t)),y=Math.round(64+radius*Math.sin(t));v.push(pixels[(y*size+x)*4]);}const mean=v.reduce((a,b)=>a+b,0)/v.length;return{radius,mean,coefficientOfVariation:mean>0?Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length)/mean:null};});}
  try{
    errors('entry');saved=captureLightNativeState(THREE,renderer,gl);program=gl.getParameter(gl.CURRENT_PROGRAM);vao=gl.getParameter(gl.VERTEX_ARRAY_BINDING);oldHook=renderer.debug.onShaderError;oldCheck=renderer.debug.checkShaderErrors;
    demand(gl.getExtension('EXT_color_buffer_float'),'Float colour buffer unavailable');ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');demand(ext&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY),'Exclusive GPU timer unavailable');
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(g,p,v,f)=>{report.shaderErrors.push({program:g.getProgramInfoLog(p),vertex:g.getShaderInfoLog(v),fragment:g.getShaderInfoLog(f)});};
    renderer.autoClear=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    geometry=new THREE.PlaneGeometry(2,2);material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{tInput:{value:null}},vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'precision highp float;uniform highp sampler2D tInput;varying vec2 uv0;void main(){gl_FragColor=texture2D(tInput,uv0);}'});
    const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,depthBuffer:false,stencilBuffer:false});target.texture.colorSpace=THREE.NoColorSpace;
    for(const fixture of ['constant','impulse'])for(const quality of ['legacy','gaussian']){
      const colour=fixture==='constant'?[16,.5,.25]:[4096,2048,1024],data=new Float32Array(size*size*4);
      for(let i=0;i<size*size;i++){data[i*4+3]=1;if(fixture==='constant'||i===64*size+64)data.set(colour,i*4);}
      source=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.FloatType);source.colorSpace=THREE.NoColorSpace;source.minFilter=source.magFilter=THREE.LinearFilter;source.generateMipmaps=false;source.needsUpdate=true;
      bloom=createOpticalBloom(THREE,renderer,{quality});bloom.setSize(size,size);const before=renderer.getRenderTarget();query=gl.createQuery();demand(query,'GPU timer allocation failed');errors('before operator');gl.beginQuery(ext.TIME_ELAPSED_EXT,query);queryActive=true;
      report.actualGPU=true;const output=bloom.render(source);gl.endQuery(ext.TIME_ELAPSED_EXT);queryActive=false;errors('after operator');demand(renderer.getRenderTarget()===before,'Bloom changed caller target');demand(!report.shaderErrors.length,'Bloom shader compile failed');
      const started=performance.now();while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){demand(performance.now()-started<2500,'GPU timing readiness timeout');await new Promise(requestAnimationFrame);errors('timer wait');}
      const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT),gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);query=null;demand(!disjoint&&Number.isFinite(gpuMs)&&gpuMs<=25,'GPU timing gate failed');
      material.uniforms.tInput.value=output;renderer.setRenderTarget(target);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);renderer.render(scene,camera);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);for(const [k,v]of Object.entries({PACK_ALIGNMENT:4,PACK_ROW_LENGTH:0,PACK_SKIP_PIXELS:0,PACK_SKIP_ROWS:0}))gl.pixelStorei(gl[k],v);const pixels=new Float32Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);errors('readback');
      const result=stats(pixels),row={fixture,quality,gpuMs,disjoint,state:bloom.state,stats:result};report.rows.push(row);demand(result.nonFinite===0&&result.minimum>=0&&result.maximum.every((v,c)=>v<=colour[c]*1.005),'HDR positivity/finite/non-amplifying gate failed');
      if(fixture==='constant'){row.maximumRelativeError=0;for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)row.maximumRelativeError=Math.max(row.maximumRelativeError,Math.abs(pixels[i+c]/colour[c]-1));demand(row.maximumRelativeError<=.005,'Constant-field radiance preservation failed');}
      else{row.fluxRelativeError=result.sum.map((v,c)=>v/colour[c]-1);row.angularVariation=angularVariation(pixels);demand(row.fluxRelativeError.every(v=>Math.abs(v)<=.02),'Finite-sensor impulse flux gate failed');}
      captured.push({fixture,quality,pixels});bloom.dispose();bloom=null;source.dispose();source=null;
    }
    demand(report.rows.length===4,'Incomplete fixed workload');report.passed=true;
  }catch(error){report.error=String(error?.message||error);report.passed=false;}
  finally{
    if(saved&&!gl.isContextLost()&&renderer.getContext()===gl){try{if(queryActive)gl.endQuery(ext.TIME_ELAPSED_EXT);if(query)gl.deleteQuery(query);renderer.resetState();if(program&&gl.isProgram(program))renderer.state.useProgram(program);bloom?.dispose();source?.dispose();material?.dispose();geometry?.dispose();target?.dispose();restoreLightNativeState(THREE,renderer,gl,saved);gl.bindVertexArray(vao);report.restoration={passed:sameLightNativeState(saved,captureLightNativeState(THREE,renderer,gl))};errors('cleanup');if(!report.restoration.passed)report.passed=false;}catch(error){report.cleanupError=String(error?.message||error);report.passed=false;}}
    else if(saved){report.restoration={passed:false,reason:'context-lost-or-replaced'};report.passed=false;}
    if(oldHook!==undefined)renderer.debug.onShaderError=oldHook;if(oldCheck!==undefined)renderer.debug.checkShaderErrors=oldCheck;active=false;
  }
  report.passed&&=report.actualGPU&&!report.glErrors.length&&!report.shaderErrors.length&&report.restoration?.passed===true;return report;
}
