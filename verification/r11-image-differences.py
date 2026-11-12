"""SDR image facts only; no photographic quality score."""
import json
from pathlib import Path
import numpy as np
from PIL import Image
root = Path(__file__).resolve().parent
out = {"schema": "glass-atoll.r11-image-differences.v1", "actualGPU": False, "scope": "offline analysis of already captured actual scene PNGs", "images": [], "checks": []}
for kind in ("palm", "willow"):
    for angle in ("front", "detail"):
        stem = f"r11-tail-cooling-{kind}-{angle}_"
        paths = [root / (stem + name + ".png") for name in ("constant", "cooling", "constant_repeat")]
        arrays = [np.asarray(Image.open(p).convert("RGB"), dtype=np.int16) for p in paths]
        d = np.abs(arrays[0] - arrays[1])
        repeat_exact = paths[0].read_bytes() == paths[2].read_bytes()
        item = {"type": kind, "angle": angle, "dimensions": [arrays[0].shape[1], arrays[0].shape[0]], "changedPixels": int(np.count_nonzero(np.any(d > 0, axis=2))), "maxChannelDifference8bit": int(d.max()), "meanAbsoluteChannelDifference8bit": float(d.mean()), "ARepeatPNGByteExact": repeat_exact}
        out["images"].append(item)
        out["checks"].append({"name": kind + " " + angle + " original dimensions repeat and changed pixels", "passed": all(a.shape == (1080, 1920, 3) for a in arrays) and repeat_exact and item["changedPixels"] > 0})
out["passed"] = all(x["passed"] for x in out["checks"])
out["limits"] = ["Difference counts prove image changes and roundtrip only, not realism, visible magnitude on a panel, source or display calibration.", "Photopic Y is a source reference; final colour transform can change displayed brightness when RGB chromaticity changes."]
(root / "r11-image-differences.json").write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
print(json.dumps(out, indent=2))
