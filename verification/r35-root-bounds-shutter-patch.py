from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parent.parent
p=root/'main.js';before=p.read_bytes();s=before.decode('utf-8')
old='fireworks.getBounds()';new='fireworks.getBounds({shutterSeconds:parameters.lens.shutterSeconds??1/120})'
if s.count(old)!=2:raise RuntimeError('Expected diagnostics and frameSceneBounds calls')
s=s.replace(old,new)
old='fireworks?.getBounds()';new='fireworks?.getBounds({shutterSeconds:parameters.lens.shutterSeconds??1/120})'
if s.count(old)!=1:raise RuntimeError('Expected local-light support call')
s=s.replace(old,new);after=s.encode('utf-8');p.write_bytes(after)
report={'schema':'glass-atoll.r35-current-shutter-bounds-followup.v1','beforeSHA256':hashlib.sha256(before).hexdigest(),'afterSHA256':hashlib.sha256(after).hexdigest(),'replacementCount':3,'scope':'All four app consumers, including earlier frameFireworks change, use current shutter; old profiles ignore the optional argument'}
(root/'verification/r35-root-bounds-shutter-receipt.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
