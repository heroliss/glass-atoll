# 当前进度与下一轮入口

更新：2026-10-28。目标 active，**功能已接入并验证，整体照片感尚未验收达成**。最新入口为 [R10性能与完整逻辑烟源检查点](../PERFORMANCE-SOURCES-R10-CHECKPOINT.md)：CPU热点定位、透射快速路径实际GPU10/10及同场景7/7、257帧真实交错计时、完整逻辑烟源实际4096容量的分裂/地面花束三阶段各14/14已归档。整段CPU均值约下降11%，GPU均值基本持平；不是每帧60或整场FPS增益结论。新源仍是QA opt-in，默认point/.20/12/two-births、adaptive尾迹和legacy显示保持。下一步处理4096容量合并成本与长时积烟，再做烟形/照明及整体照片感验收。[R9](../HDR-TAIL-R9-CHECKPOINT.md)保留精确峰值、尾迹与16秒实景音画的历史证据。

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

## B4收拢与B5计划（2026-10-27 04:10当地）

已封存可恢复源码/证据快照 `../baselines/b4-production-20261027-040831/sha256.json`，manifest SHA256 `d6370443690953091bc0c83305b913004f35fc0314fe27b9bfba38187f29002e`。复制185文件约2.81MB，另记114个共用assets/vendor文件hash但未复制；不是可独立运行的分发包。生产main `ccad9d64149b65ccd88fbd7d08e9ab3a688079c83557e8fc716523f0ae51ce04`，原Node session79829/5186继续使用。

- 主爆第三版已获“冲击感合适”，audio4e5ede41…继续锁定。
- 用户查看真实2560×1706高清对照后指出没有本质叶形变化、B更宽茂盛美观。已解释B0只改变小叶截面朝向，宽长数量/中脉/材质不变；投影宽度增加不代表物理加宽。将B用作继续迭代的基础，不把这一偏好扩大为照片级验收。
- **生产默认现在为transport和云底连续性1**，均在GI/影图来源采样前选定。factory仍保留legacy/0供严格A基线，不能据factory默认误报生产未启用。
- `../palm-frame-b0/scene-ab.json`92/92技术；12视角unlit覆盖与运动14/14通过。B/A覆盖低仰角1.1875–1.2239，中角1.1039–1.1397，俯视.9069–.9234，属于投影重分配。96次实际SDR主镜头GPU计时各view均差<.12ms，但低机位B p95较高，不能称免费或稳定提速。额外CPU几何19.30MiB、面积−.495%仍记录。
- `../visual-round-b4-gpu.json`：云底CPU69/69、真实GPU24/24；生产cloudShadow公式与CPU闭包一致，+1cm底缘跳变约.0204→9.35e−8。整体云形仍程序感，未认定完整slab问题解决。`../cloud-base-view-low-check.json`修正look-target范围，实际eye12m，旧190/85m误夹限的照片留存并标明。
- `npm run check`与`npm run verify:playground`退出0，后者310项；日志 `../playground-syntax-b4.log`、`../playground-cpu-b4.log`。新默认再次node语法+真实场景复验，不为两条初始化重复无关全套。
- `../b4-production-check.json`：初始/恢复均B/1、中档4096/512/GIlow/8×legalMSAA；交互12/12、生产6/6；昼夜opaque/composed/reflection RGB NaN/Inf/negative均0。实际1209×1292 DPR1、中档HDR白昼暖机4s平均84.57fps，frame p95 23.6ms、GPU均11.09ms。不是每帧60保证。
- `../fireworks/b4-production-stress.json`：同尺寸中档HDR、月夜双菊花+风变化，4s平均43.07fps，frame p95 35.9ms、GPU均14.19ms；3488条仍发光时三路RGB均有限非负。是新版完整场景成绩，不能把波动全归缓存优化。
- 实际截图 `../b4-production-day.png`、`../b4-production-night.png`已查看；影片V2为此前A叶片/旧云几何，音频已是锁定版。README/PLAYGROUND-ACCEPTANCE已明确历史范围。网页恢复白昼岸边、live、声音off。

B5继续先研究/反驳，暂未批准新运行时改动：

