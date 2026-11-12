# R28 legacy light-suite recheck

The legacy suites are **not all green**. The current field suite is13/15 and the current tile suite3/8. Their original assertions were not weakened or edited.

An import/source-read/output-only reconstruction against exact archived pre-R28 field, tiles, bound, volume and host sources gives:

| Unmodified assertion suite | Exact pre-R28 sources | Deployed R28 sources | Classification |
|---|---:|---:|---|
| `pyro-smoke-light-field-check.mjs` |13/15|13/15|Same two inherited failure IDs|
| `r16-smoke-tiles-check.mjs` |7/8|3/8|One inherited source fixture mismatch; four new obsolete-fake GL failures|

The field inverse normalizer already fails on its pre-existing prepare/bind API source scope. Its default diagnostics equality also predates projection/bake-mode/proxy-raster metadata. Both failures occur before R28 and remain visible. R28's added options are also outside the old normalizer's enumerated substitutions, so this exact-source fixture needs a separately scoped future update rather than an assertion waiver here.

Four tile checks stop at `gl.isContextLost is not a function`: the legacy fake omits a real WebGL2 method now used for context retirement and full binding preservation. They do not reach the actual render path. The fifth current tile failure is inherited: the old R16 ensureResources fixture contains the original two-component fullscreen triangle/LF, while pre-R28 already uses the three-component triangle/CRLF. R28's serial shader generator matches the pre-R28 implementation after line-ending normalization.

The modern actual-factory/complete-state CPU checks and root-owned full native4/4 hardware receipt cover the new contract. This is scoped replacement evidence, not a claim that the historical suites passed or that the whole scene meets its performance goal.

`r28-legacy-light-baseline-recheck.json` records every original/clone hash and allowed routing change. `r28-legacy-light-assessment.json` verifies those substitutions reverse exactly to the original tests/modules and records each failure category. Replays write only `r28-legacy-light-{field,tiles}-baseline-check.json` and their own logs. Original tests, root production code and current failed result paths remain unchanged by this audit.

The root's legacy runs had already overwritten the normal historical JSON output files before this audit. Current failed reports and logs are now preserved in `r28-legacy-current-failures/`; no pre-run report backup is claimed. No browser or GPU work was performed for this reconstruction.
