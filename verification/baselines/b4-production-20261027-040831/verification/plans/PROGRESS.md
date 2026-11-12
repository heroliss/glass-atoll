# 当前进度与下一轮入口

更新：2026-10-27。目标 active，**功能已接入并验证，整体视听/照片感尚未验收达成**。下文按轮次保留；最新入口在文末B3。

- R1 证据/候选：完成。
- R2 反证/交叉审：完成，推翻固定预曝光、单换8K、透明效果混主深度、反射天空回退等捷径。
- R3 资产实验/最终方案/接口：完成；用户已允许个人非商业用途署名星表。
- B0 可恢复旧版源码：完成，`../baselines/night-playground-v0-20261026/`，38文件含hash；运行资源仍复用原assets/vendor，不是独立分发包。
- 运行时源在研究结束前34文件均与前轮seal相同：`RUNTIME-UNCHANGED-R3.json`。
- 实施已分工启动：天体/目录，烟花物理/效果/声音，界面/五档。Root随后统一接线/曝光/局部光/反射/控制/投石，不在队友文件并发改动。
- 目前未进行本轮完整新功能浏览器验收，不把旧82fps/旧GPU检查称作新版成绩。

## Root 下一轮具体顺序

1. 读 FINAL-DESIGN / IMPLEMENTATION-CONTRACT，以及三个agent消息/新增接口说明；确认各自文件状态。
2. 建统一SceneRadiometry、FrameSnapshot、环境双buffer/捕获标签；GI/history存储曝光补偿。
3. local-lights三灯/手电/有限阴影与接收面、finite-effects lens hook、premult water反射/释放sampler/响应mask。
4. camera-navigation右拖平滑/滚轮语义，stone-throw蓄力真实初速与连续水/地形碰撞，近场水花环波同事件。
5. main接新时空/地点、独立预设、全部UI与quality-preset，逐小功能编译/实际GPU后再整场。
6. 资产与各模块源许可/hash、测试。实际浏览器固定场景/动态capture、音画试听/延迟、五档消融与压力后定有效档位。
7. 多轮视觉反审，不确定的主观项用已可播放的实际对照请用户看/听；验收闭合再标目标complete。

服务器仍为原127.0.0.1:5186，禁止重复启动。现有浏览器页可以保留到最终交付，源码迭代尚不能代表现页已加载新版。

## B1 实施与首轮GPU（2026-10-26T15:08Z）

Root已接线：统一UTC/地理位置、P/C分离与天空双buffer比率、3地灯/手电/2烟花光簇、R8 reactive与历史曝光补偿、独立finite-effects到一次Bloom、黑底premult水反射、各自视角/天气/时间、五档中档默认、原位蓄力投石与真实弹道碰撞、平滑右拖/滚轮移位。

首次实际浏览器加载成功，无GL日志错误；`playground-first-gpu.json`是当时源的独立GPU夹具：disc4/4、目录点PSF4/4、烟花8/8、烟花optics7/7（含暗角）通过；不是完整视觉/音效/性能验收。第一次场景day统计约82fps、夜烟花约68fps只是即时读数，不能当密封benchmark。

反审后的后续改动尚待再次加载：
- 地灯开启摄影曝光cap16→18；烟花cap12→16.5。源强仍是明确author reference，未偷改为实测。
- 以main与当前mirror相机投影bins两套bounds取大值，而非不分视角sum(global finite surface ceiling)，避免整晚FP16精度被过度压低。water.prepareReflectionCamera在预算前可调用。
- 自动构图保留低机位，按每次主事件计数一次；fan脉冲不会反复重启镜头。暂停不推进pyro自动排程。
- 每帧先更新RH→Mie再预算太阳峰，避免低太阳快速变干突破旧bound；P后再刷新air lighting。
- directional shadow按各自needsUpdate与档位Hz刷新/重拟合，flash不强迫太阳atlas同频刷新；天气/月光caustics统一keyDirection。
- aerial局部单次散射与持久采样override已由interface完成14/14 CPU；新GPU仍待。
- 新生产场景API验收脚本 `playground-runtime-check.js` 已写，未执行；新增radiance reducer正由interface实现，lens/main hooks已接，暂不调用直至helper冻结。
- tropical_vegetation审计发现fallback HIP与未标HIP的Tycho系统重复，正在最小catalog数据去重+通量回归；资产写入完成前避免reload混版本。
- reference_research正在修audio prepare未就绪race，以及stretch与shutter向量相消的尾迹候选，需要真实GPU同相位A/B，保持物理头/能量。

