# Independent G1 shoreline numerical review protocol

2026-10-28. This is an independent acceptance protocol while the new CPU/WebGL2 candidate is being implemented. The reviewer owns only `verification/r13-shore-independent-*`; no production changes or GPU claims. Final executable checks will target the actual exported API and recorded source hash.

## Mathematical conditions that the tests must discriminate

The conserved state is `U=(h,qx,qz)`, not `(eta,ux,uz)`. Free surface is `eta=h+b`, with immutable bed `b`. A shared face mass flux must enter its two adjacent cells with opposite signs. Wet-contact history is a material diagnostic and may not inject or remove water.

At each face the hydrostatic bed is the maximum adjacent bed. Reconstruct positive left/right heights from each cell's free surface, retain its velocity where height is meaningful, and apply the pressure correction to **that face's normal momentum**. Omitting the pressure correction fails the stepped-bed lake test; applying it to transverse momentum fails the 90-degree transposition test. [Audusse et al., original paper](https://publications.imp.fu-berlin.de/478/1/file_2004_siam.pdf).

For an unsplit 2D Rusanov update, a sufficient basic CFL restriction uses the **sum** of directional rates, for example

`dt * (max(|ux|+sqrt(g*h))/dx + max(|uz|+sqrt(g*h))/dz) <= CFL`.

For spatially varying face bounds, the central positive-height coefficient is `1 - dt*(aR+aL)/(2dx) - dt*(aT+aB)/(2dz)`. A 1D bound applied unchanged to both directions can make it negative. The scalar CFL number and any further positivity restrictions must be declared, not recovered by clipping height or velocity afterward. Numerical dry momentum treatment may be declared; it must not silently erase positive water mass.

## Required strong fixtures

1. **Lake at rest over nonflat and partly dry bathymetry.** Constant eta, zero discharge; include oblique slope, submerged step, dry central island and cells immediately on either side of the shoreline. Compare every h/q component after at least 100 physical steps. Float64 candidate target: absolute h and velocity deviations below a predeclared `1e-10` scale for metre-scale fixtures. GPU tolerances will be separate.
2. **Closed-domain mass.** Nonuniform h and discharge with reflecting boundaries; include thin wet regions and fully dry neighbors. Compute volume independently from `sum(h)*dx*dz`. Include friction/contact memory so these paths cannot change mass. Do not count a large positive/negative clipping term as successful conservation.
3. **Isolated wet cell with diagonal outflow.** One h=1 cell surrounded by dry cells, qx=qz=10h. A mistaken near-unity 1D dt gives negative height in the unsplit 2D update. Verify either a safe bounded step is selected or an unsafe supplied step rejects before publication; no arbitrary h clamp.
4. **Transposition/rotation.** Run a flat-bed or transposed-bed fixture with x/z axes and qx/qz exchanged. At a common physical commit the transposed physical state must agree within Float64 roundoff. This catches mixed face indices and topographic source-component errors.
5. **Small-amplitude plane packet celerity.** On a flat depth, initialize a long, small positive perturbation with matching right-going discharge and enough distance to boundaries. Check movement against `sqrt(g*h0)` before reflections. Repeat with depth changed by a factor4; speed should approximately double. This is an SWE-domain test, not a demand for full dispersive offshore physics.
6. **Shared source phase.** At fixed world coordinates, independently assemble all64 native swell modes from amplitude, k, direction, phase, omega and the declared ramp/current offset. Compare helper height and incoming characteristic/velocity at several absolute times, at origin0 and4000. Do not use a second invented 7.5s sine as expected data. Gain must be linear and zero-swell must be zero forcing.
7. **Nonlinear wetting and return flow.** A sloping beach with a moving wet front must show positive then negative shore-normal discharge, including some water advancing above the initial still-water contour. At a recently wetted dry point the contact history must remain positive after recession, then decay without altering h or q. Its timescales remain authored, not measured sand physics.
8. **Actual ROI.** Sample the actual scene terrain in the declared world-space patch. Measure finite state, h>=0, mass versus measured boundary flux, maximum h/u, and wet-front displacement. A visually plausible 1D reference does not substitute for real2D geometry.
9. **Grid sensitivity.** Same forcing, world ROI and observation time on192/256/384 grids, or bounded smaller analogue while developing. Compare shoreline/front extrema, integrated discharge and volume at common coordinates/times. A result that changes materially with grid cannot be called calibrated. Hydrostatic reconstruction can fail for some slope/grid/depth combinations, so include thin-water-on-steep-bed stress. [Delestre et al., primary counterexample](https://arxiv.org/abs/1206.4986).

## Clock, transaction and API checks

- Use a fixed physical origin and full published ticks. Render targets at30/60/120Hz must not split the last physics step differently. If adaptive CFL subdivisions are used, they must depend on the state and fixed physics-tick boundary, not the rendering frame boundary.
- `requestedTime`, committed time/tick, pending lag, max steps and incomplete completion must be explicit. Repeated same-target calls finish catchup without double stepping; repeated already-completed fences must not change density.
- Invalid targets/configuration/arrays reject without mutating C or requested time. Test getter exceptions and a mutator called reentrantly by an input getter, if such inputs are public.
- Snapshots and returned arrays must be detached from internal state; constructor inputs cannot remain mutable aliases.
- CPU commit failures retain the pre-failed committed arrays, counters and clock. Earlier successful commits may remain if that is the declared contract.
- GPU rollback requires an untouched committed target. Two alternating targets alone cannot promise rollback after a later stage overwrites the old front. Verify source/fake-renderer target transitions independently; actual numerical GPU validation remains a later run.
- Max height and speed should be reported together with the CFL bound. If a fixed GPU dt assumes configured bounds, violating those bounds must report failure or require a new safe step; it must not force the water into an amplitude/velocity clamp.

## Scope limits

CPU mass/positivity/cadence passes do not establish real foamy-wave appearance, reef attenuation, optical energy closure, main/reflection coherence or frame performance. A narrow SWE patch is a hydrostatic nearshore approximation; it does not resolve overturning, 3D turbulence, bathymetric diffraction outside the patch, or all intermediate-depth wave dispersion. Source phase agreement proves common forcing, not absence of interface reflection. Those limitations remain visible in the report.
