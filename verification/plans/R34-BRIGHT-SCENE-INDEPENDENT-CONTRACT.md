# R34 明亮烟花实景：独立最小方案与合同边界

本文件是 CPU/source 方案，未运行浏览器、GL、GPU、物理重放或新 helper，未修改生产及 R33 封存文件。观察源码为 main `328f997e…`，生产 water `d7d5b76d…`、音效 `4e5ede41…`；R33 当前自动选择 DISPLAY6 / 系统报告1270nit，生产显示变换仍 legacy。不是绝对亮度校准。

## 本轮优先：一枚正常日常三芯烟花的实际视觉观察

根任务提出的日常 public API 路线没有发现功能性阻塞，能直接得到真正多层画面，优先于再造一套尚未需要的每阶段 pipeline。它的准确名称应是“实际日常渲染观察”，不是 R31 strict native gate、一次固定绘制、FPS 验收或新 HDR 数值验收。

1. 保存完整参数/机位/UTC/灯光/界面、烟花设置、原画幅与当前显示器状态；确认暂停空场景，0 active/queued/packet、上下文健康、没有 QA/画质/显示配置或交互未完成。保持 sound 原值（当前 off）、强度1、全部画质、物理尺寸、云与持续烟设置。不要调用旧 source-pin helper。
2. 使用现有 `setFireworkEffectProfile('three-heart-v1')`。它正确强制 chrysanthemum、关闭 autoLaunch；不会自动设置 autoFrame。若本次希望自动构图，另用现有 `setFireworks({autoFrame:true})`，其改变属于显式本次观察设置，最后恢复。`launchFirework({autoFrame:true})` 并不能替代这个全局开关。
3. 在同一段同步调用中 `launchFirework({seed:42})`，检查 accepted 且 queued:false，立即 `pauseAtPhysicalTime(receipt.burstTime+.70)`；两者间不 await。目标来自本次实际 launch receipt，不复用旧159.826…时间。保留当前 launchSpreadDegrees15及实际回执角度，不伪称与旧零散布回放同一轨迹。正常飞行和海浪/云/树运动全部运行。
4. 在目标相位首次完成正常帧后保存状态，再保存暂停重收敛后的状态与高清显示截图。实际控制台/GL、相机、burstTime与当前time、三层body元数据、发光/烟数量、SH版本/有效/回退、main/mirror记录及各自T元数据都应保留。当前`pauseAtPhysicalTime`会将物理步长截到目标，随后完成该帧后暂停；它不绕过实际模拟。
5. 暂停后通常还有最多约41个正常收敛帧，SH可以显示reused:true，这是正常缓存，不是新鲜一次受光成本证据。记录首次目标和最后稳定状态，不能把缓存FPS/最后字段称为鲜算整帧时间。截图也可能包括逐帧历史重收敛，不能声称一次纯冷帧。
6. 只执行一枚，不自动循环/多发/benchmark或调整曝光以“做亮”。截图检查三层形状、色度、尾迹、真实烟/云/地面/水受光与完整倒影；缺失与黑暗本身就是待修证据，不以nonblack检查冒充照片感。保持现有手动EV0；HDR屏幕图仅为当前呈现观察，不是HDR原始像素/ACES/绝对nit证明。
7. 完成后正常reload并按保存状态恢复，验证原quality、settings、camera/target、UTC、灯与UI、sound和音频hash、自动DISPLAY6/1270、0烟花/0烟团、GL健康。reload后物理相位/帧历史不能声称逐位回到旧瞬间。发生图形中断保留记录，退出观察、普通恢复；不自动再发重试。

这条日常路线会渲染整个上升过程、+.70前后和暂停收敛，**没有每帧100ms硬中止器**。生产4,000,000完整请求 / 1,000,000每map / 8map是数值请求政策，不是全帧耗时或无CPU回退保证。应如实记录每路实测配对与fallback。three-heart-v1是192体三层发光配方；当前普通trajectory-v1/two-births烟模型仍为稀疏代表源，不能把它说成192体逐粒连续产烟。该观察不改变默认烟算法，不人为删烟或减画质。

## 若后续确实需要一个可封闭的明亮整帧数值门

已有R30/R31公共函数不是通用相位API。`replayR30BrowserNativePair`、`captureR31CurrentViews`、`r31WorkBudget`和实际metadata断言都固定在burst+3.90、2301P/1399SH/1402每眼；新的main、sun-shadow和HDR依赖也已使旧pins过期。禁止篡改输入或只换旧pins强跑。

最小新合同可选择已存在的同一powered recipe **burst+.70**，只截断原因果updateTimes前缀、不增加中间物理时刻、不注入参考状态。原冻结recipe精确点：

| 相位 | 物理时间 | active/empty更新 | 烟团 | SH源 |
|---|---:|---:|---:|---:|
| +.70 |159.82687017173075|376 /32|396|1728|
| +.85 |159.97687017173075|388 /32|515|1728|

