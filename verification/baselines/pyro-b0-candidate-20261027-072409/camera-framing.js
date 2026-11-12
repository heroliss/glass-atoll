// Fits the actual perspective projection instead of the box's diagonal sphere.
// The observer retains a low eye height; every forecast corner stays inside.
export function fitPerspectiveBounds(THREE,camera,box,{eyeHeight=8,margin=.90,bearing=null}={}){
  const center=box.getCenter(new THREE.Vector3()),axis=bearing?.clone()||camera.position.clone().sub(center);axis.y=0;if(axis.lengthSq()<1e-8)axis.set(-1,0,-1);axis.normalize();
  const probe=camera.clone(),p=new THREE.Vector3(),position=new THREE.Vector3(),corners=[];
  for(let i=0;i<8;i++)corners.push(new THREE.Vector3(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z));
  const fits=distance=>{position.copy(center).addScaledVector(axis,distance);position.y=eyeHeight;probe.position.copy(position);probe.lookAt(center);probe.updateMatrixWorld();return corners.every(c=>{p.copy(c).project(probe);return p.z>=-1&&p.z<=1&&Math.abs(p.x)<=margin&&Math.abs(p.y)<=margin;});};
  let lo=.5,hi=Math.max(20,box.getSize(new THREE.Vector3()).length());while(!fits(hi)&&hi<100000)hi*=1.5;
  for(let i=0;i<34;i++){const mid=(lo+hi)*.5;if(fits(mid))hi=mid;else lo=mid;}fits(hi*1.002);
  return{position:position.clone(),target:center,distance:position.distanceTo(center),horizontalDistance:hi*1.002,margin};
}
