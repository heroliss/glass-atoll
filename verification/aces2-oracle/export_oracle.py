"""Pinned official OCIO CPU/GPU export; no production module writes or GL use."""
from __future__ import annotations
import hashlib
import json
import math
import pathlib
import struct
import sys
from datetime import datetime, timezone
import PyOpenColorIO as OCIO
import numpy as np

OUT = pathlib.Path(__file__).resolve().parent
ROOT = OUT.parent.parent
INPUTS = json.loads((OUT / "source-inputs.json").read_text(encoding="utf-8"))
PEAKS = (100, 700, 1270)
WEIGHTS = (.2126, .7152, .0722)
REC709 = (.64, .33, .30, .60, .15, .06, .3127, .3290)
INPUT_BUILTIN = "UTILITY - ACES-AP1_to_LINEAR-REC709_BFD"
AP1_AP0_BUILTIN = "ACEScg_to_ACES2065-1"
CONFIG = OCIO.Config.CreateRaw()
CHECKS: list[dict] = []


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check(name, function):
    try:
        evidence = function()
        CHECKS.append({"name": name, "passed": True, "evidence": evidence})
    except Exception as error:
        CHECKS.append({"name": name, "passed": False, "error": repr(error)})


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def vector(value):
    return [float(x) for x in value]


def safe_vector(value):
    return [float(x) if math.isfinite(float(x)) else "NaN" if math.isnan(float(x)) else "+Infinity" if x > 0 else "-Infinity" for x in value]


def classification(value):
    return {"finite": sum(math.isfinite(float(x)) for x in value),
            "nan": sum(math.isnan(float(x)) for x in value),
            "inf": sum(math.isinf(float(x)) for x in value),
            "negativeFinite": sum(math.isfinite(float(x)) and x < 0 for x in value)}


def processor(transforms):
    return CONFIG.getProcessor(OCIO.GroupTransform(transforms))


def input_transform():
    return OCIO.BuiltinTransform(INPUT_BUILTIN, OCIO.TRANSFORM_DIR_INVERSE)


def to_ap0():
    return OCIO.BuiltinTransform(AP1_AP0_BUILTIN)


def upper(peak):
    # Match the official C++ float expression rather than a hidden cube bound.
    p = np.float32(peak)
    return float(np.float32(8) * (np.float32(128) + np.float32(768) * (np.log(p / np.float32(100)) / np.log(np.float32(100)))))


def range_transform(high):
    return OCIO.RangeTransform(minInValue=0., minOutValue=0., maxInValue=high, maxOutValue=high)


def fixed(peak, primaries=REC709):
    transform = OCIO.FixedFunctionTransform(OCIO.FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20, [peak, *primaries])
    transform.validate()
    return transform


def chain(peak, domain=True, display_clamp=True, primaries=REC709):
    operators = [input_transform()]
    if domain:
        operators.append(range_transform(upper(peak)))
    operators.extend([to_ap0(), fixed(peak, primaries)])
    if display_clamp:
        operators.append(range_transform(peak / 100.))
    return processor(operators)


AP1 = processor([input_transform()]).getDefaultCPUProcessor()
AP1_INVERSE = processor([OCIO.BuiltinTransform(INPUT_BUILTIN)]).getDefaultCPUProcessor()
AP0 = processor([to_ap0()]).getDefaultCPUProcessor()


def apply(cpu, colour):
    if len(colour) != 3 or not all(math.isfinite(float(x)) for x in colour):
        raise ValueError("Oracle requires three finite exposed input RGB values")
    return vector(cpu.applyRGB(vector(colour)))


