# Default-framebuffer drawBuffers repair

Root's actual one-frame calltrace `aces2-hdr-gl-frame-first.json` localized the first INVALID_OPERATION1282 to sequence1326, the module's finally `gl.drawBuffers` call. It attempted to restore **eight BACK(1029) entries** on the default framebuffer. This driver returned BACK for every queried DRAW_BUFFER slot; the old snapshot loop queried MAX_DRAW_BUFFERS and only removed trailing NONE. The default framebuffer permits a single draw-buffer entry.

The colour draw had already completed, explaining why the observed WebGL→WebGPU image was fully bit-identical despite a queued GL error. The observer/copy did not generate that first error. The earlier137/137 fixture used owned offscreen render targets and did not establish default-canvas correctness; its report is retained with that boundary, alongside the first failure reports and actual trace.

Only the snapshot count changes:

```
framebuffer===null ? 1 : gl.getParameter(gl.MAX_DRAW_BUFFERS)
```

Offscreen query/trim/restoration logic, every colour shader/table, numerical gate, target setting, observer and bridge remain unchanged. The entire prior module is byte-preserved in `baselines/aces2-output-before-default-drawbuffers/`; the strict single-difference inverse restores SHA `fa6f4e33…` and rejects missing/duplicate/unrelated changes.

`aces2-output-check.mjs`: original **12/12** offline guards pass. `aces2-output-drawbuffers-check.mjs`: new **4/4** source/protocol checks pass, modeling the actually observed all-BACK response, requiring exactly one default entry and preserving offscreen results. These are not new GPU validation. Root must repeat the137 fixture **and** actual native-frame/calltrace to verify the1282 repair. Old GPU reports/preparation freeze are not replaced or relabeled as validation of this change.

New module SHA: `8888e2dc0d48ba507b876075391dc58f7f8b260b7bb512f07a0afd7e3ec36cd2`. The independent new fix freeze is `aces2-output-default-drawbuffers-fix-freeze.json`.
