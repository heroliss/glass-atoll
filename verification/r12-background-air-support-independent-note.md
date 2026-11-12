# Independent CPU support-integration review

Runtime reviewed: SHA256 `6a8f9cdf8344058fc27804e91648d6e05a2407a7d479565c0ea7ced92390312d`.

`node verification/r12-background-air-support-independent-check.mjs` produces the independent report. All seven CPU/module checks passed:

- 12,844 height-integral cases against a stable formula using the least-attenuated endpoint and `expm1`, including horizontal rays, both ground-crossing directions, near-horizontal cancellation, and extreme heights/distances.
- 609 cases against density-normalized piecewise adaptive Simpson quadrature. Normalization prevents an absolute quadrature stopping threshold from hiding a poor relative estimate in thin high-altitude columns.
- Actual six/eight-node shader Gauss arrays have positive used weights and panel-weight sums of two; two panels require at most 12/16 nodes per intersected light.
- 30,000 independent Jacobian/quadrature trials and 81 medium/source-bound combinations passed.
- Actual module defaults to `quadratic`; 12 invalid model values, mixed invalid flag patches, and mixed invalid sampling patches are rejected atomically. The support opt-in persists across ten updates, uses 12/16 nodes by quality, and its raw budget is unchanged across six storage EVs.
- Shared local E is consumed once; the support source contains no extra exposure factor. The original `sourceAt`, `integrateAir`, `coefficientsAt`, and `segmentIntegral` function bodies remain unchanged.

## Exact-arithmetic bound

Let `p` be the perpendicular distance, `r` the effective finite denominator radius (`max(radius,0.1m)` for ground lights), and `h=max(p,r)`. With `s=a+h*tan(theta)`, the Jacobian is `h*(1+tan²(theta))`, and the shared denominator is `max(p²+h²*tan²(theta),r²)`.

If `h=p>=r`, their ratio is exactly `1/h`. If `h=r>=p`, its maximum over theta is `(2-p²/r²)/r <= 2/h`. Each positive Gauss panel sums to its angular length; the two panels together span no more than pi. Density, transmission, cutoff, cone and visibility are at most one. Therefore each source is bounded componentwise by:

`rawRGB * (2*pi/r) * (betaRayleigh*pRayleighMax + betaMieScattering*pHGMax)`.

The units agree with scattering radiance: shared E has stored incident RGB per square metre, beta has inverse metres, the theta Jacobian contributes metres, and phase has inverse steradians. No second scene-storage factor is needed.

## Actionable FP32 geometry concern

The current shader obtains `p²` by subtracting two large squared distances. A deterministic independent FP32 calculation gives:

```text
direction = [0.27724868059158325,0.09560299664735794,-0.9560299515724182]
centre    = [2772.48681640625,956.0299682617188,-9560.2998046875]
closest   = 10000
dot(centre,centre)-closest*closest = 16
centre-direction*closest         = [0,0,0]
```

For radius 0.1m, the first calculation selects `h=4m`, despite an exactly zero residual in the simulated arithmetic. At closest approach, the actual finite denominator is 0.01m², so Jacobian/denominator is 400/m, versus the claimed `2/h=0.5/m`: the per-node proof's geometric premise fails by 800 times. This does not establish that the final aggregate bound is exceeded or that the actual GPU uses this operation order. It does establish that the exact-arithmetic proof alone cannot certify this floating-point expression, and the altered mapping can miss a narrow near-field peak.

Action: compute the perpendicular residual first (`centre-direction*closest`) and then its squared norm, and add a far-collinear small-radius actual GPU fixture. This review made no runtime edit and claims no GPU acceptance.
