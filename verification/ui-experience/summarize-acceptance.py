"""Summarize recorded browser UI observations; never starts a browser or GPU job."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
read = lambda p: json.loads((ROOT / p).read_text(encoding="utf-8"))
cases = {x["label"]: x for x in read("verification/ui-experience/browser-cases.json")}
layouts = {x["label"]: x for x in read("verification/ui-experience/responsive-layouts.json")}
before = read("verification/ui-experience/user-state-before.json")
after = cases["user-settings-restored"]
checks = []

def check(name, passed):
    checks.append({"name": name, "passed": bool(passed)})

for label, view in [("glass-day", "lagoon"), ("sunset", "sun"), ("starry-night", "stars"), ("twilight-fireworks-final", "fireworks")]:
    c = cases[label]
    check(f"{label}: view/time applied without launching", c["interface"]["view"] == view and not c["celestial"]["running"] and c["fireworks"]["active"] == 0 and c["fireworks"]["launches"] == 0 and all(not b["disabled"] and b["busy"] == "false" for b in c["labels"]["showcases"]))
check("quick experimental style reaches detailed settings", cases["quick-experimental-to-details"]["labels"]["deepProfile"] == "three-heart-v1")
check("detailed smiley reaches quick selector", cases["details-to-quick-smiley"]["labels"]["quickType"] == "type:smiley")
check("manual view clears combo without changing time", all(b["pressed"] == "false" for b in cases["manual-view-clears-combo"]["labels"]["showcases"]) and cases["manual-view-clears-combo"]["celestial"]["utcMs"] == cases["blue-hour"]["celestial"]["utcMs"])
check("single launch immediately active and resumes playback", cases["quick-single-launch"]["fireworks"]["active"] == 1 and not cases["quick-single-launch"]["state"]["parameters"]["paused"])
check("auto from pause resumes playback and syncs both controls", cases["quick-auto-start-from-paused"]["labels"]["quickAuto"] == "true" and cases["quick-auto-start-from-paused"]["labels"]["deepAuto"] and not cases["quick-auto-start-from-paused"]["state"]["parameters"]["paused"])
check("stop future does not remove current event", cases["quick-auto-stopped"]["labels"]["quickAuto"] == "false" and cases["quick-auto-stopped"]["fireworks"]["active"] == 1)
check("stop prevents later launches", cases["auto-event-after-stop"]["fireworks"]["launches"] == 2 and cases["auto-event-after-stop"]["fireworks"]["active"] == 0)

def overlaps(a, b):
    return a["x"] < b["right"] and a["right"] > b["x"] and a["y"] < b["bottom"] and a["bottom"] > b["y"]

for name in ["phone-390-final", "landscape-600-final", "tablet-768-final-v2", "desktop-1440-final"]:
    layout = layouts[name]
    panels = layout["panels"]
    check(f"{name}: panels inside viewport and disjoint", not layout["outside"] and all(not overlaps(a, b) for i, a in enumerate(panels) for b in panels[i+1:]))
check("all recorded scene GL checks clean", all(not c["gl"]["errors"] for c in cases.values()))
check("final browser console clean", not read("verification/ui-experience/console-final.json"))
check("original camera and target restored", all(abs(a-b) < 1e-8 for key in ["camera", "target"] for a,b in zip(before["state"][key], after["state"][key])))
check("original playback, panel, sound, quality restored", all(before["interface"][k] == after["interface"][k] for k in ["panelOpen", "activeCategory", "viewsOpen", "hidden", "statsVisible", "quality", "sound", "paused"]) and before["celestial"]["running"] == after["celestial"]["running"])
check("quick module CPU checks", read("verification/ui-quick-experience-check.json")["passed"])
check("original controls retained", read("verification/ui-experience/control-inventory.json")["passed"])

source_paths = ["index.html", "style.css", "ui.js", "ui-quick-experience.js", "main.js", "package.json", "fireworks-audio.js"]
hashes = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in source_paths}
check("approved audio source unchanged", hashes["fireworks-audio.js"] == "4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31")
report = {"passed": all(c["passed"] for c in checks), "counts": {"passed": sum(c["passed"] for c in checks), "total": len(checks)}, "scope": "UI acceptance using saved real-browser observations plus existing CPU checks; not a frame-rate or photorealism acceptance", "checks": checks, "sourceSHA256": hashes}
(OUT / "acceptance.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({k: report[k] for k in ["passed", "counts"]}, ensure_ascii=False))
for c in checks:
    if not c["passed"]:
        print("FAIL:", c["name"])
raise SystemExit(0 if report["passed"] else 1)
