"""Read-only technical spectrum/attack audit. No subjective listening claim."""
from pathlib import Path
import subprocess,json,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[2]
FFMPEG='C:/ProgramData/chocolatey/bin/ffmpeg.exe'
RATE=48000
def decode(path,channels=1):
    data=subprocess.run([FFMPEG,'-v','error','-i',str(path),'-f','f32le','-acodec','pcm_f32le','-ar',str(RATE),'-ac',str(channels),'pipe:1'],stdout=subprocess.PIPE,check=True).stdout
    return np.frombuffer(data,dtype='<f4').reshape(-1,channels).astype(np.float64)
def db(x): return float(20*np.log10(max(float(x),1e-20)))
def stats(x):
    x=np.asarray(x).reshape(-1); peak=float(np.max(np.abs(x))); energy=x*x; c=np.r_[0,np.cumsum(energy)]; n=round(RATE*.02); blocks=(c[n:]-c[:-n])/n
    q=lambda p:float(np.searchsorted(c,p*c[-1])/RATE)
    return dict(duration=len(x)/RATE,peak=peak,peakDBFS=db(peak),rms=float(np.sqrt(np.mean(energy))),peakTime=float(np.argmax(np.abs(x))/RATE),first10PercentPeak=float(np.argmax(np.abs(x)>peak*.1)/RATE),maximum20msRMS=float(np.sqrt(np.max(blocks))),energy5PercentTime=q(.05),energy95PercentTime=q(.95),firstWindowsRMS={str(t):float(np.sqrt(np.mean(energy[:round(t*RATE)]))) for t in [.01,.02,.05,.1,.25,1] if t*RATE<len(x)})
bands=[(0,20),(20,80),(80,250),(250,1000),(1000,4000),(4000,12000),(12000,24001)]
def spectrum(x,seconds=.25):
    x=np.asarray(x)[:round(seconds*RATE)]; x=x-x.mean(axis=0); f=np.fft.rfftfreq(len(x),1/RATE); power=np.abs(np.fft.rfft(x,axis=0))**2
    if power.ndim>1:power=power.mean(axis=1)
    power[1:-1]*=2
    return {f'{a}-{b}Hz':dict(energy=float(power[(f>=a)&(f<b)].sum()),fraction=float(power[(f>=a)&(f<b)].sum()/max(power.sum(),1e-30))) for a,b in bands}
originalPath=ROOT/'assets/audio/fireworks/single-firework-richwise-preview-hq.mp3'
clipPath=ROOT/'assets/audio/fireworks/burst-richwise-preview-mono.ogg'
mixedPath=ROOT/'verification/night-playground-audio.wav'
original=decode(originalPath,2); crop=original[round(3.572708333*RATE):round((3.572708333+3.4)*RATE)]; mono=crop.mean(axis=1); clip=decode(clipPath)[:,0]; mixed=decode(mixedPath)[:,0]
stereoSpectrum=spectrum(crop); monoSpectrum=spectrum(mono); clipSpectrum=spectrum(clip)
matches=json.loads((ROOT/'verification/night-playground-audio-check.json').read_text(encoding='utf-8'))['matches']
events=[]
for m in matches:
    t=m['matchedSeconds']; i=round(t*RATE); event=mixed[i:i+round(.25*RATE)]; before=mixed[max(0,i-round(1.5*RATE)):i-round(.15*RATE)]; foreground=stats(event); background=stats(before)
    events.append(dict(clipStart=t,distance=m['distanceMetres'],eventFirst250ms=foreground,before1p35Seconds=background,event20msToBeforeRMSRatio=foreground['maximum20msRMS']/max(background['rms'],1e-20),event20msToBefore20msRatio=foreground['maximum20msRMS']/max(background['maximum20msRMS'],1e-20),spectrumFirst250ms=spectrum(event)))
distance=matches[0]['distanceMetres']; distanceGain=24/distance; gain=.9*.64*.75*distanceGain
report=dict(scope='technical waveform/FFT and scalar-gain audit; no subjective listening or measured SPL; compressor automatic makeup/HRTF excluded from scalar estimate',sources={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [originalPath,clipPath,mixedPath]},clip=stats(clip),originalMonoBeforeReencoding=stats(mono),clipFirst250msSpectrum=clipSpectrum,clipFirst1sSpectrum=spectrum(clip,1),monoFoldBandEnergyDB={b:10*np.log10(max(monoSpectrum[b]['energy'],1e-30)/max(stereoSpectrum[b]['energy'],1e-30)) for b in monoSpectrum},mixed=stats(mixed),events=events,gainChain=dict(distanceMetres=distance,distanceGain=distanceGain,distanceGainDB=db(distanceGain),sourceGain=.9,pyroBusGain=.64,masterGain=.75,scalarCombinedGain=gain,scalarCombinedGainDB=db(gain),sourcePeakTimesScalarGain=float(np.max(np.abs(clip))*gain),sourcePeakTimesScalarGainDBFS=db(np.max(np.abs(clip))*gain),lowpassHz=18000/(1+distance/280),notes='DynamicsCompressorNode has automatic makeup and fixed lookahead; these estimates are not predicted final samples. Actual final waveform is separately measured.'))
(ROOT/'verification/fireworks/audio-boom-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['clip','clipFirst250msSpectrum','monoFoldBandEnergyDB','gainChain']},indent=2))
print(json.dumps({'events':[{k:v for k,v in e.items() if k!='spectrumFirst250ms'} for e in events]},indent=2))
