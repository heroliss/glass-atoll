"""Authorized non-commercial research catalogue source acquisition; no runtime install."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess,hashlib,json,datetime,shutil
ROOT=Path(__file__).resolve().parent;DEST=ROOT/'assets/catalog-source';DEST.mkdir(parents=True,exist_ok=True)
BASE='https://cdsarc.cds.unistra.fr/ftp/cats/'
JOBS=[('hip_main.dat',BASE+'I/239/hip_main.dat'),('suppl_1.dat.gz',BASE+'I/259/suppl_1.dat.gz')]
JOBS += [(f'tyc2.dat.{i:02d}.gz',BASE+f'I/259/tyc2.dat.{i:02d}.gz') for i in range(20)]
JOBS += [('milkyway_2020_4k.exr','https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_4k.exr')]
def fetch(job):
    name,url=job;path=DEST/name;header=DEST/(name+'.headers.txt')
    if not path.exists():
        part=DEST/(name+'.part')
        result=subprocess.run(['curl.exe','--silent','--show-error','--fail','--location','--retry','2','--retry-all-errors','--retry-delay','1','--max-time','240','--dump-header',str(header),url,'--output',str(part)],capture_output=True,text=True)
        if result.returncode:raise RuntimeError(name+': '+result.stderr)
        part.replace(path)
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(4*1024*1024),b''):h.update(chunk)
    record={'file':name,'sourceURL':url,'bytes':path.stat().st_size,'sha256':h.hexdigest(),'retrievedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'raw research source, not shipped runtime data','license':'NASA SVS4851 visualization source terms' if name.startswith('milky') else 'CC BY-NC 3.0 IGO; Credit ESA; ESA1997/Hog2000; CDS/VizieR'}
    path.with_suffix(path.suffix+'.provenance.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
    print(name,record['bytes'],h.hexdigest(),flush=True);return record
for source,name in [('cds-hip1-readme.html','I239-ReadMe.html'),('cds-tycho2-readme.html','I259-ReadMe.html')]:shutil.copy2(ROOT/'assets'/source,DEST/name)
(DEST/'README.txt').write_text('Raw research sources for authorized personal non-commercial use. Catalogue raw data and derivatives: CC BY-NC 3.0 IGO. Credit ESA. Hipparcos: ESA1997 SP1200. Tycho-2: Hog etal2000 A&A355 L27. CDS/VizieR DOI10.26093/cds/vizier. NASA MilkyWay visualization retains separate SVS4851 source terms. Full raw catalogues are not browser/runtime dependencies. See source-specific provenance and original ReadMe.\n',encoding='utf-8')
with ThreadPoolExecutor(max_workers=3) as pool: records=list(pool.map(fetch,JOBS))
(DEST/'manifest.json').write_text(json.dumps({'scope':'research source only','retrievedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'records':records},indent=2),encoding='utf-8')
print('Complete',len(records),'files',sum(r['bytes'] for r in records),'bytes',flush=True)
