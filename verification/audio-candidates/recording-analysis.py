"""Reproduce the recorded-candidate technical scan; production assets stay untouched.
Run from any working directory: py -3 recording-analysis.py
Uses existing local NumPy/SoundFile/SciPy and the pre-existing Vosk QA tools/model.
"""
import hashlib, json, re, shutil, sys, tempfile, urllib.request
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfilt

BASE = Path(__file__).resolve().parent
TOOLS = BASE.parent / 'audio/asr-tools'
sys.path.insert(0, str(TOOLS / 'python-packages'))
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)
SOURCES = [
    dict(file='firecracker-single.mp3', author='iliyabylich04', soundID=651332, title='Firecracker - Single in Ground.wav', preview='https://cdn.freesound.org/previews/651/651332_14128260-hq.mp3', crops=[[0, .32]]),
    dict(file='loud-bang-cutoff.mp3', author='qubodup', soundID=840510, title='Loud Firewords Bang Cut Off', preview='https://cdn.freesound.org/previews/840/840510_71257-hq.mp3', crops=[[0, 1.10]]),
    dict(file='nye-loud-booms.mp3', author='LOVEBURD', soundID=376662, title='NYE Loud Booms.wav', preview='https://cdn.freesound.org/previews/376/376662_5735740-hq.mp3', crops=[[.98, 1.52], [1.53, 2.15]]),
    dict(file='fireworks-crackle.mp3', author='16FThumaF', soundID=505264, title='Fireworks Crackle', preview='https://cdn.freesound.org/previews/505/505264_10791958-hq.mp3', crops=[[38, 41.25], [43.4, 46.35]]),
]

def db(value):
    return float(20 * np.log10(max(float(value), 1e-12)))

def recognize(model, audio, sample_rate):
    mono16 = resample_poly(audio, 1, 3) if sample_rate == 48000 else resample_poly(audio, 16000, sample_rate)
    pcm = (np.clip(mono16, -1, 1) * 32767).astype('<i2').tobytes()
    rec = KaldiRecognizer(model, 16000)
    rec.SetWords(True)
    results = []
    for i in range(0, len(pcm), 8000):
        if rec.AcceptWaveform(pcm[i:i+8000]):
            item = json.loads(rec.Result())
            if item.get('text'): results.append(item)
    item = json.loads(rec.FinalResult())
    if item.get('text'): results.append(item)
    return results

temporary = Path(tempfile.mkdtemp(prefix='glass-audio-qa-'))
try:
    # Vosk's native Windows loader does not accept this workspace's Unicode path.
    model_path = temporary / 'model'
    shutil.copytree(TOOLS / 'model/vosk-model-small-en-us-0.15', model_path)
    model = Model(str(model_path))
    rows = []
    for item in SOURCES:
        path = BASE / item['file']
        d, sr = sf.read(path, dtype='float32')
        mono = d.mean(axis=1) if d.ndim > 1 else d
        step = int(sr * .05)
        frames = mono[:len(mono)//step*step].reshape(-1, step)
        levels = 20*np.log10(np.maximum(np.sqrt(np.mean(frames*frames, axis=1)), 1e-9))
        crop_rows = []
        for start, end in item['crops']:
            x = mono[int(start*sr):int(end*sr)]
            power = float(np.mean(x*x))
            low = float(np.mean(sosfilt(butter(4, 180, fs=sr, output='sos'), x)**2))
            high = float(np.mean(sosfilt(butter(4, 2500, fs=sr, btype='highpass', output='sos'), x)**2))
            crop_rows.append(dict(startSeconds=start, endSeconds=end, rmsDbfs=db(np.sqrt(power)), energyBelow180HzFraction=low/power, energyAbove2500HzFraction=high/power))
        source_page = f"https://freesound.org/people/{item['author']}/sounds/{item['soundID']}/"
        try:
            html = urllib.request.urlopen(source_page, timeout=30).read().decode('utf8')
            matches = re.findall(r'href="(https?://creativecommons.org/publicdomain/zero/1.0/)"', html)
            preview_present = item['preview'] in html
            license_evidence = dict(verified=True, licenseLink=matches[0] if matches else None, displayedName='Creative Commons 0' if 'Creative Commons 0' in html else None, expectedPublicHQPreviewPresent=preview_present)
        except Exception as error:
            license_evidence = dict(verified=False, error=str(error), earlierLiveVerification='Source page and CC0 anchor verified in the task tool output on 2026-10-31; this refresh failed.')
        rows.append(dict(file=item['file'], author=item['author'], title=item['title'], source=source_page, downloadURL=item['preview'], license='CC0 1.0', licenseEvidence=license_evidence, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size, sampleRate=sr, channels=1 if d.ndim==1 else d.shape[1], decodedSeconds=len(mono)/sr, decodedMonoPeak=float(np.max(np.abs(mono))), decodedMonoRmsDbfs=db(np.sqrt(np.mean(mono*mono))), loudest50ms=[dict(startSeconds=float(i)*.05, rmsDbfs=float(levels[i])) for i in np.argsort(levels)[-8:][::-1]], candidateCrops=crop_rows, englishASRResults=recognize(model, mono, sr)))
    report = dict(schema='glass-atoll.recorded-firework-candidate-scan.v1', localDate='2026-10-31', command='py -3 glass-atoll/verification/audio-candidates/recording-analysis.py', productionEdited=False, subjectiveListeningPerformed=False, analysis=dict(decoder=f'Python SoundFile {sf.__version__}', numericalLibrary=f'NumPy {np.__version__}', rmsWindowSeconds=.05, frequencySplit='4th-order causal Butterworth lowpass180Hz and highpass2500Hz; power fractions are descriptive, not calibrated sound-pressure measurements', asr='Existing Vosk model vosk-model-small-en-us-0.15; downmix then polyphase resample to16kHz; PCM16 and8000byte chunks; words enabled', windowsNativeModelPathWorkaround='Copied pre-existing model to an isolated ASCII temporary path; removed after analysis'), rows=rows, limitations=['All downloads are publicly linked lossy HQ MP3 previews, not original WAV/FLAC files.', 'CC0 has no attribution condition; provenance should still be retained. Source-page license anchors were checked live.', 'No recognized English text does not prove absence of speech, non-English voices, music or other background noise.', 'Crop recommendations come from finite waveform-energy analysis; actual timbre, background and integrated mix still require human listening.', 'Full recordings contain ambience. Crackle is relatively quiet and distant; it is not a clean isolated bright crackle instrument.', 'No normalization or EQ has been applied to source candidates by this script.'])
    (BASE/'recording-scan.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps(dict(rows=len(rows), allLicenseAnchorsVerified=all(r['licenseEvidence'].get('licenseLink') for r in rows), englishRecognizedText=[r['file'] for r in rows if r['englishASRResults']], report='recording-scan.json')))
finally:
    shutil.rmtree(temporary)
