"""HIP/Tycho non-commercial derivatives. Raw source remains under plans/assets.
RGB is an effective blackbody/CIE fit, not stellar spectra or absolute calibration.
"""
import os
os.environ['OPENCV_IO_ENABLE_OPENEXR']='1'
from pathlib import Path
from collections import Counter
import gzip,json,math,hashlib,time,argparse,shutil
import numpy as np
import cv2
from scipy.spatial import cKDTree

ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parent.parent;RAW=ROOT/'assets/catalog-source';OUT=PROJECT/'assets/night/catalog'
OUT.mkdir(parents=True,exist_ok=True);os.chdir(PROJECT);cv2.setNumThreads(1)
ARGS=argparse.ArgumentParser();ARGS.add_argument('--point-limit',type=float,default=8.5);args=ARGS.parse_args()
START=time.perf_counter();RAD=math.pi/180;MAS=RAD/3600000;N=2048;H=N//2;TILE=128
stats=Counter();points=[];hipMaster=set();fluxSum=np.zeros(3);faint=np.zeros((H,N,3),np.float64);starIDs=[]
fallbackHIP={};fallbackBuckets={};heldTYC={};reconciling=False;systemMappings=[]
MATCH_RADIUS=2*math.sin(10/3600*math.pi/180/2)
rows=np.arange(H);omega=(2*math.pi/N)*(np.sin(math.pi/2-rows*math.pi/H)-np.sin(math.pi/2-(rows+1)*math.pi/H))

def fl(s):
    try:return float(s)
    except ValueError:return None
def g(w,c,a,b):return np.exp(-.5*((w-c)*np.where(w<c,a,b))**2)
wl=np.arange(380,781,5,dtype=float)
xyz=np.array([.362*g(wl,442,.0624,.0374)+1.056*g(wl,599.8,.0264,.0323)-.065*g(wl,501.1,.0490,.0382),
              .821*g(wl,568.8,.0213,.0247)+.286*g(wl,530.9,.0613,.0322),
              1.217*g(wl,437,.0845,.0278)+.681*g(wl,459,.0385,.0725)])
rgbMatrix=np.array([[3.2406,-1.5372,-.4986],[-.9689,1.8758,.0415],[.0557,-.2040,1.0570]])
colors=[]
for bv in np.linspace(-.4,3,3401):
    temp=4600*(1/(.92*bv+1.7)+1/(.92*bv+.62));spectrum=1/(wl**5*np.expm1(1.438776877e7/(wl*temp)))
    rgb=np.maximum(rgbMatrix@(xyz@spectrum),0);rgb/=rgb@np.array([.2126,.7152,.0722]);colors.append(rgb)
colors=np.array(colors)

