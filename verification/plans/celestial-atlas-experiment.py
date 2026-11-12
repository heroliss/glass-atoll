"""Research-only NASA atlas resolution experiment. No runtime assets are changed.

Run with the project's local 4K EXR and the unmodified official 8K EXR in
plans/assets. Angular widths describe the baked source + bilinear reconstruction,
not telescope optics. Flux is a relative solid-angle integral, not absolute lux.
"""
import os
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
from pathlib import Path
import hashlib, json, math, time
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

cv2.setNumThreads(1)
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
OUT=ROOT/'atlas-experiment'; OUT.mkdir(exist_ok=True)
START=time.perf_counter()
os.chdir(PROJECT)  # OpenCV's Windows filename API cannot open this Unicode prefix.

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(8*1024*1024),b''): h.update(chunk)
    return h.hexdigest()

def read_catalogue():
    rows=[]
    for line in (ROOT/'assets/hipparcos-bright-coordinates.tsv').read_text().splitlines():
        parts=line.split('\t')
        if len(parts)!=5 or not parts[0].strip().isdigit(): continue
        hip=int(parts[0]); h,m,s=map(float,parts[1].split())
        ds=parts[2].strip(); d,dm,dsec=map(float,ds[1:].split())
        rows.append(dict(hip=hip,ra=(h+m/60+s/3600)*15,
                         dec=(d+dm/60+dsec/3600)*(-1 if ds[0]=='-' else 1),
                         vmag=float(parts[3]),bv=float(parts[4])))
    return sorted(rows,key=lambda r:r['vmag'])

NAMES={32349:'Sirius',30438:'Canopus',69673:'Arcturus',91262:'Vega',24608:'Capella',
       24436:'Rigel',37279:'Procyon',27989:'Betelgeuse',7588:'Achernar',68702:'Hadar',
       97649:'Altair',21421:'Aldebaran',65474:'Spica',80763:'Antares',37826:'Pollux',
       113368:'Fomalhaut',102098:'Deneb',49669:'Regulus'}

def eq_vector(ra,dec):
    a,d=map(math.radians,(ra,dec)); return np.array([math.cos(d)*math.cos(a),math.cos(d)*math.sin(a),math.sin(d)])

def angular_distance(a,b):
    return math.degrees(math.acos(float(np.clip(np.dot(eq_vector(a['ra'],a['dec']),eq_vector(b['ra'],b['dec'])),-1,1))))

def luma(im):
    return im[:,:,0]*np.float32(.0722)+im[:,:,1]*np.float32(.7152)+im[:,:,2]*np.float32(.2126)

