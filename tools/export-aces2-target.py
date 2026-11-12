"""Export one pinned OCIO target without importing the old exporting module.

Run with the project .tools/aces2-oracle Python; never installs dependencies.
Only new, approved project output directories may be published. --verify
regenerates privately and compares every output byte with an existing package.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
ORACLE = ROOT / "verification/aces2-oracle"
CORE_SHA = "f0fcdd7629964d612b4805604bbbd9559b0fcf04129a104040ffccb7cf230a2c"
ATAN_SHA = "565860bc7bbb5a1f9b4cce3e53609a311fe260e14dd2968ef28533dfbfa30d19"
INPUT_SHA = "fa82b382df34da9b22805bb823c446dd56f6f9e4cd06d02b77d6286ad3184474"
REC709 = (.64, .33, .30, .60, .15, .06, .3127, .329)
CORE_FUNCTIONS = (
    "vector", "safe_vector", "classification", "processor", "input_transform",
    "to_ap0", "upper", "range_transform", "fixed", "chain", "apply",
    "build_inputs", "encode_srgb", "export_gpu",
)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def json_bytes(value) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def write_json(path, value):
    Path(path).write_bytes(json_bytes(value))


def peak_arg(value):
    if not re.fullmatch(r"[0-9]+", value) or not 100 <= int(value) <= 10000:
        raise argparse.ArgumentTypeError("peak must be an integer in100..10000")
    return int(value)


def checked_output(value, peak):
    target = (Path(value) if Path(value).is_absolute() else ROOT / value).resolve()
    allowed = [(ROOT / ".cache/aces2-targets").resolve(),
               (ROOT / "vendor/aces2-generated").resolve()]
    explicit_qa = (ROOT / f"verification/aces2-generated-{peak}").resolve()
    if not target.is_relative_to(ROOT) or not (
        target == explicit_qa or any(target.is_relative_to(p) and target != p for p in allowed)
    ):
        raise ValueError("--out requires a child of .cache/aces2-targets or vendor/aces2-generated, "
                         "or the exact verification/aces2-generated-<peak> QA directory")
    return target


def file_inventory(directory):
    return {str(p.relative_to(directory)).replace("\\", "/"): sha(p.read_bytes())
            for p in sorted(directory.rglob("*")) if p.is_file()}


def dependency_gate():
    expected = (ROOT / ".tools/aces2-oracle").resolve()
    if Path(sys.prefix).resolve() != expected:
        raise RuntimeError("Use .tools/aces2-oracle/Scripts/python.exe; global Python is not supported")
    import PyOpenColorIO as ocio
    import numpy as np
    if ocio.GetVersion() != "2.6.0" or np.__version__ != "2.3.4":
        raise RuntimeError("Pinned OpenColorIO2.6.0 and NumPy2.3.4 are required; no automatic installation")
    return ocio, np


def core_namespace(out, ocio, np):
    """Execute selected *definitions only*, never the frozen module's loops.

    The complete source hash is pinned. Parsing FunctionDef nodes prevents its
    top-level three-target export/sys.exit from touching historical assets.
    """
    source = (ORACLE / "export_oracle.py").read_bytes()
    if sha(source) != CORE_SHA:
        raise RuntimeError("Frozen exporter source seal changed; review rather than silently using a new core")
    inputs_raw = (ORACLE / "source-inputs.json").read_bytes()
    if sha(inputs_raw) != INPUT_SHA:
        raise RuntimeError("Frozen actual-profile input snapshot seal changed")
    inputs = json.loads(inputs_raw)
    tree = ast.parse(source.decode("utf-8"))
    defs = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in CORE_FUNCTIONS]
    if {n.name for n in defs} != set(CORE_FUNCTIONS):
        raise RuntimeError("Pinned core function set is incomplete")
    ns = {"__builtins__": __builtins__, "math": math, "np": np, "OCIO": ocio,
          "OUT": out, "ROOT": ROOT, "INPUTS": inputs, "REC709": REC709,
          "WEIGHTS": (.2126, .7152, .0722), "CONFIG": ocio.Config.CreateRaw(),
          "INPUT_BUILTIN": "UTILITY - ACES-AP1_to_LINEAR-REC709_BFD",
          "AP1_AP0_BUILTIN": "ACEScg_to_ACES2065-1", "digest": sha, "write_json": write_json}
    exec(compile(ast.Module(body=defs, type_ignores=[]), "pinned_aces2_definitions", "exec"), ns)
    ns["AP1"] = ns["processor"]([ns["input_transform"]()]).getDefaultCPUProcessor()
    ns["AP1_INVERSE"] = ns["processor"]([
        ocio.BuiltinTransform(ns["INPUT_BUILTIN"])
    ]).getDefaultCPUProcessor()
    ns["AP0"] = ns["processor"]([ns["to_ap0"]()]).getDefaultCPUProcessor()
    return ns, inputs


def atan_candidate(original):
    source = (ROOT / "verification/aces2-atan-math.js").read_bytes()
    if sha(source) != ATAN_SHA:
        raise RuntimeError("Frozen accurate-atan math source seal changed")
    match = re.search(r"export const ACCURATE_ATAN2_GLSL=`(.*?)`;", source.decode("utf-8"), re.S)
    if not match or "${" in match[1]:
        raise RuntimeError("Expected one literal accurate-atan GLSL export")
    prefix = match[1] + "\n"
    old, new = "atan(Aab.b, Aab.g)", "qaAccurateAtan2(Aab.b, Aab.g)"
    if original.count(old) != 1 or new in original:
        raise RuntimeError("Official shader must contain exactly one untouched atan anchor")
    candidate = prefix + original.replace(old, new)
    if candidate[len(prefix):].replace(new, old) != original:
        raise RuntimeError("Candidate does not invert exactly to the official export")
    return candidate, {"version": "range-reduced-taylor17-v1", "nonOfficial": True,
                       "productionIntegrated": False, "mathSHA256": ATAN_SHA,
                       "prefixSHA256": sha(prefix.encode()), "replacement": {"from": old, "to": new, "count": 1},
                       "inverseExact": True}


def generate(out, peak, ocio, np):
    checks = []

    def check(name, condition, evidence=None):
        if not condition:
            raise AssertionError(name)
        checks.append({"name": name, "passed": True, "evidence": evidence})

    ns, inputs = core_namespace(out, ocio, np)
    apply, vector = ns["apply"], ns["vector"]
    full = ns["chain"](peak)
    cpu = full.getDefaultCPUProcessor()
    raw = ns["chain"](peak, domain=False, display_clamp=False).getDefaultCPUProcessor()
    pre_output = ns["chain"](peak, display_clamp=False).getDefaultCPUProcessor()
    domain = ns["processor"]([ns["input_transform"](), ns["range_transform"](ns["upper"](peak))]).getDefaultCPUProcessor()
    rows = []
    for sample in ns["build_inputs"](peak):
        rgb = vector(np.asarray(sample["input"], dtype=np.float32))
        ap1, clipped = apply(ns["AP1"], rgb), apply(domain, rgb)
        mapped, bare, ff = apply(cpu, rgb), apply(raw, rgb), apply(pre_output, rgb)
        rows.append({**sample, "inputFloat32": rgb,
                     "inputDomainLabel": "deliberately-signed-or-domain-stress" if sample["family"] in (
                         "negative-and-exposed-domain-stress", "AP1-domain-boundary") else "nonnegative-scene-linear",
                     "AP1BeforeDomain": ns["safe_vector"](ap1), "AP1AfterDomain": ns["safe_vector"](clipped),
                     "domainChanged": ap1 != clipped, "AP0ForFixedFunction": ns["safe_vector"](apply(ns["AP0"], clipped)),
                     "unclampedFixedFunctionWithoutInputDomain": ns["safe_vector"](bare),
                     "rawClassification": ns["classification"](bare),
                     "fixedFunctionAfterDomainBeforeOutputRange": ns["safe_vector"](ff),
                     "preOutputRangeClassification": ns["classification"](ff),
                     "outputNormalized100Nit": mapped, "outputNits": [x * 100 for x in mapped],
                     "browserLinearAtWhite280": [x * 100 / 280 for x in mapped],
                     "browserEncodedSRGBAtWhite280": [ns["encode_srgb"](x * 100 / 280) for x in mapped]})
    check("963 explicitly Float32 inputs preserve the frozen sixhue fiveprofile domain dataset", len(rows) == 963)
    check("complete declared wrapper finite nonnegative within target", all(
        math.isfinite(x) and 0 <= x <= peak / 100 + 1e-6 for row in rows for x in row["outputNormalized100Nit"]))
    check("bare and preRange classifications retained separately", all(
        "rawClassification" in r and "preOutputRangeClassification" in r for r in rows))
    for channel in range(3):
        for value in (math.nan, math.inf, -math.inf):
            v = [0., 0., 0.]
            v[channel] = value
            try:
                apply(cpu, v)
            except ValueError:
                continue
            raise AssertionError("Nonfinite C++ input was not rejected")
    check("NaN and infinities rejected before native FF", True)
    width, height = 64, math.ceil(len(rows) / 64)
    input_pixels = np.zeros((width * height, 4), dtype="<f4")
    expected_pixels = np.zeros_like(input_pixels)
    input_pixels[:, 3] = expected_pixels[:, 3] = 1
    input_pixels[:len(rows), :3] = [r["inputFloat32"] for r in rows]
    expected_pixels[:len(rows), :3] = [r["outputNormalized100Nit"] for r in rows]
    input_file, expected_file = f"aces2-{peak}-gpu-input.f32", f"aces2-{peak}-cpu-expected.f32"
    input_bytes, expected_bytes = input_pixels.tobytes(), expected_pixels.tobytes()
    (out / input_file).write_bytes(input_bytes)
    (out / expected_file).write_bytes(expected_bytes)
    pattern = {"width": width, "height": height, "samples": len(rows), "paddedPixels": width * height - len(rows),
               "stride": 4, "dtype": "float32 little-endian RGBA", "inputFile": input_file,
               "inputSHA256": sha(input_bytes), "expectedFile": expected_file, "expectedSHA256": sha(expected_bytes),
               "inputRounding": "explicit float32 before all CPU calls; same uploaded values",
               "layout": "row-major flipYfalse; readPixels bottom-row equals texture row0; opaque black padding"}
    oracle = {"schema": "glass-atoll.official-aces2-cpu-oracle.v1", "peakNits": peak, "params": [peak, *REC709],
              "library": {"name": "OpenColorIO", "version": ocio.GetVersion()},
              "AP1UpperFloat32": ns["upper"](peak), "gpuPattern": pattern,
              "wrapperPolicy": "official highlevel AP1 input-domain and display-output range; bare FF retained separately",
              "inputUnits": "already exposed scene-linear709 D65; no C/P in function; author-relative scene light",
              "outputUnits": "linear display709 numeric1=100nit; browser white conversion/OETF separate",
              "sourceSnapshot": inputs, "sourceSnapshotPolicy": "Frozen historical author profiles; not a live source or visual acceptance claim",
              "sampleCount": len(rows), "samples": rows,
              "bareFunctionNonFiniteChannels": sum(r["rawClassification"]["nan"] + r["rawClassification"]["inf"] for r in rows),
              "bareFunctionNegativeChannels": sum(r["rawClassification"]["negativeFinite"] for r in rows),
              "samplesChangedByDeclaredInputDomain": sum(r["domainChanged"] for r in rows)}
    cpu_file = f"aces2-{peak}-cpu.json"
    write_json(out / cpu_file, oracle)
    entry = {**ns["export_gpu"](peak, full), "cpuOracleFile": cpu_file, "gpuPattern": pattern}
    check("two363x1 nearest Float32 tables no3DLUT or dynamicuniform", entry["textures3D"] == 0 and
          entry["officialDynamicUniforms"] == 0 and len(entry["textures2D"]) == 2 and all(
              t["width"] == 363 and t["height"] == 1 and "NEAREST" in t["interpolation"] for t in entry["textures2D"]))
    official = (out / entry["functionFile"]).read_bytes()
    probe = (out / entry["probeFragmentFile"]).read_bytes()
    check("served official GLSL LF bytes match shader hashes", sha(official) == entry["functionSHA256"] and
          sha(probe) == entry["probeFragmentSHA256"] and b"\r" not in official and b"\r" not in probe)
    for t in entry["textures2D"]:
        check(f"table{t['index']} bytehashes and all upload values finite", sha((out / t["rawFile"]).read_bytes()) == t["rawSHA256"] and
              sha((out / t["rgbaUploadFile"]).read_bytes()) == t["rgbaSHA256"] and
              bool(np.isfinite(np.frombuffer((out / t["rgbaUploadFile"]).read_bytes(), dtype="<f4")).all()))
    check("CPU inputexpected texture rows bitexact with oracle", all(
        vector(input_pixels[i, :3]) == r["inputFloat32"] and vector(expected_pixels[i, :3]) == r["outputNormalized100Nit"]
        for i, r in enumerate(rows)))
    white = apply(ns["AP1"], [1, 1, 1])
    examples = [[.12, .33, .71], [1, .1, 0], [0, 0, 5], [100, 40, 2], [-.1, .3, .7]]
    errors = [max(abs(a - b) for a, b in zip(x, apply(ns["AP1_INVERSE"], apply(ns["AP1"], x)))) / max(1, *map(abs, x)) for x in examples]
    check("Bradford direction white and five nonneutral roundtrips", max(abs(v - 1) for v in white) < 2e-6 and max(errors) < 3e-6,
          {"white": white, "maximumRelativeScaledRoundtripError": max(errors)})
    check("browser nits scale inverts no hidden80 or paperwhite factor", all(
        n == v * 100 and b == n / 280 for row in rows for n, v, b in zip(
            row["outputNits"], row["outputNormalized100Nit"], row["browserLinearAtWhite280"])))
    # A second independent native processor instance must reproduce every F32 output.
    repeat_cpu = ns["chain"](peak).getDefaultCPUProcessor()
    check("second native processor reproduces963 CPU results exactly", all(
        apply(repeat_cpu, r["inputFloat32"]) == r["outputNormalized100Nit"] for r in rows))
    candidate, candidate_meta = atan_candidate(official.decode("utf-8"))
    candidate_function = f"aces2-{peak}-accurate-atan.glsl"
    candidate_probe = f"aces2-{peak}-accurate-atan-probe.frag"
    (out / candidate_function).write_bytes(candidate.encode())
    probe_text = probe.decode("utf-8")
    check("official probe embeds complete exported function exactly once", probe_text.count(official.decode()) == 1)
    (out / candidate_probe).write_bytes(probe_text.replace(official.decode(), candidate).encode())
    check("candidate exactly reverses one atan replacement only", candidate_meta["inverseExact"])
    candidate_entry = {**entry, "functionFile": candidate_function, "functionSHA256": sha(candidate.encode()),
                       "functionCharacters": len(candidate), "probeFragmentFile": candidate_probe,
                       "probeFragmentSHA256": sha((out / candidate_probe).read_bytes()),
                       "algorithm": "Explicit non-official generic accurate-atan candidate; all other official expressions and tables unchanged"}
    (out / "OCIO-LICENSE.txt").write_bytes((ORACLE / "OCIO-LICENSE.txt").read_bytes())
    (out / "source-inputs.json").write_bytes((ORACLE / "source-inputs.json").read_bytes())
    meta = {"schema": "glass-atoll.official-aces2-export.v1", "passed": True,
            "actualGPU": False, "productionIntegrated": False,
            "counts": {"passed": len(checks), "total": len(checks)}, "checks": checks,
            "OCIOVersion": ocio.GetVersion(), "NumPyVersion": np.__version__,
            "scriptSHA256": sha(Path(__file__).read_bytes()), "sourceInputSHA256": INPUT_SHA,
            "sourceSnapshot": inputs, "targets": [entry],
            "provenance": {"core": "verification/aces2-oracle/export_oracle.py", "coreSHA256": CORE_SHA,
                           "coreExecution": "only pinned FunctionDef nodes; no old top-level export/import/exit executed",
                           "python": "project-local .tools/aces2-oracle, no global install",
                           "reproducibility": "no generation timestamp or output-directory-dependent content"},
            "limitations": ["CPU export only; target not GPU admitted, not production imported or visually approved",
                            "Official raw and declared Range policies retained separately",
                            "Old GPU helper423 restricts target list100/700/1270; new1200 requires an explicit separate target-capable probe, not silently changing old gates",
                            "Outputnits are target reference units, not measured panel light; no C/P/source changes"]}
    write_json(out / "export-report.json", meta)
    write_json(out / "candidate-export-report.json", {**meta, "targets": [candidate_entry],
               "candidate": {**candidate_meta, "officialFunctionFile": entry["functionFile"],
                             "officialFunctionSHA256": entry["functionSHA256"],
                             "colourGateUnchanged": {"absolute": 2e-5, "relative": 2e-4},
                             "scope": "Explicit non-official atan variant, same CPU oracle and tables; not OCIO certification"}})
    readme = f"""# {peak}nit 单目标离线资源（未GPU准入）