接下来先等待上述owned文件冻结；重载验证新aerial/反射/实际数值范围、运行runtime脚本，逐项纠错；再原生键鼠与声音捕获/试听、五档与单项成本实测、十种烟花实景联系表/动态预览、README和来源更新。目标仍active，未完成。

## B2 多轮实际验证（2026-10-26T15:58Z）

已整合重载多次。新证据：
- `playground-runtime-first.json`：真实API/runtime12/12（独立预设、灯/手电、暂停/倍率、RH预算、实际投石水花环波与不移镜头）。
- `playground-native-input.json`：原生900ms hold实得charge .8286，flying1/splash1，camera固定；W400ms与滚轮实际平移、focal28不变。
- `playground-second-gpu.json`：目录新数据4/4；fireworks8/8/optics7/7；trail AB4/4，head相同、能量比1.0000234、join p10 .7087→.7536。实际图trail-*.png视觉改善轻微，不冒称长曝光照片。
- `playground-third-gpu.json`：IEEE位分类range fixture11/11；bound7/7（实际离轴旧budget低估2.5685×已修）。旧range v1 isnan被ANGLE优化，countNaN无效已明确保留。
- `playground-centroid-gpu.json`：查明极细叶片MSAA smooth vColor外插产生负色。生产vColor两端改centroid，UV/normal不动。同paused scene opaque/composed/reflection负分量6/4/5→0/0/0；fixture9/9，四样本级coverage逐像素相同；motion14/14。QA开关默认on，baseline另存。
- `playground-quality-first.json` avg103/90/82/72/54，只含1.2s预热，首段有PSO/compile尖峰；`playground-quality-warm.json`完整+阶段trace：3.2s预热后avg101/87/65/58/55，p95 16.5/20.4/30.6/34.5/34.7ms；不能宣传所有帧60，系统状态/热/查询成本会变化。当前5档仍合理候选，中档达参考平均60，但夜烟花与GI高尚需压力场景。
- 新 sky/night/star-field 严格zero-visible优化已冻结（只跳skyVisible<=0，所有derivative预先计算），CPU7+controller26+night30通过，真GPU10项AB待测。目录counts77925+1418103=1496028、manifest d1a7a3ef…已冻结、21/21 CPU。
- source归属与credits已加 assets/credits.html，页面链接到它；README改正新行为并明确整体验收未完成。

当前第五次reload已发出，页正加载，主源码已包含runCelestialZeroCheck / runLeafCentroidCheck / inspectRadiance / setLeafCentroid / frameProfile等QA入口。下一步：等ready，运行zero10项和目录4项；查看月夜/地灯/手电并录真实烟花+声音样例，实际输出全像素night stress范围；native UI各玩法、五档FBO与真实10类型联系表。最后做性能单项/夜烟花压力与封存、README终版。严禁把goal标complete，尚缺声音/实景10种/最终全链路与用户视觉验收。

当前source：main新增可选profileFrames，用frame phases定位尖峰；默认不采集。renderer正常FPS不把paused rAF当实际。UI时间切换保持天气/机位；setTime真实模式现在恢复太阳强度1，艺术强度偏好保留；reset tooltip已改为当地正午+白沙岸边，避免假称重置风/潮流。

## B3 最后控制、主爆第三轮与实际压力（2026-10-26T17:45Z / 本地10-27）

本轮功能和技术验证已收拢，当前完整证据入口：`../PLAYGROUND-ACCEPTANCE.md`。目标仍active；第三轮主爆试听等待用户，第一眼照片感仍未达成，不能仅因测试通过标complete。

