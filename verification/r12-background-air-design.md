# R12：天空背景遗漏局部空气散射

## 因果与范围

实际 `r12-thermal-1p1_detail_thermal-greybody.png` 的海平线以下有棕色局部空气光，以上直接黑掉。父代理进一步用同机位“关闭有限空气”消除了整条棕色截断。代码的两个早退与此一致：半分辨率积分遇到背景深度直接写 `S=0,T=1`，全分辨率合成再次直接返回天空原色。这样既跳过了已由天空着色器处理的太阳，也跳过了天空着色器并未处理的烟花/地灯/手电局部光。

因此不取消天空全部旁路。候选只补局部源：

`L_background = L_existing_sky + ∫ T_view(s) E_local(s)[βR(s)pR + βM(s)pHG] ds`。

积分内部 `T_view` 衰减新增的局部散射。最终天空原色不再乘T，也不加第二次太阳S。局部E直接使用现有 `localIncident`：有限半径、有限范围、光锥、手电阴影、共享RGB与一次存储曝光P。没有给烟花、天空或画面另加亮度倍率。

只修改 `aerial-perspective.js`。原版 `sourceAt/integrateAir/coefficientsAt/segmentIntegral` 源文本完全保留；父代理负责main的QA开关、原始辐亮度预算与实际A/B。默认 `backgroundLocalScattering=0`，并未提升为推荐/默认效果。

## 自我反证与采样

- 直接让背景走全部opaque公式会重复太阳T/S，否决。
- 只在海平线涂一条柔光/屏幕渐变没有世界坐标光源，否决。
- 新增每像素全分辨率独立体积通道可以补缺，但性能代价过大。当前复用现有半分辨率MRT和两次draw，没有新增纹理、sampler或历史缓存。
- 背景局部S的alpha标记为−2；旧的空背景为−1，opaque为正视深度。合成只混合同类样本，避免太阳S或opaque T向天空泄漏。混合2×2块没有有效天空样本时，以当前固定1–8步全射线积分回退；没有随机抖动。
- 保留既有二次分段中点积分也保留其误差：对很局部的光源，8步可能漏采或过估，尤其最大距离改变、近景到远景路径变化时。本修改没有把它包装成完整辐射传递、连续光路或精确光束解。
- 光源到散射点的空气衰减仍未单独积分，局部阴影仍仅手电有；烟花还是两个共享光簇近似。

## 原始辐亮度上界

新天空S可能比旧 `0.25*localBound` 大；在允许的高湿度和g=.9下，不能宣称旧经验系数总能覆盖新通道。新 `getRadianceBound()` 在flag0、模块禁用或没有有效原始光源时返回maxRGB0，flag1时按每个RGB通道给原始上界，完全不读已乘P的颜色。

对每个光源，`Emax_c = max(0,rawRGB_c)/denominator`；地灯的分母为 `max(r²,.01)`，其余为r²，与共享近场公式一致。范围/光锥/阴影均不大于1，可以保守省略。

Rayleigh最大相位 `3/(8π)`；HG最大相位 `(1+g)/(4π(1−g)²)`。令 `q=max(pRmax, SSA*pHGmax)`，各层高度只降低消光。所有正中点积分权重满足

`Σ T_j(1−exp(−σ_j Δs_j)) = 1−T_final ≤ 1−exp(−σ_sealevel Dmax)`。

所以 `S_c ≤ Σ Emax_c * q_c * (1−exp(−σ_sealevel,c Dmax))`。这个上界也覆盖当前中点离散的过估，有限范围缩小真实贡献不会破坏不等式。它是FP16存储安全预算，不能用于调亮物体或摄影曝光。父代理在原medium预算上加新maxRGB一次。

## API、冻结与验证

- `configure({backgroundLocalScattering:0|1})`，同样接受boolean；非法值在混合patch发生其他变更前拒绝。
- `setBackgroundLocalScattering(0|1)`：便利setter，配置跨update/quality保留。
- `getRadianceBound()`：原始新增天空S上界；`localAirRadianceBound(...)` 为可独立验证纯函数。
- 运行时冻结SHA256：`b552bd2fbe54d347649f6fde422c18e02645827f90d34b7429b26cc4e2089a81`。
- 保存基线：`r12-background-air-baseline-aerial-perspective.js`，仅为独立导入修改两个相对路径；重建原文本SHA256：`4d8c4f29f97c0495df6edd235d2d05e54d29766240d219b0b2e06a74ce9ac201`。
- CPU：`r12-background-air-check.mjs/json` 7/7，含2187个独立相位/变密度/分段/近场RGB上界试验，未改变旧opaque算式。
- 实际GPU入口：`runBackgroundAirGPUCheck(THREE,renderer,{createAerial,createBaseline}={})`，位于 `r12-background-air-gpu-check.js`。父代理在实际renderer运行并保存报告；CPU通过不是GPU或画面验收结论。
- GPU项目包括18个flag0基线全附件字节对照、零光源原天空恒等、太阳0→30背景恒等、同远路径局部S连续、混合深度回退独立射线oracle、暂停重复、54个极端媒质/半径/原色FP16扫描、P一次性与raw预算不变、物理viewport/scissor/frame状态、实际链接sampler数。

没有从小尺寸fixture声称场景照片级、HDR面板校准、烟花真实性、GPU毫秒或60FPS。父代理还需要在相同实际机位对比截断消失、分布自然、数值安全与开销。
