# 连续天球与目录星点：实施与验证边界

2026-10-26。当前源码/派生资源已冻结，目录系统去重后的第二轮真实GPU复测已通过。下面区分已实现、CPU/隔离GL证据与尚待全场视觉证明；不把研究预算写成实际帧率。

## 已实现

`celestial-controller.js`使用本地固定版本Astronomy Engine。UTC的rate/running与物理秒分开；每30UTC秒取精确端点，日/月方向、相位、角半径和libration连续插值，EQJ旋转按当前UTC精确计算。地理方位北起顺时针，世界+X东/+Y上/−Z北，旧艺术方位有明确adapter。支持几何/标准折射方向，不把每个UTC tick变成discrete revision。

`night-sky.js`的外部模式只接受controller snapshot；`update(physicalTime)`只推进物理星闪，不再自己走另一UTC。旧setNight日期/地点入口仍可显式切回兼容内部时钟。标准折射下，星/银河射线用同一Meeus近似的逆映射；日月用Astronomy Engine normal apparent方向。日/月共享angular-SDF、L2屏幕梯度覆盖，替代近1的dot阈值/fwidth L1近似；可以用`uCelestialDiscDebug=1/2`隔离太阳/月亮mask。它仍是低成本覆盖近似，不是精确像素圆盘积分。

真实模式太阳角半径来自距离；直射、大气、云源照度乘1/d²，而已解析盘的表面radiance不再多乘该因子。月亮的integrated sourceRatio已含距离，转换表面radiance时补偿角面积，避免面积再重复带入距离衰减。现有太阳盘32000与方向光3.6仍为旧的独立有效标定；本轮没有把它们改造成绝对盘积分测光一致，也没有宣称如此。

`sky.js`新增：

```js
setCelestial(controllerSnapshot)
setStorageExposureEV(P)  // null恢复兼容自动存储策略；摄影C由root负责
prepareStarView(renderer, actualCamera, {width,height,storageEV,frame,optics})
captureSnapshot()
withSnapshot(snapshot, synchronousCallback)
getRadianceBound()       // P前maxRGB、components、limits
setSampling({cloudSteps, atmosphereSteps}) // 8..128、4..16
```

Snapshot复制所有可变uniform坐标、时间、天体与曝光及星图view元数据；初始化后不再改写的noise/weather/catalog纹理共享引用。`withSnapshot`内拒绝timed update，回调必须同步，退出恢复live状态；不能拿snapshot里的Texture引用去并发改写内容。prepareStarView不画额外RT，也不改renderer GL状态；主视图和每个cube face都要用实际投影/RT尺寸准备。它选择保守native/wide表，并接`frame.rawPerCandela`、`optics.shutterSeconds`。

## 全表与派生资产

用户已明确仅个人非商业用途，允许署名星表。HIP原I/239与Tycho-2 I/259原ReadMe正文均标CC BY-NC 3.0 IGO；原始表、派生与NASA背景各保留自己的来源，不把原创网页代码重许可。原始23文件共257,048,129bytes仅保留在`verification/plans/assets/catalog-source/`，含逐文件URL/时间/HTTP头/hash；浏览器只取`assets/night/catalog/`派生。

- HIP原始118218行、Tycho主表2539913行、补表17588行全部解析；263项HIP精确坐标空列用该行原HMS标识坐标回退，不擅自填0。
- 去重优先HIP系统光度与交叉id，Tycho独立组件保留，不因相同坐标删真分量。先合master再分点/背景，不用两套不相容8等过滤器制造缺口。
- master **1,496,028项**；选到V≈8.5的 **77,925个点源**，其余 **1,418,103项**聚合为2K背景，所有层为相同master的互补分区。m7–8保持点核，不进低分背景大斑。
- 点源与星等无关的sigma=.35pixel核，按像素内Gaussian积分分配通量；宽镜头散射/DOF后续只做一次。小角候选用稳定方向差平方，避免长焦下dot/cos接近1失精。
- native候选平均3.97705/最大50；wide平均41.52379/最大225。最大256 loop是已校验上界，加载遇超界会拒绝，不悄悄丢星。两表还包含±200年自行的保守support；HDR数据/ray derivatives在candidate分支前准备，loop只有texelFetch，无隐式纹理梯度。
- 暗星按texel真实立体角分配，所有手工HalfFloat mip用球面面积权重；所有mip相对输入通量误差<.001的CPU门通过。2K较暗星仍是聚合层，不提供逐星高倍率/年代自行或逐星闪烁。
- 官方NASA无Hip/Tycho4K背景并非full4K的等增益可加层，其RGB球积分(.383,.337,.298)反而高于full(.223,.199,.181)。没有用full−background倒推出负目录通量；两类源的有效标定分开声明，不声称精确重建原1.7B作者流程。

