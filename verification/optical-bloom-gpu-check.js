import {createOpticalBloom} from '../optical-bloom.js';

/** Small real-GPU PSF fixture. Does not mount a canvas or use the app renderer. */
export async function runOpticalBloomCheck(THREE){
  const report={startedAt:new Date().toISOString(),passed:false,checks:[],errors:[],glErrors:[],limits:[
    'Synthetic linear-HDR fixtures test invariants, not subjective camera realism or scene FPS.',
    'Point-source flux is measured well away from the image edge; clamped boundary kernels need not conserve arbitrary edge-source flux.',
    'The 0.75% flux bound accommodates repeated binary16 storage and filtering; it rejects an unnormalized additive 1.8% glow.'
  ]};
  const add=(name,passed,details={})=>report.checks.push({name,passed:Boolean(passed),...details});
  const W=128,H=128,cx=64,cy=64,started=performance.now();
  let renderer=null,bloom=null,source=null,readTarget=null,geometry=null,inputMaterial=null,copyMaterial=null;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:false});renderer.setPixelRatio(2);renderer.setSize(W/2,H/2,false);
    renderer.toneMapping=THREE.NoToneMapping;
    const gl=renderer.getContext();if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('EXT_color_buffer_float is required.');
    source=new THREE.WebGLRenderTarget(W,H,{type:THREE.HalfFloatType,depthBuffer:false});
    readTarget=new THREE.WebGLRenderTarget(W,H,{type:THREE.FloatType,depthBuffer:false});
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    const vertexShader='precision highp float;in vec3 position;out vec2 uv;void main(){uv=position.xy*.5+.5;gl_Position=vec4(position,1.);}';
    inputMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{uColour:{value:new THREE.Vector3()},uPoint:{value:new THREE.Vector2(cx,cy)},uMode:{value:0}},vertexShader,
      fragmentShader:'precision highp float;uniform vec3 uColour;uniform vec2 uPoint;uniform float uMode;out vec4 colour;void main(){vec3 c=uColour;if(uMode>.5&&any(notEqual(floor(gl_FragCoord.xy),uPoint)))c=vec3(0);colour=vec4(c,1.);}'});
    copyMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{tInput:{value:null}},vertexShader,fragmentShader:'precision highp float;uniform highp sampler2D tInput;in vec2 uv;out vec4 colour;void main(){colour=texture(tInput,uv);}'});
    const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(geometry,inputMaterial);mesh.frustumCulled=false;scene.add(mesh);
    bloom=createOpticalBloom(THREE,renderer);bloom.setSize(W,H);
    function draw(colour,point=false){mesh.material=inputMaterial;inputMaterial.uniforms.uColour.value.set(...colour);inputMaterial.uniforms.uMode.value=point?1:0;renderer.setRenderTarget(source);renderer.render(scene,camera);}
    function read(texture){mesh.material=copyMaterial;copyMaterial.uniforms.tInput.value=texture;renderer.setRenderTarget(readTarget);renderer.render(scene,camera);const data=new Float32Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,data);return data;}
    function snapshot(){return {target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear};}
    function stats(data){const sum=[0,0,0],maximum=[0,0,0];let nonFinite=0,minimum=Infinity;for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++){const value=data[i+c];if(!Number.isFinite(value))nonFinite++;sum[c]+=value;maximum[c]=Math.max(maximum[c],value);minimum=Math.min(minimum,value);}return {sum,maximum,minimum,nonFinite};}

    draw([16,.5,.25]);const constant=read(bloom.render(source.texture)),constantStats=stats(constant),maximumError=[0,0,0];
    for(let i=0;i<constant.length;i+=4)for(let c=0;c<3;c++)maximumError[c]=Math.max(maximumError[c],Math.abs(constant[i+c]-[16,.5,.25][c]));
    add('constant HDR radiance and colour ratios are preserved',maximumError.every((error,c)=>error<=Math.max(.00025,.002*[16,.5,.25][c]))&&constantStats.nonFinite===0,{source:[16,.5,.25],maximumError,stats:constantStats,tolerance:'0.2% relative, 0.00025 absolute floor; actual HDR sampler and five-pass chain'});

    draw([0,0,0]);const black=stats(read(bloom.render(source.texture)));
    add('black creates no light',black.nonFinite===0&&black.maximum.every(value=>value===0)&&black.sum.every(value=>value===0),{stats:black});

    draw([16,8,4],true);const input=read(source.texture),inputStats=stats(input),result=read(bloom.render(source.texture)),resultStats=stats(result);
    const relativeFluxError=resultStats.sum.map((value,c)=>(value-inputStats.sum[c])/inputStats.sum[c]);
    add('interior point-source RGB flux remains nearly conserved',relativeFluxError.every(value=>Math.abs(value)<.0075),{inputFlux:inputStats.sum,outputFlux:resultStats.sum,relativeFluxError,point:[cx,cy],size:[W,H]});
    const centre=(cy*W+cx)*4,peakRatio=result[centre]/input[centre];let neighbourFlux=0,farFlux=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x!==cx||y!==cy){const value=result[(y*W+x)*4];neighbourFlux+=value;if(Math.hypot(x-cx,y-cy)>4)farFlux+=value;}
    add('point peak falls and a small nearby optical spread appears',peakRatio>.95&&peakRatio<.9999&&neighbourFlux/inputStats.sum[0]>.005&&farFlux/inputStats.sum[0]>.0001,{peakRatio,neighbourFraction:neighbourFlux/inputStats.sum[0],outside4pxFraction:farFlux/inputStats.sum[0],expectedRedistributedFraction:bloom.state.strength});
    add('HDR point-spread output stays finite nonnegative and opaque',resultStats.nonFinite===0&&resultStats.minimum>=0&&result.every((value,index)=>index%4!==3||value===1),{stats:resultStats});

    renderer.setViewport(2,3,29,31);renderer.setScissor(1,4,20,22);renderer.setScissorTest(false);renderer.autoClear=false;renderer.setRenderTarget(source);
    const before=snapshot();bloom.render(source.texture);const after=snapshot();
    add('enabled PSF restores input render target and renderer state',before.target===after.target&&JSON.stringify({...before,target:null})===JSON.stringify({...after,target:null}),{before:{...before,target:'input fixture'},after:{...after,target:after.target===source?'input fixture':'different target'}});
    bloom.configure(false);renderer.setRenderTarget(source);const disabledBefore=snapshot(),calls=renderer.info.render.calls,returned=bloom.render(source.texture),disabledAfter=snapshot();
    add('disabled PSF is an exact texture bypass without draw or target mutation',returned===source.texture&&calls===renderer.info.render.calls&&disabledBefore.target===disabledAfter.target&&JSON.stringify({...disabledBefore,target:null})===JSON.stringify({...disabledAfter,target:null}));
    for(let i=0;i<16;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;report.glErrors.push('0x'+error.toString(16));}
    add('fixture has no WebGL errors',report.glErrors.length===0);report.model=bloom.state;
  }catch(error){report.errors.push(String(error?.stack||error));}
  finally{bloom?.dispose();source?.dispose();readTarget?.dispose();geometry?.dispose();inputMaterial?.dispose();copyMaterial?.dispose();renderer?.dispose();renderer?.forceContextLoss();report.wallTimeMs=performance.now()-started;report.cleanup='Own unmounted renderer/context/resources disposed.';report.passed=report.errors.length===0&&report.glErrors.length===0&&report.checks.length>0&&report.checks.every(check=>check.passed);}
  return report;
}
