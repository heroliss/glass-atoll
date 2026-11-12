import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';

const root=new URL('../../',import.meta.url),read=name=>fs.readFileSync(new URL(name,root),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const currentSource=read('fireworks.js'),beforeSource=read('verification/audio-light-lifecycle/before-flash/fireworks.js'),seam='api.configure({});return api;';
async function factory(source){
  assert.equal(source.split(seam).length,2);
  const injected=source.replace(seam,'api.__flashAudit={optical:shutter=>Array.from(opticalRows(shutter,false))};'+seam).replace(/from (['"])(\.\/[^'"]+)\1/g,(_,quote,relative)=>'from "'+new URL(relative.slice(2),root).href+'"');
  return import('data:text/javascript;base64,'+Buffer.from(injected).toString('base64'));
}
const [current,before]=await Promise.all([factory(currentSource),factory(beforeSource)]);
const denseParts=new Set(['outer-sphere','inner-sphere','ring','heart','flower','ring-plane','heart-plane','flower-plane','helix-canopy','double-helix-stars','radial-sphere','rotating-motor','outer-pearls','subshell-carrier','subshell-star','brocade-crown']);
const planarParts={'display-flower':'flower-plane','display-heart':'heart-plane','display-saturn':'ring-plane'};
function viewVisibility(age){const u=Math.max(0,Math.min(1,(age-.08)/.22)),smooth=u*u*(3-2*u);return .0001+.9999*smooth*smooth*smooth;}
const checks=[];
function check(name,run){try{checks.push({name,passed:true,evidence:run()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[factory]')});}}
function make(module,type){const fw=module.createFireworks(THREE,{terrainHeight:()=>0,origin:[29,0,7],clusterModel:'moments',simulationOptions:{referenceBrightnessGain:64,maxActive:32}});fw.setQuality({trailSegments:8});fw.configure({type,effectProfile:'legacy',starDragModel:'bounded-descent',autoLaunch:false,autoDirection:false,azimuth:110,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});return fw;}
function compare(type,phases){
  const a=make(current,type),b=make(before,type),launch=a.launch({seed:9021}),oldLaunch=b.launch({seed:9021}),sampled=[];assert.deepEqual(launch,oldLaunch);
  try{for(const phase of phases){
    const time=launch.burstTime+phase;a.update({time,windVector:[1.6848,0,.6336]});b.update({time,windVector:[1.6848,0,.6336]});
    assert.deepEqual(a.getLightClusters(),b.getLightClusters(),'physical air light changed');
    assert.deepEqual(a.getReceiverLightClusters(),b.getReceiverLightClusters(),'island receiver light changed');
    assert.deepEqual(a.getEmissionLedger(),b.getEmissionLedger(),'physical emission ledger changed');
    const now=a.__flashAudit.optical(0),old=b.__flashAudit.optical(0);assert.equal(now.length,old.length);
    let gated=0,gatedHeads=0,gatedTails=0,unaffected=0,strongestRatio=0,earlyOpticalIntensity=0,oldEarlyOpticalIntensity=0,missedEarlySources=0,unlistedCompactSources=0,planarHeads=0,planarTails=0;
    for(let i=0;i<now.length;i++){
      const p=now[i],q=old[i],role=p.sourceRole,part=p.sourceBody?.patternPart;assert.equal(role,q.sourceRole);assert.equal(p.sourceBody?.id,q.sourceBody?.id);assert.equal(p.sourceAge,q.sourceAge);assert.deepEqual(p.position,q.position);
      const complex=role==='complex-head'||role==='complex-tail',dense=complex&&denseParts.has(part),visibility=dense?viewVisibility(p.sourceAge):1,target=dense&&visibility<1;
      if(phase===.09&&type!=='display-vfan'&&type!=='display-waterfall'&&complex&&part!=='late-glitter'&&!denseParts.has(part))unlistedCompactSources++;
      if(target){
        assert.equal(p.intensity,q.intensity*visibility,JSON.stringify({type,phase,role,part,age:p.sourceAge}));
        assert.equal(p.unmodulatedIntensity,q.unmodulatedIntensity*visibility);
        for(let c=0;c<3;c++)assert.equal(p.maximumReferenceRGB[c],q.maximumReferenceRGB[c]*visibility);
        strongestRatio=Math.max(strongestRatio,visibility);gated++;if(role==='complex-head')gatedHeads++;else gatedTails++;
        if(part===planarParts[type]){if(role==='complex-head')planarHeads++;else planarTails++;}
        if(phase===.09){earlyOpticalIntensity+=p.intensity;oldEarlyOpticalIntensity+=q.intensity;if(q.intensity>0&&p.intensity/q.intensity>=.001)missedEarlySources++;}
      }
      else{assert.deepEqual(p,q,'unrelated optical source changed');unaffected++;}
    }
    const cached=a.__flashAudit.optical(0);for(let i=0;i<now.length;i++)assert.strictEqual(cached[i],now[i],'optical cache not reused');
    if(phase===.09)assert.equal(unlistedCompactSources,0,'compact source part is absent from the view gate');
    if(phase===.09&&gated){assert.equal(missedEarlySources,0,'early dense sources escaped view suppression');assert(earlyOpticalIntensity<oldEarlyOpticalIntensity*.001,'early optical intensity was not suppressed');}
    if(planarParts[type]&&phase===.09){assert.equal(planarHeads,48,'planar burst heads escaped the view gate');assert.equal(planarTails,240,'planar burst tails escaped the view gate');}
    if(type==='display-brocade'&&phase===.09){assert(gatedHeads>=224);assert(gatedTails>=160);}
    if(phase>=1.5&&type!=='display-double')assert.equal(gated,0,'late burn should have full optical sources');
    if(phase===1.5&&type==='display-double')assert(gatedTails>0,'delayed child bursts should still have young gated tails');
    if(type==='display-vfan'||type==='display-waterfall')assert.equal(gated,0,'continuous style unexpectedly gated');
    sampled.push({phase,gated,gatedHeads,gatedTails,unaffected,strongestRatio,...(phase===.09?{earlyOpticalIntensity,oldEarlyOpticalIntensity,missedEarlySources,unlistedCompactSources,planarHeads,planarTails}:{})});
  }return{type,sampled};}finally{a.dispose();b.dispose();}
}
check('dense burst views separate from unchanged physical lights',()=>['display-flower','display-heart','display-saturn','display-chase','display-helix','display-vortex','display-double','display-brocade'].map(type=>compare(type,[.012,.09,.18,.3,1.5])));
check('continuous sweep and waterfall optical records unchanged',()=>['display-vfan','display-waterfall'].map(type=>compare(type,[.09,.18,.3])));
const report={schema:'glass-atoll.flash-head-view-check.v1',passed:checks.every(c=>c.passed),checks,sourceHashes:{currentFireworks:sha(currentSource),beforeFireworks:sha(beforeSource)},actualGPU:false,limits:['CPU source and view-record comparison; final pixel appearance requires real-browser A/B and a new capture.']};
fs.writeFileSync(new URL('./flash-head-view-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:checks.map(c=>({name:c.name,passed:c.passed,error:c.error}))}));if(!report.passed)process.exitCode=1;