def build_inputs(peak):
    rows = []
    levels = sorted(set([0., .001, .01, .1, .18, 1., 2., 10., 100., 1000., 1e8] + [.18 * 2 ** (-20 + i * 40 / 63) for i in range(64)]))
    hues = {"red": [1, 0, 0], "green": [0, 1, 0], "blue": [0, 0, 1], "cyan": [0, 1, 1], "magenta": [1, 0, 1], "yellow": [1, 1, 0]}
    for name, rgb in hues.items():
        y = sum(c * w for c, w in zip(rgb, WEIGHTS))
        for level in levels:
            rows.append({"id": f"hue-{name}-{level:.15g}", "family": "six-hue-unit-Y-ramp", "name": name, "level": level, "input": [c / y * level for c in rgb]})
    for name, rgb in INPUTS["profiles"].items():
        for level in levels:
            rows.append({"id": f"profile-{name}-{level:.15g}", "family": "actual-positive-author-profile-ramp", "name": name, "level": level, "input": [c * level for c in rgb]})
    for level in sorted(set(levels + [i / 32 for i in range(33)])):
        rows.append({"id": f"neutral-{level:.15g}", "family": "black-grey-white-ramp", "level": level, "input": [level] * 3})
    examples = [[-.18] * 3, [-1e-5, 0, 0], [-.01, .18, .5], [-.5, .2, 1], [1, -WEIGHTS[0] / WEIGHTS[1], 0], [0, 0, 0], [1e-12] * 3, [16376 * 48.64] * 3, [1e9, 0, 0], [0, 0, 1e9]]
    for i, rgb in enumerate(examples):
        rows.append({"id": f"negative-or-extreme-{i}", "family": "negative-and-exposed-domain-stress", "input": rgb})
    u = upper(peak)
    for axis in range(3):
        for value in [-1e-5, 0., float(np.nextafter(np.float32(u), np.float32(-math.inf))), u, float(np.nextafter(np.float32(u), np.float32(math.inf))), u * 2]:
            ap1 = [.18] * 3
            ap1[axis] = value
            rows.append({"id": f"AP1-axis-{axis}-{value:.12g}", "family": "AP1-domain-boundary", "intendedAP1": ap1, "input": apply(AP1_INVERSE, ap1)})
    for value in [0., .18, u, u * 2]:
        ap1 = [value] * 3
        rows.append({"id": f"AP1-grey-{value:.12g}", "family": "AP1-domain-boundary", "intendedAP1": ap1, "input": apply(AP1_INVERSE, ap1)})
    return rows


def encode_srgb(c):
    # Signed extension, for a declared sRGB canvas only; not for srgb-linear.
    sign = -1 if c < 0 else 1
    a = abs(c)
    return sign * (12.92 * a if a <= .0031308 else 1.055 * a ** (1 / 2.4) - .055)


