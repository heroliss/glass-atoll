# 海岛夜间玩法与画质升级验收

最新入口：[R10性能与完整逻辑烟源检查点](PERFORMANCE-SOURCES-R10-CHECKPOINT.md)。同暂停场景透射两路SDR照片逐字节一致；实际257帧交错窗口CPU均值约下降11%，GPU均值基本持平，不能据此称整场FPS提高。新完整逻辑星体/子星/地面彗星烟源是显式QA候选；真实4096容量的分裂烟花和地面花束分别三阶段14/14，仍无长时压力或照片感通过声明。默认点源烟、原有显示、自适应尾迹与已接受的音效保持。

[R9精确峰值、持续烟源与尾迹检查](HDR-TAIL-R9-CHECKPOINT.md)及[高清审阅页](tail-optics-review.html)保留1200nit准入、1080p对照和16秒影片证据。密集烟花预算、烟量/受光标定与整体照片感尚未闭合，下文保留历史阶段的原始边界与结果。

**迭代记录 · 2026-10-27。** 新功能已接入并经过多轮真实浏览器、GPU与CPU检查；最后一轮控件、变风压力和新版24秒影片已完成，用户第三次A/B确认主爆“冲击感合适”。本文件不表示全部视听目标已通过，更不宣称当前画面已经无法与照片区分。

**B4之后的地灯修订，2026-10-27：** 按用户要求将三灯移为西/东/北三角环绕，将前三个Spot改为全向Point；17.3cm高、13cm直径乳白球罩配金属底座，无侧挡板。灯体保留太阳/月光/手电的投影与受影，未新增三套点光源阴影贴图。独立/联动/昼夜策略保留。CPU **10/10**、原局部空气 **14/14**、真实GPU **9/9**、实景 **7/7**；八方位native白卡亮度一致，实际custom近场衰减与已安装Three公式GPU读回相同，P补偿一致。最大三灯与近景的opaque/composed/reflection RGB无NaN/Inf/负色。见[检查](ground-lamps-scene-check.json)、[GPU](ground-lamps-gpu-check.json)、[三角夜景](ground-lamps-triangle-night.png)、[灯体近景](ground-lamps-fixture-day.png)。点源仍是有限球灯的近场近似；没有声明树干对各地灯的完整源遮挡。

这版在1209×1292、DPR1、中档HDR月夜、三灯45%亮度、无烟花，预热3.2s后4秒平均 **73.51fps**，帧p95 **27ms**、GPU均 **12.83ms**。是本机单窗口实测，非每帧60或与旧射灯的配对性能比较。[新灯夜景性能](ground-lamps-night-benchmark.json)。以下B4性能和影片保留为相应阶段证据，其灯具仍是旧射灯布局。

B4阶段已将运输截面B与连续云底设为网页默认，并在生成阴影/GI缓存之前选择B几何。模块保留legacy/flag0作为A/B基线，应用初始化明确选择新默认。生产复查 **6/6**、原有真实交互 **12/12**；默认中档、4096阴影、512海谱、8×MSAA（本机支持）、一次间接光照。[B4生产报告](b4-production-check.json)、[白昼](b4-production-day.png)、[月夜](b4-production-night.png)。

本机1209×1292、HDR开启的预热白昼4秒窗口，平均 **84.57fps**，帧间隔p95 **23.6ms**，GPU均值 **11.09ms**；同默认下双菊花与变风压力4秒平均 **43.07fps**，p95 **35.9ms**，GPU均值 **14.19ms**：[当前压力](fireworks/b4-production-stress.json)。平均数不代表每帧达标，也不保证其它设备/温度/视口。两种生产昼夜与压力峰帧完整RGB均无NaN/Inf/负分量。

