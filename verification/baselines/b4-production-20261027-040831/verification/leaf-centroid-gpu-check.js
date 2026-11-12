// Isolated production-like MSAA interpolation test. The caller owns the browser.
// No runtime materials, weather, clock or scene geometry are mutated.
export function runLeafCentroidCheck(THREE,renderer){
  const gl=renderer.getContext(),width=96,height=48;
  const oldTarget=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const viewport=renderer.getViewport(new THREE.Vector4()),currentViewport=renderer.getCurrentViewport(new THREE.Vector4());
  const scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
  const clearColour=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
  const saved={autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,toneMapping:renderer.toneMapping,outputColorSpace:renderer.outputColorSpace};
  const phases=[.0625,.125,.1875,.25,.3125,.375,.4375,.5,.5625,.625,.6875,.75,.8125,.875,.9375];
  const halfWidths=[.0005,.001,.002,.004,.008,.016,.032,.064,.125,.25];
  const positions=[],colours=[];
  const vertex=(x,y,c)=>{positions.push(x/width*2-1,y/height*2-1,0);colours.push(c,c*.83,c*.42);};
  // Candidate strips hit the standard 1/16 MSAA subpixel lattice but leave the
  // pixel centre outside their narrow screen triangle. Exactly the same geometry
  // is drawn for smooth and centroid; only varying interpolation differs.
  for(let row=0;row<halfWidths.length;row++)for(let col=0;col<phases.length;col++){
    const x=2+col*6+phases[col],y=2+row*4,w=halfWidths[row];
    vertex(x-w,y+.02,.12*1.018);vertex(x+w,y+.02,.12);vertex(x,y+1.98,.12);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  const materials=[false,true].map(centroid=>new THREE.RawShaderMaterial({
    glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
    vertexShader:`precision highp float;in vec3 position,color;${centroid?'centroid ':''}out vec3 vColor;void main(){vColor=color;gl_Position=vec4(position,1.);}`,
    fragmentShader:`precision highp float;${centroid?'centroid ':''}in vec3 vColor;layout(location=0)out vec4 outColour;void main(){outColour=vec4(vColor,1.);}`
  }));
  const scene=new THREE.Scene(),camera=new THREE.Camera(),mesh=new THREE.Mesh(geometry,materials[0]);mesh.frustumCulled=false;scene.add(mesh);
  const quadGeometry=new THREE.PlaneGeometry(2,2),copyUniforms={uInput:{value:null}};
  const copyMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms:copyUniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
    vertexShader:'precision highp float;in vec3 position;out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'precision highp float;uniform highp sampler2D uInput;in vec2 vUv;layout(location=0)out vec4 outColour;void main(){outColour=texelFetch(uInput,ivec2(gl_FragCoord.xy),0);}'});
  const copyScene=new THREE.Scene(),copyMesh=new THREE.Mesh(quadGeometry,copyMaterial);copyMesh.frustumCulled=false;copyScene.add(copyMesh);
  const readTarget=new THREE.WebGLRenderTarget(width,height,{type:THREE.FloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const targets=[],cases=[],checks=[];
  const maximumSamples=gl.getParameter(gl.MAX_SAMPLES),supportedRGBA16FSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
  function read(target){
    copyUniforms.uInput.value=target.texture;renderer.setRenderTarget(readTarget);renderer.render(copyScene,camera);
    const pixels=new Float32Array(width*height*4);renderer.readRenderTargetPixels(readTarget,0,0,width,height,pixels);return pixels;
  }
  function statistics(pixels){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let negative=0,invalid=0,alphaSum=0,coveredPixels=0;const firstNegative=[];
    for(let i=0;i<pixels.length;i+=4){
      alphaSum+=pixels[i+3];if(pixels[i+3]>0)coveredPixels++;
      for(let c=0;c<3;c++){const v=pixels[i+c];if(!Number.isFinite(v))invalid++;min[c]=Math.min(min[c],v);max[c]=Math.max(max[c],v);if(v<0){negative++;if(firstNegative.length<4)firstNegative.push({x:(i/4)%width,y:Math.floor(i/4/width),channel:c,value:v,alpha:pixels[i+3]});}}
    }
    return {min,max,negative,invalid,alphaSum,coveredPixels,firstNegative};
  }
  try{
    renderer.autoClear=renderer.autoClearColor=renderer.autoClearDepth=renderer.autoClearStencil=true;
    renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.setClearColor(0,0);renderer.setScissorTest(false);
    for(const requestedSamples of [0,2,4,8]){
      if(requestedSamples>maximumSamples){cases.push({requestedSamples,status:'unsupported',reason:`MAX_SAMPLES=${maximumSamples}`});continue;}
      const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,samples:requestedSamples,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});targets.push(target);
      const pair=[];let actualSamples=null;
      for(let variant=0;variant<2;variant++){
        mesh.material=materials[variant];renderer.setRenderTarget(target);
        const attachmentType=gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE);
        if(attachmentType===gl.RENDERBUFFER){
          const previous=gl.getParameter(gl.RENDERBUFFER_BINDING),rb=gl.getFramebufferAttachmentParameter(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
          gl.bindRenderbuffer(gl.RENDERBUFFER,rb);actualSamples=gl.getRenderbufferParameter(gl.RENDERBUFFER,gl.RENDERBUFFER_SAMPLES);gl.bindRenderbuffer(gl.RENDERBUFFER,previous);
        }else if(requestedSamples===0)actualSamples=0;
        renderer.render(scene,camera);pair.push(read(target));
      }
      const smooth=statistics(pair[0]),centroid=statistics(pair[1]);let alphaDifferences=0,maxAlphaDifference=0;
      for(let i=3;i<pair[0].length;i+=4){const d=Math.abs(pair[0][i]-pair[1][i]);if(d!==0)alphaDifferences++;maxAlphaDifference=Math.max(maxAlphaDifference,d);}
      const row={requestedSamples,actualSamples,status:'measured',smooth,centroid,alphaDifferences,maxAlphaDifference,defaultNegativeReproduced:smooth.negative>0};cases.push(row);
      checks.push({id:`msaa_${requestedSamples}_centroid_colour_finite_nonnegative`,passed:centroid.invalid===0&&centroid.negative===0});
      checks.push({id:`msaa_${requestedSamples}_coverage_integral_unchanged`,passed:alphaDifferences===0&&smooth.alphaSum===centroid.alphaSum&&centroid.coveredPixels>0});
    }
    const reproduced=cases.filter(c=>c.status==='measured'&&c.requestedSamples>0&&c.defaultNegativeReproduced);
    checks.push({id:'at_least_one_msaa_smooth_extrapolation_reproduced',passed:reproduced.length>0,reason:reproduced.length?'Positive vertex colours produced negative smooth output; centroid retained identical alpha coverage.':'Not reproduced on this sample lattice/driver; do not claim a hardware reproduction.'});
    return {date:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':reproduced.length?'failed':'inconclusive',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},maximumSamples,supportedRGBA16FSamples,cases,checks,
      limits:['Isolated positive-colour thin triangles, not full-scene light transport acceptance','Requested MSAA counts can round to hardware sample counts; actualSamples is queried where the attachment is a renderbuffer','Alpha coverage is compared exactly; no change to geometry, filtering or RGB clamp','UV/normal interpolation deliberately unchanged; no derivative-based texture sampling in this fixture']};
  }finally{
    Object.assign(renderer,saved);renderer.setClearColor(clearColour,clearAlpha);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
    if(oldTarget){const v=oldTarget.viewport.clone();try{oldTarget.viewport.copy(currentViewport);renderer.setRenderTarget(oldTarget,face,mip);}finally{oldTarget.viewport.copy(v);}}
    else renderer.setRenderTarget(null,face,mip);
    for(const target of targets)target.dispose();readTarget.dispose();geometry.dispose();quadGeometry.dispose();for(const material of materials)material.dispose();copyMaterial.dispose();
  }
}
