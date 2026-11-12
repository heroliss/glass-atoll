// Two moving surface-light proxies from the current luminous head/tail ledger.
// Preserve reference I and linear RGB; no extra emitted energy or GPU passes.
// The fixed launch-plane axis avoids a rotating PCA basis during a colour fade.
export function buildReceiverLightClusters(records,events){
  const byEvent=new Map();
  for(const p of records){
    if(p.kind!=='star'||!(p.intensity>0))continue;
    let group=byEvent.get(p.eventId);
    if(!group){group={rows:[],intensity:0,centre:[0,0,0]};byEvent.set(p.eventId,group);}
    group.rows.push(p);group.intensity+=p.intensity;
    for(let c=0;c<3;c++)group.centre[c]+=p.position[c]*p.intensity;
  }
  const output=[];
  for(const event of events){
    const group=byEvent.get(event.id);if(!group)continue;
    const centre=group.centre.map(v=>v/group.intensity),axis=event.patternFrame?.right??[1,0,0];
    const halves=[0,1].map(()=>({rows:[],intensity:0,position:[0,0,0],rgb:[0,0,0]}));
    for(const p of group.rows){
      const side=p.position.reduce((sum,v,c)=>sum+(v-centre[c])*axis[c],0)<0?0:1,h=halves[side];
      h.rows.push(p);h.intensity+=p.intensity;
      for(let c=0;c<3;c++){h.position[c]+=p.position[c]*p.intensity;h.rgb[c]+=(p.emissionRGBReference?.[c]??p.colour[c]*p.intensity);}
    }
    for(let side=0;side<2;side++){
      const h=halves[side];if(!(h.intensity>0))continue;
      const position=h.position.map(v=>v/h.intensity),color=h.rgb.map(v=>v/h.intensity);
      let variance=0,maxExtent=0;
      for(const p of h.rows){const distanceSquared=p.position.reduce((sum,v,c)=>sum+(v-position[c])**2,0);variance+=p.intensity*(distanceSquared+p.radius*p.radius/5);maxExtent=Math.max(maxExtent,Math.sqrt(distanceSquared)+p.radius);}
      const rmsRadius=Math.sqrt(Math.max(0,variance/h.intensity));
      output.push({position,color,colour:color,referenceCandela:h.intensity,intensity:h.intensity,radius:Math.max(2,rmsRadius),rmsRadius,maxExtent,eventId:event.id+'/receiver/'+side,sourceEventId:event.id,kind:'fireworks receiver cluster',pathFlags:{diffuse:true,smoke:false,specular:false},illuminationModel:'two launch-plane spatial moments from current head/tail RGB; not resolved area emission'});
    }
  }
  return output;
}
