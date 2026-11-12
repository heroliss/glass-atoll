# PYRO R2：持久烟气、风与有限预算

2026-10-27，只读研究。**没有改运行时、没有操作浏览器、没有下载资产。B1继续冻结。** 本方案先区分颗粒质量、气团形态和视觉可见度，再选择表示；不能把旧sprite的life改成1800秒就称完成持久烟体。

## 结论与优先顺序

建议采用**有界、与发光事件解耦的拉格朗日质量烟团库**作为唯一长期状态。每团存质量、中心、协方差、热浮力状态与成分类别，以物理秒增量推进、保质量合并。近场保细团，中场用各向异性体密度，远场合并为低频残余气溶胶。**第一步可保留现有有限效果合成接口，以真实3D Gaussian的射线光学厚度替换纯屏幕圆斑；高档再加局部体密度渲染cache，不能先承诺所有档都跑全域流体网格。**

无风不应触发消失；冷却后的细颗粒仍能存在，扩散降低局部浓度与对比度。几十分钟驻留有实测依据，但不是统一的团块寿命，更不表示同一朵白色不透明烟保持原浓度几十分钟。湿度、稳定度、风、排放量和成分各自影响结果；不将“夜间”自动当作逆温。

本轮仅设计，所有毫秒预算都是待验证目标，不能复用原短烟性能结果。先实现状态/守恒与最小渲染夹具，随后实际GPU A/B决定是否放行局部体cache。

## 1. 一手测量给出的范围与反例

### 1.1 持留时间不是烟花固定材料常数

