"""CPU-only, bounded read-only QA of the completed R36 recording and preview.
Never applies gain to either retained medium. Writes new QA/still artifacts only.
"""
from pathlib import Path
import bisect, hashlib, json, math, shutil, statistics, subprocess, time
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent.parent
V=ROOT/'verification'
NATIVE=V/'r36-radiant-motion-native.webm'
PREVIEW=V/'r36-radiant-motion-preview.mp4'
REPORT=V/'r36-motion-media-qa.json'
START=time.monotonic()
commands=[]

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,timeout=45,binary=False):
    began=time.monotonic()
    p=subprocess.run(args,cwd=ROOT,capture_output=True,timeout=timeout)
    commands.append({'program':Path(args[0]).name,'args':args[1:],'returncode':p.returncode,'wallSeconds':time.monotonic()-began,'timeoutSeconds':timeout,'stderr':p.stderr.decode('utf-8','replace')[-10000:]})
    if p.returncode: raise RuntimeError(f'{Path(args[0]).name} failed: '+p.stderr.decode('utf-8','replace')[-2000:])
    return p.stdout if binary else p.stdout.decode('utf-8','replace')
def probe(p):
    meta=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(p)]))
    frames=json.loads(run(['ffprobe','-v','error','-show_frames','-show_entries','frame=media_type,stream_index,pts_time,best_effort_timestamp_time,duration_time,nb_samples','-of','json',str(p)]))['frames']
    compact={}
    for kind in ['video','audio']:
        f=[x for x in frames if x['media_type']==kind]
        pts=[float(x.get('best_effort_timestamp_time',x['pts_time'])) for x in f]
        gaps=[b-a for a,b in zip(pts,pts[1:])]
        assert f and all(g>0 for g in gaps),(p,kind,'Non-monotone decoded PTS')
        compact[kind]={'frames':len(f),'firstPTS':pts[0],'lastPTS':pts[-1],'endByLastFrameDuration':pts[-1]+float(f[-1].get('duration_time',0)),'intervalMin':min(gaps),'intervalMedian':statistics.median(gaps),'intervalMax':max(gaps),'intervalMean':statistics.mean(gaps),'PTS':pts,'durationSeconds':[float(x.get('duration_time',0)) for x in f]}
    return meta,compact
def loudness(p):
    # FFmpeg's first-pass input_* measurements only. Filter output is discarded;
    # the retained WebM/MP4 are never rewritten or normalized.
    before=sha(p)
    run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-map','0:a:0','-af','loudnorm=I=-23:TP=-1:LRA=7:print_format=json','-f','null','NUL'])
    stderr=commands[-1]['stderr'];j=json.loads(stderr[stderr.rfind('{'):])
    assert before==sha(p)
    return {k:j[k] for k in ['input_i','input_tp','input_lra','input_thresh']}|{'method':'FFmpeg loudnorm first-pass input measurements; processed analysis output discarded to NUL; retained source bytes unchanged'}