B的低视角实际可见覆盖增加约19–22%，高视角约减少8–9%，实体宽度与中脉不变。CPU **18/18**、实际12机位24图技术检查 **92/92**、无光覆盖12机位、风/深度运动 **14/14**通过。三机位96次GPU查询的主镜头均值差小于0.12ms，低岸B的p95样本仍更高，不能称零代价。[B0实际审查](PALM-B0-ACTUAL-REVIEW.md)、[2560×1706原图A](palm-frame-b0/HD-legacy.png) / [B](palm-frame-b0/HD-transport.png)。用户认为B更茂盛、更美观，同时正确指出这轮主要是朝向变化；没有把它记成全部叶形/材质的照片级验收。

云底正offset硬跳变的实际GPU **24/24**、CPU **69/69**通过。共同LCL保持，最低5.2%之外不变。初次远云照片的Orbit目标约束把观察者升到190.6/85.7m，原数据保留；后续用100m方向目标锁回12m观察者，晴/湿0/1四图与所有RGB读回正常：[低机位检查](cloud-base-view-low-check.json)。云形整体仍柔软/简化，修复针对密度连续性；高观察者旧海天色带已定位为有限平海水与球形天空地平线不一致，留待独立处理。

合并模块检查 **310项**及语法通过，日志为`playground-cpu-b4.log`与`playground-syntax-b4.log`；应用的新默认另外由上述生产检查验证。Goal仍active，后续研究见[叶轴/叶形下一轮](plans/PALM-AFTER-B0-PLAN.md)，不把更茂盛或通过数值检查等同于第一眼真实照片。

## 当前能做什么

- 自由环绕或第一人称漫游；八个固定机位，另可朝向当前太阳/月亮。滚轮让相机与中心沿视线一起移动，焦距不变；右拖平滑环顾，右键配合滚轮调移动速度。手动操作接管自动构图。
- 时间、天气、视角三组独立。UTC、民用时差、日期、经纬度和倍率共同控制日月星；天文快进不加速波浪、烟花或声音。自由太阳另有明确模式。
- 三盏低位球形地灯在三侧呈三角形环绕、全向照明，可独立开关、调亮度/颜色，也可联动编辑；手电随观察者移动。海面、物体与有限距离空气共享同一局部光参考。
- 牡丹、菊、垂柳、棕榈、圆环、爱心、分裂十字、闪星、扇形彗星、近地花束共十类烟花；可单发或自动轮换，调方向/仰角、选择自动构图。停止后续排程不会抹掉已升空事件。
- 原位按住左键蓄力、松开投石，左拖则环绕并取消投掷；石子实际飞行、碰水或碰沙，不强迫相机靠近。仍可放叶、定位叶片、点选对焦、调景深、保存SDR照片。

默认中档、28mm/f8、景深关闭、声音关闭、自动内部像素缩放关闭；风1.8m/s、潮流16cm/s。HDR默认自动，满足浏览器、显示环境及亮度校准条件才启用；缺失条件会说明退回SDR的原因。HDR映射使用系统或手动峰值/参考白，不把示例1200nit当作探测结果。

## 五档设置与性能证据

档位改变渲染成本，不改日期、天气、摄影曝光/HDR校准或物理事件能量。下表是当前请求值；实际MSAA取所有附件共同支持的合法样本数，实际尺寸也受设备限制。高级单项修改标为自定义。

| 档位 | 像素倍率上限 | MSAA请求 | 太阳阴影 | 海谱边长 | 云采样步 |
|---|---:|---:|---:|---:|---:|
| 低 | 1.0 | 2× | 2048 | 256 | 20 |
| 较低 | 1.25 | 4× | 4096 | 256 | 32 |
| 中 · 默认 | 1.65 | 8× | 4096 | 512 | 64 |
| 高 | 2.0 | 8× | 6144 | 512 | 96 |
| 极高 | 2.0 | 8× | 8192 | 1024 | 128 |

一轮预热后的真实日景记录为1209×1292、固定岸边/正午、天文钟停止、风浪/云继续、无活动烟花、原生HDR配置：[完整五档记录](playground-quality-warm.json)。它是本轮中途源码的阶段证据，不当作最后封存版的全场景成绩。

