# R3 管线交叉审查：黑底反射与独立有限距离效果

2026-10-26。**Draft，仅研究，未改运行时、未测候选性能。** 独立复核当前 `water.js`、`lens.js`、本地 Three 混合实现及实机能力快照。结论：优先根提出的黑底/覆盖率反射，能解决透明发光体被天空回退丢弃的问题，并比先合并 cloud 纹理更小；独立 effects 层也合理，但必须同时约定传输起点、混合与唯一镜头处理。详细有限烟层推导见 [R3-FINITE-EFFECTS-REVIEW.md](R3-FINITE-EFFECTS-REVIEW.md)。

## 1. 黑底反射成立，但“腾出一个 sampler”有编译条件

令反射目标清为线性 `(0,0,0,0)`，不画天空；记录预乘 RGB `C` 与遮盖/消光 `A`，水面重建 `C+(1-A)·skyReflection`。纯发光星写 `C=T·Le,A=0`，因此可叠在天空上而不会被旧 `depth>.9998` 判定丢弃。烟写 `C=T·Ls+A·S,A=α`；其中 **Ls 必须已按自身光学厚度积分/预乘**，S 是有限前景空气散射。α→0 时烟自己的贡献须→0。此式是中性烟消光近似，不能表示有色透射或完整多散射。

必须明确以下条件：

