"""Facts about captured SDR PNGs; these are not realism scores or raw-HDR sums."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent
result = {"schema": "glass-atoll.r12-image-differences.v1", "actualGPU": False, "comparisons": []}
comparisons = []
for phase in ("0p12_front", "1p1_front", "1p1_detail"):
    stem = f"r12-thermal-{phase}_"
    comparisons.append((phase + " thermal photometry", stem + "reference", stem + "thermal-greybody", stem + "reference_repeat"))
for mode in ("reference", "thermal-greybody"):
    stem = f"r12-background-air-{mode}_"
    comparisons.append((mode + " quadratic background air", stem + "legacy", stem + "local_sky", stem + "legacy_repeat"))
for label, a, b, repeat in comparisons:
    paths = [root / (p + ".png") for p in (a, b, repeat)]
    arrays = [np.asarray(Image.open(p).convert("RGB"), dtype=np.int16) for p in paths]
    delta = np.abs(arrays[0] - arrays[1])
    repeated = np.abs(arrays[0] - arrays[2])
    result["comparisons"].append({"label": label, "paths": [p.name for p in paths], "dimensions": [arrays[0].shape[1], arrays[0].shape[0]], "changedPixels": int(np.count_nonzero(np.any(delta, axis=2))), "maximumChannelDifference8bit": int(delta.max()), "meanAbsoluteChannelDifference8bit": float(delta.mean()), "repeatChangedPixels": int(np.count_nonzero(np.any(repeated, axis=2))), "repeatMaximumChannelDifference8bit": int(repeated.max()), "repeatPNGByteExact": paths[0].read_bytes() == paths[2].read_bytes()})
result["limits"] = ["Quantifies captured SDR image changes and repeatability only; not real-world photometry, raw radiance linearity or panel HDR validation.", "Quadratic background-air image still has a visible endpoint-dependent horizon seam; numerical checks do not accept its appearance."]
(root / "r12-image-differences.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
