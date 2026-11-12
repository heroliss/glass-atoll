# R9：精确峰值输出、持续烟源与尾迹积分检查点

2026-10-28。根据已封存的真实HTTP/GPU/场景报告整理。**整体照片感未验收，Goal继续active。** 本轮已接精确峰值服务并选择应用尾迹默认，影片、密集窗口与真实重载证据分别记录；技术通过和默认选择不等于用户视觉接受。

## 精确峰值：CPU-ready、GPU准入与实际呈现分开

本地`POST /api/aces2-target`已接固定OCIO2.6导出服务，接受100..10000整数峰值。相同峰值共享任务，单并发/有界队列和缓存，不接收路径/命令；loopback与同Origin、严格64B JSON、失败状态和既有Range/HDR探测另有回归。[实际HTTP73/73](r9-aces2-target-http-check.json)、[媒体Range30/30](r9-server-media-range-check.json)均在独立临时端口执行，原5186由root统一重启。HTTP成功仅为CPU-ready，不能直接表示输出生效。

新峰值先使用其自身963个官方CPU参考样本及61个黑padding进行真实GPU准入，再发布为可绘目标；不是用700表改uniform冒充1200。当前实际新峰1200的[独立public-render61/61](r9-aces2-admission-first.json)覆盖五families、曝光/单位/OETF、P±8、资源hash、附件/反馈拒绝及GL/Three状态。准入和public比较沿批准的absolute2e−5＋relative2e−4工程门；**纯absolute2e−5仍有29通道超限**，最大绝对差约5.722e−5，不宣称官方认证或所有极暗通道相对误差为零。

旧pinned helper在需求扩大后得到135/137，失败恰是旧“1200域外”两条；原报告保留。[R9窄clone源码5/5](r9-aces2-pinned-clone-check.json)只将两行域外fixture改99，其余135门及容差逐字相同；[后续实际pinned137/137](r9-palm-fan-source-scene-second.json)已执行，未用facade模拟拒绝合法1200。

[1200实景输出](r9-hdr1200-scene-presentation.json)10个条件成立；原生1920×1080呈现复制8/8、真实扩展值>1、翻行对应、有限非负且GL错误为空；物理snapshot和HDR范围极值不变。这不等于完整pre-DRT master逐像素散列相同、面板1200nit测光或实际烟花绝对光度标定。PNG/MP4为SDR，不能用其展示面板HDR亮度。目前新峰只实测1200，未穷举所有整数峰值；legacy仍是默认，HDR/SDR最终观感尚未被用户接受。此段更新[R8检查点](OUTPUT-ASCENT-R8-CHECKPOINT.md)中“1200尚未HTTP/GPU”的历史状态，不修改旧报告。

## 两类持续烟源：真实同事件技术复验

[palm/fan候选](PALM-FAN-BURN-CANDIDATE.md)沿真实逻辑燃烧体的life释放原有参考物质量：palm12根、fan9根，发光body/RNG/I/音频不变。palm整发M20.35；fan整发M.9、作者10%嘴口/90%彗星分配。参考M不是kg或实测产烟率，均匀life释放/Taylor扩散不是燃烧化学或CFD；其他八型不因此获得持续源覆盖。

新[清洁实景报告](r9-palm-fan-source-scene-clean.json)是独立复跑，**palm45/45＋fan45/45**。种子42/I1，一次真实事件供early/continuous两个host，burst后.8/3.6/10秒各front/detail共24张`r9-clean-*.png`；每次切host保持源clusters、物理时钟、UTC、相机、C和该host物质snapshot，P可按安全预算独立变化。main/mirror/composed实际范围安全、无重复音频调度、无异步frame异常。entry/palmAfter/after全部GL[]、program live且非delete-pending，两型恢复标记完成。

末相位palm261包/M20.35、fan192包/M.9，pending与reserved均0、账目闭合；不同源几何本来允许图像不同，不能要求相同像素或把更多烟当真实。两型均`visualAccepted:false`。原[第二报告45＋45但exit1282](r9-palm-fan-source-scene-second.json)和[API尚未ready的启动race](r9-smoke-clean-startup-race.json)保留，新报告不覆盖旧失败。

此前QA radiance reader在default framebuffer恢复8个BACK的实际1282已由[逐调用trace](r9-radiance-default-buffer-trace.json)定位；一处cardinality修复保留全部reducer/分类/数值字节，[独立reader9/9](r9-adaptive-and-radiance-gpu-first.json)和上述新实景GL[]分别形成修后证据。不是只清错误队列或把旧报告改成干净。

