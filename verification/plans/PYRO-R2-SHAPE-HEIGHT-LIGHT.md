# 烟花R2：笑脸、产品尺度与光照路径

2026-10-27，**只读研究/候选方案，未改运行时**。本文只针对图形与声光模拟，不含烟花化学配方、装药、制作或实物燃放操作。声音`fireworks-audio.js`保持用户第三次试听接受的`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`，不再提高gain；新高度/位置只能自然改变传播距离与到达时刻。

检查时源码：`fireworks-physics.js` SHA256 `2cc716d0bfb49639c6f0e55975cdf41b60736c5b33f47bba974b9b79e1613939`，`fireworks.js` `606d57528ec7c28e36d56734746a00826ef03272aea86ff5e42f6bff29486abf`。后续实现需重新记录hash，不能把本文CPU诊断当GPU或整场FPS。

## 先做什么

建议Phase A只做**真实世界平面的笑脸图案 + 口径/产品参考高度元数据与预设 + 下文已独立证伪的烟HG方向符号窄修**。保留其它九类、已验证的解析轨迹/风prefix、PSF/尾迹、两个主事件限制和锁定音频。先获得可辨识的生产GPU多视角结果，再进入照云/持久烟/间接光；不一次改完整渲染链。

Phase B才接有限源→云/烟→相机以及新光源的一跳地表反弹。Phase C做持久烟库和导演镜头/光晕，分别由`PYRO-R2-PERSISTENT-SMOKE.md`及`PYRO-R2-INTEGRATION-CAMERA.md`给出反审。光晕是镜头对比度/能量分布的一部分，不用于补偿错误源强。

## 当前实现：已有差异与真实缺口

`fireworks-physics.js:6–17`有十种定义；`:79–118`生成世界空间事件；默认80°的空中壳在apex爆开，height是当前世界Y高度。以下高度不能混用：

| 类型 | 作者height(m) | 默认可见时段/结构 | 实际字段语义 |
|---|---:|---|---|
| peony 牡丹 | 124 | 224星，基准burn3.1s，无长尾 | 空中爆点高度 |
| chrysanthemum 菊 | 138 | 192星，4.3s，尾迹 | 空中爆点高度 |
| willow 垂柳 | 160 | 160星，实际life10.2–12.7s | 空中爆点高度 |
| palm 棕榈 | 116 | 12条大星，life5.4–6.4s | 空中爆点高度 |
| ring 圆环 | 122 | 144星，基准3.6s，固定世界平面 | 空中爆点高度 |
| heart 爱心 | 122 | 144星，基准3.8s，固定世界平面 | 空中爆点高度 |
| crossette 分裂十字 | 104 | 36母星→144子星，共180实体 | 空中爆点高度 |
| strobe 闪星 | 128 | 160星，每星独立2.3–4.7Hz | 空中爆点高度 |
| fan 扇形彗星 | 44 | 9星，34m/s、分时发射 | 名义上升顶点；ground=true，burst=发射点 |
| bouquet 近地花束 | 32 | 104星，21–31m/s | 名义上升顶点；ground=true，burst=发射点 |

burn是基准而非所有星严格同时熄灭。默认星life另乘`.88–1.11`，形态有独立override（`:91–109`）。同类低仰角保持原muzzle speed，**不会偷偷加能量维持原爆高**（`:81–87`）。独立seed11/origin0的CPU诊断中，空中默认80°爆点逐值等于上述height，飞行约4.35–5.33s；25°时104–160m作者爆高自然降到约21.6–34.1m。顶端星再向上飞，所以爆点高度不是整个图案最高点。

ground的height虽不是轨迹控制器，**不能因此定性实际高度错误**。同一CPU诊断按20ms采样得到fan最高42.97m、bouquet30.76m；root另用seed1、真实原点得到43.67/32.41m，均接近名义44/32。要修的是元数据/控制语义：分别报告`burstHeightAboveLaunch`与`visibleApexRange`，不把ground图案叫作44m空中爆炸，也不让新增height滑杆对它们无效却悄无声息。

