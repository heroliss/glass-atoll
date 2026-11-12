// Explicit authorized clone edits only; all unlisted observer bytes must match.
export const smokeTransmissionCloneEdits=Object.freeze([
  [
    "MODES=['legacy8','adaptive']",
    "MODES=['legacy','fast']"
  ],
  [
    "runAdaptiveTailDenseScenePerformance(",
    "runSmokeTransmissionScenePerformance("
  ],
  [
    "'setFireworksTrailIntegration'",
    "'setSmokeTransmissionMode'"
  ],
  [
    "An adaptive-tail dense sceneobserver already owns this context",
    "A smoke-transmission dense sceneobserver already owns this context"
  ],
  [
    "const savedMode=fw.tailIntegration?.requested||'legacy8';if(!MODES.includes(savedMode))fail('Unknown original tail mode');",
    "if(fw.tailIntegration?.requested!=='adaptive')fail('Keep the underlying tail source adaptive in both transmission modes');\n const savedMode=a.smokeTransmissionMode;if(!MODES.includes(savedMode))fail('Unknown original smoke transmission route');"
  ],
  [
    "glass-atoll.adaptive-tail-dense-scene-interleaved-performance.v1",
    "glass-atoll.smoke-transmission-dense-scene-interleaved-performance.v1"
  ],
  [
    "notExactPairedAB:true,seconds,burstTime,declaredSeed",
    "notExactPairedAB:true,headSource:'adaptive',seconds,burstTime,declaredSeed"
  ],
  [
    "not isolatedtail shader cost",
    "not isolatedtransmission cost"
  ],
  [
    "Tail sampling counts/fallbacks are CPU projectedestimates",
    "Underlying tail stays adaptive; tail counts/fallbacks are CPU projectedestimates"
  ],
  [
    "let currentMode='legacy8'",
    "let currentMode='legacy'"
  ],
  [
    "a.setFireworksTrailIntegration(mode,{resetHistory});currentMode=mode;",
    "a.setSmokeTransmissionMode(mode,{resetHistory});if(a.smokeTransmissionMode!==mode)fail('Smoke transmission route echo mismatch');currentMode=mode;"
  ],
  [
    "mode:currentMode,physicalTime:",
    "mode:currentMode,routeEcho:a.smokeTransmissionMode,physicalTime:"
  ],
  [
    "if((frameNumber-1)%31<2){const f=a.fireworks();row.source=",
    "if(row.routeEcho!==currentMode)issue('Rendered transmission route differs from begin-tagged mode');\n   if((frameNumber-1)%31<2){const f=a.fireworks();if(f.tailIntegration?.requested!=='adaptive')issue('Underlying tail source changed during transmission comparison');row.source="
  ],
  [
    "setMode(currentMode==='legacy8'?'adaptive':'legacy8',false);",
    "setMode(currentMode==='legacy'?'fast':'legacy',false);"
  ],
  [
    "setMode('legacy8',false)",
    "setMode('legacy',false)"
  ],
  [
    "report.restoration.actualMode=a.fireworks().tailIntegration?.requested||'legacy8'",
    "report.restoration.actualMode=a.smokeTransmissionMode"
  ]
]);
