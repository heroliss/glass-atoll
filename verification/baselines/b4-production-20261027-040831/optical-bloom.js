// Normalized multi-scale camera point-spread approximation in linear HDR.
// Redistributes radiance instead of adding an unbounded threshold glow.
export function createOpticalBloom(THREE,renderer){
  const targets=Array.from({length:4},()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}));
  const result=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),geometry=new THREE.PlaneGeometry(2,2);
  const uniforms={tInput:{value:null},uPixel:{value:new THREE.Vector2()},t0:{value:targets[0].texture},t1:{value:targets[1].texture},t2:{value:targets[2].texture},t3:{value:targets[3].texture},uStrength:{value:.018}};
  const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const down=new THREE.ShaderMaterial({uniforms,vertexShader,depthTest:false,depthWrite:false,toneMapped:false,fragmentShader:`uniform sampler2D tInput;uniform vec2 uPixel;varying vec2 vUv;
    void main(){vec3 c=texture2D(tInput,vUv).rgb*.25;
      c+=(texture2D(tInput,vUv+uPixel*vec2(1,0)).rgb+texture2D(tInput,vUv-uPixel*vec2(1,0)).rgb+texture2D(tInput,vUv+uPixel*vec2(0,1)).rgb+texture2D(tInput,vUv-uPixel*vec2(0,1)).rgb)*.125;
      c+=(texture2D(tInput,vUv+uPixel).rgb+texture2D(tInput,vUv-uPixel).rgb+texture2D(tInput,vUv+uPixel*vec2(1,-1)).rgb+texture2D(tInput,vUv+uPixel*vec2(-1,1)).rgb)*.0625;gl_FragColor=vec4(c,1.);}`});
  const combine=new THREE.ShaderMaterial({uniforms,vertexShader,depthTest:false,depthWrite:false,toneMapped:false,fragmentShader:`uniform sampler2D tInput,t0,t1,t2,t3;uniform float uStrength;varying vec2 vUv;void main(){vec3 spread=.4*texture2D(t0,vUv).rgb+.3*texture2D(t1,vUv).rgb+.2*texture2D(t2,vUv).rgb+.1*texture2D(t3,vUv).rgb;gl_FragColor=vec4(mix(texture2D(tInput,vUv).rgb,spread,uStrength),1.);}`});
  const quad=new THREE.Mesh(geometry,down);quad.frustumCulled=false;scene.add(quad);let enabled=true,width=1,height=1;
  return {configure(value){enabled=!!value;},setSize(w,h){width=w;height=h;targets.forEach((t,i)=>t.setSize(Math.max(1,Math.ceil(w/2**(i+1))),Math.max(1,Math.ceil(h/2**(i+1)))));result.setSize(w,h);},render(texture){if(!enabled)return texture;const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();try{let input=texture,w=width,h=height;quad.material=down;
    for(const target of targets){uniforms.tInput.value=input;uniforms.uPixel.value.set(1/w,1/h);renderer.setRenderTarget(target);renderer.render(scene,camera);input=target.texture;w=target.width;h=target.height;}
    uniforms.tInput.value=texture;quad.material=combine;renderer.setRenderTarget(result);renderer.render(scene,camera);return result.texture;
    }finally{renderer.setRenderTarget(previous,face,mip);}
  },get resultTarget(){return enabled?result:null;},get state(){return {enabled,strength:uniforms.uStrength.value,levels:4,model:'normalized, threshold-free linear HDR camera PSF; 1.8% radiance redistribution',passes:enabled?5:0};},dispose(){targets.forEach(t=>t.dispose());result.dispose();geometry.dispose();down.dispose();combine.dispose();}};
}
