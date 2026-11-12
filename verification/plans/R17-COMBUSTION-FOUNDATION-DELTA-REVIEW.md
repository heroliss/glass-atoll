# R17：燃烧点基础系统增量审查与第一轮反审

2026-10-29。只读现实现与 primary 调研；未改运行文件、未启动浏览器/GPU/压力测试。本文是下一阶段方案，不是功能已完成或实测物理标定的声明。现有[多层/两事件审查](PYRO-TWELVE-SLICE-MULTILAYER-REVIEW.md)、[燃烧元数据合同](COMBUSTION-METADATA-CONTRACT.md)、[全路径释烟审查](GENERIC-BURN-PROFILE-REVIEW.md)继续适用；下列内容只补新缺口、更新已实现部分。

## 1. 0×、1×到底是什么

当前1×是作者参考强度的倍率，并非实测烟花光度。`fireworks-physics.js:1,73–93,145–152,183–187`明确使用 authored reference cd、近似发射谱/CIE拟合、作者光学半径与有效线性阻力。`scene-radiometry.js:1–2,29`是相对光度参考，`RAW_PER_CANDELA=3.6/100000`；正确的线性单位关系与反平方照明并不自动产生绝对标定。

`fireworks-physics.js:220–222`在事件创建后，将rocket和所有heads的I各乘一次`intensityScale`；尾迹继承，不递归重复乘父体。0×令**之后发射**的这些发光源为零；其轨迹、作者参考烟材量及声音事件energy保留。已有在飞事件不被UI的新倍率追溯改写。`fireworks-audio.js:59`按独立event.energy缩放声音，没有使用这个光学倍率。0×是光学关闭/排查，不等于燃料为零或没有真实燃烧；旧烟、地灯、月光也可仍然可见。

I（源强）、P（FP16安全存储比例）和C（摄影曝光）必须继续分离。曝光/峰值nit/光晕调整不能作为重新标定I的证据。当前greybody候选有SI Planck积分，但其有效发光面积、温度/发射率仍为作者假设，所以也不是本站各类型烟花的实测cd。

若以后需要“测得的1×”，需独立得到有溯源的光度/光谱数据、距离/角度/快门与曝光、相机/显示响应，或有校准的传感器测量。用户提供的剪裁/压缩/已过曝视频帧支持形态和顺序验收，不能反推唯一cd、烟质量或真实喷流推力。本轮没有这类新测量。

## 2. 物理分类先正确

