// Independent binary64 zero-omission CPU model; no GL or display exposure.
import {createPyroSmokeColumns} from '../pyro-smoke-columns.js';
const white=(L,x)=>{const a=x[0]/L[0],b=(x[1]-L[1]*a)/L[2];return[a,b,(x[2]-L[3]*a-L[4]*b)/L[5]];},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function referenceSmokeTransmission(input,packed){
  const {snapshot,count,endpoints64,origins64,active,eye}=input,physical=new Float64Array(count*4),quantized=new Float64Array(count*4),field=createPyroSmokeColumns(snapshot,{columnKernel:'scalar',errorBudget:0}),packets=[];
  for(let i=0;i<packed.packets;i++){const o=i*16,d=packed.packetData,L=Array.from(d.subarray(o+4,o+10)),[a,b,c,e,f,g]=L,cov=[a*a,a*b,a*e,a*b,b*b+c*c,b*e+c*f,a*e,b*e+c*f,e*e+f*f+g*g],mean=Array.from(d.subarray(o,o+3)),ext=[d[o+10],d[o+11],d[o+12]],mass=d[o+3]*(2*Math.PI)**1.5*a*c*g,s={revision:0,profiles:[{id:'r',extinctionPerMassRGB:ext}],packets:[{id:0,profileId:'r',mean,covariance:cov,mass}]};packets.push({L,mean,field:createPyroSmokeColumns(s,{columnKernel:'scalar',errorBudget:0})});}
  for(let i=0;i<count;i++){const o=i*4,s=i*12;if(active[i]===1){const from=origins64?Array.from(origins64.subarray(i*3,i*3+3)):Array.from(eye),to=Array.from(endpoints64.subarray(i*3,i*3+3));physical.set(field.between(from,to).T,o);}else physical.set([1,1,1],o);physical[o+3]=1;
    const d=packed.sourceData,tau=[0,0,0];if(d[s+7]>.5&&d[s+3]>0){const start=Array.from(d.subarray(s,s+3)),end=Array.from(d.subarray(s+4,s+7)),v=Array.from(d.subarray(s+8,s+11)),norm=Math.hypot(...v),unit=v.map(x=>x/norm);for(const p of packets){const qa=white(p.L,start.map((x,c)=>x-p.mean[c])),qb=white(p.L,end.map((x,c)=>x-p.mean[c])),reverse=dot(qb,qb)<dot(qa,qa),q=p.field.query({origin:reverse?end:start,direction:reverse?unit.map(x=>-x):unit,start:0,end:d[s+3],errorBudget:0});for(let c=0;c<3;c++)tau[c]+=q.tauRGB[c];}}
    for(let c=0;c<3;c++)quantized[o+c]=Math.exp(-tau[c]);quantized[o+3]=1;
  }return{physical,quantized,count,method:'Original world-double zero-budget columns vs quantized-double packet/ray model with nearer-endpoint reversal; no GPU Float32 arithmetic emulation'};
}
