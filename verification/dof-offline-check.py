"""Small offline image/media audit; no renderer, browser or runtime changes."""
from pathlib import Path
import json, math, subprocess, time, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
off_image = Image.open(ROOT / 'navigation-night-dof-off.png').convert('RGB')
on_image = Image.open(ROOT / 'navigation-night-dof-on.png').convert('RGB')
assert off_image.size == on_image.size
off = np.asarray(off_image, dtype=np.float32)
on = np.asarray(on_image, dtype=np.float32)
weights = np.array([.2126,.7152,.0722], dtype=np.float32)
off_y, on_y = off @ weights, on @ weights

def gradient_rms(image, mask=None):
    dx=(image[1:-1,2:]-image[1:-1,:-2])*.5
    dy=(image[2:,1:-1]-image[:-2,1:-1])*.5
    value=(dx*dx+dy*dy)*.5
    if mask is not None:
        value=value[mask[1:-1,1:-1]]
    return float(np.sqrt(value.mean())/255.) if value.size else 0.

rois={'far_water':[550,55,1100,310], 'focus_water_band':[420,540,820,755], 'near_water':[550,1030,1100,1240]}
metrics={}
for name,(x0,y0,x1,y1) in rois.items():
    a,b=off_y[y0:y1,x0:x1],on_y[y0:y1,x0:x1]
    before,after=gradient_rms(a),gradient_rms(b)
    metrics[name]={'bounds':[x0,y0,x1,y1],'offGradientRMS':before,'onGradientRMS':after,'onToOffGradientRatio':after/before,'meanAbsoluteDisplayLumaDifference255':float(np.abs(a-b).mean())}

# A colour mask restricted to the visible yellow-green floating leaf. This
# is a display-space proxy, not a segmentation model or a physical MTF test.
mask=np.zeros(off_y.shape,dtype=bool)
mask[600:685,545:670]=True
mask &= (off[:,:,0] > off[:,:,2]*1.15) & (off[:,:,1] > off[:,:,2]*1.25)
inner=mask.copy()
for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
    inner &= np.roll(mask,(dy,dx),(0,1))
metrics['leaf_subject']={'maskBounds':[545,600,670,685],'pixels':int(mask.sum()),'interiorPixels':int(inner.sum()),'meanAbsoluteRGBDifference255':float(np.abs(on-off)[mask].mean()),'interiorMeanAbsoluteRGBDifference255':float(np.abs(on-off)[inner].mean()),'offInteriorGradientRMS':gradient_rms(off_y,inner),'onInteriorGradientRMS':gradient_rms(on_y,inner)}

try:
    font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',21)
    small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
except OSError:
    font=small=ImageFont.load_default()
canvas=Image.new('RGB',(1200,705),'#142129');draw=ImageDraw.Draw(canvas)
diff=np.clip(np.abs(on-off).mean(axis=2)*4,0,255).astype(np.uint8)
heat=ImageOps.colorize(Image.fromarray(diff),black='#142129',white='#ffb56b')
for x,label,img in [(10,'DOF OFF',off_image),(410,'DOF ON',on_image),(810,'|ON - OFF| x4',heat)]:
    draw.text((x+8,8),label,font=font,fill='white')
    thumb=img.copy();thumb.thumbnail((380,420),Image.Resampling.LANCZOS);canvas.paste(thumb,(x+(380-thumb.width)//2,42))
for x,img,label in [(18,off_image,'OFF leaf'),(290,on_image,'ON leaf')]:
    crop=img.crop((545,595,675,690)).resize((260,190),Image.Resampling.LANCZOS);canvas.paste(crop,(x,496));draw.text((x,474),label,font=small,fill='white')
for x,img,label in [(570,off_image,'OFF distant water'),(880,on_image,'ON distant water')]:
    crop=img.crop((600,110,900,300));canvas.paste(crop,(x,496));draw.text((x,474),label,font=small,fill='white')
canvas.save(ROOT/'dof-comparison.jpg',quality=90,optimize=True)

if '--images-only' in sys.argv:
    media=json.loads((ROOT/'dof-offline-check.json').read_text(encoding='utf-8'))['media']
else:
    probe=json.loads(subprocess.run(['C:/ProgramData/chocolatey/bin/ffprobe.exe','-v','error','-show_entries','format=duration,size,format_name:stream=index,codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels','-of','json',str(ROOT/'navigation-night-stone.mp4')],check=True,capture_output=True,text=True).stdout)
    started=time.perf_counter()
    decode=subprocess.run(['C:/ProgramData/chocolatey/bin/ffmpeg.exe','-v','error','-nostdin','-threads','1','-i',str(ROOT/'navigation-night-stone.mp4'),'-map','0:v:0','-an','-f','null','NUL'],capture_output=True,text=True)
    media={'probe':probe,'audioStreams':sum(s['codec_type']=='audio' for s in probe['streams']),'fullVideoDecode':{'exitCode':decode.returncode,'stderr':decode.stderr,'wallSeconds':time.perf_counter()-started,'decoderThreads':1},'scope':'silent video QA, not an audio/video synchronization demonstration or a renderer FPS measurement'}
state=json.loads((ROOT/'navigation-night-dof-state.json').read_text(encoding='utf-8'))
report={'sourceImages':['navigation-night-dof-off.png','navigation-night-dof-on.png'],'size':off_image.size,'lens':[{'dof':s['dof'],**{k:s['lens'][k] for k in ['focalMm','aperture','focusMode','focusMetres','sensorHeightMm']}} for s in state],'metrics':metrics,'comparison':'dof-comparison.jpg','media':media,'limits':['Display RGB gradient/MAE are descriptive, not optical MTF or calibrated radiance','Colour mask isolates the visible leaf approximately; water texture and specular detail are not a physical depth oracle','Full MP4 decoding does not validate actual scene FPS or sound timing']}
(ROOT/'dof-offline-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
if media['fullVideoDecode']['exitCode']:
    raise SystemExit(media['fullVideoDecode']['exitCode'])