def export_gpu(peak, proc):
    desc = OCIO.GpuShaderDesc.CreateShaderDesc()
    desc.setLanguage(OCIO.GPU_LANGUAGE_GLSL_ES_3_0)
    desc.setFunctionName(f"aces2Display{peak}")
    desc.setResourcePrefix(f"aces2_{peak}_")
    proc.getDefaultGPUProcessor().extractGpuShaderInfo(desc)
    text = desc.getShaderText()
    function_file = f"aces2-{peak}-official.glsl"
    (OUT / function_file).write_bytes(text.encode("utf-8"))
    textures = []
    for i, texture in enumerate(desc.getTextures()):
        values = np.asarray(texture.getValues(), dtype="<f4").reshape(-1)
        channels = 1 if texture.channel == desc.TEXTURE_RED_CHANNEL else 3
        assert values.size == texture.width * texture.height * channels
        assert np.all(np.isfinite(values))
        raw_name = f"aces2-{peak}-table-{i}-raw.f32"
        rgba_name = f"aces2-{peak}-table-{i}-rgba.f32"
        raw = values.tobytes()
        rgba = np.zeros((texture.width * texture.height, 4), dtype="<f4")
        rgba[:, :channels] = values.reshape(-1, channels)
        rgba[:, 3] = 1.
        packed = rgba.tobytes()
        (OUT / raw_name).write_bytes(raw)
        (OUT / rgba_name).write_bytes(packed)
        texture_row = {"index": i, "textureName": texture.textureName, "samplerName": texture.samplerName,
                       "bindingIndex": texture.textureShaderBindingIndex, "width": texture.width, "height": texture.height,
                       "dimensions": str(texture.dimensions), "originalChannels": channels, "channel": str(texture.channel),
                       "interpolation": str(texture.interpolation), "dataType": "IEEE754 float32 little-endian",
                       "shaderPrecision": "highp sampler2D inherited from probe header; official function text unchanged",
                       "rawFile": raw_name, "rawBytes": len(raw), "rawSHA256": digest(raw),
                       "rgbaUploadFile": rgba_name, "rgbaBytes": len(packed), "rgbaSHA256": digest(packed),
                       "minimum": float(values.min()), "maximum": float(values.max()),
                       "upload": {"internalFormat": "RGBA32F", "format": "RGBA", "type": "FLOAT", "minFilter": "NEAREST", "magFilter": "NEAREST", "wrapS": "CLAMP_TO_EDGE", "wrapT": "CLAMP_TO_EDGE", "generateMipmaps": False, "flipY": False, "unpackAlignment": 1, "colorSpace": "NoColorSpace"}}
        write_json(OUT / f"aces2-{peak}-table-{i}.json", {**texture_row, "values": vector(values)})
        textures.append(texture_row)
    # This is a fixture wrapper, not a new display implementation. It keeps the
    # exact exported OCIO function and exposes unit conversion/encoding only.
    wrapper = """#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform highp sampler2D tInput;
uniform float uNitsToLinear;
uniform int uEncodeSRGB;
in vec2 vUv;
out vec4 colour;
""" + text + """
vec3 encodeSignedSRGB(vec3 x){
  vec3 a=abs(x);
  return sign(x)*mix(1.055*pow(a,vec3(1./2.4))-.055,12.92*a,lessThanEqual(a,vec3(.0031308)));
}
void main(){
  vec3 mapped=FUNCTION(vec4(texture(tInput,vUv).rgb,1.)).rgb;
  vec3 outRGB=mapped*uNitsToLinear;
  colour=vec4(uEncodeSRGB==0?outRGB:encodeSignedSRGB(outRGB),1.);
}
""".replace("FUNCTION", f"aces2Display{peak}")
    wrapper_name = f"aces2-{peak}-probe.frag"
    (OUT / wrapper_name).write_bytes(wrapper.encode("utf-8"))
    return {"peakNits": peak, "style": "FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20", "params": [peak, *REC709],
            "function": f"aces2Display{peak}", "functionFile": function_file, "functionSHA256": digest(text.encode()), "functionCharacters": len(text),
            "probeFragmentFile": wrapper_name, "probeFragmentSHA256": digest(wrapper.encode()),
            "gpuProcessorCacheID": proc.getDefaultGPUProcessor().getCacheID(), "processorCacheID": proc.getCacheID(),
            "language": "GLSL ES3.0", "textures2D": textures, "textures3D": len(list(desc.get3DTextures())),
            "officialDynamicUniforms": len(list(desc.getUniforms())),
            "algorithm": "official analytic CAM/tone/chroma/gamut with two small hue lookup tables; not an arbitrary 3D LUT",
            "input": "already exposed scene-linear sRGB/Rec709 D65, no P/exposure factor in function",
            "output": "display-linear Rec709 D65; numeric1 =100nit; official AP1 pre-domain and display range policies included",
            "probeUniforms": {"uNitsToLinear": "1 for CPU normalized100nit comparison;100/browserSDRWhiteNits for absolute browser-linear units", "uEncodeSRGB": "0 for linear RT/srgb-linear canvas;1 only for declared srgb canvas"},
            "gpuComparison": {"type": "absolute per RGB component on Float32 target", "maximumAbsoluteError": 2e-5,
                              "source": "https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/tests/gpu/FixedFunctionOp_test.cpp#L287-L345",
                              "rationale": "Official ACES2 forward GPU unit test uses2e-5 absolute (relative comparison defaults false). Adopt same initial strict gate; expanded wrapper/extreme/domain samples are not guaranteed by that published test. Preserve any failures, do not auto-widen.",
                              "firstProbe": "RGBA32F expected/output; FP16 output rounding must be audited separately"},
            "notYetValidated": ["actual WebGL shader compile", "GPU numerical parity", "GPU cost", "browser color copy/visible HDR", "panel nits"]}


