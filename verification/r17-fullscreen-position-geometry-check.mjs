// Pure CPU geometry gate. Imports the project's actual Three r180, never a
// renderer/context. The legacy failure is intentionally captured as a witness.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';

const legacyXY=new Float32Array([-1,-1,3,-1,-1,3]);
const spatialXYZ=new Float32Array([-1,-1,0,3,-1,0,-1,3,0]);
const files=['pyro-smoke-transmission-gpu.js','pyro-smoke-light-tiles.js','pyro-smoke-light-field.js'];
function bits(values){return Array.from(new Uint32Array(values.buffer,values.byteOffset,values.length));}
function xy(attribute){const values=new Float32Array(attribute.count*2);for(let i=0;i<attribute.count;i++){values[i*2]=attribute.getX(i);values[i*2+1]=attribute.getY(i);}return values;}
function inspect(values,itemSize){
  const geometry=new THREE.BufferGeometry(),attribute=new THREE.Float32BufferAttribute(values,itemSize),errors=[],previous=console.error;
  geometry.setAttribute('position',attribute);
  try{console.error=(...args)=>errors.push(String(args[0]));geometry.computeBoundingSphere();}
  finally{console.error=previous;}
  const sphere=geometry.boundingSphere,result={itemSize,count:attribute.count,xyBits:bits(xy(attribute)),finite:sphere.center.toArray().every(Number.isFinite)&&Number.isFinite(sphere.radius),centre:sphere.center.toArray(),radius:sphere.radius,errorCount:errors.length,errorMessages:errors};
  geometry.dispose();return result;
}
const checks=[];
function check(name,fn){try{checks.push({name,passed:true,...fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
check('legacy two-component attribute reproduces real Three NaN sphere',()=>{
  const actual=inspect(legacyXY,2);assert.equal(actual.count,3);assert.equal(actual.finite,false);assert(actual.errorCount>0);return{actual};
});
check('three-component proposal has finite exact bounds and identical XY bits',()=>{
  const actual=inspect(spatialXYZ,3);assert.equal(actual.count,3);assert.equal(actual.finite,true);assert.equal(actual.errorCount,0);assert.deepEqual(actual.xyBits,bits(legacyXY));assert.deepEqual(actual.centre,[1,1,0]);assert.equal(actual.radius,Math.sqrt(8));return{actual};
});
for(const file of files)check('current production geometry: '+file,()=>{
  const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const match=source.match(/geometry\.setAttribute\(\s*['"]position['"]\s*,\s*new THREE\.Float32BufferAttribute\(\s*\[([^\]]+)\]\s*,\s*(\d+)\s*\)\s*\)/);
  assert(match,'The actual position initializer must be present');
  const values=match[1].split(',').map(x=>Number(x.trim())),itemSize=Number(match[2]);assert(values.every(Number.isFinite));
  const actual=inspect(values,itemSize);assert.equal(itemSize,3);assert.equal(actual.count,3);assert.equal(actual.finite,true);assert.equal(actual.errorCount,0);assert.deepEqual(actual.xyBits,bits(legacyXY));
  for(let i=0;i<values.length;i+=3)assert.equal(values[i+2],0);
  return{sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),actual};
});
const report={scope:'Actual Three CPU computeBoundingSphere and Float32 XY bit preservation; no GPU, shader or native image proof',threeRevision:THREE.REVISION,passed:checks.every(c=>c.passed),checks};
fs.writeFileSync(new URL('./r17-fullscreen-position-geometry-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
