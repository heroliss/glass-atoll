import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createLocalLights,GROUND_LAMP_RADIUS} from '../local-lights.js';
import {RAW_PER_CANDELA} from '../scene-radiometry.js';

const source=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const terrainText=source.match(/export function terrainHeight\(x,z\)\{[\s\S]*?\n\}/)[0].replace('export ','');
const terrainHeight=new Function(terrainText+'; return terrainHeight;')();
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(0,2,0);camera.lookAt(0,2,-1);camera.updateMatrixWorld();
const local=createLocalLights(THREE,{scene,terrainHeight}),checks=[];
const close=(a,b)=>assert(Math.abs(a-b)<1e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}}
const frame={time:0,dt:1/60,storageEV:2,sceneScale:4,rawPerCandela:RAW_PER_CANDELA};
const update=()=>local.update({frame,camera,sunAltitude:-20});
try{
  local.configure({mode:'on',lamps:[0,1,2].map(()=>({enabled:true,brightness:1,color:'#ffffff'}))});update();
  check('three lights surround the island centre rather than occupy one side',()=>{
    const p=local.state.lights.slice(0,3).map(r=>[r.position[0],r.position[2]]),centre=[-1.5,-1];
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const signs=p.map((a,i)=>cross(a,p[(i+1)%3],centre));assert(signs.every(v=>v>0)||signs.every(v=>v<0));
    const bearings=p.map(q=>Math.atan2(q[1]-centre[1],q[0]-centre[0])).sort((a,b)=>a-b);
    const gaps=bearings.map((b,i)=>(bearings[(i+1)%3]-b+2*Math.PI)%(2*Math.PI));assert(Math.max(...gaps)<Math.PI);
  });
  check('fixtures sit on dry sand at a realistic low height',()=>{
    for(const r of local.records.slice(0,3)){const h=terrainHeight(r.position.x,r.position.z);assert(h>.4);close(r.position.y-h,.108);}
    assert(local.state.fixture.heightMetres>.15&&local.state.fixture.heightMetres<.20);
    local.root.traverse(o=>{if(o.isMesh)assert(o.castShadow&&o.receiveShadow);});
  });
  check('all three native sources and shared receiver slots are omnidirectional',()=>{
    for(let i=0;i<3;i++){assert(local.records[i].light.isPointLight);assert.equal(local.uniforms.uLocalDirection.value[i].w,0);assert.equal(local.uniforms.uLocalCone.value[i].x,-1);}
  });
  check('equal radius gives equal inverse-square incident light over 360 degrees',()=>{
    for(const r of local.records.slice(0,3))for(let angle=0;angle<360;angle+=5){
      const a=angle*Math.PI/180,p=r.position.clone().add(new THREE.Vector3(2*Math.cos(a),0,2*Math.sin(a))),distance=r.position.distanceTo(p);
      const cut=Math.max(0,1-(distance/r.range)**4),actual=r.rawRGB[0]*frame.sceneScale*cut*cut/(distance*distance);
      const expected=65*RAW_PER_CANDELA*4*(1-(2/45)**4)**2/4;close(actual,expected);
    }
  });
  check('opal globe emission agrees with the finite spherical source radiance',()=>{
    const emitters=[];local.root.traverse(o=>{if(o.name==='Unshielded frosted opal sphere')emitters.push(o);});assert.equal(emitters.length,3);
    for(const o of emitters){assert(o.geometry.type==='SphereGeometry');close(o.geometry.parameters.radius,GROUND_LAMP_RADIUS);close(o.material.emissive.r,65*RAW_PER_CANDELA*4/(Math.PI*GROUND_LAMP_RADIUS**2));assert(o.material.color.r>0);}
  });
  check('source emission and shared RGB scale together when storage exposure changes',()=>{
    const material=local.root.children[0].getObjectByName('Unshielded frosted opal sphere').material,colour=material.color.toArray(),before=material.emissive.r;
    local.setSceneExposure(3);close(material.emissive.r,before*2);close(local.uniforms.uLocalColour.value[0].x,65*RAW_PER_CANDELA*8);assert.deepEqual(material.color.toArray(),colour);
  });
  check('finite source and inverse-square clamp fit the conservative raw bound',()=>{
    for(const r of local.records.slice(0,3)){assert(local.getRadianceBound().maxRGB>=Math.max(...r.rawRGB)/(Math.PI*r.radius**2));assert(local.getRadianceBound().maxRGB>=Math.max(...r.rawRGB)/(r.radius*r.radius));}
  });
  check('disabling a lamp removes emission but retains a daylight-visible diffuser',()=>{
    local.configure({index:1,enabled:false});update();assert.equal(local.records[1].candela,0);
    const m=local.root.children[1].getObjectByName('Unshielded frosted opal sphere').material;assert(m.emissive.toArray().every(c=>c===0));assert(m.color.r>.5&&m.roughness>.4);
  });
  check('torch keeps its cone and remains the only shadow-casting local light',()=>{
    local.configure({flashlight:{enabled:true}});update();assert(local.records[3].light.isSpotLight);assert.equal(local.uniforms.uLocalDirection.value[3].w,1);assert(local.records[3].light.castShadow);
    assert(local.records.filter(r=>r.light.castShadow).length===1);
  });
  check('night policy and linked colour brightness still apply to all three lamps',()=>{
    local.configure({mode:'night',linked:true,index:0,enabled:true,brightness:.52,color:'#f2bb77'});update();
    assert(local.state.lamps.every(l=>l.brightness===.52&&l.color==='#f2bb77'));assert(local.records.slice(0,3).every(r=>r.candela>0));
    local.update({frame,camera,sunAltitude:20});assert(local.records.slice(0,3).every(r=>r.candela===0));
  });
}finally{local.dispose();}
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,limits:['Actual module topology, placement, source algebra and controls; browser images and real GPU range are checked separately.','Point lights approximate a finite spherical emitter; three ground lights have no occluder shadow maps.']};
writeFileSync(new URL('ground-lamps-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
