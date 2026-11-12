// Current calibration checks use the original vendor OutputPass as an independent oracle.
// The old relative-headroom fixture/runtime are preserved together in baselines/.
export {runHDRCalibrationCheck as runHDROutputCheck} from './hdr-calibration-gpu-check.js';
