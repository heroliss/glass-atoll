// ROOT ONLY: one fixed actual dense60Hz SH1 peak, no variable fixture/caps.
import {R29_NATIVE_PHASE_FIXTURE as artifact,R29_NATIVE_PHASE_FIXTURE_DIGEST as digest,r29CanonicalJSON} from './r29-native-phase-light-peak.js';
import {runR29NativeCalibration} from './r29-native-calibration-runtime.js';
export const R29_LIGHT_PEAK_GPU_REVISION='r29-light-peak-v1';
export function runR29LightPeakGPUCheck(THREE,renderer,options={}){return runR29NativeCalibration(THREE,renderer,'light',artifact,digest,r29CanonicalJSON,options);}
