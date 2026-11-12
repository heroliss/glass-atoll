# R29 complete dense-sampled native phases

CPU acceptance is **21/21 phase checks plus 2/2 count-scan checks** in `r29-native-phase-fixture-check.json`. No GPU or browser was used by these generators or checks.

The physical update union is unchanged from R28: 1,120 updates. Additional optical reads cover all 598 original 60 Hz points after burst and all 203 existing observation points, for 801 reads. Every old checkpoint retains its density time/revision, packet and consumer counts, material accounting and merge counts. The +1.18-second original R27 packets, profiles, ledger words/groups and both views' rays remain deep-exact. Optical generation counters belong to the new scan.

The primary fixtures use the actual denser sampled maxima, replacing the earlier 20 Hz peak candidates. Earlier `270`, `385` and `390` raw inputs remain historical and have no expensive reference work attached.

| Literal fixture | Phase after burst | Packets | Main T rows | SH rows | Main pairs | SH pairs | Selected gate draws |
|---|---:|---:|---:|---:|---:|---:|---:|
| `r29-native-phase-source-peak.js` | 2.681963161603079 s | 1652 | 1366 | 1440 | 2,256,632 | 2,378,880 | T: 5 |
| `r29-native-phase-joint-peak.js` | 3.8319631616030847 s | 2258 | 871 | 1431 | 1,966,718 | 3,231,198 | T+SH: 4+6 |
| `r29-native-phase-light-peak.js` | 3.881963161603096 s | 2301 | 845 | 1409 | 1,944,345 | 3,242,109 | SH: 6 |

Reflection really submits zero rows in this camera. Joint pair count 5,197,916 is the sum of different kernels and is not an equal-cost unit. These are sampled one-event maxima, not continuous-time or accumulated-smoke bounds.

Each immutable module exports `R29_NATIVE_PHASE_FIXTURE`, `R29_NATIVE_PHASE_FIXTURE_DIGEST` and `r29CanonicalJSON`. It imports no code and executes no online oracle. One top-level full physical snapshot and one complete 14,000-capacity luminous ledger supply both jobs. Consumers preserve original ordered rays, origins, masks, source metadata and fully padded global constructor uploads. Every active source and density packet is retained. Joint execution must decode once and share the same snapshot/ledger objects across jobs.

All main rows have original-world-double and packed-Float32-double zero-omission finite-column references. All density rows have twelve signed incident SH1 coefficients from the independent 256-node positive-Laplace reference: 19,824 / 27,096 / 27,612 coefficients. Whole-request replays are exactly equal to offline 32-T-row and 16-light-row chunks. Selected 512-node witnesses differ by at most 1.2872e-15 after reference-C0 normalization. C1, including fourth MRT channels, remains signed. Packet mass does not enter this existing average incident-light field.

Both measurement policies use explicit complete-request 4,000,000 ceilings, one-million conservative slots per map, at most eight maps and existing global capacities. Ordinary library defaults are separate. The exact staged packers/planners and all padded upload words are pinned; no new optical formula or lower-density substitute is introduced. Every map rectangle covers a contiguous unique cell interval and full SH final output retains its zero-suffix contract.

The fixture pin for `r29-capacity-staging-pins.json` is the capture-time manifest, SHA256 `f41246811bb6015a76c3d5f26e1fff040085c77a860ef4aed6f078f0b3ab24e7`. Later administrative main/QA metadata changed that mutable file. Exact old bytes were recovered, hash-verified and retained as `r29-native-phase-captured-capacity-manifest.json`; its transparent recovery report is adjacent. The initial source-peak 6/7 failure is retained. Actual code pins and optical gates were unchanged; no fixture was regenerated for metadata drift.

Full module/JSON/digest pins are in each `*-generation.json` and the aggregate acceptance report. Capture SHA256 is `fccc82bcafadcd14f66df41014413925422f4d5c53447ff25123df57f90a3d01`; count-scan SHA256 is `4fbeb483f811f7ce60716af369c3b917c444a5cca9db01315ebdcf8292c02b6e`; generator SHA256 is `0694a1f29e5fa9473b494b18b506220d2aad7c0a0d3adefa35beacb2c87009cd`.

Reproduce acceptance with `node verification/r29-native-phase-fixture-check.mjs`. Generation is separate and intentionally offline; each child has a 150-second worker checkpoint and an owned 180-second timeout. Rebuilding changes timing provenance and the canonical digest, so do not silently replace admitted literals.
