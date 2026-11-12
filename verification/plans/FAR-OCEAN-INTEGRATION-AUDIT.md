# B5远海接入独立审计

2026-10-27，仅只读研究；未改运行时、B4封存或灯光。本文审查[球形远海候选](FAR-OCEAN-HORIZON-B5-PLAN.md)的接入代价，不将几何假说或数值推导冒充实际GPU验收。500–1500m衔接、180–200km外半径、300km far都仍是待反证的候选值。

**结论：不能只加ring并扩大far。** 常规ring可作为实验，但须先解决语义/有限距离协议；保留主near=.15/far=24000也有可行架构，代价是另存真实远海距离并让后处理显式消费，不能只画背景颜色或伪造clip depth。

## 当前真实接口与优先风险

以下为本次直接读取的源行；新增地灯由root并行更新，本文不改其文件。

| 优先级 | 实际文件行证据 | 对B5的后果/必要边界 |
|---|---|---|
| P0 | [lens.js](../../lens.js):42–45、69–96、189–194 | 水以colour alpha≈.70识别，history为RGBA16F，alpha写**米制view depth**。远水超过65504m会得到Inf，下一帧深度验证失效。必须明确far-water独立分类/历史旁路，或采用可表示的距离编码；不能沿用近水标签却默默溢出。 |
| P0 | [aerial-perspective.js](../../aerial-perspective.js):58–61、166、180–187 | **第二处**HalfFloat深度：scatter.a也写米制view depth，用于双边升采样。>65504m时该权重会失效、可能反复走单段fallback；仅查RGB有限不能排除此错误。需同步修订此深度载荷，不能只修TAA。 |
| P0 | lens.js:42–43、99–136；[water.js](../../water.js):248；[vegetation-motion.js](../../vegetation-motion.js):12–16 | MSAA混合水(.70)与sky(1)时，50%水覆盖得到alpha=.85，既非exactWater又被`coverage()`算成.20植被。远海地平线引入更长的此类边界；必须用实际MSAA夹具验证surface-kind/coverage，而非假设纯色tag始终完整。新增材质也必须写所有MRT，不能留下未定义motion/depth/reactive附件。 |
| P0 | lens.js:270；[main.js](../../main.js):742–745 | pickFocus以depth>.99999判sky；n=.15/F=24km时，约9.231km起的有限表面就可能被标sky。F=300km时阈值也仅约14.286km。Alt点选会被拒绝，普通对焦仍使用重建距离。需显式finite/far-water语义及真实距离，不能把far水当天空。 |
| P0 | aerial-perspective.js:105–107、140–166、175、208 | 当前密度高度是`max(0,p.y)`，积分默认cap12km（配置上限24km），sky谓词实际为**.9999999**。球面远海在局部坐标可为负Y，但径向高度为0；直接复用会错密度，12km以外光程被截。需同地心的径向高度、有限端点与一次T/S，避免远材质先雾化后共享air再雾化。 |
| P1 | [fireworks.js](../../fireworks.js):140–141、269–275；lens.js:328–331 | 主效果在DOF之后，按原opaqueDepth及固定`+1e−6`比较。远端该epsilon不是固定米数，且大于许多D24 bin；只画depth1的远海会让地平线后效果漏出。必须让遮挡查询使用正确有限海面距离/类型；不可采正附着于当前FBO的depth。 |
| P1 | water.js:258–265、318–348 | 当前220m高密网格只是把最外圈拉到XZ±10000m；不是500m内均匀平面。捕获只隐藏现有mesh，新增far mesh须成组隐藏/恢复，排除refraction layer1、平面mirror与影图，避免自反射/额外全海重画。 |
| P1 | water.js:178–204、283–301；[sky.js](../../sky.js):356–368 | 原镜像以y=0平面及其oblique裁面为准，反射方向含全局Y限制；不能无条件外推到球面远水。near镜像保持局部；far使用径向宏法线及独立天空BRDF，并明确其近场物体镜像适用范围。cube视点/曝光标签仍须共享，不能把观察者天空重复当作表面天空。 |

## 相机、背景与精度

main.js:163的主相机是普通透视near=.15m/far=24000m；lens.js:170、179明确以DEPTH_COMPONENT24参加MSAA支持交集，并创建UnsignedInt depth texture。当前不是反向深度或log-depth协议。lens/aerial/water的重建都使用这一普通投影，单独切深度模式会同时破坏多个消费者。

main.js:169–171的230m是距pivot的轨道距离，1500m是target相对cursor的范围，**不是相机世界高度/位置上限**。[camera-navigation.js](../../camera-navigation.js):50、59–65直接平移camera+target，setPivot会扩大轨道约束；main.js:670、841也可放宽。不能据230m宣称远海只需几百米。未来高空机位还须检查controls是否把请求姿态夹回旧maxDistance。