| 档位 | 平均fps | 帧时间p95 |
|---|---:|---:|
| 低 | 101.14 | 16.5ms |
| 较低 | 86.77 | 20.4ms |
| 中 | 64.84 | 30.6ms |
| 高 | 57.73 | 34.5ms |
| 极高 | 55.22 | 34.7ms |

平均值超过60不表示每帧60；高覆盖云、手电近景、双发烟花和变风还会增加成本。高档约30或更低属于允许的画质取舍，不能虚报保底。真实手机尚未实测，移动证据仅为桌面视口/DPR模拟。

变风时已发现并修复两处真实CPU热点：按阻力类别共享精确风响应前缀，避免每source重放数百段历史；预算改为标量投影和scratch复用。全部风段、源数、真实快门/stretch端点、near-plane回退和安全余量保持。新旧轨迹/预算对照及基准见[风响应](FIREWORKS-WIND-PREFIX.md)、[标量预算](FIREWORKS-SCALAR-BOUND.md)；这些Node CPU数字不替代最后浏览器FPS。

最终中档HDR月夜、两组菊花、实际风速滑杆1.8→5m/s平滑变化的4秒压力窗口，平均 **34.61fps**，帧间隔中位数30.8ms、p95 **36.5ms**、GPU均值13.92ms；同条件修复前记录约24.82fps。依据[真实压力与阶段trace](fireworks/wind-runtime-final.json)，只统计benchmark开始至结束的140个profile帧：photometry均值21.52→11.37ms，烟花simulation/audio约8.98ms，主镜头3.36ms、水捕获2.40ms。不同运行的系统负载会变化，不能把这个短测提升比例外推到所有场景。中档白昼可达到前述平均60参考，但密集烟花仍有CPU瓶颈，未达到每帧60。

这次在 **3482条record仍发光** 时暂停读回主画面/合成/反射全部RGB，NaN、Infinity和负分量均0；合成最大存储值16.53125。P=12、源包络存储上界15439.03，小于安全值16376。晚期无发光帧的读回另保留，不能用它替代峰值画面检查。全部像素归约是数值审计，不把读回耗时计作实时FPS。

随后只缓存已发生的固定预测点，未来17点采样/顺序、余量和原2Hz失效规则均保留。当前烟花源`606d5752…`对照 **16/16**，1635组边界最大差5.68e−14m。真实GPU预算再次 **7/7**。实际压力首轮27.33fps、预热复测41.03fps，GPU均值分别22.12/15.89ms；光度预算阶段6.56/4.27ms，暖机帧间隔p95 37.1ms。冷暖、种子、可见性及系统负载不同，不能把帧率差全归因为缓存；首轮低于30且暖机未达60均保留。[当前缓存与两轮实景证据](FIREWORKS-PAST-BOUNDS.md)。两轮发光峰帧和晚期完整RGB检查均无NaN/Inf/负分量。

## 已完成的关键检查

| 范围 | 已见结果与证据 | 适用边界 |
|---|---|---|
| 独立预设、灯/手电、暂停/倍率、RH预算、实际投石 | 真实场景API **12/12**：[runtime](playground-runtime-first.json) | 首轮场景API，不能替代最后原生控件复验 |
| 原生输入 | 900ms按住实际charge约0.829；飞行/水花出现、相机保持；W与滚轮产生平移，焦距28mm不变：[原生输入](playground-native-input.json) | 早一轮输入证据；最终小修后仍需统一复验 |
| 天文与目录 | controller **26/26**、目录 **21/21** CPU；太阳圆盘 **4/4**、目录点源 **4/4**真实GPU；严格不可见跳过 **10/10** | [天体](CELESTIAL-IMPLEMENTATION.md)、[目录数据](star-catalog-check.json)、[首次GPU](playground-first-gpu.json)、[最终zero对照](playground-zero-gpu-second.json)；不等于完整光谱/当地实测星闪 |
| 烟花与光学 | 生产烟花 **8/8**、optics **7/7**，独立尾迹A/B **4/4**：[GPU记录](playground-second-gpu.json) | 同记录旧rangeFixture失败不作为通过；范围工具另有v2结果 |
| 最新预算峰值/覆盖 | `892dd947…`真实GPU **7/7**：[bound](playground-final-bound-gpu.json)；当前`606d5752…`再次 **7/7**：[当前bound字段](fireworks/past-bounds-runtime-first.json) | 包含离轴蓝色、near-crossing、独立快门/stretch、叠加与生产record；不是无限源/任意摄影状态的证明 |
| 数值范围与细叶 | IEEE分类归约 **11/11**；原MSAA叶色外插负值已用centroid修正，真实夹具 **9/9**，原运动回归 **14/14**：[范围说明](RADIANCE-RANGE.md)、[centroid对照](playground-centroid-gpu.json) | 指定记录的整张RGB纹理；不是所有后续帧永远无NaN/Inf/负值 |
| 界面隔离 | 曝光只改摄影偏好、地灯联动持续、HDR自动回退原因等 **5/5**：[控件检查](controls-isolation-check.json)；真实DOM/场景补测 **5/5**：[最终控件](playground-final-controls.json) | 最后5项使用生产DOM handler及实际uniform，原生键鼠结果另列 |