这些是历史同recipe的计数，不是新三芯日常观察的计数。旧高机位表reflection0与当前低机位表必须区分；当前低机位既有CPU资料在+.70为1728各眼、+.85为1740各眼。要用的每眼原始射线仍需在本次当前camera、reflectionCamera、optics、native extents下重新完整捕获并私有复制。不得将main T复用到mirror；后者起点应是对应mean-water命中点。

当前纯生产planner对该历史计数给出：

| 相位 | 单眼SourceT逻辑配对 | SH逻辑配对 | 两眼T+SH总逻辑配对 | 每路draw /总数值draw |
|---|---:|---:|---:|---:|
|+.70|396×1728=684288|396×1728=684288|2052864|2map+1reduce /9|
|+.85|515×1740=896100|515×1728=889920|2682120|2map+1reduce /9|

即使逻辑配对少于1m，精确矩形因跨行拆分仍是两map，不是“一map”猜测。全局constructor保持SourceT18000/4096、SH14000/4096和现有4m/1m/8政策，旧maxPairs/maxBakePairs1,048,576参数不改。实际当前两眼数量不符合闭合CPU计划就在GL前拒绝，不截行、不删packet、不改sampler/分辨率。+.70优先是较小且仍明亮的相位；powered-bees仅32vector motor+160 native scalar，不能当三芯配方视觉证明。

新helper必须重建完整same-browser严格参考并做无GL正向复核；Node与浏览器双精度差异历史已知，不能任意epsilon或只比Float32当完整物理相等。保留全packet/material/ledger/fullcapacity顺序、body/层IDs、实际时钟与完整射线。原producer/采样/风历史、emit/drain顺序、灰尘质量和192族源均不得改变。

新只读/可恢复bridge沿R31所有权：原rig留在原parent/sibling位置仅隐藏；临时pair挂场景，短时body.inert和controls关闭；独立fresh SH bake一次、每眼fresh SourceT各一次，T立即被对应FW消费，禁止CPU列fallback。环境为当前暂停场景，不宣称海浪和完整rAF持续模拟成本。

整帧保留原生1209×1292、实际reflection/refraction同尺寸/samples2、现有中档SMAA/temporal/MSAA等实际配置，不降画质。CPU inventory先证明完整生产photometry→water→lens/capture的辅助pass；可保留R31既有143draw/41render/19,279,476elements、10blit/5冷mip/32clear作为上限候选，但必须按新实际inventory与9个数值pass重新证实，不能直接当已通过预算。只做一个whole-query，**100ms不提高**；ready/nondisjoint后才读图，超时保留失败、无自动重试。

复用已核验的单采样LINEAR默认RGBA16F→ownedRGBA8 SDR blit路径，显式记录转换和6,248,112B读回；当前HDR1270设置应保存/恢复，但该画面只验证SDR合成，不能把WebGPU HDR呈现桥成本或HDR像素纳入GL query。所有新source/function pins包括sun-shadows、HDR策略、hdr-output、UI与新主入口，必须在创建GL资源前闭合。原native状态在resize/语义还原前恢复；原target对象重新分配、history失效、另行正常原场景presentation的边界保持。原音频hash和用户设置不变。

## 云密度真实sampler最小门：可行，但不能挤掉本轮明亮观察

`atmosphere.captureSnapshot()`已提供私有坐标/时间/vector值及共享immutable noise/weather纹理引用，默认排除transient光；`cloudShadowGLSL`是背景和地表共用的实际密度函数，含显式textureLod，CPU `cloudDensityAt`只承诺LOD0公式。可以将这些真实sampler、原uniform、原GLSL借给一个新的固定小probe，而不先render整场景或重造纹理。

probe应明确点集和LOD0/.4/1.25、基底连续性/云层外support，以及blend精确2和低于2的fallback。只在精确2端点消除legacy/thermal计算，保留weather/shape/detail/puff采样、LOD和原base连续性。当前mix/FMA可能使代数端点与storedFP32不同，先完整可逆源码及小R32F实际附件比对，保存差异而非自动放宽门。这个小probe不测整云或整场景提速，不占用明亮实景观察的证据标签；实现和actualGL均由另行准入负责。

只读依据：当前 `main.js` 的 public launch/pause、`frame` 与 `createR31SceneBridge`；`firework-layer-profile.js`；`pyro-smoke-trajectory-events.js`；`verification/r30-native-replay-fixture.json` 原updateTimes；`verification/r29-native-phase-camera-1event-counts.json` 低机位两眼计数（不与旧高机位 `r29-native-phase-count-scan.json` 混用）；当前 `smoke-transmission-layout.js` / `smoke-transmission-rectangles.js` / `pyro-smoke-light-tiles.js` 纯planner；`sky.js` 的snapshot/密度入口。本文件没有把历史计数提升为新版本GPU准入。
