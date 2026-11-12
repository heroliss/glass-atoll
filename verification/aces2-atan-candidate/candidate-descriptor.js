// Generated QA metadata; not imported by production.
export const ACES2_ATAN_CANDIDATE={
  "schema": "glass-atoll.aces2-accurate-atan-candidate.v1",
  "version": "range-reduced-taylor17-v1",
  "nonOfficial": true,
  "productionIntegrated": false,
  "indexSHA256": "215f3e39a95c333879d24a62fd9b6bdfd23abd3ba8eca9165c183beb06fbdb48",
  "stageHelperSHA256": "e3b538f2d9b4d521b831836055a1888e8f85b8251f697b833495f44f9a032b55",
  "mathSHA256": "565860bc7bbb5a1f9b4cce3e53609a311fe260e14dd2968ef28533dfbfa30d19",
  "generatorSHA256": "f6b98886ddf7a40f420596dfa80c925162c79337014be4330c91f16420530732",
  "officialSeals": {
    "aces2-gpu-check.js": "423ed607411bb213cdedd318e96d60e2a23e049415e00a02a34324a2819c5496",
    "aces2-stage-gpu-check.js": "725ddf0139306afffc40d4535b293170e7811bb32473300b225288f346667642",
    "aces2-oracle/export-report.json": "dc28a8de0cb7bb582c07ade5690c913d67b7f1df220f135b8f2fd3c28b24d1c9",
    "aces2-gpu-first.json": "682d1c51d227552bee7af07f5b2e0b6c93fbf531b4d3a90b299bb22ae4d3708a",
    "aces2-stage-oracle/stage-report.json": "4fb23a9563bb939d4c0e2d50f9431be8c0c2e5abfcb9eef032b48a5691d8ee59"
  },
  "sourceTransforms": [
    {
      "peakNits": 100,
      "officialFunctionFile": "aces2-100-official.glsl",
      "officialFunctionSHA256": "38b78efcb0d7d8eace7e906cc19defdf42d72ad54a2f06d2c81d4ce503b16b44",
      "functionFile": "aces2-100-accurate-atan.glsl",
      "functionSHA256": "795e20a505ffd09752441ea33446fb35cff54d99ddc3fdfdaf0669e945a99b74",
      "probeFragmentFile": "aces2-100-accurate-atan-probe.frag",
      "probeFragmentSHA256": "63c5e4a0f7ab615080500caba384e6047c8862037987d93ebdd4dcbe1f8b292d",
      "replacement": {
        "from": "atan(Aab.b, Aab.g)",
        "to": "qaAccurateAtan2(Aab.b, Aab.g)",
        "count": 1
      },
      "prefixSHA256": "49dd358bfdf956aa14aa14dcff89775c4e662e4024bcbe7e71bb5df178c40552",
      "inverseExact": true
    },
    {
      "peakNits": 700,
      "officialFunctionFile": "aces2-700-official.glsl",
      "officialFunctionSHA256": "43d3fa65412f678490a15ae1394adeaf14d32dafd57c5612917a056937256b62",
      "functionFile": "aces2-700-accurate-atan.glsl",
      "functionSHA256": "d5540babf48b69a245a48b027863fe347d725fe4d5dbfa33d69a20a3f71e9414",
      "probeFragmentFile": "aces2-700-accurate-atan-probe.frag",
      "probeFragmentSHA256": "5de2b32d6be0c681e0a0a78bf0155c529185a82e98f4b63e740259cdc89d0490",
      "replacement": {
        "from": "atan(Aab.b, Aab.g)",
        "to": "qaAccurateAtan2(Aab.b, Aab.g)",
        "count": 1
      },
      "prefixSHA256": "49dd358bfdf956aa14aa14dcff89775c4e662e4024bcbe7e71bb5df178c40552",
      "inverseExact": true
    },
    {
      "peakNits": 1270,
      "officialFunctionFile": "aces2-1270-official.glsl",
      "officialFunctionSHA256": "36c2cbc64f541577153a33eab0948bd69405b4c71c5bb0229fb391f9e8a56891",
      "functionFile": "aces2-1270-accurate-atan.glsl",
      "functionSHA256": "8f8db65e8ed5a676ba54c52af52f0839bb41a6df302118e9b9734bbafcbcd815",
      "probeFragmentFile": "aces2-1270-accurate-atan-probe.frag",
      "probeFragmentSHA256": "ca1a89b9ab634227d31cc1eee99d19b18f6976bfb63c22d15bed985ac9950577",
      "replacement": {
        "from": "atan(Aab.b, Aab.g)",
        "to": "qaAccurateAtan2(Aab.b, Aab.g)",
        "count": 1
      },
      "prefixSHA256": "49dd358bfdf956aa14aa14dcff89775c4e662e4024bcbe7e71bb5df178c40552",
      "inverseExact": true
    }
  ],
  "unchangedRawGate": {
    "absolute": 0.00002,
    "relative": 0.0002
  }
};
