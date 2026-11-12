"""Independent saved-evidence audit. No replay, optical solve, renderer or GPU."""
import hashlib
import json
import math
import struct
from pathlib import Path

HERE = Path(__file__).resolve().parent
read = lambda name: json.loads((HERE / name).read_text(encoding="utf-8"))
digest = lambda name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
browser = read("r30-browser-native-cpu-diagnostic.json")
node = read("r30-native-replay-node-diagnostic.json")
fixture = read("r30-native-replay-fixture.json")
checks = []


def test(name, fn):
    try:
        checks.append({"name": name, "passed": True, "evidence": fn()})
    except Exception as exc:
        checks.append({"name": name, "passed": False, "error": str(exc)})


def bits(value):
    return struct.pack(">d", float(value)).hex()


def audit_boundary():
    first = read("baselines/r30-first-browser-cpu-stop/r30-fresh-scene-actual-gpu.json")
    assert digest("baselines/r30-first-browser-cpu-stop/r30-fresh-scene-actual-gpu.json") == "abfdd23313378bbf071589ea9d4c8e4c917854091da02827c601b28a3b3785c2"
    assert not first["actualGPU"] and not first["passed"]
    assert first["actualDraws"] == first["renderCalls"] == 0 and not first["timedIntervals"]
    assert first["restoration"] is None
    for key, value in {"actualGPU": False, "diagnosticOnly": True, "admission": False, "toleranceChanged": False,
                       "verificationBoundaryCaptured": True, "strictReplayPassed": False, "ownedReplayDisposed": True,
                       "sceneObjectsPublished": False, "forbiddenRendererCalls": 0, "originalSceneUntouched": True}.items():
        assert browser[key] == value, key
    assert browser["strictError"]["message"] == "Physical number mismatch: snapshot.packets.10.mean.0"
    assert node["strictReplayPassed"] and node["ownedReplayDisposed"] and not node["actualGPU"]
    return {"firstFailurePreserved": True, "firstExperimentalDraws": 0, "diagnosticNativeCalls": 0,
            "browserStrictFailed": True, "nodeStrictPassed": True, "reportedDisposed": True}


def audit_full_values():
    actual, expected = browser["actual"]["snapshot"], fixture["expected"]["snapshot"]
    reported = {item["path"]: item for item in browser["comparison"]["snapshot"]["numericDifferences"]}
    assert len(reported) == len(browser["comparison"]["snapshot"]["numericDifferences"])
    found = {}
    totals = {"numbers": 0, "exactNumbers": 0, "nonNumericValues": 0}
    groups = {"mean": [], "covariance": [], "buoyantVelocity": []}

    def walk(a, e, path="snapshot"):
        if isinstance(e, (int, float)) and not isinstance(e, bool):
            assert isinstance(a, (int, float)) and not isinstance(a, bool), path
            totals["numbers"] += 1
            assert math.isfinite(a) and math.isfinite(e), path
            if bits(a) == bits(e):
                totals["exactNumbers"] += 1
                return
            assert path in reported, path
            item = reported[path]
            assert item["actualHex64"] == bits(a) and item["expectedHex64"] == bits(e), path
            assert item["absoluteError"] == abs(a - e), path
            found[path] = item
            parts = path.split(".")
            assert parts[0:2] == ["snapshot", "packets"] and parts[2].isdigit(), path
            if len(parts) == 5 and parts[3] in ("mean", "covariance"):
                groups[parts[3]].append(item)
            elif len(parts) == 4 and parts[3] == "buoyantVelocity":
                groups["buoyantVelocity"].append(item)
            else:
                raise AssertionError("Unexpected differing field " + path)
        elif isinstance(e, dict):
            assert isinstance(a, dict) and set(a) == set(e), path
            for key in e:
                walk(a[key], e[key], path + "." + key)
        elif isinstance(e, list):
            assert isinstance(a, list) and len(a) == len(e), path
            for i, value in enumerate(e):
                walk(a[i], value, path + "." + str(i))
        else:
            totals["nonNumericValues"] += 1
            assert type(a) == type(e) and a == e, path

    walk(actual, expected)
    assert set(found) == set(reported)
    assert totals["numbers"] == 41439 and totals["exactNumbers"] == 25107
    assert {k: len(v) for k, v in groups.items()} == {"mean": 4539, "covariance": 11791, "buoyantVelocity": 2}
    assert browser["comparison"]["snapshot"]["structuralDifferenceCount"] == 0
    evidence = {"allFieldsHexVerified": True, "numericFields": totals["numbers"], "exactNumericFields": totals["exactNumbers"],
                "differingNumericFields": len(found), "allOtherNumericAndCategoricalFieldsExact": True, "nonfinite": 0}
    evidence["groups"] = {key: {"differences": len(items), "maxAbsolute": max(x["absoluteError"] for x in items),
                               "maxRelative": max(x["relativeError"] for x in items),
                               "maxULP": str(max(int(x["ulpDistance"]) for x in items))} for key, items in groups.items()}
    return evidence