最新真实链接程序审计仍符合16个fragment sampler上限，水材质使用16/16，空气积分/合成分别5/8：[最终shader记录](playground-final-bound-gpu.json)。运行时编译通过不单独等于上述功能或观感通过。

HDR为真正的浮点WebGL→WebGPU扩展输出，沿用独立SDR锚点/亮度映射校验，缺能力可恢复SDR。系统报告亮度不是测光仪读数；普通PNG也不能证明面板实际输出了多少nit。见[HDR证据与限制](CURRENT-HDR-SUMMARY.md)。

## 声音：第三轮主爆冲击感已获用户确认

用户前两轮实际试听均认为主爆偏轻，不能把当时音频节点检查通过写成满意。当前候选相对用户听过的A07，318m单发的差分RMS提高 **9.061dB**；它来自同一实际混音图、相同录音与背景，不是新增合成低频或改变传播时延。

[实际音频图补测](fireworks/audio-selected-check.json) **16/16通过**。最大作者事件能量1.15下，24m相干双发sample peak约0.94274，0m双发约**0.97747**，未见全幅样本或平顶警告。该结果是Float32 sample-peak与声明情景下的检查，不是intersample true peak、任意源数/音量系统安全或实际声压校准。

**用户听完第三次A07→新版对照后回复“冲击感合适”。** 当前主爆增益锁定，不继续加响；这只确认该样例的冲击感，不扩大成全部音色/所有设备或绝对声压已验收。主爆采用许可清楚的实录；发射/噼啪为合成。海浪不是马尔代夫/仙本那同期录音，音画是参数/事件同步，不是逐采样流体声压仿真。源与处理记录见[声音反审](fireworks/AUDIO-BOOM-REVIEW.md)和[素材署名](../assets/credits.html)。

## 画面自评与当前边界

已实看[当前日景](day-review-current.png)：海、沙、日光关系可探索，但椰冠仍偏细丝和网状，远处云底有平直板块/层状外观，整体仍能辨认是CG。**尚不能宣称已经达到“第一眼以为真实照片”。** 当前技术一致性和通过数值测试，不会自动抹掉这些造型与构图差异。

其它有意保留的边界：水为Fourier谱与小振幅浅水模型，不解完整破波/上淹；烟为分层灰消光/有限源，不是全体积烟火CFD；局部灯/光簇无完整多次GI；空气为单次散射近似。透明遮挡、反射景深及细叶/水短历史仍可能柔化或短暂拖尾。HDR/摄影采用有效标定，不冒称绝对lux或官方ACES HDR ODT。

## 最新影片与待闭合项

