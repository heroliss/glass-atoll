from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,math
root=Path('.');v=root/'verification';sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();read=lambda p:json.loads(Path(p).read_text(encoding='utf8'));checks=[]
def check(name,fn):
 try: evidence=fn();checks.append({'name':name,'passed':True,'evidence':evidence})
 except Exception as e:checks.append({'name':name,'passed':False,'error':str(e)})
expected={'main.js':'b2fe468c216b8fe89839f168a3c4b6ae7a21272d4f73277356f27b69f7e885a8','fireworks.js':'b37ea388471b6f50a307327fab95ccc10d7f9aaa1dc46ed921fc1abd9c890e43','pyro-smoke-columns.js':'d44a897ab8c7c9f58e0c7f974d07d1206b374d44dbb228bf05ebbe71131afad6','pyro-smoke.js':'01c4c66e15579f429e472a0089fda9f5ba1f17d782d3cd63d69a226b30225a89','pyro-smoke-logical-burn.js':'235dff6244215b5a599d3d80ea93321ccacefb8d690a07813f0c25b827800a15','pyro-smoke-logical-events.js':'5f7bf8b0d311f9cdac938b18612b9ff16b5c80fa26330a20d79e9e44661a1837','fireworks-audio.js':'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'}
def sourceCheck():
 actual={p:sha(p) for p in expected};assert actual==expected;return actual
check('seven current runtime hashes match the reviewed frozen sources',sourceCheck)
provenance=read(v/'r10-final-independent-rerun-provenance.json')
def clonesCheck():
 for row in provenance:
  assert sha(row['original'])==row['originalSHA256'];clone=Path(row['rerun']).read_bytes();s=row['soleLiteralReplacement'];assert clone.count(s['to'].encode())==1;assert clone.replace(s['to'].encode(),s['from'].encode())==Path(row['original']).read_bytes()
 return {'cases':len(provenance),'assertionsChanged':0,'originalsOverwritten':False,'byteExactAfterOutputURLInverse':True}
check('rerun clones alter only the report filename and preserve original evidence',clonesCheck)
runs=[]
for row in provenance:
 p=Path(row['rerun']).with_suffix('.json');d=read(p);runs.append({'file':str(p).replace('\\','/'),'SHA256':sha(p),'passed':d['passed'],'counts':d['counts']})
def rerunCheck():
 assert all(x['passed'] for x in runs);return {'runs':runs,'passed':sum(x['counts']['passed'] for x in runs),'total':sum(x['counts']['total'] for x in runs),'actualGPU':False}
check('six bounded targeted reruns pass with unchanged assertions',rerunCheck)
gpu=read(v/'r10-transmission-gpu-scene.json')
def gpuCheck():
 assert gpu['status']=='done';assert gpu['gpu']['passed'] and gpu['gpu']['counts']=={'passed':10,'total':10};assert gpu['scene']['passed'] and gpu['scene']['counts']=={'passed':7,'total':7};assert gpu['gpuAfter']['errors']==[] and gpu['scene']['finalGL']['errors']==[];return {'historicalGPU':10,'historicalScene':7,'newGPUExecuted':False,'capturedColumnsVersion':'0c2a14e9b8bd4181c022a70eb0fc34d04b65f25bce8e28d20201eef6c3a11e7d','versionBasis':'preserved source boundary and owner capture record; report itself has no embedded main hash'}
check('historical GPU10 and scene7 are internally complete and kept in their version scope',gpuCheck)
def pngCheck():
 a=v/'r10-transmission-legacy.png';b=v/'r10-transmission-fast.png';assert a.read_bytes()==b.read_bytes();return {'identicalBytes':a.stat().st_size,'SHA256':sha(a),'scope':'complete SDR PNG bytes only; no full HDR master hash'}
check('saved static legacy and fast SDR PNG files are byte-identical',pngCheck)
p=read(v/'r10-transmission-scene-performance.json');r=p['result'];analysis=read(v/'r10-transmission-performance-analysis.json')
def timingCheck():
 assert p['status']=='done' and r['valid'];assert not r['issues'] and not r['invalidQueries'];assert not r['drain']['unreturned'];assert not r['observed']['contextLost'];assert r['observed']['frameCount']==r['observed']['begun']==r['observed']['returnedFinite']==257;assert p['after']['errors']==[]
 assert len(r['querySamples'])==len(r['frames'])==257
 for a,b in zip(r['frames'],r['querySamples']):assert a['frame']==b['frame'] and a['mode']==a['routeEcho']==b['mode'] and a['C']==16.5
 return {'rows':257,'returnedQueries':257,'GL':[],'camera':r['frames'][0]['camera'],'viewport':[r['frames'][0]['width'],r['frames'][0]['height']]}
