# R29 current-camera and two-event CPU evidence

Both bounded CPU producer runs passed. Saved provenance/count/ray/material acceptance is **4/4** in `r29-native-phase-camera-accumulation-check.json`. No browser, GL context, optical oracle or GPU submission was used.

The camera comes from `r29-user-state-before.json`: position `[-157.6425659120671,12,-367.0586520111614]`, target `[110.01852283013451,0,27.000722993261995]`, actual 1209×1292 target, 28 mm focal length, f/8, 1/120-second shutter and current focus/storage settings. The unchanged actual terrain, mean-water reflection camera, native producer/provider and N8/contact recipe supply the counts. R27's capture helper receives only the saved current optics substitutions. The single-event physical state at +1.18 seconds remains exact to R27.

| Actual scenario | Sampled phase after first burst | Packets | Main / mirror rows | SH rows | Main pairs | Mirror pairs | SH pairs | Sum of different kernels |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| One event | 3.90 s | 2301 | 1402 / 1402 | 1399 | 3,226,002 | 3,226,002 | 3,219,099 | 9,671,103 |
| Two accepted events, 2 s apart | 3.80 s | 3364 | 3112 / 3112 | 3101 | 10,468,768 | 10,468,768 | 10,431,764 | 31,369,300 |

Equal main/mirror counts do not mean equal transmission. The saved views have distinct eye keys and full-ray fingerprints. Main rays start at the actual camera; reflected rays start at their source-specific water hits on the mean-water plane. Each eye needs its own complete ordered SourceT result and draw lifetime. The existing world-space incident SH surrogate uses one current ledger/snapshot and can be shared across views; it must not be replaced by eye-ray transmission.

The one-event run has 203 optical checkpoints and the same 1,120 physical update union. The two-event run has 242 checkpoints and 1,280 updates, using actual accepted seed-42/seed-43 launches. Its worst sampled matrices occur before any merge. Each of its three requests exceeds four million pairs at 82 sampled checkpoints. These are real nonlinear two-event results, not a doubled one-event estimate.

The existing 4,096-packet capacity is unchanged. One event ends with 2,645 packets and approximately 20.35 material area. Two events emit 5,314 packets and finish at capacity after 1,218 merges, including a forced subset of 875, with approximately 40.7 material area airborne. Pending plans, reserved material, active events and luminous consumers are zero at the final observations. Smoke persists after optical extinction. Packet-mass accounting is preserved under the existing merge model; this is not a new fluid or thermal simulation claim.

The initial count-check 3/4 failure is retained: its fixture incorrectly assumed the public launch receipt exposed `.time` and `.seed`; the corrected check uses returned ID and burst-time fields and the explicit launch schedule. No producer data, model, capacity or optical tolerance changed.

These are 20 Hz sampled CPU count/provenance results. Pair counts across kernels are not equal-cost performance units. This evidence does not admit a two-event GPU run, prove a continuous worst case, or establish sustained FPS. The four-million policy covers the separately frozen single-event primary jobs; it does not solve accumulated smoke or complete current-camera frame cost.
