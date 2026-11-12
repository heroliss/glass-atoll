import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createVegetation} from '../vegetation.js';

const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const match=source.match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/);
if(!match)throw new Error('Actual terrain implementation not found');
const terrainHeight=new Function('x','z',match[1]);
const grove=createVegetation(THREE,{terrainHeight,seed:40219});
function ranges(data,stride){
  const min=Array(stride).fill(Infinity),max=Array(stride).fill(-Infinity);let negative=0,nonFinite=0;
  for(let i=0;i<data.length;i++){
    const v=data[i],c=i%stride;if(!Number.isFinite(v)){nonFinite++;continue;}
    min[c]=Math.min(min[c],v);max[c]=Math.max(max[c],v);if(v<0)negative++;
  }
  return {min,max,negative,nonFinite};
}
const meshes=grove.children.map(mesh=>({name:mesh.name,vertices:mesh.geometry.attributes.color.count,
  vertexColours:ranges(mesh.geometry.attributes.color.array,3),materialColour:mesh.material.color.toArray(),
  materialMetalness:mesh.material.metalness,colourNormalized:mesh.geometry.attributes.color.normalized,
  indexMax:mesh.geometry.index.array.reduce((a,b)=>Math.max(a,b),0),
  indexOutOfRange:mesh.geometry.index.array.some(i=>i>=mesh.geometry.attributes.color.count)}));
const textures=[];
for(const [species,maps] of Object.entries(grove.userData.proceduralTextures)){
  for(const kind of ['albedo','normal','roughness','thickness','bump']){
    const map=maps[kind];if(!map)continue;
    textures.push({species,kind,colourSpace:map.colorSpace,storage:map.image.data.constructor.name,
      width:map.image.width,height:map.image.height,...ranges(map.image.data,4)});
  }
}
// A two-dimensional screen-space counterexample using the actual positive
// centre/edge tint ratio. MSAA may cover an off-centre sample while a smooth
// varying is evaluated at the pixel centre outside a narrow triangle.
// This is an interpolation-domain test, not a claim of current GPU coordinates.
const triangle=[[.49,.10],[.49001,.90],[.49002,.10]],pixelCentre=[.5,.5];
function barycentric(p,a,b,c){
  const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  const x=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/d;
  const y=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/d;
  return [x,y,1-x-y];
}
const weights=barycentric(pixelCentre,...triangle),colours=[.12*1.018,.12,.12];
const outsideColour=weights.reduce((s,w,i)=>s+w*colours[i],0);
const insideWeights=[.25,.5,.25],insideColour=insideWeights.reduce((s,w,i)=>s+w*colours[i],0);
const report={date:new Date().toISOString(),scope:'Actual seeded terrain/grove CPU buffers; no renderer/browser used',
  meshes,textures,interpolationCounterexample:{triangle,pixelCentre,weights,positiveVertexColours:colours,
    smoothOutsideColour:outsideColour,insideBarycentricExample:insideWeights,insideColour,
    limitation:'The example demonstrates extrapolation algebra, not the actual two reflection pixels or a guaranteed hardware MSAA sample location'},
  passed:meshes.every(m=>m.vertexColours.negative===0&&m.vertexColours.nonFinite===0&&!m.indexOutOfRange&&m.materialColour.every(v=>v>=0))
    &&textures.every(t=>t.negative===0&&t.nonFinite===0)&&outsideColour<0&&insideColour>0,
  conclusion:'Stored colour data is nonnegative. Default smooth colour varying can extrapolate outside a subpixel triangle at a covered MSAA pixel; centroid-qualified colour preserves convex interpolation inside covered geometry.'};
fs.writeFileSync(new URL('./leaf-colour-audit.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));grove.userData.dispose();if(!report.passed)process.exitCode=1;