sky.js:342–344、443把天空放在最后、depthWrite=false且clip z=w。维持sky清背景深度1本身正确；应修有限远水的分类，不应让天空写伪有限深度。

普通深度的解析式为`z=nF/(F−(F−n)d)`。只读计算（非实测）：

| n=.15m | F=24km | F=300km |
|---|---:|---:|
| d=.99999（pick sky阈值） | 9.231km | 14.286km |
| d=.999999 | 20.690km | 100.000km |
| d=.9999999（air阈值） | 23.622km | 250.000km |

因此不要把任务中近似提到的`.999999`与实际air的`.9999999`混用。DOF本身在lens.js:224–245直接用重建距离计算CoC，并非采用pickFocus的sky布尔；两者须分别验收。

对D24，局部一bin距离近似`Δz≈z²(F−n)/(Fn(2²⁴−1))`。F=300km时，10km约39.74m、50km约993m、147km约8.59km，147km距离clear仅约8.7个bin。增大F从24到300km在**近场**几乎不改变这个斜率（100m均约3.97mm）；不能简单宣称扩大far本身大幅压坏近处。真正难点是n=.15下远端距离分辨率、FP32重建与后处理阈值。也不应为救远端而全局抬高near，裁掉近看叶片/灯具/投石。

## 能否保留主far？

可以研究两种明确架构，不能混成只改一个常数：

1. **单主投影+ring。** 最容易保留硬件opaque排序，但必须先证明远处D24足够、修两处HalfFloat米制深度、focus/air/tag/效果比较。有限水与稍前/稍后的目标应有独立oracle；若必须以公里级排序容差才通过，应推翻该方案，而不是放宽门槛。
2. **独立远景投影或ray-sphere背景+真实distance载荷。** 主near/far保持；另存远海命中距离（或有标定的归一编码）及水/天空有效性，near opaque按明确域分隔覆盖。TAA对far水显式旁路或用新编码，air/DOF/pick/effects均先查有效finite distance。不能只写alpha1或depth1，也不能把clip z夹到1−epsilon充当物理深度。该方案避免把150km距离压入主D24，但需另计distance存储/采样、MSAA边界及合成成本；新增浮点附件的MSAA支持必须实测，不能继承当前四附件8×结论。

首轮建议先做极简的**有限距离/类型夹具**再选路线，而非先铺200km材质。统一查询至少返回`kind、有效性、viewDepthMetres/rayDistanceMetres`，明确两种距离之间的换算。只用单个模糊“depth”字段，会在DOF的视轴距离、air的射线长度及effects遮挡间产生新错误。

衔接也要真实C2：坐标与法线包含权重导数；球面sag/径向高度用数值稳定表达式，避免数百万米地心量相减丢掉近岸厘米。接缝权重、光路、宏法线和谱方差转换须共享；near现有16sampler已满，不向它盲加far/深度纹理。far统计材质独立预算，保留同一P和captureEV比例，不加第二套曝光或海天补色。

## 最小准入与当前决定

- 夹具覆盖12/50/80/147km有限海面、清天空、前/后目标；水AA开关、MSAA部分覆盖、near/far/leaf交界均验证所有MRT及历史alpha/scatter alpha有限，不仅RGB。
- 保持近岛同相位折射/SWE/焦散/投石/叶片；near geometry不借远海实验改曲率。球面海天切线按实际相机高度和XZ位置对照，不只测试原点。
- 空气采用零介质恒等、同质T/S解析例及长光程参考；DOF/pivot/有限效果遮挡分别测。保持sky旁路，禁止重复太阳/空气消光。
- 最后才做日/月夜、顺/逆光、接缝连续移动及相同配置GPU/完整帧压力。没有性能实测前，不承诺新增≤1ms或60FPS。

**当前只放行合同设计与小夹具研究，不授权B5运行时。** 两份方案可以继续竞争；若完整distance协议成本过高，保留已封存B4，比靠扩far、雾带或伪标签掩盖误判更合适。

读取时核心源SHA256：lens `ae72111225e46af22177b7d477d5aafcff922f21b3de258384dc371d615a848a`；water `7f3ba0f5eaa599ac8cf60dcc299a440d134a708ea336ae7e8999081a883df4c8`；air `4d8c4f29f97c0495df6edd235d2d05e54d29766240d219b0b2e06a74ce9ac201`；fireworks `606d57528ec7c28e36d56734746a00826ef03272aea86ff5e42f6bff29486abf`。行号属于本次读取，不把后续root灯光checkpoint或未来B5实现视为同一源版本。