1. 椰冠B1：`PALM-AFTER-B0-PLAN.md`提出健康成熟羽叶的远端连续长轴扭转0/45/75°。独立反审要求按扣除固定原始裸轴后的弧长后半段，同一羽叶两侧协调旋转；world-down sag不随roll旋转。名义叶长不变不足以证明实际弧长/面积守恒，先CPU预检自然重算与独立的不可伸长段长约束。0档逐byte恢复B0；不混入去叶、改色、随机扰动。还未选45或75，不预设更乱就更真实。
2. 远海地平线：此前70mm照片中的灰蓝条已量化为半径6360km球形天空与±10km平面海水边缘不一致（35.45/6.53px预测与实图相符）。reference研究near平面+far球面/背景ray-sphere等候选；interface独立检查far裁剪、RGBA16F历史alpha深度超过65504m、MRT语义、aerial/DOF/TAA/反射路径。不得只扩大平面、塞雾或直接拉大far来遮掩。

目标保持active。仍需要真实多角度/动态视觉打磨；CPU/GPU检查通过和平均帧率达参考均不等于第一眼照片级完成。

## 用户后续地灯修订（2026-10-27 04:45当地）

用户明确要求三角形环绕、360度无遮挡发光，并有近看的灯具造型。本轮只改灯光/灯体与相应UI标签，没有开始B1或远海运行时改造。

- 三灯坐标XZ改为(-21,5.3)、(18,5.3)、(-1.5,-13.7)，小岛中心在三角形内部；各自terrainHeight .601/.623/.810m，均在干沙。17.3cm高、13cm直径乳白球形扩散罩，青铜色锥托/嵌沙底盘/细金属环；没有侧挡板或方向罩。
- 前三个Spot→Point，保留65cd满档参考及默认45%亮度、独立颜色/联动/夜间策略；全向后总光通量自然不同，未宣称与旧Spot能量不变。球面可见辐亮度I/(pi*r²)，P只乘一次。ground custom近场与native max(d²,.01)及真实距离cutoff对齐；仍是point proxy，不是精确近场面光积分。torch保持唯一Spot和局部shadow，两个pyro point不变。
- 灯壳/球罩cast/receive现有太阳/月光/torch阴影，三地灯本身无额外cube shadow。未为了无遮挡取消其它物体投影。地灯源遮挡与多次GI仍为已知边界，不承诺穿树遮挡已解决。
- `../ground-lamps-check.json` CPU10/10；局部空气14/14（ground-lamps-aerial.log）；语法通过。初次CPU只有Color.length不存在的QA错误，保留-first报告，改toArray后通过，非runtime缺陷。
- `../ground-lamps-gpu-check.json` 真GPU9/9：2m八方位native白卡同值，0/.065/.1/.2/2m actual localIncident与安装Three native attenuation逐值相同，P+1与补偿一致；renderer状态完整恢复。3地灯几何只隐藏在隔离夹具，生产中可见。
- `../ground-lamps-scene-check.json` 实景7/7：三侧point/独立/联动/夜间自动/三灯满档与近景三路RGB有限非负/sampler全部linked且<=16。三张实际PNG `ground-lamps-triangle-night` / `fixture-day` / `fixture-night` 已保存并查看；近夜手动C3，不能与概览自动C约17.70作同曝光比较。
- `../ground-lamps-night-benchmark.json`：1209×1292 DPR1 中档HDR月夜、45%三灯，无烟花；3.2s暖机后4s平均73.51fps，frame p95 27ms，GPU均12.834ms/p95 14.221ms。非所有帧60，非对照加速结论。B4原84.57白昼/43.07烟花仍是旧灯阶段，不偷改成新灯实测。
- 最新local-lights C3199796…，main 7B639D8F…（只增QA入口），index C62928DC…（三个方位标签与说明）。README/PLAYGROUND-ACCEPTANCE已更新。原服务session79829/5186复用，无新server。

并行只读研究也完成：B1预检22/22，自然45/75会使单叶实际弧长约±9%/±14%，否决为纯朝向候选；独立逐段保长误差<=.000184%，仍是几何近似，新增候选数组25.09MiB。`../PALM-B1-PREFLIGHT.md`建议仅条件试B0 vs45，75非默认，尚未改runtime。远海 `FAR-OCEAN-HORIZON-B5-PLAN.md`也只是候选，等待integration反审和最终合同；不可直接扩flat海面/far遮掩半精度深度溢出。

目标仍active；地灯这项已落地，树形和远海照片感后续继续，未因单项通过标整目标complete。

