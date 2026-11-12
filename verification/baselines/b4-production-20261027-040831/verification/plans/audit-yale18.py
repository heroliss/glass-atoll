"""Audit NASA's named Yale additions against the selected HIP/Tycho master.
No Yale rows are copied to runtime; existing unresolved components keep flux.
"""
from pathlib import Path
import json,math,hashlib
import numpy as np
from scipy.spatial import cKDTree
ROOT=Path(__file__).resolve().parent;DATA=ROOT.parent.parent/'assets/night/catalog'
points=np.fromfile(DATA/'stars-float32.bin',dtype='<f4').reshape(-1,12)
ids=json.loads((DATA/'point-identifiers.json').read_text());tree=cKDTree(points[:,:3]);records=[]
query=ROOT/'assets/catalog-source/yale-nasa-missing-query.tsv'
for line in query.read_text().splitlines():
    p=line.split('\t')
    if len(p)!=8 or not p[0].strip().isdigit():continue
    h,m,s=map(float,p[2].split());ds=p[3].strip();d,dm,sec=map(float,ds[1:].split());ra=(h+m/60+s/3600)*math.pi/12;de=(d+dm/60+sec/3600)*math.pi/180*(-1 if ds[0]=='-' else 1)
    direction=np.array([math.cos(de)*math.cos(ra),math.cos(de)*math.sin(ra),math.sin(de)])
    distance,k=tree.query(direction);group=tree.query_ball_point(direction,2*math.sin(10/3600*math.pi/180/2))
    records.append({'HR':int(p[0]),'YaleMagnitude':float(p[4]),'nearestPoint':ids[int(k)],'separationArcsec':float(2*math.asin(distance/2)*180/math.pi*3600),
                    'groupWithin10Arcsec':[ids[j] for j in group],
                    'groupMagnitude':float(-2.5*math.log10(sum(float(10**(-.4*points[j,7])) for j in group))) if group else None})
report={'scope':'audit-only; no Yale data installed in runtime','source':'CDS V/50 small query, original NASA SVS4851 eighteen-entry list',
        'querySHA256':hashlib.sha256(query.read_bytes()).hexdigest(),'all18PositionallyRepresentedWithin5Arcsec':len(records)==18 and all(r['separationArcsec']<5 for r in records),
        'records':records,'limits':['Close binaries can map to one unresolved catalogue system or several components; compare grouped flux rather than two nearest-star entries','Fixed catalogue photometry is not a current variable-star lightcurve. Eta Car differs from the NASA2020 brightness estimate','Position match does not establish exact equality to the unpublished NASA source crossmatch/gain']}
(ROOT/'atlas-experiment/yale18-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('All eighteen positionally represented:',report['all18PositionallyRepresentedWithin5Arcsec'])
for r in records:print(r['HR'],r['separationArcsec'],r['groupMagnitude'],r['YaleMagnitude'])