- 普通mortar shell先由发射冲量升空；上升附着效果可以持续发光而不提供显著持续推进。San-en官方把rising附着效果与主shell/burst分开，也展示多芯、变色与延时组件；这是保留carrier/附着光/主星独立身份的依据。[San-en产品说明](https://san-en-fireworks.com/index/products/productse/)
- 主星的常见球形径向展开，与平面笑脸/爱心不同；pistil是内外球population，crossette是分裂，不能用一个面向相机的环代替所有结构。[Phantom术语](https://fireworks.com/education-and-safety/glossary)、[Phantom效果](https://fireworks.com/safety/fireworks-effects)
- 主动不稳定推进确有对应效果。专业演出软件厂商把bees定义为会随机转向/加速的自行推进星体，另区分早于apex打开并靠惯性上行的horsetail和后续子壳。它能支持效果分类，不能提供本站的真实推力/质量/1秒时长标定。[Finale 3D VDL](https://finale3d.com/documentation/vdl-effect-glossary/)
- 看到火焰不够推导力。真正推进来自定向排气动量及压力；净加速度还取决于重力、阻力与质量。即便有持续推力，也不保证一直向上加速。无推力时仍可凭惯性继续上升。[NASA推力](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust/)、[NASA推重比](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/thrust-to-weight-ratio/)
- 降落阻力与相对空气速度、迎风面积和质量有关，不能把下坠速度问题用全局慢放解决；浮力是排开流体的重量，不能把稀薄热烟的上浮直接施加到全部致密燃烧星上。[NASA阻力运动](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/flight-equations-with-drag/)、[NASA浮力](https://www.grc.nasa.gov/www/k-12/WindTunnel/Activities/buoy_Archimedes.html)
- 彩色分子/原子发射与炽热粒子连续谱不同；并非所有颜色都可由一个黑体温度产生。仪器厂家给出了亲自记录的烟花光谱，但该页面的谱形不等于绝对辐亮度标定。[Eureca实录光谱](https://www.eureca.de/5013-1-Fireworks.html)

因此“统一”应统一身份、时钟、状态和预算接口，而不是强制每种光点采用相同亮度曲线、同一质量、同一推进机制。只涉及虚拟显示模型，不涉及现实配方、装药或器材制作。

## 3. 当前真的有了什么；新工作应补什么

| 现实现，已核实 | 真实剩余缺口 |
|---|---|
| `starEnvelope`已有attack/衰减/燃尽fade，strobe另有frequency/duty/phase；carrier附着升空光有C2渐亮/渐灭。 | 每body仍主要使用同类通用包络；没有可组合、版本化的燃烧phase曲线。carrier发光窗口仍挂在飞行life，不是独立附着效果燃烧时钟。 |
| `describeFireworkCombustion`已有全部十型真实body/父子/触发节点和稳定family/source ID；matter明确unknown。 | 没有实测mass、volume、area、剩余燃料或烟产率。不能把metadata存在说成已经完成燃烧/热力学模型。 |
| `sampleBody`已有解析线性drag、g=9.81及同一因果wind timeline，crossette子体继承父体位置/速度。 | 无持续主动推力、角动力学、燃尽后的质量/面积变化；当前终速是作者有效参数，不是由真实尺寸和Cd推导。 |
| head与脱离ember已有分配、历史释放位置、独立脱离后运动。QA有thermal-tail冷却和greybody候选。 | 生产仍`constant`尾色、`reference`光度；head一般固定`body.colour`，脱离尾色与head燃烧phase没有统一采样。现冷却只改unit-Y色度，不求热量/燃料。 |
| `logical-family-continuous-v1`及`provider.sampleBody`已存在；覆盖实际child/ground，游标事务、过去段积分及参考材料预算已做。 | 它仍是QA候选，生产`trajectory-v1`默认two-births/12代表；候选的每body烟材率仍沿life均匀。不能重复建设游标，也不能把其全覆盖/持续源说成生产默认。 |
| crossette已有单层父子split；fan已有分时birth；ring已有双色部件。 | 没有通用多芯layer图、任意受限层延迟/各层不同phase或多级subshell图。当前bouquet是地面类型ID，并非已实现“空中shell-of-shells”。 |
| 完整raw发光ledger、两保守组元数据、GPU烟透射与原CPUfallback都已接线。 | 新动态RGB/轨迹必须同步ledger、bound、cluster、烟/云/GI、主/mirror及曝光；仅改shader染色会令照明仍旧色。 |

实际锚点：`fireworks-physics.js:128–152,181–230`；`fireworks.js:3–76,433–450,476–498,560,598–637`；`main.js:77,276–277,359–365,400–401`；`pyro-smoke-logical-burn.js:64–79`。这些锚点对应本轮源快照；原有早期计划里“缺child sampleBody”的描述现在已经过时。

## 4. 最小增量模型，复用现有系统

先加一个pure、opt-in的版本化profile层；冻结的legacy路径保持逐字节/数值兼容。不要同时更换renderer、烟状态、DRT、发射动力学和十型默认。

### 4.1 每个真实body共享一个不可变描述

下列是接口意图，尚未实现，数字若以后选择均需标author-reference：

```js
bodyProfile = {
  version, profileId, seed, bodyId, familyId, layerId,
  physical: { massKg, volumeM3, referenceAreaM2, dragModel, calibrationStatus },
  motion: { kind: 'ballistic' /* or 'powered' */, propulsionProfileId: null },
  burn: { ignitionAge, duration, emissionProfileId,
          materialRateProfileId, detachedEmberProfileId }
};
sampleEmitter(body, age);                // current reference I and RGB
sampleEmber(body, emissionAge, emberAge);// emitted phase + later cooling
materialPrefix(body, age);               // independent nonnegative material CDF
sampleBody(body, worldTime, windHistory);// actual past/current motion
```

`physical.*`未知时必须null/明确unknown，继续用现有效drag；不填看起来合理的假SI参数。发光Gaussian半径与真实物体迎风面积分开，不能把0.009m的光学source radius直接当球形实体半径。若新增作者质量/面积模型，必须标其假设，并记录由何数据约束；“字段都有”不构成物理标定。

若确实要让质量/体积参与动力学，可独立选择`calibrationStatus:'authored-reference'`的自洽参数profile，而不伪称实测。设相对空气速度`u=v-wind`，物体模型可用`Fdrag=-.5*rhoAir*Cd*A*|u|*u`、`Fbuoyancy=-rhoAir*V*gVector`与重力/定向推力合力求`dv/dt`。剩余固体质量、燃料消耗、体积和迎风面积需由同一几何/密度假设更新；例如缩小球体的A/V随半径变化，不能同时任意独立随机。`reference smoke M`仍不是这里的kg；未知smoke yield不能借此宣称化学质量闭合。若质量未知的第一版powered候选使用作者`acceleration`曲线，就以m/s²及有限Δv预算命名，不虚报N或燃料比冲。变质量时推力已包含排出质量的动量通量，不能再重复加一项喷气动量。

共享burn时钟不等于烟率=`I`。发光、色度、烟材、脱落余烬为相关但独立的通道：strobe暗相仍可有材料释放，红/蓝色度变化或光学0×不能让烟材消失。材料CDF满足单调、prefix差分非负、归一，总参考M先保持现预算；复用现事务游标的prefix差分，不按render tail样本发烟。`smoke_cost`独立复核也指出：描述在事件创建后须固定版本/seed，不能随UI改写过去，bee过去轨迹不能用当前姿态重放。

phase可表示点亮、近恒色、变色、暗相、重亮、燃尽；不强制全部“先白→彩色→金色”。前期白核也可能是多源重叠/曝光，保留固定source色的反证fixture。温度只描述有意义的thermal分量，不把蓝绿等效成任意黑体。

独立光学复核补充：接口须明确`rawRGB(t)=I_cd(t)*unitYColour(t)`（或另一种明确一致单位），phase改变时不能悄悄更换归一化。快门应积分`I(t)*colour(t)`的向量，不能分别平均I/色度后再相乘；I=0/暗相必须安全，不能以零光谱归一制造NaN。immutable `descriptorVersion`与动态`emissionLedgerVersion`分开：位置不动、烟densityRevision也不变时，颜色phase仍令所有照明consumer更新。

### 4.2 一次冲量与短期主动推进

普通星/主shell默认继续一次冲量＋现drag/wind。新`powered`只用于少量明确bee/serpent类body：有限点火/截止窗口，方向和角速有界、时间相关，推力预算有界，熄火后纯惯性＋drag/g。用户的约1s可作为首个展示候选，不能写成所有真实bees的实测燃烧时长。

随机方向必须在创建时用专属seed子流生成固定物理时钟上的平滑/分段有界knots；不逐帧`Math.random()`，不根据相机/画质采样。保留30/60/120fps同一轨迹与回查能力。初版优先给现线性drag解析段加入分段常加速度/方向，配有界prefix或检查点，避免为少数body引入全场逐帧Euler积分。常加速度段是作者动力学近似，不是喷流/刚体姿态解；需要段细分收敛和截止边界检查。

第一版不同时改所有星为quadratic drag。真正的`Cd*A/m`模型与质量衰减是后续独立模型分支：需明确空气相对速度、密度、Cd适用域、固定步长/过去状态与误差界，并重新验burnout/apex/落点/镜头包围。不能拿一条有效终速拟合同时声称所有瞬时速度正确。

### 4.3 多芯与多次爆开分开

复用旧body总预算，先一个opt-in三维多芯profile：不同layer的方向population、速度、光色phase/life独立，初爆可同birth。其后才做小型受限event图（第一版最多两层child depth），允许独立子壳延迟、真实继承位置/速度与第二次冲量。多芯不自动等于延迟再爆。每层/每body随机范围在创建时完成采样，不通过每帧噪声制造随机性。

图必须先编译、预检、再一次接受：stable IDs、拓扑顺序、非负时序、总body/tail/light/source容量、最晚child+tail的退休窗口、炮口/主爆/次级触发均可审计。保持当前4发active和14,000发光buffer的显式边界；嵌套导致超限须发射前拒绝/说明，不能静默漏外层或子星。预分配至最大child数量不等于可以生成未来XYZ；烟源仍只采出生后已过去的点。

## 5. 必须一起更新的约束，避免半接线

| 合同 | 最小必要动作 |
|---|---|
| I/P/C与照明 | `sampleEmitter`返回raw参考I/RGB；倍率一次、P一次、C只在输出。瞬时色更新完整ledger与代理revision；所有receiver来自同一源。 |
| 快门与尾迹 | 当前`temporal0/1`只有8个**标量亮度**tap；新增RGB phase不能只用当前RGB乘积分亮度。需新的vector时间积分/独立oracle，同时bound覆盖phase边界与所有通道极大值。保留head发光年龄和ember脱离年龄两个时钟。 |
| 因果烟材 | 在既有logical CDF游标加profile，不新造一套pending queues。保持`allocated = materialized + reserved + cancelled`；parent/child预算和0×独立性可核算，旧烟仍被后发照亮。 |
| 光学GPU桥 | complete ordered rows、double原端点、reflection water-hit origin、每pass sourceVersion继续；新source/phase不改变GPUlookup行序语义。不把动力学回读强行塞到每帧GPU→CPU同步。 |
| 镜头预测 | `firework-show-envelope.js`目前只支持既有apex/速度/life硬上界；新推进/多层profile须显式给增量dv/持续时限/child延迟/尾窗上界并重新推导，不能用几个seed的sampled bounds冒充全范围。 |
| 事件生命周期 | 最后child/ember出生早于event退休且留消费窗口，wind history不提前剪断。暂停/清除/配置切换不会重放已消费事件。 |
| 声音 | 保留已验收main blast `4e5ede…`及既有launch/burst合同。新增弱secondary仅在显式事件中，按距离/传播延时，不能每视觉tail都播放一次或无预算叠加等强主爆。 |
| 成本 | profile metadata/LUT本身便宜；新增body、tail、RGB taps、烟cohort、完整source×packet才是实成本。先同count比较，再单独加密，CPU/GPU/分配/显存分报。没有证据不承诺全GPU就更快。 |

当前source烟透射T以anchor端点求取，在快门窗口中近似固定。快速转向bee跨越陡烟边时，该误差可能明显增大；仅把标量tap扩成RGB并没有解决`T(t)*I(t)*colour(t)`。需独立固定T/动态T反例及误差预算；不能因RGB积分通过便宣称动态遮烟已准确。

## 6. 两轮反审与可证伪的实施顺序

第一轮反审：把统一模型写成一张万能粒子表很容易，但会把carrier误当motor、光学半径误当物体尺寸、I误当燃烧速率、暗帧误当烟熄灭。决定：保持身份和通道分离，unknown不伪造数据；先纯profile与旧效果完全等价adapter。

第二轮反审：把丰富度全交给更多星/更多子层可迅速膨胀source/packet和shader积分成本；GPU把同一错误画得更快也无意义。决定：先固定旧count/总参考I/总M对照单层与多芯；powered仅少量代表效果；新branch不得改变当前GPU透射验收基线。

建议推进顺序：

1. **R16冻结完成实际验收**；保存最终source/hash、CPU与GPU计时、主/mirror0CPU列查询、容量退回/unsupported诊断。本文不参与改动。
2. **纯profile原型**：旧curve adapter逐值/颜色等价；材料CDF/预算、质量未知、固定seed、0×与曝光独立、出生/熄火边界。此步没有新renderer。
3. **一个同body-count三维多芯候选**：实现完整current/past RGB与bound后，固定C/I/M与角度录完整phase，和用户参考及固定色反证对照。先不加子爆。
4. **少量powered-bee候选**：确定性有界转向/约1s作者窗口，验证过去回查、wind和熄火惯性；重算保守framing。随后才接现有logical烟源CDF。
5. **受限child层**：图预检、预算继承、全部源照明/反射/音频隔离；同数量版本通过后再做质量档位与完整性能预算。

最低验证集：30/60/120Hz同seed/同物理时刻；I×0/1/2的源比值与不变M/轨迹；末端CDF闭合及prefix非负；父子matter预算；色phase跨快门的独立高精度积分；main/mirror raw一致源身份；old smoke/new light互照；新推进停止后无额外加速注入；解析包围覆盖允许随机域；四发容量预检与第五拒绝；UI时刻/clear/pause不重放。像素/音效主观验收与数值通过分开报告。

## 7. 本轮冻结锚点与限制

本轮只写此文档。SHA256：

| 文件 | SHA256 |
|---|---|
| fireworks.js | `3fb39738c83705d77dd5b6c55db8d15f76fbba6ec4e24d17130a9e9a3de477fe` |
| fireworks-physics.js | `fb6be290ea34ced9a36925c0ec24e2e3745c1108bded80d4a8aee0d72fe63236` |
| pyro-smoke-logical-burn.js | `235dff6244215b5a599d3d80ea93321ccacefb8d690a07813f0c25b827800a15` |
| scene-radiometry.js | `f942645604dae00fe6ad713c605ad38509bf71cf7fbf10fe5e28b904eb5bf66d` |
| fireworks-audio.js | `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31` |

primary网页已实际检索/读取；San-en完整页首次读到§4，后续§5重开超时，故未以其未读bees段作参数依据；bees分类由Finale厂商原文支持。NRCan、AMS原论文直接读取403，本轮不以未读细节作测量/参数依据。技术方案/推导为本项目建议，网页仅支持类别和基础机制。无新运行时/CPU回归/GPU/实际视听通过结论。
