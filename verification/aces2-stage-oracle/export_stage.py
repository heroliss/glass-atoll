"""Three-pixel official public-FF diagnostic; frozen first assets stay intact."""
from __future__ import annotations
import hashlib
import json
import math
import pathlib
import sys
from datetime import datetime, timezone
import PyOpenColorIO as O
import numpy as np

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parent.parent
FROZEN = ROOT / "verification" / "aces2-oracle"
PEAK = 1270
AP0_XY = [.7347, .2653, 0., 1., .0001, -.077, .32168, .33767]
LIMIT_XY = [.64, .33, .30, .60, .15, .06, .3127, .329]
INDEX = json.loads((FROZEN / "export-report.json").read_text())
ORACLE = json.loads((FROZEN / "aces2-1270-cpu.json").read_text())
U = ORACLE["AP1UpperFloat32"]
CONFIG = O.Config.CreateRaw()
CHECKS = []


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_write(path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def vec(values):
    return [float(v) for v in values]


def apply(cpu, value):
    return vec(cpu.applyRGB(vec(value)))


def proc(*ops):
    return CONFIG.getProcessor(O.GroupTransform(list(ops)))


def cpu(*ops):
    return proc(*ops).getDefaultCPUProcessor()


def input_op():
    return O.BuiltinTransform("UTILITY - ACES-AP1_to_LINEAR-REC709_BFD", O.TRANSFORM_DIR_INVERSE)


def ap0_op():
    return O.BuiltinTransform("ACEScg_to_ACES2065-1")


def range_op(high):
    return O.RangeTransform(minInValue=0., minOutValue=0., maxInValue=high, maxOutValue=high)


def ff(style, params, direction=O.TRANSFORM_DIR_FORWARD):
    t = O.FixedFunctionTransform(style, params, direction)
    t.validate()
    return t


def forward_jmh():
    return ff(O.FIXED_FUNCTION_ACES_RGB_TO_JMH_20, AP0_XY)


def tone_op():
    return ff(O.FIXED_FUNCTION_ACES_TONESCALE_COMPRESS_20, [PEAK])


def gamut_op():
    return ff(O.FIXED_FUNCTION_ACES_GAMUT_COMPRESS_20, [PEAK, *LIMIT_XY])


def inverse_op():
    return ff(O.FIXED_FUNCTION_ACES_RGB_TO_JMH_20, LIMIT_XY, O.TRANSFORM_DIR_INVERSE)


PREFIX = [input_op(), range_op(U), ap0_op()]
FULL_FF = ff(O.FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20, [PEAK, *LIMIT_XY])
FULL = proc(*PREFIX, FULL_FF, range_op(PEAK / 100))
SPLIT = proc(*PREFIX, forward_jmh(), tone_op(), gamut_op(), inverse_op(), range_op(PEAK / 100))
CPUS = {"AP1": cpu(input_op()), "range": cpu(range_op(U)), "AP0": cpu(ap0_op()),
        "JMh": cpu(forward_jmh()), "tone": cpu(tone_op()), "gamut": cpu(gamut_op()),
        "inverse": cpu(inverse_op()), "outputRange": cpu(range_op(PEAK / 100)), "fullFF": cpu(FULL_FF),
        "full": FULL.getDefaultCPUProcessor(), "split": SPLIT.getDefaultCPUProcessor()}


def frozen_assets():
    manifest = json.loads((FROZEN / "ARTIFACTS.json").read_text())
    for row in manifest["files"]:
        assert sha(FROZEN / row["file"]) == row["sha256"], row["file"]
    return {"manifestSHA256": sha(FROZEN / "ARTIFACTS.json"), "files": len(manifest["files"]), "allUnchanged": True}


def check(name, function):
    try:
        CHECKS.append({"name": name, "passed": True, "evidence": function()})
    except Exception as error:
        CHECKS.append({"name": name, "passed": False, "error": repr(error)})


check("original official oracle shader texture and report bytes remain frozen", frozen_assets)
profile = INDEX["sourceSnapshot"]["profiles"]["blue"]
definitions = [
    {"id": "bad-pure-blue-Y1", "input": [0., 0., 13.850415229797363], "frozenCaseID": "hue-blue-1", "definition": "exact supplied diagnostic Float32 pure-blue Y1 literal"},
    {"id": "actual-profile-blue-Y1", "input": profile, "frozenCaseID": "profile-blue-1", "definition": "frozen source-inputs production positive author blue profile at level1"},
    {"id": "green-18.28686", "input": [0., 18.28686, 0.], "frozenCaseID": None, "definition": "supplied diagnostic literal [0,Math.fround(18.28686),0]; not claimed to be an extracted old source pixel"},
]
samples = []
for row in definitions:
    x = vec(np.asarray(row["input"], dtype=np.float32))
    a1 = apply(CPUS["AP1"], x)
    a1r = apply(CPUS["range"], a1)
    a0 = apply(CPUS["AP0"], a1r)
    jmh = apply(CPUS["JMh"], a0)
    tone = apply(CPUS["tone"], jmh)
    gamut = apply(CPUS["gamut"], tone)
    inv = apply(CPUS["inverse"], gamut)
    full_ff = apply(CPUS["fullFF"], a0)
    full = apply(CPUS["full"], x)
    split = apply(CPUS["split"], x)
    serial = apply(CPUS["outputRange"], inv)
    full_serial = apply(CPUS["outputRange"], full_ff)
    samples.append({**row, "inputFloat32": x, "fullCPU": full, "splitCPU": split,
                    "fullSerialCPU": full_serial, "splitSerialCPU": serial,
                    "fullFFAfterSerialPrefixBeforeOutputRange": full_ff,
                    "splitMinusFull": [a - b for a, b in zip(split, full)],
                    "splitSerialMinusCombined": [a - b for a, b in zip(serial, split)],
                    "fullSerialMinusCombined": [a - b for a, b in zip(full_serial, full)],
                    "stages": {"AP1": a1, "AP1Range": a1r, "AP0": a0, "JMh": jmh,
                               "Jts": [tone[0], 0., 0.], "toneJMh": tone, "gamutJMh": gamut,
                               "inverseRGB": inv, "Aab": None, "inverseLMS": None,
                               "reach": None, "reachLookup": None, "cusp": None, "cuspLookup": None}})


def frozen_cpu_parity():
    rows = []
    for sample in samples:
        if not sample["frozenCaseID"]:
            continue
        old = next(r for r in ORACLE["samples"] if r["id"] == sample["frozenCaseID"])
        assert old["inputFloat32"] == sample["inputFloat32"]
        assert old["outputNormalized100Nit"] == sample["fullCPU"]
        assert old["AP1BeforeDomain"] == sample["stages"]["AP1"]
        assert old["AP1AfterDomain"] == sample["stages"]["AP1Range"]
        assert old["AP0ForFixedFunction"] == sample["stages"]["AP0"]
        rows.append({"sample": sample["id"], "oldCase": old["id"], "exactInputPrefixAndFullOutput": True})
    return rows


check("same Float32 blue samples prefix and fullCPU exactly reproduce frozen oracle", frozen_cpu_parity)


def values_and_units():
    for sample in samples:
        for value in [sample["inputFloat32"], sample["fullCPU"], sample["splitCPU"], *[v for v in sample["stages"].values() if v is not None]]:
            assert len(value) == 3 and all(math.isfinite(v) for v in value)
        for values in [sample["fullCPU"], sample["splitCPU"]]:
            assert all(0 <= v <= PEAK / 100 for v in values)
        assert 0 <= sample["stages"]["JMh"][2] <= 360
        assert sample["stages"]["Jts"] == [sample["stages"]["toneJMh"][0], 0., 0.]
    return {"displayRGBUnits": "numeric1=100nit", "hue": "degrees (not radians or turns)", "J_and_M": "official JMh correlates; not display nits", "allThreeSamplesFinite": True}


check("available public stages are finite and use declared hue display and JMh units", values_and_units)


def split_definition():
    group = SPLIT.createGroupTransform()
    styles = [str(t.getStyle()) for t in group if isinstance(t, O.FixedFunctionTransform)]
    assert len(styles) == 4
    return {"publicSplitFixedFunctions": styles, "combinedProcessorOperators": len(group),
            "deltasAreDiagnosticsNotGate": [{"sample": s["id"], "splitMinusFull": s["splitMinusFull"], "splitSerialMinusCombined": s["splitSerialMinusCombined"], "fullSerialMinusCombined": s["fullSerialMinusCombined"]} for s in samples]}


check("split uses four separate public FFs and preserves combined versus serial deltas", split_definition)


def environment():
    assert O.GetVersion() == "2.6.0"
    assert pathlib.Path(sys.prefix).resolve() == (ROOT / ".tools" / "aces2-oracle").resolve()
    return {"OCIO": O.GetVersion(), "NumPy": np.__version__, "executable": sys.executable}


check("existing isolated official environment reused with no new dependency or runtime edits", environment)
check("original asset seal still valid after all stage queries", frozen_assets)

report = {"schema": "glass-atoll.official-aces2-public-stage-cpu.v1", "dateUTC": datetime.now(timezone.utc).isoformat(),
          "peakNits": PEAK, "passed": all(c["passed"] for c in CHECKS), "counts": {"total": len(CHECKS), "passed": sum(c["passed"] for c in CHECKS)},
          "checks": CHECKS, "samples": samples, "AP1UpperFloat32": U,
          "fixedFunctionContracts": {"RGB_TO_JMH": {"style": "FIXED_FUNCTION_ACES_RGB_TO_JMH_20", "params": AP0_XY, "direction": "forward", "input": "AP0 scene-linear RGB", "output": "JMh with h in degrees"},
                                     "TONESCALE_CHROMA": {"style": "FIXED_FUNCTION_ACES_TONESCALE_COMPRESS_20", "params": [PEAK], "input": "JMh, h degrees", "output": "tone-mapped/chroma-compressed JMh; includes both tone and chroma"},
                                     "GAMUT": {"style": "FIXED_FUNCTION_ACES_GAMUT_COMPRESS_20", "params": [PEAK, *LIMIT_XY], "input": "toneJMh, h degrees", "output": "compressed JMh"},
                                     "INVERSE_CAM": {"style": "FIXED_FUNCTION_ACES_RGB_TO_JMH_20", "params": LIMIT_XY, "direction": "inverse", "input": "compressed JMh, h degrees", "output": "linear limiting709 RGB, numeric1=100nit"}},
          "frozenInputs": {"exportReportSHA256": sha(FROZEN / "export-report.json"), "CPUOracleSHA256": sha(FROZEN / "aces2-1270-cpu.json"), "assetSealSHA256": sha(FROZEN / "ARTIFACTS.json")},
          "scriptSHA256": sha(pathlib.Path(__file__)),
          "stageOracleScope": {"AP1_AP1Range_AP0": "separate official builtin/range CPU calls, exact frozen-prefix parity checked for two original blue cases",
                               "JMh_toneJMh_gamutJMh_inverseRGB": "public split FF serial applyRGB calls; not private fullCPU internal stages",
                               "Jts": "toneJMh[0] from public tonescale/chroma FF, vec3[Jts,0,0]; full CPU direct-A internal Jts unavailable",
                               "Aab_inverseLMS_reach_cusp": "null: no matching public stage API; GPU-only diagnostic values must not be called CPU oracle"},
          "notes": ["FullCPU is one original full output processor; splitCPU is one processor containing four public FF blocks plus same prefix and finalRange[0,12.7].",
                    "Serial stage calls make additional Float32 API boundaries; fullSerialCPU/splitSerialCPU preserve their endpoint effects separately.",
                    "Official full forward CPU applies tone directly from Aab[0]; public tonescale FF consumes JMh and follows a J route. Closeness alone does not uniquely prove the GPU mismatch cause.",
                    "Public h is degrees throughout; no manual degree/radian conversion occurs at FF boundaries. GPU-internal cosine/sine conversions remain official shader implementation details.",
                    "No private Aab/LMS reimplementation or self-authored ACES approximation is provided.",
                    "No original423 shader assets or52/53 evidence changed, no GPU/browser run or tolerance modification here."],
          "primarySources": ["https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/ops/fixedfunction/FixedFunctionOpCPU.cpp#L991",
                             "https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/ops/fixedfunction/FixedFunctionOpData.cpp#L655"]}
OUT.mkdir(parents=True, exist_ok=True)
json_write(OUT / "stage-report.json", report)
print(json.dumps({"passed": report["passed"], "counts": report["counts"], "failed": [c for c in CHECKS if not c["passed"]],
                  "samples": [{"id": s["id"], "fullCPU": s["fullCPU"], "splitCPU": s["splitCPU"], "splitMinusFull": s["splitMinusFull"]} for s in samples]}, indent=2))
sys.exit(0 if report["passed"] else 1)
