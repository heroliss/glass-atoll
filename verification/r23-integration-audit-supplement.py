"""CPU-only audit of saved R23 whole-frame and second-camera integration evidence."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
V = ROOT / 'verification'
def read(name):
    return json.loads((V / name).read_text(encoding='utf-8-sig'))
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def near(a, b):
    assert math.isclose(a, b, rel_tol=1e-12, abs_tol=1e-8), (a, b)
def stats(values):
    ordered = sorted(values)
    q = lambda p: ordered[math.floor(p * (len(ordered) - 1))]
    return dict(count=len(values), minimum=q(0), median=q(.5),
                mean=sum(values)/len(values), p95=q(.95), p99=q(.99), maximum=q(1))
def differences(a, b, prefix=''):
    if isinstance(a, dict) and isinstance(b, dict):
        return sum((differences(a.get(k), b.get(k), prefix+'.'+k)
                    for k in sorted(a.keys() | b.keys())), [])
    return [] if a == b else [dict(path=prefix, before=a, after=b)]

checks = []
def passed(name, evidence):
    checks.append(dict(name=name, passed=True, evidence=evidence))
labels = ['A1', 'B1', 'B2', 'A2']
blocks = {label: read(f'r23-whole-frame-{label}.json') for label in labels}
summary = read('r23-whole-frame-block-summary.json')
for label, block in blocks.items():
    r = block['report']
    assert (r['status'], r['validity'], r['reason']) == ('completed', 'valid', None)
    assert r['workload']['before'] == r['workload']['after']
    assert r['workload']['interrupted'] is False
    assert r['frames'] == len(r['raw']['frameIntervals'])
    near(r['averageFps'], r['frames']/r['elapsedSeconds'])
    for key, raw in [('frameMs', 'frameIntervals'), ('cpuMs', 'cpuTimes'), ('gpuMs', 'gpuTimes')]:
        expected = stats(r['raw'][raw])
        for field, value in expected.items():
            near(r[key][field], value)
    assert r['framesOver16_67ms'] == sum(x > 1000/60 for x in r['raw']['frameIntervals'])
    assert block['gl']['errors'] == [] and block['gl']['programLive'] and block['gl']['vertexArrayLive']
passed('All four saved blocks are internally valid and raw statistics recompute',
       dict(frames={k: blocks[k]['report']['frames'] for k in labels},
            seconds={k: blocks[k]['report']['elapsedSeconds'] for k in labels}))
for row in summary:
    label = row['label']; block = blocks[label]; r = block['report']
    assert row['mode'] == block['sourceT']['layoutMode']
    for key, value in [('status', r['status']), ('validity', r['validity']), ('FPS', r['averageFps']),
                       ('frames', r['frames']), ('medianCPU', r['cpuMs']['median']),
                       ('medianGPU', r['gpuMs']['median']), ('queries', block['sourceRender']['mediumQueries'])]:
        assert row[key] == value
passed('Block summary agrees with original detailed reports', dict(rows=len(summary)))

work = {label: block['report']['workload']['before'] for label, block in blocks.items()}
cross_diffs = {label: differences(work['A1'], work[label]) for label in labels}
assert cross_diffs['A1'] == []
layout_diff = [dict(path='.gpuTransmissionConfiguration.layoutMode', before='legacy-max', after='active-count')]
assert cross_diffs['B1'] == layout_diff and cross_diffs['B2'] == layout_diff
assert cross_diffs['A2'] == [dict(path='.parameters.graphics.peakNits', before=700, after=1270)]
for label, block in blocks.items():
    r = block['report']
    for side in ['initial', 'final']:
        assert r[side]['viewport'] == [1209, 1292]
        assert r[side]['dpr'] == 1 and r[side]['renderScale'] == 1
        assert r[side]['lens']['hdr']['mode'] == 'float-canvas-external-copy'
        assert r[side]['lens']['hdr']['peakNits'] == work[label]['parameters']['graphics']['peakNits']
passed('Cross-block physical workload is frozen; final A block HDR calibration drift is explicitly detected',
       dict(differencesFromA1=cross_diffs, strictLayoutOnlyABBA=False))

pooled = {}
for mode, group in [('legacy-max', ['A1', 'A2']), ('active-count', ['B1', 'B2'])]:
    reports = [blocks[label]['report'] for label in group]
    pooled[mode] = dict(labels=group, frames=sum(r['frames'] for r in reports),
        elapsedSeconds=sum(r['elapsedSeconds'] for r in reports))
    pooled[mode]['elapsedFPS'] = pooled[mode]['frames']/pooled[mode]['elapsedSeconds']
    for key, raw in [('frameMs', 'frameIntervals'), ('cpuMs', 'cpuTimes'), ('gpuMs', 'gpuTimes')]:
        pooled[mode][key] = stats(sum((r['raw'][raw] for r in reports), []))
fps_change = (pooled['active-count']['elapsedFPS']/pooled['legacy-max']['elapsedFPS']-1)*100
for label, block in blocks.items():
    source, field = block['sourceRender'], block['sourceT']
    assert source['backend'] == 'gpu' and source['effective'] and source['mediumQueries'] == 0
    assert source['activeRayCount'] == field['count'] == 1740
    assert field['effective'] and field['pairs'] == 870000 and field['caps']['maxPairs'] == 1048576
    assert work[label]['packets'] == 500 and work[label]['time'] == 34.49197017173171
passed('Whole-frame samples retain admitted GPU main SourceT and zero CPU medium queries',
       dict(mainRows=1740, packets=500, pairsPerMainRequest=870000, maxPairs=1048576,
            mirrorRayCountRecordedInTheseBlocks=False))

pair = {mode: read(f'r23-native-both-view-{mode}.json') for mode in ['legacy-max', 'active-count']}
a, b = pair.values()
for path in [('state', 'time'), ('state', 'camera'), ('state', 'target'), ('state', 'parameters'),
             ('smoke', 'state'), ('fireworks', 'activeEvents'), ('fireworks', 'records'),
             ('fireworks', 'lightingField'), ('fireworks', 'audio')]:
    xa, xb = a, b
    for key in path: xa, xb = xa[key], xb[key]
    assert xa == xb, path
view_results = {}
for mode, d in pair.items():
    assert not d['state']['graphicsContextInterrupted'] and d['state']['parameters']['paused']
    assert d['sourceT']['layoutMode'] == mode and d['sourceT']['effective']
    assert d['sourceT']['pairs'] == 870000 and d['sourceT']['caps']['maxPairs'] == 1048576
    view_results[mode] = {}
    for view in ['main', 'reflection']:
        r = d['fireworks']['lastRenderByView'][view]; s = r['sourceTransmission']
        assert r['rendered'] and r['instances'] == 1740
        assert s['backend'] == 'gpu' and s['effective'] and s['mediumQueries'] == 0
        assert r['mediumQueries'] == 0 and s['activeRayCount'] == s['instances'] == 1740
        assert s['reflection'] == (view == 'reflection') and s['densityRevision'] == 1122
        assert s['recordsGeneration'] == 2786 and r['time'] == d['state']['time']
        view_results[mode][view] = {k:s[k] for k in ['backend', 'effective', 'mediumQueries', 'activeRayCount',
             'instances', 'cameraKey', 'reflection', 'densityRevision', 'recordsGeneration', 'sourceVersion']}
    main = view_results[mode]['main']; mirror = view_results[mode]['reflection']
    camera = d['state']['camera']; reflected = [camera[0], -camera[1], camera[2]]
    assert [float(x) for x in main['cameraKey'].split(',')] == camera
    assert [float(x) for x in mirror['cameraKey'].split(',')] == reflected
    assert d['sourceT']['sourceVersion'] == main['sourceVersion']
    assert d['smoke']['columns']['rays'] == d['smoke']['columns']['kernelsEvaluated'] == 0
    assert d['fireworks']['lightingField']['effective'] and d['fireworks']['lightingField']['requiredPairs'] == 864000
    assert d['gl']['errors'] == [] and d['gl']['programLive'] and d['gl']['vertexArrayLive']
passed('Second-camera both-view integration preserves state, geometry generations and GPU routing', view_results)

images = {mode: Image.open(V/f'r23-native-both-view-{mode}.png').convert('RGBA') for mode in pair}
assert images['legacy-max'].size == images['active-count'].size == (1209, 1292)
pixels_a, pixels_b = (images[mode].tobytes() for mode in pair)
diff = ImageChops.difference(images['legacy-max'], images['active-count'])
changed = sum(1 for index in range(0, len(pixels_a), 4) if pixels_a[index:index+4] != pixels_b[index:index+4])
image_result = dict(width=1209, height=1292, decodedBytes=len(pixels_a), changedPixels=changed,
    bitwiseEqual=pixels_a == pixels_b, maximumAbsoluteChannelDifference=max(diff.tobytes()),
    meanAbsoluteChannelDifference=sum(diff.tobytes())/len(pixels_a),
    changedRGBBoundingBox=diff.convert('RGB').getbbox(), channelDifferenceExtrema=diff.getextrema(),
    decodedRGBA_SHA256={mode:hashlib.sha256(images[mode].tobytes()).hexdigest() for mode in pair})
assert changed == 1 and image_result['maximumAbsoluteChannelDifference'] == 1
assert diff.getextrema() == ((0, 0), (0, 0), (0, 1), (0, 0))
passed('Independent Pillow RGBA decode measures one blue-channel one-code-value pixel difference; exact equality is false', image_result)

main_source = (ROOT/'main.js').read_text(encoding='utf-8-sig')
assert "import { createSmokeTransmissionGPU } from './pyro-smoke-transmission-gpu.js'" in main_source
assert 'qaSmokeTransmissionField=createSmokeTransmissionGPU(THREE,renderer,caps)' in main_source
assert 'configureSmokeGPUField(true,{maxSources:18000,maxPackets:4096,maxPairs:1048576,layoutMode})' in main_source
assert "createLegacyField}]=await Promise.all([import('./verification/r23-native-transmission-layout-pair-check.js'),import('./verification/r23-legacy-transmission-gpu.js')])" in main_source
passed('Production whole-frame layout setter uses current module; isolated pair baseline remains archived factory',
       dict(wholeFrameA='current module with explicit legacy-max', wholeFrameB='current module with active-count',
            isolatedPairA='archived factory', productionGPU_SHA256=sha(ROOT/'pyro-smoke-transmission-gpu.js')))

receipt = read('r23-actual-layout-audit-receipt.json')
old_paths = [p for p in receipt['SHA256'] if p.startswith('verification/')]
for path in old_paths: assert sha(ROOT/path) == receipt['SHA256'][path], path
assert sha(ROOT/'fireworks-audio.js') == '4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'
passed('Chronological original audit and approved firework audio source remain unchanged',
       dict(previousAuditFilesChecked=len(old_paths), approvedFireworkAudioSHA256=sha(ROOT/'fireworks-audio.js'),
            audioPlaybackAcceptanceAdded=False))

inputs = [f'r23-whole-frame-{label}.json' for label in labels] + ['r23-whole-frame-block-summary.json']
inputs += [f'r23-native-both-view-{mode}.{ext}' for mode in pair for ext in ['json', 'png']]
result = dict(schema='glass-atoll.r23-integration-audit-supplement.v1', passed=True,
    reviewerGPUDispatches=0, reviewerBrowserActions=0, productionEdits=0,
    checks=checks, counts=dict(checks=len(checks), passed=len(checks)),
    wholeFrame=dict(blocks=summary, pooled=pooled, descriptiveElapsedFPSChangePercent=fps_change,
        strictLayoutOnlyABBA=False, crossBlockDrift=cross_diffs['A2'],
        scope='Two approximately 3-second samples per layout, one frozen physical phase/camera, actual rendering and HDR bridge; not evolving-simulation performance',
        interpretation='Descriptive throughput improvement only; A2 display peak calibration drift and sample/order variance preclude clean layout-only whole-frame causal attribution. GPU pooled mean is not reduced.'),
    bothView=dict(camera=b['state']['camera'], target=b['state']['target'], packets=500,
        pairsPerView=870000, sourceRowsAcrossTwoViews=3480, combinedSourceTPairsIfBothPrepared=1740000,
        resolvedLightFieldPairs=864000, resolvedLightFieldReused=True, views=view_results, image=image_result,
        scope='Separate paused second-camera integration/image comparison, not a both-active-view benchmark or direct transmission texture readback'),
    unchangedLimits=['1048576 whole-request SourceT pair gate and resulting over-budget CPU fallback',
        'Resolved-light-field over-budget rejection', 'Late-life, evolving, repeated-show and accumulated-smoke performance',
        'No 60 FPS or powered-effect UI admission', 'PNG equality does not verify HDR canvas output or universal views/phases'],
    sourceSHA256={str((V/p).relative_to(ROOT)):sha(V/p) for p in inputs},
    reviewedSourceSHA256={p:sha(ROOT/p) for p in ['main.js', 'render-benchmark.js', 'pyro-smoke-transmission-gpu.js',
        'smoke-transmission-layout.js', 'fireworks-audio.js', 'verification/r23-integration-audit-supplement.py']})
(V/'r23-integration-audit-supplement.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(dict(passed=True, checks=f'{len(checks)}/{len(checks)}', pooledFPS={k:v['elapsedFPS'] for k,v in pooled.items()},
                     descriptiveFPSChangePercent=fps_change, crossBlockDrift=cross_diffs['A2'], image=image_result), indent=2))
