"""CPU-only audit of already saved R36 on/off PNGs and receipts. No renderer imports."""
from pathlib import Path
import hashlib
import json
import math
import platform

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FILES = {
    "off": ("r36-background-air-off-before.json", "r36-radiant-logical-plus2p50-detail-hdr.png"),
    "on": ("r36-background-air-on.json", "r36-background-air-on.png"),
    "repeat": ("r36-background-air-off-repeat.json", "r36-background-air-off-repeat.png"),
}


def pin(path):
    data = path.read_bytes()
    return {"path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def difference(a, b, path=""):
    if type(a) is not type(b):
        return [{"path": path, "before": a, "after": b}]
    if isinstance(a, dict):
        out = []
        for key in sorted(a.keys() | b.keys()):
            out.extend(difference(a.get(key), b.get(key), path + "." + key))
        return out
    if isinstance(a, list):
        if len(a) != len(b):
            return [{"path": path + ".length", "before": len(a), "after": len(b)}]
        return sum((difference(x, y, f"{path}[{i}]") for i, (x, y) in enumerate(zip(a, b))), [])
    return [] if a == b else [{"path": path, "before": a, "after": b}]


def image_stats(delta, rect):
    x0, y0, x1, y1 = rect
    values = delta[y0:y1, x0:x1, :3]
    pixels = values.max(axis=2)
    at = np.unravel_index(int(values.argmax()), values.shape)
    return {
        "rectXYXYExclusive": rect, "pixels": int(pixels.size),
        "maxChannelDifferenceU8": int(values.max()),
        "meanAbsoluteChannelDifferenceU8": float(values.mean()),
        "meanSignedRGBDifferenceU8": None,
        "p99MaximumChannelDifferenceU8": float(np.percentile(pixels, 99)),
        "changedPixels": int(np.count_nonzero(pixels)),
        "pixelsAbove2U8": int(np.count_nonzero(pixels > 2)),
        "maximumAt": {"x": int(at[1]) + x0, "y": int(at[0]) + y0, "channel": int(at[2])},
    }


states = {key: json.loads((HERE / names[0]).read_text(encoding="utf-8-sig")) for key, names in FILES.items()}
images = {key: np.asarray(Image.open(HERE / names[1]).convert("RGBA")) for key, names in FILES.items()}
setup = json.loads((HERE / "r36-logical-detail-setup.json").read_text(encoding="utf-8-sig"))
shape = images["off"].shape
assert shape == (1292, 1209, 4) and all(value.shape == shape for value in images.values())
rois = {
    "full": [0, 0, 1209, 1292],
    "sceneExcludingBottomUI": [0, 0, 1209, 1180],
    "flower": [220, 250, 980, 1090],
    "horizonBand652": [100, 648, 1109, 658],
    "wideBand": [100, 640, 1109, 672],
    "skyAboveHorizon": [100, 200, 1109, 600],
    "coreBand": [450, 640, 720, 672],
}
comparisons = {}
for first, second in [("on", "off"), ("repeat", "off"), ("on", "repeat")]:
    signed = images[first].astype(np.int16) - images[second].astype(np.int16)
    absolute = np.abs(signed)
    values = {}
    for name, rect in rois.items():
        stats = image_stats(absolute, rect)
        x0, y0, x1, y1 = rect
        stats["meanSignedRGBDifferenceU8"] = signed[y0:y1, x0:x1, :3].mean(axis=(0, 1)).tolist()
        values[name] = stats
    comparisons[first + "Minus" + second.title()] = values

core_rows = []
for row in range(630, 681):
    entry = {"rowYZeroBased": row, "xRangeExclusive": [450, 720], "images": {}}
    for name, pixels in images.items():
        rgb = pixels[row, 450:720, :3]
        entry["images"][name] = {
            "meanRGBU8": rgb.mean(axis=0).tolist(),
            "medianMaximumChannelU8": float(np.median(rgb.max(axis=1))),
            "p90MaximumChannelU8": float(np.percentile(rgb.max(axis=1), 90)),
        }
    core_rows.append(entry)

baseline = states["off"]
metadata = {}
for name, receipt in states.items():
    state = receipt["state"]
    metadata[name] = {
        "time": state["time"], "camera": state["camera"], "target": state["target"],
        "snapshotPackets": len(receipt["snapshot"]["packets"]),
        "snapshotRevision": receipt["snapshot"]["revision"],
        "snapshotExactlyMatchesOff": receipt["snapshot"] == baseline["snapshot"],
        "clustersExactlyMatchOff": receipt["clusters"] == baseline["clusters"],
        "parametersDifferencesFromOff": difference(baseline["state"]["parameters"], state["parameters"]),
        "photometryDifferencesFromOff": difference(baseline["photometry"], receipt["photometry"]),
        "backgroundLocalScattering": receipt["air"]["backgroundLocalScattering"],
        "airFrames": receipt["air"]["frames"],
        "airSteps": receipt["air"]["steps"],
        "airMaxDistance": receipt["air"]["maxDistance"],
        "storageEV": state["lens"]["storageEV"],
        "exposureScale": state["lens"]["exposureScale"],
        "temporal": state["lens"]["temporal"],
        "flare": state["lens"]["bloom"]["flare"],
        "gl": receipt["gl"],
    }

aerial = (ROOT / "aerial-perspective.js").read_text(encoding="utf-8-sig")
main = (ROOT / "main.js").read_text(encoding="utf-8-sig")
lens = (ROOT / "lens.js").read_text(encoding="utf-8-sig")
wiring = {
    "publicFlagIsWrittenToConfigurationAndParameters": "const patch={backgroundLocalScattering:enabled?1:0};aerialPerspective.configure(patch);Object.assign(parameters.air,patch);setAir();" in main,
    "allCoefficientRefreshesWriteTheIntegerUniform": "uniforms.uBackgroundLocalScattering.value=configuration.backgroundLocalScattering;" in aerial,
    "updateReappliesCoefficients": "applyCoefficients();\n  }\n  function render" in aerial,
    "bothPassMaterialsShareTheSameUniformObject": aerial.count("glslVersion:THREE.GLSL3,uniforms,vertexShader:vertex,fragmentShader:") == 2,
    "skyIntegrationHasASeparateMinusTwoClass": "scatterOutput=vec4(S,-2.);transmissionOutput=vec4(1.);return;" in aerial,
    "skyCompositeActuallyAddsS": "fragColor=vec4(colour.rgb+S,colour.a);return;" in aerial,
    "opaqueCompositeRemainsTColourPlusS": "fragColor=vec4(colour.rgb*T+S,colour.a);" in aerial,
    "lensCallsAerialBeforeEffectRendererAndBloom": lens.index("if(aerialPerspective)uniforms.tScene.value=aerialPerspective.render") < lens.index("if(effectsRenderer)effectsRenderer(") < lens.index("bloom.render(lensTarget.texture)"),
    "wholeAirToggleAlsoChangesFiniteSmokeAirPayload": "enabled:parameters.air.enabled,sunDirection:keyDirection.toArray()" in main,
}

camera = baseline["state"]["camera"]
target = baseline["state"]["target"]
height = baseline["state"]["lens"]["height"]
fov = baseline["state"]["lens"]["verticalFovDegrees"]
horizontal = math.hypot(target[0] - camera[0], target[2] - camera[2])
focal_pixels = (height / 2) / math.tan(math.radians(fov) / 2)
views = []
for offset in [0, 20]:
    observer_y = camera[1] + offset
    pitch = math.atan2(target[1] - observer_y, horizontal)
    dip = math.acos(6360000 / (6360000 + observer_y))
    row = height / 2 - focal_pixels * math.tan(-dip - pitch)
    views.append({"camera": [camera[0], observer_y, camera[2]], "target": target,
                  "pitchDegrees": math.degrees(pitch), "predictedCentralHorizonRow": row,
                  "targetDistanceMetres": math.hypot(horizontal, target[1] - observer_y)})

sky_off_repeat = comparisons["repeatMinusOff"]["skyAboveHorizon"]
sky_on_off = comparisons["onMinusOff"]["skyAboveHorizon"]
checks = [
    {"name": "Saved inputs have the declared native dimensions and opaque U8 screenshots", "passed": all(np.all(p[:, :, 3] == 255) for p in images.values())},
    {"name": "Same complete density, clusters, physical time, camera and exposure; flags are 0/1/0", "passed": all(m["snapshotExactlyMatchesOff"] and m["clustersExactlyMatchOff"] and m["time"] == metadata["off"]["time"] and m["camera"] == metadata["off"]["camera"] and m["target"] == metadata["off"]["target"] and m["storageEV"] == 11 and m["exposureScale"] == 6.08 for m in metadata.values()) and [metadata[k]["backgroundLocalScattering"] for k in ["off", "on", "repeat"]] == [0, 1, 0]},
    {"name": "Background flag has an observed image effect, with bit-exact off-repeat sky control", "passed": sky_off_repeat["changedPixels"] == 0 and sky_on_off["changedPixels"] == 64213 and sky_on_off["maxChannelDifferenceU8"] == 25},
    {"name": "Current source has a complete flag-to-uniform-to-both-pass route", "passed": all(wiring.values())},
    {"name": "Actual setup reports curved far ocean and geometric reflection, clean saved GL state", "passed": setup["water"]["farField"]["mode"] == "curved" and setup["water"]["reflection"]["directionMode"] == "geometric" and all(not m["gl"]["errors"] and m["gl"]["programLive"] and m["gl"]["vertexArrayLive"] for m in metadata.values())},
]
report = {
    "schema": "glass-atoll.r36-background-air-saved-pixel-audit.v1",
    "passed": all(c["passed"] for c in checks), "checks": checks,
    "scope": "CPU-only saved screenshot/receipt/source audit; no browser, GPU, renderer, scene replay or production mutation",
    "runtime": {"python": platform.python_version(), "numpy": np.__version__},
    "inputs": [pin(HERE / item) for names in FILES.values() for item in names] + [pin(HERE / "r36-logical-detail-setup.json")],
    "sourcePins": [pin(ROOT / item) for item in ["aerial-perspective.js", "main.js", "lens.js", "water.js", "ocean-geometry.js", "sky.js"]],
    "imageConvention": "1209x1292 RGBA screenshot; top-left origin; zero-based rows; ROI end exclusive; differences in encoded U8 units, not scene-linear radiance or calibrated nits",
    "comparisons": comparisons, "coreRows630Through680": core_rows,
    "metadata": metadata, "sourceWiring": wiring,
    "actualSetupWater": {"farField": setup["water"]["farField"], "reflection": setup["water"]["reflection"]},
    "findings": [
        "The flag is observably effective in saved sky pixels; no source-wiring defect was found in the inspected current route.",
        "The visible narrow band remains in both on and off images. Enabling current quadratic background S did not remove it; the simpler missing-background-S explanation is not established as its dominant cause.",
        "Core sky additions collapse near rows651/652, consistent with the separate sky/opaque depth classes. Screenshot data cannot identify the responsible pre-composite attachment or prove a unique mechanism.",
        "Full-flower differences are confounded by temporal histories: first off frozen41, on9, repeat8. Exact density/source state is not exact temporal image history.",
        "Photometry medium/bound grows on, but storageEV11 and exposureScale6.08 stay equal. The PNG is display encoded and cannot validate an absolute air radiance model.",
    ],
    "smallestNextObservationProposal": {
        "implemented": False, "performed": False,
        "purpose": "Separate a geometric ocean/sky-boundary-aligned band from a source-centred smoke/effect/post band using only the existing public camera API",
        "views": views,
        "method": "Keep the same paused physical source/density state, background flag0, all optics/light/quality/settings. Move only camera Y+20m, retain the identical world target and FOV; compare one settled saved view then restore. No new solver/shader/brightness change.",
        "interpretation": "If the band follows the predicted horizon near541.66 while the target remains near646, prioritize geometric/depth-class/water boundary; if it stays through the centred flower, prioritize source/smoke/effect/post paths. Neither outcome alone uniquely identifies a shader.",
        "limits": "Changed eye rays may change valid SourceT/reflection row counts and screen composition. This is not a performance pair or a same-ray radiance proof. Whole-air-off is an alternative coarse test but also changes finite smoke/front-air payload; it does not isolate aerial-perspective.js alone.",
    },
}
output = HERE / "r36-background-air-pixel-audit.json"
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"passed": report["passed"], "checks": f"{sum(c['passed'] for c in checks)}/{len(checks)}",
                  "skyOnVsOff": sky_on_off, "skyOffRepeat": sky_off_repeat,
                  "output": str(output)}, ensure_ascii=False))
