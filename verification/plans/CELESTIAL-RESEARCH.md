# 天体与星点研究：Round 1 候选、Round 2 反证

2026-10-26。**研究草案，未获运行时实现准入。** 已读 `night-sky.js`、`sky.js`、`main.js`、本地 Astronomy Engine API/版本、现有资产来源，并交叉阅读 `CONTROLS-QUALITY-RESEARCH.md`、`LOCAL-LIGHT-AND-INTEGRATION-RESEARCH.md` 与根代理反馈。本文不把拟议接口、预算或测试计划写成已实现/已通过。

## Round 1：现有代码确实做了什么

| 位置 | 已有行为 | 真实不足 |
| --- | --- | --- |
| `sky.js:352–355` | 固定 .00465 rad 太阳半径；对 `dot(ray,sun)` 做 `fwidth` smoothstep，直接盘亮度常数 32000 | 角距离平方近中心梯度退化、L1 导数方向性和有限像素覆盖需要分开检查；不能仅凭观感断言方形一定来自此行 |
| `night-sky.js:14–38` | 同一 UTC/Observer 计算月、真实太阳及 J2000 旋转；+X东/+Y上/−Z北 | 真实太阳结果只用于月面照明；场景太阳仍由艺术滑杆独立控制 |
| `main.js:setSun` | spherical θ=滑杆方位，方位0指向+Z | 与天文北向−Z相反。旧艺术方位 A 对应地理方位 `(180−A) mod360`；真实模式不能直接复用相同数字 |
| `night-sky.js:refresh/update` | 月位/月相/角半径每30s刷新；其间只连续转星图矩阵 | 月盘和月光方向会阶跃。当前代码 Node 实测从29.999到30s，实际间隔.001s却跳 **.11552°**；不是天体真实瞬时运动 |
| 星图 | NASA SVS4851 4K线性HDR、mip、接缝安全梯度；非随机造星 | 星点大小/颜色是作者绘制表示，不是此镜头的 PSF，也非绝对测光 |
| 星/月折射 | 月位 `Horizon(...,'normal')`，星图用刚体坐标旋转 | 没有逐星或逐射线折射；近地平线位置约定不完全一致 |
| 月面 | 真实角半径、近似 libration、Lambert形状、星等修正 | 无地形自影/Hapke/地照；亮度与角面积的距离归一还需核对，避免星等已含距离衰减却再多乘角面积 |
| 夜间预算 | 场景、天空等写FP16前乘预曝光，输出减回 | 正确解决过往夜间下溢，但逐面cube/旧PMREM/历史/低Hz GI不能假定一直与新帧相同曝光 |

太阳和日月星应共享一个观察者/天球约定。艺术模式可以保留，但要明确标名；不能把独立太阳方向和某日期的月相混合后称为真实日期天空。Astronomy Engine 当前固定MIT版本及hash仍以 `assets/night/astronomy-version.json` 为准。

## 圆盘：先隔离方形来源，再选择覆盖估计

[Khronos GLSL规范](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.html) 的 `fwidth` 是 x/y 绝对导数之和，是 L1 足迹；不是旋转不变的圆形像素积分。又因 `dot(rd,sun)≈1−θ²/2`，在盘中心的导数会变小。当前阈值是低成本近似，**但这两件事不证明它必然生成方太阳**：低分辨率、HDR肩部、PSF、升频也可能改变亮核轮廓。

候选按成本递增：

1. **优先**用稳定角距离 `atan(length(cross(rd,s)),dot(rd,s))−radius` 的 signed distance；以射线导数的L2角足迹估计过渡宽度。先用便宜dot包围锥筛选，仅盘周围求角距离。
2. 如果低q/小盘仍明显不稳，只在盘边界局部做固定4×4子射线覆盖，不重复大气/云march。均匀固定格点是像素积分，不能每帧换随机相位。
3. 真正小于一个像素时，不强求像素图案肉眼圆；要守住通量及亚像素移动时的覆盖连续性。离轴/近地平线也不能盲目强制屏幕圆：投影和差分折射可能造成合理椭圆。

在无云、无色调映射/微散射/升频的Float32纯mask里，检查滚转角、亚像素平移、24–70mm及q=.5–1。若旧mask其实足够圆，应推翻“全怪fwidth”的假设，追踪后处理。月盘共用同一覆盖函数。