地灯源码/QA追加快照已封存 `../baselines/ground-lamps-20261027/sha256.json`（12文件，manifest d93981fea4ce916c7e5bd61cbc2c895c1def256b0a29a82c38246dd5a572fd25；共用资源及PNG仍保存在主项目）。补充35°/135°与35°/30°日光近景 `ground-lamps-fixture-sun35`、`fixture-detail`，均实际C0，无图像加工；当前网页留在月夜三角灯概览，live、中档、声音off。所有QA截图均普通SDR输出，HDR性能另有本机实测。原生灯光编辑回调本轮未改，既有原生联动/手电记录仍按旧轮次标注，本轮API与实际GPU检查不冒称新增原生鼠标复验。

## 烟花R2阶段检查点（2026-10-27，继续active）

用户新增笑脸/真实高度/照云烟地海/间接光/镜头与长留烟要求。三路primary研究+集成反审后在PYRO-R2-ROADMAP、SHAPE-HEIGHT-LIGHT、PERSISTENT-SMOKE、INTEGRATION-CAMERA中确定分阶段合同。

已上线A/C：

- physics最终5a61e6…：ring兼容ID→世界平面smiley，120/160/190m参考rise；ground效果真实顶点与burst位置分开，width未标定。第一144星密嘴在实际主场景看作霓虹线，四布局控制对照后默认reference120；37/37 CPU与22/22 actualGPU。所有smiley图片在fireworks/smiley-r2，实际新hero及flare开关PNG在verification根。源光度未借减少星数补增益。
- fireworks2f34e1…只修旧短烟HG物理传播角符号，独立before7/10→after10/10；旧scalar/past优化夹具使用同一当前physics输入并仅对授权HG改动做严格guard，16/16与7/7；没有改immutable历史baseline。
- camera-director1eb098…：2/4/8分钟岛/烟花环绕，平滑速度接入、有限地面高度、用户接管、暂停冻结。烟花forecast在start一次冻结并拟合当前真实轨迹/岛，实际发射几何、focal改变取消。CPU19/19，scene12/12，nativeW/滚轮3/3。未声称树木碰撞或任意未来类型仍框内。
- optical-bloom52508e…：同5pass、共1.8%线性PSF，ghost/veil是可选重分配，flare默认false；lens/ui/index接线及native通过。actualGPU22/22+outerStateRestored，固定hero同phase/pose/P12/C16.5 RGB安全5/5。-first只因C浮点3.55e-15EV exact-equality失败，原始报告保留；同读数按1e-10容差重核，无重拍或改gain。奇尺寸离散L1约+.078%已披露。
- PSF隔离成本1209×1292、32valid/组、AB/BA各16、8暖对，旧GPU均.079028ms→新bloom+flare.373152ms；CPU submit wall .046875→.4375ms，二者重叠不可加。新通用GL状态保护在flareoff也存在，不说off恢复旧CPU成本。主场景FPS未由此推算。
- 当前16s实际preview WebM/MP4、状态和media-check均保留；1210×1292 H264/AAC CFR30/15.951s，4/4，stereo峰.48145/.46549。先前VFR直接转码null-mux出现DTS warning，改fps30后完整解码无诊断；未把CFR当实时60fps。音频4e5已接受源/gain未改，录制后恢复soundoff。

B独立子模块已冻结，仍非用户可见完成：state d40060…50/50（含30/60/120长期一致与强制合并误差诊断），events26c251…36/36（同刻新ID/去重/4000s清烟重建failfast/27000packet计数sink压力），radiative-transfer5f286c…CPU33/33+actualGPU14/14。state无age删除，但未解CFD/沉积/RH化学；参考面积不是kg。独立半空间proof13/13只证明可选边界，不偷偷更改现state语义。新BVH列查询与instanced Gaussian renderer正在实现/独立GPU核验前，不接主链，不与旧短烟双计。照云目前主sky只有Sun/Moon且reflection透明区回退旧cube；pyro points280m范围无法达~800m云底。后续必须统一raw源、主/镜面瞬态cloud路径和一跳间接光，P只乘一次，不能借Moon/Sun增益或ghost救亮。

整体Goal仍active。照片感、B烟/照云/GI、椰冠B1和远海B5尚未闭合；当前PNG/影片不能冒称这些已实现。

### B0主场景接线进行中：独立通过与真实MSAA失败（当地约07:20）

