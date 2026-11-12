# R34 独立源审查：云密度 exact2 与明亮烟花画面

本轮仅 CPU 算术、源码及已保存证据审查；没有重放物理、浏览器、GL/GPU 调用或生产修改。审查时 `sky.js` 为 `51db558ead3dea10d4c74633c2a8eb5bedf20952c136e0668b97de0a5ffc8eee`，`main.js` 为 `328f997e0b7595388a4564427c0cb8db10beeedb8f881e0bbec3cbb6af1e232b`。音频仍为已批准的 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。

## 云密度边界

只读检查 `r34-cloud-exact-two-candidate.js`（`9953f20098f4b7fc6d901b6d0cb1a99a4d82abc2832eedbf0a99ab6cd5d1128d`）及原 `sky.js:78–151,730–760`：未发现有效依赖被遗漏。候选在共享 detail 采样后仅对**原始 uniform 严格等于2**提前返回，完整原路径留在下方；CPU 对原始 JS 值严格等于2分支，其他值仍走原 clamp 路径。if 的局部作用域避免了 `base/puff/billow` 声明冲突。所有 texture 查找仍为显式 LOD，没有新增隐式导数分歧。

- 必须保留 altitude/高度门、weather、region、shape、detail 与 detailLod、puff 与其 LOD、billow/mass/entrainment、moisture、coverage，以及原乘法次序。detail 仍用于 billow 的 entrainment，不能随 edgeErosion 一起删掉。
- 可以在 exact2 路径跳过 localHeight、heightCost、field/body/inversion/legacy，以及 ascent/log、thermal Gaussian/exp/smoothstep；这只是源码工作量减少，不是已测性能收益。
- `base` 虽原来写在 legacy 段，仍是普通 billow 输出的有效依赖。`baseContinuity>.5 && shape.g>.5 && h<.052` 时，exact2 应为 `billowBody*baseContinuous`，再依原顺序乘 region/moisture/coverage，不能使用普通 base。候选保留了两条不同乘法路径。
- 不能把接近2、blend1、blend0或中间云型直接归入端点。GPU 上传把 JS 数字量化成 Float32：实际非2控制应选 `1.9999998807907104`（Float32 的 nextDown2）或1.75；`2-Number.EPSILON` 上传后已经是2，不能证明 GPU fallback。

正常生成的 UnsignedByte weather/noise 经归一化线性采样；天气控制器把 base 限在100–4500m、厚度250–2200m、coverage0–1、moisture .76–1.2。处于层内的 h 在0–1；legacy 分母至少.60、thermal sigma至少.15，log 输入至少.0001。在有限且不溢出的真实空间/时间/LOD域，这些中间量有限且非负，CPU 的零权重乘法不会改变正的 billow 端点。**仅声明输入有限仍不充分**：例如极大有限 p 的 GPU 平方可溢出；NaN 高度还会绕过比较门。导出的 uniforms 也允许绕开 setter；不能声称候选兼容任意被外部破坏的纹理/uniform 状态。CPU 与 GPU 原本使用不同 altitude/采样数值路径，应分别比较前后，不能把 CPU 本身当逐位 GPU oracle。

[GLSL ES3.00规范](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) §8.3 把浮点 mix 定义成算术混合，只有布尔 mix 明确允许未选分量无效；§4.5.1 允许乘加融合或分步舍入，§5.11 允许部分浮点重结合。因此实数端点等式、CPU 精确相等与完整 fallback 源码不变，均不能独自保证所有编译器逐位输出相同。一个**非实际驱动观测**的 Float32 算术示例：x=.026741117238998413、y=.8656355738639832；直接端点 y 与 `f32(x+f32(y-x))=.8656356334686279` 不同。这只展示求值形式风险，不断言 ANGLE 会采用该 lowering，也不证明这些中间值在本场景被实际采到。NaN/Inf 的零权重乘法则另有未选值传播风险，不属于已声明有限域。

最小实际验收建议：用**完整原 shared density 函数及严格变换后函数**、同一真实 noise/weather 纹理与采样器、冻结的相同 uniform/时间，在小 RGBA32F 密度 atlas 做一对 baseline/candidate；必须有真实非零云密度，而不是夜间黑色成图。第一对 exact2/base0，第二对 base1，明确覆盖 shape.g>.5 且0<h<.052的非零连续云底样本；另用一对 Float32 可分辨的非2控制。点集还覆盖 LCL/顶部两侧、availability门、LOD0与实际视图LOD。逐位比较前先报告所有有限值、零/非零覆盖及真实分支覆盖；如果不等，保存原始差异并定位，不能临时改容差通过。该小门仅证明被测 density 与 fallback，仍不代表完整天空/反射/地表阴影的像素普遍相同或实际性能改善。应复用已有状态/资源守卫，不引入另一个大基准框架。

