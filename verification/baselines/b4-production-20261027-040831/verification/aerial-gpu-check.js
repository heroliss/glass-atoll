import {createAerialPerspective,marineAirCoefficients,aerialPhaseFunctions,integrateHomogeneousAir,composeAerialRGB} from '../aerial-perspective.js';

export async function runAerialGPUCheck(THREE,renderer){
  const report={kind:'Linear HDR finite-air fixtures on the actual WebGL2 renderer',passed:false,checks:[],glErrors:[],cleanup:false};
  const checks=report.checks,add=(name,passed,details={})=>checks.push({name,passed:!!passed,...details});
  const gl=renderer.getContext(),saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest()};
  const textures=[];let aerial;
  const W=32,H=24;
  try{
    const camera=new THREE.PerspectiveCamera(40,W/H,.15,24000);camera.position.set(0,2,0);camera.lookAt(0,2,-1);camera.updateMatrixWorld();
    const sun=new THREE.DirectionalLight(0xffffff,3.6),direction=new THREE.Vector3(0,1,0);
    const colourData=new Uint16Array(W*H*4),source=new Float32Array(W*H*4),depthData=new Float32Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const rgb=[.125+(x%4)*.125,.5,2+(y%3)*.5];
      for(let c=0;c<4;c++){const v=c===3?1:rgb[c];colourData[(y*W+x)*4+c]=THREE.DataUtils.toHalfFloat(v);source[(y*W+x)*4+c]=v;}
      depthData[y*W+x]=y>=H/2?1:camera.far/(camera.far-camera.near)-camera.far*camera.near/((camera.far-camera.near)*50);
    }
    const colour=new THREE.DataTexture(colourData,W,H,THREE.RGBAFormat,THREE.HalfFloatType),depth=new THREE.DataTexture(depthData,W,H,THREE.RedFormat,THREE.FloatType);
    for(const texture of [colour,depth]){texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;textures.push(texture);}
    const white=new THREE.DataTexture(new Float32Array([1,1,1,1]),1,1,THREE.RGBAFormat,THREE.FloatType),black=new THREE.DataTexture(new Float32Array([0,0,0,0]),1,1,THREE.RGBAFormat,THREE.FloatType);
    for(const texture of [white,black]){texture.needsUpdate=true;textures.push(texture);}
    const atmosphere={uniforms:{uCloudShadowMap:{value:white},uCloudShadowFar:{value:white},uCloudShadowExtent:{value:256},uCloudShadowFarExtent:{value:8192}}};
    aerial=createAerialPerspective(THREE,renderer,{camera,atmosphere,sunLight:sun});aerial.setSize(W,H);aerial.update({weather:{humidity:.68},sunDirection:direction});
    const render=()=>aerial.render({colour,depth,width:W,height:H});
    function read(target,index=0){
      renderer.setRenderTarget(target);const previous=gl.getParameter(gl.READ_BUFFER);gl.readBuffer(gl.COLOR_ATTACHMENT0+index);
      const data=new Float32Array(target.width*target.height*4);gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.FLOAT,data);gl.readBuffer(previous);return data;
    }
    aerial.configure({enabled:false});add('Disabled pass returns the exact input texture without a draw',render()===colour&&aerial.diagnostics().frames===0);
    aerial.configure({enabled:true,aerosolScale:0,rayleighScale:0,shadows:false});render();const identity=read(aerial.target);
    let identityError=0;for(let i=0;i<identity.length;i++)identityError=Math.max(identityError,Math.abs(identity[i]-source[i]));
    add('Zero medium is an exact HDR identity through GPU integration/composition',identityError===0,{maximumError:identityError});
    aerial.configure({aerosolScale:12,rayleighScale:0,aerosolHeight:1e9,shadows:false});aerial.update({weather:{humidity:.68},sunDirection:direction});render();
    const result=read(aerial.target),T=read(aerial.volumeTarget,1),S=read(aerial.volumeTarget,0);
    let skyError=0,nonFinite=0,invalidT=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)for(let c=0;c<4;c++){
      const i=(y*W+x)*4+c;if(!Number.isFinite(result[i]))nonFinite++;if(y>=H/2)skyError=Math.max(skyError,Math.abs(result[i]-source[i]));
    }
    for(let i=0;i<T.length;i+=4)for(let c=0;c<3;c++)if(!Number.isFinite(T[i+c])||T[i+c]<0||T[i+c]>1)invalidT++;
    add('Physical sky depth bypasses aerial extinction/scattering exactly',skyError===0,{maximumError:skyError});
    add('HDR composite is finite and RGB transmittance stays in 0..1',nonFinite===0&&invalidT===0,{nonFinite,invalidT});
    const x=16,y=6,uv=new THREE.Vector2((x+.5)/W,(y+.5)/H),point=new THREE.Vector3(uv.x*2-1,uv.y*2-1,depthData[y*W+x]*2-1).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
    const ray=point.clone().sub(camera.position),D=ray.length(),mu=ray.clone().normalize().dot(direction),coeff=marineAirCoefficients({humidity:.68,aerosolScale:12,rayleighScale:0,aerosolHeight:1e9}),phase=aerialPhaseFunctions(mu);
    const medium=integrateHomogeneousAir({distance:D,betaExtinction:coeff.betaMieExtinctionRGB,sourceRGB:coeff.betaMieScatteringRGB.map(v=>v*phase.mie*sun.intensity)});
    const rgb=Array.from(source.slice((y*W+x)*4,(y*W+x)*4+3)),expected=composeAerialRGB(rgb,medium),actual=Array.from(result.slice((y*W+x)*4,(y*W+x)*4+3));
    const error=Math.max(...actual.map((v,c)=>Math.abs(v-expected[c])/(2e-5+.01*Math.abs(expected[c]))));
    add('Homogeneous GPU transfer agrees with independent analytic composition',error<=1,{actual,expected,maximumBoundRatio:error,note:'1% allows half-resolution angular reconstruction and FP16 storage; not a full-scene pixel identity.'});
    atmosphere.uniforms.uCloudShadowMap.value=black;atmosphere.uniforms.uCloudShadowFar.value=black;aerial.configure({shadows:true});aerial.update({sunDirection:direction});render();
    const darkS=read(aerial.volumeTarget,0),darkT=read(aerial.volumeTarget,1);let darkMaximum=0,transmissionChange=0;
    for(let i=0;i<darkS.length;i+=4)for(let c=0;c<3;c++){darkMaximum=Math.max(darkMaximum,Math.abs(darkS[i+c]));transmissionChange=Math.max(transmissionChange,Math.abs(darkT[i+c]-T[i+c]));}
    add('Cloud occlusion removes source radiance without changing extinction',darkMaximum===0&&transmissionChange===0,{maximumScattering:darkMaximum,maximumTransmissionChange:transmissionChange});
    atmosphere.uniforms.uCloudShadowMap.value=white;atmosphere.uniforms.uCloudShadowFar.value=white;aerial.configure({shadows:false});sun.intensity=1.8;aerial.update({sunDirection:direction});render();const halfS=read(aerial.volumeTarget,0);
    let sourceScaleError=0;for(let i=0;i<S.length;i+=4)for(let c=0;c<3;c++)sourceScaleError=Math.max(sourceScaleError,Math.abs(halfS[i+c]-S[i+c]*.5));
    add('Source scattering follows shared incident sunlight linearly',sourceScaleError<3e-5,{maximumError:sourceScaleError});
    report.diagnostics=aerial.diagnostics();
    for(let i=0;i<16;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;report.glErrors.push('0x'+e.toString(16));}
  }catch(error){report.error=String(error?.stack||error);}
  finally{
    try{aerial?.dispose();for(const texture of textures)texture.dispose();report.cleanup=true;}catch(error){report.cleanupError=String(error);}
    renderer.setRenderTarget(saved.target,saved.face,saved.mip);
    report.passed=!report.error&&report.checks.every(c=>c.passed)&&report.glErrors.length===0&&report.cleanup;
  }
  report.limits=['Fixtures test numerical coupling, HDR identity and sky bypass, not full-scene realism or mobile performance','Only the cloud visibility path is isolated here; actual tree-shadow placement requires the scene caster map','No GPU timer or FPS claim is derived from this readback check'];return report;
}
