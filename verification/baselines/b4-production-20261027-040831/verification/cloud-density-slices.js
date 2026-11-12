// Diagnostic CPU density only, using the production closure via its QA API.
// No weather or shape formula is copied here, and no runtime density is changed.
export async function inspectCloudDensitySlices(a,{width=256,height=144}={}){
  a.pause(true);const original={...a.state.parameters.weather},time=a.state.time,profiles=[];
  const axes=[[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2]],scenarios=[['fair',{humidity:.68,temperature:29,coverage:.35,thickness:950,shear:1.1}],['humid',{humidity:.95,temperature:28,coverage:.9,thickness:1800,shear:1.8}]];
  // Diagnostic coordinates follow the same spherical altitude as sky.js,
  // rather than mistaking world-Y planes for constant-altitude layer edges.
  const earth=6360000,point=(x,altitude,z)=>[x,Math.sqrt((earth+altitude)**2-x*x-z*z)-earth,z];
  const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
  try{for(const [name,settings]of scenarios){
    a.setWeather(settings);const info=a.weather().current,sky=a.atmosphere().diagnostics,base=sky.cloudBaseMetres,top=sky.cloudTopMetres,thickness=top-base;
    let best={mass:-1,x:0,z:0};for(let z=-12000;z<=12000;z+=750)for(let x=-12000;x<=12000;x+=750){let mass=0;for(const h of [.15,.3,.45,.6])mass+=a.cloudDensityAt(point(x,base+h*thickness,z),time);if(mass>best.mass)best={mass,x,z};}
    const slices=[];let maximum=0,nonfinite=0;
    for(const axis of axes){const values=new Float32Array(width*height),span=3000,yMin=base-.06*thickness,yMax=top+.06*thickness;for(let row=0;row<height;row++){const y=yMax-row/(height-1)*(yMax-yMin);for(let col=0;col<width;col++){const distance=(col/(width-1)-.5)*span,d=a.cloudDensityAt(point(best.x+axis[0]*distance,y,best.z+axis[1]*distance),time);values[row*width+col]=d;if(!Number.isFinite(d))nonfinite++;else maximum=Math.max(maximum,d);}}
      slices.push({axis,values,spanMetres:span,yRange:[yMin,yMax]});}
    const horizontal=new Float32Array(width*height),horizontalAltitude=base+.3*thickness;for(let row=0;row<height;row++)for(let col=0;col<width;col++){const x=best.x+(col/(width-1)-.5)*3000,z=best.z+(row/(height-1)-.5)*3000,d=a.cloudDensityAt(point(x,horizontalAltitude,z),time);horizontal[row*width+col]=d;if(!Number.isFinite(d))nonfinite++;else maximum=Math.max(maximum,d);}slices.push({axis:'XZ-horizontal',values:horizontal,spanMetres:3000,yRange:[horizontalAltitude,horizontalAltitude]});
    const images=[];for(let i=0;i<slices.length;i++){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(width,height);for(let p=0;p<slices[i].values.length;p++){const c=Math.round(255*Math.sqrt(slices[i].values[p]/Math.max(maximum,1e-9)));pixels.data.set([c,c,c,255],p*4);}ctx.putImageData(pixels,0,0);images.push({name:`${name}-axis${i}`,dataURL:canvas.toDataURL('image/png')});}
    const edges=axes.map(axis=>{let lower=0,upper=0;for(let col=0;col<width;col++){const d=(col/(width-1)-.5)*3000,x=best.x+axis[0]*d,z=best.z+axis[1]*d;lower=Math.max(lower,a.cloudDensityAt(point(x,base-.001,z),time));upper=Math.max(upper,a.cloudDensityAt(point(x,top+.001,z),time));}return{axis,lower,upper,sampleMarginMetres:.001};});
    profiles.push({name,settings,current:info,time,base,top,best,maximum,nonfinite,edges,width,height,earthRadiusMetres:earth,coordinates:'spherical altitude, local world X/Z; y=sqrt((R+h)^2-x^2-z^2)-R',normalization:'sqrt(density / same-profile maximum); diagnostic contrast only',images,slices:slices.map(({axis,spanMetres,yRange,values})=>({axis,spanMetres,yRange,float32Base64:encode(new Uint8Array(values.buffer))}))});
    await new Promise(r=>setTimeout(r,0));
  }return{date:new Date().toISOString(),profiles,limits:['CPU base-LOD density only; GPU view rays use filtered noise and finite quadrature','Coarse search chooses a dense central-region column, not necessarily the same cloud seen in the original photo','Grayscale normalized separately for each weather profile, not a radiometric render or CFData measurement','Common LCL and zero top/bottom boundary are intentional; flat base alone is not an error']};
  }finally{a.setWeather(original);a.pause(true);}
}

export async function probeCloudLayerEdges(a,profiles){
  a.pause(true);const saved={...a.state.parameters.weather},earth=6360000,out=[];
  const point=(x,h,z)=>[x,Math.sqrt((earth+h)**2-x*x-z*z)-earth,z],axes=[[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2]];
  try{for(const p of profiles){a.setWeather(p.settings);const info=a.atmosphere().diagnostics,tests=[];
    for(const edge of ['base','top'])for(const delta of [-10,-1,-.1,-.01,-.001,0,.001,.01,.1,1,10]){let max=0,sum=0,positive=0,n=0;
      for(const axis of axes)for(let i=0;i<256;i++){const distance=(i/255-.5)*3000,x=p.best.x+axis[0]*distance,z=p.best.z+axis[1]*distance,density=a.cloudDensityAt(point(x,(edge==='base'?info.cloudBaseMetres:info.cloudTopMetres)+delta,z),p.time);max=Math.max(max,density);sum+=density;positive+=density>1e-6;n++;}
      tests.push({edge,deltaMetres:delta,maximumDensity:max,meanDensity:sum/n,positiveFraction:positive/n,samples:n});}
    out.push({name:p.name,time:p.time,best:p.best,base:info.cloudBaseMetres,top:info.cloudTopMetres,tests});}
    return{date:new Date().toISOString(),profiles:out,scope:'Actual CPU production density near both radial layer boundaries; 3 planes, 256 columns each; no density formula copied',limits:['At exactly0 radial conversion/Math.hypot can differ by machine rounding; +/-1mm are the intentional inner/outer probes','CPU baseLOD, not an image-space GPU continuity or subjective cloud appearance proof']};
  }finally{a.setWeather(saved);a.pause(true);}
}
