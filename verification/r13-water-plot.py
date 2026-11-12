from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p=Path(__file__).resolve().parent
r=json.loads((p/'r13-water-shore-prototype.json').read_text(encoding='utf8'))
run=next(q for q in r['runs'] if q['n']==280)
s=run['series']
fig,axes=plt.subplots(3,1,figsize=(14,10),dpi=160,sharex=True,layout='constrained')
t=[v['time'] for v in s]
axes[0].plot(t,[v['incidentEta'] for v in s],color='#286ca8',label='shared native swell at offshore forcing point')
axes[0].plot(t,[v['runupHeight'] for v in s],color='#059a83',label='moving wet/dry front, world height above rest')
axes[0].set_ylabel('Elevation (m)');axes[0].legend(loc='upper left',fontsize=9)
axes[1].plot(t,[v['probeVelocityMps'] for v in s],color='#bf6d25',label='same solved flow at x=-0.35m: positive = onshore')
axes[1].axhline(0,color='.4',lw=.7);axes[1].set_ylabel('Flow (m/s)');axes[1].legend(loc='upper left',fontsize=9)
axes[2].plot(t,[v['landProbeMoisture'] for v in s],color='#8059ad',label='same wet-contact history at x=+0.25m')
axes[2].plot(t,[v['maximumFoamCoverage'] for v in s],color='#858b94',label='advected compression/Froude foam diagnostic')
axes[2].set_ylabel('Authored fraction');axes[2].set_xlabel('Shared physical time (s)');axes[2].legend(loc='upper left',fontsize=9)
for ax in axes:ax.grid(alpha=.2);ax.set_xlim(0,60)
fig.suptitle('Verification-only shoreline mechanism: incoming waves, runup, return flow and wet memory\n1D tangent-plane SWE counterfactual; no GPU / real-island / photographic acceptance',fontsize=13)
fig.savefig(p/'r13-water-shore-prototype.png')
plt.close(fig)
