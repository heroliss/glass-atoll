"""Source/evidence checkpoint. Shared assets and vendor files are hashed, not copied."""
import hashlib,json,shutil
from datetime import datetime,timezone,timedelta
from pathlib import Path

root=Path(__file__).resolve().parent.parent
now=datetime.now(timezone.utc)
name='b4-production-'+(now+timedelta(hours=8)).strftime('%Y%m%d-%H%M%S')
target=(root/'verification'/'baselines'/name).resolve()
target.relative_to(root)
target.mkdir(parents=True,exist_ok=False)
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1048576),b''):h.update(block)
    return h.hexdigest()
paths=[p for p in root.iterdir() if p.is_file() and p.suffix.lower() in {'.js','.mjs','.css','.html','.json','.md','.ps1','.cmd'}]
for folder in [root/'verification',root/'verification'/'fireworks',root/'verification'/'plans']:
    paths += [p for p in folder.iterdir() if p.is_file() and p.suffix in {'.js','.mjs','.py'}]
selected=['verification/b4-production-check.json','verification/visual-round-b4-gpu.json','verification/cloud-base-view-check.json','verification/cloud-base-view-low-check.json','verification/palm-frame-b0/scene-ab.json','verification/palm-frame-b0/cost-gpu.json','verification/palm-frame-b0/hd-capture.json','verification/palm-frame-b0/compare.html','verification/fireworks/b4-production-stress.json','verification/fireworks/audio-selected-check.json','verification/palm-frame-check.json','verification/cloud-base-continuity-check.json','verification/palm-next-measure.json','verification/playground-cpu-b4.log','verification/playground-syntax-b4.log','verification/PLAYGROUND-ACCEPTANCE.md','verification/PALM-B0-ACTUAL-REVIEW.md','verification/PALM-B0-NOTES.md','verification/plans/PROGRESS.md','verification/plans/PALM-CLOUD-VISUAL-NEXT.md','verification/plans/PALM-CLOUD-REBUTTAL.md','verification/plans/CLOUD-BASE-CONTINUITY-CONTRACT.md','verification/plans/CLOUD-DENSITY-EVIDENCE-REVIEW.md','verification/plans/PALM-AFTER-B0-PLAN.md']
paths += [root/p for p in selected]
files=[]
for path in sorted(set(paths)):
    relative=path.relative_to(root);destination=target/relative;destination.parent.mkdir(parents=True,exist_ok=True)
    expected=digest(path);shutil.copy2(path,destination)
    if digest(destination)!=expected:raise RuntimeError('Checkpoint copy hash mismatch: '+str(relative))
    files.append({'path':relative.as_posix(),'bytes':path.stat().st_size,'sha256':expected})
shared=[]
for folder in [root/'assets',root/'vendor']:
    for path in sorted(folder.rglob('*')):
        if path.is_file():
            path.resolve().relative_to(root)
            shared.append({'path':path.relative_to(root).as_posix(),'bytes':path.stat().st_size,'sha256':digest(path)})
manifest={'schema':'glass-atoll.source-checkpoint.v1','createdAtUTC':now.isoformat(),'goalStatus':'active','runtimeDefaults':{'palmFrame':'transport','cloudBaseContinuity':1,'quality':'medium','shadows':4096,'waveResolution':512},'filesCopied':files,'sharedAssetVendorHashes':shared,'limits':['Source/evidence checkpoint, not a standalone runnable distribution','Assets/vendor and large media remain in the parent project; hashes record their state','Functional/numerical checks and accepted boom impact do not constitute full photographic-realism acceptance']}
(target/'sha256.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(target/'CHECKPOINT.txt').write_text('B4 root sources, QA scripts and selected evidence. Shared assets/vendor/media remain in the original project. Goal remains active. See sha256.json.\n',encoding='utf-8')
print(json.dumps({'path':str(target),'copiedFiles':len(files),'sharedFilesHashed':len(shared),'copiedBytes':sum(x['bytes'] for x in files),'manifestSHA256':digest(target/'sha256.json')}))
