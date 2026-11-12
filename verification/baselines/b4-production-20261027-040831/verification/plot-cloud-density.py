import base64,json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import PowerNorm

base=Path(__file__).resolve().parent
report=json.loads((base/'cloud-density-slices.json').read_text(encoding='utf-8'))
fig,axes=plt.subplots(2,4,figsize=(16,7),layout='constrained')
for row,p in enumerate(report['profiles']):
    for col,s in enumerate(p['slices']):
        values=np.frombuffer(base64.b64decode(s['float32Base64']),dtype='<f4').reshape(p['height'],p['width'])
        ax=axes[row,col];horizontal=isinstance(s['axis'],str)
        extent=[-1500,1500,-1500,1500] if horizontal else [-1500,1500,*s['yRange']]
        artist=ax.imshow(values,origin='upper',extent=extent,aspect='auto',cmap='gray',norm=PowerNorm(.5,vmin=0,vmax=p['maximum']))
        ax.contour(values,levels=[.0008,.08,.2],origin='upper',extent=extent,colors=['#29b5dd','#f7b267','#ed6a5a'],linewidths=.45)
        if not horizontal:
            ax.axhline(p['base'],ls='--',color='#6cadde',lw=.6);ax.axhline(p['top'],ls='--',color='#6cadde',lw=.6)
        ax.set(title=f"{p['name']} / {['X-altitude','Z-altitude','diagonal-altitude','X-Z @ h=.30'][col]}",xlabel='offset (m)',ylabel='offset (m)' if horizontal else 'spherical altitude (m)')
    fig.colorbar(artist,ax=list(axes[row]),label='density (sqrt display; per-profile scale)',shrink=.8)
fig.suptitle('Production C2 cloud density at fixed time — unchanged formula\nContours .0008 / .08 / .20; common LCL/top shown; CPU base LOD, not a photograph',fontsize=12)
fig.savefig(base/'cloud-density-slices-contact.png',dpi=150)
print('Saved cloud-density-slices-contact.png')