OpenColorIO2.6.0 / NumPy2.3.4，项目独立venv；运行时未引用。official与accurate-atan候选分别由export-report.json及candidate-export-report.json描述。后者是明确非官方数值替换，不是官方认证；两者共用963组显式Float32输入、官方CPU期望及两张363×1原表。

输入已施曝光的linear709/D65；输出display-linear709数值1=100nit。HDR浏览器线性值为输出×100/browserSDRWhiteNits，再一次extended-sRGB OETF。不能再加C/P、旧ACES、纸白乘数或80nit因子。目标peak已写进代码及表，不是独立uniform。

表上传RGBA32F/NEAREST/CLAMP_TO_EDGE，无mip、NoColorSpace、flipY=false；shader采样器highp。CPU报告保留裸FF/域限制前后，不以最终clamp冒充原结果。实际nits不是光度计测量。

生成命令（项目根）：

    .\\.tools\\aces2-oracle\\Scripts\\python.exe tools/export-aces2-target.py --peak {peak} --out verification/aces2-generated-{peak}

重现/校验现包（不覆盖）：同命令追加 --verify。默认拒绝覆盖；仅允许指定项目缓存/vendor-generated子树或精确QA目录。ARTIFACTS.json封存所有其他文件的实际bytes/SHA256；自身hash由CLI stdout给出。输出不含生成时间，重复生成应逐字节一致。