独立实际GPU已过：Gaussian18/18（first7/15仅白色alpha0预乘清黑的夹具错误，旧容差未放宽）；前空气14/14；借用真实六路localLighting18/18；transient cloud24/24（first16/22为math probe漏生产HG所需pi，主/镜面路径不受该夹具错误影响，补pi+非零sentinel/program link证据）。记录pyro-smoke-renderer-depth-gpu.json、pyro-air-cloud-gpu-first.json、pyro-smoke-local-cloud-gpu.json；raw incoming/P协议已检查，源→烟的消光/自遮光仍未做。smoke renderer982682…共2samplers，cloud sky66c269…默认API count0，主程序现在主动按真实2簇调用，capture强制排除瞬态。

CPU宿主pyro-smoke.js20/20，真实main只drain一次向audio和烟fanout；清烟同样先consume pending再clear，4000秒新origin与同刻去重安全。空density revision不变时public snapshot曾滞后，现公开snapshot直接state.snapshot，光学缓存仍只按density revision刷新；明确requested/committed time及behind，未静默跳步。columns最终cad9b4…20+8项，两轮优化4096refit同runmean3.183/P953.933ms（Node，非场景FPS）；默认源接口compat12/12及phase10/past16/scalar7已过，5个精确normalizer只消除本轮授权可选参数/颜色衰减/旧烟过滤，恢复旧完整source。中档/main现在有长留烟和照云两个开关，旧短烟绘制关闭；cold-state始终独立于active事件。

**不能把B0算交付：首轮真实22秒场景失败。** 18包20.35参考面积正确产生/持续，冷热range有限，但hot.lastRender为null。真实error抓到depth-copy旧API把water默认2×MSAA target当不支持而throw，water callback中断主镜头。cold暂停后的下一帧跳water缓存才绕过错误，不能据cold图称集成通过。完整失败pyro-smoke-scene-first.json/三PNG与119条pyro-smoke-msaa-integration-errors.json已保留。root已在浏览器临时persistentSmoke:false隐藏绘制、保留20.35物理量，paused月夜；不靠关闭水MSAA修。

MSAA修候选depth-copy df73dd…支持实际DRAW FBO到samples0深度NEAREST同尺寸解析，已在独立真GPU首轮36/40：所有逐值copy/颜色不变/continuation/state通过，3个斜面解析witness与GL1282仍待reference定位（depth-copy-msaa-gpu-first.json）。可能含MSAA sample位置与pixelcentre差异，必须证据化改夹具，不放宽任意容差。另smoke renderer的DPR2冗余setViewport会二乘DPR，tropical已获授权最小RT物理viewport/restore修及DPR2专用GPU，尚未冻结/执行。未通过前不重拍合格B图、不宣称新默认FPS。

源强仅CPU可选接口已冻结physics d60c1e…，intensityScale0..64默认1，17/17+旧22/37，所有身体/分裂统一只乘I一次，烟/声/RNG/轨迹不变，主程序/UI尚未选新默认。后续固定C/phase实际1/4/16比较，P按安全存储界记录，不能按某一路单独增光。视觉反审已实看A/C三PNG及Optimum真实smiley：嘴仍悬浮灯牌感；D(t)未校准，ring主阶段约90m而供应商90mm例宽60m非通用；岛/灯比例与完整倒影构图互有取舍，当前ghost副脸偏像图像复制。D(t)多seed/风研究进行中，未改速度/尺寸。GI只读合同TRANSIENT-GI-IMPLEMENTATION-CONTRACT及16项proof完成，采用逐源unit-SH cone约束保持正增量与a0，Node合成六灯约.5ms；尚无GI runtime或实景通过。

### B0真实复验通过，但实看否决中心黄棉团（当地07:24后）

反射MSAA修已实际40/40通过：depth-copy-msaa-gpu-trace.json。six combinations实际samples0/2/4×perspective/oblique，copy逐像素maxerror0；GL原生调用trace无新错误，旧聚合1282未复现但归属仍未知，不能编造已定位。斜面解析见证改为实际pixel四角严格区间（2e-6区间外tol未变），原pixel-centre residual留存未归因；copy1e-7原阈值不变。df73dd depth-copy与72cd helper冻结，DEPTH-COPY-MSAA-REVIEW明确driver/nativeRTT未覆盖分支。

DPR窄修97fd实际9/9，nested原18+14+18全部通过，physical17×13共221pixel在DPR1/2逐bit一致，caller==target/metadata/实际与logicalviewport恢复、backbuffer与DPR恢复通过；pyro-smoke-viewport-gpu-first.json。报告本身没内嵌sourceSHA，补pyro-smoke-viewport-acceptance.json连接source/helper/report hash，不能把report自带hash。源码scope5/5只改viewport，旧证明已封存。

