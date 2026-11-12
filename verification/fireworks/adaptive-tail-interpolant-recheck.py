"""Read-only independent CPU re-evaluation of root's actual varying readback.
The original requested-coordinate7/8 result and all thresholds remain unchanged.
"""
import importlib.util
import json
import math
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('streak_oracle',HERE/'gaussian-streak-oracle.py')
o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
wrapped=json.loads((HERE.parent/'r9-adaptive-tail-varying-probe.json').read_text(encoding='utf-8'))
probe=wrapped['result']

def measured_kernel(p,m,sigma,N,blend):
    return (1-blend)*o.midpoint(p,m,sigma,int(N[0]),o.shader_erf,True)+blend*o.midpoint(p,m,sigma,int(N[1]),o.shader_erf,True)

rows=[]
for row in probe['fixtures']:
    actual=row['actual'];requested=row['requested'];observed=row['normalizedWithActual']
    all_actual=measured_kernel(actual['pixelOffset'],actual['motion'],actual['sigma'],actual['N'],actual['blend'])
    offset_only=o.candidate(actual['pixelOffset'],requested['motion'],requested['sigma'],o.shader_erf,True)
    except_offset=measured_kernel(requested['pixelOffset'],actual['motion'],actual['sigma'],actual['N'],actual['blend'])
    continuous=o.reference(actual['pixelOffset'],actual['motion'],actual['sigma'],2)
    absolute=abs(all_actual-observed);budget=5e-5+5e-4*abs(all_actual)
    original_budget=5e-5+5e-4*abs(row['requestedCandidate'])
    rows.append(dict(index=row['index'],requested=requested,actualInterpolants=actual,observedKernel=observed,requestedCoordinateCandidate=row['requestedCandidate'],requestedCoordinateError=abs(row['normalizedWithIdeal']-row['requestedCandidate']),requestedCoordinateBudget=original_budget,requestedCoordinatePassed=abs(row['normalizedWithIdeal']-row['requestedCandidate'])<=original_budget,measuredInputCandidate=all_actual,measuredInputError=absolute,measuredInputBudget=budget,measuredInputPassed=absolute<=budget,offsetOnlyCandidate=offset_only,offsetOnlyResidual=abs(offset_only-observed),exceptOffsetCandidate=except_offset,exceptOffsetResidual=abs(except_offset-observed),continuousIntegralAtActualInput=continuous,continuousResidual=abs(continuous-observed),amplitudeNormalizationDifference=abs(row['normalizedWithActual']-row['normalizedWithIdeal'])))

summary=dict(fixtures=len(rows),queriedSUBPIXEL_BITS=probe['subpixelBits'],instrumentationMaxDelta=probe['summary']['maximumInstrumentationDelta'],maximumOffsetDriftPixels=probe['summary']['maximumAbsoluteOffsetDrift'],requestedCoordinateFailed=sum(not r['requestedCoordinatePassed'] for r in rows),measuredInputFailed=sum(not r['measuredInputPassed'] for r in rows),maximumMeasuredInputError=max(r['measuredInputError'] for r in rows),maximumMeasuredInputBudgetRatio=max(r['measuredInputError']/r['measuredInputBudget'] for r in rows),maximumOffsetOnlyResidual=max(r['offsetOnlyResidual'] for r in rows),maximumExceptOffsetResidual=max(r['exceptOffsetResidual'] for r in rows),maximumAmplitudeNormalizationDifference=max(r['amplitudeNormalizationDifference'] for r in rows),maximumContinuousIntegralResidual=max(r['continuousResidual'] for r in rows))
result=dict(schema='glass-atoll.adaptive-tail-actual-interpolant-independent-recheck.v1',newGPUExecuted=False,sourceActualGPUArtifact='verification/r9-adaptive-tail-varying-probe.json',sourceProbePassed=probe['passed'],sourceProbeCounts=probe['counts'],summary=summary,engineeringTolerance=dict(absolute=5e-5,relative=5e-4,unchanged=True),originalRequestedCoordinateFailurePreserved=True,rows=rows,limits=['This CPU analysis consumes actual GPUvaryings that were separately read back by root. It creates no GLprogram and does not modify shader/oracle/thresholds.','Matching actual interpolants validates arithmetic at those inputs, not that raster-interpolated offsets equal the requested physical source-centre coordinates.','SUBPIXEL_BITS was actually reported as4; the preceding8bit offline grid model is only an explanatory best fit, not a queried hardwarefact.','A projected-centre/gl_FragCoord runtime fix still requires actual original-golden rerun, legacy/head exact regressions, main/mirror/viewport checks and current source bounds.'])
path=HERE/'adaptive-tail-interpolant-recheck.json';path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary,indent=2))
