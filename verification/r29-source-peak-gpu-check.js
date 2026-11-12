// ROOT ONLY: one fixed actual dense60Hz SourceT peak, no variable fixture/caps.
import {R29_NATIVE_PHASE_FIXTURE as artifact,R29_NATIVE_PHASE_FIXTURE_DIGEST as digest,r29CanonicalJSON} from './r29-native-phase-source-peak.js';
import {runR29NativeCalibration} from './r29-native-calibration-runtime.js';
export const R29_SOURCE_PEAK_GPU_REVISION='r29-source-peak-v1';
export function runR29SourcePeakGPUCheck(THREE,renderer,options={}){return runR29NativeCalibration(THREE,renderer,'source',artifact,digest,r29CanonicalJSON,options);}
