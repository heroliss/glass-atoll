# Final CPU verification

Frozen production source: all recorded per-file hashes still match. No production edits, browser or GPU work in this verification turn.

| Suite | Result |
| --- | --- |
| Automatic launch + light smoke | 53/53 |
| Smoke adapters + old10 exact compatibility | 30/30 |
| Physical forecast | 20/20 |
| Camera fitting | 48/48 |
| Total | 151/151 |

Actual automatic random selection reached every registered type using runtime seeds0–68. Across360 launches (all20types, three bearings, configured/automatic seaward bearing, tilt−65/0/+65), launch velocity and muzzle position follow the signed angle; manual15° cone jitter is ignored in that mode. Every automatic event keeps patternAzimuth at base bearing+90°, matching the broadside camera. All216 patterned cases agree exactly when burst rotation is disabled; default random burst rotation remained close to the viewer normal (minimum dot0.9725). All20 manual types retain their separate original pattern basis.

The188 authored light-smoke packets have deterministic births tied to actual selected bodies/onset. Same-time output is bit-identical after intermediate samples. Opacity approaches zero continuously and packets expire after6.5s. Event retention includes the final visible fade: V sweep now survives to18.375s; its former base horizon was16.425s and positive smoke remains at17.875s.

The existing three suites were rerun against the final source and remain green, including1,929,225 physical trajectory position checks and old10 smoke-log/profile deep equality.

No unresolved production failures were found. The first new fixture incorrectly required a packet at the exact binary64 birth+6.5 boundary; an already-transparent packet may be omitted by an ulp of subtraction. The assertion now accepts absent or zero-opacity at that boundary and separately requires positive, continuously vanishing opacity immediately before it. The first report is retained. No production code changed.

These checks establish CPU scheduling, source/camera math and smoke lifetime behavior. They do not establish browser appearance, HDR correctness, occlusion or frame rate. The6.5s light-smoke lifetime is the inexpensive display proxy; full persistent smoke remains a different mode.
