// Inspect EXISTING GPU objects only: no initTexture/upload/generateMipmap,
// texture mutation or renderer.resetState. Allocation is not content validity.
export function auditTextureMipmaps(renderer,entries,{probeMutable=false,maxAttachmentChecks=512}={}){
  const gl=renderer.getContext();
  if(typeof gl.texStorage3D!=='function')throw new Error('This audit requires the existing WebGL2 context');
  const bindings=[
    [gl.TEXTURE_2D,gl.TEXTURE_BINDING_2D,'TEXTURE_2D'],
    [gl.TEXTURE_CUBE_MAP,gl.TEXTURE_BINDING_CUBE_MAP,'TEXTURE_CUBE_MAP'],
    [gl.TEXTURE_3D,gl.TEXTURE_BINDING_3D,'TEXTURE_3D'],
    [gl.TEXTURE_2D_ARRAY,gl.TEXTURE_BINDING_2D_ARRAY,'TEXTURE_2D_ARRAY'],
  ];
  const active=gl.getParameter(gl.ACTIVE_TEXTURE),saved=bindings.map(([target,binding,name])=>({target,binding,name,value:gl.getParameter(binding)}));
  const names=new Map([[gl.NEAREST,'NEAREST'],[gl.LINEAR,'LINEAR'],[gl.NEAREST_MIPMAP_NEAREST,'NEAREST_MIPMAP_NEAREST'],[gl.LINEAR_MIPMAP_NEAREST,'LINEAR_MIPMAP_NEAREST'],[gl.NEAREST_MIPMAP_LINEAR,'NEAREST_MIPMAP_LINEAR'],[gl.LINEAR_MIPMAP_LINEAR,'LINEAR_MIPMAP_LINEAR']]);
  const mipFilters=new Set([gl.NEAREST_MIPMAP_NEAREST,gl.LINEAR_MIPMAP_NEAREST,gl.NEAREST_MIPMAP_LINEAR,gl.LINEAR_MIPMAP_LINEAR]);
  const available=gl.getSupportedExtensions()||[],anisotropyName=['EXT_texture_filter_anisotropic','WEBKIT_EXT_texture_filter_anisotropic','MOZ_EXT_texture_filter_anisotropic'].find(n=>available.includes(n));
  const anisotropy=anisotropyName?gl.getExtension(anisotropyName):null;
  const results=[];
  function targetFor(t){return t.isCubeTexture?bindings[1]:t.isData3DTexture?bindings[2]:t.isDataArrayTexture||t.isCompressedArrayTexture?bindings[3]:bindings[0];}
  function dimensions(t,target){
    let image=t.image||t.source?.data;if(Array.isArray(image))image=image[0];if(image?.image)image=image.image;
    const first=t.mipmaps?.[0],width=Number(image?.width||first?.width)||null,height=Number(image?.height||first?.height)||null;
    const depth=target===gl.TEXTURE_3D||target===gl.TEXTURE_2D_ARRAY?Number(image?.depth||first?.depth)||null:null;
    // Array layers do not shrink across mip levels; 3D depth does shrink.
    const maximum=width&&height?Math.max(width,height,target===gl.TEXTURE_3D?(depth||1):1):null;
    return {width,height,depthOrLayers:depth,expectedFullChainLevels:maximum?Math.floor(Math.log2(maximum))+1:null,dimensionSource:'CPU image/render-target descriptor; WebGL2 has no portable per-level dimension query'};
  }
  try{
    for(const entry of entries){
      const {texture,label='',role='',policy='unspecified'}=entry;
      if(!texture?.isTexture){results.push({label,role,policy,status:'unknown',reason:'No Three.js texture supplied'});continue;}
      const [target,,targetName]=targetFor(texture),dimension=dimensions(texture,target);
      const row={label,role,policy,textureName:texture.name||'',uuid:texture.uuid,target:targetName,dimensions:dimension,requested:{generateMipmaps:!!texture.generateMipmaps,manualMipLevels:texture.mipmaps?.length||0,minFilter:texture.minFilter,magFilter:texture.magFilter,anisotropy:texture.anisotropy},uploaded:false,status:'unknown'};
      // .get reads Three's property record; it never calls a texture upload.
      const handle=renderer.properties.get(texture).__webglTexture;
      if(!handle||!gl.isTexture(handle)){row.reason='No existing uploaded GL texture handle (or handle deleted)';results.push(row);continue;}
      gl.bindTexture(target,handle);row.uploaded=true;
      const min=gl.getTexParameter(target,gl.TEXTURE_MIN_FILTER),mag=gl.getTexParameter(target,gl.TEXTURE_MAG_FILTER);
      const immutable=gl.getTexParameter(target,gl.TEXTURE_IMMUTABLE_FORMAT),levels=gl.getTexParameter(target,gl.TEXTURE_IMMUTABLE_LEVELS);
      row.actualGL={minFilter:min,minFilterName:names.get(min)||String(min),magFilter:mag,magFilterName:names.get(mag)||String(mag),usesMipFilter:mipFilters.has(min),immutableFormat:!!immutable,immutableLevels:levels,baseLevel:gl.getTexParameter(target,gl.TEXTURE_BASE_LEVEL),maxLevel:gl.getTexParameter(target,gl.TEXTURE_MAX_LEVEL),anisotropy:anisotropy?gl.getTexParameter(target,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT):null};
      const expected=dimension.expectedFullChainLevels;
      row.allocation={known:!!immutable&&expected!==null,fullChainAllocated:immutable&&expected!==null?levels>=expected:null};
      row.semanticWarnings=[];
      if(policy==='mip'&&!mipFilters.has(min))row.semanticWarnings.push('Mip minification filter is not active; allocation alone does not establish the shader uses filtered mip levels');
      if((policy==='exact'||policy==='lookup')&&mipFilters.has(min))row.semanticWarnings.push('Mip filtering is active for an exact-value/lookup role; review semantics, not a missing-mip error');
      if(texture.isDepthTexture&&policy==='mip')row.semanticWarnings.push('Depth texture marked as ordinary mip colour: policy conflict; do not average depth values');
      if(policy==='exact'||policy==='numeric'||policy==='lookup'||texture.isDepthTexture){
        row.status='not-required-by-semantic-policy';
        row.reason='No ordinary full mip chain is required by this policy; missing levels are not classified as an error';
      }else if(policy==='mip'){
        if(!row.allocation.known){row.status='unknown-allocation';row.reason=immutable?'Base dimensions unknown':'Mutable texture: IMMUTABLE_LEVELS=0 does not prove missing allocated levels';}
        else if(row.allocation.fullChainAllocated){row.status='full-chain-allocated';row.reason='Allocation only; this does not prove every mip contains current/valid filtered data';}
        else{row.status='allocation-short';row.reason='Semantic mip policy expects the full chain, but immutable allocation has fewer levels';}
      }else{row.status='unspecified-policy';row.reason='Allocation recorded without assuming mip filtering is appropriate';}
      if(texture.generateMipmaps&&row.allocation.known)row.requestedAutoMipAllocationSatisfied=row.allocation.fullChainAllocated;
      else row.requestedAutoMipAllocationSatisfied=null;
      results.push(row);
    }
  }finally{
    gl.activeTexture(active);for(const binding of saved)gl.bindTexture(binding.target,binding.value);
  }
  const stateRestored=gl.getParameter(gl.ACTIVE_TEXTURE)===active&&saved.every(s=>gl.getParameter(s.binding)===s.value);
  const report={kind:'Existing WebGL2 texture immutable-allocation and sampler-state audit',capturedAt:new Date().toISOString(),entryCount:results.length,uploadedCount:results.filter(r=>r.uploaded).length,notUploadedCount:results.filter(r=>!r.uploaded).length,mipPolicyCount:results.filter(r=>r.policy==='mip').length,mipPolicyKnownFullCount:results.filter(r=>r.status==='full-chain-allocated').length,mipPolicyUnknownCount:results.filter(r=>r.policy==='mip'&&(r.status==='unknown-allocation'||!r.uploaded)).length,fullMipAllocationShortCount:results.filter(r=>r.status==='allocation-short').length,rendererGLActiveAndBindingsRestored:stateRestored,entries:results,limits:['Never uploads, regenerates mips, changes texture settings or calls renderer.resetState.','IMMUTABLE_LEVELS describes allocated levels, not their content freshness or filtering correctness.','Mutable allocations and not-uploaded objects are unknown unless the optional colour-attachment definition probe supplies additional evidence.','Depth, solver/numeric state, metadata and lookup roles require semantic filtering; they are not ordinary colour mip requirements.','No gl.getError drain: pre-existing application error state is not consumed by the audit.']};
  if(probeMutable)probeMutableDefinitions(renderer,entries,report,{maxAttachmentChecks});
  return report;
}

