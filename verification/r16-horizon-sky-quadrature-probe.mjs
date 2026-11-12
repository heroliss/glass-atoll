import{writeFileSync}from'node:fs';
import{solarTransmittance}from'../sky.js';
const R=6360000,TOP=6460000,BR=[5.802e-6,13.558e-6,33.1e-6],BM=3.996e-6,BO=[.650e-6,1.881e-6,.085e-6],mie=13.83813578196115,sun=[.9770159647047041,-.005236520029459973,.2131018150324338];
function ray(rd,steps=8,power=2,exact=false,height=12){
 const origin=[-48,R+height,-40],b=origin.reduce((s,v,i)=>s+v*rd[i],0),r=Math.hypot(...origin),c=(r-R)*(r+R),disc=b*b-c,hit=disc>0&&b<0;let len=-b+Math.sqrt(b*b-(r-TOP)*(r+TOP));if(hit)len=Math.min(len,Math.max(0,-b-Math.sqrt(disc)));
 const mu=rd.reduce((s,v,i)=>s+v*sun[i],0),pr=3/(16*Math.PI)*(1+mu*mu),g=.76,pm=(1-g*g)/(4*Math.PI*Math.max(.0001,1+g*g-2*g*mu)**1.5),opt=[0,0,0],L=[0,0,0];
 for(let i=0;i<steps;i++){
  const a=(i/steps)**power,z=((i+1)/steps)**power,d=(a+z)*len*.5,ds=(z-a)*len,p=origin.map((v,c)=>v+rd[c]*d),r=Math.hypot(...p),h=Math.max(0,r-R),de=[Math.exp(-h/8000),Math.exp(-h/1200),Math.max(0,1-Math.abs(h-25000)/15000)],st=solarTransmittance(Math.asin(p.reduce((s,v,c)=>s+v*sun[c],0)/r),h,mie);
  for(let c=0;c<3;c++){const beta=BR[c]*de[0]+BM*mie*de[1]+BO[c]*de[2],tau=BR[c]*opt[0]+BM*mie*opt[1]+BO[c]*opt[2],integral=exact?(beta>1e-14?-Math.expm1(-beta*ds)/beta:ds):Math.exp(-beta*ds*.5)*ds;L[c]+=Math.exp(-tau)*st[c]*(BR[c]*de[0]*pr+BM*mie*.9*de[1]*pm)*integral;}
  de.forEach((v,c)=>opt[c]+=v*ds);
 }
 return{L:L.map((v,c)=>v*22+(1-Math.exp(-(BR[c]*opt[0]+BM*mie*opt[1]+BO[c]*opt[2])))*[.006,.010,.017][c]*Math.max(0,sun[1]+.12)),rayLength:len,hit};
}
const results=[];for(const az of [Math.atan2(48,40),Math.atan2(48,40)+.6,Math.atan2(48,40)-.6])for(const el of [-.11,0,.05,.1,.2,.4,.8,1,2,5,15,45,85]){
 const elev=el*Math.PI/180,rd=[Math.sin(az)*Math.cos(elev),Math.sin(elev),Math.cos(az)*Math.cos(elev)];
 results.push({azimuth:az,elevation:el,legacy:ray(rd),exact8:ray(rd,8,2,true),cubic8:ray(rd,8,3,true),quartic8:ray(rd,8,4,true),ref:ray(rd,4096,2,true)});
}
writeFileSync(new URL('./r16-horizon-sky-quadrature-probe.json',import.meta.url),JSON.stringify({mie,sun,results},null,2));
for(const r of results.slice(0,13))console.log(r.elevation,[r.legacy,r.exact8,r.cubic8,r.quartic8,r.ref].map(x=>x.L[0].toPrecision(4)).join(' '),r.legacy.rayLength.toFixed(0));