## 明亮原生烟花：最小复用方案

冻结 `r30-native-replay-fixture.json` 与 browser fixture 的 recipe 完全相同。seed42、真实 production factory、provider-first 更新、N8/adaptive trails、bounded-descent、现有 two-births/Brownian host、风向量和接触模型均可沿用；**只取 recipe 的已有前缀，不注入 expected snapshot**。两个建议时刻都已存在于原 updateTimes，完全不需插值或插入新网格：

|相对爆炸时刻|绝对物理时刻|active updates（另有32 empty）|当前低机位历史 CPU 记录：P / main T / reflection T / SH|
|---|---|---:|---|
|+.70|159.82687017173075|376|396 /1728 /1728 /1728|
|+.85|159.97687017173075|388|515 /1740 /1740 /1728|

历史数来自 `r29-native-phase-camera-1event-counts.json`，仅用于选择初次有界画面，不是当前浏览器计数许可。+.85 的每眼1740与 SH1728确实不同；不可合并两个计数。首选+.70，因为仍有发动机燃烧且包数较少；是否更美仍须查看真实图像。用实际 browser 生产模型重新观察 finite/SPD、质量账本、source/provider与完整 ledger 的关联，并在绘制前捕获实际两眼原始 double rays及完整T/SH计划。不得强制旧计数、稀释粒子/源或把 inert CPU acknowledgement 当真实光学结果。

当前固定 camera 为 `[-157.6425659120671,11.999999999999947,-367.0586520111614]`，target 为 `[110.01852283013451,0,27.000722993261995]`。`r33-user-state-after.json` 仍匹配它。保持原 aspect1209/1292、main与reflection各1209×1292、reflectionScale1/samples2、mainMSAA8、焦距28mm、aperture8、目标对焦、DoF关闭、快门1/120、既有SMAA/temporal/bloom。不能误用旧高机位 reflection0 记录；当前镜面眼须重新捕获水面命中起点。

可复用 root `createR31SceneBridge` 的原对象/fingerprint/安装/还原事务，以及其 `renderFrameSDR` 的真实 `setAir → updateScenePhotometry(0,true) → setAir → water.render → lens.render({sdr:true})`；保留完整 typed padding、每眼新鲜T和同一代共享SH。现成 `r31ImagePayload` 的合法默认 RGBA16F→RGBA8 blit/readback路径输出1209×1292、6,248,112字节、bottom-up的SDR图；保存PNG时翻行，保留源字节与输出说明。它不是HDR面板照片或实际物理nits证明。

现有导出不能直接改时刻重用：`replayR30BrowserNativePair` 固定精确+3.90 browser参考；`captureR31CurrentViews` 也固定665updates、2301P/1399SH/1420records、每眼1402与18数值draw。完整 `r31-native-scene-gpu-check.js` 的源码/函数 pins钉的是旧 main/sky及+3.90契约，现在main已是R33 HDR修复epoch（后续 sky候选更会改变它）。故明亮图需要**新命名、封闭+.70 phase、当前源码pin与真实计数的观察型epoch**，不是给旧 strict helper 塞任意时间/宽松 expected，也不需要再生成一个庞大 golden-state 数值夹具。

普通 `launchFirework({seed:42}) → pauseAtPhysicalTime(burstTime+.70)` 本身有效，但正常 frame 会边推进边渲染；`qaRenderLock` 同时阻止推进与渲染，不能借它实现 CPU-only preplan。`setTime` 是天文时钟，不是回退物理时间。因此单帧有界且保护用户状态时，优先用上述 fresh生产pair前缀和已有安装事务，不清除用户物质、不自动取景、不改亮度或曝光。原+3.90性能记录保持原样；新图的成像成功仍须单独视觉验收，不从稀疏余辉画面或两次冷计时外推FPS。

保持当下已有4m完整请求/1m padded-map/8maps及状态/回滚边界；实际计划依新phase重算，不把旧18draw套入。R31重度仪器化计时包括CPU提交间隙的可能影响，不能据此宣称云函数是全部瓶颈，亦不能无实测放宽后续预算。此笔记未执行任何图像/性能验收。