- 火花风响应前缀保留完整piecewise timeline；scalar预算CPU12491case完全相同，最新真实GPU7/7：`../playground-final-bound-gpu.json`。新source fireworks.js892dd947…，physics2cc716…，wind-response dfa1ba…。
- 最新中档HDR月夜双菊花+风1.8→5m/s压力，4秒平均34.61fps、frame p95 36.5ms、GPU均13.92ms；修复前约24.82fps。profile严格只算benchmark start/end：photometry21.52→11.37ms，pyro simulation/audio8.98ms。`../fireworks/wind-runtime-final.json`保存完整trace。不能称每帧60；白昼五档warm是前轮64.84fps中档阶段证据。
- 峰值3482records仍发光时另读回，opaque/composed/reflection所有RGB NaN/Inf/negative均0；composed max16.53125，P12/source budget15439<safe16376。晚期读回另存，未用无烟花帧替代峰值检查。
- 最后审查修了实际控制串扰：night-auto只发autoExposure、不带旧date，地灯linked不会被root full snapshot清掉；HDR auto退SDR文案说明原因。标自定义时footer阴影/海谱用实际资源。水skyTintPhysical本已含太阳I，uIntensity恒1，去掉艺术模式水ambient I²。
- 控件CPU5/5 `../controls-isolation-check.json`；真实DOM/场景5/5 `../playground-final-controls.json`（艺术太阳保持mode/UTC、联灯连续两input、共享sky×1、I响应线性、自定义实际资源）。原生输入证据仍是前轮native日志，未偷称这些为native鼠标复验。
- 叶片centroid夹具9/9、生产负色6/4/5→0/0/0；strictzero sky第一candidate6/10失败保留，最终窄优化真实GPU10/10 exact，目录4/4。不是所有帧/任意位置都已证明。
- 用户先后说原主爆轻、A07也轻；新audio4e5ede41… selected12/.7/.5ms，实际音频图16/16，far318m比A07差分RMS+9.061dB；maxenergy1.15近0m相干双发peak.97747、clip0无平顶。`../fireworks/boom-v3-before-after.wav`前A07后新版已展示；第三次听感待回复，不能写成满意。
- 新实际24秒 `../night-playground-preview-v2.mp4`（H264/AAC1210×1292/30fps/24.001s）包含菊/环/地灯/反射与增强音效。完整解码/实际stereo4/4，单声道参考匹配5/5，两实录爆点传播模型偏差约−19/−9ms。对应media-check与audio-check JSON。编码fps非场景fps。
- `npm run check`最新通过；本轮CPU195条基础检查前轮全过；最后改变只追加targeted controls5/audio12和实际GPU/场景检查，未反复跑无关全套。README已链接本轮报告、影片并修正sampler/MSAA历史表述。
- 实看 `../day-review-current.png`，椰冠仍细丝/网状，远云底平直层块；整图仍可辨CG。最新V2影片同样不是绝对照片级。应继续按真实照片改这些具体视觉差距，不能宣称完美。

后续顺序：先接收用户第三次声音反馈；声音若满意不再无谓加响。查看V2实景/日景自评，针对冠形/云形作有证据的下一轮方案，不整场盲目添成本。参考agent正在只读定位剩余photometry CPU，未授权进一步runtime修改。原服务仍Node session79829/5186，无Git，baseline原文件保留。

### B3后续：用户确认主爆

用户最新答复：第三版“冲击感合适”。audio4e5ede41…锁定，不再加响；只确认该样例冲击，不泛化到所有音色/设备。目标仍active，接下来重点是已知照片感差距和剩余CPU。追加原生联灯/手电：`../playground-final-native-lamps.json`，click联动→click滑杆→Right→Right，三灯均.52且仍linked；随后原生开启手电。与程序DOM5项分开记录。

当前正在做一项窄、精确CPU优化：fireworks.getBounds只缓存已经发生的固定17点，未来继续原sampleBody；原2Hz key、采样数、union/pad保持，需old/new完全一致与浏览器压力回归后freeze。interface负责fireworks.js，root不得并发修改。tropical只读研究冠形/云形的具体原因，尚未授权runtime造型修改。

## B4 照片感下一轮：小叶截面与云底连续性（进行中）

