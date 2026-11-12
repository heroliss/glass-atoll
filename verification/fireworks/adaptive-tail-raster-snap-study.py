"""QA only: fixed-point vertex snapping hypothesis for the preserved first GPU failure.
No production, oracle or acceptance threshold is changed. Global grid hypotheses,
not per-fixture fitting; actual interpolant readback is still required.
"""
import importlib.util
import json
import math
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('streak_oracle',HERE/'gaussian-streak-oracle.py')
o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
source=HERE.parent/'r9-adaptive-and-radiance-gpu-first.json'
report=json.loads(source.read_text(encoding='utf-8'))['adaptive']
rows=report['fixtures']

def snapped_offset(p,m,sigma,bits):
    grid=2**bits
    actual=[]
    for c in range(2):
        extent=3.65*sigma+abs(m[c])*.5+.65
        centre=64.5-p[c]
        left=round((centre-extent)*grid)/grid
        right=round((centre+extent)*grid)/grid
        actual.append(((64.5-left)/(right-left)*2-1)*extent)
    return actual

grid_results=[]
for bits in (4,6,8,10,12):
    errors=[]
    for row in rows:
        p=snapped_offset(row['pixelOffset'],row['motion'],row['sigma'],bits)
        predicted=o.candidate(p,row['motion'],row['sigma'],o.shader_erf,True)
        errors.append(predicted-row['actual'])
    grid_results.append(dict(hypotheticalSubpixelBits=bits,maximumAbsoluteResidual=max(map(abs,errors)),rmsResidual=math.sqrt(sum(e*e for e in errors)/len(errors))))

details=[]
for i,row in enumerate(rows):
    p=snapped_offset(row['pixelOffset'],row['motion'],row['sigma'],8)
    predicted=o.candidate(p,row['motion'],row['sigma'],o.shader_erf,True)
    h=1e-5
    gradient=[]
    for c in range(2):
        a=list(row['pixelOffset']);b=list(a);a[c]-=h;b[c]+=h
        gradient.append((o.candidate(b,row['motion'],row['sigma'],o.shader_erf,True)-o.candidate(a,row['motion'],row['sigma'],o.shader_erf,True))/(2*h))
    delta=[p[c]-row['pixelOffset'][c] for c in range(2)]
    details.append(dict(index=i,originalPassed=row['passed'],requestedPixelOffset=row['pixelOffset'],motion=row['motion'],sigma=row['sigma'],originalGolden=row['candidateLocalShaderErf'],actualGPU=row['actual'],originalError=row['error'],hypothetical8bitInterpolant=p,interpolantDeltaPixels=delta,kernelGradient=gradient,firstOrderKernelDelta=sum(gradient[c]*delta[c] for c in range(2)),predictedKernel=predicted,residual=predicted-row['actual']))

result=dict(schema='glass-atoll.adaptive-tail-fixed-raster-grid-study.v1',actualNewGPU=False,productionEdited=False,sourceArtifact=str(source.name),fixtures=len(rows),originalCounts=report['counts'],hypotheses=grid_results,failedFixtures=[r for r in details if not r['originalPassed']],maximum8bitResidual=max(abs(r['residual']) for r in details),rms8bitResidual=math.sqrt(sum(r['residual']**2 for r in details)/len(details)),limits=['A single global fixed-point grid hypothesis is tested against all103 preserved samples; SUBPIXEL_BITS has not been read by this offline script.','Raster interpolation is implementation-dependent; the actual vertex diagnostic vOffset/vMotion/vSigma/N readback is needed to distinguish this mechanism from other projection errors.','Neither the preserved original acceptance gate nor its failed result is changed; this is a cause-isolation model, not a new acceptance test.','Source amplitude uses the old helper normalization. Remaining Float32 projection/erf/interpolant error is not modelled as bitexact CPU simulation.'])
path=HERE/'adaptive-tail-raster-snap-study.json';path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(fixtures=result['fixtures'],originalCounts=result['originalCounts'],hypotheses=grid_results,maximum8bitResidual=result['maximum8bitResidual'],failedCases=len(result['failedFixtures'])),indent=2))
