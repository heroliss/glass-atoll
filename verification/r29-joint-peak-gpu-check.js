// ROOT ONLY: one fixed SAMEgeneration native joint peak, no variable fixture/caps.
import {R29_NATIVE_PHASE_FIXTURE as artifact,R29_NATIVE_PHASE_FIXTURE_DIGEST as digest,r29CanonicalJSON} from './r29-native-phase-joint-peak.js';
import {runR29NativeCalibration} from './r29-native-calibration-runtime.js';
export const R29_JOINT_PEAK_GPU_REVISION='r29-joint-peak-v1';
export function runR29JointPeakGPUCheck(THREE,renderer,options={}){return runR29NativeCalibration(THREE,renderer,'joint',artifact,digest,r29CanonicalJSON,options);}
