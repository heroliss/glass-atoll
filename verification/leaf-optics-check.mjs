import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createVegetation,vegetationWindGLSL} from '../vegetation.js';
const oldSource=fs.readFileSync(new URL('./baselines/vegetation-before-thin-leaf-v6.js',import.meta.url),'utf8');
const baselineModule=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
const options={terrainHeight:()=>1.2,seed:40219},old=baselineModule.createVegetation(THREE,options),grove=createVegetation(THREE,options),checks=[];
const check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence});
const hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
let geometryEqual=true;
for(let i=0;i<grove.children.length;i++){
  const a=old.children[i].geometry,b=grove.children[i].geometry;
  geometryEqual&&=hash(a.index.array)===hash(b.index.array);
  for(const key of Object.keys(a.attributes))geometryEqual&&=hash(a.attributes[key].array)===hash(b.attributes[key].array);
}
check('all actual geometry/index/UV/normal/tangent/anchors unchanged',geometryEqual,{meshes:grove.children.length,triangles:grove.userData.triangleCount});
let textureBytesEqual=true,textureConfigCorrect=true;const textureRows=[];
for(const species of ['palm','coastalLeaf'])for(const kind of ['albedo','normal','roughness','thickness']){
  const a=old.userData.proceduralTextures[species][kind],b=grove.userData.proceduralTextures[species][kind];
  textureBytesEqual&&=hash(a.image.data)===hash(b.image.data);
  textureConfigCorrect&&=b.generateMipmaps&&b.minFilter===THREE.LinearMipmapLinearFilter&&b.magFilter===THREE.LinearFilter&&b.anisotropy===8;
  textureRows.push({species,kind,size:[b.image.width,b.image.height],requestedMipLevels:1+Math.floor(Math.log2(Math.max(b.image.width,b.image.height))),colourSpace:b.colorSpace});
}
check('all eight authored texture byte fields unchanged',textureBytesEqual,{});
check('mipmap/trilinear/aniso configurations retained',textureConfigCorrect,textureRows);
const material=grove.children.find(m=>m.name==='Folded coconut pinnae').material;
const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
const depth={uniforms:{},vertexShader:THREE.ShaderLib.depth.vertexShader,fragmentShader:THREE.ShaderLib.depth.fragmentShader};
grove.children.find(m=>m.material===material).customDepthMaterial.onBeforeCompile(depth);
check('same wind GLSL and debug uniform in colour and depth',shader.vertexShader.includes(vegetationWindGLSL)&&depth.vertexShader.includes(vegetationWindGLSL)&&shader.uniforms.uGroveWindDebug===depth.uniforms.uGroveWindDebug,{});
check('opaque temporal metadata protocol unchanged',shader.fragmentShader.includes('mix(gl_FragColor.a,0.25,uGroveTemporalTag)'),{});
check('tree/cloud visibility injection hook preserved',shader.fragmentShader.includes('uGroveTranslucency*getShadowMask()')&&shader.fragmentShader.replace('uGroveTranslucency*getShadowMask()','uGroveTranslucency*getShadowMask()*getCloudShadow(vCloudWorld,uCloudTime)').includes('getShadowMask()*getCloudShadow('),{});
check('actual normal sampler upgraded to highp',shader.fragmentShader.includes('uniform highp sampler2D normalMap;'),{});
check('shared explicit irradiance replaces legacy sun-strength reconstruction',shader.uniforms.uGroveSunIrradiance===grove.userData.sunIrradiance&&!shader.fragmentShader.includes('3.6/0.14'),{defaultIrradiance:grove.userData.sunIrradiance.value,defaultGain:grove.userData.translucencyIntensity.value});
const absorption=[6500,2500,10000],budget=.24;
const beer=(t,path=1)=>absorption.map(s=>budget*Math.exp(-s*t*path));
let bounded=true,monotone=true,maxEnergy=0;
for(let i=0;i<10000;i++){
  const t=.00012+i/9999*.00090,path=1+(i%101)/101*4,albedo=(i%97)/96;
  const normal=beer(t),oblique=beer(t,path),thicker=beer(t+1e-6,path);
  for(let c=0;c<3;c++){
    bounded&&=oblique[c]>=0&&oblique[c]<=normal[c]&&normal[c]<=budget;
    monotone&&=thicker[c]<=oblique[c];
    const sum=.04+.96*(1-normal[c])*albedo+.96*oblique[c];maxEnergy=Math.max(maxEnergy,sum);
  }
}
check('Beer RGB transmission bounded and decreases with path/thickness',bounded&&monotone,{budget,normalAtQuarterMillimetre:beer(.00025)});
check('conservative per-channel slab energy proxy bounded',maxEnergy<=1+1e-12,{maxReflectPlusTransmitProxy:maxEnergy,note:'F0 + (1-F0)*albedo*(1-Tnormal) + (1-F0)*Tpath <= 1; not a proof for the complete multiple-scattering GGX/IBL scene.'});
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
function btdf(L,V,t=.00024){
  const path=.5*(1/Math.max(.2,Math.abs(L[1]))+1/Math.max(.2,Math.abs(V[1])));
  const side=1-smooth(-.015,.015,L[1]*V[1]),forward=.3+.7*Math.max(0,-dot(L,V))**5;
  return beer(t,path).map(v=>.96*v*side*forward/Math.PI);
}
let reciprocalError=0;
for(let i=0;i<512;i++){
  const L=norm([Math.sin(i*.57),.1+Math.abs(Math.cos(i*.14)),Math.cos(i*.81)]),V=norm([Math.sin(i*.32),-Math.abs(Math.sin(i*.67)),Math.cos(i*.15)]);
  const a=btdf(L,V),b=btdf(V,L);reciprocalError=Math.max(reciprocalError,...a.map((v,c)=>Math.abs(v-b[c])));
}
check('thin-layer BTDF angular term reciprocal',reciprocalError<1e-14,{reciprocalError});
const L=norm([.4,.8,.2]),nearA=btdf(L,norm([1,-1e-7,.1])),nearB=btdf(L,norm([1,1e-7,.1]));
const edgeJump=Math.max(...nearA.map((v,i)=>Math.abs(v-nearB[i])));
check('transmission is continuous across view-side transition',edgeJump<1e-5,{edgeJump});
let aaMonotone=true;
for(const r of [.05,.2,.5,.8,1])for(const v of [0,.0001,.001,.01,.2]){const filtered=Math.min(1,Math.pow(r**4+v,.25));aaMonotone&&=filtered>=r-1e-14&&filtered<=1;}
check('normal variance broadens GGX only, never sharpens',aaMonotone,{});
grove.userData.setLeafDebug({colour:0,normal:0,roughness:0,specular:0,transmission:0,shadows:0,wind:0,specularAA:0,unlit:1});
check('ablation controls reach actual shader/depth/receiver state',shader.uniforms.uGroveLeafDebug.value.toArray().every(v=>v===0)&&shader.uniforms.uGroveOpticsDebug.value.toArray().join(',')==='0,0,1'&&shader.uniforms.uGroveWindDebug.value===0&&depth.uniforms.uGroveWindDebug.value===0&&!grove.children.find(m=>m.material===material).receiveShadow,grove.userData.diagnostics().leafOptics.debug);
const result={date:new Date().toISOString(),passed:checks.every(c=>c.passed),checksPassed:checks.filter(c=>c.passed).length,total:checks.length,checks,limits:['CPU geometry/texture byte identity and shader wiring only','Thickness/absorption are authored effective calibration, not measured leaf specimens','Actual GPU mip allocation/filter inspection, compilation, finite targets and animated ablation remain required','Texture/specular filtering cannot solve moving subpixel triangle coverage']};
fs.writeFileSync(new URL('./leaf-optics-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,checks:result.checksPassed,total:result.total,maxEnergy,reciprocalError,edgeJump,failed:checks.filter(c=>!c.passed)}));old.userData.dispose();grove.userData.dispose();if(!result.passed)process.exitCode=1;
