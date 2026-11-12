import fs from 'node:fs';
import * as THREE from '../../vendor/three.module.js';
const root=new URL('../../',import.meta.url),source=fs.readFileSync(new URL('fireworks.js',root),'utf8'),seam='api.configure({});return api;';
const s=source.replace(seam,'api.__receiverAudit={simulation,records:()=>records};'+seam).replace(/from (['"])(\.\/[^'\"]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),root).href}'`),mod=await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const probes=[[-20,1.3,-10],[0,1.3,0],[20,1.3,8],[30,1.3,0],[-8,10,-2],[0,15,0],[10,8,8]].flatMap(p=>[[p,[0,1,0]],[p,[1,0,0]],[p,[-1,0,0]],[p,[0,0,1]],[p,[0,0,-1]]]);
function field(rows){return probes.map(([p,n])=>rows.reduce((sum,s)=>{const d=s.position.map((v,c)=>v-p[c]),q=d.reduce((a,v)=>a+v*v,0),dist=Math.sqrt(q),cos=Math.max(0,d.reduce((a,v,c)=>a+v*n[c],0)/dist),k=cos*(Math.max(0,1-(dist/4096)**4)**2)/Math.max(.01,q),rgb=s.emissionRGBReference??(s.color??s.colour).map(v=>v*(s.referenceCandela??s.intensity));return sum.map((v,c)=>v+rgb[c]*k);},[0,0,0]));}
function rms(a,b){let num=0,den=0;for(let i=0;i<a.length;i++)for(let c=0;c<3;c++){num+=(a[i][c]-b[i][c])**2;den+=b[i][c]**2;}return Math.sqrt(num/Math.max(1e-30,den));}
function soft4(rows,{type='quadrants',sharp=4,radial=80}={}){
 const O=[0,1.3,0],bins=Array.from({length:4},()=>({I:0,E:0,rgb:[0,0,0],v:[0,0,0]}));
 for(const p of rows){const d=p.position.map((v,c)=>v-O[c]),r2=Math.max(1,d.reduce((s,v)=>s+v*v,0)),r=Math.sqrt(r2),u=d.map(v=>v/r),I=p.intensity,rgb=p.emissionRGBReference??p.colour.map(v=>v*I);let weights;
  if(type==='quadrants'){weights=[0,1,2,3].map(i=>Math.exp(sharp*(u[0]*Math.cos(i*Math.PI/2)+u[2]*Math.sin(i*Math.PI/2))));const total=weights.reduce((s,v)=>s+v,0);weights=weights.map(v=>v/total);}
  else if(type==='near3'){const near=1/(1+(r/radial)**4),far=[0,1,2].map(i=>Math.exp(sharp*(u[0]*Math.cos(i*2*Math.PI/3)+u[2]*Math.sin(i*2*Math.PI/3)))),total=far.reduce((s,v)=>s+v,0);weights=[near,...far.map(v=>v/total*(1-near))];}
  else if(type==='near2far2'){const near=1/(1+(r/radial)**4),side=.5+.5*Math.tanh(sharp*u[0]);weights=[near*side,near*(1-side),(1-near)*side,(1-near)*(1-side)];}
  for(let i=0;i<4;i++){const b=bins[i],w=weights[i],E=w*I/r2;b.I+=w*I;b.E+=E;for(let c=0;c<3;c++){b.v[c]+=u[c]*E;b.rgb[c]+=w*rgb[c]/r2;}}
 }
 return bins.filter(b=>b.I>0).map(b=>{const norm=Math.hypot(...b.v),r=Math.sqrt(b.I/b.E);return {position:b.v.map((v,c)=>O[c]+v/Math.max(1e-20,norm)*r),referenceCandela:b.I,color:b.rgb.map(v=>v/b.E),radius:2};});
}
const scenarios=[
{name:'two-opposed',events:[{type:'display-flower',azimuth:30},{type:'display-heart',azimuth:210}]},
{name:'six-show',events:['display-saturn','display-vfan','display-brocade','display-double','peony','willow'].map((type,i)=>({type,azimuth:65+i*13,elevation:65+i*3}))},
{name:'staggered',events:[{type:'display-flower',azimuth:110,launchAt:0},{type:'display-brocade',azimuth:240,launchAt:6.5},{type:'display-vfan',azimuth:310,launchAt:7.3}]},
];const variants=[{type:'quadrants',sharp:4},{type:'quadrants',sharp:12},{type:'near3',radial:60,sharp:4},{type:'near3',radial:120,sharp:4},{type:'near2far2',radial:80,sharp:4}];let report=[];
for(const scenario of scenarios){const f=mod.createFireworks(THREE,{terrainHeight:()=>0,origin:[29,1.3,7],clusterModel:'moments',simulationOptions:{referenceBrightnessGain:64,maxActive:32}});f.setQuality({trailSegments:8});f.configure({autoLaunch:false,autoDirection:false,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});const times=[.05,.5,1,3,5,6.5,7,7.3,7.5,8,9,10,12,14,17];let launched=0;const phases=[];for(const time of times){for(let i=launched;i<scenario.events.length;i++){const e=scenario.events[i];if((e.launchAt??0)>time)break;if(e.launchAt>0)f.update({time:e.launchAt,windVector:[2,0,.8]});f.launch({...e,seed:9021+i});launched++;}f.update({time,windVector:[2,0,.8]});const rows=f.__receiverAudit.records().filter(p=>p.kind==='star'&&p.intensity>0),old=f.getReceiverLightClusters();if(!rows.length)continue;const exact=field(rows);phases.push({time,rows:rows.length,old:rms(field(old),exact),next:variants.map(o=>rms(field(soft4(rows,o)),exact))});}report.push({name:scenario.name,phases});f.dispose();}
fs.writeFileSync(new URL('receiver-prototype.json',import.meta.url),JSON.stringify({variants,report},null,2));console.log(JSON.stringify({variants,report},null,2));
