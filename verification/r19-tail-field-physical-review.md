# R19 independent physical review of the actual tail-field helper

Reviewed frozen runtime source hashes:

- `firework-tail-field.js`: `4c19f88ad0083e3e0426464a1ee90facc9a107a5577f873ffe1cbc2a68d4977e`
- `fireworks.js`: `c78afe6600a31d07b27751cec70e21fe28be68e2095bfc613cf071e42f2ae262`

**11/11 CPU checks pass. No new blocking defect found within the stated linear-drag, gravity and held-wind contract.** This review changed verification files only and ran no browser, GL context or GPU work.

`r19-tail-field-physical-check.mjs` imports the actual frozen helper and physics modules. Its independent position oracle walks the held-wind intervals sequentially and solves the local ODE without calling `sampleBody` or `windResponse`. It then differentiates those independently calculated positions numerically; it does not copy the production `dq` expression as its reference.

## Results

- 180 held/changing/empty-wind, zero/tiny/positive-drag, zero/standard-gravity, parent/child cases over lag `0..0.88`: maximum position error **4.2632564e-14 m** and five-point derivative error **1.4309975e-10 m/s**.
- At a release-time wind knot, including duplicate knots, the actual helper matches the **right-hand** derivative. Left and right differ, as expected. At an observation-time wind knot, separate three-point left/right derivatives agree with the helper to **7.0940489e-8 m/s**.
- 36 causal optical-anchor cases, including 18 virtual birth anchors, query no state after the physical observation time. Import-only tracing of the actual sampler confirms its two direct calls are the source at `t-lag` and the real aged ember at `t`.
- Root/parent pose edits affect fresh samples. Static lag coefficients remain static. A changed source birth rejects a stale descriptor, and the actual FW cache creates a replacement descriptor.
- The actual FW view and anchor caches remain within four shutter entries; the per-body node map stays below 64 entries after 80 different lag requests.
- Current records retain physical ember velocity; the optical node uses the replenished-field derivative. These are intentionally distinct. Tested nonzero-lag cases differ by at least **0.944 m/s**, so substituting material velocity would be a material shutter error.
- For three shutter choices, actual `getRadianceBound` outputs and complete source traces match a verification-only copy with its wind-memo wrapper removed **strictly**. A tracing callback exception restores the scope; no GL/await is present in that bulk operation.

## Why the derivative is appropriate

For a fixed lag, advancing observation time also advances the release time. The optical field node therefore has both the source's changing release pose and the detached ember's transport response. The source acceleration uses wind at the release time, with right-hand knot lookup. The helper recovers wind-only velocity from the actual ember sample and subtracts the moving lower-limit contribution. It does not mistake the material ember's velocity for the velocity of a replenished quadrature node.

The source-birth guard closes a real lifecycle ambiguity: `node.birth` is a cached static value, so a changed body birth must rebuild the node. Position, velocity, parent state, drag and gravity are read anew by samples; they are not cached poses.

## Limits retained

The tests do not admit arbitrary motor forcing, integrate ground contact intervals, prove a nonlinear spatial shutter trajectory, integrate `T(t)` or receiver/camera/depth history, or establish native performance. Large absolute clocks retain finite states and actual represented ember ages, but `t-(t-lag)` differs slightly from requested lag at finite precision; no arbitrary-epoch exact differential guarantee is claimed. Ground/current-Y support remains an explicit independent limit.

Reports: `r19-tail-field-physical-check.json` and `.log`. The first `b30f0500` / `c6486f5c` review and its first successful report remain under `baselines/r19-tail-field-independent-review/`; final frozen inputs are under `baselines/r19-tail-field-independent-final/`.