def add_star(source,sid,ra,dec,mag,bv,pmra,pmdec,epoch,linkedHIP=None):
    global fluxSum
    if ra is None or dec is None or mag is None:stats[source+'_missing_required']+=1;return
    if mag>11.5:stats[source+'_fainter_than_master']+=1;return
    if bv is None:stats['missing_color_white']+=1;rgb=np.ones(3)
    else:rgb=colors[round((min(3,max(-.4,bv))+.4)*1000)]
    a,d=ra*RAD,dec*RAD;c=math.cos(d);direction=np.array([c*math.cos(a),c*math.sin(a),math.sin(d)])
    east=np.array([-math.sin(a),math.cos(a),0]);north=np.array([-math.sin(d)*math.cos(a),-math.sin(d)*math.sin(a),math.cos(d)])
    pm=(east*(pmra or 0)+north*(pmdec or 0))*MAS
    direction+=pm*(2000-epoch);direction/=np.linalg.norm(direction)
    if source.startswith('TYC') and not reconciling:
        key=tuple(np.floor(direction/MATCH_RADIUS).astype(int))
        possible=[linkedHIP] if linkedHIP in fallbackHIP else fallbackBuckets.get(key,[])
        matches=[hip for hip in possible if hip==linkedHIP or np.linalg.norm(direction-fallbackHIP[hip]['direction'])<=MATCH_RADIUS]
        if len(matches)==1:
            heldTYC.setdefault(matches[0],[]).append(dict(source=source,sid=sid,ra=ra,dec=dec,mag=mag,bv=bv,pmra=pmra,pmdec=pmdec,epoch=epoch,direction=direction.tolist(),motion=pm.tolist(),linked=linkedHIP==matches[0]));return
        if len(matches)>1:stats['ambiguous_fallback_HIP_neighbourhood']+=1
    f=10**(-.4*mag);fluxSum+=rgb*f;stats['master']+=1;stats[source+'_admitted']+=1
    if mag<=args.point_limit:
        # xyz direction@J2000, max pm/year; xyz tangent/year, magnitude;
        # RGB/Y=1, deterministic phase seed. No brightness-dependent diameter.
        phase=(int(hashlib.sha256((source+str(sid)).encode()).hexdigest()[:8],16)/2**32)*2*math.pi
        points.append(np.r_[direction,np.linalg.norm(pm),pm,mag,rgb,phase]);starIDs.append([source,str(sid),mag])
    else:
        ra2=math.atan2(direction[1],direction[0]);de2=math.asin(direction[2]);x=((.5-ra2/(2*math.pi))%1)*N-.5;y=(.5-de2/math.pi)*H-.5
        ix,iy=math.floor(x),math.floor(y);fx,fy=x-ix,y-iy
        for j in range(2):
            yy=min(H-1,max(0,iy+j))
            for i in range(2):faint[yy,(ix+i)%N]+=rgb*f*(fx if i else 1-fx)*(fy if j else 1-fy)/omega[yy]
        stats['diffuse']+=1

for s in (RAW/'hip_main.dat').open():
    stats['hip_input']+=1;hip=int(s[8:14]);ra,de,v=fl(s[51:63]),fl(s[64:76]),fl(s[41:46]);bv=fl(s[245:251])
    fallback=False
    if ra is None or de is None:
        try:
            hh,mm,ss=map(float,s[17:28].split());ds=s[29:40].strip();dd,dm,dsec=map(float,ds[1:].split());ra=(hh+mm/60+ss/3600)*15;de=(dd+dm/60+dsec/3600)*(-1 if ds[0]=='-' else 1);stats['hip_identifier_position_fallback']+=1;fallback=True
        except ValueError:pass
    if v is None:stats['hip_no_JohnsonV']+=1;continue
    if ra is not None and de is not None and v<=11.5:hipMaster.add(hip)
    if s[272:273]=='*':stats['hip_combined_photometry']+=1
    if fallback and v<=11.5:
        a,d=ra*RAD,de*RAD;direction=np.array([math.cos(d)*math.cos(a),math.cos(d)*math.sin(a),math.sin(d)])
        fallbackHIP[hip]=dict(ra=ra,dec=de,mag=v,bv=bv,pmra=fl(s[87:95]),pmdec=fl(s[96:104]),CCDM=s[327:337].strip(),direction=direction)
        continue
    add_star('HIP',hip,ra,de,v,bv,fl(s[87:95]),fl(s[96:104]),1991.25)
for hip,record in fallbackHIP.items():
    key=np.floor(record['direction']/MATCH_RADIUS).astype(int)
    for x in [-1,0,1]:
        for y in [-1,0,1]:
            for z in [-1,0,1]:fallbackBuckets.setdefault(tuple(key+[x,y,z]),[]).append(hip)
print('HIP',stats['hip_input'],'point records',len(points),'master',stats['master'],flush=True)

supp=[];suppIDs=set()
with gzip.open(RAW/'suppl_1.dat.gz','rt') as stream:
    for s in stream:supp.append(s);suppIDs.add(s[:12])
