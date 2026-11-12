# R28 independent CPU admission review

This review changes no production files and performs no browser or GPU work. Root owns native GPU dispatch and promotion. Status at this revision: frozen input, candidate, staging, deployed integration and both saved candidate/production hardware receipts have passed independent CPU review. Full coherent fresh-frame and later lifetime performance remain separate.

## Reviewed inputs and code

- Native fixture module `38a796ffe384a8b42e56cd5a03c65f58e81426c9483d79158be45c103ec15adf`, JSON `1d7954b58eef43c53ada4519ffcf2fb1ef375a31518963390c6d0b1447b2d2e1`, canonical digest `809b983e5e87f8c112a919e8f718f316f792619e664941972283e584d0bdd22d`.
- Candidate field `d6852b11217edd0bd29742ddf076ff25f7c3c1602815251fc89e9d1c65a77c7a`; factory `d67d888f531965d037f78cc1d9c7243ede4b17d6da68ea184c4c09f69eac7e85`.
- Candidate tiles `0068d79574db3ff06e4d91329dd0404fd7c06c1c2a464cea3d43e855727aae3a`; supported native state guard `52b934caa5c50073e058324049aaa9c72584fcf89291cd6b3bcdd9b98988f117`.

`r28-native-light-independent-check.json` passed **6/6**. All 755 original committed packets and 1728 ordered Float32 luminous ledger rows are retained, including groups, versions and physical packet state. Global input buffers retain zero suffixes. Receivers remain Float32 world mean and `trace(Sigma)/3`; mass does not enter the existing average incident-light model. The independent positive-Laplace recipe replayed every 755×12 frozen coefficient exactly. Separately selected 384-node witnesses differ from the 256-node references by at most `9.2121e-16` after per-packet C0 normalization. Selected convergence is numerical evidence, not a universal quadrature or floating point certificate.

There are 2973 negative C1 components, including 862 negative fourth attachment channels. Each attachment is `(C0,C1x,C1y,C1z)`. The fourth channel is signed C1z and must not be treated as opacity. This preserves the existing isotropic-Gaussian SH1 surrogate; it does not add anisotropic radiative transport or incoming source-path smoke self-shadow.

## Dispatch and compatibility

`r28-light-candidate-independent-check.json` passed **6/6**. This uses real factories/Three objects with a synthetic CPU renderer, so its word/output comparisons establish routing, complete writes and publication behavior rather than GPU kernel arithmetic.

The old `maxBakePairs` API defaults to 1,048,576 but accepts any positive safe integer. No permanent one-million user constraint exists. Default `maxRequestPairs=null` preserves that option; the new explicit request option affects tiled64 only. Serial-reference retains its original single-pass budget and shader. New default 64 maps covers the full old physical 4096×14000 domain. A monotone cell-count argument and 12,353 maximal feasible source cases found at most 59 maps at the default one-million map-slot policy. These are input-policy proofs, not an authorization to run the maximum domain on hardware.

The current daily policy is separately explicit: request 1,400,000, map 1,000,000, up to 8 maps, maxPackets4096/maxSources14000, anisotropy .32. The fixed native request is 755×1728 = **1,304,640** logical pairs, 27 source tiles and 20,385 partial cells. All pairs are visited exactly once in original packet/source order. The three map rectangles are `(0,0,256,61)`, `(0,61,256,18)`, `(0,79,161,1)`, with 999,424 / 294,912 / 10,304 conservative source-loop slots. One full 256×16 reduction follows. Fixed numerical resources total **1,966,080 bytes**, including 516,096 input upload bytes, three partial attachments and three final attachments.

All expanded kernel/shader strings, material parameters and packed valid input words match the incumbent. The packet packer source matches after CRLF/LF normalization; the initial independent 5/6 report and runner are archived under `baselines/r28-independent-before-newline-normalization/`. That fixture mistake did not change the candidate or invalidate the already passing packed-word tests.

## Publication and cache repair

