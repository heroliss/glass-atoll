from pathlib import Path
import subprocess,json,hashlib
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parent
out=base/'visual-sequences'
out.mkdir(exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',17)
report=[]
for kind in ['helix','vortex','waterfall','brocade']:
    src=base/'before'/'capture-timing-first'/f'display-{kind}.webm'
    target=out/f'{kind}-%02d.png'
    # Archived initial captures have a leading video gap. Sample clip time only.
    command=['ffmpeg','-hide_banner','-loglevel','error','-ss','5.5','-i',str(src),'-t','9','-vf','fps=2','-frames:v','18','-y',str(target)]
    subprocess.run(command,check=True)
    files=sorted(out.glob(f'{kind}-*.png'))
    assert len(files)==18
    w,h,bar=320,240,26
    sheet=Image.new('RGB',(w*3,(h+bar)*6),'#101820')
    d=ImageDraw.Draw(sheet)
    for i,file in enumerate(files):
        image=Image.open(file);image.load();image=image.resize((w,h),Image.Resampling.LANCZOS)
        x,y=(i%3)*w,(i//3)*(h+bar)
        sheet.paste(image,(x,y+bar));d.text((x+5,y+4),f'{kind} | {5.5+i*.5:.1f}s',font=font,fill='white')
    sheet.save(out/f'{kind}-sequence.png')
    report.append({'id':kind,'source':src.relative_to(base).as_posix(),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'frames':len(files),'wallSeconds':[5.5+i*.5 for i in range(18)],'sheet':f'{kind}-sequence.png'})
(out/'sequence-manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('Extracted 72 frames from four archived initial WebMs; not final capture acceptance')