主爆第三版已获用户“冲击感合适”，锁4e5ede41，不再加响。所有原夜间玩法已可操作；照片感仍未宣称达成，目标active。

- 火花最后精确历史点缓存606d5752…已实际GPU bound7/7；第一压力27.33fps/GPU22.12/photometry6.56ms，暖机41.03/GPU15.89/photometry4.27ms；不把整体帧率波动全归为缓存。完整报告 FIREWORKS-PAST-BOUNDS.md。
- 继续按用户要求先研究/反驳后做：PALM-CLOUD-VISUAL-NEXT.md + PALM-CLOUD-REBUTTAL.md。原叶宽3–5cm并非数量级错误，不再加粗。palm B0只重建运输的局部截面，锁整条中脉、端点、RNG、材质、风属性；B1额外远端90°扭转未授权。Kew文献90°不能扩成所有小叶独立扭转。
- vegetation.js a5f38eb0…、新palm-frame.js df947149…冻结；默认legacy。CPU18/18：原六mesh/十一maps逐byte同f81；transport 168664中脉点/187026端点同字节，wind/shader不动；面积−.495%、额外几何19.30MiB，均诚实记录。main已接setPalmFrameMode（要求GI off，避免旧缓存emitter几何）、palmFrameDiagnostics、runPalmFrameCoverageCheck（后者需下一次reload才能在现页使用）。
- 实际12机位×2模式、24PNG已保存 `../palm-frame-b0/`，`scene-ab.json`92/92只是参数锁定/非黑/数值与sampler等技术检查，不是照片评分。低机位两模式opaque/composed/reflection全RGB NaN/Inf/negative0，maxsampler16。已实看low az0，B羽叶面稍连贯，但仍发丝；尚未选新默认。其余机位、unlit coverage12、运动/性能仍待。交互对照 `../palm-frame-b0/compare.html`已写，未实际浏览器验收，不先向用户保证控件有效。
- 云：NASA确认平底humilis合理。用生产CPU闭包取fair/humid三垂直面+XZ，`../cloud-density-slices.json/contact.png`；球形高度修正后的±1mm层外密度全0。首个错误平直worldY记录保留-first.json。actual tops有圆瓣/高差，因此weather.g高度warp HOLD，不能把源码未用字段直接当视觉根因。
- 当前真实sky64/128（C/P补偿后同C0、同物理time.0825、atmos8、DPR1同1209×1292）存 `../cloud-sampling-{medium,ultra}.png`和`../cloud-view-sampling-check.json`；云形差别很小。不是隔离性能AB，步数同时改变LOD。root与reference已实看。
- 反而新找到实际云底密度跳变：`../cloud-layer-edge-probe.json` 在base−1mm全0，base+1mm fair max.020406/mean.001560、humid .014513/.002369，分别53%/58.5%采样列为正，top内外全0。原因base=smooth(h+(shape.g−.5)*.018)的正offset与硬guard。CLOUD-BASE-CONTINUITY-CONTRACT.md已独立反证后批准窄修：新uCloudBaseContinuity默认0，1仅改C2 offset为min(offset,0)，保legacy0/1、globaltop/LCL/support。rhoB≤rhoA且h≥.052不变，不是weather.g warp，不承诺一招治所有slab。
- reference_research目前负责sky.js候选+实际公式/快照/CPU parity QA，尚未freeze，不能reload混文件；default0保持A基线。root将加main setter强制cloudcache/GI/env/history，同场0/1真实GPU与视觉后再选默认。tropical B0已freeze，interface A/B helper已freeze，均未授权扩展其它runtime。
- package.json已加入palm-frame.js语法及past16/scalar7/controls5/palm18到verify:playground；root未重复跑全套（各专项agent已过），稍后待新skyfreeze后统一适当回归。

原server session79829/5186仍用，禁止新开；当前浏览器主tab1在palm12机位AB之后暂停，geometry/quality/clock已helper恢复。声音off，实际API还未加载刚新增coverage入口。所有大PNG已落盘，之后可释放window.__palmAB.result.images内存，不删除文件。
