import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {fitPerspectiveBounds} from '../camera-framing.js';
import {fitPerspectiveBounds as legacyFit} from './r11-reflection-framing-baseline.js';
const hash=s=>createHash('sha256').update(s).digest('hex'),source=readFileSync(new URL('../camera-framing.js',import.meta.url),'utf8'),expected=process.argv[2],checks=[];
assert.match(expected??'',/^[a-f0-9]{64}$/);assert.equal(hash(source),expected);
const test=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}};
const corners=b=>Array.from({length:8},(_,i)=>new T.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z));
const input=(c,b,v)=>JSON.stringify({camera:c.toJSON(),min:b.min.toArray(),max:b.max.toArray(),bearing:v?.toArray()});
function ndc(camera,position,target,points){const c=camera.clone();c.position.copy(position);c.lookAt(target);c.updateMatrixWorld();const p=points.map(v=>v.clone().project(c));return{maxXY:Math.max(...p.flatMap(v=>[Math.abs(v.x),Math.abs(v.y)])),minZ:Math.min(...p.map(v=>v.z)),maxZ:Math.max(...p.map(v=>v.z))};}
test('virtual image and real water hit obey reflection and share perspectiveXY',()=>{
 const eye=new T.Vector3(-84,11,-122),cam=new T.PerspectiveCamera(55,16/9,.15,24000);cam.position.copy(eye);cam.lookAt(0,0,0);cam.updateMatrixWorld();let maximumDirectionError=0,maximumProjectedXYError=0;
 for(const plane of [0,3])for(const S of [new T.Vector3(20,90,10),new T.Vector3(-40,180,50),new T.Vector3(90,30,-15)]){
  const virtual=S.clone().setY(2*plane-S.y),t=(plane-eye.y)/(virtual.y-eye.y),P=eye.clone().lerp(virtual,t);assert(t>0&&t<1&&Math.abs(P.y-plane)<1e-12);
  const incoming=P.clone().sub(S).normalize(),reflected=incoming.clone().reflect(new T.Vector3(0,1,0)),outgoing=eye.clone().sub(P).normalize();maximumDirectionError=Math.max(maximumDirectionError,reflected.distanceTo(outgoing));
  const a=virtual.clone().project(cam),b=P.clone().project(cam);maximumProjectedXYError=Math.max(maximumProjectedXYError,Math.abs(a.x-b.x),Math.abs(a.y-b.y));
 }assert(maximumDirectionError<1e-14&&maximumProjectedXYError<1e-13);return{rays:6,maximumDirectionError,maximumProjectedXYError,scope:'ideal horizontal mirror, not perturbed waves/occlusion'};
});
test('portrait wide and offaxis perspective fits preserve input ownership',()=>{
 const rows=[];for(const opt of [{fov:50,aspect:1.6,plane:0,eye:8},{fov:65,aspect:.6,plane:4.5,eye:12},{fov:45,aspect:2,plane:-2,eye:2.5}]){
  const cam=new T.PerspectiveCamera(opt.fov,opt.aspect,.15,24000);cam.position.set(-48,opt.eye,-40);cam.lookAt(0,50,0);cam.updateMatrixWorld();if(opt.aspect===2){cam.setViewOffset(1920,1080,120,60,1600,900);cam.updateProjectionMatrix();}
  const box=new T.Box3(new T.Vector3(-35,5,-20),new T.Vector3(120,180,70)),bearing=new T.Vector3(.3,17,-1),before=input(cam,box,bearing),fit=fitPerspectiveBounds(T,cam,box,{eyeHeight:opt.eye,bearing,margin:.88,reflectionPlaneY:opt.plane}),ps=corners(box).flatMap(p=>[p,p.clone().setY(2*opt.plane-p.y)]),p=ndc(cam,fit.position,fit.target,ps);
  assert(p.maxXY<=.88&&p.minZ>=-1&&p.maxZ<=1);assert.equal(fit.position.y,opt.eye);assert.equal(fit.target.y,opt.plane);assert.equal(input(cam,box,bearing),before);fit.position.x=999;fit.target.z=999;fit.reflectionFraming.sourceBounds.min[0]=999;assert.equal(input(cam,box,bearing),before);rows.push({...opt,...p});
 }return{configurations:rows,cornerProjections:48,includesOffAxisView:true};
});
test('known finite validfar interval now fits despite initial diagonal beyondfar',()=>{
 const cam=new T.PerspectiveCamera(120,1,.15,125);cam.position.set(-70,8,0);cam.lookAt(0,0,0);cam.updateMatrixWorld();const box=new T.Box3(new T.Vector3(-20,0,-20),new T.Vector3(20,80,20)),bearing=new T.Vector3(-1,0,0),before=input(cam,box,bearing),ps=corners(box).flatMap(p=>[p,p.clone().setY(-p.y)]),manual=ndc(cam,new T.Vector3(-80,8,0),new T.Vector3(0,0,0),ps);
 assert(manual.maxXY<.9&&manual.minZ>=-1&&manual.maxZ<=1);const fit=fitPerspectiveBounds(T,cam,box,{eyeHeight:8,margin:.9,bearing,reflectionPlaneY:0}),actual=ndc(cam,fit.position,fit.target,ps);assert(actual.maxXY<=.9&&actual.minZ>=-1&&actual.maxZ<=1);assert.equal(input(cam,box,bearing),before);
 return{fov:120,aspect:1,near:.15,far:125,sourceBounds:{min:box.min.toArray(),max:box.max.toArray()},manualDistance80:manual,fittedDistance:fit.horizontalDistance,actual,first69e35IncorrectRejectionPreserved:true};
});
test('impossible clipping volume and invalid plane reject without touching inputs',()=>{
 const c=new T.PerspectiveCamera(50,1.6,.15,3);c.position.set(-70,8,0);c.lookAt(0,0,0);c.updateMatrixWorld();const b=new T.Box3(new T.Vector3(-20,0,-20),new T.Vector3(20,80,20)),v=new T.Vector3(-1,0,0),before=input(c,b,v);assert.throws(()=>fitPerspectiveBounds(T,c,b,{eyeHeight:8,bearing:v,reflectionPlaneY:0}),RangeError);assert.throws(()=>fitPerspectiveBounds(T,c,b,{reflectionPlaneY:NaN,bearing:v}),RangeError);assert.equal(input(c,b,v),before);return{cases:2,far3CannotContainSuppliedBox:true};
});
test('legacy defaults remain exact and main causality needs only one option',()=>{
 const c=new T.PerspectiveCamera(50,1.6,.15,24000);c.position.set(-48,8,-40);c.lookAt(0,50,0);c.updateMatrixWorld();const b=new T.Box3(new T.Vector3(-35,0,-20),new T.Vector3(120,180,70)),opts={eyeHeight:8,margin:.9};assert.deepEqual(fitPerspectiveBounds(T,c,b,opts),legacyFit(T,c,b,opts));assert.deepEqual(fitPerspectiveBounds(T,c,b,{...opts,reflectionPlaneY:undefined}),legacyFit(T,c,b,opts));
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8'),start=main.indexOf('function frameFireworks(){'),end=main.indexOf('\nfunction launchFirework',start),body=main.slice(start,end);assert(body.includes('fireworks.getBounds()'));assert(body.includes('box.expandByPoint(new THREE.Vector3(...b.min))'));assert(body.includes('box.expandByPoint(new THREE.Vector3(...b.max))'));const call=body.match(/fitPerspectiveBounds\([^\n]+/)[0];
 return{defaultNumericAndReturnShapeExact:true,currentMainCall:call,wiringPresent:call.includes('reflectionPlaneY:0'),sourceCausality:'Existing physical forecast and island bounds remain input; mirror is virtual framing geometry, not a new emitter, source mass, flight path or exposure. Existing caller terrain clamp remains separate.'};
});
assert.equal(hash(readFileSync(new URL('../camera-framing.js',import.meta.url),'utf8')),expected);
const report={schema:'glass-atoll.r11-reflection-independent.v2',actualGPU:false,dateUTC:new Date().toISOString(),sourceSHA256:expected,checks,counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},limits:['Narrow read-only actual THREE projection and geometric ray review; root actual scene evidence remains separate.','Fixed original far125 counterexample and impossiblefar3 are checked, not a universal proof of every arbitrary camera/custom clipping projection.','Ideal virtual planar source coverage only; wave perturbations, finite ocean extent, terrain occlusion, bloom and composition/photo quality are not established.']};report.passed=checks.every(x=>x.passed);
const out=new URL('./r11-reflection-independent-check.json',import.meta.url),first=new URL('./r11-reflection-independent-check-first.json',import.meta.url);if(existsSync(out)&&!existsSync(first))writeFileSync(first,readFileSync(out));writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:expected,failures:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
