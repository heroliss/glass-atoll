// A visible 25 mm pebble follows a ballistic path before the existing splash.
export function createStoneThrow(THREE,{scene,onImpact=()=>{},surfaceHeight=()=>0}){
  const geometry=new THREE.IcosahedronGeometry(.0125,1),material=new THREE.MeshStandardMaterial({color:'#514d45',roughness:.7});
  const stones=[];let serial=0;
  return {material,
    launch(camera,x,z,time){
      const forward=new THREE.Vector3(),right=new THREE.Vector3();camera.getWorldDirection(forward);right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
      const start=camera.position.clone().addScaledVector(forward,.35).addScaledVector(right,.18).add(new THREE.Vector3(0,-.16,0));
      const target=new THREE.Vector3(x,surfaceHeight(x,z,time+.72),z),duration=.72;
      const velocity=target.clone().sub(start).divideScalar(duration);velocity.y+=4.905*duration;
      const mesh=new THREE.Mesh(geometry,material);mesh.name='Flying 25 mm pebble';mesh.castShadow=true;mesh.frustumCulled=false;mesh.position.copy(start);scene.add(mesh);
      while(stones.length>=3)scene.remove(stones.shift().mesh);
      const item={id:++serial,start,target,velocity,duration,born:time,mesh};stones.push(item);return {id:item.id,target:target.toArray(),duration};
    },
    update(time){for(let i=stones.length-1;i>=0;i--){const s=stones[i],t=Math.max(0,time-s.born);if(t>=s.duration){scene.remove(s.mesh);stones.splice(i,1);onImpact(s.target.x,s.target.z);continue;}s.mesh.position.copy(s.start).addScaledVector(s.velocity,t).add(new THREE.Vector3(0,-4.905*t*t,0));s.mesh.rotation.set(t*9,t*12,t*5);}},
    get state(){return stones.map(s=>({id:s.id,diameterMetres:.025,position:s.mesh.position.toArray(),target:s.target.toArray(),duration:s.duration}));},
    dispose(){stones.forEach(s=>scene.remove(s.mesh));stones.length=0;geometry.dispose();material.dispose();}
  };
}
