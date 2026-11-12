# 第二轮：mortar shell、燃烧实体源图与预算继承

2026-10-27。研究/反例，不改runtime。本轮先完成ring候选actual验收；此合同供下一阶段source coverage定案。音频4e5、现有高度、光强、轨迹均不改。

## 1. 先纠正设备语义

**不能由源码变量`rocket`推断持续火箭发动机。** [美国DOE官方说明](https://www.energy.gov/articles/5-facts-about-fireworks)第1点明确区分管内lift charge、上升中的time fuse、到达高度后的burst。[APA官方术语](https://www.americanpyro.com/glossary-of-pyrotechnic-terms)把aerial shell定义为由mortar抛射，把comet列为独立的燃烧拖尾效果。[美国CSB委托的原始部件检验报告](https://www.csb.gov/assets/1/20/analysis_of_pyrotechnic_components.pdf?15271=)§2/Fig1也区分自行推进skyrocket与mortar-fired aerial shell。这里只使用装置分类，没有采用报告中的制作/测试程序。

所以本项目合理的默认解释是**被发射后按弹道飞行的礼花弹**，并非有持续推力的发动机。fuse可能排少量烟，但现有资料没有给本站该fuse的可视排放率；不能把未知fuse替换为很浓的发动机尾烟。附着的上升comet可以存在，但必须是另一个明确作者选择的燃烧实体，不能从所有shell的亮头/拖尾图像反推其存在。APA的[效果术语](https://www.americanpyro.com/display-fireworks-glossary)描述了某些palm的上升comet，也不意味着当前所有类型都具有它。

这些primary已读取：DOE正文；APA两页正文；CSB PDF引言/分类段。NRCan手册本轮直接403，只列为检索背景，不将未读全文细节写入合同。物质/轨迹排烟依据仍是[Keller & Schragen2021](https://onlinelibrary.wiley.com/doi/10.1002/prep.202000292)对高速effect-star细颗粒轨迹的原始研究；它不能标定本站每类源量。

## 2. 目前physics有什么，缺什么

| 实际源码 | 已有事实 | 不能当作fuel metadata的字段 |
|---|---|---|
| `fireworks-physics.js:35–49,124–141` | `flightSegment`只有初速、gravity、linear drag和风；`rocket`是该弹道的carrier，life约等flight time | `kind:'rocket'`、radius .023、intensity18、thermal colour不证明有发动机、fuel或持续thrust。 |
| 同文件`:13–30,139–170` | root/child有稳定body id、birth、life、parentBody、split，以及trail/strobe/colour等显示属性 | life是当前作者燃烧/显示寿命，不是剩余燃料质量；光包络/strobe暗帧和tail=false不定义排烟开关。 |
| 同文件`:161–170` | fan有9个依次出生的comet-like运动体；bouquet有104个近地发射星；crossette36母星各分4子星 | fan9次launch、bouquet1次launch不等于9/1个持续燃烧体；parent/child没有已校准物质继承比例。 |
| `fireworks.js:288–302` | provider只保留真实root和已发生的event采样；child被`!parentBody`排除 | 当前provider不是全燃烧实体sourcegraph；render emission ledger含可见head/tail样本，也不是fuel source graph。 |
| `pyro-smoke-trajectory-events.js:18–29,57` | 分离炮口/central/root的作者面积预算；fan81/bouquet9炮口packet；ring-only连续life候选 | packet数量、作者参考面积、灯光cd、音频energy之间没有已测物理换算。 |

**明确缺失：** deviceClass(mortar shell/skyrocket)、fuel/residual material、sourceClass、每类参考干排放量与归一排放曲线、fuse的燃烧/排放元数据、可选ascent-comet身份、parent→child剩余预算分配、spark shedding是否为独立燃烧实体。不要以变量名和视觉函数自动填充它们。

## 3. 最小logical-body source graph

每发只有一个事件根；source IDs以`eventId + component + logicalBodyId`稳定识别。把参考干消光面积A作为作者设定的可加预算，不声称真实kg/燃料质量。建议如下，尚未实现：

| 节点类 | 时空归属 | 建议预算语义 |
|---|---|---|
| `lift-puff` | 真实launch时间/炮口世界位置，有限短释放 | 保留已有独立炮口预算；9packet只是数值离散，不是9次物理发射。 |
| `carrier` | shell弹道承载器 | 不自动排烟。它提供fuse/comet的位置，不把一次抛射当持续发动机。 |
| `fuse` | 若有明确启用，沿carrier、实际点火到burst的有限窗口 | 缺排放数据时默认不新增；或标记为极弱、独立作者预算。默认0是保守建模选择，不是宣称现实fuse零烟。 |
| `ascent-comet` | 仅明确选择该效果时，独立body/窗口，沿carrier或真实comet轨迹 | 单独计入该效果的作者材料预算；不能从render tail自动创建。 |
| `burst-puff` | 真正burst点/时钟，少量中心热产物 | 与payload-star燃烧预算分开；可有短期膨胀profile，不把shockfront当烟壳。 |
| `star` / `ground-comet` | 每个逻辑燃烧体的birth到burn end，逐过去source-cell采样 | 每体参与权重、预算或cohort；不要求每体在每个时刻各自占一个完整Gaussian。 |
| `split-star parent → children` | 母星到真实split前；子星从真实split后各自路径 | 继承母族剩余预算；额外split闪光/小爆裂只在明确独立预算时新增。 |

同一Gaussian/cohort可以代表数颗星，但必须有完整cover mapping：每个符合排烟类的逻辑body在其燃烧期都有正权重归属，权重归一且不因相机、draw数、trailSegments、画质或P/C变化。近看48代表未必保留120条细路径，是明确空间近似；“全逻辑覆盖”不能宣传成“每星独立流体”。世界空间/物理时钟的cohort可随尺度合并，renderer只是消费者。

### 预算与继承不变量

对作者总预算`A_event`：

`A_event = A_lift + A_fuse + A_ascent + A_break + A_payload`。

某类未启用则明确为0。推广source覆盖的首次因果A/B应先保留当前同类型总A，重分配到更多真实路径；若之后增加总烟量，另立作者校准实验，不把加密自动等价更多物质。

对payload族f，`Σ_body A_body = A_family`；每body的非负排放曲线归一`∫ rate_body(t) dt = A_body`。父体在split前已排出`A_emitted_parent`，四子体共得`A_children = A_family − A_emitted_parent − A_explicit_split`。四子不是各得原母体的完整预算。若这些只是作者参考材料而非燃料，该等式仍用于预算一致，不冒称化学质量平衡。

特别是当前crossette母星life=.78 s正好在split结束，不能先把**整族**A按其life积分全部花完，再声称child“继承剩余”——那会得到0。需要新显式`parentShare/childShares`或等价的族预算分配元数据；它们目前缺失，须作为作者输入，不能由剩余显示life自动猜出。

不同sourceClass可有不同profile/温度/初始横向尺度/膨胀参数，但均标作者设定。均匀life排放是首版可检验假设，不能由恒定星亮度证明；strobe暗段可能仍在燃烧，应按材料profile而非显示光包络决定。若某种shed spark将来成为独立逻辑燃烧体，必须从其父体预算扣除；只为摄影拖尾增加的采样段永远不产生新A。

## 4. 最容易出错的反例

1. **carrier名字错推源：** 仅给`rocket`每秒排烟，会给每发mortar shell凭空加一台持续发动机；当前轨迹没有该推力/燃料模型。
2. **渲染采样变成物质：** 同一头8段tail、主镜头加mirror，会令源量变16倍；DOF/PSF又不能创建源。禁止从camera-sorted render records/tail ledger注入。
3. **ground重复预算：** fan既保留9次真实launch的81数值包，又给每comet复制一份完整launch预算，会多计；bouquet104星不能各自复制原整发面积2。
4. **裂星增殖：** 把parent整个life排放保留，再给4child各完整parent预算，改变总源量且把split后物质重复；child还必须以自身真实birth而非burst统一出生。
5. **光烟耦合：** intensityScale1→16、调曝光或改变strobe duty导致M变化，会破坏已建立的光度/烟源隔离。音频energy也不是材料yield。
6. **完整Gaussian硬指标：** 每星一整packet并非物理必要，且会撞pending/持久state/照明field预算；但只保1个中心团又不能宣称所有真实路径已覆盖。

## 5. 下一阶段最小顺序与验收

先保持本轮ring candidate actual因果实验，不同时改余9类和early expansion。下一阶段分三步：①补logical descriptor与coverage/budget清单，单独CPU验证不画；②ground与crossette-child各一个真实短景验证，保持旧源作为对照；③再决定全型统一默认。fuse/ascent-comet若没有明确metadata，本阶段不增重尾烟。

最低验收：每类列实际燃烧体/族谱/窗口/权重cover；总A与分支剩余严格核账；30/60/120Hz分帧一致；从过去真实风/轨迹采样且clear取消旧future reservations；不同trailSegments/两镜头/P/C不改变源hash与M；skyrocket/comet显式开关不能改变未启用mortar基线。每sourceClass观察.1/.3/1/3/10秒，确认不是炮口大团复制成每星棉球。完整source cell/CPU+mirror/field成本须实测，不能只根据逻辑覆盖或单次GPU bake就称60fps。

所有新yield/profile是下一阶段作者假设；目前没有绝对排烟标定、没有新增运行时或实际GPU验收。既有ring-only与其它类型的适用边界保留。
