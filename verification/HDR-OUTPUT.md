# HDR 显示输出

当前实现和验收说明见 [HDR-CALIBRATION.md](./HDR-CALIBRATION.md)：读取所选 Windows 显示器的 SDR 白/峰值，保留同源 SDR filmic 暗部与中间调，再有界扩展高光。WebGPU 扩展 sRGB 与原生线性 scRGB 的单位不同，不把示例 1200nit 或回退值伪称为系统检测。

旧相对 headroom 版及其 18 项记录仅作为历史实现保留，见 [旧版说明](./baselines/HDR-OUTPUT-V1.md)。其成绩不能代替当前标定映射的独立 oracle 验证。