## 尾段积分：采样错误闭合，动态观感与预算另论

原8点空间积分在细长尾段上点距远大于像素核宽，形成珠串。adaptive以正归一N/N+1积分及有界fallback改善空间采样，不改变头部、发光I/RGB、物理轨迹、原raw bound、烟源或声音，也不增加pass。最初[实际7/8](r9-adaptive-and-radiance-gpu-first.json)的golden失败保留；实际interpolant证据定位为扩大quad的栅格偏移，窄修使用真实fragment中心后，[f0c版GPU9/9](r9-adaptive-tail-gpu-fixed.json)通过未改103组golden/原容差，并额外确认冻结旧GLSL的legacy尾段/head逐像素不变。之后927版只省略零权重端点循环，[实际GPU10/10](r9-adaptive-tail-zero-only-gpu.json)的九组16384像素RGBA Float32图与冻结f0c逐位相同；不把已撤回中间版本或旧7/8改写成通过。连续积分本身仍有已声明的离散误差，见[完整边界](fireworks/ADAPTIVE-TAIL-CANDIDATE.md)。

[同事件四张静帧13/13](r9-adaptive-tail-scene.json)是burst+.8秒、front/detail的legacy8/adaptive对照，同角度源、时钟、相机、C/P一致且HDR范围安全；`visualAccepted:false`。它不是动态零闪烁或照片感证明。

[实际8秒交错性能](r9-adaptive-tail-scene-performance.json)有效，1920×1080/q1/MSAA8/28mm/DOF关/声音关，唯一palm/I1与显式持续烟候选。414个完整query各207；legacy8/adaptive完整帧GPU elapsed均值 **18.68477/19.17411ms**，p95 **24.96749/27.71354ms**。观测差+.48934ms/+2.619%，不是纯尾迹shader成本。相邻帧物理相位不同，C16.5固定、P自然10.25–12，不能声称同相位paired A/B、fixed-P或各模式独立FPS。

整段8.0257秒平均 **51.46fps**，rAF p95/p99 **29.8/35.8ms**（原benchmark floor分位定义），276/413间隔超过1000/60ms；不能说达到每帧60。最后5个query在57.7ms原loop drain返回，414全部有限、零pending，后置GL[]且状态恢复。query区间包含probe/切换和可能的CPU提交空隙，单近景一次窗口无跨设备保证；完整观测开销、分位定义和范围在[专项报告](ADAPTIVE-TAIL-SCENE-PERFORMANCE.md)。

## 影片和密集成本：版本与负载不能混报

[实际影片](pyro-r9-tail-motion.mp4)、[WebM](pyro-r9-tail-motion.webm)和[捕获记录](pyro-r9-tail-motion.json)为f0c6251c版的一次16秒palm/I1、持续烟QA、C16.5/SDR legacy/adaptive录影，含一次真实近景切镜头；**不是927重录，也不是legacy/adaptive同相位动态A/B**。[媒体12/12](pyro-r9-motion-media-check.json)包括MP4/WebM全片解码、1080p/H264/CFR30/AAC48k立体声、有限非空音轨和音频SHA不变；原生WebM273帧与CFR输出475帧不同，CFR不能表示实时渲染帧率。[原生播放器](pyro-r9-tail-native-player.json)实际readyState4、完整seekable并于16.02秒ended。媒体可播放和技术门不证明照片感、零闪烁或完整倒影构图已接受；capture JSON未内嵌fireworks.js hash，f0c归属依root录制记录与冻结基线。

f0c版[双菊单模式压力5/5](r9-adaptive-tail-high-count-scene.json)中384头/真实尾段、main/mirror/composed范围安全、GL后置为空；该次平均29.70fps，不是927结果。再用927版做[同一演变窗口的8秒逐帧交错](r9-adaptive-tail-dense-scene-performance.json)：1920×1080/q1/MSAA8、声音开、生产point烟、C16.5固定、P11.5–12自然变化，209个完整query全部返回（legacy105/adaptive104）。整帧GPU均值 **27.82004→28.03981ms**（+.219775ms/+.790%），p95 **57.53549→66.14563ms**；原loop72.8ms drain取回最后五个，零pending/issue，后置GL[]。它不是纯tail成本、严格同相位paired测试或零代价证明。

