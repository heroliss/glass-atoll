# R15 Camera transition handoff

Owned source: `camera-transition.js`; new pure module only. No main/UI/rendering/audio file was edited by this agent.

## Cause and replacement

The old host lerps eye and pivot separately in1.45s. Opposite views can move the eye through the pivot, taking look distance to0 and reversing heading almost instantaneously. Longer easing of that same line does not remove the singularity.

`planCameraTransition` instead travels on an island-centred horizontal polar arc, varies radius/height smoothly, and lifts the path slightly where appropriate. Independently interpolate unwrapped yaw/pitch and positive logarithmic look distance, then reconstruct target from eye+direction*distance. Eye and target cannot collapse midway. World-up orientation has no authored roll. Near180deg ties use a stable side of the island; at most1deg extra arc avoids sign changes caused by tiny coordinate perturbations. The destination remains exact for legal poses.

A quintic ease has zero first/second derivative at rest endpoints. Duration adapts to a conservative planned translation bound and camera yaw/pitch angular bound. Default heading is0.55rad/s (~31.5deg/s); exact180deg takes10.71s, not1.45s. All100 real host preset pairs were sampled against actual exported terrain, including256 terrain samples per planned path and76,020 dense pose steps. Max measured rotation0.54999977rad/s; no exact floor-guard corrections on these paths.

The terrain survey may require extra lift. Per-sample floor guard matches host+.5m/.42m minimum, and pitch limits match OrbitControls [.03,pi-.06]. Invalid target-eye separation is rejected before adjusting terrain. Unsafe requested endpoints/pitches are explicitly adjusted and recorded, rather than secretly advertised as exact requested endpoints.

## Host integration

Import `{planCameraTransition}` from`./camera-transition.js`.

Replace the three linear-transition construction sites (moveTo, frameFireworks, focusLeaf) with one helper:

```js
function beginCameraTransition(position,target) {
  navigation?.stop();
  const plan=planCameraTransition({
    from:{position:camera.position,target:controls.target},
    to:{position,target},terrainHeight,
    reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  controls.maxDistance=Math.max(controls.maxDistance,plan.diagnostics.requiredMaxDistance);
  controls.maxTargetRadius=Math.max(controls.maxTargetRadius,plan.diagnostics.requiredMaxTargetRadius);
  transition={start:performance.now(),plan};
}
```

In animate:

```js
const pose=transition.plan.sample((performance.now()-transition.start)/1000);
camera.position.fromArray(pose.position);
controls.target.fromArray(pose.target);
if(pose.done){transition=null; /* preserve existing final-limit logic */}
```

Host still cancels transition on manual input, stops director before preset switching, and must not let another controller write poses simultaneously. Expand OrbitControls limits BEFORE the first sample or it will truncate an otherwise correct path. `navigation.stop()` flushes prior orbit damping.

### Scale-dependent translational speed

Default maxSpeedMetresPerSecond45 yields up to16.66s for normal preset pairs. Conservative polar bound makes returning from a775m fireworks view take84.55s, which is too long for common UX. Host should pass a scene-scale-dependent limit for distant views, e.g.`Math.max(65, currentEye.distanceTo(destinationEye)*.6)`. This alters position travel only; camera rotation remains bounded by0.55rad/s. Diagnose the chosen bound and verify real runtime transitions. There is no claim that45m/s is a physiological or physical requirement; it is an author default.

## API

`planCameraTransition({from,to,centre,terrainHeight,clearanceMetres,seaClearanceMetres,minDurationSeconds,maxAngularSpeedRadiansPerSecond,maxSpeedMetresPerSecond,arcLiftMetres,turnDirection,reducedMotion,minPitchRadians,maxPitchRadians})` snapshots inputs, returns frozen plan, exposes fresh sampled arrays. `sample(elapsedSeconds)` is deterministic independent of call order/frame schedule, and returns`{position,target,progress,done,floorLimited}`. `diagnostics` contains duration, route/lift, required limits and angular/translation bounds. Reduced motion returns the final safe pose immediately, not a rapid sweep.

## Evidence and limits

`r15-camera-transition-check.json`:21/21 CPU. Initial19/21 preserved as`r15-camera-transition-first.json`; actual coincident-eye validation ordering was corrected and a structuredClone-of-function test fixture corrected. No tolerances widened. New module source hash is recorded in final JSON.

A restart midflight preserves current pose/heading (C0) but starts a new ease at rest, so prior velocity is not matched (not C1). The translation bound covers the planned curve; a terrain guard correction between surveyed points can add velocity. No tree/fixture collision, visual comfort, native input, real frame pacing or GPU performance acceptance is claimed. Browser owner must inspect opposing preset switches, rapid retarget and manual takeover.