root新增pauseAtPhysicalTimeQA：delta截到target，整帧更新/绘制后paused；不重写event birth或SMOKE水位。实际pause-target9/9。B0重跑pyro-smoke-scene-check.json包含pauseTarget和scene11/11：hot18包/2源、main+mirror有实际pass、冷热RGB安全与headroom、隐藏不删mass、22s后active0仍18包20.35、paused完整snapshot稳定、主帧exceptions0。samephase显隐有2501变化pixel、最大byte差199、RMS2.693；三张实际PNG pyro-smoke-scene-{hot,hidden,cold}.png已保存且root实看。此时source是legacy8t radius/point HG、Iscale1。cold C17.7034与hot16.5不同，不能把冷热两图当fixedexposure消散对照。当前已不是MSAA异常中断，但热烟额头像发光黄棉球，**不接受视觉完工**。

源码54文件candidate快照 baselines/pyro-b0-candidate-20261027-072409/sha256.json 保留了这组接线（仍标candidate，非最终照片感验收）。main/UI已增加共同源强slider0..32、默认1，影响后续真实源/照明/倒影而非postgain，atomic config先source validate再commit；音频4e5仍锁定。独立源强比较helper已备，待新光学模式先验收，依赖exact pause与raw fireworkClusters accessor；各shot固定seed42/C/相位/pose但绝对physicalTime和海/云自然不同，P允许按安全界变化，不能伪称全scene单变量pixel对照。

为修最假黄团，追加两条opt-in且默认旧行为的受控候选，尚未actual GPU/图像准入：

- fireworks077ea2… `clusterModel:'moments'` 真实当前head+tail/I加权RMS，r=max(2,RMS)，报告maxExtent，centroid/I/RGB不改；factory默认legacy，live configure可切回。实际seed42/+1.1s RMS17.9518m vs旧8.8，proxy中心E约降4.16倍，不改I。CPU14/14、default50帧14292instance精确B95，phase10/physics22/intensity17/medium12/past16/scalar7过。新baseline fireworks-before-moment-clusters保B95；normalizer6处严格逆变换。旧medium首次11/12是把新增d60强度功能错误当physics字节不变，失败保留，改为本轮B95 physics一致+独立17项默认等价oracle，不动5a61历史baseline。
- smoke renderer05293e… `render({finiteClusterPhase:true})` 默认false，仅pyro2簇内部iso1/4pi，d>=2r回原HG，中间view独立smoothstep凸混合；bounds原HGmax仍保守。CPU9/9及exact7处compat还原97fd，local13/math18/air15过；新actualGPU14待root。main source已接这两个控制但default仍legacy/false，准备4way同一真实event/physicalTime/density/pose/C拍图，不借I变亮/变暗代偿。root真实照片复核文档PYRO-SMOKE-VISUAL-PHYSICS-REVIEW说明RMS并非准确near-area灯、iso正面平面环比p(0)高28.95%，不能只看更暗就称正确。

其它待决：burst9核仅±2.6m/σ1.6/1.1/1.6，缺少沿star燃烧排烟/卷涡，几何可能仍像棉团；interface只做trajectory-v1合同/原型（建议3中心+12轨迹、加9launch总24/发，总area20不增），禁止混入音频未知kind（audio会默认launch），实际未来风、清烟/ID/双domain队列须先反审。D(t)160case/9check已封存DIAMETER-TIME-RESEARCH及两图，不统一缩十类，ring s.75仅后续独立候选，未准入。tropical已获授权实现默认off的transient1-hop GI，仅indirect-lighting+QA，不动main；61向量/54vec4/0新增sampler，baseFiltered与published分账，逐源unit-cone，ground新入射用真实surface而非+.065 visibility offset，仍未有新GI actual结论。

### R3：局部一次反弹接入、轨迹源首轮实看（当地2026-10-27早）

独立transient GI GPU实际14/14且nested旧40点通过：transient-gi-gpu-first.json；CPU23/旧25已过。main现在在raw locals更新后、P选取前更新cloud visibility/baseGI并prepareTransient，combined bound只预算一次，再setSceneExposure(P)一次；移除了帧末第二次baseGI blend。局部闪光不走太阳0.18s缓存，仍是六源/SH1/粗表面代理的一跳漫反射，非全路径GI，水界面、specular、多次局部反射不声称。实际场景A/B正在准备，不能把独立GPU过关叫实景验收。