密集整段8.0217墙钟秒平均 **25.93fps**，rAF p95 **92.7ms**，120/208间隔超过1000/60ms。物理phase仅.1215→6.5432（推进6.4217秒），不能当作8物理秒；长帧delta上限仍在。源抽样峰3072tail，远视图adaptive maxN9、无fallback，后半段tail自然过期会稀释整段均值；不外推近景N91或长时积烟。此窗口与声音关的单palm51.46fps不同负载，不能直接作优化前后提升。完整原始范围见[密集成本说明](ADAPTIVE-TAIL-DENSE-SCENE-PERFORMANCE.md)。**共同整场瓶颈仍在，60fps预算未闭合。**

## 最终应用默认及真实重载

root只在main的`createFireworks`实参增加`trailIntegration:'adaptive'`；改前完整main封存于`baselines/r9-before-adaptive-application-default/main.js`（SHA256 `3b89ea4c5bf5af7da5b64b496c3968a70435f57c5b0c154392898db6baf481c8`），窄逆该选项可还原其余全部字节。**应用默认现在为adaptive，独立fireworks模块默认仍legacy8并保留预算fallback；不是推广所有烟源候选。** 决定依据是近景采样改善与有限窗口中较小整帧均值差，不是所有场景低成本、用户已接受或60fps保证。

[实际重载报告](r9-application-default-scene.json)与[默认日景](r9-default-day.png)/[实际palm](r9-default-palm.png)证实：`qualityPreset=medium`、实际MSAA8/shadow4096/wave512、显示legacy、声音关、`diagnosticCameraEV=null`，没有QA绝对C锁。无烟花源的日景requested为adaptive、effective为awaiting-render是正常状态；实际palm后effective为adaptive-with-legacy8-budget-fallback，诊断96条tail/maxN10/无fallback，确有生产效果实例。日景实际C0/P−1，palm自然C约16.5/P12；不能把“无QA锁”说成实际C为空。

重载后日景和palm的opaque/composed/reflection三缓冲均无非有限/负值，reader状态恢复；dayAfter/after GL[]、program live且非delete-pending。原生1209×1292/DPR1/q1日景8.0151秒基准有效，HDR自动实际启用、原生浮点外部复制，690个rAF间隔，平均 **86.08751fps**、rAF p95/p99 **23/27.4ms**，116/690（16.81%）超过1000/60ms；685个WebGL GPU样本均值 **10.834565ms**、p95 **12.153ms**。WebGL计时不是跨WebGPU呈现完成的统一GPU计时。这不是烟花重负载成本或每帧60保证，也不与不同源码/时段的旧R8做严格增益比较。

上述927版源码SHA256为`927b044a20fd6497ee052a84a70e73b4a1d4bfaf5193f6cde12943ba89db2a0d`；f0c影片、近景51.46窗口与927的10/10、密集25.93窗口、最终默认86.09日景分别保留版本归属。生产烟仍trajectory-v1、point/.20/12/Brownian/two-births，逐源烟受光设置仍false；ring/palm-fan持续烟、Taylor48和细长核没有因此成为默认。ACES可选、legacy默认也未改变。

## 仍待完成的目标

分钟级/小时级积烟、4096包和更长多发边界、烟气自然形态、差异化燃烧/RGB/尾迹以及真实HDR/SDR视觉分级未验收。384头密集窗口只补了一种短时源负载，不证明长期预算。明显照云、椰冠叶形、远海地平线和原“第一眼照片/任意角度细看”仍有缺口；原晴夜云底约813m下I1/4无可见云差，I16仅4像素1级，不能称已明显照云。详见[R9范围审计](R9-REQUIREMENT-AUDIT-DRAFT.md)。

用户此前只明确接受第三轮爆响的“冲击感合适”、B0相对叶冠偏好及笑脸烟B“明显更好”，不能扩大为本轮HDR、tail或palm/fan视觉接受。`fireworks-audio.js`保持SHA256 **`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`**；清洁静帧、单palm成本和默认日景声音关，密集成本/影片声音开，不新增主观音色或严格传播同步验收。原始失败、参考图和历史影片均保留。

源码窄逆和已记录浏览器证据重放[7/7](r9-application-default-check.json)、尾迹专项CPU7/7及[语法日志](r9-syntax-check.log)通过；证据重放脚本不是新GPU运行。原图可在[高清审阅页](tail-optics-review.html)切换并按100%查看。当前源与本轮文件封存见[清单](r9-source-evidence-manifest.json)，其中单列f0c、撤回的d280和最终927，不能把清单当前源码hash套给所有旧截图。
