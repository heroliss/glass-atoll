import json,wave,sys
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt,correlate
base=Path(__file__).resolve().parent
def read(name):
 with wave.open(str(base/name),'rb') as f:
  rate=f.getframerate();values=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float64)/32768
 return rate,values
tag='-v2' if '--v2' in sys.argv else ''
rate,audio=read(f'night-playground{tag}-audio.wav');rr,reference=read('night-playground-burst-reference.wav');assert rate==rr
meta=json.loads((base/f'night-playground-preview{tag}.json').read_text(encoding='utf-8'))
arrivals={}
for sample in meta['events']:
 event=sample['audio'].get('lastArrival')
 if event and event['kind']=='burst':arrivals[event['audioTime']]=event
sos=butter(3,[180,2500],btype='bandpass',fs=rate,output='sos');x=sosfilt(sos,audio);r=sosfilt(sos,reference);r-=r.mean()
checks=[];matches=[]
full=correlate(x,r,mode='valid',method='fft');fullEnergy=correlate(x*x,np.ones(len(r)),mode='valid',method='fft');full/=np.sqrt(np.maximum(1e-20,fullEnergy*np.dot(r,r)))
lags=np.arange(len(full))/rate;offEvent=np.ones(len(full),dtype=bool)
for event in arrivals.values():offEvent &= abs(lags-(event['expectedArrival']-meta['initialTime']))>.8
null999=float(np.quantile(np.abs(full[offEvent]),.999))
for event in arrivals.values():
 expected=event['expectedArrival']-meta['initialTime'];lo=max(0,int((expected-.45)*rate));hi=min(len(x),int((expected+len(r)/rate+.45)*rate));segment=x[lo:hi]
 scores=correlate(segment,r,mode='valid',method='fft');energies=np.convolve(segment*segment,np.ones(len(r)),mode='valid') if len(segment)<10000 else correlate(segment*segment,np.ones(len(r)),mode='valid',method='fft')
 scores/=np.sqrt(np.maximum(1e-20,energies*np.dot(r,r)));index=int(np.argmax(scores));actual=(lo+index)/rate
 matches.append({'expectedSeconds':expected,'matchedSeconds':actual,'offsetSeconds':actual-expected,'correlation':float(scores[index]),'offEventAbsoluteCorrelation99p9':null999,'signalContrast':float(scores[index]/max(null999,1e-10)),'distanceMetres':event['distance'],'modelDelaySeconds':event['delay'],'source':event['source']})
 checks.append({'name':'recorded burst timing and reference correlation exceed off-event mixed-audio control','passed':bool(abs(actual-expected)<.18 and scores[index]>max(.1,null999*3))})
checks += [{'name':'two real recorded bursts present','passed':len(matches)==2},{'name':'audio is finite and unclipped','passed':bool(np.isfinite(audio).all() and np.max(np.abs(audio))<.9999)},{'name':'non-silent mixed soundtrack','passed':float(np.sqrt(np.mean(audio*audio)))>1e-5}]
report={'passed':all(c['passed'] for c in checks),'sampleRate':rate,'durationSeconds':len(audio)/rate,'peak':float(np.max(np.abs(audio))),'rms':float(np.sqrt(np.mean(audio*audio))),'matches':matches,'checks':checks,'scope':'Actual mixed capture/reference signal timing, not subjective timbre or measured SPL; audio mux/encoding can shift onset slightly'}
(base/f'night-playground{tag}-audio-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
