"""Independent high-precision finite Gaussian columns for a small CPU-only audit."""
from pathlib import Path
import json
import math
import mpmath as mp
mp.mp.dps=90
V=Path(__file__).resolve().parent
bad=json.loads((V/'r24-sparse-independent-conditioning-witness-input.json').read_text())

def column(C,o,e,mass,k):
    covariance=mp.matrix([[mp.mpf(C[r*3+c]) for c in range(3)] for r in range(3)])
    A=covariance**-1
    delta=mp.matrix([mp.mpf(e[i])-mp.mpf(o[i]) for i in range(3)])
    L=mp.sqrt((delta.T*delta)[0])
    if not L:return ['0','0','0']
    d=delta/L;r=mp.matrix([mp.mpf(x) for x in o])
    a=(d.T*A*d)[0];b=(d.T*A*r)[0]
    rho=(r.T*A*r)[0]-b*b/a
    scale=mp.mpf(mass)/((2*mp.pi)**mp.mpf('1.5')*mp.sqrt(mp.det(covariance)))
    z=mp.sqrt(a/2)
    value=scale*mp.exp(-rho/2)*mp.sqrt(mp.pi/(2*a))*(mp.erf(z*(L+b/a))-mp.erf(z*b/a))
    assert value>=0
    return [str(value*mp.mpf(x)) for x in k]

I=[1,0,0,0,1,0,0,0,1]
c,s=math.cos(.7),math.sin(.7)
rot=[.0001*c*c+4*s*s,0,(4-.0001)*c*s,0,.3,0,(4-.0001)*c*s,0,.0001*s*s+4*c*c]
cases=[
 dict(name='unit-short-centered',C=I,o=[-4e-9,0,0],e=[4e-9,0,0],mass=100,k=[1000,1000,1000],budget=[1,1,1]),
 dict(name='unit-short-reversed',C=I,o=[4e-9,0,0],e=[-4e-9,0,0],mass=100,k=[1000,1000,1000],budget=[1,1,1]),
 dict(name='five-sigma-tangent',C=I,o=[5,0,-20],e=[5,0,20],mass=2*math.pi,k=[1,1,1],budget=[1e-5]*3),
 dict(name='rotated-anisotropic',C=rot,o=[-.000001,0,0],e=[.000001,0,0],mass=.01,k=[.8,.7,.6],budget=[1e-5]*3),
 dict(name='positive-omission-tail',C=I,o=[4.5,0,-20],e=[4.5,0,20],mass=4e-5,k=[.8,.7,.6],budget=[1e-5]*3),
 dict(name='zero-length',C=I,o=[0,0,0],e=[0,0,0],mass=1,k=[1,0,1],budget=[0,0,0]),
 dict(name='known-conditioning-counterexample',C=bad['covariance'],o=bad['origin'],e=bad['end'],mass=bad['mass'],k=bad['extinction'],budget=[.5000000001000002]*3,mustReject=True)
]
for row in cases:row['tauRGB90digits']=column(row['C'],row['o'],row['e'],row['mass'],row['k'])
out=dict(schema='glass-atoll.r24-sparse-independent-high-precision-cases.v1',mpmathVersion=mp.__version__,digits=90,
    interpretation='Analytic finite-ray Gaussian integral using exact binary64 inputs promoted to mpmath; numeric high-precision reference, not an IEEE interval certificate',cases=cases)
(V/'r24-sparse-independent-numeric-cases.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(cases),'knownCounterexampleTau':cases[-1]['tauRGB90digits'][0]},indent=2))