REPORTS = []
EXPORTS = []
for peak in PEAKS:
    full = chain(peak)
    cpu = full.getDefaultCPUProcessor()
    raw_ff = chain(peak, domain=False, display_clamp=False).getDefaultCPUProcessor()
    pre_output_clamp = chain(peak, domain=True, display_clamp=False).getDefaultCPUProcessor()
    domain = processor([input_transform(), range_transform(upper(peak))]).getDefaultCPUProcessor()
    cases = []
    for sample in build_inputs(peak):
        rgb = vector(np.array(sample["input"], dtype=np.float32))
        before = apply(AP1, rgb)
        clipped = apply(domain, rgb)
        mapped = apply(cpu, rgb)
        raw = apply(raw_ff, rgb)
        ff = apply(pre_output_clamp, rgb)
        cases.append({**sample, "inputFloat32": rgb, "inputDomainLabel": "deliberately-signed-or-domain-stress" if sample["family"] in ("negative-and-exposed-domain-stress", "AP1-domain-boundary") else "nonnegative-scene-linear",
                      "AP1BeforeDomain": safe_vector(before), "AP1AfterDomain": safe_vector(clipped),
                      "domainChanged": any(a != b for a, b in zip(before, clipped)), "AP0ForFixedFunction": safe_vector(apply(AP0, clipped)),
                      "unclampedFixedFunctionWithoutInputDomain": safe_vector(raw), "rawClassification": classification(raw),
                      "fixedFunctionAfterDomainBeforeOutputRange": safe_vector(ff), "preOutputRangeClassification": classification(ff),
                      "outputNormalized100Nit": mapped, "outputNits": [x * 100 for x in mapped],
                      "browserLinearAtWhite280": [x * 100 / 280 for x in mapped],
                      "browserEncodedSRGBAtWhite280": [encode_srgb(x * 100 / 280) for x in mapped]})
    width, height = 64, math.ceil(len(cases) / 64)
    input_pattern = np.zeros((width * height, 4), dtype="<f4")
    expected_pattern = np.zeros((width * height, 4), dtype="<f4")
    input_pattern[:, 3] = expected_pattern[:, 3] = 1.
    input_pattern[:len(cases), :3] = [c["inputFloat32"] for c in cases]
    expected_pattern[:len(cases), :3] = [c["outputNormalized100Nit"] for c in cases]
    in_bytes, expected_bytes = input_pattern.tobytes(), expected_pattern.tobytes()
    input_name, expected_name = f"aces2-{peak}-gpu-input.f32", f"aces2-{peak}-cpu-expected.f32"
    (OUT / input_name).write_bytes(in_bytes)
    (OUT / expected_name).write_bytes(expected_bytes)
    pattern = {"width": width, "height": height, "samples": len(cases), "paddedPixels": width * height - len(cases), "stride": 4, "dtype": "float32 little-endian RGBA", "inputFile": input_name, "inputSHA256": digest(in_bytes), "expectedFile": expected_name, "expectedSHA256": digest(expected_bytes), "inputRounding": "every CPU call explicitly receives float32-rounded RGB, same values as uploaded pattern", "layout": "row-major, flipY false; readPixels bottom-row order equals exported texture row0; padded pixels opaque black"}
    report = {"schema": "glass-atoll.official-aces2-cpu-oracle.v1", "peakNits": peak, "params": [peak, *REC709], "gpuPattern": pattern,
              "library": {"name": "OpenColorIO", "version": OCIO.GetVersion()}, "AP1UpperFloat32": upper(peak),
              "wrapperPolicy": "official builtins ACES2_OUTPUT::Generate_output_transform, D65 target, no creative-white scaling, linear_scale1; normalized100nit output retained",
              "inputDomainPolicy": "official AP1 range precondition explicitly separated from bare FixedFunction results",
              "inputUnits": "already exposed scene-linear709/D65, author-relative; not absolute incident nits/lux",
              "outputUnits": "linear display709, numeric1=100nit; browser white280 conversion and OETF are separate labelled diagnostics",
              "sourceSnapshot": INPUTS, "sampleCount": len(cases), "samples": cases,
              "bareFunctionNonFiniteChannels": sum(c["rawClassification"]["nan"] + c["rawClassification"]["inf"] for c in cases),
              "bareFunctionNegativeChannels": sum(c["rawClassification"]["negativeFinite"] for c in cases),
              "samplesChangedByDeclaredInputDomain": sum(c["domainChanged"] for c in cases)}
    write_json(OUT / f"aces2-{peak}-cpu.json", report)
    REPORTS.append(report)
    EXPORTS.append({**export_gpu(peak, full), "cpuOracleFile": f"aces2-{peak}-cpu.json", "gpuPattern": pattern})


