from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
changes={
 'main.js':[("['legacy','three-heart-v1','three-heart-scale120-v1','two-colour-v1','powered-bees-v1'].includes(effectProfile)","['legacy','three-heart-v1','three-heart-scale120-v1','three-heart-radiant120-v1','two-colour-v1','powered-bees-v1'].includes(effectProfile)")],
 'ui.js':[("profile==='three-heart-scale120-v1'?'蓝外层、绿中层、红内芯。", "profile==='three-heart-radiant120-v1'?'金色长尾，蓝外层、绿中层、红内芯分别燃尽；使用更强的参考发光，未按实物测光。120米为参考展开，低角度碰水会裁切花形。仅限单次燃放。':profile==='three-heart-scale120-v1'?'蓝外层、绿中层、红内芯。")],
 'index.html':[("<option value=\"three-heart-scale120-v1\">三层芯 · 120米参考（实验）</option>","<option value=\"three-heart-scale120-v1\">三层芯 · 120米参考（实验）</option><option value=\"three-heart-radiant120-v1\">三层菊 · 长金尾（实验）</option>")],
 'package.json':[("node --check firework-scale-calibration.js", "node --check firework-scale-calibration.js && node --check firework-radiant-profile.js")]
}
records=[]
for name,edits in changes.items():
 p=root/name;before=p.read_bytes();s=before.decode('utf-8')
 for old,new in edits:
  if s.count(old)!=1:raise RuntimeError(f'{name} expected one match; found {s.count(old)}')
  s=s.replace(old,new)
 after=s.encode('utf-8');p.write_bytes(after);records.append({'path':name,'beforeSHA256':hashlib.sha256(before).hexdigest(),'afterSHA256':hashlib.sha256(after).hexdigest(),'replacements':len(edits)})
receipt={'schema':'glass-atoll.r36-root-interface-patch.v1','scope':'One opt-in reference effect and existing syntax check; incumbent layout and original profile choices retained','files':records}
(root/'verification/r36-root-interface-patch-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(receipt,ensure_ascii=False))
