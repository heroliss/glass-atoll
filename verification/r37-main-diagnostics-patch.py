from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
p=root/'main.js';raw=p.read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(raw)=='daee45ec05f1544fb9145a6546006996c82e6ab52cc6876b0dba47068d8adc71'
text=raw.decode('utf-8');eol='\r\n' if b'\r\n' in raw else '\n'
start=text.index('function updateScenePhotometry(');end=text.index('function smokeLightingPayload(',start)
old=text[start:end];part=old.replace('\r\n','\n')
def change(a,b):
 global part
 assert part.count(a)==1,a[:100]
 part=part.replace(a,b,1)
change('  const light=atmosphere.lighting()',"  const detailedOwner=activeFrameProfile&&performance.now()<activeFrameProfile.until?activeFrameProfile:null,detailed=detailedOwner?{time,force,started:performance.now(),phases:{}}:null;\n  if(detailed)detailed.last=detailed.started;\n  const light=atmosphere.lighting()")
change('  atmosphere.prepareStarView(',"  markPhotometryPhase(detailed,'lighting-setup');\n  atmosphere.prepareStarView(")
change("  const clusters=fireworks?.getLightClusters()||[],b=fireworks?.getBounds({shutterSeconds:parameters.lens.shutterSeconds??1/120});localLights.update(","  markPhotometryPhase(detailed,'star-view');\n  const clusters=fireworks?.getLightClusters()||[];markPhotometryPhase(detailed,'source-clusters');\n  const b=fireworks?.getBounds({shutterSeconds:parameters.lens.shutterSeconds??1/120});markPhotometryPhase(detailed,'source-world-bounds');\n  localLights.update(")
change('  const fieldRequested=',"  markPhotometryPhase(detailed,'local-and-cloud-setup');\n  const fieldRequested=")
change('  // Prepare all raw irradiance',"  markPhotometryPhase(detailed,'resolved-smoke-lighting');\n  // Prepare all raw irradiance")
change('  const local=localLights.getRadianceBound(),skyBound=atmosphere.getRadianceBound(),pyro=fireworks?.getRadianceBound({camera,optics:currentOptics(),rawPerCandela:RAW_PER_CANDELA})||{},pstate=fireworks?.diagnostics();',"  markPhotometryPhase(detailed,'indirect-and-cloud-shadow');\n  const local=localLights.getRadianceBound(),skyBound=atmosphere.getRadianceBound();markPhotometryPhase(detailed,'local-and-sky-bounds');\n  const pyro=fireworks?.getRadianceBound({camera,optics:currentOptics(),rawPerCandela:RAW_PER_CANDELA})||{};markPhotometryPhase(detailed,'main-source-bound');\n  const pstate=fireworks?.diagnostics();markPhotometryPhase(detailed,'source-diagnostics');")
change('  const cameraState=',"  markPhotometryPhase(detailed,'mirror-source-bound');\n  const cameraState=")
change('  const smokeBound=',"  markPhotometryPhase(detailed,'camera-exposure-ui');\n  const smokeBound=")
change("  const night=(light.nightBlend||0)>.5", "  markPhotometryPhase(detailed,'medium-and-air-bounds');\n  const night=(light.nightBlend||0)>.5")
change('  atmosphere.setStorageExposureEV(',"  markPhotometryPhase(detailed,'storage-exposure-selection');\n  atmosphere.setStorageExposureEV(")
change('  frameSnapshot={...baseFrame,...photometry,dt:parameters.paused?0:delta,adaptationDelta:delta,utcMs:celestialFrame?.utcMs,observer:celestialFrame?.observer,windVector:[effectiveWind*.936,0,effectiveWind*.352],weather:atmosphere.getWeatherState().current};\n}',"  frameSnapshot={...baseFrame,...photometry,dt:parameters.paused?0:delta,adaptationDelta:delta,utcMs:celestialFrame?.utcMs,observer:celestialFrame?.observer,windVector:[effectiveWind*.936,0,effectiveWind*.352],weather:atmosphere.getWeatherState().current};\n  markPhotometryPhase(detailed,'storage-and-shared-lighting');\n  if(detailed){detailed.total=performance.now()-detailed.started;delete detailed.last;(detailedOwner.photometryFrames??=[]).push(detailed);}\n}")
helper="function markPhotometryPhase(profile,name){if(profile){const now=performance.now();profile.phases[name]=now-profile.last;profile.last=now;}}\n"
new=(helper+part).replace('\n',eol);text=text[:start]+new+text[end:]
anchor='    // QA-only: one real host for motion/performance review, no comparison fanout.'
wrapper="""    sourceProjectionReuse(){return fireworks.getSourceProjectionReuse();},
    setSourceProjectionReuse(enabled){if(qaRenderLock||qaFrozenWorkload||renderBenchmark.active||graphicsContextInterrupted||!parameters.paused)throw new Error('Pause a healthy scene outside a rendering diagnostic before changing source projection reuse');const result=fireworks.setSourceProjectionReuse(enabled);lastPausedRenderKey=null;return result;},
""".replace('\n',eol)
assert text.count(anchor)==1;text=text.replace(anchor,wrapper+anchor,1)
candidate=text.encode('utf-8');inverse=text.replace(wrapper,'',1).replace(new,old,1).encode('utf-8');assert inverse==raw
p.write_bytes(candidate)
receipt={'schema':'glass-atoll.r37-main-diagnostics-patch.v1','oldSHA256':sha(raw),'newSHA256':sha(candidate),'inverseToR36Exact':True,'changes':['guarded QA-only per-instance CPU projection reuse switch','subphase CPU wall/submission marks only while existing profileFrames is active'],'unchanged':['all lighting/radiometry formulas and call order','all shaders/samples/source and smoke density','default global clock and native audio','user settings and visible UI'],'extraRenderCalls':0}
(root/'verification/r37-main-diagnostics-patch.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt))
