from pathlib import Path
import json,math
p=Path('verification/pyro-r6-timed-hdr-sdr-raw.json');r=json.loads(p.read_text(encoding='utf-8'));h,s=r['hdr'],r['sdr'];checks=[]
def ck(name,passed,**e):checks.append(dict(name=name,passed=bool(passed),**e))
ck('actual extended float HDR enabled then SDR then restored',h['display']['enabled'] and not s['display']['enabled'] and r['restoredHDR']['enabled'],mode=h['display']['mode'],peakNits=h['display']['peakNits'],whiteNits=h['display']['sdrWhiteNits'])
ck('same paused physical time camera target and exact serialized smoke state',h['state']['parameters']['paused'] and s['state']['parameters']['paused'] and h['state']['time']==s['state']['time'] and h['state']['camera']==s['state']['camera'] and h['state']['target']==s['state']['target'] and h['smoke']==s['smoke'])
ck('same flight evidence sources intensity P and photographic exposure',h['fireworks']['activeEvents']==s['fireworks']['activeEvents'] and h['photo']['storageEV']==s['photo']['storageEV'] and abs(h['photo']['cameraEV']-s['photo']['cameraEV'])<1e-10,flight=h['fireworks']['activeEvents'][0]['heightInfo']['flightInfo'])
for name,row in [('hdr',h),('sdr',s)]:
 ck(name+': actual resolved field effective',row['fireworks']['lightingField']['effective'] and row['fireworks']['lightingField']['supported'])
 ck(name+': storage bound and output compensation safe',row['photo']['storedBound']<=row['photo']['safeMaximum']*(1+1e-12) and abs(row['photo']['outputExposureScale']/(.76*2**(row['photo']['cameraEV']-row['photo']['storageEV']))-1)<1e-12)
 for k in ['opaque','composed','reflection']:
  v=row['range'][k];ck(name+': '+k+' finite nonnegative and within declared FP16 limit',v['countNonFinite']==0 and v['countNegative']==0 and v['counterConsistency'] and v['globalMax']<=row['photo']['safeMaximum'],maximumStored=v['globalMax'])
for k in ['opaque','composed','reflection']:ck(k+': exact floating master extrema independent of HDR SDR display mode',h['range'][k]['encodedExtrema']==s['range'][k]['encodedExtrema'])
report=dict(schema='glass-atoll.timed-flight-HDR-SDR-scene.v1',passed=all(x['passed'] for x in checks),total=len(checks),passedCount=sum(x['passed'] for x in checks),checks=checks,sourceEvidence='pyro-r6-timed-hdr-sdr-raw.json',limits=['Same complete physical smoke state and exact GPU HDR extrema, not all pixel buffers bitwise identity.','PNG uses explicit SDR output; not an HDR screenshot or measured panel luminance.','Actual browser floating/extended presentation enabled, but photometer calibration, current DRT hue quality and commercial pyro ballistics are not certified.','Default main smoke and flight models remain unchanged; per-launch QA candidate only.'])
Path('verification/pyro-r6-timed-hdr-sdr-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:report[k] for k in ['passed','passedCount','total']},indent=2))
if not report['passed']:raise SystemExit(1)
