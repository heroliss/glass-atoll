"""Download research-only official source assets; never changes runtime assets."""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
import hashlib, json, shutil, datetime, time

ROOT=Path(__file__).resolve().parent
DEST=ROOT/'assets'; DEST.mkdir(parents=True,exist_ok=True)
def fetch(url,name):
    path=DEST/name
    if path.exists():
        print('Already present:',name,path.stat().st_size,flush=True)
        return path
    request=Request(url,headers={'User-Agent':'GlassAtoll-OfflineResearch/1.0'})
    started=time.perf_counter(); h=hashlib.sha256(); written=0; last=0
    with urlopen(request,timeout=120) as response, path.with_suffix(path.suffix+'.part').open('wb') as out:
        headers=dict(response.headers.items()); final=response.url
        while True:
            chunk=response.read(4*1024*1024)
            if not chunk:break
            out.write(chunk);h.update(chunk);written+=len(chunk)
            if written-last>=32*1024*1024:
                print(name,round(written/1024/1024,1),'MiB',flush=True);last=written
    expected=int(headers.get('Content-Length',written))
    if expected!=written:raise RuntimeError(f'Length mismatch: {written}/{expected}')
    path.with_suffix(path.suffix+'.part').replace(path)
    meta={'sourceURL':url,'finalURL':final,'retrievedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bytes':written,'sha256':h.hexdigest(),'responseHeaders':headers,'downloadSeconds':time.perf_counter()-started,'scope':'research-only source; not installed in runtime'}
    path.with_suffix(path.suffix+'.provenance.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
    print(json.dumps({k:meta[k] for k in ['sourceURL','bytes','sha256','downloadSeconds']}),flush=True)
    return path

fetch('https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_8k.exr','starmap_2020_8k.exr')
fetch('https://svs.gsfc.nasa.gov/4851/','nasa-svs-4851-source.html')
saved=ROOT.parent.parent/'assets/night/nasa-svs-4851-metadata.json'
if saved.exists():shutil.copy2(saved,DEST/'nasa-svs-4851-official-metadata-saved.json')
query=urlencode({'-source':'I/239/hip_main','-out':'HIP,RAdeg,DEdeg,Vmag,B-V','Vmag':'<2.0','-out.max':'100','-out.form':'mini'})
try:fetch('https://vizier.cds.unistra.fr/viz-bin/asu-tsv?'+query,'hipparcos-vmag-under2.tsv')
except Exception as error:print('Catalogue request failed:',repr(error),flush=True)