`r28-incumbent-failed-generation-cache-witness.json` reproduces an existing defect in both modes: success A, failed B after output mutation, then A can revive A's old key over B's target without any draw. Its `witnessPassed=true` is a successful bug reproduction; `incumbentAtomicityPassed=false` must remain explicit.

The candidate clears the old association before a new generation and after any failure. Independent tests fail after every one of three map writes and after the final reduction, then return to A. Each return performs the complete request and restores A's synthetic output; no old key revives partially changed textures. The serial failure case similarly rebakes. Public textures are absent while ineffective or computing. Full final target padding is written zero; a completed all-zero target may be reused for later cold density only with current generation metadata. Switching mode invalidates association. Context loss or replacement permanently retires the object, including hot-cache access. PACK/UNPACK/PBO/COPY_READ and supported Three/native renderer state are restored on all synchronous exits.

## Whole-scene scope and next limits

`r28-lifetime-counts-independent-check.json` passed **3/3** by read-only source/provenance/count arithmetic inspection of the saved N8/contact reconstruction. It does not rerun the physical producer. The +1.18-second source assertions associate the same complete R27 snapshot/rays. All 203 phase records consistently compute distinct consumer products and summary counts.

At the fixed gate phase, main SourceT requests 1,309,170 pairs, reflection has zero submitted rows for this fixed camera, and SH requests 1,304,640 pairs. Their sum **2,613,810** counts different kernels, not equal GPU costs or a measured frame budget. The isolated SH gate can render just its four numerical passes, but cannot establish a full live frame rate.

Later single-event requests exceed1.4m: sampled main maximum **2,243,416** at +2.70s; sampled SH maximum **3,219,099** at +3.90s. The sampled joint maximum is **5,157,272** at +3.85s (1,946,396 SourceT plus3,210,876 SH). Main exceeds1.4m in56 checkpoints and SH in64. These are 20Hz sampled maxima, not continuous suprema; historical N10/no-contact3.986m data is a different scenario. 2645 smoke packets remain after luminous extinction, while requested optical matrices become zero. Reflection0 is specific to the fixed camera and is not a general reflection allowance.

The present gate and any1.4m promotion are therefore a partial repair. Future calibrated larger complete-request budgets or another representation remain possible; neither the user nor this proof fixes the current validation cap forever. No whole-frame, sustained60fps, accumulated/multi-event or visual-appearance claim follows from these CPU checks.

## Concrete production staging review

`r28-staging-integration-independent-check.json` passed **6/6** against all seven entries in `r28-production-staging-pins.json`. The staged field/tiles/guard are exactly the reviewed candidate with only the declared factory name, diagnostic wording, comments and import changes. Host and volume source text otherwise remains exact, including physical event options, source construction, volume shaders, prefix uploads and draw logic.

The tests execute the actual host and volume factory bodies with immediate-callee spies: omitted/default options preserve null/1m/64, explicit daily options forward1.4m/1m/8, and field creation remains lazy until enabled preparation. No GL is accessed. The staged host/volume source imports sibling modules that live in the root project; the test relocates these imports literally in its VM and does not claim direct stage imports resolve. All three main construction expressions retain their original options plus the same explicit daily keys; all other current main text is unchanged. The package change adds only the new guard's syntax target. The initial independent5/6 fixture used an invalid function provider for a trajectory case; its runner/report were archived before replacing it with the required describe/sample object. No candidate/staging code changed for that correction.

This is a green code/integration review, conditional on root's hardware gate before promotion. Eventual deployed source/import relocation and a separate production hardware receipt still require checking.

## Saved candidate hardware receipt

Root's `r28-complete-native-light-actual-gpu.json` reports4/4, four actual numerical draws in one complete bake,36,624 readback bytes and0.92672ms GPU time. `r28-native-light-receipt-independent-check.json` independently passed **6/6** by reading that receipt; it performed no new GPU work. Canonical fixture, candidate/runtime pins, all native generation identities, exact daily constructor, allocations, rectangles, counters and restoration checks agree.