真实模式太阳半径可由观察距离计算 `asin(Rsun/d)`，采用[IAU名义太阳半径](https://www.iau.org/common/Uploaded%20files/IAUGA2015-Resolution-B3-recommended-nominal-conversion.pdf)作为明确约定，而不是声称太阳真实表面恒定无误差。统一辐射契约也应检查：均匀圆盘的轴上照度 `E=L·π sin²(radius)`；距离改变时照度按逆平方、盘角面积变化，已解析的盘表面radiance不能再多乘一次逆平方。现有32000与方向光3.6属于独立有效标定，不能宣称已满足这条物理关系。

## 更高清不等于去掉绘制大星点

[NASA SVS4851原页](https://svs.gsfc.nasa.gov/4851/)同时提供全星图、**去掉Hipparcos/Tycho亮星的银河背景**及单独亮星前景。8K全星图EXR约124.5MB，8K银河背景约130.9MB；高分辨率仍保留原来的绘制星点。作者的颜色还含近似/目测平衡，并非相机传感器标定。

不要先对整图做腐蚀/锐化/阈值缩星，再声称保留真实星等：亮星重叠、银河细节和非线性绘制核不可唯一反演。官方分层优于盲目去卷积。

| 方案 | 收益 | 反证/代价 | 本轮态度 |
| --- | --- | --- | --- |
| 全星图4K换8K | 简单、细节更多、一个采样；R2实测亮星角宽减约30% | 大星点仍烘焙；源不是保通量同图升级；RGBA16F+mip约85→341MiB | 有明确收益的atlas候选，不能称正确镜头PSF |
| 官方银河层+仅数千亮星目录 | 主要亮星可用正确点核，成本低 | 官方银河层去掉的不止肉眼最亮几千颗，直接替换会缺失中等星等 | 仅实验夹具，不宣称目录完整 |
| **分层目录混合** | 亮星按相机PSF，较暗恒星保总通量进入无膨胀的背景层 | 需离线数据管线、去重/波段/epoch与分界验证 | 推荐的完整目标，须先过资产与性能门 |
| 全Tycho逐星动态渲染 | 变焦/PSF最统一 | 约254万条，上传/顶点/过绘成本高；不能凭RTX能加载就默认全开 | 不作为首选默认 |

可用原始资料：[ESA Hipparcos主目录](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239?format=html&tex=true)有118,218条及Johnson V、B−V、自行/epoch；[Tycho-2](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/259?format=html&tex=true)有2,539,913条及自己的BT/VT波段。不能把Hp、VT无条件当Johnson V；pmRA已经含cos(dec)，不能再错乘一次。取数前核使用条款/署名与hash，不把第三方目录统称NASA公有领域。

推荐取舍：若目标是正确点核，**4K低频银河/暗星背景 + 原生分辨率亮星点核**仍是条件推荐；若R3选择小范围低风险改动，8K作者atlas已有实测收益，是诚实的替代方案。两者不全加。亮星/暗星分界须由同一目录划分：亮星进点源，剩余进离线flux守恒背景，不允许遗漏中间星等或双加。若先只拿到Hipparcos小子集，必须暴露缺口，不能伪称已完成混合方案。详见后附的8K实验，它推翻了“8K没明显帮助”的过强预判。

## 星等、PSF、景深与曝光

星等约束的是**相对积分通量** `F1/F2=10^(-.4(m1−m2))`，不是画几个像素的大圆。每颗星用与亮度无关的、积分为1的核；像素值按像素立体角和核在像素内的积分求得。星更亮可以因饱和/已有镜头散射显得更大，但不能同时任意放大几何半径再提高峰值。

[ESO成像说明](https://www.eso.org/observing/etc/doc/helpsphere.html)区分大气seeing与最终PSF；[PBRT成像方程](https://www.pbr-book.org/4ed/Cameras_and_Film/Film_and_Imaging)明确曝光还涉及快门时间和像素面积。宽视场网页里seeing往往远低于一像素；优先做像素积分与稳定亚像素PSF，不加夸张位置抖动。

最小点核可以是经归一的Gaussian/Moffat近似，合并衍射、seeing与像素响应的有效宽度；不能称已完整解出真实镜头波动光学。现有光圈只控制DOF，若仅星点另乘1/N²、地物不乘，会错误改变星/地灯比率。第一阶段保持全局相对EV契约；未来若引入摄影曝光，`t·ISO/N²`必须统一作用所有场景辐射。

点核只包含窄核心，**不预烘景深或宽光晕**；当前镜头DOF和归一PSF各执行一次。星点与银河均在大气/云透射前注入，不能在最终图上贴一层不受云遮挡的亮点。可研究一次小成本camera star-field pass，供sky合成在cloud march之前读取；环境捕获则用角通量表示，不把相机散焦/衍射烘进water环境贴图。

仍需保留限制：4K低频背景中的暗星是聚合表示，近距离大倍率裁切不是逐星光学模拟；当前RGB颜色/有效吸收不是完整星谱、仪器通带或CIE测光。目录星等和全场绝对lux也不能仅用一个作者星图增益就全部校准。

## 闪烁：为何不能逐帧随机

[Osborn等原论文](https://arxiv.org/abs/1506.06921)将seeing与强度scintillation区分，后者与高空湍流、传播、风、孔径和曝光有关；[正文](https://arxiv.org/html/1506.06921v1)还给出随时间移动的空间强度结构。它不是每个显示帧独立抽签，也不能由本地RH或海面风速唯一决定。

根据用户明确想要星闪的R3取舍，默认采用**很弱、连续、快门平均**的相关强度调制，不给星点随机几何跳动；不再以完全关闭作为默认。受限模型用固定star id seed、少量有带宽的连续信号、单位长期均值、非负通量，并对快门区间解析/数值平均；同一物理时刻在30/60/120fps采样应一致。不能把只适用于某孔径/曝光区间的Young幂律套到几毫米摄影入瞳而不核适用域。缺少实测Cn²/高空风剖面时，应标“物理启发的弱闪烁近似”，而非当地真实湍流。

不为增加肉眼可见效果而让长曝光中的星规律眨眼，不让整片银河同步明灭，不把同一闪烁施加给扩展的日/月盘。星闪相位使用物理/大气秒，不随天文UTC加速几千倍。

## 拟议API与状态域

```js
// 仅schema，不是已实现接口。
celestial = {
  mode: 'astronomical', // 或显式 artistic
  observer: {latitudeDeg:4.5, longitudeDeg:118.6, heightM:2, northYawDeg:0},
  clock: {utcISO:'2026-10-26T14:00:00Z', anchorPhysicalSeconds:0, rate:1},
  refraction: 'standard', // geometric/apparent方向分别输出
  stars: {model:'catalog-hybrid', diffuseResolution:4096,
    scintillation:'weak-shutter-averaged', photometry:'relative-v-band'},
  artisticSun: {azimuthNorthClockwiseDeg:80, altitudeDeg:48, gain:1}
};
snapshot = controller.update({physicalSeconds, adaptationSeconds});
// 输出 UTC、观察者、worldToEQJ、sun/moon geometric+apparent directions、
// angular radii/distances、moon illumination direction、phase/flux与revision。
```

UI负责明确时区后转UTC；controller只接收带Z/offset的UTC值。经度不等于民用时区，不能用系统隐含时区解析无offset字符串。真实模式直接使用天文向量，太阳滑杆只读或显式切回艺术模式；所有地理方位统一为北起顺时针。艺术模式保留旧构图需legacy adapter。

基于本地API，`Equator(...,ofdate=true,aberration=true)`再接`Horizon`可求当前视位置；`Rotation_HOR_EQJ/Rotation_EQJ_HOR`用于惯性星表；`ObserverVector/GeoVector`可建立一致的几何光照方向。月面终止线应采用几何Moon→Sun方向，不能把地球空气折射后的Sun中心直接当月面入射方向。

日月不能继续30s hold-then-jump。候选为惯性空间的前后历表点+连续旋转/插值，必要时自适应缩短区间；近地平线折射在每次当前方向上求，而非直接slerp两个折射后的方位角。星点与盘使用相同折射约定，银河射线需逆折射近似；若第一阶段只支持几何模式，就所有天体统一几何并明确限制，不混用。Astronomy Engine把UT1/UTC近似相同，不能宣称测量级亚角秒历表。

时钟独立：UTC驱动天体位置；物理秒驱动水、树、烟花/声音事件及星闪；adaptation秒驱动相机/曝光适应；音频采样由AudioContext时钟调度。天文倒放/加速不倒放SWE，也不让爆响快几千倍。暂停是否冻结天文时钟必须明确；仍活动的天体/光照revision不能被“树时间没变”的旧静态缓存判定冻结。

## Round 2：推翻过于简单的整合

### 环境、GI、历史不能只共享一个裸preExposure数字

根代理指出当前cube逐面12Hz、PMREM约2s；若UTC加速跨昼夜，存储预曝光可变21EV。**单给现有混合面cube一个EV标签不成立**，因为六个面可能已经各用不同EV。

建议P0采用：

1. 两只256 FP16 cube。每轮冻结同一UTC、云/天气快照、天体方向及捕获EV，写back六面；全部完成后原子发布front。不是只冻结EV却让云/太阳在面间继续换状态。
2. cube与PMREM各有自己的`captureExposureEV`/`physicalSkyRevision`/`utcMs`。standard IBL、water天空查表、反射背景按各自`2^(sceneP−captureP)`补偿一次。PMREM不能默认与front cube同epoch。
3. 倍率只修**存储尺度**，不能把旧月夜的物理天空变成新白天。UTC跳变/物理天空超阈值时，终止过期job，做一次可控低分辨率完整cube/PMREM刷新；正常速率渐进更新。准确阈值由实验定，不先声称零延迟。
4. 新日景不能用旧夜间P=21强行写FP16后再比率补救，溢出已经不可逆。捕获EV须按该固定天空快照的安全范围选择。双cube额外256分辨率含mip约4MiB，比整套FP32/巨大cube更低成本。
5. **反推翻**：若scene P变化仅因本地灯/烟花headroom而物理天空没变，应只改比率，不强制重建天空。区分physicalSkyRevision与storageExposureEpoch，避免每次爆闪触发六面峰值。

GI也应存物理Float32系数、在receiver统一乘sceneP，或明确GI自己的captureP；2Hz旧缓存不能直接与新帧相加。时域RGB历史按自己的historyP补偿后再做裁剪/混合，深度/age不缩放。仅存储P改变不应被误判成物体照明突变。

地灯、手电、烟花、可见发光体、星点、天空和反射共享同一源到存储换算且只乘一次P；不能只有太阳/月亮预曝光。现有“按月亮建议21EV”还不足以保证加入近距离高亮发光体后FP16不溢出。相机摄影EV、numerical storageP及display nits是三种职责；选择storageP需要headroom与暗部精度实验，不能在末端clamp Infinity掩盖失败。

替代方案：全FP32物理环境可避免曝光标签，但PMREM现路径/float过滤能力和带宽必须重审；同步每帧六面能消除混面，却不符合默认成本。**当前推荐双cube+标签+物理变化阈值整刷**，不是全加三种方案。

### 对CONTROLS-QUALITY草案的交叉结论

| 草案点 | R2判断与修改要求 |
| --- | --- |
| view/time/weather分域 | 保留；真实模式日期不再暗改相机/云况，组合场景另标明 |
| 时段可写“曝光策略” | 收窄：保留用户autoExposure开关与userEV；只有已启用auto时，UTC改变自然改变推荐值。推荐夜景摄影组合才可显式改策略 |
| 第一版暂不动12面/2s频率 | 频率可保持，但曝光epoch/原子发布是天文加速前置条件，不能推迟到美术收尾 |
| 同seed/time回放比较画质 | 需要三个明确时间：UTC、物理模拟秒、天气密度/平流相位；一个`time`不够重现 |
| 画质不删发射源 | 同样适用于星等。少画星不能简单叫同一物理天空；低档须保留未解析通量或明确精度让步 |
| 海风影响树/云/风浪 | 这项公开联动可保留；不能据此声称本地海风/RH给出了真实高空scintillation谱 |
| 局部灯cd换场景量 | 可用有效参考标定，但恒星V波段与RGB/cd的参考须明示，不能借此宣称完整绝对测光 |

### 交叉审再收窄缓存与有限距离光学

已读 `FIREWORKS-CROSS-REVIEW.md`，接受三项约束：`physicalSkyRevision`不能随每帧UTC递增，否则连续加速会不断取消back job；snapshot必须冻结实际weather/support纹理内容、平流/密度time与相关uniform，不能只copy UTC或共享仍被改写的Texture引用；逐面12Hz的一轮捕获窗口约.5s，rate600已跨约5分钟天文变化，还要另计front年龄和PMREM延迟。实际状态应报captureUTC、age及天体角误差，以明确阈值/整刷上限控制，不称零延迟。

有限距离烟花/烟不能混成无限天空光学：主色已混合而aerial/DOF仍读opaque背景depth时，250m火星可能被当作无限远。reactive mask只能处理历史，不能修这条光程/CoC错配。R3须另选有有限深度的effects层/合成契约；这里的星空pass只处理无限天体。未解析目录暗星进入背景时仍按texel立体角守恒，纬度高不能悄悄增能。

### 实际8K实验：推翻“只换分辨率没有明显帮助”

根代理授权后，已完成官方130,530,278-byte 8K EXR下载、hash/HTTP元数据留存、两源float32解码、12颗同批HIP亮星角FWHM与球面积分、24/70mm相同曝光离线投影，并实看三幅图。完整方法/证据/限制在 [ATLAS-EXPERIMENT.md](ATLAS-EXPERIMENT.md)，原始数值在 [measurements.json](atlas-experiment/measurements.json)。没有改运行时或上线asset。

8K/4K角FWHM中位为.713水平/.691垂直，全部12颗都更小；8K确实更细、更圆，**此前若认为分辨率提高没有明显收益，应推翻**。但8K亮核仍约12–17角分，70mm离线图仍是7–10px的宽斑；它不能自动成为此镜头PSF。更重要的是，同.30°孔径亮星通量中位比.557，全景RGB球面积分比却.284–.292，源之间不是保通量的等价重采样，单一EV不能同时匹配银河与亮星。

据此R3在“可接受烘焙亮斑的8K atlas小升级”和“带资产/通量/性能门的目录混合”之间明确选择，不默认全上；不锐化/缩星来伪造目录测光。8K源/显存成本及其实际网页GPU效果仍需实现后的单独验收，不能用离线3.4s脚本耗时证明实时性能。

## 验证计划与停止条件

1. **历表/连续性**：多个UTC、南北纬/经度/跨日界线，与当前固定版本精确API对照日/月方向、月相/角半径；查0/360°、午夜、30s边界及加速/倒放。记录最大角误差，插值不能以每30s几像素跳变换CPU。
2. **圆盘**：先Float mask再完整HDR/PSF链；旋转/平移/q/focal对照像素积分参考。把几何投影、折射椭圆与方形采样区分。积分通量与角半径变化同时验，不只截图“更圆”。
3. **星点**：至少几组不同星等和亚像素中心，归一核通量、5等100倍关系、滚转/变焦/分辨率稳定；背景/目录分界无遗漏/重复。禁止用变暗或加大圆点取得较低HF指标。
4. **光学链**：DOF开关、孔径、相对EV、HDR/SDR及预曝光0/10/21等价性；PSF/景深/大气消光每条路径只一次。测试本地灯/爆闪时星点与地物亮度比、FP16 finite/暗部损失，不能只读最终白点。
5. **星闪**：同一物理时刻30/60/120采样一致，长期均值近1；更长快门降低高频强度变化，无逐帧random、无全银河同相、无恒星几何跳像素。缺Cn²时不标实测物理闪烁。
6. **缓存对抗**：UTC跨日落/日出、日期地点跳变及scene P单独变化；逐面EV一致、front原子发布、PMREM独立标签、过期job取消、历史补偿、GI换算；查FP16不溢出及旧天空不残留数秒错亮。
7. **基准分组**：固定UTC/观察者/相机/云密度快照/物理回放/输出尺度和采集调度后，比较星模型与质量档；预热后多个12–20s窗口，记录CPU/GPU/p95及capture次数/纹理内存估算。另做UTC rate=1/60/600的运行压力，不能把夜空变便宜误认为新算法更快。

未实测预算目标：纯圆盘AA应接近现成本；目录混合增量目标约0.5–1ms GPU、天文CPU均摊<.3ms/帧，**须以实际目录数量/云路径和硬件证明**。默认4K低频层，8K为能力/显存可选；不承诺所有设备60fps。若星点RT/缓存方案超预算，先保留统一时钟+正确圆盘、回退明确标为旧atlas的星空，不把所有候选同时上线或用不受云挡的贴片冒充修好。

本轮只下载研究用官方8K源和V<2的小目录查询，生成离线测量/对照，未下载全目录、未修改运行时或上线新天空资产。下一步由根代理R3选定接口、atlas或目录分界、缓存方案和性能门，再分工实现。

### R3资产取舍的已授权前提

根代理已传达用户选择个人非商业用途，可使用署名星表；数据许可门据此明确，未擅自引入商用无限制承诺。已选I/239原HIP + I/259 Tycho-2，不为网页不可见的HIP2精度增加未明来源。最新直接下载的**两份CDS ReadMe正文都明示CC BY-NC 3.0 IGO**，不是从页脚推断。raw与runtime派生各保留来源/许可及Credit ESA、作者、CDS。

完整下载接口、已实取5行字段/单位反例、epoch/pm、分量合并/分界不漏星、官方银河与自建master的已知窄范围不一致、入云前合成与方向tile候选方案，冻结在 [CATALOG-DATA-ROUTE.md](CATALOG-DATA-ROUTE.md)。首版优先tile原型而非默认额外全frame starRT；真实候选数/通量/性能失败时才回退另一后端。尚未开始runtime实现或全表下载。
