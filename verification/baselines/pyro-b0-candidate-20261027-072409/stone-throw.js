// A metric first-person pebble; exact linearized drag and swept collision.
export const STONE_DENSITY=2600,STONE_GRAVITY=9.81,STONE_DRAG=.12;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function stoneLaunchSpeed(charge=0){const x=clamp(charge,0,1);return 5+17*(x*x*(3-2*x));}
export function sampleStonePath(start,velocity,time,drag=STONE_DRAG){
  const t=Math.max(0,time),a=drag>1e-8?-Math.expm1(-drag*t)/drag:t,e=drag>1e-8?Math.exp(-drag*t):1;
  const drop=drag>1e-8?-STONE_GRAVITY*(t-a)/drag:-.5*STONE_GRAVITY*t*t;
  return {position:start.map((v,i)=>v+velocity[i]*a+(i===1?drop:0)),velocity:velocity.map((v,i)=>v*e+(i===1?-STONE_GRAVITY*a:0))};
}
export function findStoneImpact({start,velocity,from=0,to,surfaceHeight=()=>0,terrainHeight=()=>-32,born=0}){
  const sample=age=>{const s=sampleStonePath(start,velocity,age),[x,y,z]=s.position,w=surfaceHeight(x,z,born+age),land=terrainHeight(x,z);return{...s,age,height:Math.max(w,land),kind:land>w?'land':'water',distance:y-Math.max(w,land)};};
  let a=sample(from);if(a.distance<0)return{...a,position:[a.position[0],a.height,a.position[2]]};
  const steps=Math.max(1,Math.ceil((to-from)*120));
  for(let i=1;i<=steps;i++){const b=sample(from+(to-from)*i/steps);if(b.distance<=0){let lo=a.age,hi=b.age;for(let k=0;k<18;k++){const m=(lo+hi)*.5;if(sample(m).distance>0)lo=m;else hi=m;}const hit=sample((lo+hi)*.5);hit.position[1]=hit.height;return hit;}a=b;}
  return null;
}

export function createStoneThrow(THREE,{scene,onImpact=()=>{},surfaceHeight=()=>0,terrainHeight=()=>-32,maxStones=12}={}){
  const geometry=new THREE.IcosahedronGeometry(.0125,1),material=new THREE.MeshStandardMaterial({color:'#514d45',roughness:.7});
  const stones=[],resting=[];let serial=0,lastTime=0;
  function add(start,velocity,time,{diameter=.025,charge=0}={}){
    if(stones.length>=maxStones)return{launched:false,reason:'too-many-active-stones'};
    const mesh=new THREE.Mesh(geometry,material);mesh.name='First-person metric pebble';mesh.castShadow=true;mesh.frustumCulled=false;mesh.scale.setScalar(diameter/.025);mesh.position.fromArray(start);scene.add(mesh);
    const item={id:++serial,start:[...start],velocity:[...velocity],born:time,age:0,diameter,charge,mass:STONE_DENSITY*Math.PI*diameter**3/6,mesh};stones.push(item);return{launched:true,id:item.id,speed:Math.hypot(...velocity),diameterMetres:diameter,charge};
  }
  return {material,
    launchRay(camera,direction,charge,time){const dir=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize();const start=camera.position.clone().addScaledVector(dir,.24).addScaledVector(right,.12).add(new THREE.Vector3(0,-.12,0));start.y=Math.max(start.y,terrainHeight(start.x,start.z)+.04,surfaceHeight(start.x,start.z,time)+.04);const speed=stoneLaunchSpeed(charge);return add(start.toArray(),dir.multiplyScalar(speed).toArray(),time,{charge});},
    // Compatibility for saved fixtures. Interactive UI now uses launchRay.
    launch(camera,x,z,time){const start=camera.position.clone(),duration=.72,a=-Math.expm1(-STONE_DRAG*duration)/STONE_DRAG,target=new THREE.Vector3(x,surfaceHeight(x,z,time+duration),z),v=target.sub(start).divideScalar(a);v.y+=STONE_GRAVITY*(duration-a)/(STONE_DRAG*a);return add(start.toArray(),v.toArray(),time);},
    update(time){lastTime=time;for(let i=stones.length-1;i>=0;i--){const s=stones[i],age=Math.min(14,Math.max(0,time-s.born)),hit=findStoneImpact({start:s.start,velocity:s.velocity,from:s.age,to:age,born:s.born,surfaceHeight,terrainHeight});if(hit){s.mesh.position.fromArray(hit.position);stones.splice(i,1);const speed=Math.hypot(...hit.velocity),event={id:s.id,time:s.born+hit.age,position:hit.position,velocity:hit.velocity,normalSpeed:Math.abs(hit.velocity[1]),speed,diameter:s.diameter,mass:s.mass,energy:.5*s.mass*speed*speed,kind:hit.kind,charge:s.charge};if(hit.kind==='land'){s.mesh.rotation.set(s.id*.91,s.id*.37,s.id*.23);resting.push(s.mesh);while(resting.length>24)scene.remove(resting.shift());}else scene.remove(s.mesh);onImpact(hit.position[0],hit.position[2],event);continue;}if(age>=14){scene.remove(s.mesh);stones.splice(i,1);continue;}const p=sampleStonePath(s.start,s.velocity,age);s.mesh.position.fromArray(p.position);s.mesh.rotation.set(age*9,age*12,age*5);s.age=age;}},
    get state(){return stones.map(s=>({id:s.id,diameterMetres:s.diameter,massKg:s.mass,charge:s.charge,age:Math.max(0,lastTime-s.born),position:s.mesh.position.toArray(),start:s.start,initialVelocity:s.velocity}));},
    dispose(){stones.forEach(s=>scene.remove(s.mesh));resting.forEach(s=>scene.remove(s));stones.length=resting.length=0;geometry.dispose();material.dispose();}
  };
}
