from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
p=root/'main.js';raw=p.read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(raw)=='014c7d2bad46fe0337daec400366df3e9a21e210f8a51eb40e3b30aa35d02c77'
directory=root/'verification/baselines/r37-rejected-projection-main-wrapper';directory.mkdir(exist_ok=False)
(directory/'main.js').write_bytes(raw)
text=raw.decode('utf-8');eol='\r\n' if b'\r\n' in raw else '\n'
wrappers="""    sourceProjectionReuse(){return fireworks.getSourceProjectionReuse();},
    setSourceProjectionReuse(enabled){if(qaRenderLock||qaFrozenWorkload||renderBenchmark.active||graphicsContextInterrupted||!parameters.paused)throw new Error('Pause a healthy scene outside a rendering diagnostic before changing source projection reuse');const result=fireworks.setSourceProjectionReuse(enabled);lastPausedRenderKey=null;return result;},
""".replace('\n',eol)
assert text.count(wrappers)==1;text=text.replace(wrappers,'',1)
original=(root/'verification/baselines/r37-before-source-projection-reuse/main.js').read_bytes();old=original.decode('utf-8')
old_start=old.index('function updateScenePhotometry(');old_end=old.index('function smokeLightingPayload(',old_start)
new_start=text.index('function markPhotometryPhase(');new_end=text.index('function smokeLightingPayload(',new_start)
inverse=(text[:new_start]+old[old_start:old_end]+text[new_end:]).encode('utf-8');assert inverse==original
current=text.encode('utf-8');p.write_bytes(current)
receipt={'schema':'glass-atoll.r37-main-profiling-only.v1','originalR36SHA256':sha(original),'rejectedIntermediateSHA256':sha(raw),'currentSHA256':sha(current),'inverseToR36Exact':True,'sourceProjectionReuseQAWrapperRetired':True,'retainedChange':'CPU wall/submission subphase marks only while existing profileFrames is active; original call order/formulas unchanged','extraRenderCalls':0,'cacheCandidatePromoted':False}
(root/'verification/r37-main-profiling-only-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt))
