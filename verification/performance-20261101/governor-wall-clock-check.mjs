import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createQualityGovernor} from '../../quality-governor.js';

const checks=[];
function check(name,passed,details={}){checks.push({name,passed,...details});assert.ok(passed,name);}
const normal=()=>({delta:1/60,wallDelta:1/60,gpuMs:10,cpuMs:8,frameMs:1000/60});

{
  const changes=[];
  const governor=createQualityGovernor({onScale:scale=>changes.push(scale)});
  for(let i=0;i<600;i++)governor.update(normal());
  check('steady 60 Hz does not lower visual resolution',governor.state.scale===1&&changes.length===0,{frames:600,scale:governor.state.scale});
}

{
  const changes=[];
  const governor=createQualityGovernor({onScale:scale=>changes.push(scale)});
  for(let i=0;i<420;i++)governor.update(normal());
  governor.update({delta:.055,wallDelta:20,gpuMs:800,cpuMs:800,frameMs:20000});
  for(let i=0;i<360;i++)governor.update(normal());
  check('one long visible stall does not lower resolution',governor.state.scale===1&&changes.length===0,{stallSeconds:20,scale:governor.state.scale});
}

{
  const changes=[];
  const governor=createQualityGovernor({onScale:scale=>changes.push({frame,scale})});
  let frame=0;
  for(;frame<25;frame++)governor.update({delta:.055,wallDelta:1,gpuMs:800,cpuMs:800,frameMs:1000});
  check('sustained one FPS triggers bounded wall-clock adaptation',changes.length>0&&changes[0].frame<=18&&governor.state.scale===.6,{firstChange:changes[0],scale:governor.state.scale});
}

{
  const changes=[];
  const governor=createQualityGovernor({onScale:scale=>changes.push({frame,scale})});
  let frame=0;
  for(;frame<25;frame++)governor.update({delta:.055,wallDelta:1,gpuMs:10,cpuMs:8,frameMs:1000});
  check('stale low GPU sample cannot hide sustained one FPS',changes.length>0&&changes[0].frame<=18&&changes[0].scale<1&&governor.state.changes[0].reason==='severe frame pacing',{firstChange:changes[0],state:governor.state});
}

{
  const governor=createQualityGovernor();
  governor.update({delta:0,wallDelta:1,gpuMs:800,cpuMs:800,frameMs:1000});
  check('frozen physical simulation does not alter governor',governor.state.scale===1&&governor.state.smoothedCostMs===null,{scale:governor.state.scale});
}

const report={schema:'glass-atoll.governor-wall-clock-check.v1',passed:checks.every(item=>item.passed),checks};
await writeFile(new URL('./governor-wall-clock-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,heavyOneFpsFirstDownscaleFrame:checks[2].firstChange.frame,staleGpuOneFpsFirstDownscaleFrame:checks[3].firstChange.frame}));