def sample(im,x,y):
    # OpenCV's bilinear interpolation has a 1/32-source-pixel phase table.
    return cv2.remap(im,np.asarray(x,dtype=np.float32),np.asarray(y,dtype=np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_WRAP)

def xy_from_eq(ra,dec,w,h):
    return ((.5-np.asarray(ra)/360)%1)*w-.5,(.5-np.asarray(dec)/180)*h-.5

def half_width(coords,profile):
    peak=int(np.argmax(profile)); half=float(profile[peak])*.5
    if not half>0:return None
    left=np.flatnonzero(profile[:peak]<half); right=np.flatnonzero(profile[peak+1:]<half)
    if len(left)==0 or len(right)==0:return None
    i=int(left[-1]);j=int(right[0]+peak+1)
    a=float(np.interp(half,profile[i:i+2],coords[i:i+2]))
    b=float(np.interp(half,profile[j-1:j+1][::-1],coords[j-1:j+1][::-1]))
    return b-a

def measure(im,star):
    h,w=im.shape[:2]; px,py=xy_from_eq(star['ra'],star['dec'],w,h)
    cosd=math.cos(math.radians(star['dec']))
    # This half-degree tangent approximation changes area by <0.01% here.
    radius_deg=.55; rx=math.ceil(radius_deg/(360/w*cosd))+3;ry=math.ceil(radius_deg/(180/h))+3
    ix=int(round(px));iy=int(round(py)); patch=im[iy-ry:iy+ry+1,ix-rx:ix+rx+1]
    lp=luma(patch); xp=np.arange(ix-rx,ix+rx+1);yp=np.arange(iy-ry,iy+ry+1)
    tx=(xp-px)*(360/w)*cosd;ty=(yp-py)*(180/h)
    radius=np.hypot(tx[None,:],ty[:,None]); centre=radius<.22
    masked=np.where(centre,lp,-1); my,mx=np.unravel_index(np.argmax(masked),lp.shape)
    cx=float(xp[mx]);cy=float(yp[my]); centre_ra=((.5-(cx+.5)/w)*360)%360;centre_dec=(.5-(cy+.5)/h)*180
    # Subpixel centre-of-mass, restricted to the isolated bright core.
    local_r=np.hypot((xp[None,:]-cx)*360/w*cosd,(yp[:,None]-cy)*180/h)
    bg=float(np.median(lp[(local_r>.35)&(local_r<.50)]))
    weights=np.maximum(lp-bg,0)*(local_r<.19)
    if weights.sum()>0:
        cx=float((weights*xp[None,:]).sum()/weights.sum());cy=float((weights*yp[:,None]).sum()/weights.sum())
    centre_ra=((.5-(cx+.5)/w)*360)%360;centre_dec=(.5-(cy+.5)/h)*180
    cd=math.cos(math.radians(centre_dec))
    # Dense angular cut, common sampling step for 4K and 8K. Finite bilinear phase
    # quantisation is much smaller than a source pixel and is included in limits.
    theta=np.linspace(-.36,.36,2305,dtype=np.float32)
    hx=sample(im,(cx+theta/(360/w*cd))[None,:],np.full((1,len(theta)),cy,dtype=np.float32))[0]
    hy=sample(im,np.full((1,len(theta)),cx,dtype=np.float32),(cy+theta/(180/h))[None,:])[0]
    hp=hx@np.array([.0722,.7152,.2126])-bg;vp=hy@np.array([.0722,.7152,.2126])-bg
    fwx=half_width(theta,hp);fwy=half_width(theta,vp)
    # Source texel box integral, with exact spherical area per ERP texel row.
    dec_top=np.radians(90-yp*180/h);dec_bottom=np.radians(90-(yp+1)*180/h)
    solid_angle=(2*math.pi/w)*(np.sin(dec_top)-np.sin(dec_bottom))
    rr=np.hypot((xp[None,:]-cx)*360/w*cd,(yp[:,None]-cy)*180/h)
    aperture=rr<.30
    flux=float(((lp-bg)*aperture*solid_angle[:,None]).sum(dtype=np.float64))
    aperture_fluxes={str(r):float(((lp-bg)*(rr<r)*solid_angle[:,None]).sum(dtype=np.float64)) for r in [.2,.3,.4]}
    rgb=(patch[:,:,[2,1,0]]*aperture[:,:,None]*solid_angle[:,None,None]).sum(axis=(0,1),dtype=np.float64)
    # Same 0.7-degree crop, reconstructed to a common angular grid for direct view.
    axis=np.linspace(-.35,.35,192,dtype=np.float32)
    xx,yy=np.meshgrid(cx+axis/(360/w*cd),cy+axis/(180/h))
    crop=sample(im,xx,yy)
    return dict(centreRA=centre_ra,centreDec=centre_dec,peakLuma=float(lp.max()),background=bg,
                fwhmXArcmin=fwx*60 if fwx is not None else None,
                fwhmYArcmin=fwy*60 if fwy is not None else None,
                sourcePeakPixelRGB=patch[my,mx,::-1].astype(float).tolist(),
                apertureRadiusDegrees=.30,apertureLumaSteradian=flux,
                apertureSensitivityLumaSteradian=aperture_fluxes,
                apertureRGBSteradian=rgb.tolist()),crop

def display(im,scale=.4194304):
    # Deliberately common, simple display: current star source scale * 2^21,
    # Reinhard + exact sRGB. No per-image exposure/normalisation/sharpening.
    rgb=np.maximum(im[:,:,[2,1,0]]*scale,0);rgb=rgb/(1+rgb)
    rgb=np.where(rgb<=.0031308,12.92*rgb,1.055*np.power(rgb,1/2.4)-.055)
    return Image.fromarray(np.uint8(np.clip(rgb,0,1)*255+.5))

def perspective(im,ra,dec,focal,width=1024,height=640):
    a,d=map(math.radians,(ra,dec));forward=eq_vector(ra,dec)
    right=np.array([math.sin(a),-math.cos(a),0]);up=np.array([-math.sin(d)*math.cos(a),-math.sin(d)*math.sin(a),math.cos(d)])
    xs=(np.arange(width,dtype=np.float32)+.5-width/2)*(36/width/focal)
    ys=-(np.arange(height,dtype=np.float32)+.5-height/2)*(36/width/focal)
    ray=forward[None,None,:]+xs[None,:,None]*right+ys[:,None,None]*up
    ray/=np.linalg.norm(ray,axis=2)[:,:,None]
    ra_map=np.degrees(np.arctan2(ray[:,:,1],ray[:,:,0]))%360;dec_map=np.degrees(np.arcsin(ray[:,:,2]))
    x,y=xy_from_eq(ra_map,dec_map,im.shape[1],im.shape[0]);result=sample(im,x,y)
    return result, dict(ra=ra,dec=dec,focalMM=focal,sensorWidthMM=36,sensorHeightMM=22.5,
                       width=width,height=height,horizontalFOVDegrees=math.degrees(2*math.atan(18/focal)))

def image_row(images,labels):
    width=sum(i.width for i in images);height=max(i.height for i in images)+30
    out=Image.new('RGB',(width,height),'#10151d');draw=ImageDraw.Draw(out);x=0
    for image,label in zip(images,labels):out.paste(image,(x,30));draw.text((x+8,8),label,fill='white');x+=image.width
    return out

catalogue=read_catalogue(); stars=[]
for star in catalogue:
    if abs(star['dec'])>65:continue
    if min(angular_distance(star,other) for other in catalogue if other['hip']!=star['hip'])<.7:continue
    stars.append(star)
    if len(stars)==12:break
print('Selected bright isolated HIP stars:',[s['hip'] for s in stars],flush=True)
paths={'4k':PROJECT/'assets/night/starmap_2020_4k.exr','8k':ROOT/'assets/starmap_2020_8k.exr'}
records=[]; crops={}; views={}; sources={}
for label,path in paths.items():
    im=cv2.imread(str(path.relative_to(PROJECT)),cv2.IMREAD_UNCHANGED)
    if im is None or im.dtype!=np.float32:raise RuntimeError('Unable to decode linear EXR '+str(path))
    h,w=im.shape[:2];clipped=0;nonfinite=0;integral=np.zeros(3)
    for y in range(h):
        row=im[y];nonfinite+=int(np.count_nonzero(~np.isfinite(row)));clipped+=int(np.count_nonzero(row>=1))
        omega=(2*math.pi/w)*(math.sin(math.radians(90-y*180/h))-math.sin(math.radians(90-(y+1)*180/h)))
        integral+=row.sum(axis=0,dtype=np.float64)[::-1]*omega
    sources[label]=dict(path=str(path.relative_to(PROJECT)),bytes=path.stat().st_size,sha256=digest(path),
                        width=w,height=h,decodedDtype=str(im.dtype),min=float(im.min()),max=float(im.max()),
                        nonFiniteChannels=nonfinite,channelsAtOrAboveOne=clipped,fullSkyRGBIntegralSteradians=integral.tolist(),
                        texelEquatorialArcmin=360/w*60)
    crops[label]=[]
    for star in stars:
        result,crop=measure(im,star);records.append(dict(source=label,**star,name=NAMES.get(star['hip'],'HIP '+str(star['hip'])),**result));crops[label].append(display(crop))
    # Orion + Sirius is used at 24 mm; both views share RA/Dec and no exposure change.
    # At 70 mm a separate centred-on-Sirius view avoids a deliberately empty crop.
    for focal,ra,dec in [(24,92,-8),(70,101.287,-16.716)]:
        raw,meta=perspective(im,ra,dec,focal);view=display(raw);view.save(OUT/f'{label}-{focal}mm.png')
        views[(label,focal)]=(view,meta)
    print('Analysed',label,w,h,flush=True)
    del im

comparisons=[]
for star in stars:
    pair={r['source']:r for r in records if r['hip']==star['hip']};a,b=pair['4k'],pair['8k']
    comparisons.append(dict(hip=star['hip'],name=a['name'],vmag=star['vmag'],
                            fwhmXRatio8to4=b['fwhmXArcmin']/a['fwhmXArcmin'] if a['fwhmXArcmin'] and b['fwhmXArcmin'] else None,
                            fwhmYRatio8to4=b['fwhmYArcmin']/a['fwhmYArcmin'] if a['fwhmYArcmin'] and b['fwhmYArcmin'] else None,
                            apertureFluxRatio8to4=b['apertureLumaSteradian']/a['apertureLumaSteradian'],
                            apertureSensitivityRatio8to4={k:b['apertureSensitivityLumaSteradian'][k]/a['apertureSensitivityLumaSteradian'][k] for k in ['0.2','0.3','0.4']},
                            centreSeparationDegrees=angular_distance({'ra':a['centreRA'],'dec':a['centreDec']},{'ra':b['centreRA'],'dec':b['centreDec']})))

rows=[]
for i,star in enumerate(stars):
    rows.append(image_row([crops['4k'][i],crops['8k'][i]],[f'4K {NAMES.get(star["hip"],str(star["hip"]))} .7deg',f'8K .7deg  V={star["vmag"]}']))
sheet=Image.new('RGB',(384*3,222*4),'#10151d')
for i,row in enumerate(rows):sheet.paste(row,((i%3)*384,(i//3)*222))
sheet.save(OUT/'bright-star-angular-crops.png')
for focal in [24,70]:
    image_row([views[('4k',focal)][0],views[('8k',focal)][0]],
              [f'4K source | {focal} mm | same display/exposure',f'8K source | {focal} mm | same display/exposure']).save(OUT/f'perspective-{focal}mm-comparison.jpg',quality=94)

report=dict(scope='research only; no runtime source/asset edited',sources=sources,
            catalogue='ESA 1997 Hipparcos I/239 main via CDS VizieR; coordinates epoch J1991.25; no proper-motion correction in search; per-map local centroid measured',
            cataloguePath='verification/plans/assets/hipparcos-bright-coordinates.tsv',
            starSelection='12 brightest V<2 catalogue stars with |dec|<65deg and >.7deg separation from another V<2 entry; not selected to favour either atlas',
            measurement='FWHM of background-subtracted bilinear-reconstructed linear-luma centre cuts, exact same angular aperture .30deg; ERP flux weighted by each texel solid angle. Background median .35-.5deg; approximate tangent radius <.55deg. Source max=1 is reported, not inferred to be a calibrated optical PSF.',
            display='common current NIGHT_STAR_SCALE 2e-7 * preExposure2^21 = .4194304; Reinhard then exact sRGB; no per-image autoexposure, blur, sharpening, resizing or source edit. Perspective is offline single bilinear sample, not runtime TAA/DOF/PSF/ACES.',
            perspective=[views[('4k',f)][1] for f in [24,70]],measurements=records,comparison=comparisons,
            summary=dict(medianFWHMXRatio8to4=float(np.median([r['fwhmXRatio8to4'] for r in comparisons if r['fwhmXRatio8to4'] is not None])),
                         medianFWHMYRatio8to4=float(np.median([r['fwhmYRatio8to4'] for r in comparisons if r['fwhmYRatio8to4'] is not None])),
                         medianFluxRatio8to4=float(np.median([r['apertureFluxRatio8to4'] for r in comparisons])),
                         fullSkyRGBIntegralRatio8to4=(np.array(sources['8k']['fullSkyRGBIntegralSteradians'])/sources['4k']['fullSkyRGBIntegralSteradians']).tolist()),
            elapsedSeconds=time.perf_counter()-START)
report['integrityChecks']=[
    dict(name='expected_source_dimensions_4k_8k',passed=sources['4k']['width']==4096 and sources['8k']['width']==8192 and sources['4k']['height']==2048 and sources['8k']['height']==4096),
    dict(name='both_exr_linear_float32_finite',passed=all(r['decodedDtype']=='float32' and r['nonFiniteChannels']==0 for r in sources.values())),
    dict(name='same_twelve_catalogue_entries_measured',passed=len(stars)==12 and len(records)==24 and len(comparisons)==12),
    dict(name='matched_centres_under_one_4k_equatorial_texel',passed=all(r['centreSeparationDegrees']<360/4096 for r in comparisons),maxDegrees=max(r['centreSeparationDegrees'] for r in comparisons)),
    dict(name='all_fwhm_positive_and_both_crossings_in_cut',passed=all(r[k] is not None and r[k]>0 for r in records for k in ['fwhmXArcmin','fwhmYArcmin'])),
    dict(name='exact_erp_solid_angles_sum_four_pi',passed=abs(sum((2*math.pi)*(math.sin(math.radians(90-y*180/4096))-math.sin(math.radians(90-(y+1)*180/4096))) for y in range(4096))-4*math.pi)<1e-10),
    dict(name='all_aperture_fluxes_positive',passed=all(v>0 for r in records for v in r['apertureSensitivityLumaSteradian'].values())),
]
(OUT/'measurements.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report['summary'],indent=2),flush=True)
print('Elapsed seconds',report['elapsedSeconds'],flush=True)