trajectory-v1源CPU29/29，旧源36/宿主20/state50/physics22/audio12/intensity17/cluster14/medium12/past16/scalar7/phase10全通过。main已显式选择v1，24包/空中单发M20.35，fan81/M.9、bouquet9/M2；legacy默认仍保持原几何，runtime hashes见PYRO-SMOKE-TRAJECTORY-V1.md。光学main已选moments+finite，实际独立finite14/14和moments bound7/7，四路同事件实景11/11（pyro-smoke-light-model-check.json）。这是近场低频模型改善，不是面积光/多重散射精确解。

真实三档源强1/4/16首轮pyro-intensity-scene-first.json为61/62，唯一失败是root运行中向main新增QA hook，开始/结束fetch源码hash确实不同；加载中的runtime未替换，但不能删掉这项或称全通过，原JSON/六PNG全部保留。其余rawI比例精确1:4:16、phase/pose/C/ranges安全。云照明显隐：1与4整图0差；16只4pixel/1byte且上方35%仍0，故当前晴夜RH68/base813m **没有可见照云验收**。不能用独立24项cloud GPU正确替代真实可见度。Root实看scale1/16：v1将原大球分为若干小黄亮球，仍然像棉球，视觉否决；不接受为最终烟气。正在反审同预算、沿过去燃烧段的细长SPD核，不靠增亮/多烟/乘噪声掩盖。

npm run check和完整verify:playground最新均exit0：pyro-r3-syntax.log、pyro-r3-playground.log（source FW6b37e0…）。真实中档1209×1292/DPR1/HDR auto/空烟/默认白昼8s基准保存pyro-r3-day-baseline-benchmark.json：mean83.47fps、frameP9524ms，GPUmean11.20/P9512.46ms；不是稳定锁60或烟花/大量积烟性能结论。当前所有新实景性能/形状/云照明仍未最终验收，Goal继续active，音频4e5/用户已验收主爆不改。

### R3后续：同发四核实景、近场色阶与GI残差定位（当地08:50后）

V2 past-segment数学12/12、源生产10/10、旧point29/29均通过；仅为5点过去燃烧段同birth矩闭合，有≤.30s源时间延迟，后续缺热/速度cross covariance，不叫CFD/连续精确排放。main用原始声音事件一次fanout给原host+4独立state，仅selected体积参与绘制/P，完成后恢复原host。实际front/oblique/detail共12PNG保存pyro-smoke-kernel-scene-first.json，48/56；8失败因OrbitControls把requested相机径向夹到230m，非四组不同机位。独立offline recheck41/41证每角四图实际camera/target逐数相同、C16.5/I16/UTC/密度不变，像素图未替换，原48/56保留，不冒称新GPU56/56。实际detail图root与tropical独立实看都否决：segment把12椭球拉成12香肠，.05仅减中心，不算自然烟。下一步同M与kernel增加真实轨迹采样48→60包，非新烟量/增益/噪声乘密度。

高清detail另暴露严重天空海面posterization，根源线索为source预算fireworks35947.7导致P−1.25而实际composed peak.329stored≈.78raw，淡天空进入F16次正规低精度；frontP11.5和obliqueP10.5没有这类块状色阶。正在以真实相机的主/反射 homogeneous clip和GPU见证检查是否把实际near/far完全裁掉的source仍算全屏，不先放宽安全界/降低星体亮度/改曝光掩盖。

GI第二次实景82/84：sourceI16/C16.5，同P近岸实际282023pixels/max14级，off复原仍12pixels1级。第三次probe实景亦82/84，原始报告transient-gi-scene-third.json保留；两view off→clear全部216个published Float32系数逐位完全相同，P也完全相同，故不是GI原始残光。关闭temporal/glintAA的隔离首次实际off/on/off返回0pixel且完整HDR extrema完全相同、信号281109pixels/max14级；原AA返回13pixel1级。首次隔离17/32另含root在helper开始前刚移动机位造成initial基线P仍旧的夹具问题，原图/报告gi-history-rebuild-first.json完整留存；正在稳定同机位重复，不能把夹具失败删除/放宽门槛。既有TAA差异只出现在历史重建后，冻结视图本身继续复用静止图，不能据这项叫持续随机闪烁。

### R4：完成镜面裁剪预算修复、Taylor同发实景32/32、逐星照烟候选（当地09:40后）

