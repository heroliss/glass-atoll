# Actual-source smoke lighting — bounded opt-in candidate

Status: approved for implementation, factory defaults disabled. It is not an accepted visual result.

Actual evidence: `smoke-light-field-centre-diagnostic.json` and the independent `PYRO-SMOKE-SPATIAL-LIGHT-PROTOTYPE.md`. At the same actual seed42 event / phase1.1, 45/48 root packet centres have G>R under the120 actual sources, whereas the single RMS proxy is R>G throughout. This is a spatial colour error, not an excess-intensity diagnosis (proxy/full peak ratio median .889). The32/32 Taylor scene is still visually a smooth golden radial shape. Do not fix it by increasing light, opacity or smoke mass.

## One defined approximation

Use a camera-independent, per-packet constant RGB SH1 field from the actual modulated luminous ledger. The packet filter is a normalized isotropic Gaussian with `sigmaPacket²=trace(Sigma)/3`. An emitter is a normalized Gaussian with `sigmaEmitter²=radius²/5`, matching the second moment of a uniform volume sphere, not its exact shape. Add the variances for convolution. This is not an exact anisotropic/conditional-ray RTE, or source-path smoke self-shadowing.

For delta=source−packetMean, d=|delta|, z=d/(sqrt(2)*sigma):

* F0=Dawson(z)/(sigma²*z), with F0(0)=1/sigma².
* F1=[erf(z)−2z*exp(−z²)/sqrt(pi)]/d² * delta/d, with F1(0)=0.
* C0=sum(rawRGB*F0)/(4pi), C1=3g*sum(rawRGB*F1)/(4pi), g=.32.

The angular field is C0+dot(C1,worldRayDirection). Since |F1|≤F0 and3g=.96, every channel is nonnegative, and its angular integral has the normalized SH0 value. Never multiply packet mass into lighting: mass is already in opacity. No nine-node default: the prototype has centre377.7x and rotation31x counterexamples. Use stable small-z series and far-z asymptotics, and independently verify the float shader.

## Interfaces and ownership

Interface agent owns `fireworks.js` plus `pyro-smoke-light-bound.js` and their QA. Add lazy `fireworks.getEmissionLedger({rawPerCandela})`, whose cache changes only with physical record generation/raw scale, not camera or P. Read-only-by-contract packed Float32 data has8 floats/source: `[x,y,z,radius²/5, rawR,rawG,rawB, groupIndex]`. Use **current modulated** intensity and exact currently luminous head/tail records; no unmodulated bound I, visible-camera culling, view transmission, or silent truncation. Return count, version, capacity/data, and at most2 event groups with AABB bounds and sumRawRGB computed from the actual uploaded Float32 rows. Storage is reusable; no required copies per packet. Document buffer lifetime.

Tropical agent owns new `pyro-smoke-light-field.js`, `pyro-smoke-renderer.js`, `pyro-smoke.js` and narrow QA/default inverses. GPU bake raw SH1 once per changed density/source generation into3 RGBA32F MRTs, no blending/readback; upload packet means/sigma² plus the luminous data as numerical nearest-filtered, non-mipmapped textures. Volume vertex fetches those3 textures using instance index and passes flat per-packet coefficients. Existing depth/torch samplers remain; **water stays16 samplers**. Bake only when explicitly enabled; same state/source and changed camera/P must reuse the identical raw field. Host API `prepareLighting({ledger,enabled})` is called before storage P selection. Expose the raw bound and diagnostics through host/volume. Set P only during the ordinary final volume render.

Root owns main/UI wiring and actual scene/performance acceptance. Add only an opt-in flag initially. Prepare field after actual source/medium updates, before radiometry, then bound and select P once. A field-enabled smoke shader **replaces pyro local slots4/5**, retaining slots0..3, ambient/directional/air. Other scene receivers, clouds, existing GI and source rendering retain their current lighting. No duplicate pyro contribution, no source/physics/audio/gain change. Audio4e5 remains locked.

Reference agent owns independent CPU/GPU oracles/rebuttal and QA only, never runtime files.

## Raw bound without GPU readback

F0≤1/sigma², and F0≤2/d² follows from Dawson(z)≤(1−exp(−z²))/z. Thus for packet uploaded sigmaPacket²=b>0 and a source group, with dmin the distance to its uploaded-position AABB:

`sumRawRGB * min(1/b, 2/dmin²)` is an incident scalar upper envelope; use1/b when dmin=0. It remains valid for every additional emitter variance. Sum group bounds, multiply by(1+3g)/(4pi), and maximize across packets/channels. No packet-count multiplier. Allow explicit float error margin for positive sums and shader approximations, documented against bounded source count. This is an envelope for the chosen isotropic SH1 model, not an energy-conservation assertion for the whole scene.

No clipping of luminous entries for cost. If capacity or API support is insufficient, return an explicit unsupported/error state; do not publish a truncated field or pretend it is complete. Validate source buffers, finite Float32 storage and same density layout/version. Clear/disable/retired sources must remove the new contribution immediately.

## Acceptance

1. CPU field formulas/centres/far limits/rotation/colour-position permutation, finite emitter treatment, scalar-group envelope, positive SH and no mass/P/camera dependence.
2. Actual GPU float comparison to independent CPU reference, bound headroom, main/mirror world ray consistency, disable/no residual, zero sources, state/viewport/scissor/target restoration and default branch regression.
3. Same actual event and smoke snapshot/C/pose: old proxy versus new field, raw I/RGB/mass unchanged, natural independently safe P. Preserve failures and raw PNGs. New field may merely produce green blobs; visual review remains required.
4. Measure isolated GPU bake and real scene. Include60×120 and bounded larger packet/source fixtures; stop escalating after50ms GPU. Do not infer performance from Node costs, proxy area, or encoded FPS. No stress test with an unbounded source loop.

The candidate adds a render pass and numerical textures only while enabled. It does not claim DLSS, path tracing, calibrated photometry, incoming smoke self-shadowing, or a resolved turbulent flow.
