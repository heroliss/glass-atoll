# Default-framebuffer drawBuffers repair

Root's actual one-frame calltrace `aces2-hdr-gl-frame-first.json` localized the first INVALID_OPERATION1282 to sequence1326, the module's finally `gl.drawBuffers` call. It attempted to restore **eight BACK(1029) entries** on the default framebuffer. This driver returned BACK for every queried DRAW_BUFFER slot; the old snapshot loop queried MAX_DRAW_BUFFERS and only removed trailing NONE. The default framebuffer permits a single draw-buffer entry.

The colour draw had already completed, explaining why the observed WebGL→WebGPU image was fully bit-identical despite a queued GL error. The observer/copy did not generate that first error. The earlier137/137 fixture used owned offscreen render targets and did not establish default-canvas correctness; its report is retained with that boundary, alongside the first failure reports and actual trace.

Only the snapshot count changes:

```
framebuffer===null ? 1 : gl.getParameter(gl.MAX_DRAW_BUFFERS)
```

Offscreen query/trim/restoration logic, every colour shader/table, numerical gate, target setting, observer and bridge remain unchanged. The entire prior module is byte-preserved in `baselines/aces2-output-before-default-drawbuffers/`; the strict single-difference inverse restores SHA `fa6f4e33…` and rejects missing/duplicate/unrelated changes.

`aces2-output-check.mjs`: original **12/12** offline guards pass. `aces2-output-drawbuffers-check.mjs`: new **4/4** source/protocol checks pass, modeling the actually observed all-BACK response, requiring exactly one default entry and preserving offscreen results. At the preparation stage these were not GPU validation; the subsequently completed actual native verification is recorded below. Old GPU reports/preparation freeze are not replaced or relabeled as validation of this change.

New module SHA: `8888e2dc0d48ba507b876075391dc58f7f8b260b7bb512f07a0afd7e3ec36cd2`. The independent new fix freeze is `aces2-output-default-drawbuffers-fix-freeze.json`.

## Actual repair verification completed

Root's `aces2-scene-integration-first.json` now verifies the repair on the running renderer: the module regression is **137/137**; the actual1920×1080 native day-frame copy is **8/8** with `requireExtended:false`. All8294400 RGBA channels match **bit-exactly** in flipRows order (0absolute/half-ULP error), with opaque alpha, finite/nonnegative RGB. This day image does not contain values above1 and therefore is not an expanded-range witness.

The new actual trace records1320 original GL operations and1323 native error reads, **all zero**, `nativeErrorsByCode={}`, no incidents or residual flags. Both drawBuffers calls execute without error. Default cardinality is exactly1 in the unchanged888source. Trace getParameter count falls26→18, consistent with removing the MAX query plus7 excess default slots. The compact new trace keeps only head/tail24 calls and does not retain those two argument arrays; a direct new logged-list-length claim is therefore not made. The source/protocol proof and actual error-free native execution jointly validate this minimal repair.

Before/after copy and after trace GL queues are empty; the current program is live/not delete-pending. Method/observer trace cleanup succeeds. Thus **the actual default drawBuffers1282 repair has passed**, rather than merely passing an offscreen fixture.

The same report has `sameFrozen=true` but `sameRangeExtrema=false`: its composed baseline was captured before AA settled. That comparison is **not** accepted as same-master invariance and is not part of this repair claim; root is checking a fully settled frozen pair separately. No source, shader or threshold changed during this evidence audit.

All first failure reports, the old fa6 bytes and prior137 report retain their hashes. The pre-actual note/freeze are archived under `baselines/aces2-output-default-drawbuffers-pre-actual/`; the new actual evidence is bound separately by `aces2-output-default-drawbuffers-verified.json`.

## Settled scene comparison and actual extended-range witness

The subsequent `aces2-scene-day-settled.json` and `aces2-scene-blue-settled.json` both have **sameFrozen/sameRangeExtrema/baselineSettled/candidateSettled=true**. The frozen time, camera/target, C/P and complete smoke snapshot are identical within each legacy/candidate pair. Day uses C0/P−1 with temporal stillFrames81→87 and unchanged historyFrames1271; blue uses C16.5/P10 with stillFrames44→50 and unchanged historyFrames354. Both pairs report frozen history and zero artificial jitter.

Independent inspection confirms matching minRGB/maxRGB/maxAbsRGB, size and nonfinite/negative counters in **opaque, composed and reflection** buffers, each1920×1080. All three buffers have zero nonfinite/negative components in both pairs. This closes the earlier not-yet-settled *range-level* comparison. It is not a full-frame pixel hash or legacy/candidate master pixel equality test: extrema/counter agreement can miss spatial differences. The earlier first-report `sameRangeExtrema=false` is retained as historical evidence, not rewritten.

The blue settled report additionally contains an actual native HDR **8/8** copy with `requireExtended=true`. Source and the same real WebGPU presentation texture each contain **7909 RGB channels above1 across5398 pixels**, maximum encodedRGB **1.490234375**. All8294400 RGBA channels remain **bit-exact** in flipRows order; source/destination alpha are1, RGB finite/nonnegative, GL entry/operation/restoration lists empty, and before/after current programs are live/not pending deletion. Thus retained >1 output is now directly demonstrated for this observed real700nit/browser-white280 scene, rather than inferred from a day image that contained no extended values.

Its configured linear peak ratio is2.5, with one-OETF encoded reference1.4904707738. The measured half-float maximum decodes to2.4990823245, or **699.743 reference RGB nit units** using the configured280 white. This is consistent with the configured output/half quantization; it is not panel/source photometry or an independent proof of upstream OETF count. The day-settled JSON has no new native-copy record; its evidence is the frozen/range/temporal comparison. The earlier separate day8/8 native-copy result remains valid in its own report.

All four legacy/ACES PNGs were visually inspected. The day candidate is visibly darker; blue hot points shift from magenta toward pale blue/white and the blue smoke darkens. These are viewable output-look comparisons, not HDR numeric proof, calibrated photographs or default-promotion acceptance. The actual HDR extension evidence comes from the float source/destination readback above. No runtime was modified during this audit.
