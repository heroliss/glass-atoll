from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
base = Path(__file__).resolve().parent
src = base
types = ['saturn','heart','flower','chase','vfan','helix','vortex','waterfall','double','brocade']
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 21)
w, h, bar = 480, 360, 32
sheet = Image.new('RGB', (w*3, (h+bar)*len(types)), '#111820')
draw = ImageDraw.Draw(sheet)
for row, kind in enumerate(types):
    for col in range(3):
        name = f'display-{kind}-phase-{col+1}.png'
        image = Image.open(src / name)
        image.load()
        image.thumbnail((w,h), Image.Resampling.LANCZOS)
        x,y=col*w,row*(h+bar)
        sheet.paste(image,(x,y+bar))
        draw.text((x+8,y+5), f'{kind} | phase {col+1}', font=font, fill='#f3f7f7')
sheet.save(base / 'stage-contact-sheet.png')
print(f'{len(types)*3} decoded PNGs; saved {sheet.size}')
