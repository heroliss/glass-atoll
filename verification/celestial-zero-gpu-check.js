import {nightSkyGLSL} from '../night-sky.js';
import {referenceNightSkyGLSL} from './baselines/celestial-zero-reference-glsl.js';

// Actual uploaded catalogue/background/Moon; old and new functions differ only
// in the exact-zero horizon path. No browser control or live state is changed.
export async function runCelestialZeroCheck(THREE,renderer,atmosphere){
  await atmosphere.ready;
  if(atmosphere.uniforms.uStarCatalogueReady.value!==1)return {status:'failed',reason:'Catalogue not loaded'};
  const width=256,height=128,snapshot=atmosphere.captureSnapshot();
  const testCamera=new THREE.PerspectiveCamera(53.13010235415598,width/height,.1,24000);
  let source;
  atmosphere.withSnapshot(snapshot,()=>{
    atmosphere.prepareStarView(renderer,testCamera,{width,height,optics:{shutterSeconds:1/120}});
    source=Object.fromEntries(Object.entries(atmosphere.uniforms).map(([k,u])=>[k,{value:u.value?.clone?.()??u.value}]));
  });
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,toneMapping:renderer.toneMapping};
  const uniforms={...source,testSpan:{value:new THREE.Vector2(1,.5)},testCentre:{value:0},testHorizon:{value:0}};
  const prefix='precision highp float;uniform vec2 testSpan;uniform float testCentre,testHorizon;';
  const body=(optimized)=>`void main(){vec2 p=(gl_FragCoord.xy/vec2(${width}.,${height}.)*2.-1.)*testSpan;vec3 rd=normalize(vec3(p.x,p.y+testCentre,-1.));float visible=smoothstep(testHorizon-.0002,testHorizon+.0002,rd.y);vec3 c=${optimized?'celestialRadiance(rd,vec3(.73,.82,.91),1.,visible)':'celestialRadiance(rd,vec3(.73,.82,.91),1.)*visible'};gl_FragColor=vec4(c,1.);}`;
  const materials=[false,true].map(optimized=>new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:prefix+(optimized?nightSkyGLSL:referenceNightSkyGLSL)+body(optimized)}));
  const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.FloatType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const scene=new THREE.Scene(),camera=new THREE.Camera(),geometry=new THREE.PlaneGeometry(2,2),mesh=new THREE.Mesh(geometry,materials[0]);mesh.frustumCulled=false;scene.add(mesh);
  const pixels=[new Float32Array(width*height*4),new Float32Array(width*height*4)],frames=[],checks=[];
  const original={rotation:source.uEquatorialRotation.value.clone(),refraction:source.uCelestialRefraction.value,moon:source.uMoonDirection.value.clone(),right:source.uMoonRight.value.clone(),north:source.uMoonNorth.value.clone(),sun:source.uMoonSunDirection.value.clone(),radiance:source.uMoonRadiance.value};
  const horizon=-Math.sqrt(2*2/6360000),framesToRun=[
    {id:'all_exact_zero_below_horizon',span:[1,.15],centre:-.6},
    {id:'all_visible_above_horizon',span:[1,.15],centre:.6},
    ...[0,.23,.5,.77].map(phase=>({id:`cross_quad_horizon_phase_${phase}`,span:[.04,.002],centre:horizon+phase*.004/height})),
    {id:'moon_disc_crosses_partial_horizon',span:[.012,.012],centre:horizon,moon:true},
    {id:'bright_catalogue_kernel_crosses_partial_horizon',span:[.006,.002],centre:horizon,star:true}
  ];
  const points=source.uStarCatalogue.value.image.data,count=atmosphere.getNightState().starField.pointCount;
  let brightest=0;for(let i=1;i<count;i++)if(points[i*12+7]<points[brightest*12+7])brightest=i;
  try{
    renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);
    for(const frame of framesToRun){
      uniforms.testSpan.value.set(...frame.span);uniforms.testCentre.value=frame.centre;uniforms.testHorizon.value=horizon;
      source.uEquatorialRotation.value.copy(original.rotation);source.uCelestialRefraction.value=original.refraction;source.uMoonDirection.value.copy(original.moon);source.uMoonRight.value.copy(original.right);source.uMoonNorth.value.copy(original.north);source.uMoonSunDirection.value.copy(original.sun);source.uMoonRadiance.value=original.radiance;
      const centreRay=new THREE.Vector3(0,horizon,-1).normalize();
      if(frame.moon){
        source.uMoonDirection.value.copy(centreRay);source.uMoonRight.value.set(1,0,0);source.uMoonNorth.value.crossVectors(source.uMoonRight.value,centreRay).normalize();source.uMoonSunDirection.value.copy(centreRay).negate();source.uMoonRadiance.value=.05;
      }
      if(frame.star){
        const k=brightest*12,star=new THREE.Vector3(points[k],points[k+1],points[k+2]).addScaledVector(new THREE.Vector3(points[k+4],points[k+5],points[k+6]),source.uStarYears.value).normalize();
        const q=new THREE.Quaternion().setFromUnitVectors(centreRay,star);source.uEquatorialRotation.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));source.uCelestialRefraction.value=0;
      }
      for(let variant=0;variant<2;variant++){mesh.material=materials[variant];renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,width,height,pixels[variant]);}
      let differingChannels=0,maxAbsoluteDifference=0,maxRelativeDifference=0,invalid=0,exactZeroPixels=0,partialPixels=0,positiveChannels=0,belowNonzero=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const px=((x+.5)/width*2-1)*frame.span[0],py=((y+.5)/height*2-1)*frame.span[1]+frame.centre,ry=py/Math.hypot(px,py,1);
        const isZero=ry<=horizon-.0002,isPartial=!isZero&&ry<horizon+.0002;
        if(isZero)exactZeroPixels++;if(isPartial)partialPixels++;
        for(let c=0;c<3;c++){
          const i=(y*width+x)*4+c,a=pixels[0][i],b=pixels[1][i],d=Math.abs(a-b);
          if(!Number.isFinite(a)||!Number.isFinite(b))invalid++;
          if(a!==b)differingChannels++;maxAbsoluteDifference=Math.max(maxAbsoluteDifference,d);maxRelativeDifference=Math.max(maxRelativeDifference,d/Math.max(1e-20,Math.abs(a)));
          if(a>0)positiveChannels++;if(isZero&&(a!==0||b!==0))belowNonzero++;
        }
      }
      frames.push({...frame,table:'wide',differingChannels,maxAbsoluteDifference,maxRelativeDifference,invalid,exactZeroPixels,partialPixels,positiveChannels,belowNonzero});
      checks.push({id:frame.id+'_exact_rgb_equality',passed:differingChannels===0&&invalid===0,maxAbsoluteDifference});
    }
    checks.push({id:'below_horizon_old_and_new_are_exact_zero',passed:frames.every(f=>f.belowNonzero===0)&&frames[0].exactZeroPixels===width*height});
    checks.push({id:'partial_horizon_and_visible_light_actually_exercised',passed:frames.filter(f=>f.id.startsWith('cross_quad')||f.moon||f.star).every(f=>f.partialPixels>0&&f.positiveChannels>0)});
    return {date:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},dimensions:[width,height],frames,checks,
      performanceProtocol:'Measure fixed UTC/cloud/wind/camera and native RT dimensions, after compilation/warmup. Include a 256x256 cube capture and the same face sequence; compare GPU timer windows, not this synchronous Float32 readback duration.',
      limits:['Tests the complete celestial function with actual uploaded catalogue/background/Moon and a controlled view transmission; not cloud quadrature or the output/display chain','Exact-zero optimization is geometric horizon only; no daylight star removal','Every EQJ/UV/Moon edge derivative stays before varying visibility control; only explicit LOD/gradient reads follow it']};
  }finally{
    renderer.autoClear=saved.autoClear;renderer.toneMapping=saved.toneMapping;renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
    if(saved.target){const v=saved.target.viewport.clone();try{saved.target.viewport.copy(saved.currentViewport);renderer.setRenderTarget(saved.target,saved.face,saved.mip);}finally{saved.target.viewport.copy(v);}}else renderer.setRenderTarget(null,saved.face,saved.mip);
    target.dispose();geometry.dispose();materials.forEach(m=>m.dispose());
  }
}