原423 GPU helper只接100/700/1270，不能直接传{peak}而声称已跑通。下轮应使用显式支持该单目标的新probe、保留原门与原报告；先RGBA32F oracle，再F16/桥/实际场景/成本。工程门2e-5+2e-4 relative与官方abs2e-5 diagnostic分开；本CPU通过不代替任何GPU或观感结果。
"""
    (out / "README.md").write_bytes(readme.encode("utf-8"))
    files = [{"file": str(p.relative_to(out)).replace("\\", "/"), "bytes": p.stat().st_size,
              "sha256": sha(p.read_bytes())} for p in sorted(out.iterdir()) if p.is_file()]
    write_json(out / "ARTIFACTS.json", {"schema": "glass-atoll.single-peak-aces2-seal.v1",
               "peakNits": peak, "actualGPU": False, "files": files})
    return meta, candidate_meta


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--peak", type=peak_arg, required=True)
    parser.add_argument("--out", default=None)
    parser.add_argument("--verify", action="store_true", help="regenerate and bytecompare existing package; never overwrite")
    args = parser.parse_args()
    out = checked_output(args.out or f".cache/aces2-targets/ocio2.6.0-rec709-atan17/peak-{args.peak}", args.peak)
    if out.exists() and not args.verify:
        raise FileExistsError("Output exists; --verify compares it without overwriting")
    if args.verify and (not out.is_dir() or not (out / "ARTIFACTS.json").is_file()):
        raise FileNotFoundError("--verify requires an existing complete package")
    ocio, np = dependency_gate()
    frozen_before = file_inventory(ORACLE)
    out.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".aces2-export-", dir=out.parent)).resolve()
    # Recursive cleanup is permitted only for this verified workspace child.
    if not temporary.is_relative_to(ROOT) or temporary.parent != out.parent.resolve() or not temporary.name.startswith(".aces2-export-"):
        raise RuntimeError("Unsafe temporary directory")
    try:
        meta, candidate = generate(temporary, args.peak, ocio, np)
        if file_inventory(ORACLE) != frozen_before:
            raise RuntimeError("Historical official asset inventory changed during generation; package not published")
        if args.verify:
            expected, actual = file_inventory(out), file_inventory(temporary)
            if expected != actual:
                changed = sorted(k for k in expected.keys() | actual.keys() if expected.get(k) != actual.get(k))
                raise RuntimeError("Reproduction mismatch: " + ", ".join(changed))
        else:
            if out.exists():
                raise FileExistsError("Output appeared concurrently; refusing overwrite")
            os.rename(temporary, out)
        manifest = (out / "ARTIFACTS.json").read_bytes()
        print(json.dumps({"passed": True, "mode": "verified-byteexact" if args.verify else "generated",
                          "peakNits": args.peak, "output": str(out), "cpu": meta["counts"],
                          "sampleCount": 963, "actualGPU": False, "productionIntegrated": False,
                          "candidateInverseExact": candidate["inverseExact"],
                          "historicalAssetsUnchanged": len(frozen_before),
                          "artifactManifestSHA256": sha(manifest)}, indent=2))
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ACES2 export failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
