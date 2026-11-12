from pathlib import Path
import hashlib,json

root=Path(__file__).resolve().parent.parent
changes={
 'main.js':[
  ("if(!['legacy','three-heart-v1','two-colour-v1','powered-bees-v1'].includes(effectProfile))", "if(!['legacy','three-heart-v1','three-heart-scale120-v1','two-colour-v1','powered-bees-v1'].includes(effectProfile))"),
  ("function frameFireworks(){\n  const b=fireworks.getBounds();", "function frameFireworks(){\n  const b=fireworks.getBounds({shutterSeconds:parameters.lens.shutterSeconds??1/120});")],
 'ui.js':[("profile==='three-heart-v1'?'蓝外层、绿中层、红内芯，分别燃尽。仅限单次燃放。':", "profile==='three-heart-scale120-v1'?'蓝外层、绿中层、红内芯。外层在爆开后2.5秒参考展开120米；这是创作标定，低角度碰水会裁切花形。仅限单次燃放。':profile==='three-heart-v1'?'蓝外层、绿中层、红内芯，分别燃尽。仅限单次燃放。':")],
 'index.html':[("<option value=\"three-heart-v1\">三层芯 · 菊（实验）</option>", "<option value=\"three-heart-v1\">三层芯 · 菊（实验）</option><option value=\"three-heart-scale120-v1\">三层芯 · 120米参考（实验）</option>")]
}
receipt={'schema':'glass-atoll.r35-root-interface-patch.v1','scope':'One opt-in profile label, explicit calibration helper and actual framing shutter; no other settings changed','files':[]}
for name, edits in changes.items():
 p=root/name
 before=p.read_bytes(); s=before.decode('utf-8')
 for old,new in edits:
  if '\n' in old and s.count(old)==0:
   old=old.replace('\n','\r\n');new=new.replace('\n','\r\n')
  if s.count(old)!=1: raise RuntimeError(f'{name}: expected one match, got {s.count(old)}')
  s=s.replace(old,new)
 after=s.encode('utf-8');p.write_bytes(after)
 receipt['files'].append({'path':name,'beforeSHA256':hashlib.sha256(before).hexdigest(),'afterSHA256':hashlib.sha256(after).hexdigest(),'replacementCount':len(edits)})
(root/'verification/r35-root-interface-patch-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False))