[新版24秒音画](night-playground-preview-v2.mp4)来自实际浏览器canvas和相同WebAudio混音，菊花/圆环各一发；不是离线另作的动画。H264/AAC，1210×1292（原1209宽补1像素），30fps，24.001秒。完整解码与双声道检查 **4/4**：[媒体核验及hash](night-playground-v2-media-check.json)，48kHz实际解码峰值左右声道0.5277/0.4906，全幅样本0。源WebM及[片内状态](night-playground-preview-v2.json)保留。30fps编码不证明场景渲染帧率。

[实际音轨信号核验](night-playground-v2-audio-check.json) **5/5**：两次实录主爆可与源相关匹配，预计传播延迟0.888/0.870秒，混音中的匹配到达偏差约−19/−9ms；mono下混sample peak0.5056，无削顶。该信号检查不等于耳听冲击/音色满意。空间主爆音量也不具有实际SPL标定。

最终控件补测另外确认：自由太阳模式/UTC不会被摄影开关改动；联动三灯连续两次滑杆输入均生效；艺术太阳强度0/.5/1/2时水环境光只乘一次，与共享天空线性关系误差约4.44e−16；高级单项自定义的effective阴影/海谱值与实际资源一致。

另以[原生鼠标/键盘](playground-final-native-lamps.json)实测勾选联动、点击亮度滑杆、连续Right两次、打开手电；三灯均保持0.52且联动仍勾选，不仅依赖程序事件。

尚未闭合：**细丝树冠、板状云形和复杂烟花CPU成本仍需继续打磨，整体画面尚未获照片感验收。** Goal保持active，没有把原始“第一眼照片级真实”的目标标记完成。主爆已接受，不再重复请求同项试听。

### 附：保留失败与方法限制

- [旧NaN分类失败](playground-second-gpu.json)及[IEEE位分类修复](RADIANCE-RANGE.md)：旧`isnan`计数0无效，不能据它声称生产无NaN。
- [原离轴峰预算失效与修复](playground-third-gpu.json)：保留旧球面参考低估的实际GPU反例；最新标量实现仍须保持修复后的上界，已见最终7/7。
- [音频候选反审](fireworks/AUDIO-BOOM-REVIEW.md)：第一增益候选近场削顶、A07听感仍轻均保留，不删失败换通过。
- [最后控件审查](FINAL-CONTROLS-REVIEW.md)、[跨模块画面反审](CROSS-FEATURE-FINAL-REVIEW.md)：记录发现、修复归属和已知造型差距；最终root结果以本文件后续追加为准。

## 烟花R2已接入部分：笑脸、尺度和连续镜头（2026-10-27）

旧圆环兼容ID `ring` 现为笑脸，默认120星：72外圈、两眼各12颗紧凑填充、24颗弧长均匀嘴部。对照保留144颗旧密嘴和单独眼/嘴候选，不通过补增益掩盖星数差别。实际正/斜/侧面与反射同事件检查见 [最终GPU记录](pyro-r2-final-gpu.json)：笑脸 **22/22**，光晕 **22/22** 且caller状态恢复。世界图案不会每帧转向观察者。

空中品种爆高按供应商90/120/150mm例子采用120/160/190m；地面扇形/花束仍按实际弹道报告可见顶点。只校准本阶段的参考高度，未声称完整商业烟花宽度/光度标定。旧短烟HG前/后散射符号已独立修正，数学 **10/10**；该窄修不等于持久烟实现。实录主爆增益仍为用户已接受的版本。

连续运镜实际场景 **12/12**、原生W/滚轮接管 **3/3**，见 [构图记录](pyro-r2-layout-and-director.json)、[原生控制](director-native-input.json)。时间、天气、摄影独立，暂停冻结物理运镜；发射几何或焦距实际变化时取消旧烟花构图。

[固定时刻笑脸/光晕对照](pyro-r2-smiley-flare.json) **5/5**：相同物理时刻、姿态、P/C，主/镜面RGB均有限非负。首报告仅因C相差3.55e−15EV的浮点尾数失败，保留-first；同一实际读数按1e−10EV容差复核，未替换图片。光晕共用1.8%单次PSF，**默认关闭**；原生开/关与实际lens状态同步见 [原生检查](optical-flare-native.json)。连续模型重分布不增亮，但奇数离散尺寸的旧降采样/重采样可有约+0.078%通量误差，不能称任意尺寸严格L1守恒。

