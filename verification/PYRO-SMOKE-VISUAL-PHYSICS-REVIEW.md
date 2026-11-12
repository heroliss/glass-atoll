# 中央黄团：实际图像与有限光源近似复审

**范围：只读复审，不改生产代码。** 已用 `view_image` 实看 `pyro-smoke-scene-hot.png`、`pyro-smoke-scene-cold.png`；另实际查看下列原摄影像素，不以名称或搜索摘要代替图像观察。

## 看到了什么

热烟中最明显的假感是额头附近一团独立、均匀、边缘过于光滑的黄椭球。它与图案外围光点之间没有烟的连续空间层次，像被单独点亮的柔软小灯。黄色本身不是错误：外圈黄星照亮中性烟可以得到黄色散射。爆裂后留在原爆点附近的烟团也合理；不应一律强制它跟着外圈展开。

真实参考的可见差异：

- [Horizon206：单次小烟花后的残烟，CC0](https://commons.wikimedia.org/wiki/File:A_cloud_of_smoke_left_after_a_firework.jpg)：实际像素有不等大小的凸起、薄裂口、边缘卷曲与密度梯度；整体仍可紧凑，并非必须铺满天空。EXIF 为约1/24s、f/1.85、ISO4474、自动白平衡；城市环境光与手机处理影响颜色/亮度，不能据此反推烟质量或 cd。
- [Rolf Broberg：Liseberg 烟花烟尘，CC BY-SA3.0](https://commons.wikimedia.org/wiki/File:Smoke_from_fireworks.jpg)：实际像素有大范围薄层、孔洞及多尺度疏密，背景能部分透过。EXIF 为1/6s、f/3.5；这是整场累积烟，不能要求本场单发也有同样覆盖面积。
- [Optimum 的真实笑脸图](https://www.optimum-fireworks.co.uk/images/glossary/smiley_shell.jpg)在本轮通过原图链接复看；曝光未知、尺寸很小，支持“图案可整齐且平面”，不支持烟量、星光强度或瞬时尾迹长度标定。

参考图只缓存在系统临时目录供观察，未加入 runtime 资产；上面记录作者/许可及原始页面，未改图。

冷烟图几乎看不见原烟团，不足以说明物理烟被删了：实际 JSON 的 hot/cold 都保留18包、airborne20.35、无年龄删除；摄影 C 从16.5升到17.703407EV，约亮2.30倍，背景也一起变亮。它们不是固定曝光的消烟 A/B。低照度孤岛缺少城市填光，冷烟确实可以很难看见，不能为了“展示持久”把冷烟额外做成自发光。

## 两个光学候选：有根据，但都不是精确面积光

当前 `fireworks.js:203` 把一个事件的实际发光 head/tail 账本压缩为一个强度加权 centroid/平均 RGB。legacy 半径是 `age*8` capped28m；moments 候选采用加权 RMS 距离。独立 CPU 调实际工厂：ring seed42、零风、burst+1.1s，I=715.287328参考cd，legacy r=8.8m，RMS r=17.951839m，centroid/I/RGB相同。centroid 内部的 proxy `I/r²` 因此降低约4.16倍，不需要改源强。

RMS 是去掉猜测半径的改进，**不是近场精确解，也不是实际 per-star 照度的上界**。令 J=ΣIj、Rrms²=ΣIj rj²/J。在中心，真实标量入射贡献为 ΣIj/rj²；由1/x凸性，它至少为 J/Rrms²。只有所有星都在相同 R 的薄球壳时，中心这个标量才精确等于 J/R²。笑脸眼/口和外圈的半径不同，绿色近星与黄色远星还存在颜色—位置相关性，单个平均色/RMS不能保存这些分布。这里“标量入射”不是球心净通量向量，后者可以因对称而为零。[点光源与逆平方参考](https://www.pbr-book.org/4ed/Light_Sources/Point_Lights)。

`pyro-smoke-renderer.js:125` 的近场 isotropic↔HG 候选解决 centroid 方向退化：均匀薄球壳在球心提供各向均匀入射，归一相函数积分后确为1/(4π)。但是**平面图案不满足球面对称**。正面观察均匀圆环，在环心所有入射 L 与观察轴正交，HG应取 p(0)。当前 g=.32：

| 条件 | 相函数平均 |
| --- | ---: |
| isotropic | 0.07957747 |
| 正面平面环中心，pHG(0) | 0.06171123 |
| 侧面平面环中心，均匀环角数值积分 | 0.09094033 |

所以 iso 比正面真环高28.95%，却比侧面环低；它也不保证变暗，某些原 backscatter 方向会变亮。距离权重不依赖观察方向、两项都归一时，凸混合仍是归一、非负的有界模型，现有 HG 最大值仍覆盖它；但应称有限角源 regularization，不称烟粒子真实 g 改变或笑脸精确近场散射。[PBRT 相函数、方向约定与归一混合](https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions)。

当前 `dot(observer→sample,sample→light)` 配 minus-HG，与 PBRT 两个 outward 方向配 plus-HG相容，本次没有发现新的符号翻转。必须继续各自 A/B：legacy、只 RMS、只 phase、两者同时；固定 C、时间、密度和相机，P各自安全选择并记账。不能看到黄团变暗就认定全近场正确。

## 烟源与求解本身仍是主要形态瓶颈

`pyro-smoke-events.js:35` 仅从 launch/burst 事件注入9个 Gaussian。burst means 限于爆点±2.6m，单核σ=[1.6,1.1,1.6]m，0.075s错开发生；没有沿 burning stars 的位置持续产生烟。`pyro-smoke-state.js:126` 只做统一平移、规定浮升和对角扩散，没有卷涡/entrainment。它能守质量并长期留存，但不会自己长出真实照片的多尺度边缘与拉丝。

另外，每包按 ray 的 optical conditional mean 仅评估一次照明再乘整段 opacity（`pyro-smoke-renderer.js:123–131`）。近场单点光在包内变化很快时，这不是共同 RTE 的精确积分；RMS与近场角源平滑可以降低其误差，却不等于新增了沿 ray 的照明采样。缺少 source→smoke 的自身消光也限制了厚团的内外层次；不能用任意颜色或光强系数代偿。[源到散射点的透过率语义](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance)。

燃烧颗粒沿真实轨迹继续发光/排放，而不是只有一个瞬时爆点；但可见 spark trail 不等于烟量，peony/笑脸也可能比菊/柳少烟。[NOAA 的高速摄影/雷达研究](https://repository.library.noaa.gov/view/noaa/26172)、[厂家对无可见尾迹牡丹的说明](https://www.optimum-fireworks.co.uk/glossary.html)。公开资料尚不足以给这些具体效果分配真实 kg、消光面积或逐星烟产额。

## 最小后续可证伪候选（尚未授权实现）

先验收光学四组 A/B，不加 I、不改烟质量。若中央团仍明显像灯，再独立做一个**空间分布**候选：保留中心爆烟，从相同总参考面积中划出明确作者比例，沿少量确定性分层选择的真实 star trajectories，在固定物理出生时刻注入小烟核；保留来自 launch 的近地烟。比如每次burst额外最多16个轨迹核作为有界首测，所用面积从中心源扣除，不能叠加造烟。不要按 intensityScale 或 audio energy 生成烟量，否则0光对照、曝光独立性和既有质量语义会被破坏。

它需要新的只读 star-source/trajectory 访问，不应把现有音频 drainEvents 伪装成持续源。夹具要测总面积/质心/出生时钟、30/60/120分帧一致、0风长期留存、active slots不延长；同时测实际packet数/overdraw和多角度图像。若它只把黄团散成更多发亮小球，则拒绝，并先研究核分辨率或照明沿程误差。真实目标是有密度层次的烟，而不是持续看得见的光效。
