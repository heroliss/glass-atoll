# R28 complete native incident-light fixture

CPU acceptance is **8/8** in `r28-native-light-fixture-check.json`. This fixture reuses the immutable R27 physical snapshot and its complete emission ledger: 755 density packets, 1,728 light sources, 1,304,640 pairs. It contains no browser, renderer or GPU result.

The generator reconstructs the full 14,000-source capacity from the original valid Float32 words without changing their order, group indices, source variance or raw RGB. Packet upload is the existing Float32 world mean and `trace(Sigma)/3`; packet mass is deliberately absent from this average incident-light model. Multiplying every packet mass by seven leaves all uploaded words unchanged. Full padded packet/source uploads occupy 516,096 bytes.

All **9,060 coefficients** were computed offline with the existing independent positive-Laplace Gauss-Legendre reference, using 256 nodes and every source for every packet. The bounded worker used 48 chunks of at most 16 packet rows; a whole-request replay reproduced the chunked result exactly. Selected 512-node witnesses `[0,377,754,720,709]` differed by at most `9.080861657035687e-16` after normalization by each packet's maximum reference C0. This is a fixture-specific convergence observation, not a universal integration guarantee.

Each RGB attachment stores `(C0,C1x,C1y,C1z)`. C1 is signed: the fixture contains 2,973 negative directional components, including 862 negative fourth channels. These channels are coefficients, never alpha. The minimum angular value is positive; all references remain under the existing raw group bound. The numerical kernel acceptance budget stays `0.002`.

The complete witness schedule covers all 20,385 partial cells exactly once with three unchanged 64-source maps: `(0,0,256,61)`, `(0,61,256,18)`, `(0,79,161,1)`, followed by one full 256×16 three-attachment reduction. The final allocated suffix must be zero. The prospective numerical texture allocation is 1,966,080 bytes; this count excludes JavaScript, driver and framebuffer overhead and is not a performance result. Fixture `policy.completePairs=1400000` is separate from a runtime constructor's legacy `maxBakePairs` and new request/map budgets.

Frozen identities:

- Canonical digest: `809b983e5e87f8c112a919e8f718f316f792619e664941972283e584d0bdd22d`
- Literal module SHA256: `38a796ffe384a8b42e56cd5a03c65f58e81426c9483d79158be45c103ec15adf`
- JSON SHA256: `1d7954b58eef43c53ada4519ffcf2fb1ef375a31518963390c6d0b1447b2d2e1`
- Generator SHA256: `6ea1664b9d8b92c24cdea42978bc1b1180a3b36a8e35fe4cda59383d4895f98e`

The literal module only defines the canonical serializer, deeply frozen data and digest. It imports no code and performs no online reference calculation. The retained generator has an owned 180-second child-process timeout and 150-second worker checkpoints. Rebuilding changes generation-time provenance; do not silently replace the admitted artifact.

Reproduce acceptance with `node verification/r28-native-light-fixture-check.mjs`. Generation is `node verification/r28-native-light-fixture.mjs --all` and is intentionally separate from normal application loading.
