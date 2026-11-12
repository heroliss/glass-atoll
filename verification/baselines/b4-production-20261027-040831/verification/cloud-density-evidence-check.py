"""Read-only decode of saved production density; illustrative march bounds."""
from pathlib import Path
import json,base64,math,numpy as np
root=Path(__file__).resolve().parent
source=json.loads((root/'cloud-density-slices.json').read_text(encoding='utf8'))
profiles=[]
for p in source['profiles']:
    slices=[]
    for s in p['slices'][:3]:
        a=np.frombuffer(base64.b64decode(s['float32Base64']),dtype='<f4').reshape(p['height'],p['width'])
        ys=np.linspace(s['yRange'][1],s['yRange'][0],p['height']);levels=[]
        for threshold in [.0008,.08,.2]:
            m=a>threshold;present=m.any(axis=0);tops=ys[m.argmax(axis=0)[present]]
            levels.append(dict(threshold=threshold,columns=int(present.sum()),topMinimumMetres=float(tops.min()),topMaximumMetres=float(tops.max()),topP10Metres=float(np.quantile(tops,.1)),topP90Metres=float(np.quantile(tops,.9)),topStandardDeviationMetres=float(tops.std()),globalTopMinusMaximumMetres=float(p['top']-tops.max())))
        slices.append(dict(axis=s['axis'],levels=levels))
    R=6360000.;eye=12.;r=R+eye;sampling=[]
    for angle in [2,5,10,20]:
        mu=math.sin(math.radians(angle));b=r*mu
        distance=lambda altitude:-b+math.sqrt(b*b-(r-(R+altitude))*(r+(R+altitude)))
        entry=max(0,distance(p['base']));exit=min(60000.,distance(p['top']));length=max(0,exit-entry)
        values=[]
        for steps in [64,128]:
            ds=length/steps;lod=min(1.25,max(0,math.log2(max(ds,65)/130)))
            rayCell=1/math.sqrt((math.cos(math.radians(angle))/250)**2+(mu/(2400/(2.6*8)))**2)
            values.append(dict(steps=steps,maximumUntrimmedStepMetres=ds,maximumLODFromThisInterval=lod,basePuffCellsPerStep=ds/rayCell))
        sampling.append(dict(rayElevationDegrees=angle,eyeMetres=eye,untrimmedLayerDistanceMetres=length,values=values))
    profiles.append(dict(name=p['name'],sliceTopStatistics=slices,illustrativeUntrimmedSampling=sampling))
report=dict(profiles=profiles,limits=['Thresholded column tops include detached fragments; not a full connected-cloud statistics survey','Untrimmed spherical-layer intervals are upper bounds; production weather-support clipping can shorten them','Ray table uses illustrative12m eye, not a claimed current camera/ROI measurement','Puff-cell scale is a noise coordinate spacing, not a sharp Nyquist cutoff of the nonlinear density'])
(root/'cloud-density-evidence-stats.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({'profiles':[{'name':p['name'],'topAtRenderThreshold':[{'axis':s['axis'],**s['levels'][0]}for s in p['sliceTopStatistics']],'sampling':p['illustrativeUntrimmedSampling']}for p in profiles]},indent=2))
