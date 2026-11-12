# 真实烟花研究与实现前反向审查

状态：研究草案，Round 1 + Round 2；2026-10-26。只针对图形、摄影与声音模拟，不包含配方、装药、制作或实物燃放操作。本文未实现烟花，也未宣称性能或视觉验收通过；总方案由根代理确认后才能进入实现。

## Round 1：先从实物外观区分效果

主要依据是烟花从业者的效果图、实际生产商提供给 PBS/NOVA 的照片，以及光谱研究。名称存在地区/厂牌差别，不能靠标签数凑出十种不同效果。[Optimum 专业展示公司图鉴](https://www.optimum-fireworks.co.uk/glossary.html)、[Phantom 效果图鉴](https://fireworks.com/safety/fireworks-effects)、[Wholesale Fireworks 图鉴](https://wfboom.com/fireworks-effects-chart/)、[NOVA 实拍图册](https://www.pbs.org/wgbh/nova/fireworks/gall_00.html)。NOVA 明列照片来自 An Ping、Hunan、Jianxi、Lidu 等厂商及 WGBH/NOVA/Windfall Films；照片许可不等于可随应用分发。[原始署名](https://www.pbs.org/wgbh/nova/fireworks/resources.html)

### 已实际查看的像素与摄影偏差

本轮通过网页图片工具实际查看了 Optimum 的八张实拍：waterfall、heart、ring、roman candle、mine、chrysanthemum、strobe、willow，未只阅读名称。Peony/Palm 的页面照片链接存在，但图片请求遇到 429；NOVA 的 GIF 缩略图在网页工具不受支持。后面表格将“像素已看”与“链接核对、未看像素”分开。没有批量下载或把这些版权照片纳入运行时资产。

| 实拍 | 看见的特征 | 对实时模拟的约束 |
| --- | --- | --- |
| [Heart](https://www.optimum-fireworks.co.uk/images/glossary/heart_shell.jpg) | 红色双瓣轮廓，点列与局部短轨迹构成，不是实心图标 | 在一个三维平面分布初速度；旋转后会变窄，不能永远正对相机 |
| [Ring](https://www.optimum-fireworks.co.uk/images/glossary/ring_shell.jpg) | 空心环，透视下近椭圆；中心保持空 | 球面星群不等于圆环；保持平面和空洞 |
| [Chrysanthemum](https://www.optimum-fireworks.co.uk/images/glossary/chrysanthemum.jpg) | 多条放射轨迹形成花状轮廓，中心亮而末端散开 | 轨迹、星体头部和老火星须分别衰减，不能整条等亮 |
| [Willow](https://www.optimum-fireworks.co.uk/images/glossary/willow.jpg) | 大面积细密金色下垂弧线，末段明显落下 | 需要重力、空气阻力、较长燃烧；不能是匀速扩张的刚性球壳 |
| [Strobe](https://www.optimum-fireworks.co.uk/images/glossary/strobe.jpg) | 白色离散亮点/短亮段同时存在，单张不能确定频率 | 闪烁要来自每星独立的燃烧时序，不能整球同步呼吸 |
| [Fan/Roman candle](https://www.optimum-fireworks.co.uk/images/glossary/roman_candle.jpg) | 多条向上的长白光带形成扇/交叉构图 | 是定向发射序列，无需空中先炸成球；照片长带不等于一直留在原位的发光柱 |
| [Mine](https://www.optimum-fireworks.co.uk/images/glossary/mine.jpg) | 星群从近地一处向上展开，上方分散 | 短时锥形速度分布、近地发射；与高空球形爆点不同 |
| [Waterfall](https://www.optimum-fireworks.co.uk/images/glossary/waterfall.jpg) | 线状悬挂源下方形成密集白色垂落帘 | 必须有延伸线源；不能挪到无支撑的海面空中冒充壳弹 |

这些照片不提供可核验的快门/ISO，不能从光带长度反推真实粒子尺寸或瞬时亮度。相机厂商明确说明长快门会拉长烟花光迹，重叠会导致白色过曝区：[Canon 摄影说明](https://www.usa.canon.com/learning/training-articles/training-articles-list/photographing-fireworks)、[Sony 拍摄说明](https://www.sony.com/electronics/support/e-mount-body-nex-3-series/nex-3/articles/00223375)。实时拖尾应表达仍在燃烧的火星/碎屑，快门积分另外计算；不能把五秒照片直接当 1/60 秒的体积外观。

### 首发最稳妥的十类

下表 H 是为当前小岛构图提出的**图形模拟爆点/顶点高度**，相对海面；D 是主要可见阶段的**初始编排区间**，不是逐类实测定律。源图没有完整时间标尺，除了 Willow 的“十秒以上”有从业者明确说明，其余秒数均为待实拍视频校准的作者建议。类型本身不决定高度：供应商壳弹表给出的示例是 3–6 英寸约 120–210 m，不同产品还有差异，因此不把一种壳径/名称硬绑定成普适高度。[高度示例表](https://www.skylighter.com/blogs/fireworks-information/firework-display-charts)

| 首发类别 | 必须不同的空间/运动/时序机制 | H / D 建议 | 常见色相示例，非类型限制 | 真实照片 URL 与核对状态 |
| --- | --- | --- | --- | --- |
| 1 牡丹 Peony | 大量点状星体形成球壳，无长连续火尾；半径增长后重力下落 | 100–140 m / 2–4 s | 红、绿、蓝、紫、多色 | [NOVA 牡丹照片](https://www.pbs.org/wgbh/nova/fireworks/images/gall_peony.gif)，图册/署名核对，未看 GIF 像素 |
| 2 菊 Chrysanthemum | 球形放射星群，每条有可衰减的短火尾；与牡丹的差别是路径发光结构 | 110–150 m / 3–5 s | 银白尾、彩色头 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/chrysanthemum.jpg)，像素已看 |
| 3 垂柳 Willow | 细密长寿命火星，减速后明显下垂；最晚阶段仍有弱金色碎屑 | 130–170 m / 10–13 s | 暖金、银金 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/willow.jpg)，像素已看；Phantom 说明真实柳尾可挂十秒以上 |
| 4 棕榈 Palm | 可见上升“树干”，少数粗壮彗星分成有空隙的弧形“叶”；不做密球 | 90–130 m / 4–7 s | 金/银树干与叶 | [专业实拍链接](https://www.optimum-fireworks.co.uk/images/glossary/palm.jpg)，链接核对，429 未看像素 |
| 5 圆环 Ring | 同一平面的一圈初始方向，中心空，观察角改变投影 | 100–140 m / 2–4 s | 单色或双色 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/ring_shell.jpg)，像素已看 |
| 6 爱心 Heart | 平面双瓣方向分布，膨胀后受重力扭曲；与 Ring 的曲线拓扑不同 | 100–140 m / 2–4 s | 红/粉常见 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/heart_shell.jpg)，像素已看 |
| 7 分裂十字 Crossette | 多个母彗星先分散，约 0.6–1.2 s 后各自分成四支；不是开场画一个大十字 | 75–115 m / 总 3–5 s | 白尾/彩头 | [NOVA 照片](https://www.pbs.org/wgbh/nova/fireworks/images/gall_crossette.gif)，图册/署名核对，未看 GIF 像素；[Phantom 机制说明](https://fireworks.com/safety/fireworks-effects) |
| 8 闪星 Strobe | 不同移动星体有不同频率/相位及熄亮占空比；轨迹不会在熄灯时停止 | 100–140 m / 4–7 s | 白、绿、橙等 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/strobe.jpg)，像素已看；照片不能验证频率 |
| 9 扇形彗星 Fan comets | 多个低空定向轨迹按同发/扫射时序组成扇面；无高空球爆 | 顶点 25–55 m / 单条 1.5–3.5 s，序列 3–7 s | 金、银、彩头 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/roman_candle.jpg)，像素已看；此图是扇形罗马烛组合，不冒称唯一产品类型 |
| 10 地雷花束 Mine | 一次近地星群脉冲，圆锥形向上散布；快起快落，非有树干的空中棕榈 | 顶点 20–40 m / 1–3 s | 彩色星/金碎屑 | [实拍](https://www.optimum-fireworks.co.uk/images/glossary/mine.jpg)，像素已看 |

主机位建议把空中爆点置于岛后/侧海域约 220–350 m 水平距离、爆点 H≈110–140 m、球体可见半径约 25–40 m，保持 28–35 mm 画幅仍可同时见到海岛。它是仿真构图建议，不是实物燃放选址。先用单发中心与低空扇形做构图验收；不先上 300 m 高、200 m 半径的巨球，再被迫把岛缩成小点。

### 可扩展但不用于重复凑数的效果

| 类别 | 独立机制/风险 | H / D 作者建议 | 照片来源 |
| --- | --- | --- | --- |
| 锦冠 Brocade | 更密的细长闪烁蕾丝尾；与 Willow 有工业命名重叠，需拍出结构/时间差才算独立 | 110–150 m / 6–10 s；金/银 | [NOVA](https://www.pbs.org/wgbh/nova/fireworks/images/gall_brocade.gif)，链接核对未看像素；[Phantom 定义](https://fireworks.com/safety/fireworks-effects) |
| 花芯 Pistil | 同次事件中内外两层星壳，速度/半径不同；不是只改中心颜色 | 110–150 m / 3–5 s；双色可辨层 | [Phantom 实拍/动图](https://images.ctfassets.net/99vh4wyl22ze/13ZZ1BDvFlcG8FO8I7wRan/3780c424ec6722f0a618d1c6ab4695e0/pistil-firework-effect.gif)，链接核对未看像素 |
| 噼啪 Crackle | 星体衰退时出现空间分散的微小次级闪点及一串独立短声，不等于纯 Strobe | 60–110 m / 2–4 s；金白 | [NOVA](https://www.pbs.org/wgbh/nova/fireworks/images/gall_crackle.gif)，链接核对未看像素；[从业者声音定义](https://wfboom.com/fireworks-effects-chart/) |
| 子母花 Shell of shells | 一次母事件后多个有空间间距的子球，子球有延迟，不是所有粒子同刻重着色 | 140–180 m / 4–7 s；多色 | [NOVA](https://www.pbs.org/wgbh/nova/fireworks/images/gall_shellofshells.gif)，链接核对未看像素 |
| 瀑布 Waterfall | 有支撑线源，星流连续下坠；不用同一壳弹工厂函数硬套 | 悬挂高度 10–20 m，垂落段 3–10 m / 6–12 s 编排；银白 | [Optimum 实拍](https://www.optimum-fireworks.co.uk/images/glossary/waterfall.jpg)，像素已看；从业者举例垂落可达 10 m |

“椰子”与“棕榈”常是相近的少臂粗尾形态，先作同类变化；Fish 需要燃烧中的局部推进/偏转，不能随意加正弦位移冒充弹道。[Fish 的从业者定义](https://wfboom.com/fireworks-effects-chart/)。这两种不计入上面的十类完成标准。

## 颜色：光谱依据与不能承诺的事

1. 热固体的连续炽光可用灰体/Planck 光谱随温度变化作近似，适合橙金余烬和较白的热亮芯；饱和红、绿、蓝涉及原子谱线/分子谱带，不能仅给黑体温度换颜色。ACS 区分了炽光与发光机制。[ACS 背景材料](https://www.acs.org/education/chemmatters/resources/fireworks-what-do-we-know-about-fireworks/further-exploration-activities.html)
2. 科研实测表明 CuCl 是蓝色分子发射体，铜卤化物有一组扩展可见谱带，不是一条“蓝色波长”。部分教育页把化学物质标签和真实火焰发射体混用，因此不从简化表格反推准确 SPD。[Koch 2015 光谱与色度实测，DOI 10.1002/prep.201500231](https://onlinelibrary.wiley.com/doi/abs/10.1002/prep.201500231)。本文只使用其光学结论，不使用化学制作细节。
3. 建议预计算 `SPD(λ,t)=a(t)*continuum(λ,T(t))+Σ b_j(t)*band_j(λ)`，再用 CIE 配色函数积分 XYZ；可见光强随燃烧阶段独立变化。没有获得可再用、经仪器校准的完整实测 SPD 数据前，band 的宽度/幅值只是参考色谱模型，不能自称全光谱实测烟花。[CIE 官方 1 nm、1931 2° 配色函数](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer)
4. `XYZ=∫SPD(λ)[x̄,ȳ,z̄]dλ`，`RGBlinear=M_XYZ→sRGB(D65)*XYZ`。发射光不应先乘 D65 照明谱；D65 在此指 RGB 白点，白平衡/色适应是另一个显式摄影步骤。窄谱可能超出 sRGB/P3 色域，转换后负分量不能靠逐通道截断伪装“真实光谱”。采用记录在案的保亮度色域压缩/降饱和近似，再走现有线性 HDR→曝光→色调映射/显示链。[W3C 转换与色域映射说明](https://www.w3.org/TR/css-color-4/#color-conversion-code)
5. 紫色可由红蓝光混合得到，不能给一条“紫色单波长”或黑体温度。高亮白芯、外围饱和色、镜头散射、白平衡与快门都会改变照片色彩。先比较相同曝光下的层次，不能逐效果自动归一化到 RGB 最大值 1 后宣称它们等亮或能量守恒。

## 轨迹、拖尾与粒子预算

建议是确定性事件图 `上升→爆点→星体燃烧→可选分裂/闪星/噼啪→余烬→烟`，而不是无生命周期的噪声点。球形壳用近均匀球面方向再加入受控非均匀速度/燃烧差；Ring/Heart 在固定三维平面布方向；星体在分裂前后继承母速度。首发不模拟完整燃烧化学、壳体破碎、冲击波或热流 CFD。

参考运动方程：`dv/dt=g−k|v−w|(v−w)+a_thrust`、`dx/dt=v`，`k=ρ Cd A/(2m)`；真实 Cd/烧蚀会变化，不能把所有星体当同一理想物。图形预算内可用恒定风下的线性阻力解析解作已声明近似，或固定小步 RK2 的二次阻力，不能每帧随机改变速度。阻力基础为 NASA 的 `D=Cd ρ V² A/2`。[NASA 原始教学说明](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)

首个可运行候选宜限制同时 1–2 发、约 2k–6k 活跃星体、8–16 历史段/条、有独立预算的约 128–256 烟团和最多 4 个局部照明簇；这些是待测工程起点，**不是已达成性能数字**。星体/细尾用实例化或合并缓冲，高频细亮芯保持主分辨率；低频烟可半分辨率并深度感知合成。NVIDIA 的离屏粒子方案正是减少软烟 overdraw，但明确不适合高频碎片，不能整套星体都降到低分辨率。[GPU Gems 3 Ch.23](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles)

亚像素亮星用积分过的归一 PSF/解析像素覆盖，半径改变不应凭空增能。尾条几何位置来自过去燃烧碎屑的世界位置，不能随相机转成一张整球照片；短曝光运动模糊另行计算，不能把 TAA 历史当烟花拖尾。亮芯在几十厘米到米级的物理发光区与屏幕几像素的光学散射必须分别表示。

烟建议从事件位置/燃烧路径生成，受当前世界风、浮升与扩散影响，老烟继续飘；纹理/体积只表示密度，照明由实际局部源和现有月/天光计算。首版可用可排序的软烟片、吸收/单散射近似，明显声明非 Navier–Stokes 烟雾；不要每个火星创建一个 Three PointLight，也不要始终让烟自发霓虹光。

## 声光时序与听感边界

光程延迟在几百米忽略，声音要从**各事件自己的世界位置和时刻**发出：地面升空/发射脉冲、空中主爆、每组次级分裂和延迟噼啪不能共用一个无延迟文件。用 `t_arrival=t_event+distance/c` 起步，`c=√(γRT)`；29°C 干空气约 348.5 m/s，300 m 约 0.86 s、500 m 约 1.43 s。温湿与风沿程造成小修正，首版不声称模拟冲击波非线性或海面多径。[NASA 声速公式](https://www.grc.nasa.gov/WWW/k-12/VirtualAero/BottleRocket/airplane/sound.html)

远处更低沉不是简单“音量小”：大气吸收依频率、温度、湿度/压力；可先用有说明的距离低通近似，不称完整 ISO 算法。[ISO 9613-1 范围](https://www.iso.org/standard/17426.html)。音频采用 HRTF 空间定位，压力幅度约 1/r 衰减；PannerNode 已有距离增益时，不要又在上游重复 1/r。真实录音需要逐条许可核查；程序噪声/滤波只能先作为合成声，不宣称实录。[Web Audio 官方 Panner 规范](https://www.w3.org/TR/webaudio-1.0/#PannerNode)

保持当前用户主动开启声音的策略。固定 limiter/压缩保护输出，分别排程低频主爆、较轻的升空与细碎噼啪，不能为了“大声真实”产生数字削波。相机移动时须更新监听者；事件开始后的声波传播采用约定的排程近似，不伪称已求解移动接收者声锥。

### 可分发的原录音候选（仅资料核查，未下载/试听）

优先候选是 **richwise — Single Firework**：[原录音者发布页](https://freesound.org/people/richwise/sounds/455453/)，2019-01-01 发布，作者说明录于 2018 除夕英国 Southampton，设备 Zoom H5 加自制话筒胶囊。页面列出 WAV、10.029 s、48 kHz、32 bit、stereo，并明确以 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 允许复制、修改及商业分发。作者称背景声“almost”很少，**不是无底噪证明**；这是街区新年录音，可能仍有城市反射/背景，能否裁出干净单爆必须实际试听。没有证据可将 10.029 s 当成发射至爆炸的实测飞行时间。本轮不下载、不登录；原 WAV 下载页要求登录，后续取得原件是独立准入事项。即使 CC0 不强制署名，仍建议保留：`Single Firework — richwise / Freesound, CC0 1.0; trimmed/converted [如实际发生]`。

发射声备选为 **Kinoton — Firework Single Rocket #1**：[原录音者发布页](https://freesound.org/people/Kinoton/sounds/347163/)，CC0，2016-06-06，Tascam DR-60D MkII / AKG C 1000S，1.8 s、48 kHz、16 bit、mono；作者明确有较强哨声、属中距离录音。它不能充当所有无哨声球壳的发射声，也未经本轮试听验证。不要因为文件短就声称干净。

已排除作为默认干净单爆：[Commons Fireworks.ogg](https://commons.wikimedia.org/wiki/File:Fireworks.ogg) 虽由 Stephan 释为公有领域，原描述明确是街区聚会烟花并有欢呼；[Almanta 的 CC0 室外鞭炮录音](https://commons.wikimedia.org/wiki/File:Firecracker_sounds_2022-12-31T23-13-02.ogg) 也明确有人声。另有 Fg2 的公有领域 [1.6 s 单爆](https://commons.wikimedia.org/wiki/File:Explosion-LS100155.ogg)，是作者于日光东照宫春季祭典自录，但页面只称 explosion，没有确认是本任务所需的空中烟花，不能偷换来源描述。

准入前听审须检查：是否夹带说话/音乐、连续串爆、削波与录音 AGC 抽吸；单爆起点与尾声能否自然裁切；原始远距空气/城市混响是否已经很强，避免再加一遍重距离滤波。立体声素材转换成 HRTF 点源前须检查 mono 下混相消，最好保留原 stereo 作声场参考。若候选最终不适合，界面/说明应标为**声学合成**，不能用“真实爆响”描述程序噪声。无本轮实际试听，故没有“无语音/单爆已可用”的结论。

## Round 2：主动推翻容易显假的实现

| 诱人的做法 | 为什么不足/会错 | 更小且可检查的候选 |
| --- | --- | --- |
| 十个名字共享同一球形粒子，只换 RGB | 形态、分裂/发射时序没有差别 | 用首发十类事件/初速度分布，在单色轮廓图中也能识别 |
| 拖尾照着长曝光实拍画完整亮线 | 把数秒摄影积分当瞬时实体，实时像霓虹球 | 实际火星尾与快门积分分开，固定快门做 A/B |
| 黑体 LUT 生成所有颜色 | 无法给窄谱饱和蓝绿/紫 | 连续炽光加参考谱带，承认未做绝对光谱标定 |
| 每亮星添加点灯 | draw/light cost 激增，水的自定义 shader 仍不自动响应 | 光源聚簇、总功率守恒近似；粒子独立可见，局部照明另有统一 API |
| 爆炸同时改整个天空/环境颜色 | 局部源被变成全向环境，再叠点灯可能重复计能；PMREM 慢更新留下残光 | 主星/反射直接可见；局部光簇直接入材质，环境 cube 保留天空，不把快闪写入长期 PMREM |
| 后期叠彩色球再发一声 boom | 无正确遮挡、反射、空气消光/时延 | 世界空间事件、真实深度，接线分阶段验收 |
| 所有粒子长历史 TAA | 闪星、次级爆点会鬼影或被抹掉 | 新发光/大变化区域 reactive 标记，短历史或解析覆盖；保留真实闪星时序 |
| 凭末端 clamp 修 FP16 溢出 | 坏能量与颜色被隐藏，高亮混合可能先产生 Inf/NaN | 源级/存储尺度预算与极端输入夹具，见下一节 |

### CELESTIAL / 当前场景的实际耦合审查

R1 初稿时尚无 CELESTIAL 计划，下列首先基于当前源码与根代理接口约定预审；随后已逐段交叉阅读其 141 行冻结稿，完整结论见 [FIREWORKS-CROSS-REVIEW.md](FIREWORKS-CROSS-REVIEW.md)。不能宣称总计划已获实现准入。当前 `main.js:413–438` 将天空 lighting 的预曝光 key 接到 DirectionalLight、水和薄叶；`sky.js:484–502` 明确返回 physical 与 pre-exposed 两套值，单位是相对 RGB，并非绝对 lux。`lens.js:169–185` 的主目标/历史、`water.js:12–16` 的反射与折射、`optical-bloom.js:4–5` 均为 FP16。运行时的后续修改需要重新核对这些行。

1. **统一标尺，区分物理量。** 根代理提出 `s=declaredSunReference=3.6/100000 lux`，每帧 `sceneRadianceScale=s*2^preExposureEV`。这是一个有效的作者标定/工作单位：把 100000 lux 太阳照度约定映射为内部 3.6，不能反称当前星图、月亮、大气、相机已全部绝对测光。PointLight 的 authored candela 乘 s；入射照度来自 `I/r²`，漫反射 `ρE/π`。可见小星的 emissive RGB 则是**辐亮度/像素平均辐亮度**，不能直接把同一个 candela 数塞入材质。
2. **同一预曝光只能乘一次。** 新 source 若存 raw 则 draw 时乘 sceneRadianceScale；若更新光簇时已经乘过，shader 不再乘。曝光输出仍为 `userEV+recommendedEV−preExposureEV`。Ground lamp、火焰、烟、反射、薄叶、局部空气散射都用同一约定，不能让某材质私自除 2^EV。
3. **目前水只认单个方向主光。** `water.js:147–161,195–213` 的水底、体散射、高光与泡沫走 uSun/uSunColor/uSunIrradiance；给 Three 场景新增 PointLight 不会自动接通这些自定义路径。首版若只做主粒子平面反射，应准确标明尚无烟花照亮水体/海床。局部点源要做 Fresnel/Snell/距离衰减的独立近似，不能把局部源替换成全局 uSun 而破坏月光。
4. **薄叶/空气/GI 不自动继承新局部源。** Three PBR 标准直射可接点灯，但自定义透光、有限 radiosity、aerial 单散射目前各有主 key 假设；要么显式受限接入相同光簇，要么如实列边界。局部球源不能乘方向太阳云影贴图；正确做法是从源到接收点的路径透射，首版可近处无云遮挡、远距离空气近似并写明。
5. **FP16 有双向动态范围风险。** 21EV 为 2097152 倍；FP16 最大有限数约 65504，直接把内部日间量级的 emissive 乘该数会溢出。反过来粗暴取消夜间预曝光会使弱星空重新下溢。既要测上限，也要测星图低信号保留率，不能只看是否没有 NaN。

### 透明粒子、烟与选择性 TAA：新接线条件

当前 `lens.js:38–40` 用主颜色 alpha≈0.70 识别水、较低 alpha 推断叶片覆盖率；`vegetation-motion.js` 仅提供叶风与相机运动，不能给烟/火星提供正确物体运动。透明 alpha 混合会改变底层标签，特别是烟叠在水或细叶上；直接套现有 TAA 可能误分类、残留爆闪或给熄灭星体拖影。这个问题不是增加 MSAA 的采样数就会消失。

根代理提出第四个 **R8 reactive MRT** 是较可靠的候选：主颜色继续做正常混合，独立 mask 只表达“该像素当前有无无法正确重投影的效果”；不挪用现有 R16F 深度的负数 sentinel。进入实现前要满足：

- `sceneTarget` 增为四附件时，所有主场景 shader（含未受光物、天空/自定义材质）明确写 mask=0，效果写有效 support；不能依赖未写的 MRT 输出自动为零。现 `zeroOtherMaterial()` 只处理 loc1/2，应统一扩展而不是每个新材质各写一套不一致注入。
- 主 pass 的 8× MSAA 必须重新查询 **RGBA16F、R16F、R8、DEPTH_COMPONENT24** 支持样本数交集，不能沿用只含前三种旧格式的结果。R8 为数值标记，不开普通 mip，不按 sRGB 编解码。主 MRT 最少四个输出是 WebGL2 保证范围，但实际格式/组合/resolve 仍要 FBO 验证。
- 不能把烟的 RGB opacity 原样复制成 mask 后直接假定混合结果是可靠 1。候选是二值 r∈{0,1}、输出 `vec4(r,0,0,r)`：希望普通 alpha 混合中 r=1 写 1、r=0 保留旧 mask；加法源中 1 累加到 normalized R8 饱和。**需用真实 R8 MRT GPU 夹具验证每附件 source-alpha 语义**，不是只凭 GLSL 文本通过；半透明边缘、多个效果重叠、后绘透明物都要测。若选择独立 MAX blending，须有 [Khronos 正式 WebGL2 扩展 `OES_draw_buffers_indexed`](https://registry.khronos.org/webgl/extensions/OES_draw_buffers_indexed/) 且恢复索引状态，不能把 RGB 的 blendEquation 一起改成 MAX；它不是桌面/GLES 的 EXT 名称。
- 当前有效 reactive 可旁路叶/水 history，并写无效 history 元数据；效果离开后的上一帧污染也需要阻断（保存上一 reactive 或让当前 history-valid metadata 无效），否则同一屏幕区域下一帧可能重新读到旧烟花。新发光和闪星必须立刻响应，不能延长全局 history 掩盖失采。
- 主 mask **不等于水面倒影 mask**。效果可能在水后面的反射相机中出现、主视角只占一小块天空，然而其倒影覆盖另一块水。当前反射 RT 只有主色/深度，水 TAA 会混合这个时间变化。需要反射 reactive 路径并投影/LOD 保守传播到水，或先使用明确保守、短 history 的受影响水域策略；只旁路天空粒子不算倒影验收通过。
- 透明星/烟需要深度测试、不写不合理的 opaque depth；烟普通混合须排序或有已声明的近似，火星加法不能拿 opacity 当遮挡。反射应遵守镜像相机的水面 clip plane；主 pass 新数据不能溢入反射/PMREM 的单附件缓存状态。

预算不能只报顶点数。第四 R8 使当前主附件名义每样本从 18 B 增到 19 B，另加 resolve 与读取；还要计算烟团 overdraw、半分辨率 smoke pass/深度感知合成、镜像效果重绘、局部光、reactive 采样/保存、PSF/Bloom 和 HDR 呈现成本。不同硬件可能因新增格式把 MSAA 共同样本数降档，所以必须连同同画面像素质量与真实 GPU 时间一起报告。

### 可执行的 A/B 存储与标定方案

| 方案 | 实施边界 | 优点 | 反证/代价 |
| --- | --- | --- | --- |
| **A：固定现有夜间 preEV，统一标尺 + 积分 PSF + 源级预算** | 使用 s 与同一 preEV；未解析点源像素平均可用 `L_pixel≈I/(r² Ω_pixel)`，再按归一 PSF 分配。由最近允许相机距离、最大同时源数与尾/烟叠加计算最坏 HDR 峰值，保留至少 4× 数值余量；不是在片元末尾 clamp | 不重建现有夜空/历史尺度，改动小；只在相机距离、源表面辐亮度与重叠数均有严格上界时成立 | 当前允许自由飞近，未解析点源式会迅速增大。有限火焰半径虽移除奇异点，RGB 通道与重叠总和仍可溢出；只限制一到两发不足以证明安全，不能作为当前最终推荐 |
| **B：降低全场 preEV 或独立高精度 source storage** | 低全局 `P_new` 至少满足 `2^P_new*s*L_peak≤storageBudget`，Output 同时减 P_new 保持显示曝光。所有已预曝光 envCube/PMREM、反射、历史同步缩放或清空/重建；若源单独 FP32，必须在线性 HDR 合成前转换成同一尺度，并确保后续 FP16 pass 不再次溢出 | 可容纳更强/更近烟花或照明，不靠源强硬限制 | 低 P_new 会再伤暗星 FP16；独立 FP32 源不意味着随后的 FP16 Bloom/DOF/History 安全。需要更广泛存储和恢复验收，不是加一张 FP32 贴图就结束 |

**反向审查已推翻“默认推荐 A”。当前推荐 B 的统一存储曝光预算。** 用户可以自由飞近，不能暗中增加最近距离或减弱源亮度来维持 FP16。固定预曝光的 A 只能留作有界远景夹具/对照。

有限发光体仍必须实现：均匀发光球在远处近似 `I=L_source·πr_flame²`；当投影已解析，像素覆盖不超过 1，源表面辐亮度保持 L_source，不再按点源公式无限增大。这个解析转换是物理面积模型，不是数值 clamp，也不应牺牲解析后的真实亮度。但最终保守上界是 `Σ maxRGB(L_source_j)` 加上烟、环境/镜头各项；它可能很大。若把纯蓝色归一到相同 Y，最大 RGB 通道可比 Y 大很多，所以按 Y/平均亮度给 FP16 预算不成立。未知实测 L_source 时，作者源参考仍需明确，不能声称物理保证。

应将两个变量独立命名和持有：`storedPreExposureEV=P` 控制存储范围；`cameraExposureEV=C` 控制摄影曝光。`storedRGB=rawRelativeRGB·2^P`，最后线性曝光 `storedRGB·2^(C−P)`。相机 C 不必因存储 P 改变而改变。根据 source RGB 上界、并发上界与固定存储预算选择 `P≤floor(log2(budget/maxRawRGB))`，最坏叠加用最大通道，不用色度 Y；预算变化时全场单次缩放/重建所有已预曝光资产。初版可让已知演出开始前一次降 P、统一失效 temporal/reflection/env，并在结束后统一恢复，避免每个闪点引起工程尺度来回跳。普通 UI 只展示曝光/演出，不展示 storedPreEV 这类工程概念。

这仍需要明确处理暗部：低 P 时弱星重返 FP16 下溢，不能假装相机补偿会恢复已丢失的数。若实测暗星保留率失败，要用明确的高精度合成链/分层存储，不是只把新 source 单张 RT 换成 FP32。32 位浮点加法混合还需要实际查询 `EXT_float_blend`，有可渲染 FP32 不等于允许 blending。[Khronos 官方扩展](https://registry.khronos.org/webgl/extensions/EXT_float_blend/)。统一预曝光用于管理低精度 HDR 范围的机制，也见 [Epic 工程说明](https://dev.epicgames.com/documentation/en-us/unreal-engine/auto-exposure-in-unreal-engine#pre-exposure)；这是机制参考，不表示现有 WebGL 项目具有其曝光系统。

举例仅作数值预算：s=3.6e−5、P=21、storageBudget=12000，则允许的**所有重叠分量合计像素平均参考辐亮度**约 159（对应于这一作者标尺的 cd/m² 数值）。这不是发光星体表面辐亮度上限，更不是烟花实测值；未解析星体的像素占比/PSF 会改变像素平均数。预算应把局部峰值、烟/尾/反射、PSF 汇聚全部算入，不拿平均画面亮度代替最大值。

## 建议接口与实施前验收

接口草案，不是已存在 API：

```js
createFireworks(THREE, {
  scene, terrainHeight, windAt,
  getRadiometry, // {sunReferenceScale, preExposureEV, sceneRadianceScale}
  enqueueSoundEvent, // {kind, worldPosition, emissionTime, seed, referenceLevel}
  publishLocalLightClusters, // [{position, linearColor, referenceCandela, radius}]
  seed
});
launch({effect, origin, burstHeight, radius, duration, palette, orientation, seed});
schedule(events);
update({time, dt, camera});
setQuality({maxStars, trailSegments, smokeSprites, lightClusters});
diagnostics(); // seed、event phases、峰值预算、溢出/被拒事件、draw/粒子数
dispose();
```

实施顺序：先单发无烟、固定相机与固定曝光核实十类轮廓；再验证阻力/分裂/闪烁时序；随后加短曝光轨迹与 PSF；最后接局部照明、烟和有延迟音频。默认演出不把十发挤在一秒内让独立形态无法辨认。

进入最终验收前必须留下以下可复跑证据：

- 相同 seed 的 30/60/120 Hz 更新中轨迹与事件时刻一致；分裂继承速度，阻力在无推进时耗散相对风的动能。
- 十类同色静态接触表 + 实际连续短视频。Ring/Heart 转视角不变成永远正对镜头的 UI 图形；不能只验照片长尾。
- 远近/分辨率改变后的单源 PSF 积分与总能量误差；亮芯不退化为大粗点，真实闪星也不被 TAA 全抹掉。
- 相同参考光源在 preEV=0/17/21 的线性解码照度/辐亮度一致，source/灯/烟/水反射不重复乘比例；最坏重叠 HDR Float readback 无 Inf/NaN、无负通道、无超预算，弱星保留另测。
- 低色度白板验证 `ρE/π` 与点源 1/r²；RGB 窄谱超色域与高曝光白芯均有明确显示映射边界，不能拿 ACES 后均值当原始能量守恒。
- 发射/主爆/噼啪分别从本地位置经 d/c 到达，200/300/500 m 的排程差正确；声音默认关、开启后无削波。实录另核许可。
- 岛后遮挡/平面反射可见性、局部照明范围与未接通的自定义材质逐项核对；无“加了一个灯就全场物理耦合”的声称。
- 在真实主视角、夜空、近景和连续两发烟峰值时测实际 rAF/GPU 分布与最低滚动 1 秒 FPS，保留慢帧；预算起点不是“任何机器 60 FPS”承诺。

本稿 Round 2 结论：先锁定十种有独立轨迹/时序的首发类型。A 的近距离/通道/重叠反证成立，因此当前推荐 **B：统一存储曝光预算，摄影曝光与存储尺度分离**；有限发光面积、暗星下溢和 FP32 混合能力都必须进入夹具。已对 CELESTIAL 冻结稿逐项反向核对，详见交叉审稿；有限距离透明光学与反射 reactive 仍需 R3 定案。研究已经指出多个会显假的捷径；这些缺陷不能通过增加粒子数或更鲜艳 RGB 自动解决。