seenSupp=set();previousID=None
def tycho(s,supplement=False):
    global previousID
    sid=s[:12];stats['suppl_input' if supplement else 'tycho_input']+=1
    if not supplement:
        if sid==previousID:stats['consecutive_duplicate_TYC']+=1;return
        previousID=sid
        if sid in suppIDs:seenSupp.add(sid)
    elif sid in seenSupp:stats['supp_duplicate_main']+=1;return
    hip=fl(s[115:121] if supplement else s[142:148])
    if hip is not None and int(hip) in hipMaster and int(hip) not in fallbackHIP:stats['tycho_HIP_system_already_represented']+=1;return
    if supplement:
        ra,de=fl(s[15:27]),fl(s[28:40]);bt,vt=fl(s[83:89]),fl(s[96:102]);pmra,pmde=fl(s[41:48]),fl(s[49:56]);epoch=1991.25
    else:
        ra,de=fl(s[15:27]),fl(s[28:40]);bt,vt=fl(s[110:116]),fl(s[123:129]);pmra,pmde=fl(s[41:48]),fl(s[49:56]);epoch=2000
        if ra is None or de is None:
            ra,de=fl(s[152:164]),fl(s[165:177]);epra,epde=fl(s[178:182]),fl(s[183:187]);epoch=1990+((epra or 1.5)+(epde or 1.5))/2;stats['tycho_observed_position_fallback']+=1
    if vt is None:
        if bt is None:stats['tycho_no_photometry']+=1;return
        vt=bt;stats['tycho_BT_only_V_fallback']+=1
    if bt is None:mag,bv=vt,None;stats['tycho_VT_only_color_fallback']+=1
    else:mag,bv=vt-.09*(bt-vt),.85*(bt-vt)
    add_star('TYC-S1' if supplement else 'TYC',sid,ra,de,mag,bv,pmra,pmde,epoch,int(hip) if hip is not None else None)
for i in range(20):
    with gzip.open(RAW/f'tyc2.dat.{i:02d}.gz','rt') as stream:
        for s in stream:tycho(s)
    print('TYC chunk',i,'master',stats['master'],'points',len(points),flush=True)
for s in supp:tycho(s,True)
reconciling=True
for hip,h in fallbackHIP.items():
    candidates=heldTYC.get(hip,[]);flux=sum(10**(-.4*c['mag']) for c in candidates)
    combined=-2.5*math.log10(flux) if flux>0 else None
    distances=[float(np.linalg.norm(np.array(c['direction'])-h['direction']))*180/math.pi*3600 for c in candidates]
    direct=any(c['linked'] for c in candidates)
    compatible=combined is not None and ((bool(h['CCDM']) and abs(combined-h['mag'])<=.5) or any(sep<1.5 and abs(c['mag']-h['mag'])<.25 for sep,c in zip(distances,candidates)))
    accept=direct or compatible
    mapping={'HIP':hip,'keptHIPMagnitude':h['mag'],'CCDM':h['CCDM'],'HMSPosition':[h['ra'],h['dec']],'candidateTYC':[{k:v for k,v in c.items() if k not in ['direction','motion']} for c in candidates],
             'candidateCombinedMagnitude':combined,'candidateSeparationsArcsec':distances,'decision':'HIP system photometry; TYC group astrometry; retire TYC aliases' if accept else 'No sufficiently supported alias; preserve separate sources',
             'confirmedByDirectHIPLink':direct,'confirmedBySystemPhotometryAndPosition':compatible,'retiredIdentifiers':[[c['source'],c['sid']] for c in candidates] if accept else []}
    if accept:
        weights=np.array([10**(-.4*c['mag']) for c in candidates]);weights/=weights.sum()
        direction=np.sum(np.array([c['direction'] for c in candidates])*weights[:,None],axis=0);direction/=np.linalg.norm(direction)
        motion=np.sum(np.array([c['motion'] for c in candidates])*weights[:,None],axis=0)
        a=math.atan2(direction[1],direction[0]);d=math.asin(direction[2]);east=np.array([-math.sin(a),math.cos(a),0]);north=np.array([-math.sin(d)*math.cos(a),-math.sin(d)*math.sin(a),math.cos(d)])
        add_star('HIP',hip,a/RAD,d/RAD,h['mag'],h['bv'],float(motion@east/MAS),float(motion@north/MAS),2000)
        stats['fallback_systems_reconciled']+=1;stats['TYC_aliases_retired_for_HIP_system']+=len(candidates)
        mapping['finalPositionJ2000']=[a/RAD,d/RAD];mapping['expectedFinalFluxUnitF0']=10**(-.4*h['mag'])
    else:
        add_star('HIP',hip,h['ra'],h['dec'],h['mag'],h['bv'],h['pmra'],h['pmdec'],1991.25)
        for c in candidates:add_star(c['source'],c['sid'],c['ra'],c['dec'],c['mag'],c['bv'],c['pmra'],c['pmdec'],c['epoch'])
    systemMappings.append(mapping)
