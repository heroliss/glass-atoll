# R34 烟花亮度与受光链只读根因审查

证据：`r34-three-layer-bright-state.json`、本地已查看的 `r34-three-layer-bright-ui.png`，以及当前生产源码；计算脚本/结果为 `r34-photometry-unit-chain-audit.{mjs,json}`（3/3，CPU-only）。没有创建场景、重放物理、浏览器/GPU调用、参数变更或生产修改。所有“lux”计算都**以现有参考cd被解释为SI为条件**；没有给当前烟花建立绝对SI标定。

## 先区分已经证实的原因

1. **源强本身是美术参考预算，未校准真实礼花。** `fireworks-physics.js:229` 普通星体原值为 `5+rng()*5`，rocket18、palm48；文件开头明确 authored reference cd。`firework-layer-profile.js:39–51` 把复杂分层每一燃烧曲线的峰值Y重新归一到这些原始 I0。三层是分配既有192颗星的颜色、速度和时间层次，未建立新的整枚光度曲线。本次 `referencePeakBudget=1421.2929533421993`，+.70当前 head/tail账本汇总1276.1834435874375，仍是峰预算的**89.7903%**；因此不能把黑暗归因为这个时刻的发光已大幅衰退。
2. **当前几何确实远、小、环境无日月照明。** 实际相机已由autoFrame移动到 `[-133.92069377000928,12,-315.6565680242418]`；本帧cluster中心 `[73.30013833453438,149.10736740302863,94.83484619920455]`，距离479.8355m，RMS半径6.8022m、最大extent10.7877m。太阳−52.20°、月亮−44.57°，均在地平线下。本图不是先前seed42精确recipe，烟包是24个，不是旧powered-bees +.70的396个。当前字段/T仍完整提交1728源，无稀释源造成暗化的证据。
3. **目前未发现单位链中重复除100000或存储曝光造成整体压暗。** cluster颜色 `[1.5344,.7351,2.0499]` 的线性Y≈1，1276指光度权重总量，不是任取RGB最大通道。`RAW_PER_CANDELA=3.6/100000` 是以100000参考lux对应3.6相对方向辐照度的渲染参考。source/cluster/ledger各路径只在转raw时乘一次；P用于FP16存储，然后输出除回P：

   `I * 3.6e-5 * 2^P * (.76 * 2^(cameraEV-P)) = I * .44826624`（本次cameraEV14）。

   P11.75只是存储保护，**不是EV100，也不是调暗相机**；cameraEV在本应用是正号增亮的相对gain。该等式只核查线性比例链，不能替代实际GPU、曝光实现全链、非线性DRT或显示测量。

## 按现有量级，地面和高云本来得到多少光

对现有aggregate isotropic point proxy，忽略空气、云遮挡与场景遮挡，照度为 `I*cos(theta)/d²`；球形近源regularizer在本次远距离地面/云底不起作用。[NIST SP250-95](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.250-95.pdf) 给出光强/照度/距离平方的校准关系，并提醒扩展光源近场及测量几何会偏离理想逆平方，故这里不是逐像素实测。

|位置 / 假设|当前参考值|
|---|---:|
|相机处、法向对准光源的照度|.005543 lx|
|中心正下方地面（149.1m）|.057400 lx|
|岛中心[0,0,0]水平面，含入射余弦，未截断|.027177 lx|
|岛中心，含当前local-light范围截断|.016622 lx|
|最近云底（812.96m），距中心至少663.85m的点光源上界|.002896 lx|

单位反射率Lambert面在岛中心、按现有cutoff、无空气/遮挡的线性输出参考约 `.002372`（再进入实际DRT；不是采样像素）。所以“能看见很亮的小火点，但地面和远云仍接近黑色”与当前**很小的总源强+远近照度差**相容，不需要假设曝光突然坏掉。它不证明现有源强符合真实120mm礼花。

## 各光照路径与真实近似边界