def audit_discrete_material():
    a, e = browser["actual"]["snapshot"], fixture["expected"]["snapshot"]
    for key in a.keys() - {"packets"}:
        assert a[key] == e[key], key
    for p, q in zip(a["packets"], e["packets"]):
        for key in p.keys() - {"mean", "covariance", "buoyantVelocity"}:
            assert p[key] == q[key], (p["id"], key)
    assert a["ledger"] == e["ledger"]
    ledger = browser["actual"]["ledger"]
    expected = fixture["expected"]["ledger"]
    for key in ["schema", "count", "stride", "capacity", "time", "rawPerCandela", "units", "groups", "dataWordsU32"]:
        assert ledger[key] == expected[key], key
    assert ledger["version"] == ledger["recordGeneration"] == 1
    assert browser["actual"]["publicFireworkDiagnostics"]["records"] == 1420
    assert browser["comparison"]["ledger"]["exact"] and browser["comparison"]["ledger"]["numericFields"] == 11208
    return {"packetsAndOrderedIDs": 2301, "validLedgerRows": 1399, "physicalRecords": 1420,
            "allMaterialFieldsExact": True, "allNonContinuousSnapshotFieldsExact": True,
            "ledgerNumericFieldsExact": 11208, "independentLedgerGeneration": 1}


def audit_packs():
    out = []
    for key in ["sourceTDensity", "lightPackets", "fullValidLedger"]:
        b = browser["packing"][key]
        n = node["packing"][key]
        items = zip(b, n) if isinstance(b, list) else [(b, n)]
        for actual, expected in items:
            assert actual["actualWordsU32"] == expected["actualWordsU32"], key
            assert actual["differenceCount"] == expected["differenceCount"] == 0
            assert len(actual["actualWordsU32"]) == actual["comparedWords"]
            out.append({"kind": key + ("-" + actual["kind"] if "kind" in actual else ""), "identicalWords": actual["comparedWords"]})
    assert [x["identicalWords"] for x in out] == [65536, 65536, 9204, 11192]
    return {"derivedInputs": out, "tDensityOnly": True, "sourceRayPackProduced": False,
            "volumeBufferOrImageIdentityProved": False, "physicalBinary64IdentityProved": False}


def audit_covariance():
    actual, expected = browser["actual"]["snapshot"]["packets"], fixture["expected"]["snapshot"]["packets"]
    minimum_pivot, max_relative_matrix = math.inf, 0
    for packet, reference in zip(actual, expected):
        for p in [packet, reference]:
            c = p["covariance"]
            assert c[1] == c[3] and c[2] == c[6] and c[5] == c[7]
            l00 = math.sqrt(c[0]); l10 = c[3] / l00; l20 = c[6] / l00
            d1 = c[4] - l10*l10; assert d1 > 0
            l11 = math.sqrt(d1); l21 = (c[7] - l20*l10) / l11
            d2 = c[8] - l20*l20 - l21*l21; assert d2 > 0
            minimum_pivot = min(minimum_pivot, c[0], d1, d2)
        c, r = packet["covariance"], reference["covariance"]
        norm = max(sum(abs(r[3*i+j]) for j in range(3)) for i in range(3))
        delta = max(sum(abs(c[3*i+j]-r[3*i+j]) for j in range(3)) for i in range(3))
        max_relative_matrix = max(max_relative_matrix, delta/norm)
    return {"matricesCholeskyChecked": len(actual)*2, "nonSPD": 0, "symmetryExact": True,
            "minimumComputedCholeskyPivot": minimum_pivot, "maxInfinityNormRelativeMatrixDifference": max_relative_matrix,
            "scope": "Finite binary64 numerical diagnostics; not an interval certificate or proof of all future simulation branches"}


test("First failed strict attempt and diagnostic remain CPU-only, disposed and unpromoted", audit_boundary)
test("Full snapshot raw values independently match every reported hex64 difference", audit_full_values)
test("All discrete, categorical, clock, ordered metadata, material and original ledger fields remain exact", audit_discrete_material)
test("All captured derived Float32 packets and valid original ledger words equal the exact Node baseline", audit_packs)
test("Both complete covariance sets remain symmetric and numerically positive definite", audit_covariance)

report = {"schema": "glass-atoll.r30-browser-cpu-identity-independent-audit.v1", "passed": all(c["passed"] for c in checks),
          "actualGPU": False, "browserActions": 0, "replaysRun": 0, "opticalQueries": 0, "productionEdits": 0,
          "sourceReceipts": {name: digest(name) for name in ["r30-browser-native-cpu-diagnostic.json", "r30-native-replay-node-diagnostic.json", "r30-native-replay-fixture.json"]},
          "summary": {"passed": sum(c["passed"] for c in checks), "total": len(checks)}, "checks": checks,
          "decision": "Current evidence supports a separately identified SAME-ENGINE exact physical anchor followed by a full exact CPU repeat. The original Node exact failure remains true. No epsilon rule is selected and no composed-frame GPU admission is granted before that repeat and refreshed source/consumer checks.",
          "limits": ["Tiny absolute drift and matching captured Float32 inputs do not prove its precise engine/libm cause.", "No complete source-ray upload, smoke volume attribute buffer, image or continuous simulation identity follows from density-only T and SH packs.", "Covariance and material agreement are evidence for this fixed one-event recipe, not all runtime profiles or later nonlinear branches."]}
(HERE / "r30-browser-cpu-identity-independent-audit.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))
if not report["passed"]:
    raise SystemExit(1)
