# 镜头微散射 GPU 检查

实际结果：[advanced-acceptance-gpu.json](./advanced-acceptance-gpu.json) 的 `bloom`，2026-10-26，**8/8 通过，errors 与 glErrors 均为空**。夹具为 [optical-bloom-gpu-check.js](./optical-bloom-gpu-check.js) 的 `runOpticalBloomCheck(THREE)`，独立创建未挂 DOM 的 WebGL2 context，不使用或改变场景 renderer，结束后销毁资源与 context。

128×128 半浮点输入通过实际 `createOpticalBloom`，结果经明确 `highp sampler2D` 的读回拷贝写到 Float32 RT，再用 `readPixels` 检查。因此测量的是运行时五遍散射链结果，而非 CPU 重新计算的输出。

- 常量 HDR `[16,.5,.25]`：各像素 RGB 最大误差均为 **0**。本组值未发生 HDR 截断或颜色比例变化，不外推为所有颜色/所有驱动的精度证明。
- 黑画面：RGB 总和与峰值均为 **0**，没有凭空生成亮光。
- 距边界足够远的单像素点光源，输入 RGB 通量 `[16,8,4]`，输出 `[15.9935827851,7.9967599511,3.9983478189]`；相对误差分别约 **−0.04011%、−0.04050%、−0.04130%**。这是有限分辨率/半浮点链路的近守恒，非宣称严格能量守恒。
- 点光峰值降为输入的 **98.24219%**；中心像素以外的红色能量约占输入 **1.71770%**，4 像素以外约 **0.64140%**。散射是少量重分配，没有叠加一个不受界限的阈值光团。
- 输出全为有限、非负 RGB，alpha 为 1。启用后保存原 target / cube face / mip 与 viewport、scissor、autoClear；关闭后直接返回同一输入纹理，没有额外 draw 或 target 改变。

通量容差为 ±0.75%，足以拒绝未归一化地额外叠加 1.8% 光的实现；本次实际误差远小于该界。点源位于 `[64,64]`，不包含图像边界夹取核的通量保证。报告结尾 `model.enabled:false` / `passes:0` 是最后一个关闭旁路测试的夹具状态，不代表主场景关闭。

此检查不能代替全场景主观镜头观感或 GPU 性能基准。`wallTimeMs` 含初始化、编译和读回，不是每帧 GPU 时间，也不能转换为场景 FPS。
