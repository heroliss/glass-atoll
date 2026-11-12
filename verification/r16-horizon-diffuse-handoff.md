# R16 residual dawn horizon: one bounded diffuse-air candidate

## Actual isolation

The parent saved four same-pose actual renderer captures: `r16-dawn-{curved,legacy}-air-{on,off}.png`. The dark SKY-side strip persists in all four, including finite aerial OFF. Curving the ocean moves its edge by roughly2pixels but does not remove that strip. Read-only PNG statistics are retained in `r16-horizon-image-isolation.json`: the unobstructed left sky contains the dark strip even without finite-air composition. Therefore the12km finite-air cap and flat finite-air altitude cannot by themselves explain or repair this residual sky band. They remain separate approximations.

The saved dawn sun is−0.300°; direct sunlight at the near-sea source has red transport~9e−7 while the upper-hemisphere physical sky irradiance remains~[.128,.104,.126]. A low-altitude point can receive almost no direct sun while still receiving substantial sky light. The old sky uses a very small fixed diffuse approximation; the finite pass uses none. This is a missing transport term in the simplified model, not a reason to paint a horizon-colour overlay.

`r16-horizon-sky-quadrature-probe.mjs/json` independently compares the old8-step ray, analytic segment weights, cubic/quartic spacing and4096segments. The dense reference does NOT brighten the lowest horizon relative to8steps, so increasing sample count or changing spacing alone is not a justified fix. Those sampling changes were not implemented.

## This candidate only

- Existing hemispherical sky irradiance E is converted to its isotropic zeroth angular moment J=E/(2π): for a uniform upper hemisphere E=πL and all-sphere mean radiance isL/2. This approximation discards incident angular detail; it is not exact anisotropic hemispherical scattering.
- Sky adds J times its existing view-scattering integral exactly once, outside solar/lunar22source gains and before final storageP. The prior tiny fixed diffuse term is disabled in candidate mode, retained in legacy/off mode.
- Finite air reads that same physical J, multiplies by storage2^P once, and adds J*(βR+βM,scattering) to the radiative source. Extinction still includes absorption. It does not multiply direct-sun shadows, Lambert1/π, HG phase or solar22again.
- The hemispherical irradiance is deliberately not recomputed from the already-corrected sky. This is one explicit diffuse iteration, without recursive amplification.
- Existing sky/finite-air loops, samples, samplers, render targets and scene passes are unchanged. No history or random support samples were introduced.12km truncation, flat finite-air altitude, sky ground intersection and water geometry are unchanged in this candidate.

The theoretical basis is the in-scattering source integral of incoming radiance times scattering coefficient and phase. [Bruneton's primary implementation documentation](https://ebruneton.github.io/precomputed_atmospheric_scattering/atmosphere/functions.glsl.html) explains this in `ComputeScatteringDensity` and the following view-ray integration. Its complete method integrates angular directions and scattering orders using precomputed textures. We implement a limited isotropic mean-field closure, not Bruneton's full method. Relevant source extracts are saved under `r16-horizon-diffuse-research-*.txt`.

## Switch and verification

`atmosphere.setDiffuseAirEnabled(boolean)` is exported. False restores the prior tiny sky diffuse approximation and gives finite airJ=0. True enables the one shared source. The parent main wrapper must refresh the environment cube/PMREM and reset lens history before same-pose screenshots because the water reflects that sky. The switch preserves physical irradiance, source clock and camera exposure.

Baseline sources are `r16-horizon-diffuse-before-sky.js` and `r16-horizon-diffuse-before-aerial-perspective.js`. `r16-horizon-diffuse-manifest.json` records exact baseline/candidate hashes. The older R16 reports and candidates remain intact.

`r16-horizon-diffuse-cpu-check.json`:15/15passed. Includes angular conversion, zero/linear response, rejection of invalid inputs, absorption, probability≤1, storageP cancellation, actual atmosphereJ derivation, no feedback, toggle/snapshot restoration, unchanged GPU workload structure and isolated finite integration. Separate R16 copies of existing regressions pass18+14+26+30checks. JavaScript syntax passes.

## Limits and actual acceptance

This source assumes an unobstructed uniform upper hemisphere derived from the existing clear-sky irradiance proxy. It does not solve local skylight occlusion, cloud angular redistribution, higher atmospheric iterations or ground bounce. The existing8-step sky probability quadrature remains approximate and can underestimate optically thick segments.

This file records CPU/source evidence only. The parent must accept or reject actual dawn/day/night appearance, HDR output, shader compilation, context stability and performance. A physical horizon can retain some contrast and twilight shadow; the acceptance goal is removing the conspicuous artificial near-black strip while preserving consistent transport, not forcing sky/water colours to match.

No withdrawn9bb support shader was revived. The accepted fireworks sound is untouched.