- **混合**统一用自定义 premultiplied-over：RGB/alpha 都按 `ONE, ONE_MINUS_SRC_ALPHA`。当前 Three 默认非预乘 `AdditiveBlending` 的 RGB 是 `SRC_ALPHA,ONE`，会把 alpha0 的星完全抹掉。也不能让 shader 最后的 premultiplied-alpha chunk 再把已预乘 RGB 乘0。alpha0/RGB>0 是内部 HDR 发射项，最终浏览器显示仍输出不透明 alpha1。[Source-over 定义](https://www.w3.org/TR/compositing-1/#porterduffcompositingoperators_src_over)
- **天空覆盖**：opaque 物写 A1；alpha-test 细叶保留真实 MSAA 覆盖；主通道叶/水分类 alpha 不得进入反射覆盖。RGB/A 同 UV、同 LOD、同过滤，不能先除 A 再过滤。不按 A≈0 丢 RGB。重建时只把舍入后的 A 限于[0,1]，不能截亮度藏溢出。
- **采样槽**：当前 `uReflectionDepth` 只见天空判定及 debug13；后者也是动态 shader 分支。只删天空判定仍会占槽。须将 debug13 改为覆盖率诊断，并删声明/绑定/全部采样，才能从当前16降至15。RT 深度仍保留作硬件 depth test，不改4096阴影精度。
- **深度/反馈**：镜像 effects 使用原反射 FBO 的硬件 depthTest、depthWrite=false，shader 变体完全不采该附着 depthTexture。depthWrite=false 本身不消除反馈；0MSAA和2MSAA都要测，不能依赖某驱动的独立 resolve 行为。主 effects 写 color-only lensTarget，采原 opaqueDepth；不得同时采 lensTarget 自身颜色，over 用固定功能混合或 ping-pong。
- **最终 mip**：opaque 与 effects 合完后再保证最终颜色 mip 有效；不能采到加效果前的旧 mip，也避免自动生成两次。clear/background/天空可见性、autoClear、viewport/scissor、RT/face/mip 与混合状态须完整恢复。

反射 RGB/A 过滤在方程上自洽，但不等于原“先把天空烘进 RT 再过滤”：粗糙水面的天空方向/LOD 与对象覆盖过滤存在相关性近似。用空场 A0、实物 A1、半覆盖叶边、薄烟、alpha0亮星分别验证；尤其缩放与 MSAA 叶边不能出现黑/亮晕。超出反射视锥的 fallback 另有边界，不能把 clamped UV 的边缘 RGB 拉成长条。

## 2. 空气、DOF、Bloom 各处理一次

**反射传输起点须是水面命中点 P。** 主 aerial 已处理真实眼 C→P；反射星只应乘 P→X 的透射。按海面下 mirrorCamera→X 全程再积一次空气，会重复 C→P，并把负高度密度当真实路径。镜像相机只负责投影/遮挡。它的投影已被 oblique clip 修改；若未来需要深度反解，须使用修改后完整逆投影，不能套普通 near/far 公式。当前硬件深度路线正好绕开此问题。

主 effects 按实际粒子深度计算有限传输：纯发射只加 `T·Le`，不能每颗粒子再加一份空气 S；烟对已含空气背景 B 的式子为 `(1-α)B+T·Ls+αS`。星、尾、烟应统一远近顺序，不能“所有烟→所有 additive 星”固定排序。现 opaque 反射背景未单独做 P 起点空气；此边界保留须明确，不能因新式正确便宣称所有倒影大气已完整一致。

候选顺序 `TAA→aerial→主DOF→effects→一次全场Bloom→SMAA→显示` 可接受，附三项：

1. 当前 lens 实际是 `aerial→Bloom→含DOF/暗角的quad`；新末端 Bloom 必须替换旧位置，不能再加一次。两次归一 Bloom 仍可通过总能量测试，却会双倍展宽；应计 pass 并测脉冲二阶矩/峰值。
2. effects 自己的归一核仅负责真实发光面积、像素覆盖、固定快门与 CoC；广域光晕归共同 Bloom。不能再加同样光晕核。主 quad 当前带暗角，效果也须受到同一暗角一次；否则背景暗了而烟花不暗。
3. 主 DOF 后叠独立粒子 CoC 仍是分层近似，细叶 MSAA resolve 深度也不表示每个样本的遮挡。遮挡/出画面后不能重新归一剩余核，把应被挡住的光补回来。反射不再逐粒子 CoC，沿用水面深度近似要明示；默认 DOF 关不代替正确深度测试。

## 3. 成本、较简单回退与可证伪验收

独立 effects 需主视角和反射各画一次；大烟片 overdraw、排序、有限空气与大 CoC 才可能是主要成本，不能按“两次 drawcall”估算。纯发射可用共享高度密度的解析有限 T，无需每颗8步散射；烟才需要前景 S。主亮芯保留高分辨率，烟可半分辨率深度感知合成。降低粒子表示不能改变同一 canonical 事件的总发光/烟量/时序。统一存储预曝光预算仍是前提：FP32 中间层不保证后续 FP16 合并不溢出。

最小回退不是重新把透明粒子塞回旧 TAA，而是保持此隔离架构，降低烟采样/反射分辨率或限制烟体交叉复杂度，并明确自由飞入烟/云的近似。太阳 cloud-shadow cache 不能代替相机视线的云消光；若不处理粒子与体积云交叠，须标为边界。

| 必须实际验证 | 失败即推翻的假设 |
|---|---|
| 真材质 A0亮星/A1实物/薄厚烟/远星–烟–近星；0与2MSAA；mip/缩放/亚像素边缘 | 默认 blending 自动适合所有透明发射；A0等于RGB0；覆盖率混合永远正确 |
| 实际链接程序 active samplers≤16；反射 debug 生效；无GL反馈；状态恢复 | 删一行采样就释放槽；depthWrite=false允许读附着深度 |
| 无介质恒等、零发射不凭空增S；固定 P→X、只移动 C→P 的解析 Beer 对照 | mirrorCamera距离能直接当真实空气路径 |
| DOF开关/前景细叶/遮挡核；Bloom计数与脉冲展宽；暗角一次 | 总通量近守恒就能证明没有重复PSF |
| 相同物理时刻/UTC/相机/曝光的主视角+倒影+HDR实景时序与 GPU P50/P95/P99 | 实机caps或一次fps读数能证明五档性能 |

R8 仅覆盖被 flash 改变的 receiver 与快速变化倒影水域，并使冻结历史失效；直接粒子不进该历史。此设计解决透明深度/标签的主要结构冲突，仍不是完整体积路径追踪或多层薄透镜。本轮未运行候选，不能据此承诺60fps或无拖影。