[独立PSF成本](optical-flare-benchmark.json)本机1209×1292，各32次有效GPU查询、交错AB/BA：旧bloom均0.0790ms，新bloom+flare均0.3732ms；CPU提交墙钟均0.0469→0.4375ms。二者可能重叠，不能相加成帧成本；不是全场景FPS。新版通用状态保护在flare关闭时也有开销，因此关闭光晕不代表精确恢复旧CPU成本。

[当前16秒实际音画](pyro-r2-orbit-preview.mp4)为H264/AAC、1210×1292、30fps、15.951秒；[完整解码/双声道核验](pyro-r2-orbit-media-check.json) **4/4**。30fps是影片编码，不是场景帧率；有1像素右侧补边及实际VFR→CFR归整。它仍使用旧短烟，没有冒称包含后续体积烟与照云。

**B阶段已接主场景，视觉验收仍未完成。** 有限3D Gaussian长留烟、发光源穿烟遮挡、反射water-hit光路、动态照云与局部一次反弹均已接线。轨迹烟真实场景23/23通过：单发24核/M20.35，22秒冷烟仍在，隐藏不删量，清烟取消未来排放，实际main/mirror都有成功绘制；见 [原始报告](pyro-trajectory-scene-first.json)。此前反射MSAA不支持的真实失败已保留并修复，独立深度复制40/40。

这不代表照片感达成。Root已实看并否决光滑亮烟球；同烟量的细长燃烧段核正在作四路单发对照。当前晴夜云底约813m，源强1/4的照云开关实际PNG无变化，16仅4个像素1级变化，不能称明显照云。GI独立14/14，近岸源强16实际已看到282023像素响应/最大14级，但关闭后仍有12像素1级残差，原始第二轮82/84保留为未全通过：[报告](transient-gi-scene-second.json)。继续定位，不放宽原门槛吞掉失败。中档白昼空烟8秒均83.47fps，仅为当前1209×1292单场景样本，密集烟花/长期积烟性能尚未最终验收。Goal继续active。

## R5：逐源受光、燃烧期释烟与新物理复核

逐源烟光场已有原生实验开关（默认off），实际独立GPU127/127、14000源/DPR/六灯补测21/21、同一事件同物理快照32/32。只替换烟内pyro4/5的受光，其他灯/天空与受光接收面保持既有模型；不是自遮光、多重散射或全场逐源GI。明示工作预算及回退。缓存修后，熄灭完整写零一次、之后冷烟不反复bake：实际20/20，原127回归仍过。[独立审计](SMOKE-RESOLVED-ACCEPTANCE-AUDIT.md)、[零光GPU](pyro-smoke-zero-field-gpu-first.json)。

[1080p动态A/B审看页](smoke-motion-review.html)与[B影片](pyro-r5-burn-motion.mp4)已生成。均为实际单host场景与同一WebAudio混音，普通I1/1.8m/s/同seed笑脸，A18.020秒、B20.076秒，CFR30/H264/AAC48k双声道；[完整媒体检查](pyro-r5-motion-media-check.json)9/9。双声道sample峰值分别.376/.367、.354/.367，无全幅样本，用户接受的主爆源码4e5和增益未变；不扩大成新主观试听、true peak或SPL验收。

B为ring-only uniform-burn：48代表轨迹，首格按稳定bodyID错相、后续≤.3s只采过去真实轨迹/风，逐渐物化整发20.35；无年龄fade。实际hot +1.109s为182包：air6.41820+pending.02746+reserved13.90435；late +3.391s为544包：18.25370+.00676+2.08954；cold +9.089s为629包：20.35+0+0。100采样质量闭合误差≤3.55e−15、无merge，98个有烟采样field均effective/supported/ready，最大59166pairs，音频只原launch/burst两事件。[独立复核](RING-BURN-MOTION-REVIEW.md)。两片是独立场次，云/波/摄影视角相位不相同，不能作逐像素等价或FPS因果比较。