NASA列出的18颗Yale补星已独立审计：全部在当前HIP/Tycho master中有≤4.14角秒近邻（`plans/atlas-experiment/yale18-audit.json`）。没有再装入Yale光度补表。双星须比较10角秒组通量，不把两条Yale组件简单重复加到已表示的系统；Eta Car等变星的固定旧目录值与NASA2020估计不同，不编造当前年变星光变曲线。

### 已识别fallback系统的重复光度修复

独立系统组审计发现，HIP没有精确位置而改用原HMS标识坐标时，部分Tycho对应分量没有HIP交叉号，单靠id会将同一系统总光度和组件再算一次。修正仅审查203个已进入master的fallback HIP邻域，以交叉号、已知CCDM与组光度相容性，或小于1.5角秒且光度差小于.25等的单匹配作证据。最终保留HIP系统总光度，采用匹配Tycho组的加权位置/自行，退出56个组件alias，涉及41个系统；不会因为坐标近就删除真双星。45个有邻居但证据不足的case和一个多HIP邻域保守保留，不声称已证明整个目录绝无别的跨表重复。

`assets/night/catalog/system-reconciliation.json`保留原HIP、候选组件、距离/光度/CCDM、判据、退出ID与最终位置；不是只留删后计数。HIP55203、HIP78727、HIP31067的10角秒组星等由错误的3.006、3.484、5.428恢复为3.790、4.160、6.180，分别只有一个系统光度。当前manifest SHA256为`d1a7a3eff996fab957009c6865d97859c7e9928791794ea5e5088bd0c9d98163`；全部派生文件的hash随manifest保存，第二轮浏览器重载发生在完整发布之后。

## 星等、颜色与弱闪烁

