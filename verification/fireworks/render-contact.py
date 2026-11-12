"""Offline same-colour mechanics contact sheet; NOT a browser renderer capture."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
base=Path(__file__).parent
rows=json.loads((base/'same-colour-contact.json').read_text(encoding='utf-8'))
im=Image.new('RGB',(1600,720),(7,12,20));d=ImageDraw.Draw(im)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20)
small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',13)
for k,row in enumerate(rows):
    ox=(k%5)*320;oy=(k//5)*360
    d.rectangle((ox+8,oy+8,ox+312,oy+352),outline=(36,49,61))
    d.text((ox+20,oy+15),row['label']+'  '+row['type'],font=font,fill=(218,228,232))
    d.text((ox+20,oy+42),f"解析位置，同色；爆后{row['time']-row['burstTime']:.2f}s",font=small,fill=(119,145,160))
    bx,by,bz=row['burstPosition']
    def project(p):return (ox+160+(p[0]-bx)*3.05,oy+175-(p[1]-by)*3.05)
    for age,points in enumerate(row['trails']):
        level=int(130*(1-age/len(row['trails']))**1.2)
        for p in points:
            x,y=project(p)
            if ox+12<x<ox+308 and oy+65<y<oy+335:d.ellipse((x-.7,y-.7,x+.7,y+.7),fill=(level,level,level))
    for p in row['particles']:
        x,y=project(p['position']);level=int(80+175*p['emission'])
        if ox+12<x<ox+308 and oy+65<y<oy+335:d.ellipse((x-1.2,y-1.2,x+1.2,y+1.2),fill=(level,level,level))
im.save(base/'same-colour-contact.png')