function probeMutableDefinitions(renderer,entries,report,{maxAttachmentChecks}){
  const gl=renderer.getContext(),candidates=report.entries.map((row,i)=>({row,entry:entries[i]})).filter(({row})=>row.policy==='mip'&&row.uploaded&&!row.actualGL?.immutableFormat);
  const oldRead=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),oldDraw=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),oldReadBuffer=gl.getParameter(gl.READ_BUFFER),active=gl.getParameter(gl.ACTIVE_TEXTURE);
  const textureBindings=[gl.TEXTURE_BINDING_2D,gl.TEXTURE_BINDING_CUBE_MAP,gl.TEXTURE_BINDING_3D,gl.TEXTURE_BINDING_2D_ARRAY].map(p=>[p,gl.getParameter(p)]);
  const names=new Map([[gl.FRAMEBUFFER_COMPLETE,'FRAMEBUFFER_COMPLETE'],[gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT,'FRAMEBUFFER_INCOMPLETE_ATTACHMENT'],[gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT'],[gl.FRAMEBUFFER_UNSUPPORTED,'FRAMEBUFFER_UNSUPPORTED'],[gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE,'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE']]);
  let owned=null,totalChecks=0;
  const limit=Math.max(1,Math.round(maxAttachmentChecks));
  try{
    if(candidates.length){owned=gl.createFramebuffer();if(!owned)throw new Error('Could not create owned read-only diagnostic framebuffer');gl.bindFramebuffer(gl.READ_FRAMEBUFFER,owned);gl.readBuffer(gl.COLOR_ATTACHMENT0);}
    for(const {row,entry} of candidates){
      const expected=row.dimensions.expectedFullChainLevels,handle=renderer.properties.get(entry.texture).__webglTexture;
      const probe={expectedLevels:expected,attachmentChecks:[],allExpectedImagesColourAttachable:null,status:'unknown',readOnly:true};row.mutableDefinitionProbe=probe;
      if(!handle||!gl.isTexture(handle)||expected===null){probe.reason='No current GL handle or base dimensions';continue;}
      if(entry.texture.isDepthTexture){probe.reason='Depth is not ordinary colour data; deliberately not attached to a colour attachment';continue;}
      const layered=row.target==='TEXTURE_3D'||row.target==='TEXTURE_2D_ARRAY',volume=row.target==='TEXTURE_3D',cube=row.target==='TEXTURE_CUBE_MAP',baseLayers=row.dimensions.depthOrLayers;
      if(layered&&!baseLayers){probe.reason='Layer count is unknown; cannot claim all layers are covered';continue;}
      let checks=0,baseSupported=false,failed=false,partial=false;
      outer:for(let level=0;level<expected;level++){
        const images=cube?6:layered?(volume?Math.max(1,Math.floor(baseLayers/2**level)):baseLayers):1;
        for(let image=0;image<images;image++){
          if(checks>=limit){partial=true;break outer;}
          // Detach first: a rejected attachment must not leave a previous valid
          // image in place and create a false positive completeness result.
          gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,null,0);
          if(layered)gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,handle,level,image);
          else gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,cube?gl.TEXTURE_CUBE_MAP_POSITIVE_X+image:gl.TEXTURE_2D,handle,level);
          const status=gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER),complete=status===gl.FRAMEBUFFER_COMPLETE;
          probe.attachmentChecks.push({level,...(cube?{cubeFace:image}:layered?{layer:image}:{}),status,statusName:names.get(status)||String(status),complete});checks++;totalChecks++;
          if(level===0&&image===0){baseSupported=complete;if(!complete){probe.reason='Base image not colour-attachable: unsupported format versus undefined image cannot be distinguished';break outer;}}
          if(!complete){failed=true;probe.reason='An expected image is not colour-attachable although the base image is; undefined versus incompatible image remains a qualified distinction';break outer;}
        }
      }
      if(!baseSupported){probe.status='unknown-base-renderability';}
      else if(partial){probe.status='partial-unknown';probe.reason='Bounded attachment budget reached; untested faces/layers/levels remain unknown';}
      else if(failed){probe.status='expected-image-not-colour-attachable';probe.allExpectedImagesColourAttachable=false;}
      else{probe.status='all-expected-images-colour-attachable';probe.allExpectedImagesColourAttachable=true;probe.reason='All expected levels and faces/layers have colour-renderable image definitions; dimensions and content freshness are not queried';}
    }
  }finally{
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,oldRead);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,oldDraw);gl.readBuffer(oldReadBuffer);
    if(owned)gl.deleteFramebuffer(owned);
  }
  const restored=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)===oldRead&&gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===oldDraw&&gl.getParameter(gl.READ_BUFFER)===oldReadBuffer&&gl.getParameter(gl.ACTIVE_TEXTURE)===active&&textureBindings.every(([p,value])=>gl.getParameter(p)===value);
  report.mutableProbe={enabled:true,candidateCount:candidates.length,totalAttachmentChecks:totalChecks,perTextureCheckLimit:limit,allExpectedImagesDefinedCount:candidates.filter(({row})=>row.mutableDefinitionProbe?.allExpectedImagesColourAttachable===true).length,qualifiedIncompleteImageCount:candidates.filter(({row})=>row.mutableDefinitionProbe?.allExpectedImagesColourAttachable===false).length,unknownOrPartialCount:candidates.filter(({row})=>row.mutableDefinitionProbe?.allExpectedImagesColourAttachable===null).length,readDrawAndTextureStateRestored:restored};
  report.limits.push('Optional mutable probe only attaches existing images to an owned READ framebuffer and checks completeness; it never reads or writes texture pixels.','Colour-attachment completeness proves an image is defined/renderable, not its exact dimensions, sampling-chain consistency, current contents or filtering quality.','Cube faces and layered levels are all covered only when the bounded per-texture attachment budget completes; partial results remain unknown.');
}