目录V等积分遵守`10^(-.4m)`。V=0的有效大气外照度零点取2.54e−6lux，再乘root统一`rawPerCandela`工作标尺；E=I/r²下该标尺与场景照度一致。此常用零点也见[Crumey2014论文](https://arxiv.org/abs/1405.4209)及[作者原文](https://crumey.co.uk/archive/astro/mnras.pdf)。最初Keck技术说明被搜索索引完整缓存，但当前其PDF直接链接返回404，故不把它作为唯一可现场复查的出处。

颜色为[Ballesteros黑体有效温度近似](https://arxiv.org/html/1201.1809v2)、Planck曲线与[Wyman等2013 CIE1931分段拟合](https://jcgt.org/published/0002/02/01/paper.pdf)，转换linear sRGB后归一Y。缺色明确计数/白色fallback，Tycho BT/VT到Johnson V是原ReadMe给出的近似。没有声称实现真实恒星吸收谱、相机通带或所有颜色的精密光度标定。

默认星闪是物理秒驱动的弱连续相关强度项，顶天有效RMS约.03、近地平线有界增强；稳定id seed，非逐帧random，不改几何位置，不让银河同步眨眼。各正弦按快门区间乘sinc，长曝光降低高频；时间模4096s选择整周期频率，避免模型wrap跳变。无当地Cn²/高空风测量，称有效scintillation近似；扩展日/月不套同一闪烁。

点和diffuse在体积云积分之前进入同一celestialRadiance，空气消光一次，sky最终统一乘P一次。cube采用其自身角足迹，低分256 cube中点星会成为保通量的角分辨率聚合；水的天空反射还受该cache分辨率限制，不能声称拥有主视图的全分辨率星PSF。

## 验证证据

- `verification/celestial-controller-check.mjs`：**26/26 CPU通过**，UTC/物理秒、倒放/暂停、revision、精确历表点对照、30s边界连续、左右手/heading、snapshot恢复、C/P分离。
- 既有`verification/night-sky-math-check.mjs`：**30/30 CPU继续通过**；Node无纹理加载，不代替新目录真实GPU照明验收。
- `verification/star-catalog-check.mjs`：**21/21 CPU通过**，真实原表行数、互补分区/通量、两表合计16000次跨cube face/1800–2200自行随机support检查、所有球面mip、亚像素核通量、星等比例、快门平均/时间wrap；另核对退出alias映射/不再渲染，以及三个已识别系统的总光通量。
- `verification/celestial-disc-gpu-check.js`导出`runCelestialDiscCheck(THREE,renderer)`：生产共享SDF的Float32纯mask，root实际**4/4 GL通过**，记录`playground-first-gpu.json`；最大面积相对误差.01372，质心误差.0501像素，滚转通量差.00496。它是隔离mask覆盖检验，不是HDR链全场验收。
- `verification/star-field-gpu-check.js`导出`runStarFieldCheck(THREE,renderer,atmosphere)`：真实上传data/lookup、生产GLSL、亮/暗同核、当前与远期epoch、实际face-seam星、积分通量。root在系统去重后重新载入，**4/4 GL通过**，记录`playground-second-gpu.json.stars`；最大积分通量相对误差.00024068，m7.5与亮星归一PSF最大像素差.00002002，实际seam星index1388。逐Float32像素回读后用CPU `Number.isFinite`校验，不依赖GPU `isnan` reducer。

第二轮同文件的全场NaN reducer夹具未通过，因为ANGLE将其`isnan`分类优化为false；这些旧`countNaN=0`不作全场无NaN证据，也不能用本节隔离星点的通过代替全场判断。后续root将分类改为IEEE指数/尾数位判断，`playground-third-gpu.json`的独立NaN/Inf夹具**11/11通过**，使后续全像素范围结果才具备分类证据。

### 全场范围验收另外暴露并修复的叶材质问题

第三轮有效reducer发现镜像缓冲有两个负RGB分量，消融定位到叶diffuse颜色，非星点/太阳盘。实际CPU生成的所有顶点色和8bit albedo均非负，但MSAA默认smooth varying可以在极细叶三角形之外外插颜色。叶材质仅将两端`vColor`声明改为centroid，保持UV、normal导数、风、GI与薄叶能量公式原样；未在RGB末端clamp。

`playground-centroid-gpu.json`提供两层实际GPU证据：隔离夹具**9/9通过**，8x MSAA smooth出现12个负分量、centroid为0，0/2/4/8的alpha覆盖逐像素及积分完全一致（0/2/4该夹具未复现负色）；真实同paused time/pose/env A/B中，opaque/composed/reflection负分量从6/4/5降为0/0/0，反射minRGB从(−.006664276,−.002485275,0)变为(0,0,0)，所有目标NaN/Inf为0。原运动/覆盖/当前与历史depth回归**14/14通过**。详细基线hash、接口与限制见`LEAF-CENTROID-NOTES.md`。这封闭的是特定的MSAA颜色外插根因，不意味着所有植被时域闪动已消失，也不是星空模块整体视觉验收的替代。

小型Node测时：600次controller update总17.5ms；120次移动setCelestial约28.8ms，120次完全相同snapshot约14.0ms。它们是本机CPU小夹具，不是整场帧率，也不证明集成后的材质/云/PMREM成本。native/wide使用不同候选数，质量比较必须固定真实FOV/RT尺寸/天气/UTC再测。

目前wide lookup为1024×4083，需要MAX_TEXTURE_SIZE≥4096；目标RTX可满足，但不能把它外推至WebGL2最低2048能力。若以后要求最低能力兼容，可将同一flat数据重新打包到2048×2042再做完整性/GL复验；本轮冻结期未擅自改资源布局。

## 只读集成审查发现

root当前主视图prepare→source bounds→P选择→应用lighting的顺序已接入；环境每face在withSnapshot内准备自己的camera和尺寸，恢复live状态。

另发现RH/空气系数必须先于source-bound计算更新：暂停下RH.95→.40、sun3°、aerosol8的实际CPU计算，旧Mie42.86的bound488选P5；若本帧晚些才设新Mie10.01，太阳raw峰6105×32=195363，超FP16 65504。root已把空气参数更新移到每帧预算之前，setWeather也先刷新空气/重算P，P确定后再更新air lighting；不能靠末端clamp掩盖。这里没有改main，也未将修复顺序本身当作全场范围检验已经通过。

仍须由root按全场验收记录判断：日/月/星主视图与水/环境对照、云遮挡、HDR/SDR、UTC加速、局部亮源爆闪弱星、同条件各档CPU/GPU窗口和实际可见性。本节不把隔离helper通过扩大为所有光照条件已验，也没有给出已完成照片级夜空或保底帧率承诺。
