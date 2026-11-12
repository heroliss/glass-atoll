from pathlib import Path
import array,hashlib,json,math,subprocess,sys
ROOT=Path(__file__).resolve().parent.parent
checks=[];results={}
def check(name,passed,**evidence):checks.append(dict(name=name,passed=bool(passed),**evidence))
cases=[('r5','taylor'),('r5','burn')] if len(sys.argv)==1 else [(sys.argv[1],sys.argv[2])]
summaryTag='r5' if len(sys.argv)==1 else sys.argv[1]
for revision,profile in cases:
 p=ROOT/'verification'/f'pyro-{revision}-{profile}-motion.mp4'; source=ROOT/'verification'/f'pyro-{revision}-{profile}-motion.webm'
 report=json.loads((ROOT/'verification'/f'pyro-{revision}-{profile}-motion.json').read_text(encoding='utf-8-sig'))
 probe=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels:format=duration,size','-of','json',str(p)],capture_output=True,text=True,check=True)
 meta=json.loads(probe.stdout);v=next(s for s in meta['streams'] if s['codec_name']=='h264');a=next(s for s in meta['streams'] if s['codec_name']=='aac')
 dec=subprocess.run(['ffmpeg','-hide_banner','-v','error','-nostdin','-i',str(p),'-f','null','-'],capture_output=True)
 check(profile+': full audiovisual decode clean',dec.returncode==0 and not dec.stderr,diagnostic=dec.stderr.decode(errors='replace'))
 check(profile+': H2641920x1080 CFR30 and AAC stereo48k',v['width']==1920 and v['height']==1080 and v['r_frame_rate']=='30/1' and v['avg_frame_rate']=='30/1' and a['channels']==2 and a['sample_rate']=='48000')
 actual=float(meta['format']['duration']);check(profile+': expected actual recorded duration',abs(actual-report['durationSeconds'])<.5,encodedSeconds=actual,captureWallSeconds=report['durationSeconds'])
 pcm=subprocess.run(['ffmpeg','-hide_banner','-v','error','-nostdin','-i',str(p),'-vn','-f','f32le','-acodec','pcm_f32le','-'],capture_output=True,check=True)
 data=array.array('f');data.frombytes(pcm.stdout)
 if sys.byteorder!='little':data.byteswap()
 peaks=[max(map(abs,data[c::2]),default=0) for c in (0,1)];rms=[math.sqrt(sum(float(x)**2 for x in data[c::2])/max(1,len(data)//2)) for c in (0,1)]
 check(profile+': audio finite nonempty and below sample full scale',len(data)>48000 and all(math.isfinite(x) for x in data) and max(peaks)<1 and min(rms)>1e-5,peakStereo=peaks,rmsStereo=rms,fullScaleSamples=sum(abs(x)>=1 for x in data))
 results[profile]={'media':meta,'peakStereo':peaks,'rmsStereo':rms,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'webmSHA256':hashlib.sha256(source.read_bytes()).hexdigest()}
audioSHA=hashlib.sha256((ROOT/'fireworks-audio.js').read_bytes()).hexdigest();check('accepted main boom source unchanged',audioSHA=='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31',sha256=audioSHA)
out={'schema':'glass-atoll.smoke-motion-media.v1','passed':all(c['passed'] for c in checks),'passedCount':sum(c['passed'] for c in checks),'total':len(checks),'checks':checks,'results':results,'limits':['Full decode/sample peak checks are technical; no new human listening or intersample true-peak/SPL claim.','CFR encoding duplicates/drops actual captured VFR frames;30fps encoding is not renderer performance.','Two real scene episodes, not same-event pixel identity. Ordinary SDR recordings.']}
(ROOT/'verification'/f'pyro-{summaryTag}-motion-media-check.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':out['passed'],'passedCount':out['passedCount'],'total':out['total'],'media':{k:{'peakStereo':v['peakStereo'],'duration':v['media']['format']['duration']} for k,v in results.items()}},ensure_ascii=False,indent=2))
if not out['passed']:sys.exit(1)