def dependencies():
    assert OCIO.GetVersion() == "2.6.0" and np.__version__ == "2.3.4"
    assert pathlib.Path(sys.prefix).resolve() == (ROOT / ".tools" / "aces2-oracle").resolve()
    assert pathlib.Path(OCIO.__file__).resolve().is_relative_to(pathlib.Path(sys.prefix))
    assert sys.prefix != sys.base_prefix
    return {"python": sys.version, "executable": sys.executable, "OCIO": OCIO.__file__, "NumPy": np.__version__}


check("isolated pinned CPU native module and NumPy import successfully", dependencies)


def params_gate():
    for peak in PEAKS:
        fixed(peak).validate()
    for params in [[700.5, *REC709], [700, *REC709[:-1]]]:
        try:
            OCIO.FixedFunctionTransform(OCIO.FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20, params).validate()
        except OCIO.Exception:
            continue
        raise AssertionError("Invalid fixedfunction params were accepted")
    return {"peaks": list(PEAKS), "params": [700, *REC709], "fractionalPeakRejected": True, "wrongCountRejected": True}


check("custom7001270 and100 validate while fractional peak and wrong parameter count reject", params_gate)


def adaptation():
    white = apply(AP1, [1, 1, 1])
    assert max(abs(x - 1) for x in white) < 2e-6
    tests = [[.12, .33, .71], [1, .1, 0], [0, 0, 5], [100, 40, 2], [-.1, .3, .7], [1e-8, 2e-7, 4e-6]]
    errors = []
    for x in tests:
        result = apply(AP1_INVERSE, apply(AP1, x))
        error = max(abs(a - b) for a, b in zip(result, x))
        assert error <= 3e-6 * max(1, max(abs(v) for v in x))
        errors.append(error)
    matrix = np.array([apply(AP1, [1 if c == i else 0 for c in range(3)]) for i in range(3)]).T
    return {"white": white, "maxAbsoluteRoundtripError": max(errors), "nonNeutralRoundtrips": len(tests), "709D65toAP1D60_matrixRows": matrix.tolist(), "source": INPUT_BUILTIN + " inverse"}


check("correct Bradford direction passes white and nonneutral inverse roundtrips", adaptation)


def all_ranges():
    maxima = {}
    for report in REPORTS:
        high = report["peakNits"] / 100
        values = [v for c in report["samples"] for v in c["outputNormalized100Nit"]]
        assert all(math.isfinite(v) and 0 <= v <= high + 1e-6 for v in values)
        maxima[str(report["peakNits"])] = max(values)
    return {"fullWrapperMaximumNormalized100Nit": maxima, "notABareFunctionProof": True}


check("declared complete wrapper outputs remain finite nonnegative within target peak", all_ranges)


def raw_results_retained():
    counts = []
    for report in REPORTS:
        assert report["samplesChangedByDeclaredInputDomain"] > 0
        assert all("unclampedFixedFunctionWithoutInputDomain" in s and "fixedFunctionAfterDomainBeforeOutputRange" in s for s in report["samples"])
        counts.append({"peak": report["peakNits"], "bareNonFiniteChannels": report["bareFunctionNonFiniteChannels"], "bareNegativeChannels": report["bareFunctionNegativeChannels"], "domainChangedSamples": report["samplesChangedByDeclaredInputDomain"]})
    return counts


check("negative and outofdomain raw FF intermediates are retained rather than hidden by range clamps", raw_results_retained)


def source_data():
    for file, expected in INPUTS["sourceSHA256"].items():
        assert digest((ROOT / file).read_bytes()) == expected, file
    return INPUTS["sourceSHA256"]


check("actual profiles are captured and all runtime source hashes remain unchanged", source_data)