(OUT/'system-reconciliation.json').write_text(json.dumps({'policy':'Only missing-precise-astrometry HIP identifier-position rows require this secondary match. Preserve HIP system V flux, use TYC group centroid/PM, retire component aliases without coordinate-only deletion. Explicit cross-id OR CCDM and0.5mag system agreement OR1.5arcsec+0.25mag single match.','records':systemMappings},indent=2),encoding='utf-8')
assert stats['hip_input']==118218 and stats['tycho_input']==2539913 and stats['suppl_input']==17588
P=np.asarray(points,dtype='<f4');points=None
P.tofile(OUT/'stars-float32.bin')
(OUT/'point-identifiers.json').write_text(json.dumps(starIDs,separators=(',',':')),encoding='utf-8')

# Direction-cube cells have no ERP polar singularity. Query a conservative
# centre sphere: tile circumradius + declared kernel support + +/-200yr PM.
u=(np.arange(TILE)+.5)*2/TILE-1;xx,yy=np.meshgrid(u,u);one=np.ones_like(xx)
faces=[np.stack([one,yy,-xx],-1),np.stack([-one,yy,xx],-1),np.stack([xx,one,-yy],-1),np.stack([xx,-one,yy],-1),np.stack([xx,yy,one],-1),np.stack([-xx,yy,-one],-1)]
centres=np.concatenate([v.reshape(-1,3) for v in faces]);centres/=np.linalg.norm(centres,axis=1)[:,None];tree=cKDTree(centres)
tables=[]
for name,supportDegrees in [('native',.18),('wide',2.0)]:
    angular=np.sqrt(2)/TILE+supportDegrees*RAD+P[:,3]*200
    neighbours=tree.query_ball_point(P[:,:3],2*np.sin(angular/2),workers=1)
    buckets=[[] for _ in range(len(centres))]
    for index,bins in enumerate(neighbours):
        for b in bins:buckets[b].append(index)
    length=len(buckets)+sum(map(len,buckets));width=1024;height=math.ceil(length/width)
    data=np.zeros((height*width,4),dtype='<f4');offset=len(buckets);maxFlux=0
    for i,bucket in enumerate(buckets):
        data[i,:2]=offset,len(bucket)
        if bucket:
            data[offset:offset+len(bucket),0]=bucket
            f=np.power(10.,-.4*P[bucket,7,None])*P[bucket,8:11];maxFlux=max(maxFlux,float(np.max(f.sum(axis=0))))
        offset+=len(bucket)
    data.tofile(OUT/f'lookup-{name}-float32.bin')
    tables.append(dict(name=name,supportDegrees=supportDegrees,width=width,height=height,bytes=data.nbytes,entryCount=offset-len(buckets),meanCandidates=float(np.mean(list(map(len,buckets)))),maximumCandidates=max(map(len,buckets)),maximumBucketFluxChannelUnitF0=maxFlux))
    print('table',tables[-1],flush=True);del data,buckets,neighbours

