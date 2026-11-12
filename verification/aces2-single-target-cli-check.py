"""Bounded offline regression of the single-peak CLI; no GL or runtime writes."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
CLI = ROOT / "tools/export-aces2-target.py"
spec = importlib.util.spec_from_file_location("single_peak_cli", CLI)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sha = lambda data: hashlib.sha256(data).hexdigest()
checks = []
initial = module.file_inventory(module.ORACLE)


def check(name, fn):
    try:
        evidence = fn()
        checks.append({"name": name, "passed": True, "evidence": evidence})
    except Exception as error:
        checks.append({"name": name, "passed": False, "error": repr(error)})


def require(condition, message="assertion failed"):
    if not condition:
        raise AssertionError(message)


def rejects(fn, values):
    for value in values:
        try:
            fn(value)
        except (ValueError, module.argparse.ArgumentTypeError):
            continue
        raise AssertionError(f"Should reject {value!r}")
    return {"rejected": len(values)}


def run(args, code=0):
    result = subprocess.run([sys.executable, str(CLI), *args], cwd=ROOT, capture_output=True, text=True)
    require(result.returncode == code, result.stderr or result.stdout)
    return json.loads(result.stdout) if code == 0 else {"exit": result.returncode, "reason": result.stderr.strip()}


def valid_values():
    for n in (100, 700, 1200, 1270, 10000):
        require(module.peak_arg(str(n)) == n)
    return {"accepted": [100, 700, 1200, 1270, 10000]}


def paths():
    for p in (".cache/aces2-targets/unit", "vendor/aces2-generated/unit", "verification/aces2-generated-1200"):
        require(module.checked_output(p, 1200).is_relative_to(ROOT))
    return {"allowedRoots": 3}


check("integer peak boundaries and native/manual targets", valid_values)
check("fractional nonfinite exponential signed and outofrange peak reject", lambda: rejects(module.peak_arg,
      ["99", "10001", "1200.0", "NaN", "inf", "1e3", "-700", "", " 700", "700 "]))
check("only fixed project cache vendor-generated or exact QA output accepted", paths)
check("protected old oracle project root outside and normalized escape reject", lambda: rejects(
    lambda p: module.checked_output(p, 1200), [str(ROOT), "verification/aces2-oracle", str(ROOT.parent / "bad"),
    "verification", "verification/aces2-generated-700", "vendor/aces2-generated/..", ".cache/aces2-targets/unit/../../.."]))
check("default refuses overwrite of existing1200 package", lambda: run(
    ["--peak", "1200", "--out", "verification/aces2-generated-1200"], 1))
check("argparse rejects fractional peak before publication", lambda: run(
    ["--peak", "1200.5", "--out", ".cache/aces2-targets/never-fractional"], 2))
check("historical output path rejected by CLI", lambda: run(
    ["--peak", "1200", "--out", "verification/aces2-oracle"], 1))
check("1200 complete package reproducible byteforbyte", lambda: run(
    ["--peak", "1200", "--out", "verification/aces2-generated-1200", "--verify"]))
known = ROOT / ".cache/aces2-targets/cli-known-700"
check("700 compatibility package regenerates deterministically", lambda: run(
    ["--peak", "700", "--out", str(known)] + (["--verify"] if known.exists() else [])))


def same_files(files, reference):
    evidence = []
    for name in files:
        a, b = (known / name).read_bytes(), (reference / name).read_bytes()
        require(a == b, name + " differs")
        evidence.append({"file": name, "bytes": len(a), "sha256": sha(a)})
    return evidence


check("700 official served shader and probe exactly match frozen originals", lambda: same_files(
    ["aces2-700-official.glsl", "aces2-700-probe.frag"], module.ORACLE))
check("700 both raw and RGBA-upload hue tables exactly match originals", lambda: same_files(
    [f"aces2-700-table-{i}-{suffix}.f32" for i in (0, 1) for suffix in ("raw", "rgba")], module.ORACLE))
check("700 rounded GPU input and official CPU expected bytes unchanged", lambda: same_files(
    ["aces2-700-gpu-input.f32", "aces2-700-cpu-expected.f32"], module.ORACLE))
check("700 explicit atan candidate and probe exactly match accepted candidate assets", lambda: same_files(
    ["aces2-700-accurate-atan.glsl", "aces2-700-accurate-atan-probe.frag"], ROOT / "verification/aces2-atan-candidate"))


def values():
    new = json.loads((known / "aces2-700-cpu.json").read_bytes())["samples"]
    old = json.loads((module.ORACLE / "aces2-700-cpu.json").read_bytes())["samples"]
    keys = ["inputFloat32", "AP1BeforeDomain", "AP1AfterDomain", "AP0ForFixedFunction",
            "unclampedFixedFunctionWithoutInputDomain", "fixedFunctionAfterDomainBeforeOutputRange",
            "outputNormalized100Nit", "outputNits", "browserLinearAtWhite280", "browserEncodedSRGBAtWhite280"]
    require(len(new) == len(old) == 963)
    for a, b in zip(new, old):
        require(a["id"] == b["id"] and all(a[k] == b[k] for k in keys), a["id"])
    return {"samples": len(new), "fieldsPerSample": len(keys)}


check("all963 known700 CPU stage and display values remain exact", values)
package = ROOT / "verification/aces2-generated-1200"


def sealed():
    manifest = json.loads((package / "ARTIFACTS.json").read_bytes())
    for row in manifest["files"]:
        data = (package / row["file"]).read_bytes()
        require(len(data) == row["bytes"] and sha(data) == row["sha256"], row["file"])
    require(len(manifest["files"]) + 1 == len(module.file_inventory(package)))
    return {"sealedFiles": len(manifest["files"]), "manifestSHA256": sha((package / "ARTIFACTS.json").read_bytes())}


def labelled():
    official = json.loads((package / "export-report.json").read_bytes())
    candidate = json.loads((package / "candidate-export-report.json").read_bytes())
    oracle = json.loads((package / "aces2-1200-cpu.json").read_bytes())
    require(official["actualGPU"] is False and official["productionIntegrated"] is False)
    require(candidate["candidate"]["nonOfficial"] is True and candidate["candidate"]["inverseExact"] is True)
    require(candidate["targets"][0]["cpuOracleFile"] == official["targets"][0]["cpuOracleFile"])
    gray = next(r for r in oracle["samples"] if r["family"] == "black-grey-white-ramp" and r["level"] == .18)
    return {"CPU": official["counts"], "actualGPU": False, "productionIntegrated": False,
            "gray18OutputNits": gray["outputNits"], "candidateVersion": candidate["candidate"]["version"]}


check("1200 every generated asset matches sealed actual byte hashes", sealed)
check("official and nonofficial candidate distinction and noGPU status explicit", labelled)
check("all47 old official files unchanged including original46file seal", lambda: (
    require(module.file_inventory(module.ORACLE) == initial), {"unchangedActualFiles": len(initial)})[1])
report = {"schema": "glass-atoll.single-peak-aces2-cli-QA.v1", "passed": all(r["passed"] for r in checks),
          "actualGPU": False, "productionIntegrated": False, "scriptSHA256": sha(CLI.read_bytes()),
          "checks": checks, "counts": {"passed": sum(r["passed"] for r in checks), "total": len(checks)}}
path = ROOT / "verification/aces2-single-target-cli-check.json"
path.write_bytes(module.json_bytes(report))
print(json.dumps({"passed": report["passed"], "counts": report["counts"],
                  "failures": [c for c in checks if not c["passed"]], "report": str(path)}, indent=2))
sys.exit(0 if report["passed"] else 1)
