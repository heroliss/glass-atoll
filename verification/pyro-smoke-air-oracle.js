// Independent CPU reference for the disclosed four-cell front-air model.
// No renderer imports, exposure state or shader-source evaluation.
export function frontAirOracle({origin,direction,start=0,end,air}){
  let T=[1,1,1],S=[0,0,0];if(!air?.enabled||end-start<1e-5)return {T,S};
  const sunDirection=air.sunDirection??[0,1,0],length=Math.hypot(...sunDirection),mu=Math.max(-1,Math.min(1,direction.reduce((a,v,i)=>a+v*sunDirection[i]/length,0))),g=air.asymmetry??.76;
  const phaseR=3/(16*Math.PI)*(1+mu*mu),phaseM=(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5),D=end-start;
  for(let i=0;i<4;i++){
    const a=i/4,b=(i+1)/4,ds=(b*b-a*a)*D,h=Math.max(0,origin[1]+direction[1]*(start+(a*a+b*b)*.5*D));
    for(let c=0;c<3;c++){
      const r=(air.betaRayleighRGB??[0,0,0])[c]*Math.exp(-h/(air.rayleighHeight??8000)),m=(air.betaMieScatteringRGB??[0,0,0])[c]*Math.exp(-h/(air.aerosolHeight??1200)),ext=r+(air.betaMieExtinctionRGB??[0,0,0])[c]*Math.exp(-h/(air.aerosolHeight??1200)),cellT=Math.exp(-ext*ds),integral=ext*ds<1e-5?ds:-Math.expm1(-ext*ds)/ext;
      S[c]+=T[c]*(air.rawSunRGB??[0,0,0])[c]*(r*phaseR+m*phaseM)*integral;T[c]*=cellT;
    }
  }
  return {T,S};
}

export function homogeneousAirOracle({distance,direction,air}){
  const d=air.sunDirection??[0,1,0],n=Math.hypot(...d),mu=direction.reduce((a,v,i)=>a+v*d[i]/n,0),g=air.asymmetry??.76,R=3/(16*Math.PI)*(1+mu*mu),M=(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5);
  const T=[],S=[];for(let c=0;c<3;c++){const r=(air.betaRayleighRGB??[0,0,0])[c],m=(air.betaMieScatteringRGB??[0,0,0])[c],ext=r+(air.betaMieExtinctionRGB??[0,0,0])[c];T[c]=Math.exp(-ext*distance);S[c]=(air.rawSunRGB??[0,0,0])[c]*(r*R+m*M)*(ext?-Math.expm1(-ext*distance)/ext:distance);}
  return {T,S};
}