Root与独立代理均实际看过高清关键帧：B比旧早释烟减少粗亮花瓣，但仍有中央绿亮结、规则径向辐条、笑脸点阵，**未接受照片感完成**。已向用户提供影片与高清页，请其只评价动态节奏；没有把待反馈当成认可。Taylor48/segment/.05/ring-burn仍仅QA；生产默认point/.2/12/Brownian/24包不变，不把现代QA组合伪装成全部十类只改时序。

性能有明确边界：[普通夜景10s](pyro-r5-night-production-benchmark.json)为1209×1292、生产24包、fieldoff，mean72.16fps/frameP9525.8ms；[1080p两发积烟8s](pyro-r5-burn-accumulation-benchmark.json)为1260包/M40.7、无merge、HDRauto+field+flare，mean29.78fps/frameP9566.2ms、GPUmean29.96/P9554.46ms、CPUmean32.98/P9565.3ms。不同场景/尺寸/选项不直接作单变量比较，更不称锁60。隔离光场计时不是全场成本；进一步优化先定位，未据pair数瞎估。

用户新增生活观察已作两轮primary复核：[烟源与扩散](plans/PYRO-SMOKE-EMISSION-PHYSICS-REVIEW.md)、[逻辑源图](plans/PYRO-LOGICAL-SOURCE-GRAPH-REVIEW.md)、[全源覆盖](plans/ALL-SOURCE-SMOKE-COVERAGE-AUDIT.md)、[减速扩张数学反审](plans/PYRO-EARLY-EXPANSION-MATH-REVIEW.md)。支持持续燃烧轨迹产烟/累积；冲击前沿与烟团分开，“每光点固定几m³”无统一实测依据，小时级PM不等于恒浓白团。炮口已有烟，地面燃烧轨迹/分裂子星仍缺；mortar弹道carrier不是带发动机rocket，不据变量名增加大尾烟。尾迹采样/镜像共享同一燃烧体预算。下一基础为默认lazy逻辑体元数据，不先偷增总烟量或修改照明。

CPU针对新增部分两套均实际exit0：verify:smoke-field54项、verify:smoke-burn37项，日志pyro-r5-field-cpu.log/pyro-r5-burn-cpu.log；npm check实际exit0。原hostforward首strict-inverse失败保留并以明确4点inverse组合修复，未弱化原字节核对。Goal仍active。


### R6/R7：连续两发、湖面参考、近顶点复核与显示变换准入（2026-10-27午后）

R6仅QA timed3已实际录18秒1080p，媒体5/5；同physical state HDR/SDR raw extrema16/16，所测F16主/合成/反射有限非负且峰值安全。这只证明单位/储存与该状态一致，绝非HDR观感或整段每像素证明。R6不再推荐作为常规开花的替代方案：用户新增完整湖面单发参考，通常接近顶点开花更符合日本烟火协会品质定义；延时引信是按产品设计配合高度，不是检测vy=0。Rise大口径20/30号确有10/12秒延时示例，但不能据20张无时间戳截图确认口径、米数或精确apex。

新参考原样归档：6张通用编排、12张巨弹第一发、11张相接第二发、20张湖面完整单发，均在references/各自目录，保留来源与hash。第一发下方上升亮点是第二枚，不混入第一枚轨迹；湖面16–17尾端再次显著亮、水和旧炮口烟同时变亮可作观感参考，但无曝光元数据，不能单凭图判定化学再点燃。水面是破碎反射带与facet，非干净镜像。

两发连续实景helper实际80/80（首轮2/3 caller未设wind0失败原件保留）。同一烟host不清烟发B：旧628packet质量逐项不变，A为M20.35，最终1256/M40.7、merge0；1185个摄影C读数均16.5。B热field off/on自然P11.75→11.5，PNG有159632变化pixel/max86byte，offrepeat0；这不是旧烟独立隔离或线性PNG加法证明。报告pyro-two-event-relight-scene-second.json/六PNG与独立PYRO-TWO-EVENT-RELIGHT-AUDIT.md。

