# 近距离火光块状轮廓：只读源码复核

复核 `fireworks.js` SHA256 `d12f74d5b66b4234dab71220a780e1162aa2e83505d8fe8c0cca6184b5d9796a`。未改生产源码、未调用浏览器或 GPU。以下是可检验的机制与候选，尚未把任何一项认定为用户截图的唯一根因。

1. **近景运动头的时间采样最值得优先检查。** `fireworks.js:350–367` 只对有 `aStretch` 的尾迹选择 adaptive 空间积分；scalar head 仍由 `:470` 起固定 8 个快门中点表示。其屏幕运动长度 S 随接近相机增大，点距为 S/8。增加最小 sigma .28→.42 只改善小亮点，并不补齐长运动段。旧10种与新 `sourceStyle` 都走此 scalar 分支；它不是新颜色曲线独有的问题。
2. **尾迹 adaptive 无 fallback 也不代表快门已充分采样。** `:430–436` 的空间尾迹可密集采样，但 S>1px 的独立快门仍只有中心和 ±.387298S 的三点正权重积分；当快门运动与尾迹不平行且 S 远大于 sigma 时，可能看见重复条带/亮片。`legacy8` 或 adaptive 的 global/local 预算 fallback 还会退回8个空间点，形成另一种近景离散亮珠。
3. **存在硬的有限 quad 支撑和近面近似。** `:374–378` 的 extent 为 3.65sigma + 运动半宽 + .65px（可选 AA 再加 .25px），发光 Gaussian 未在边界严格为零。强光经曝光/显示映射后可能放大这一有限裁切的边缘，但需要实际 raw layer 验证。`projectPixels` 对 w<1e-5 截断、中心 clip.w<=.01 完全隐藏；CPU bound 对端点越 near 保守扩大为全屏，实际 shader 仍是中心深度的平面 quad。跨近面时可能突变或非常大 quad，而非正常圆滑物体近面切割。
4. **没有火光贴图像素格采样。** 发光 fragment 使用解析的像素面积 Gaussian（erf 差），不是低分辨率 sprite 或 Nearest 贴图。`floor/ceil` 主要选择积分点/SourceT texel 地址，SourceT 为每源一值，不会给同一火光画出空间马赛克。effects 写入 native-size `lensTarget`（单采样 RGBA16F），之后才 bloom 与 SMAA；opaque MSAA/植被 temporal 不会直接给此 effects pass 多重覆盖采样。
5. **bloom 可放大已有亮块，当前没有硬阈值/最近邻放大。** `optical-bloom.js` 四级尺寸为 1/2…1/16、LinearFilter、正归一卷积，只有1.8%预算重分配；近景更亮时低分辨率 halo 仍可能显形。先对比关闭 bloom 的相同冻结图像，可定位 source kernel 与 halo。不能凭源码断言 HDR/FP16 量化是根因；当前 storage bound 意图避免 overflow，需要实际计数/图像证据。

一个只用于机制说明、不是实际近景捕获的 CPU 一维像素积分计算：均匀快门 S=32px、sigma=.5px、8中点，在中央半段的最大/最小值比约252.9；S=64px、sigma=1px时约835.1；同一64px段取256中点后中央值稳定为1/64。总光量可以保持，但局部轮廓仍出现断续。因此“能量守恒”不等于“近景足够采样”。

## 最小后续选择

推荐先由 Root 的同一近景冻结视图读取 `getRadianceBound({onSourceBound})` 既有输出，记录问题源的 `shutterPixels`、`stretchPixels`、`baseSigma2`、nearPlaneFallback 和 scalar/vector 身份，同时保留实际 viewport、shutter、DOF、bloom、adaptive fallback 统计。该接口只读 CPU，无需新渲染框架。

若亮块与 S/sigma 相关，优先做**仅近景 scalar head 的正权重、像素局部有界快门段积分**候选，保留原8个 emission bin均值，各 bin 内补足空间覆盖；小 S 仍走原分支，不改变总源光度/物理轨迹/SourceT行数。尾迹独立快门另行处理，不能把现有空间 adaptive 当作已解决。必须预先声明局部样本上界与失败路径，不全局提高所有样本数，也不以降低快门/加 bloom 掩盖问题。

若出现完整矩形边缘且 S 很小，则另做有限支撑/近面裁切诊断；不要把上述时间积分候选当成已证实修复。当前 .42 AA 保持独立，它针对亚像素圆整度，不是本近景问题的验收结果。