FW生产b1b1ac57…只在预算aggregator前剔除Float32误差区间已证明完全depth-clipped的源，保留public Gaussian/endpoint/renderer/upload算术。实际postfix near-plane8/8+moments bound7/7：fireworks/near-plane-postfix-gpu.json；entry/finalGL无新错。新两host samples复验24/24：pyro-smoke-samples-postclip.json。复现detail固定C16.5/I16/+1.1，源预算35947→7.18615，P−1.25→10.5，实际peak1134<16376且main/mirror有限非负；root和interface独立实看天空/海面巨大色阶消失。旧/新episode绝对physicaltime/海云相位不同，未冒称同一图像单变量A/B。原所有错误截图与报告保留。

新Taylor统计扩散默认off，runtime五文件manifest见pyro-smoke-taylor-manifest.json。q记录E(exp(-age/TL))，GL5同birth V/q，merge按M加权q，不从minBirth回推；TL10是作者候选，Taylor单粒子absolute variance移用puff内部，隐含子粒子去相关，不声称实测relative puff/CFD。CPU18/18+原state50/host20/moments12/trajectory29/V2 10/samples13全过。主程序生产仍point/.20/12/Brownian；Taylor/.05/48仅QA候选。

实际同一发、原始事件fanout original+Brownian/Taylor两host，源光/声只一次，front/detail四图：pyro-smoke-dispersion-scene-first.json **32/32**；P/C安全、60包/M20.35、除Σ/q外逐有限binary64相同、完整density冻结。root实看Taylor更细，但仍像金色放射状条块，不收照片感验收。原48轨迹无Taylor也24/24技术通过但同样视觉否决，未靠改M/I/色调来隐藏。

真正新的受光因果证据：同actual event的120发光源 ledger存fireworks/dispersion-scene-emission-ledger.json；smoke-light-field-centre-diagnostic.json检测45/48root中心应G>R，旧RMS平均代理却全R>G；旧/全point峰值比median.889，主要空间颜色错误而非普遍过亮。独立完整SPD参考和1trace-isotropic模型也45/48偏绿；原型23/23，1分量当前snapshot中位RGB误差1.44%/max5.01%，Node60×120 median.83ms，4096×240触发50ms中止。9节点虽当前均值误差小，但近源377.7x与旋转31x反例，明确不准入。

下一批准候选合同SMOKE-RESOLVED-LIGHT-FIELD-CONTRACT.md：defaultoff，仅volume用真实调制source ledger+归一trace-isotropic Gaussian过滤的rawRGB SH1，GPU一次3-MRT bake避免CPU大规模pair loop，替换smoke内pyro4/5，保留地灯/手电/sky/sun/air，其余scene/cloud/GI不改，水仍16samplers。正SH与不读回raw界需独立GPU/主镜像/perf验收，尚未实现/准入。三agent分工：interface ledger+CPUbound；tropical field/renderer/host；reference独立oracle/反审。更细/更绿仍可能是CG造型，不能以数理过关替代视觉。

root最新npm check语法通过，verify:smoke完整17报告334/334，日志pyro-r4-smoke.log与summary.json；原终端session ID未保存，summary如实说明，不伪造exit字样。verify:playground另有可追溯session43652实际exit0，日志pyro-r4-playground.log。新field后需要针对新改动验证，避免无变化反复全跑。音频4e5锁定，Goal继续active。

### R5：逐源烟光场实接线、缓存与普通夜景（2026-10-27中午）

`细致烟气受光 · 实验选项`已接原生开关，默认关闭。真实当前火星head/tail ledger完整上传，单Gaussian trace-isotropic过滤后按packet烘焙raw SH1，只替换体积烟内pyro4/5；灯0–3、天空/月光、其他接收面/云/GI保持其原有模型。超过1,048,576 source×packet预算时明确显示unsupported/整体光源近似，不截断列表。该照明不乘烟质量；光学消光仍由原物质/Σ计算。主场景生产源仍point/.20/12/Brownian，Taylor48/细长核并未无声变成默认。

实际独立GPU首轮127/127、补测21/21、同一真实事件两host实景32/32均通过，报告分别pyro-smoke-resolved-field-gpu-first.json、pyro-smoke-resolved-field-supplement-first.json、pyro-smoke-resolved-field-scene-first.json。60包/M20.35完整snapshot含Σ/q逐数一致，C16.5/源I16同一发，仅照明改变；front自然P11.5→11.25/detail10.5，不能把stored峰值当同P对比。原生checkbox在生产24包上实际开启effective/2880pairs，关闭还原。真实图片已核对为绿色位置受光正确，但仍像光滑放射状花瓣，**不接受为照片感完成**。独立只读审计SMOKE-RESOLVED-ACCEPTANCE-AUDIT.md。