Every one of the755×12 valid coefficient values was rechecked against the frozen offline oracle. Maximum normalized C0 error is `3.5659152071e-7`, C1 vector error `5.9864919898e-7`; the existing.002 budget is unchanged. All angular minima are nonnegative;2973 C1 values and862 fourth channels remain negative. The greatest actual angular signal is `0.00012074626988`, within the independently verified per-packet ideal group envelopes and published global bound `0.0266852455265`. The0.38440481195 maximum own-group ratio matches the reported value. Motion separately owns full partial-witness reconstruction.

The first independent receipt3/6 fixture mistakenly demanded saved JSON decimal values equal an exact Float32 Number. Saved decimal transport differs on1526 words by at most2.845e-16 relative. That first runner/report were archived before recovering nearestFloat32 with a4×binary64-epsilon guard. Recomputed physical metrics match exactly. This correction is not a GPU failure or proof of original signed-zero bits. All valid output coefficients were read; full allocated zero-suffix behavior follows the pinned full-target shader/viewport and separate CPU cache tests, rather than reading every suffix pixel in this bounded gate. The26.8ms instrumented cold CPU submission is not a normal frame CPU benchmark.

## Deployed path and production receipt

`r28-deployed-integration-independent-check.json` passed **6/6**. All deployment file/function pins match the promotion receipt. The seven-file copy differs from staging only by two declared root import relocations and one locked production QA hook. Direct root module imports exercise the actual host→volume→field chain using a CPU renderer, including omitted defaults and explicit daily controls; all three main construction routes retain the same daily keys. Shader/packed input/output routing matches the reviewed candidate. Physics, physical smoke state, volume draw bodies and approved audio remain unchanged.

The separately pinned production wrapper `8249fb55cf13bddf6d2ed8608f82f1c9d1a0e05af58b758c26c40c8b20959261` passed the narrow independent **3/3** source/current-pin/strict inverse review. Its runtime text recovers the candidate exactly after undoing only the identity/import/pin seam. Motion separately reviews the complete helper guard/ownership contract.

Root's `r28-production-native-light-actual-gpu.json` reports4/4, four actual draws,36,624 readback bytes,0.786432ms GPU and26.7ms instrumented cold CPU submission. `r28-production-receipt-independent-check.json` passed **5/5**: current source/functions, constructor, native generation, complete coefficients, angular positivity and raw bounds all agree. All9060 output and96 selected partial nearestFloat32 words equal the candidate. The exact production JSON preserves the Float32 values; the earlier candidate decimal transport needs the documented recovery. One initial independent4/5 fixture compared sentinel metadata before that same recovery; it was archived and corrected, while all full/partial word comparisons were already passing. No GPU rerun was required.

## Historical suite truth

`R28-LEGACY-LIGHT-ASSESSMENT.md` and its **4/4** classification report preserve the current failed legacy results. Exact import/source-read/output-only replays of the unchanged assertions against archived pre-R28 sources give field13/15 and tiles7/8; deployed sources give field13/15 and tiles3/8. The field's two failures are inherited old normalizer/diagnostic-shape expectations. The tiles have one inherited R16 geometry/source fixture mismatch and four new missing-`isContextLost` fake-GL gaps. The current serial shader generator matches pre-R28 after line-ending normalization. These scoped modern passes do not relabel the historical suites green or claim their assertions were modified. Current failed reports/logs are preserved; no pre-run historical report backup is claimed.

The next phase is documented in `R28-NEXT-N8-LIFETIME-JOINT-GATE-INDEPENDENT.md`. In particular, delta0 frozen-scene FPS can reuse an identical SH cache key and does not measure a fresh SH bake. A fresh coherent generation must record actual data association, `reused:false`, counts and bake-counter increase, or component fresh-kernel timings must be reported with that narrower scope. Do not manufacture freshness through version-only mutations.