# Mips are exact solid-angle averages. All levels store physical(default F0)
# radiance divided by the shared 2e-7 background scale, keeping FP16 finite.
F0=2.54e-6*(3.6/100000);scale=F0/2e-7;faintIntegral=(faint*omega[:,None,None]).sum(axis=(0,1));levels=[];blob=[];offset=0
while True:
    h,w=faint.shape[:2];rgba=np.ones((h,w,4),np.float32);rgba[:,:,:3]=faint*scale
    if not np.isfinite(rgba).all() or rgba[:,:,:3].max()>65504:raise RuntimeError('FP16 diffuse exceeds finite envelope')
    raw=rgba.astype('<f2').tobytes();blob.append(raw);levels.append(dict(width=w,height=h,offsetBytes=offset,bytes=len(raw)));offset+=len(raw)
    if h==1 and w==1:break
    nh,nw=max(1,h//2),max(1,w//2);next_image=np.zeros((nh,nw,3),np.float64)
    y=np.arange(h);weights=(np.sin(math.pi/2-y*math.pi/h)-np.sin(math.pi/2-(y+1)*math.pi/h))
    for j in range(nh):
        rows0=np.arange(j*2,min(h,j*2+2));block=faint[rows0];wy=weights[rows0];row=(block*wy[:,None,None]).sum(axis=0)/wy.sum()
        next_image[j]=row.reshape(nw,2,3).mean(axis=1) if w>1 else row
    faint=next_image
(OUT/'diffuse-rgba16f.bin').write_bytes(b''.join(blob))

milk=cv2.imread(str((RAW/'milkyway_2020_4k.exr').relative_to(PROJECT)),-1)
if milk is None:raise RuntimeError('EXR decode unavailable')
assert cv2.imwrite(str((OUT/'milkyway-4k.hdr').relative_to(PROJECT)),milk)
mh,mw=milk.shape[:2];y=np.arange(mh);om=2*math.pi/mw*(np.sin(math.pi/2-y*math.pi/mh)-np.sin(math.pi/2-(y+1)*math.pi/mh));milkIntegral=(milk.sum(axis=1,dtype=np.float64)*om[:,None]).sum(axis=0)[::-1]
files={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.iterdir() if p.is_file() and p.name!='manifest.json'}
manifest=dict(version=1,generatedUTC=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),license='Catalogue data/derivatives CC BY-NC3.0IGO, Credit ESA; ESA1997 SP1200, Hogetal2000 A&A355L27, CDS/VizieR DOI10.26093/cds/vizier; NASA background separate SVS4851 source terms',
    scope='derived runtime resources; raw full sources retained only under verification/plans/assets/catalog-source',sourceManifest='../../../verification/plans/assets/catalog-source/manifest.json',counts=dict(stats),pointLimitMagnitude=args.point_limit,pointCount=len(P),pointRecordFloats=12,pointTextureWidth=1024,pointTextureHeight=math.ceil(len(P)*3/1024),tileResolution=TILE,tables=tables,diffuseLevels=levels,diffuseRGBIntegralUnitF0=faintIntegral.tolist(),masterRGBFluxUnitF0=fluxSum.tolist(),pointRGBFluxUnitF0=(np.power(10.,-.4*P[:,7,None])*P[:,8:11]).sum(axis=0,dtype=np.float64).tolist(),maximumPointFluxChannelUnitF0=float(np.max(np.power(10.,-.4*P[:,7,None])*P[:,8:11])),
    photometry=dict(magnitudeZeroLux=2.54e-6,defaultRawPerLux=3.6/100000,defaultF0Physical=F0,source='https://www2.keck.hawaii.edu/realpublic/inst/kitn/KITN0005.pdf',NASAbackgroundScale=2e-7,NASAbackgroundRGBIntegral=milkIntegral.tolist(),color='Ballesteros B-V blackbody plus Wyman2013 analytic CIE fit, linear sRGB normalizedY1; effective color, not measured SPD'),
    epochs=dict(HIP=1991.25,TYC=2000,pointStorage=2000,properMotionYearsSupported=[1800,2200],diffuse='fixed J2000 aggregate; no per-star epoch motion'),files=files,elapsedSeconds=time.perf_counter()-START,
    limits=['NASA background and full atlas have independent visualization gains, not an additive layer calibration','HIP combined systems take precedence over all linked Tycho components; no coordinate-only merging','Magnitude/colour boundary differs from exact unpublished NASA generator; no claim of perfect1.7B-source reconstruction','Missing photometry/positions and effective Tycho->Johnson conversions are counted','Bright-star supplement18Yale audit still required; no false complete-as-NASA claim'])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(OUT/'LICENSE-SOURCES.txt').write_text(manifest['license']+'\n'+manifest['scope']+'\nOriginal sources and hashes: '+manifest['sourceManifest']+'\nUser authorized personal non-commercial use only. Original runtime code is not relicensed by this data notice.\n',encoding='utf-8')
print(json.dumps({'pointCount':len(P),'counts':dict(stats),'elapsedSeconds':manifest['elapsedSeconds']},indent=2),flush=True)