report={'schema':'glass-atoll.r36-motion-media-qa.v1','passed':False,'actualGPU':False,'browserUsed':False,'newRecordingPerformed':False,'commands':commands,'limits':['The encoded capture requests 30 fps; variable native timestamps and CFR duplicates do not establish renderer 30 fps.','Audio begins at PTS 0 while the first native video frame is delayed; the initial A/V stream offset is retained and explicitly reported.','Preview is a lossy H264/AAC compatibility transcode, with one right-edge pad column and PC-to-TV range conversion; it is not bitwise pixel/audio identity.','No visual or listening acceptance, absolute HDR nits, physical sound-pressure calibration, scene replay or renderer performance is established.','Wall-clock and physical simulation clocks differ; captured native PTS are not physical scene ages.']}
try:
    assert NATIVE.stat().st_size==2160629
    assert NATIVE.read_bytes()[:4]==bytes.fromhex('1a45dfa3')
    originalHashes={str(p):sha(p) for p in [NATIVE,PREVIEW,ROOT/'fireworks-audio.js']}
    assert originalHashes[str(ROOT/'fireworks-audio.js')]=='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'
    raw=json.loads((V/'r36-radiant-motion-recording.json').read_text(encoding='utf-8-sig'))
    assert raw['passed'] and raw['actualRecording'] and raw['revision'].endswith('v2')
    assert raw['bytes']==NATIVE.stat().st_size and raw['launch']['effectProfile']=='three-heart-radiant120-v1' and raw['launchSource']['seed']==341070
    assert raw['final']['audio']['recordedPlays']-raw['initial']['audio']['recordedPlays']==1
    assert raw['cleanup']['paused'] and raw['cleanup']['audioTapStopped'] and raw['cleanup']['tracksStopped']
    nativeMeta,nativeFrames=probe(NATIVE);previewMeta,previewFrames=probe(PREVIEW)
    ns={s['codec_type']:s for s in nativeMeta['streams']};ps={s['codec_type']:s for s in previewMeta['streams']}
    assert len(ns)==len(ps)==2
    assert (ns['video']['codec_name'],ns['video']['width'],ns['video']['height'],ns['video']['color_range'])==('vp9',1209,1292,'pc')
    assert (ns['audio']['codec_name'],ns['audio']['sample_rate'],ns['audio']['channels'])==('opus','48000',2)
    assert (ps['video']['codec_name'],ps['video']['width'],ps['video']['height'],ps['video']['level'],ps['video']['color_range'])==('h264',1210,1292,41,'tv')
    assert (ps['audio']['codec_name'],ps['audio']['sample_rate'],ps['audio']['channels'])==('aac','48000',2)
    assert nativeFrames['video']['firstPTS']==2.113 and nativeFrames['audio']['firstPTS']==0
    assert previewFrames['video']['firstPTS']==2.1 and previewFrames['audio']['firstPTS']==0
    assert max(abs((b-a)-1/30) for a,b in zip(previewFrames['video']['PTS'],previewFrames['video']['PTS'][1:]))<1.1e-6
    assert previewFrames['video']['frames']>nativeFrames['video']['frames']
    decodes=[]
    for p in [NATIVE,PREVIEW]:
        run(['ffmpeg','-hide_banner','-v','error','-xerror','-err_detect','explode','-threads','2','-i',str(p),'-map','0:v:0','-map','0:a:0','-f','null','NUL'])
        decodes.append({'path':str(p),'passed':True,'completeVideoAndAudio':True,'stderr':commands[-1]['stderr']})
    report['media']={'native':{'metadata':nativeMeta,'frames':nativeFrames},'preview':{'metadata':previewMeta,'frames':previewFrames}}
    report['timeline']={'nativeAudioFirstPTS':0,'nativeVideoFirstPTS':2.113,'nativeStreamOnsetOffsetSeconds':2.113,'previewAudioFirstPTS':0,'previewVideoFirstPTS':2.1,'previewStreamOnsetOffsetSeconds':2.1,'CFRStartRoundingSeconds':-.013,'startRoundingLessThanOneCFRFrame':True,'nativeFrames':nativeFrames['video']['frames'],'previewFrames':previewFrames['video']['frames'],'previewCFRFramesAreNotRendererFrames':True,'recorderWallSeconds':raw['captureWallSeconds'],'physicalSecondsAdvanced':raw['physicalSecondsAdvanced'],'physicalToCaptureWallRatio':raw['physicalToCaptureWallRatio']}
    report['completeDecode']=decodes
    report['audioAnalysis']={'native':loudness(NATIVE),'preview':loudness(PREVIEW),'retainedMediaNormalized':False,'approvedAudioModuleChanged':False}
    requests=[3,5,6,7,8,9,11,18];pts=nativeFrames['video']['PTS'];selected=[]
    for t in requests:
        index=bisect.bisect_left(pts,t);assert index<len(pts)
        selected.append({'requestedTimelineSeconds':t,'nativeFrameIndex':index,'actualNativePTS':pts[index],'path':str(V/f'r36-radiant-motion-still-{t:02d}s.png')})
    expression='+'.join(f'eq(n\\,{x["nativeFrameIndex"]})' for x in selected)
    output=V/'r36-motion-qa-selected-%02d.png'
    run(['ffmpeg','-hide_banner','-v','error','-threads','2','-i',str(NATIVE),'-map','0:v:0','-vf','select='+expression,'-fps_mode','vfr','-frames:v','8',str(output)])
    for i,item in enumerate(selected,1):
        temp=V/f'r36-motion-qa-selected-{i:02d}.png';dest=Path(item['path']);assert not dest.exists();temp.rename(dest)
        with Image.open(dest) as im:assert im.size==(1209,1292)
        item['sha256']=sha(dest);item['bytes']=dest.stat().st_size
    # No source crop, exposure edit, sharpening or visual enhancement.
    thumbW=403;thumbH=round(1292*thumbW/1209);gap=16;labelH=52;headerH=84;footerH=66
    sheet=Image.new('RGB',(4*thumbW+5*gap,headerH+2*(thumbH+labelH)+3*gap+footerH),(17,22,28));draw=ImageDraw.Draw(sheet)
    fontFile=Path('C:/Windows/Fonts/arial.ttf');font=ImageFont.truetype(str(fontFile),22) if fontFile.exists() else ImageFont.load_default();small=ImageFont.truetype(str(fontFile),18) if fontFile.exists() else font
    draw.text((gap,14),'R36 | decoded native SDR frames | fixed camera | 1209 x 1292 sources',font=font,fill=(237,241,246))
    draw.text((gap,46),'Media timeline: audio starts 0.000 s; native video starts 2.113 s. No gain or exposure edits.',font=small,fill=(174,188,202))
    for i,item in enumerate(selected):
        x=gap+(i%4)*(thumbW+gap);y=headerH+gap+(i//4)*(thumbH+labelH+gap)
        with Image.open(item['path']) as image:sheet.paste(image.convert('RGB').resize((thumbW,thumbH),Image.Resampling.LANCZOS),(x,y))
        draw.text((x,y+thumbH+5),f'{item["requestedTimelineSeconds"]:02d}s  |  actual PTS {item["actualNativePTS"]:.3f}s',font=small,fill=(237,241,246))
    draw.text((gap,sheet.height-footerH+8),'Contact sheet is a navigation aid; inspect individual full-resolution PNGs for trail and smoke detail.',font=small,fill=(174,188,202))
    contact=V/'r36-radiant-motion-contact-sheet.png';assert not contact.exists();sheet.save(contact)
    report['stills']=selected;report['contactSheet']={'path':str(contact),'size':list(sheet.size),'sha256':sha(contact),'bytes':contact.stat().st_size,'transform':'Full native frame resized for contact sheet only; standalone PNGs retain native dimensions'}
    bad=V/'r36-motion-export-bad-mime-comma.webm';badReceipt=json.loads((V/'r36-motion-export-mime-comma-failure.json').read_text(encoding='utf-8-sig'));transport=json.loads((V/'r36-recorder-transport-timeout.json').read_text(encoding='utf-8-sig'));afterTransport=json.loads((V/'r36-recorder-after-transport-timeout.json').read_text(encoding='utf-8-sig'))
    assert bad.stat().st_size==badReceipt['badBytes']==7 and not badReceipt['passed'] and badReceipt['newRecordingPerformed'] is False
    assert not transport['passed'] and afterTransport['paused'] and afterTransport['audioCapture'] is False and afterTransport['gl']['errors']==[]
    report['preservedFailures']={'badExport':{'path':str(bad),'bytes':7,'sha256':sha(bad),'cause':badReceipt['cause'],'notAcceptedMedia':True},'transport':{'path':str(V/'r36-recorder-transport-timeout.json'),'sha256':sha(V/'r36-recorder-transport-timeout.json'),'recordingOutcome':transport['recordingOutcome'],'cleanupConfirmedFromSavedEvidence':True}}
    for p,h in originalHashes.items():assert sha(Path(p))==h,p+' changed during QA'
    report['retainedSourceHashes']=originalHashes
    report['artifacts']=[{'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)} for p in [NATIVE,PREVIEW,V/'r36-radiant-motion-recording.json',V/'r36-motion-export-mime-comma-failure.json',V/'r36-recorder-transport-timeout.json',Path(__file__)]]
    report['passed']=True
except Exception as error:
    report['error']=repr(error)
finally:
    report['wallSeconds']=time.monotonic()-START
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'report':str(REPORT),'wallSeconds':report['wallSeconds'],'contactSheet':report.get('contactSheet',{}).get('path'),'error':report.get('error')},ensure_ascii=False))
if not report['passed']:raise SystemExit(1)