def scope():
    for report in REPORTS:
        families = {s["family"] for s in report["samples"]}
        assert {"six-hue-unit-Y-ramp", "actual-positive-author-profile-ramp", "black-grey-white-ramp", "negative-and-exposed-domain-stress", "AP1-domain-boundary"} <= families
        for name in ["red", "green", "blue", "cyan", "magenta", "yellow"]:
            assert sum(s["family"] == "six-hue-unit-Y-ramp" and s["name"] == name for s in report["samples"]) >= 64
        assert all(any(s.get("level") == .18 for s in report["samples"] if s["family"] == "black-grey-white-ramp") for _ in [0])
    return {"sampleCounts": {str(r["peakNits"]): r["sampleCount"] for r in REPORTS}, "sixHuesEachAtLeast64Levels": True, "actualProfiles": list(INPUTS["profiles"])}


check("datasets cover six hues actual5profiles grey blackwhite negative and domain limits", scope)


def grey_values():
    result = {}
    for report in REPORTS:
        gray = next(s for s in report["samples"] if s["family"] == "black-grey-white-ramp" and s["level"] == .18)
        rgb = gray["outputNits"]
        assert max(rgb) - min(rgb) < 1e-3
        result[str(report["peakNits"])] = rgb
    assert abs(result["100"][0] - 10) < .01
    assert result["1270"][0] > result["700"][0] > result["100"][0]
    return {"inputExposed709": [.18] * 3, "actualNits": result, "white280IsUnitConversionNotAnExtraExposure": True}


check("neutral18percent units are100nitnormalized and custom peaks give distinct expected rendering", grey_values)


def no_fake_3dlut():
    for export in EXPORTS:
        assert len(export["textures2D"]) == 2 and export["textures3D"] == 0
        assert export["officialDynamicUniforms"] == 0
        for t in export["textures2D"]:
            assert t["width"] == 363 and t["height"] == 1
            assert "NEAREST" in t["interpolation"]
            assert digest((OUT / t["rawFile"]).read_bytes()) == t["rawSHA256"]
            assert digest((OUT / t["rgbaUploadFile"]).read_bytes()) == t["rgbaSHA256"]
    return [{"peak": e["peakNits"], "shaderCharacters": e["functionCharacters"], "tables": len(e["textures2D"]), "tableRawBytes": sum(t["rawBytes"] for t in e["textures2D"])} for e in EXPORTS]


check("official GPU shader uses two small nearest float tables and no arbitrary3Dlut", no_fake_3dlut)


def file_bytes_and_patterns():
    for export in EXPORTS:
        assert digest((OUT / export["functionFile"]).read_bytes()) == export["functionSHA256"]
        assert digest((OUT / export["probeFragmentFile"]).read_bytes()) == export["probeFragmentSHA256"]
        pattern = export["gpuPattern"]
        oracle = next(r for r in REPORTS if r["peakNits"] == export["peakNits"])
        uploaded = np.frombuffer((OUT / pattern["inputFile"]).read_bytes(), dtype="<f4").reshape(-1, 4)
        expected = np.frombuffer((OUT / pattern["expectedFile"]).read_bytes(), dtype="<f4").reshape(-1, 4)
        for i, row in enumerate(oracle["samples"]):
            assert vector(uploaded[i, :3]) == row["inputFloat32"]
            assert vector(expected[i, :3]) == row["outputNormalized100Nit"]
    return {"servedShaderHashes": "actual UTF8 LF file bytes verified", "patterns": "all CPU inputs explicitly float32 and bit-identical to exported texture rows"}


check("served shader byte hashes and float32 GPU inputexpected patterns match metadata exactly", file_bytes_and_patterns)


def browser_units():
    for r in REPORTS:
        for s in r["samples"]:
            for n, norm, browser in zip(s["outputNits"], s["outputNormalized100Nit"], s["browserLinearAtWhite280"]):
                assert n == norm * 100 and browser == n / 280
    return {"browserWhite": 280, "peakBrowserLinear": {str(p): p / 280 for p in PEAKS}, "native80nitFactorNotApplied": True}


check("browser linear units invert normalized100nit scale exactly without extra80nit or paperwhite factor", browser_units)


