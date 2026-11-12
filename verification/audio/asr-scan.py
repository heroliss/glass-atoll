"""CPU-only, bounded English speech screen; not a listening/voice-free verdict."""
from pathlib import Path
import os, sys, json, hashlib, subprocess, time, ctypes

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
TOOLS = HERE / "asr-tools"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
if os.name == "nt":
    ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)
sys.path.insert(0, str(TOOLS / "python-packages"))
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)

started = time.monotonic()
model_path = TOOLS / "model" / "vosk-model-small-en-us-0.15"
# Vosk's Windows native library cannot reliably open an absolute UTF-8 path
# containing this workspace's Chinese characters. Use an ASCII relative path.
os.chdir(TOOLS)
model = Model("model/vosk-model-small-en-us-0.15")
report = {
    "method": "Vosk 0.3.45 / vosk-model-small-en-us-0.15, English only, CPU only",
    "executionPriority": "BelowNormal; OMP/OPENBLAS thread count 1",
    "modelSource": "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
    "modelLicense": "Apache-2.0 per https://alphacephei.com/vosk/models",
    "modelArchiveSha256": hashlib.sha256((model_path.parent / "vosk-model-small-en-us-0.15.zip").read_bytes()).hexdigest(),
    "files": [],
    "limitations": [
        "This automated English ASR screen is not subjective listening and cannot certify an audio clip is voice-free.",
        "Surf/wind noise can produce false words; distant/masked/non-English speech can be missed.",
        "Recognized words are timestamped review candidates, not confirmed human speech."
    ]
}
for filename in ["ocean-shore.ogg", "leaf-rustle.ogg"]:
    source = ROOT / "assets" / "audio" / filename
    decoded = TOOLS / ("decoded-" + filename + ".wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-threads", "1", "-i", str(source), "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(decoded)], check=True, timeout=30)
    import wave
    recognizer = KaldiRecognizer(model, 16000)
    recognizer.SetWords(True)
    segments = []
    with wave.open(str(decoded), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()
        while True:
            data = wav.readframes(4000)
            if not data:
                break
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                if result.get("text") or result.get("result"):
                    segments.append(result)
            if time.monotonic() - started > 90:
                raise TimeoutError("Bounded ASR scan exceeded 90 seconds; no success claim.")
        result = json.loads(recognizer.FinalResult())
        if result.get("text") or result.get("result"):
            segments.append(result)
    words = [word for segment in segments for word in segment.get("result", [])]
    report["files"].append({
        "file": str(source.relative_to(ROOT)).replace("\\", "/"),
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "durationSeconds": duration,
        "recognizedWordCount": len(words),
        "recognizedText": " ".join(segment.get("text", "") for segment in segments),
        "segments": segments,
        "highConfidenceWords": [word for word in words if word.get("conf", 0) >= .8],
        "conclusion": "Automated review candidates retained; no subjective voice-free verdict."
    })
report["elapsedSeconds"] = time.monotonic() - started
report["scriptSha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(HERE / "asr-scan.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"elapsedSeconds": report["elapsedSeconds"], "files": [{key: item[key] for key in ["file", "durationSeconds", "recognizedWordCount", "recognizedText", "highConfidenceWords"]} for item in report["files"]]}, ensure_ascii=False, indent=2))
