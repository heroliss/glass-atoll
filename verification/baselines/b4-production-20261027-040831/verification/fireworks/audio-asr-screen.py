"""Bounded CPU English ASR screen, NOT subjective listening/voice-free proof."""
from pathlib import Path
import os,sys,json,subprocess,wave,ctypes,hashlib,time
here=Path(__file__).resolve().parent
root=here.parents[1]
tools=root/'verification/audio/asr-tools'
os.environ['OMP_NUM_THREADS']='1';os.environ['OPENBLAS_NUM_THREADS']='1'
if os.name=='nt':ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(),0x4000)
sys.path.insert(0,str(tools/'python-packages'))
from vosk import Model,KaldiRecognizer,SetLogLevel
SetLogLevel(-1);os.chdir(tools);started=time.monotonic();model=Model('model/vosk-model-small-en-us-0.15')
source=root/'assets/audio/fireworks/burst-richwise-preview-mono.ogg';decoded=here/'burst-asr-16k.wav'
subprocess.run(['ffmpeg','-v','error','-threads','1','-y','-i',str(source),'-ar','16000','-ac','1','-c:a','pcm_s16le',str(decoded)],check=True,timeout=20)
recognizer=KaldiRecognizer(model,16000);recognizer.SetWords(True);segments=[]
with wave.open(str(decoded),'rb') as w:
    while True:
        b=w.readframes(4000)
        if not b:break
        if recognizer.AcceptWaveform(b):segments.append(json.loads(recognizer.Result()))
        if time.monotonic()-started>45:raise TimeoutError('ASR screen bounded at45s')
segments.append(json.loads(recognizer.FinalResult()))
report={'scope':'English-only CPU ASR technical screening, not subjective hearing','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'segments':segments,'recognizedText':' '.join(s.get('text','') for s in segments),'elapsedSeconds':time.monotonic()-started,'model':'Vosk small-en-us-0.15 / Apache2.0; existing QA model, not a runtime dependency','modelSource':'https://alphacephei.com/vosk/models','limits':['may miss distant/masked/non-English speech','noise may cause false words','cannot certify voice-free or pleasant timbre']}
(here/'audio-asr-screen.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