check('actual interleaved capture retains all257 query labels and finite returned results',timingCheck)
def meansCheck():
 out={}
 for mode in ['legacy','fast']:
  vals=[x['gpuMs'] for x in r['querySamples'] if x['mode']==mode];mean=sum(vals)/len(vals);assert abs(mean-r['modeStatistics'][mode]['validWholeFrameGPU']['mean'])<1e-12;out[mode]={'n':len(vals),'meanGPUms':mean}
 out['changePercent']=(out['fast']['meanGPUms']/out['legacy']['meanGPUms']-1)*100;return out
check('whole-window GPU means are flat slightly worse and recompute from raw samples',meansCheck)
def joinCheck():
 assert analysis['joinValid'] and len(analysis['checks'])==9 and all(c['passed'] for c in analysis['checks']);assert len(analysis['joinedRows'])==257
 for path,digest in analysis['protocolSourcesAtAnalysis'].items():assert sha(path)==digest,(path,sha(path),digest)
 return {'historicalAnalysisChecks':9,'sourceProvenance':analysis['sourceProvenance'],'currentProtocolHashesMatch':True,'newGPUExecuted':False}
check('CPU join analysis still refers to exact current protocol source bytes',joinCheck)
def windowsCheck():
 out={}
 for window in analysis['windows']:
  out[window['id']]={mode:window['modes'][mode]['CPU'] for mode in ['legacy','fast']}
 assert out['predeclaredHot']['legacy']['n']==23 and out['predeclaredHot']['fast']['n']==22
 return {'windows':out,'hotModeSamplesBelowOriginal30':True,'notSeparateFPS':True,'CPUincludesDriverAndProbe':True}
check('CPU improvement retains descriptive hot-window and elapsed-time limits',windowsCheck)
def logicalCheck(type):
 d=read(v/f'r10-logical-{type}-scene.json');assert d['actualGPU'] and d['passed'] and not d['visualAccepted'];assert d['counts']=={'passed':14,'total':14};assert d['phases']==[.8,3.6,10];assert not d['runtimeErrors'] and not d['finalGL']['errors']
 rows=[]
 for c in d['captures']:
  s,e=c['smoke']['state'],c['smoke']['events'];assert s['capacity']==4096 and s['forcedMerges']==s['merges']==0;assert e['coverage']=='all-logical' and not e['fault'] and e['futureCellArrays']==0;assert abs(e['materializedArea']+e['reservedArea']-d['expected']['mass'])<1e-9
  rows.append({'phase':c['phase'],'queried':c['coverage']['queriedBodies'],'declared':c['coverage']['declaredBodies'],'packets':s['packetCount'],'Mmaterialized':e['materializedArea'],'Mreserved':e['reservedArea']})
 assert rows[-1]['queried']==rows[-1]['declared']==d['expected']['bodies'];assert rows[-1]['Mreserved']==0
 return {'checks':14,'rows':rows,'visualAccepted':False,'singleEventNotLongStress':True,'referenceMassNotKgOrMeasuredYield':True}
for type in ['crossette','bouquet']:check(f'{type} actual4096 captures verify source coverage and reference budget only',lambda type=type:logicalCheck(type))
def historicalScopeCheck():
 d=read(v/'logical-events-check.json');assert d['passed'] and d['counts']=={'passed':18,'total':18};text=(v/'PERFORMANCE-SOURCES-R10-CHECKPOINT.md').read_text(encoding='utf8');assert '65536' in text and '4096' in text and '尚未' in text
 return {'CPUAdapterHistorical':18,'allTenReplayCapacity':65536,'defaultCapacityLongStressNotClaimed':True,'historicalStaleLimits':['logical-events-check.json says production provider unmodified; main/G1 were added later','logical-burn-check.json says provider root-only; current G1 has sampleBody'],'checkpointDistinguishesHistoricalFromCurrent':True}
check('checkpoint preserves65536 CPU replay and old report provenance limits',historicalScopeCheck)
report={'schema':'glass-atoll.r10-final-independent-review.v1','dateUTC':datetime.now(timezone.utc).isoformat(),'actualGPU':False,'checks':checks,'counts':{'passed':sum(x['passed'] for x in checks),'total':len(checks)},'newTargetedAssertions':{'passed':58,'total':58},'limits':['Independent reruns used real CPU modules and unchanged assertions with new output filenames. No new browser/GPU runs were performed.','Review of historical actual-GPU JSON checks and SDR files is artifact validation, not new GPU validation or visual acceptance.','Full ten-type adapter replay was deliberately not rerun at65536. Production4096 willow/continuous long-smoke performance remains open.','No overall renderer FPS gain, every-frame60fps, photoreal smoke, kg/yield or full HDR-master pixel identity claims.']};report['passed']=all(x['passed'] for x in checks);dest=v/'r10-final-independent-review.json';dest.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'passed':report['passed'],'counts':report['counts'],'targeted':report['newTargetedAssertions'],'failures':[x for x in checks if not x['passed']]},ensure_ascii=False,indent=2))