def official_builtin_parity():
    # Independently compare to registered high-level official ACES2 transforms,
    # which produce XYZ-D65, rather than comparing the wrapper to itself.
    xy = np.array([[.64, .33], [.30, .60], [.15, .06]])
    columns = np.array([[x / y, 1, (1 - x - y) / y] for x, y in xy]).T
    wx, wy = .3127, .329
    white = np.array([wx / wy, 1, (1 - wx - wy) / wy])
    rgb_xyz = columns @ np.diag(np.linalg.solve(columns, white))
    tests = [[0, 0, 0], [.18] * 3, [1] * 3, [1, .1, 0], [.01, .03, 2], [8, 1, .5], [-.1, .3, .7]]
    result = []
    for peak, name, primaries in [(100, "SDR-100nit-REC709_2.0", REC709), (1000, "HDR-1000nit-P3-D65_2.0", (.68,.32,.265,.69,.15,.06,.3127,.329))]:
        official_name = "ACES-OUTPUT - ACES2065-1_to_CIE-XYZ-D65 - " + name
        official = processor([OCIO.BuiltinTransform(official_name)]).getDefaultCPUProcessor()
        ours = chain(peak, primaries=primaries).getDefaultCPUProcessor()
        if primaries != REC709:
            columns = np.array([[x / y, 1, (1 - x - y) / y] for x, y in np.array(primaries[:6]).reshape(3, 2)]).T
            rgb_xyz = columns @ np.diag(np.linalg.solve(columns, white))
        max_error = 0.
        for rgb in tests:
            ap0 = apply(AP0, apply(AP1, rgb))
            xyz = apply(official, ap0)
            rgb_out = apply(ours, rgb)
            our_xyz = vector(rgb_xyz @ np.array(rgb_out))
            error = max(abs(a - b) for a, b in zip(xyz, our_xyz))
            max_error = max(error, max_error)
            assert error <= 3e-5 * max(1, max(abs(v) for v in xyz))
        result.append({"peak": peak, "registeredBuiltin": official_name, "samples": len(tests), "maximumXYZAbsoluteError": max_error})
    return result


check("custom wrapper matches independently registered official100 and1000nit highlevel builtins", official_builtin_parity)


def finite_input_gate():
    cpu = chain(700).getDefaultCPUProcessor()
    for v in [math.nan, math.inf, -math.inf]:
        try:
            apply(cpu, [v, 0, 0])
        except ValueError:
            continue
        raise AssertionError("Nonfinite input should be explicitly rejected")


check("nonfinite input is explicitly rejected rather than fed into C++ gamut traversal", finite_input_gate)

index = {"schema": "glass-atoll.official-aces2-export.v1", "dateUTC": datetime.now(timezone.utc).isoformat(),
         "passed": all(c["passed"] for c in CHECKS), "counts": {"total": len(CHECKS), "passed": sum(c["passed"] for c in CHECKS)},
         "checks": CHECKS, "OCIOVersion": OCIO.GetVersion(), "NumPyVersion": np.__version__, "pythonExecutable": sys.executable,
         "targets": EXPORTS, "sourceSnapshot": INPUTS,
         "scriptSHA256": digest(pathlib.Path(__file__).read_bytes()), "sourceInputSHA256": digest((OUT / "source-inputs.json").read_bytes()),
         "limitations": ["CPU native DLL import/algorithm and resource export only; no actual WebGL compile/GPU parity/cost/HDR visual claim.",
                         "All generated shader functions include the explicitly declared official highlevel AP1 input-domain and display-range policies; bare FF before these clamps is retained in CPU files.",
                         "Exposed linear709 input is author-relative scene light; outputnits are rendering target units, not measured panel luminance or incident physical calibration.",
                         "Browser white conversion/OETF is separate from official function; peak is baked into processor/tables, white/encoding may be wrapper-only uniforms.",
                         "No source/camera/light/material/physics/audio/smoke or default display chain changed."]}
write_json(OUT / "export-report.json", index)
print(json.dumps({"passed": index["passed"], "counts": index["counts"], "failed": [c for c in CHECKS if not c["passed"]],
                  "targets": [{"peak": e["peakNits"], "shaderCharacters": e["functionCharacters"], "resources": len(e["textures2D"])} for e in EXPORTS]}, indent=2))
sys.exit(0 if index["passed"] else 1)
