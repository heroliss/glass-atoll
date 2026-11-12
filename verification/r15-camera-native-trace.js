export function armCameraTrace(a,label,{timeoutMs=25000}={}){
  const initial=a.state,started=performance.now(),frames=[];
  const result={schema:'glass-atoll.r15-native-camera.v1',label,actualScene:true,initial:{camera:initial.camera,target:initial.target},done:false,seenActive:false,frames};
  const collect=()=>{
    const s=a.state,t=a.cameraTransition();
    frames.push({atMs:performance.now()-started,camera:s.camera,target:s.target,transition:t});
    if(t)result.seenActive=true;
    if(result.seenActive&&!t||performance.now()-started>timeoutMs){
      result.done=true;result.timedOut=!!t||!result.seenActive;
      let previous=result.initial,maximumStepDegrees=0,minimumLookDistance=Infinity;
      for(const f of frames){const dir=f.target.map((x,i)=>x-f.camera[i]),old=previous.target.map((x,i)=>x-previous.camera[i]);const d=Math.hypot(...dir),od=Math.hypot(...old);minimumLookDistance=Math.min(minimumLookDistance,d);maximumStepDegrees=Math.max(maximumStepDegrees,Math.acos(Math.max(-1,Math.min(1,dir.reduce((v,x,i)=>v+x*old[i],0)/(d*od))))*180/Math.PI);previous=f;}
      result.maximumStepDegrees=maximumStepDegrees;result.minimumLookDistance=minimumLookDistance;
      result.final={camera:s.camera,target:s.target,contextInterrupted:s.graphicsContextInterrupted};
      result.passed=result.seenActive&&!result.timedOut&&!s.graphicsContextInterrupted&&minimumLookDistance>=.75&&maximumStepDegrees<2;
      return;
    }
    a.setFrameProbe(collect);
  };
  a.setFrameProbe(collect);return result;
}
