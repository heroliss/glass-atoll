from pathlib import Path
import difflib, json, hashlib
root=Path(__file__).resolve().parent.parent
p=root/'fireworks.js'
s=p.read_text(encoding='utf-8')
edits=[
("    get tailColourMode(){return tailColourMode;},", "    get tailColourMode(){return tailColourMode;},\n    get photometryMode(){return photometryMode;},\n    get thermalEmittingRadiusMm(){return thermalEmittingRadiusMm;},"),
("nextTailColourMode=patch.tailColourMode===undefined?tailColourMode:validateTailColourMode(patch.tailColourMode),{clusterModel:ignoredClusterModel,trailIntegration:ignoredTrailIntegration,tailColourMode:ignoredTailColourMode,...physicsPatch}=patch;const state=simulation.configure(physicsPatch);if(patch.tailColourMode!==undefined)tailColourModeRequested=true;if(nextTailColourMode!==tailColourMode){tailColourMode=nextTailColourMode;updateRecords();}", "nextTailColourMode=patch.tailColourMode===undefined?tailColourMode:validateTailColourMode(patch.tailColourMode),nextPhotometryMode=patch.photometryMode===undefined?photometryMode:validatePhotometryMode(patch.photometryMode),nextThermalRadius=patch.thermalEmittingRadiusMm===undefined?thermalEmittingRadiusMm:validateThermalRadius(patch.thermalEmittingRadiusMm),{clusterModel:ignoredClusterModel,trailIntegration:ignoredTrailIntegration,tailColourMode:ignoredTailColourMode,photometryMode:ignoredPhotometryMode,thermalEmittingRadiusMm:ignoredThermalRadius,...physicsPatch}=patch;const state=simulation.configure(physicsPatch);if(patch.tailColourMode!==undefined)tailColourModeRequested=true;if(patch.photometryMode!==undefined||patch.thermalEmittingRadiusMm!==undefined)photometryRequested=true;const colourChanged=nextTailColourMode!==tailColourMode,photometryChanged=nextPhotometryMode!==photometryMode||nextThermalRadius!==thermalEmittingRadiusMm;tailColourMode=nextTailColourMode;photometryMode=nextPhotometryMode;thermalEmittingRadiusMm=nextThermalRadius;if(photometryChanged)thermalBodyScale=photometryMode==='thermal-greybody'?thermalGreybodyCandela(thermalEmittingRadiusMm)/THERMAL_GREYBODY_PROFILE.referenceAreaCandela:1;if(colourChanged||photometryChanged)updateRecords();"),
("...(tailColourMode==='cooling'?{tailColourMode}: {})};},", "...(tailColourMode==='cooling'?{tailColourMode}: {}),...(photometryMode==='thermal-greybody'?{photometryMode,thermalEmittingRadiusMm}: {})};},"),
("    getLightClusters,getEmissionLedger,", "    getLightClusters,getEmissionLedger,\n    getFramingSources(){if(disposed)throw new Error('Cannot query disposed framing sources');return Object.freeze(records.filter(p=>p.kind!=='smoke'&&p.intensity>0&&maximumRGB(p.colour)>0).map(p=>Object.freeze({eventId:p.eventId,position:Object.freeze([...p.position]),intensity:p.intensity,colour:Object.freeze([...p.colour]),radius:p.radius,stretch:Object.freeze([...(p.stretch||[0,0,0])])})));},"),
("diagnostics(){return{...simulation.state,...(tailColourModeRequested?", "diagnostics(){return{...simulation.state,...(photometryRequested?{photometry:{mode:photometryMode,thermalEmittingRadiusMm,thermalBodyScale,profile:THERMAL_GREYBODY_PROFILE,scope:'Scale complete native-thermal body head/tail allocation once; coloured bodies retain reference I. No measured fireworks or heat/energy calibration.'}}:{}),...(tailColourModeRequested?")
]
for before,after in edits:
    assert s.count(before)==1, before[:160]
    s=s.replace(before,after)
p.write_text(s,encoding='utf-8',newline='\n')
old=(root/'verification/baselines/r12-before-thermal-photometry/fireworks.js').read_text(encoding='utf-8')
assert hashlib.sha256(old.encode()).hexdigest()=='cc864bf4cbfee0739362bc3b3770e0d8a2840238afe989b4c8815170660724e6'
new=s.splitlines(keepends=True);base=old.splitlines(keepends=True)
blocks=[]
for index,(op,i,j,k,l) in enumerate(difflib.SequenceMatcher(None,new,base,autojunk=False).get_opcodes()):
    if op=='equal': continue
    a=''.join(new[i:j]);b=''.join(base[k:l]);assert a and s.count(a)==1
    blocks.append([f'photometry-scope-{len(blocks)+1}',a,b])
code='// QA exact scoped inverse. No broad deletion or default-path inference.\nexport const edits=Object.freeze('+json.dumps(blocks,ensure_ascii=False,indent=2)+'.map(Object.freeze));\nexport function normalizeThermalPhotometrySource(source){let out=source;for(const [name,from,to]of edits){if(out.split(from).length!==2)throw Error(name+" is missing or duplicated");out=out.replace(from,to);}return out;}\n'
(root/'verification/r12-thermal-photometry-normalize.mjs').write_text(code,encoding='utf-8',newline='\n')
print(json.dumps({'changedBlocks':len(blocks),'sourceSHA256':hashlib.sha256(s.encode()).hexdigest()}))
