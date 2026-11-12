"""Seal current R21 runtime evidence; never alter browser or scene state."""
import datetime
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V = ROOT / "verification"


def read(name):
    return json.loads((V / name).read_text(encoding="utf-8-sig"))


def equal(a, b):
    if type(a) in (int, float) and type(b) in (int, float):
        return math.isclose(a, b, rel_tol=0, abs_tol=1e-10)
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(equal(x, y) for x, y in zip(a, b))
    return a == b


before = read("r21-user-state-before.json")
after = read("r21-user-state-restored.json")
bp, ap = before["state"]["parameters"], after["state"]["parameters"]
checks = {key: equal(bp[key], ap[key]) for key in (
    "sun", "quality", "paused", "sound", "wind", "current", "lens", "weather",
    "air", "graphics", "sea", "director", "qualityPreset", "renderSampling",
    "qualityCustom",
)}
checks.update({
    "camera": equal(before["state"]["camera"], after["state"]["camera"]),
    "target": equal(before["state"]["target"], after["state"]["target"]),
    "fireworkSettings": equal(before["fireworks"]["settings"], after["fireworks"]["settings"]),
    "observer": equal(before["celestial"]["observer"], after["celestial"]["observer"]),
    "UTC": equal(before["celestial"]["utcMs"], after["celestial"]["utcMs"]),
    "clockRunning": equal(before["celestial"]["running"], after["celestial"]["running"]),
    "lights": all(equal(before["localLights"].get(k), after["localLights"].get(k))
                  for k in ("mode", "linked", "lamps", "flashlight")),
    "ui": all(equal(before["interface"].get(k), after["interface"].get(k))
              for k in ("hidden", "panelOpen", "viewsOpen", "activeCategory", "statsVisible")),
    "noActiveShows": after["fireworks"]["active"] == 0,
    "noGLErrors": after["glErrors"]["errors"] == [],
    "noContextInterruption": not after["state"]["graphicsContextInterrupted"],
})
exact = dict(checks)
# Automatic calibration follows the current read-only display selection. Do
# not force a stale resolved peak or turn automatic mode off merely to match.
display = read("r21-current-display-report.json")
derived = ("peakNits", "paperWhiteNits")
graphics_intent = all(equal(bp["graphics"][k], ap["graphics"][k])
                      for k in bp["graphics"] if k not in derived)
auto_resolved = (bp["graphics"]["systemCalibration"] is True
                 and ap["graphics"]["systemCalibration"] is True
                 and all(equal(ap["graphics"][k], display["calibration"][k]) for k in derived))
checks["graphics"] = exact["graphics"] or graphics_intent and auto_resolved

files = (
    "main.js", "lens.js", "fireworks.js", "fireworks-physics.js",
    "firework-layer-profile.js", "firework-trail-profile.js", "firework-tail-field.js",
    "wind-response.js", "firework-exposure-window.js", "firework-burn-profile.js",
    "firework-air-support.js", "firework-surface.js", "firework-contact-support.js", "firework-contact-optics.js",
    "firework-show-envelope.js", "pyro-smoke-transmission-gpu.js",
    "pyro-smoke-transmission-pack.js", "ui.js", "index.html", "fireworks-audio.js", "package.json",
)
source_hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files}
assert source_hashes["fireworks-audio.js"] == "4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31"
assert all(checks.values()), [key for key, ok in checks.items() if not ok]
manifest = {
    "schema": "glass-atoll.r21-final-manifest.v1",
    "UTC": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "sourceSHA256": source_hashes,
    "restored": checks, "restoredCount": sum(checks.values()), "restoreTotal": len(checks),
    "exactSnapshotMatches": exact, "exactSnapshotMatchCount": sum(exact.values()),
    "automaticDisplayResolution": {
        "before": {k: bp["graphics"][k] for k in derived},
        "after": {k: ap["graphics"][k] for k in derived},
        "currentDevice": display["calibration"]["display"]["deviceName"],
        "selectionConfidence": display["calibration"]["confidence"],
        "scope": "Automatic/user intent retained; resolved read-only display capability can change. No Windows settings changed.",
    },
    "nativeEvidence": [
        "r21-contact-support-gpu.json", "r21-native-low-contact.json",
        "r21-native-high-contact-state.json", "r21-native-low-frozen-performance.json",
        "r21-native-high-frozen-performance.json", "r21-low-contact-sdr.png",
    ],
    "server": {"address": "127.0.0.1:5186", "pid": 23820, "execSession": 62067},
    "limits": [
        "Goal active; no final photoreal acceptance or continuous60FPS claim.",
        "Low/high native timing windows have different views/workloads; no causal before/after performance gain claim.",
        "Normal reload restarts physical cloud/water time and does not replay a previous transient show.",
        "The new finite-thrust foundation is not imported by the scene or admitted by this runtime manifest.",
    ],
}
artifact_names = (
    "r21-cpu-acceptance.json", "r21-contact-support-gpu.json",
    "r21-contact-support-gpu-cpu-check.json", "r21-native-low-contact.json",
    "r21-native-high-contact-state.json", "r21-native-low-frozen-performance.json",
    "r21-native-high-frozen-performance.json", "r21-low-contact-sdr.png",
)
manifest["verificationArtifactsSHA256"] = {
    name: hashlib.sha256((V / name).read_bytes()).hexdigest() for name in artifact_names
}
manifest["gpuScope"] = "Existing renderer under QA lock, actual selected head main/mirror history and S0 controls, four32x32single-instance draws;8/8"
(V / "r21-final-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"restoredIntent": f"{sum(checks.values())}/{len(checks)}",
                  "exactSnapshots": f"{sum(exact.values())}/{len(exact)}",
                  "audioUnchanged": True}, ensure_ascii=False))
