"""Scientific source geometry plot, not a render or look acceptance image."""
from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

base=Path(__file__).resolve().parent
r=json.loads((base/'r12-willow-shape-audit.json').read_text(encoding='utf8'))
fig,axes=plt.subplots(2,2,figsize=(16,10),dpi=160,layout='constrained')
for col,phase in enumerate([1.1,5]):
    for row,variant in enumerate(['native-upward-bias','in-memory-full-sphere']):
        case=next(c for c in r['cases'] if c['variant']==variant and c['seed']==71 and c['elevation']==80)
        shape=next(s for s in case['shape'] if s['phase']==phase)
        burst_y=case['burstWorldY']
        # Burst X is recovered from the mean early source only for centring the
        # fixed-view comparison; the same reference centre is used in both rows.
        ref=next(c for c in r['cases'] if c['variant']=='native-upward-bias' and c['seed']==71 and c['elevation']==80)
        centre_x=ref['shape'][0]['intensityWeightedCentreWorld'][0]
        ax=axes[row,col]
        x=[p['position'][0]-centre_x for p in shape['points']]
        y=[p['position'][1]-burst_y for p in shape['points']]
        strength=[p['I'] for p in shape['points']]
        ax.scatter(x,y,s=15,c=strength,cmap='plasma',vmin=0,vmax=5.2,linewidths=0)
        ax.axhline(0,color='.4',lw=.7,ls=':')
        ax.set_title(f'{"A: native upper-sector" if row==0 else "B: full-sphere counterfactual"} | t={phase:g}s\nY / mean(X,Z) span = {shape["verticalToMeanHorizontalSpan"]:.3f}')
        ax.set_xlim(-50,55);ax.set_ylim((-48,30) if phase==1.1 else (-90,5));ax.set_aspect('equal',adjustable='box')
        ax.set_xlabel('World X relative to common reference (m)');ax.set_ylabel('World Y relative to burst (m)')
        ax.grid(alpha=.2)
fig.suptitle('Willow source geometry only | seed71, 80deg, same160 heads / speed / drag / lifetime / candela\nOrthographic head centres; no tails, smoke, lens, HDR, exposure or GPU rendering',fontsize=14)
fig.savefig(base/'r12-willow-shape-source-geometry.png')
plt.close(fig)
