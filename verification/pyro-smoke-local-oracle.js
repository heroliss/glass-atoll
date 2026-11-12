// Independent JS incident-light calculation for isolated test receivers.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function localIncidentOracle(uniforms,point,index,{shadowVisibility=1}={}){
  const p=uniforms.uLocalPosition.value[index],c=uniforms.uLocalColour.value[index],dir=uniforms.uLocalDirection.value[index],cone=uniforms.uLocalCone.value[index],delta=[p.x-point[0],p.y-point[1],p.z-point[2]],distance2=delta.reduce((s,v)=>s+v*v,0),L=delta.map(v=>v/Math.sqrt(Math.max(distance2,1e-10)));
  let denominator=Math.max(distance2,p.w*p.w);if(index<3)denominator=Math.max(denominator,.01);
  let coneFactor=1;if(dir.w>.5){const cosine=-L[0]*dir.x-L[1]*dir.y-L[2]*dir.z,t=clamp((cosine-cone.x)/(cone.y-cone.x),0,1);coneFactor=t*t*(3-2*t);}
  const cutDistance=index<3?Math.sqrt(distance2):Math.sqrt(denominator),cut=Math.max(0,1-(cutDistance/Math.max(cone.z,.01))**4),visibility=index===3?shadowVisibility:1,factor=coneFactor*cut*cut*visibility/denominator;
  return {RGB:Math.max(c.x,c.y,c.z)<1e-12?[0,0,0]:[c.x*factor,c.y*factor,c.z*factor],L,denominator,coneFactor,rangeFactor:cut*cut};
}
export function smokePhaseHG(mu,g=.32){return(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5);}