隔离GPU每规模只有一个有效计时：60×120 .66048ms，256×240 1.248256ms，1024×240 1.288192ms，4096×240 3.072ms；不叫全场平均或P95。14000源单packet补测4.626432ms，CPUprepare5.2ms，不按pair数线性外推。

反审还发现空ledger generation每物理帧改变，会导致冷烟重复写零MRT。field eed474…新增已知零layout缓存：亮→灭完整清零一次，其后同容量仅更新metadata；扩张、重新启用、再照亮后退休均重新完整写零。真实GPU20/20且原127/127回归通过，三RGBA32F附件含padding全bit正零，60空generation+20密度更新无新bake；见pyro-smoke-zero-field-gpu-first.json、pyro-smoke-resolved-field-gpu-zero-regression.json。CPU7/7，原hostforward后的strict-inverse首失败另存pyro-smoke-light-field-host-forward-first.json，正在显式compose后续profile4点inverse，不放宽默认保护。

普通I1/海风1.8的生产源正面PNG见pyro-normal-production-front.png。当前中档1209×1292、HDR auto、原生产24包、逐源模式off的一发夜景10s实际benchmark均72.16fps，frameP95 25.80ms，GPUmean12.95/P9516.71ms、CPUmean13.30/P9525.30ms；最大帧163.6ms包含尖峰，不能称锁60。报告pyro-r5-night-production-benchmark.json。此后高清1920×1080电影设置不属于这次benchmark。

时间释烟研究确认旧两次birth在+.65s已全部生成M20.35，而seed42笑脸根星寿命3.196–3.993s。批准另一个**仅QA、仅ring**的uniform-burn候选：完整总预算不变、按代表根实际life逐步提交，首cell以稳定bodyID错相、后续≤.3s、GL5只读已知过去轨迹/风。候选不等于CFD、化学烟产率或全部十类完成；其他类型/分裂子星/落水熄灭仍有明确限制。须实际连续电影/帧耗/最终守恒后决策，未改main生产默认。

### R5反馈与后续校准（2026-10-27午后）

用户已看1080p B影片并回复：**“b明显更好”**。这只确认当前笑脸持续释烟节奏/观感的相对改善，不扩为全场照片感或全部烟源验收。用户进一步指出最低星接近海面，询问高度/速度/爆炸方向/同步；本轮继续校准。

当前默认rocket实际是无持续推力的mortar壳体，旧模型把burst强制放在apex；seed42/80°/rise120飞行4.658s，burstVY≈0。原phase3.65最低live9.13m、3.882s首次触海，但当时该星仅.2534%固定Iref，不能说主强光阶段已撞海；I阈值/几何须分别记。供应商示例90mm/120m/延时3s与apex假设不一致，不能只用高度表称完整动力学已标定。

reference独立QA研究9/9、48case保存fireworks/ring-flight-height-study.json：保持rise120、timed3s时，线性drag.075反解v0Y59.934955/muzzle60.85955，burstVY+21.504955，星体继承真实COM向上速度；D_op/I/life/count不变，全burn端点最低60.1488m，最大可见高度185.3186m。相同muzzle能量和3s引信在25°时rise自然降至28.084m，不伪保高。该源时程仍是作者线性阻力候选，供应商泛例不是本具体smiley实测；尚未runtime/实际影片。单独出平面tilt15仅把phase3.65低点9.13→11.07m，不能代替动力学校准；与平面内歪头roll不可混称。

完整逻辑体元数据foundation已冻结FW963bc4…/fireworks-combustion纯入口d233…：可选lazy describeCombustion给全部roots/children/ground-comets及lift/burst/carrier的深冻结DAG，无XYZ/I/fuel捏造，不实际新增排烟。CPU15/15+ledger13/13+physics22/22，默认50采样与76全部输出一致，三点exactinverse→76→原ledger两点通过；见COMBUSTION-METADATA.md。旧sample仍root-only，不能说已全面覆盖烟源。

下一有界步骤：仅ring opt-in timed-reference，defaultapex精确保留，独立验收后拍同120m/源I/M设置的新片；不混改spread/tilt/色/寿命/声增益。sourcecoverage/初生减速扩张/opticalLOD已有两轮反审但未runtime乱加。性能分项门见PYRO-R5-PERFORMANCE-GATES.md，先计时主/镜面volume/field与columns，不能直接把半分辨率称全场×4。Goal继续active。


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