near-apex-envelope-study为240cases/7项CPU通过：现默认空中8型竖直爆点速度≈0，最大absVY2.84e-14。问题主要是ring暗尾/strobe部分较亮末段过低，不能把全部十型提前爆。候选优先分开提高爆高，而不借COM上升托住：ring rise120→140、strobe160→200仅作者高度研究；life/drag/I保持。低仰角实际爆高自然下降，不能伪保同高度。电影R7实际仅ring：worldY141.47704875875、muzzle以上rise140、launch→burst5.00831s，C固定16.5，20秒1080p SDR；media5/5，100sample质量守恒残差≤1.09e-14，628packet/M20.35，98非空sample field全ready，音频4e5保持。见pyro-r7-apex-motion.*、PYRO-R7-APEX-AUDIT.md。D有LED灯串/径向烟迹，完整倒影仍裁，**照片感仍否决**；不同camera/曝光策略，不称旧B单变量逐像素对照。候选页默认仍B，C明确实验、D独立审看，未换生产默认。

ACES2官方OCIO2.6.0导出CPU13/13；原shader实际52/53保留，唯一工程门失败是1270nit纯蓝R6.79e-5误差。独立阶段15/15定位forward CAM atan hue约20ULP差，查表bin正确。仅QA通用17阶atan2变体实际77/77（角9+原色53+阶段15），坏蓝R误差降至8.75e-6；严格abs-only仍有0/3/38超限通道，不能称未改官方shader或官方认证。独立aces2-output.js+vendor三目标100/700/1270已完成CPU12/12，尚待模块实际GPU准入/全幅性能/输出桥；生产DRT仍legacy。1200单目标导出CLI已CPU14/14、CLI17/17且可逐字节复现，未GPU准入，不生产引用。详见ACES2-OPTIONAL-INTEGRATION-CONTRACT.md、ACES2-ATAN-GPU-AUDIT.md、ACES2-SINGLE-TARGET-CLI.md。

全目标继续active。下一步为ACES输出模块实际GPU与可选接线，之后同源时变发光/差异化尾迹/烟与地面云水受光、完整镜像构图；不用数值报告代替最终照片感。生产源仍point/.20/12/Brownian，ring-burn/Taylor是显式QA组合；已验收主爆增益不动。


#### R7输出模块与审看页实际补验

独立aces2-output.js模块第二轮实际GPU **137/137**（aces2-output-gpu-second.json）；含100/700/1270三目标原963 CPU门、曝光/单位/一次OETF、P±8反补偿、实际sampler/附件、非零physicalviewport、异常/竞态/损坏资源及完整状态恢复。初轮130/134保留，4失败确认为QA两处错误：RASTERIZER_DISCARD使sentinel清除被忽略；raw activeTexture与Three缓存失配使夹具最终恢复错unit。仅修helper并加预清读回/逐unit证据，原颜色/外部像素门未放宽，生产模块fa6字节不变。当前实际DPR1/1280×720 caller，但小RT颜色门；**无全幅性能、无native HDR桥接线、无DPR2模块通过声明**。生产显示仍legacy，不能把模块通过等同HDR实景已修好。

审看页native发现视频seek到7秒仍回0、seekable[0,0]，旧HTTP无MIME/Length/Range；首失败pyro-r7-viewer-seek-first.json保存。server.mjs最小修GET/HEAD/流式single Range/MIME，临时HTTP30/30；核对5186 main.js byteexact后仅停止原PID98796并同端口重启，现唯一服务exec session57401（替代旧79829，不启动第二端口）。live HEAD video/mp4、长度6446625、Accept-Ranges，Range1024–1151返回206/128B且disk byteexact。native同D影片现在seekable[0,19.996333]，实际到7秒/ready4，pyro-r7-viewer-seek-fixed.json和native截图保存。main tab6、review tab7，普通day/音效off；不要再复用已失效旧tab1/5。
