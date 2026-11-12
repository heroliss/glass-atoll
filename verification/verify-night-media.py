import hashlib,json,subprocess
from pathlib import Path
import numpy as np

base=Path(__file__).resolve().parent
media=base/'night-playground-preview-v2.mp4'
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels','-of','json',str(media)]))
decoded=subprocess.run(['ffmpeg','-v','error','-i',str(media),'-f','null','-'],capture_output=True,text=True)
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(media),'-vn','-ac','2','-ar','48000','-c:a','pcm_f32le','-f','f32le','-'])
audio=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
checks=[{'name':'complete_video_and_audio_decode','passed':decoded.returncode==0 and not decoded.stderr.strip()},
        {'name':'actual_decoded_stereo_is_finite','passed':bool(np.isfinite(audio).all())},
        {'name':'actual_decoded_stereo_has_no_full_scale_samples','passed':bool(np.max(np.abs(audio))<1)},
        {'name':'two_channel_24_second_soundtrack','passed':audio.shape==(1152000,2)}]
report={'date':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'passed':all(c['passed'] for c in checks),'checks':checks,'media':media.name,'sha256':hashlib.sha256(media.read_bytes()).hexdigest(),
        'probe':probe,'fullDecodeError':decoded.stderr.strip(),'stereo':{'sampleRate':48000,'frames':len(audio),'peakPerChannel':np.max(np.abs(audio),axis=0).tolist(),'rmsPerChannel':np.sqrt(np.mean(audio.astype(float)**2,axis=0)).tolist(),'fullScaleSamples':int(np.count_nonzero(np.abs(audio)>=1))},
        'limits':['Codec and decoded sample-peak checks do not establish subjective quality, intersample true peak or rendered scene fps','Ordinary SDR preview, not a calibrated HDR recording']}
(base/'night-playground-v2-media-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'stereo':report['stereo'],'duration':probe['format']['duration']}))