## Primary形态证据与已实看的像素

主要用专业展示公司Optimum自己的[Smiley Face Shell照片](https://www.optimum-fireworks.co.uk/images/glossary/smiley_shell.jpg)和[Heart照片](https://www.optimum-fireworks.co.uk/images/glossary/heart_shell.jpg)，均已通过图片工具实际查看，不只读名称；笑脸JPEG另在内存直接解码复看，未落运行时资产。笑脸是倾斜的椭圆外环、双眼和下部U口，外环/嘴多为白亮芯带粉红边，眼有绿/青点；不是可核实的纯黄外圈加全绿面部。边缘是离散点/短迹，不应要求数学绝对平滑。两图无可核验快门/ISO，不能从曝光后的白芯反推原色谱，也不能由光迹长度推断瞬时火焰尺寸或cd。

Optimum的[原始图鉴](https://www.optimum-fireworks.co.uk/glossary.html#)明确解释同类图案弹可能倒置、倾斜或侧看成线，通常用多发增加面向观众的机会。制造商[三遠煙火产品页](https://san-en-fireworks.com/index/products/productse/)的真实牡丹照片也已查看：球形星群与图案弹的平面轮廓不同，不能只用相同圆球换颜色。前两类在单色/同曝光下仍应能辨别。

定向限制另有烟花从业者Mike Tockstein直接受访的[原始访谈](https://www.salon.com/2022/07/02/we-asked-experts-how-they-make-fireworks-that-explode-into-shapes/)交叉支持；它是从业者的一手口述，经媒体发表，证据性质与厂商自己文字分开。这里只使用形态/观看限制，不采用文中制作细节。

## 笑脸：世界平面与定向展示必须分清

现`planeBasis(azimuth)`在`:71`给固定世界right/up/normal，ring/heart在`:96–100`生成平面速度；没有逐帧读取相机。root草案选同144星：外环72点、双眼各12点、口弧48点，计数正确；先支持这一个候选，不混测更多点数。它是**图形分配**，不是实物内部结构复刻。特征取弧长均匀分布；尤其U曲线按参数等步可能在底部密集，造成局部加亮。眼半径/间距与口的位置要在正视同色图和实际PSF下检查，不能靠增宽kernel遮住布局错误。

root提出黄外环+绿眼口，可以是明确的作者palette；实拍只证明图案结构，不证明这组精确颜色。显式palette请求应可使全形态按用户所选单色，默认分区色只在未指定palette时生效；source ledger必须逐星保存真实颜色，不能渲染是绿眼、照云却全用黄色。共同drag.16/重力使平面整体平移展开，支持保留；不能给眼/嘴不同衰减到图案未展开就缺失，除非作为另案时序设计。

建议事件保存`patternQuaternion`，在发射/爆开时确定，后续相机拖动不修改。星群有真实位置/初速并受同一重力/风阻；不要在爆后将整体字形刚体旋转或重新排回人脸，形成悬浮全息投影。图案坐标去公共平移/质心仅为稳定中心；代表星体质量未知，不把亮度加权中心自动称为完整壳弹动量守恒。

两个明确模式：

- **实景取向**：seed决定平面姿态/roll，可倾斜和倒置；不是始终可读。随机姿态须有明确分布，不能每帧换种子。真实壳弹难保证朝向，模拟可展示其限制。
- **定向展示**：以一个固定观众方位确定朝向，必要时取发射时的参考观众方向并冻结；标明是艺术/编排控制。它可以让预设镜头容易看清，但不是实物壳弹保证定向，也不是相机每动就追转。

对于小于观测距离的平面图案，斜视投影宽/面积因子约`abs(dot(normal,view))`：60°约减半，85°只剩.087。侧面不好读本身不是渲染失败；若用户希望从所有方向都可读，应另选真正三维多层图案（例如土星球+环），不能把同一平面笑脸说成360°可读。反面镜像对文字也有意义，不能自动翻UV替用户作弊。

类型ID有两条可接受路线：新`smiley`、旧`ring`显式别名；或root草案保内部`ring`兼容UI/队列/API，同时在definition/event/diagnostics明确`label:'笑脸',pattern:'smiley'`。后者无需迁移请求格式，但旧ring请求的可见行为已经改变，必须记录版本边界。所有十类标签、GPU联系图、测试、自动编排都按pattern核对，不能继续宣称该版ring是原圆环或让历史“圆环通过”的证据冒充新笑脸通过。未来复杂图案另设profile；不一口气塞任意文字转换器。

## 高度依据：口径是重要条件，但不存在单一万能表

以下只取制造商/供货商公开**成品效果高度/尺寸**，不引用配方、装药或发射操作。相同口径也随产品不同，故数据是参考产品，不是必须复现的普适自然常数。

| Primary来源 | 公开例子 | 对本场景的用法 |
|---|---|---|
| [三遠煙火官方Products](https://san-en-fireworks.com/index/products/productse/)，表引日本煙火協会2009 | 90mm：爆高120m/最大宽60m；150mm：190m/150m | 有爆高和宽度的完整关联，适合作为两档可视尺度参考 |
| [Skylighter官方高度表](https://www.skylighter.com/blogs/fireworks-information/firework-display-charts) | 76/102/152mm分别约120/150/210m | 与前者同量级，但不能把150mm强行等于唯一高度 |
| [JinPing官方75mm产品系列](https://www.pyrotechnic-manufacture.com/3-series-display-shell-products/) | 普通牡丹/菊/棕榈等产品100–110m；mine40–50m | 同系列既能有不同形态，也有地面顶点与空中爆高的类别差别 |
| [JinPing官方150mm系列](https://www.pyrotechnic-manufacture.com/china-wholesale-shells-fireworks-factories-6-series-display-shell-jinping-fireworks-products/) | 普通系列160–170m、部分带尾170–180m | 反证“每英寸必定同一爆高”的强规则 |

补充可直接支撑root三档的官方表：烟火公司[Rise尺度图](https://rise-hanabi.jp/fireworks/knowledge/)列公称90/120/150/180/210/240/300/600/900mm，对应高度120/160/190/220/250/280/330/500/600m，开花**半径**30/65/85/110/120/140/160/240/275m；全宽为其两倍。不要把图中的半径误读为全宽。[制造商小千谷4号官方说明](https://ojiyaenka.base.shop/items/34029650)另明示高160m、全宽120m，与Rise同高、宽差10m。三遠150mm高190m/宽150m与Rise宽170m也不同，保留产品差异，不挑一张表声称所有公司都相同。

因此Phase A可限定三档**日本公称产品尺度参考**：90mm/120m、120mm/160m、150mm/190m，取固定名义值，具体类型分配是作者编排、不是效果名称自然决定高度。建议第一轮分组：90mm给牡丹/笑脸/分裂十字；120mm给菊/爱心/闪星；150mm给垂柳/棕榈。这样8空中类有3+3+2个明确层级；root也可据构图调换类型，但不改来源高度。ground fan/bouquet继续保原速度与实测apex范围，不硬塞这三档。

宽度来源单独记录：90mm参考60m；120mm参考120m（小千谷）或130m（Rise）；150mm参考150m（三遠）或170m（Rise）。若Phase A暂只关联高度、仍保原扩张速度，宽度字段必须标reference-only/尚未校准，而非声称已复现整套口径。不能每帧随机高度，也不把资料间跨度说成同产品公差。

建议数据：`{profileId, calibreMm, burstRiseMetres, burstSpreadMetres, heightSourceURL, heightEvidence:'supplier-example', ...}`；单位同时保留发射地面相对高度与海面世界坐标。80°按参考apex定初速，低仰角继续沿现有固定动能语义；若用户选择“目标爆高”，它应是另一种明确控制，不静默改变发射能量。**形态、口径、颜色、光强不能简单捆成一个索引**。

larger calibre还会改变爆开直径/星数/燃烧时间；Phase A若只变高度，应清楚称高度参考阶段，不声称整个口径产品仿真完成。尺寸/速度下一步应单独按参考宽度校准，不能为了填满画面自动把粒子放大。晴天和湿云底约110m是不同介质环境：升到云里的星应被云遮蔽，不为笑脸可读偷偷清云。

## 作者光度：现数值没有真实测量背书

源码`:1`已明确authored reference cd：rocket18（`:87`）、通常单星5–10（`:91`）、willow2.8–5.2、palm48、fan52等是作者参考，未找到与本实现颜色/尺寸/燃烧阶段对应的实测数据。已有供应商高度表**没有**给出单星cd，不能拿它为这些强度背书。一次有界检索找到烟花火焰摄影测光研究，但摘要不足以取得可复用的时间光度/SPD数据，未据此编造范围。

Candela是光度强度，非总流明或某个RGB最大值；见[NIST定义](https://www.nist.gov/si-redefinition/candela)。`rawPerCandela=3.6e−5`是本场景声明的有效参考，不是整景绝对测光。色谱→近似单位Y RGB、纯蓝高最大通道、有限源尺寸/积分PSF、曝光C与存储P必须分别保留。

不能为“照云明显”单独把cloud gain拉大。作为尺度算例，约200颗×7.5cd≈1500cd的作者星群，在无遮挡100m处点源照度约.15lux；到距120m爆点约693m的晴天云底，约.0031lux。它是未计角度/云气消光的量级说明，不是实测整发输出；烟花的发光会随时间变化，光簇也不是真正点源。它说明280m range只是当前工程截断，不是物理光突然消失；日景100000lux附近这种额外照明可能几乎不可见，不能保证任何天气都亮出彩色云。

先保持既有作者I做受控同C对照，记录可见源/地表/air的相对响应；若后续有可信测量，统一调整source ledger与全部受光路径，连同FP16 bound重新验。不得分别调“星看起来亮”和“云被照亮”的倍数，再称能量一致。

## 当前光照链与待补路径

| 路径 | 当前源码事实 | R2需要承认/补齐 |
|---|---|---|
| 可见星/尾、镜面烟花 | `fireworks.js:181–197`真实星/短段；mirror独立effects绘制 | 保留积分PSF/尾能量，别用多一团glow代替源 |
| 原生地表/薄叶 | `local-lights.js:74–75,83–85`将两光簇变PointLight并接薄叶透射 | 近场是两团聚簇近似，非逐星照明/遮挡 |
| 水底/泡沫 | `water.js:155–165,228`接local incident；`:229`显式高光仅torch | 烟花主要镜面亮迹来自真实effects反射；不重复再加聚簇烟花太阳式高光 |
| 相机空气 | `aerial-perspective.js:123–136`有限local incident入单散射 | 现source→sample无独立烟/云消光，不能称完整丁达尔/互遮挡 |
| 自己的烟 | `fireworks.js:207–211`sun/ambient及两簇HG近似 | 无烟自身/云对入射光完整遮挡，旧烟没有独立生命周期 |
| 云 | `sky.js:420–424`只有日/月key与ambient | 没有烟花有限光源项，不能宣称照云已实现 |
| 间接反弹 | `indirect-lighting.js:203–210,256–267`只接directional输入，2/4Hz | 还没有局部烟花驱动的一跳/两跳；不要只提升环境亮度 |

注意旧说明中`pathFlags.specular:false`（`fireworks.js:205`）没有在`local-lights.js`转native Point时被消费；原生PBR实际上仍可产生聚簇specular。水只给torch加解析local glint，路径与原生材质不同。升级前须明确保留近似或按flag做正确预算，不能照抄“所有聚簇均无specular”的文字。

建议有限源契约：同一原始`sourceLedger`输出`eventId/position/intensityRGBReference/sourceExtent/physicalTime/pathFlags`，再派生至surface/air/cloud/smoke/GI；没有P、没有toneMap、没有bloom，主帧统一乘一次P。light range是带误差界的裁剪策略，不替代物理I/r²。

单散射候选的源项为`j(x,view)=sigma_s(x)*phase(light→view)*Σ[I_RGB/r² * T(source,x) * V(source,x)]`；相机得到`∫T(camera,x)*j dx`。source→sample与sample→camera是两段不同路径，分别衰减不属于重复；把已衰减到camera的屏幕火星RGB再当灯源才是重复/方向错误。见原作者[PBRT Point Lights](https://www.pbr-book.org/4ed/Light_Sources/Point_Lights)、[Transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance)。本项目低成本采样会是有偏近似，不宣称PBRT的无偏积分。

云内项不能仅把现range280m的localIncident粘进现有云shader：晴天云离爆点已超过它。应从raw source ledger计算物理衰减，再有明确远截断误差/finite-radius正则；云内view opacity与入射光遮挡均需一致。不要改整个天空底色，更不要将烟花写入长期PMREM造成残光。

主天空出现受光云后，水仍从岛上纯sky cube取反射，而mirror capture隐藏sky，可能天上闪、水中不闪。Phase B必须选择并标明：保留这一受限近似，或加入独立瞬态cloud-light delta方向场/反射射线求值，实测成本及P标签；不能拿主屏cloud framebuffer硬贴水，也不每个flash重建长期环境cube。

一跳间接可利用现有surfel transfer，把同一局部source照度/可见度加入物理directInput，再传一次反弹；不要重加原directional/环境光。当前2/4HzGI会阶跃/滞后，快速源宜预存每个事件对surfel/探针的线性响应并按真实emission envelope变化，静态可见性近似/风叶误差明确；不把所有表面统一抬亮。其成本/缓存只在Phase B隔离测试，不先改现有GI。

## 烟与镜头的接口边界

### Phase A另含可证实的HG方向符号窄修

`fireworks.js:211`用`L=source−p`、`V=eye−p`，两者都从散射点向外，当前却把`dot(L,V)`代入`1+g²−2g*mu`。这会让光源与相机在烟同侧的真实回散更亮。原作者[PBRT4e Phase Functions](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions)明确两外向量约定，并实际使用`1+g²+2g*dot(wo,wi)`。等价窄修是`mu=-dot(L,V)`、保留现minus形式；不改g=.32、光强、烟质量/寿命、混合、音频或主大气。aerial现`rd=point−eye=-V`，`dot(rd,L)`已经正确，不能一起盲翻符号。

独立可复跑oracle：`node verification/pyro-smoke-phase-oracle.mjs verification/pyro-smoke-phase-oracle-before.json`。它抽取实际生产`smokeLighting`闭包，在内存构造sign-only候选，比较独立的光子传播方向与PBRT外向量公式，**不写运行时**。初版实际源码7/10，三个失败正是方向性、几何值与一阶矩；故意保留失败baseline，不报成“全部通过”。

散射点p=0，eye=(0,0,10)：source=(0,0,−10)为真实forward，source=(0,0,10)为真实back。g=.32时正确相函数分别`.22716752`/`.03105641`，旧生产值正好互换；side `.06171123`不变。8192段Simpson立体角积分两者都约1，**仅看总能量归一无法发现这个bug**；实际平均传播方向余弦为−.32，符号候选+.32。候选几何、互易、旋转等检查通过；尚未修改源码或实际GPU验收。

oracle选源距10m大于cluster radius，隔离角度符号。现radius正则下的近源方向/有限面积积分仍是原近似；修这一个符号不宣称其余烟光学问题已解。后续实施应留下source hash、同一粒子/位置/C的实际GPU正/侧/背光三图，确保新forward更亮且没有调gain；旧照片/视频烟亮度只作版本边界，不冒称严格A/B。

现烟`physics:132–137`每发18团/ground7团，life8.5s；半径1.1+.75*age，光学深度随age衰减并强制末端消失。`:118,169–170`事件删除与风历史裁剪只覆盖短时段。它没有分钟级烟、湿度增长、持续源/散射/遮挡；把life改1800会同时占住两主事件名额、拖长全部历史/排序/预算，且旧线性漂移会失控。

持久烟需要独立reservoir，发光事件结束可释放主发槽、质量/光学量继续存储并受新风/新爆闪影响。让smoke模块提供`inject`、物理time更新、有限段`opticalDepth(a,b)`和渲染/照明数据；可见星、surface/GI/cloud共享其T。详细湿度、浮升、扩散、沉降与可见/不可见残留依据由`PYRO-R2-PERSISTENT-SMOKE.md`负责，本稿不另造相矛盾的半衰期，也不承诺任何无风环境都肉眼可见几十分钟。

烟的光学mass/扩散和渲染片数分别处理；不能粒子预算满就删掉最近/最亮烟使光程跳变。新烟/云影改变背景光时，既有water/leaf历史reactive范围也要覆盖真正受光区域，而非只围原burst球；不能延长TAA去“隐藏”稀薄烟闪动。

已有全场一次bloom/微散射应保留。ghost/光晕由同一未toneMap源按可标定的光学核重分布，记录归一与光阑/遮挡边界；不把它作为额外照场景的光源。高级缓慢环岛只移动观察者/镜头，不能带动冻结pattern平面、改变发射位置、天气或物理time；手动接管/碰撞/地平线深度由root/interface独立审查。

## 分阶段可证伪门槛

**A：形状与高度**

1. 笑脸同色生产GPU联系图：固定seed/相位/C/P，θ0/30/60/85/180°及roll0/90/180°。正视可分辨轮廓、双眼、口；侧视按几何压缩，不自动恢复正脸。相机移动不能改变事件position/velocity/orientation，主/镜像相机来自同一事件。
2. 三个产品参考profile与十形态元数据：报告发射点、爆点、实际可见apex、直径、时间、口径来源。80°、25°、90°、0/5m/s及30/60/120Hz检查原解析/风prefix不退化；ground的高度控制若暴露则必须真改初速/模型并有独立校准，否则只报告apex范围。
3. 粒子数/颜色改变时，不自动归一到一样亮；共同source ledger的总RGB/I变化被真实记录。新笑脸和旧ring在相同源预算下比较，PSF、尾迹与shutter不为拍图偷偷调大。
4. 最暗蓝/双发/飞近/离轴、主+mirror、所有HalfFloat范围仍满足旧budget；新初速与高度不漏bounds、自动构图/音频真实位置不滞后。音频源gain/hash固定，延迟按新位置自然变。

**B：照明闭环**

5. 固定C、同一phase，分别开surface/air/cloud/smoke/GI路径；用已知I与r倍增验证无遮挡E的1/r²，有限源中心不发散。设置一片已知tau烟，验证source段T与view段T可分离、总T为乘积，不出现神秘第二gain。
6. burst在云外/云内、晴云底约813m/湿云底约110m对照；观察遮挡和受光位置。显式验证天上云闪与水反射的协议，不以全景调色通过。
7. 旧烟在事件结束后继续受新爆闪照亮；source停发后不再自发光，GI/瞬态反射不留旧flash。P变化只改存储，解码物理结果/摄影C相同；snapshot/双cube统一标签不串帧。

**C：持续性与实际成本**

8. 分钟级模拟不用等于分钟级shader历史；静风与变风的质量/光学量、空间边界、沉降和休眠合并有明确误差。实际连续GPU/CPU/overdraw压力测试，分清240秒快进数值与真实30秒实时性能，不能用Node吞吐代整场FPS。
9. 电影镜头同一真实事件绕行，前侧/后侧限制诚实；相机停下/暂停后不引入自己的jitter，手动操作即时接管。flare开/关同HDR源积分/黑暗层次对照，不用更高曝光冒充光晕。

只有Phase A实际多视角/高度与原回归通过后才扩大到B。当前没有新实现、没有新增验收通过数字，也没有将作者光度升级成实测烟花标定。