- **Salma等，2023，布达佩斯七年观测。** 论文明确报告总体烟气驻留约25min；最受影响年度，粒子数在演出结束后5min达峰、45min内回到事件前水平，并出现约203nm的额外粒径模态。这是特定观测/输运条件下的浓度响应，不是单个白烟团的可见寿命。正确DOI为 **10.1016/j.envpol.2023.121612**，不是121545。[论文原始摘要](https://pubmed.ncbi.nlm.nih.gov/37062402/)
- **Licudine等，2012，Hawaii Pearl City。** 2008年事件的PM恢复对应约1h量级的驻留；可支持“某些场景远长于8.5s”，不能据此给所有烟团统一一小时。PMC本轮部分后续抓取触发captcha，故不据未读取表格推定具体风速或扩散系数。[原研究记录](https://pmc.ncbi.nlm.nih.gov/articles/PMC3366381/)
- **Manila CAMP²Ex，2021。** 该研究自身HSRL测到峰值附近约440m高的增强层，至少维持约1h，之后层高降至118±20m，增强后向散射延续至08:00；是大量城市烟花、气象与背景共同作用。不能拿它引述的其他研究“12h低风”冒充本站实测，更不能套成孤岛单发的浓烟寿命。[研究3.2节](https://acp.copernicus.org/articles/21/6155/2021/)
- **Minneapolis，2022。** 同时观测粒径、温湿和垂直温度；夜间低风/逆温条件下，次晨出现与烟花阶段相近的粒径模态与浓度峰。作者将它解释为受限扩散下的残留，不是烟停止发光后立刻消失；仍有其他排放/测点差异，不能由该观测反推当前网页的唯一参数。[研究3.1–3.2节](https://link.springer.com/article/10.1007/s42452-022-05023-x)

**设计含义：** 必须分开“单团不再可见”“离开岛上视野”“排放停止”“物理质量被沉降/冲刷去除”。传感器测到残余PM不等于肉眼仍见同样浓白的团块；反过来，颜色变淡也不等于质量为零。

### 1.2 湿度依赖成分，不能照搬marine-air的κ=.6

2018年LANL观测新鲜烟花碳质气溶胶，在RH85%时湿/干散射比约1.02，而背景约1.7；其后火花棒实验的盐质烟有更强吸湿性。这个反例否定“所有烟花一到潮湿海岛就统一大幅增白”的规则。[Carrico等原论文摘要](https://www.sciencedirect.com/science/article/pii/S1352231018300384)

Manila研究则估计受烟花影响的水溶性混合粒子bulk κ由.11升到.18。它与前者并不矛盾，测量成分、老化与粒径不同；.18不是纯盐材料常数，也不是每种烟花的已知κ。该研究也记录降雨后后向散射暂时下降，支持区分吸湿增长与湿清除。[Manila 3.6节](https://acp.copernicus.org/articles/21/6155/2021/)

**设计含义：** 原`marineAirCoefficients()`的κ=.6明确是规定的混合海洋环境，不能把新烟直接加进aerosolScale，让它自动获得同一κ。烟应有独立的干质量/光学profile；RH只改变对应profile的湿粒径/消光近似，不凭空增加干颗粒质量。首轮可有弱吸湿/盐较丰富两种情景，但都须标为研究包络，不能声称已标定实际发射产品。

### 1.3 海风与沉降不是年龄fade

西班牙Alicante烟花场地的原始粒子数观测处于海风主导天气；源、观测点与风向会改变测得峰值和持续过程。这里仅使用可检索原始摘要确认的海风背景，不以无法取得的全文拟合本站参数。[2014原研究](https://www.sciencedirect.com/science/article/abs/pii/S1352231014005470)

NOAA HYSPLIT把平均风输运、具有时间相关性的湍动和质量/体积浓度分开；其puff会扩散并可分裂，粒子并非每帧独立随机跳点。这支持拉格朗日质量团思路，但本网页不是HYSPLIT、没有气象资料驱动和化学预测能力。[NOAA浓度/扩散方程](https://www.ready.noaa.gov/documents/AMS2018/html/conc_eqns.html)、[NOAA方法概述](https://www.arl.noaa.gov/hysplit/)

粒子沉降取决于直径、密度与形状；不能给烟团直接加−9.81m/s²当作烟尘沉降。[NOAA沉降说明](https://hysplit2.arl.noaa.gov/documents/Tutorial/html/chem_dryp.html)、[AerSett原始方法论文](https://gmd.copernicus.org/articles/16/1119/2023/)

作为**自算数量级、非烟花实测**：假定球形物理直径、ρp=2000kg/m³、ρair=1.2、μ=1.85e−5Pa·s、平均自由程66nm，使用Stokes–Cunningham，0.2/1/2.5/10µm粒子30min的静空气沉降距离约.008/.124/.706/10.77m。细颗粒不能靠重力在几秒内从百米高整体落光；粗灰/壳体与细气溶胶要分开。形状、粒径分布、湿增长、湍流和表面沉积都会改变实际结果。

## 2. 当前代码审计：为什么不能只改life

审计时SHA：fireworks.js=`606d57528ec7c28e36d56734746a00826ef03272aea86ff5e42f6bff29486abf`；fireworks-physics.js=`2cc716d0bfb49639c6f0e55975cdf41b60736c5b33f47bba974b9b79e1613939`。这里只记录快照，root其他工作可能后续改变它们。

| 源码位置 | 当前行为 | 长期烟的具体问题 |
|---|---|---|
| `fireworks-physics.js:132–137` | 每发18团/地面型7团；life8.5s，半径1.1+.75age；固定年龄opacity衰减和末1.5s归零 | 发光结束后固定删烟；没有干质量、温差、粒径或成分语义 |
| 同文件`:118,149–177` | endTime含短烟；maxActive=2；烟从active event采样；风历史约22s修剪 | 单纯把endTime延成30min会锁住发射槽；只保旧birth后重新积分也需要更长风史 |
| `wind-response.js:25–96` | 已有按drag共享prefix/checkpoint的精确分段风响应 | **不能误称当前查询每次重扫全风史**；但不能因此把所有长期烟的状态/记录保留都视为免费 |
| `fireworks.js:182–199,216–223` | live smoke/head/tail混成records，每view排序与全部attribute上传 | 多分钟烟会增加CPU排序、传输与反射重复工作，不能塞满14000容量再删最老烟 |
| 同文件`:200–211` | 最多2个当前发光簇照烟，环境和太阳另有近似 | 旧烟应能被**后来**新发的爆源照亮；不能把出生时亮色烘焙进烟 |
| 同文件`:230–267` | bounds随active归零；source bound、clusters扫描records并累计短烟深度 | 烟独立后不能active=0就不渲染；不能每帧/双view扫描整段排放历史做photometry |
| 同文件`:99–117,167` | 屏幕朝向Gaussian；worldSigma=radius/2；PSF/DOF扩宽用σold²/σnew²修正 | 该修正只保成像blur的积分，不保世界扩散对应的气溶胶质量；中心深度也不代表真正体积 |

当前单团投影光学面积代理`2π(radius/2)²*peakTau`：age0≈.228，age7≈1.013，为4.44倍，age8.5则0。**这不是在指控旧视觉函数违反其未承诺的物理模型，而是证明它没有可直接延寿的质量守恒语义。** 新设计不能把现`opticalDepth`当kg或把opacity继续乘年龄fade。

旧团的初始rise也会被drag=.8衰减，gravity=0，因此它现在并非永远以初速上升；只是没有显式热浮力、冷却/夹卷与层结语义。不能以一个并不存在的“旧烟永久上升bug”为新模型找理由。

## 3. 状态：长期质量库，渲染表示可更换

建议新私有`pyro-smoke.js`，与现光源/轨迹、队列和音频解耦。发射事件只在真实source时间向烟库注入一次源量；rocket/trail、burst和地面烟可提交不同source packet，但不能每帧重播同一burst造成重复质量。保留eventId用于诊断，**不依靠active event对象存活**。

每个packet存中心c、正定协方差Σ、干质量M、热浮力/冷却状态、成分/粒径bin和稳定seed。位置米、时间物理秒；M可用kg字段但首轮源量与质量消光系数均是作者输入，**未测量，不能输出真实PM浓度/健康或能见度预测**。若暂用相对质量，API必须明确单位并保持同一可加规范，不伪装为实测kg。

基础连续密度：`rho_i(x)=M_i/((2π)^(3/2)*sqrt(detΣ_i))*exp(-.5*(x-c_i)^T*Σ_i^-1*(x-c_i))`。归一化使扩散降密度而不删质量。`sigmaExtRGB=rho*kExtRGB(RH,profile)`，`sigmaScat=omega*sigmaExt`，0≤omega≤1；冷烟自发光=0。旧粒子光学fade、发光envelope和2^P不进入M。

无限Gaussian在有限support渲染时尾质量要记清：3σ的三维球内只约97.1%，若直接裁掉便已超过1–2%cache预算；可用≥4σ support（球外约.113%）或明确归一截断核，并在bounds/merge/积分测试中使用相同定义。相机在团外、团内与近裁剪穿过烟时，积分区间都从真实射线起点截到opaque depth，不能沿用旧sprite中心深度的整片discard。

### 平流、浮力、混合

- 平均风用当前共享海风/风向时间线，在当前位置高度求U(c,t)，可增加明确的高空shear回调；不要用**当前风×总年龄**抹掉旧风向，也不要自动声称模拟了完整海陆风环流。
- 以固定物理tick增量推进中心，记录已积分状态；风历史只需覆盖当前tick/插值与可选checkpoint回放。30/60/120fps都走同一tick边界，显示帧在相邻物理态之间连续插值。**不是每帧重新从出生回放30min**。
- 热团可用`w' = g*DeltaT/Tenv − w/tauDrag`、`DeltaT' = −DeltaT/tauCool`的受限近似；冷却后浮升速度趋向零，不以固定1–2m/s永远升高。tau与初始热量是未标定参数。若没有夹具验证热/夹卷语义，宁先用明确的衰减浮升状态，不声称热力学求解。
- Σ用shear/旋转传播与次网格混合：`Σnext=AΣA^T+2K*dt`，A≈局部flow变形梯度，K半正定。正定性必须检查；不能任意负扩散。大涡场负责连续可见卷动，K只代表未解析尺度，避免两种独立随机扩散双算。
- 任何随机湍动均按物理tick和seed连续、具有相关时间；不按requestAnimationFrame每帧抽新方向。无平均风仍允许残余湍混/热运动；也不能把wind0强迫K=0后另靠age fade删烟。
- 稳定层结/逆温单独控制混合高度与垂直混合强度；缺少探空时它只是可选情景，不由RH或夜晚自动推断。首轮不做压力/浮力耦合Navier–Stokes。
- 粒径bin分开细气溶胶与粗灰的沉降；地/海面沉积和域外通量都进入账本。rho裁到地面之上却不记录被裁质量不算守恒；需要截断归一或明确计算沉积份额。树冠不是已解析的三维湍流障碍。

### 有界合并，不用“最老删除”限N

建议逻辑上限1024–2048个质量packet，近新团保留较细层级，旧团在世界空间hash bin中按相近位置/成分合并。用`M=sumMi`、`c=sum(Mi*ci)/M`、`Σ=sum(Mi*(Σi+(ci-c)(ci-c)^T))/M`精确保留总质量、质心和二阶矩。合并改变高阶结构/局部峰，必须单独记录误差；不能跨很远的无关团合成一条假烟桥。

若压力过大，先扩大**远场**合并bin或汇入低频coarse reservoir，不按出生序号无声丢弃；近新团若不允许合并必须预留上限。源输入、当前空气、地/水沉积、湿清除、域外、数值损失分别记账。默认支持至少30min基准，但30min是验收时域，**不是年龄到点清零**。超有限世界域可记outflow并说明不能回流，不由相机视锥决定物理存在；用户显式“清烟”另记人为清除。

1.8m/s×30min约3.24km；5m/s×30min约9km。只建岛周围几百米的物理历史域无法支持这一目标。质量状态可以在±16km级范围保留，局部高分辨率只是渲染cache；不能相机一转身就销毁烟，或把旧源保留成数万条live body。

## 4. 近/中/远场表示与取舍

年龄和距离只用于LOD/合并，不是删质量。下述数字是起始实验预算，不是已验证阈值。

| 表示 | 优点 | 核心风险 | 本轮建议 |
|---|---|---|---|
| 延寿旧camera-facing sprite | 最小改动/1 draw | 无质量、纸片/圆斑、看穿/近面切、中心深度排序、记录和overdraw持续增加 | 否决直接延寿路线；仅作旧A基线 |
| 有质量的3D各向异性Gaussian，用proxy quad/ellipsoid求射线光学厚度 | 一份世界状态、多view；不必全域grid；可算inside/near交点，远烟低频合理 | 若仍中心光照/排序，厚重叠与自阴影只是近似；Gaussian太少仍像棉团 | **阶段A候选**，先验证持久/风/预算，不冒称已完成高保真卷烟 |
| 局部密度cache+受限raymarch | 真正局部体视差、薄边/遮挡、自遮蔽可查；成本按像素/steps封顶 | voxelize/cache更新、薄烟漏采、分辨率/时域闪噪，须与空气和DOF正确接线 | **阶段B高档候选**，只在实际预算支持后放行 |
| 全域Eulerian 3D网格/多级clipmap | 直接表示混合浓度，空间采样成本可控 | 历史域/精度、保守层间通量、移动窗口质量损失；WebGL层渲染/纹理读写与内存 | 本轮不默认实现，先小域可验证夹具；不是把camera clipmap当物理质量库 |

阶段A的“3D Gaussian柱积分”不是为旧sprite换名字：用射线`x=o+s*d`在各向异性密度内积分到实际遮挡点。令`A=dᵀΣ⁻¹d`、`B=dᵀΣ⁻¹(o-c)`、`C=(o-c)ᵀΣ⁻¹(o-c)`，积分可由`exp[-.5(C-B²/A)]*sqrt(pi/(2A))*DeltaErf`求得，再乘归一质量与消光系数。数值实现宜以Cholesky白化后的垂直距离计算指数，避免远场`C-B²/A`相消；位置对相机重基准，A>0与Σ正定检查不可省。proxy quad只是覆盖support的光栅载体，不规定烟的物理平面。该方法仍不能解析任意重叠团的变光照/自阴影，故是明确受限的阶段A。

### 建议的分层

- **近场：** 新团及近观察者，保留约128–256个较细packet；根据实际火星轨迹/源强注入并由连续flow卷动。噪声若调制密度须归一/报质量误差，不能无限叠fBm改变M。不要只给半径加正弦、也不要让烟直接复制发光星轨迹不冷却。
- **中场：** 约15–300s或几百米范围内，逐渐合并各向异性packet；3D协方差与shear产生漂移/拉伸，几何不贴相机。阶段A用解析柱积分；阶段B把当前packet密度写入世界空间局部cache，16/24/32步只积分与烟support相交的视线段。不能循环遍历全部2048团×每pixel。
- **远场/老烟：** >几百米至几公里，粗packet/宏cell的归一低频密度与消光。它应成为随风移动、稀释的残余haze，被新爆源再照亮；不能固定为屏幕灰幕或无限高均匀ambient。小于视觉阈值只可跳过渲染，质量继续在库中并能重新合并显现。

阶段B可试64×32×64（约131k）或96×48×96（约442k）局部标量cache，覆盖约512m级而非整个历史域；数据来自质量库，离开cache的packet保留。RGBA16F单cache约1.0/3.4MiB，双缓冲约2.0/6.8MiB，另计RT/光照/history。可用带gutter的2D切片atlas，两个显式LOD0双线性采样恢复z插值；必须highp sampler且防层间bleed。该cache只渲染，不另做与packet重复的物理平流。

缓存世界密度可在5–10Hz更新并插值，中心/协方差状态10–20Hz推进，最终光照可每帧使用当前太阳/月/爆源。每slice逐次setRenderTarget并不自动便宜；需比较批量atlas splat与层渲染的实际draw/overdraw。远场同质量只能由一种表示承担，hand-off使用互补权重，不能近/远双算。

完整clipmap仅在后续确有必要时研究：固定世界质量源、保守fine/coarse转移、边界出流账本、camera重定位不改物理量。普通semi-Lagrangian纹理回溯虽稳定，但不天然保质量；MacCormack也不能替代通量/守恒验证。不应以“stable fluids”注释当守恒证明。

## 5. 空气、烟、照明与摄影必须共同设计

### 已有链的边界

`lens.js:327–331`先对opaque做空气、镜头/DOF，再调用有限effects，最后共用bloom；fireworks有限效果用自己的四段空气和中心深度/CoC，反射以water-hit作空气起点。`aerial-perspective.js:105–151`目前只积分规定的Rayleigh/海洋Mie；`:163,175`对sky深度旁路。**当前aerial不是烟体积求解器，不能把新rho接一个uniform就宣称所有光路正确。**

阶段A沿用有限效果接口时，明确保留中心光照/DOF与重叠排序近似。新团光学厚度需由3D rho线积分而非屏幕圆，手电/新爆源/太阳/月亮照明必须用**当前**线性光源状态；旧烟不得自发光。先仅单散射，0≤SSA≤1，phase归一，光源到烟和烟到观察者各自透过率分开。烟与背景空气密度分开，不能在aerialScale加一次、sprite再加一次。

交叉审查已读 [SHAPE-HEIGHT-LIGHT的HG符号证据](PYRO-R2-SHAPE-HEIGHT-LIGHT.md#phase-a另含可证实的hg方向符号窄修)：当前smokeLighting把从烟指向source和eye的两个外向量之dot直接代入minus HG，会倒置forward/back；aerial用eye→point向量时符号已正确，不应一起翻。该审查有真实源码抽取的独立oracle，本文件不重写其测试、不改runtime。新持久模型必须明确采用同一光子传播约定；仅积分归一为1不足以检出方向反转。

### 阶段B必须先解的合成问题

对同一段体介质，应积分`betaTotal=betaAir+betaSmoke`，源项为当前空气+烟散射；烟也要遮住它后面的星、月、远树、火星和其它烟。只给背景乘一个全屏alpha、再把发光星最后无条件add，会出现“前烟挡不住后爆源”。反之把烟混进opaque主RT再用opaque背景深度做空气/DOF，会把近烟当成远背景。

可选安全接口是让有限media compositor拿到未做空气的背景和分段深度，一次解空气+烟、再处理有限源/景深。若为减少改动保留现已加空气背景，也有数学上的**成对积分**替代：对同一个camera→最后烟出口/opaque截断段，算原空气S_air与联合S_joint及T_smoke；`Cnew=T_smoke*C_airBackground + S_joint − T_smoke*S_air`。这样没有再次乘P，也没有直接除以很小T_air。**但它要求背景确实含同一空气模型的该前段贡献；现sky/有限air离散及阴影采样并非已证明完全等价，不能未经夹具直接上线。** 差分项可为负，不是末端clamp掩盖错误的理由；最终物理RGB与数值范围须单独验证。若条件无法封闭，选联合compositor而非继续补颜色。

其它不可遗漏的接线：

- 有限火星/爆源到眼的T_smoke需与背景同一密度；新爆源照旧烟，不能由旧event的light cache决定。太阳/月/局部灯及可选自阴影都是入射路径，外部marine-air和cloud/tree visibility分别只乘一次。
- water反射继续通过已有finite callback写现reflection RT，不给已接近16sampler的water shader加一个新smoke sampler。世界rho相同，积分从真实water-hit出发；不把近镜面空气重复积分，不镜像物理烟的位置/质量库。
- 密度cache存物理/相对质量或m⁻¹，**不存P**；光照cache若存预曝光RGB要附storageEV标签并重标定。背景已stored时用`storedBackground*T + sceneScale*S_raw`，不能整式再次乘2^P。摄影C不能改变M/τ/热量。
- 持久烟不自动写进逐面skyCube/PMREM；它是位置相关有限介质。主镜头/反射共享世界烟，背景天光仍用当前环境，避免把瞬时爆源或旧烟照明重复烘焙进全局天空。
- 体烟景深不能沿用opaque背景depth。阶段A可明确中心CoC近似；阶段B可输出光学权重深度矩或有限分层重建，需专测宽光圈。reactive mask只管history，不会修错空气段或错景深深度。
- 暂停时physics tick、烟年龄、thermal和noise相位冻结；camera移动只重算view/cache，不推进物理态。天文UTC加速不影响烟、波浪或音频的物理秒。

## 6. 性能与photometry：上限不是靠寿命清理

建议目标（**未实测**）：medium增量CPU≤.5ms均值/≤1ms p95，GPU≤1.5ms；high/ultra局部体cache+march增量≤3ms，并允许整个高级档30fps而不是把所有档都宣称60。若本机现预算不够，先保状态和阶段A，不偷减图像分辨率/扩大全局模糊制造通过。

具体封顶：

1. 长期state容量1024/2048，tick10/20Hz；源队列只存待处理packet，不保30min的live star/tail records。合并按空间hash，避免全N²配对；分帧预算下也不能改变源时间/丢质量。
2. head/tail列表与smoke库分开。getLightClusters仅看实时发光头，不用每次`records.filter`穿过长期烟。bounds分成emitter与medium support，active=0时后者仍有效。
3. photometry不把所有烟团当光源逐个求投影上界。冷烟是非发光散射介质，联合传输的出射源上界由当前入射光、phase最大值和SSA限定，可用`(1−T)≤1`的保守界；**不随烟团数线性相加源亮度**。但上界必须包含环境、太阳/月和所有局部光的有限半径近场值，并由真实GPU压力夹具验证，不能只复用旧短烟簇sum。
4. 体渲染先用world support/屏幕矩形跳空，步数按局部烟段而非从眼march到30km；固定最大步数与密度LOD足迹过滤，不能每步查全packet。volume jitter若需要，使用稳定且可解释的模式，避免新增用户已敏感的随机闪噪。
5. 质量合并、density cache、光照和render是不同revision，改变摄影曝光无需重解物理密度；改变风只影响未来积分，不把全部旧轨迹重算。主/镜像共享state，不共享view排序与错相机缓存。

具体未来接线风险：当前`main.js:634`的medium预算用localBound×.25，而旧烟`g=.32`的HG最大值约.227sr⁻¹，与它的其余吸收/颜色因子一起有当前限定语义。若新烟改为更强前向散射，例如g=.76，HG峰可约2.432sr⁻¹，不能不更新bound仍沿用.25。它不是本轮已复现的旧代码溢出bug，而是新模型必须修改的合同；也不能靠总sky bound偶然更大来隐含保证。

候选CPU API（仅合同草案，不代表已有实现）：

```js
createPersistentSmoke({ capacity: 2048, fixedStep: 1/20, worldHalfExtentMetres: 16000 })
smoke.emit({ sourceId, physicalTime, position, velocity, dryMass, composition,
             covariance, thermalExcessK }) // idempotent sourceId
smoke.advance({ physicalTime, windAt, temperatureK, relativeHumidity,
                mixingLayerHeightMetres, stability })
smoke.sampleMedium(worldPosition) // extinction/scattering per metre; CPU QA
smoke.prepareView({ camera, opaqueDepth, size, reflection, waterPlaneY, quality })
smoke.render({ renderer, target, background, frame, currentLights, air, optics })
smoke.getRadianceBound({ currentLights, air }) // raw before P; cached aggregate
smoke.diagnostics() // mass ledger, count/merges, domain, tick/cache costs
smoke.clear({ reason: 'explicit user action' })
```

若所有source仍未标定dryMass，诊断必须显示`relative mass / authored extinction`，不得表面API叫kg就给健康/PM2.5预测。render接口要在选定阶段后定稿，不能同时保留两个对空气的所有权。

## 7. 可证伪验收，先证状态再谈氛围

### CPU/守恒夹具

- 30/60/120Hz与不同分帧、固定seed/源/风：30min后质量、质心与Σ在约定容差内一致。sourceId重复提交不再注入；发光槽释放不影响烟库。
- wind0、温差0、K0、无sink：质量严格不因年龄减少；有K则Σ增大、峰密度降，积分质量不变。热团冷却后浮升减弱，不永久直线上升。
- 恒定风1.8m/s无其它力：30min中心位移3.24km；风1.8→反向→0的分段时序验证累积路径，不是最终风×age。天文UTC×600与pause不改相同physicalTime烟态。
- merge前后M、质心、二阶矩守恒；density积分/局部峰变化另报。空间远隔团不可跨空洞合并。细/粗bin沉降方向和质量移入deposited ledger正确。
- 不使用相机的长跑：停止发射后旧烟仍存在；绕飞、看背后、镜面视图不改M。5/15/30min状态数、内存、更新时间应稳定有界。
- 源M=airborne+deposited+wetRemoved+escaped+explicitCleared+numericalResidual；目标mass residual≤1e−4（double逻辑态），cache离散积分另设≤1–2%并报告边界截断。目标阈值须在候选前固定，不为图像好看删账。

### 真GPU/光路夹具

- homogeneous slab解析Beer T与单散射，正反视角和相机在烟内；主/镜像/水面路径与CPU sample一致；0密度与旧图严格/数值精度等价。
- 前烟挡后星/后爆源、后烟不挡前源，跨不透明树/沙/海遮挡；DOF on/off不把烟钉在背景depth。单团与两团重叠检验排序近似量级，厚烟不能仍穿出无衰减发光点。
- old smoke + 新爆源：同mass/同pose下off/on能见再照亮，停止爆源后不残留发光色；RH sweep对弱吸湿profile影响弱、盐较丰富profile更强，不能同一统一κ曲线。
- P/C分别变化、黄/蓝/红爆源近烟、torch/三地灯同开：raw radiance bound保守、实际stored FP16无溢出/NaN/Inf/负物理RGB。不得只检查平均或opaque漏掉reflection/media RT。
- 同时刻不同quality/缓存刷新边界无大面积跳变；无时间随机闪噪；pause呈现缓存截图不变，强制QA重渲染的history递进须另解释。

### 视觉/成本A/B

固定同source、风时序、UTC、RH、camera、P/C、quality和分辨率，分别记录5s/30s/2min/5min/15min/30min；既要近看烟的三维卷动，也要宽景看累积/漂移。不能只选“没有烟的天空”计浓烟性能。必测无风、1.8m/s、5m/s、风反向、高RH/低RH、弱混合/较强混合及camera进入最浓处。

记录CPU模拟/merge/prepareView/photometry、GPU cache/volume/main/reflection分别的mean/p95、峰值实例/texel/显存；query outside production nested timer，并标disjoint。检验同一burst在5min/30min后仍有**更稀、更大、随风离开的**残余，而非原大小白团或全屏灰滤镜。若达到持续只是牺牲遮挡、产生纸片、不可控N或密度均值，否决而不以“更有氛围”代替验收。

## 最终边界

这是有限质量输运/湍混与单散射渲染的候选，不是LES/Navier–Stokes、完整烟花化学、二次气溶胶反应、真实海陆风天气模式、全谱Mie/多散射或实测健康暴露预测。对照论文用于排除8.5s统一消失与统一湿增长的错误假设，不用于伪造孤岛这几种产品的排放质量、热量或准确寿命。先通过最小持久库/光路夹具，再考虑高档局部体cache；不要因研究可行就把全部成本功能一次加上。