- `fireworks.js:579–593` 的 cluster保留 head/tail全部参考I/RGB总和，RMS半径只是近源点代理。实际有限光点成像用 `I/(distance²*pixelSolidAngle)` 与归一化PSF/快门核，之后乘一次P；不能把点光源像素很白视为整片地面也应同亮。
- `local-lights.js:25–35,74–75` 的native PBR与自定义 water/air共用光源RGB；两个烟花点代理默认range280m，截断为 `max(0,1-(d/280)^4)^2`。本帧岛中心乘数 .611631，280m外严格为零。**这是有限范围近似，不是自然界逆平方定律**；可压暗较远水面/空气/受光物体，应作为具体后续评估对象。但本帧岛中心只损失约39%，不能单独解释所有数量级差。
- `sky.js:287–303,784–795` 的cloud incident 使用同一个参考I×raw、`max(distance²,radius²)`分母、一次HG phase，以及源→云和云→眼两段各自的透射；没有280m硬截断。实际云底比爆点高664m，按当前I只有毫lux级入射，不能期待整片高云如参考大型多发烟花那样被照亮。未发现为同一段路径无理由重复乘T的源码证据。
- 当前resolved smoke走**全部1728条真实发光ledger**，不走RMS点代理给火花附近烟包照明。`getEmissionLedger`只乘一次raw；SH1 moments带散射相位，renderer只乘一次场景P，并将旧两个cluster从这条smoke路径移除，避免双计数。保存态effective、24包、41472pairs，主眼/镜面T均GPU有效且mediumQueries0。`packetVersion116`是光场上传计数，`stateRevision154`是物理密度计数；源码按snapshot+revision校验，不应因两名字的数字不同直接断言旧场被复用。
- 源码中burst事件提供时间/位置/参考energy给音效与烟源；`sampleFireworkEvent`/实际`updateRecords`只给rocket、星头/尾和烟生成发光记录，未见**单独短时高光度burst-flash发光source**。这与用户视频中的初闪可能是不同效果；不能把一条flash峰值证据直接扩大成所有星体数秒恒定强度。音效冲击已获用户批准，不属于此处调整范围。
- 现有三层RGB、烟雾消光/散射、RMS代理、SH1及单次散射仍是显示模型，不是完整光谱/燃烧/多次散射GI求解。“所有东西都被照亮”不能靠增加一条跨整个场景的常数ambient来冒充物理反射。

## 可以引用的现实证据，以及不能据此做的标定

- [FWS2005生物影响意见，NOAA官方域托管PDF，p38](https://media.fisheries.noaa.gov/dam-migration/mbnms_fireworks_biop_opr1.pdf) 说某些空中shell闪光可超过30000cd。**文件实际封面2005，URL含2017不能改称2017光度实验。** 这是官方现象描述，不附本次口径/颜色/时程/测量不确定度；它说明当前约1.3k参考cd不是覆盖现实高峰的充分证据，不能用30000/1276自动选23.5倍，也不能当+.70彩星的持续实测。
- [Colored Light实验论文](https://www.sciencedirect.com/science/article/abs/pii/S1359431116316362) 的摘要明确是在ambient实验条件记录发光火焰并估计光度；本次未取得全文实验几何。不能把其中火焰、实验照明装置或配方测值当整枚飞行shell的光强。这里不涉及材料/制造实现。
- [NIST闪光有效光强说明](https://www.nist.gov/pml/sensor-science/optical-radiation/effective-intensity-flashing-lights) 区分闪光波形、峰值/时间积分与人眼有效光强；同cd数若定义和时程不同也不能直接替换。
- [Debevec/Malik原论文](https://pauldebevec.com/Research/HDR/debevec-siggraph97.pdf) 从多曝光恢复的是到比例因子的radiance；[SPECTACLE消费相机标定研究](https://arxiv.org/abs/1906.04155) 发现RAW/JPEG线性、ISO归一化、平场和光谱响应需要分别标定。普通在线视频还经过未知自动曝光、白平衡、剪切/编码/局部tone mapping和平台变换。即使能看到前几帧过曝，**不能仅由截图RGB倒推真实峰cd**；饱和像素没有保留峰值，移动烟花跨帧也不是同一静态HDR括弧曝光。

现有 `thermalGreybodyCandela(2mm)` 在作者假定2850K、emissivity1与有效投影面积下计算244.01cd（1mm61.00、3mm549.02）；这是内部已存在的物理代理敏感性示例，不是彩色烟花实测。其有效面积/温度未经测量，彩色线谱不能普遍当黑体，当前layer profile也明确只接受reference photometry。因此不建议为了图亮就切此模式或暗中套几十倍。

## 最小下一步建议

保持当前音效、完整source/packet预算、曝光及shader不动，把本帧标记为**技术链路成功、视觉未验收**。构图可独立用更近的机位查看原始效果；它不会校准物理cd。光度方面先明确一条独立、可追溯的“短flash+后续星体I(t)”参考策略，保留现有1×为参考值的诚实UI措辞；只有拿到已知距离/光谱与响应、未饱和且含曝光元数据的测量，才称绝对标定。否则可以以后做有声明的经验外观校准，但必须把它与SI证明分开，并重新检查正源光度预算、HDR/FP16边界、地表/云/烟各链一致性及完整请求容量。

优先核验的具体模型差异是**280m受光硬截断与缺少独立burst flash**，而不是继续调全局曝光或将所有颜色/帧统一乘大数。这里没有证明修改它们就可普遍通过视觉验收，也没有新GPU或FPS结论。
