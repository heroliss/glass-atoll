# R42：一次真实双发 native joint-pilot 帧

**仅方案，未运行 producer、oracle、浏览器或 GPU，未改生产。** 以 R41 封存 `790597c7…aaabd`（main `9b59c926…ee4a4`、FW `50895d4a…815d8`）为起点。先完成 **7.55 s、21 次数值 draw 的一个完整原生帧**，不在本轮扩展后期 33-draw 峰值或连续演化。

## 最小入口

沿用 `createR31SceneBridge` 的 owned pair 安装/恢复和 R31 native SDR 捕获方法，新增一个固定 R42 入口。使用当前生产 `createFireworks`、`createPyroSmoke`、`createSmokeTransmissionGPU` 和 `planJointSmokeWork`，不复制 kernel、不导入 R39 的 QA kernel 副本。

选择 **同步私有 owned-route flag**：bridge 增加默认 false 的显式 R42 选项；仅已安装 owned pair 的 `renderFrameSDR` 同步 body 内置 true，finally 恢复 false。它必须同时验证 qaRenderLock、已安装 FW/host/T field 身份、pair.time、context、paused、body.inert/controls 状态及无其他 diagnostic。全局锁不降为 false，不替换/伪造 `jointSmokeEligible`，不把所有 QA 自动当成正常 pilot；正常 caller 和旧 bridge 默认行为不变。

该私有范围让同一正常代码执行 `updateScenePhotometry(0,true)` 和 `renderSceneFrame({includeWater:true,sdr:true})`：photometry 的 `beginJointSmokePlan` 在首个 SH GPU prepare 前完成实际双眼 prepared counts/联合预检；随后 reflection T 即时消费、main T 即时消费、共享 SH 只 bake 一次。**不能沿 R31 旧 bridge 直接 water→lens 而绕过 `jointSmokeActive`**，也不在锁中调用公开 `setJointSmokePilot`（它本来拒绝锁且会重建 host）。无需在计数前 fake-render，也不额外重做一次 fill。

## 固定真实 pair 与 CPU 前置检查

下一轮才构建：constructor seed14271、origin `[29,0,7]`、N8，配置保存的 R37 FW settings（包含 radiant120、G16 与原长尾）；0 s seed42，推进到 2 s 后 seed43，再以原 20 Hz recipe 到 7.55 s。明确记录初始化与非零 151 个 `.05s` 前进调用，不强行把新 optical/request/ledger counters 凑成封存数值。

真实 host 使用 sourceProvider、logical-family-continuous、past-segment-v2、Brownian、central=.2、ground=.1、capacity4096、ellipsoid/tiled64；显式 light request12m/map1m/maps16。T field 同样为 18k/4096、旧 maxPairs1048576、显式12m/1m/16。不注入预制物理 state、SH 或 T，不新增 oracle；R39/R40 全量参考仍是历史数值证据。CPU 构建沿 R31 的有界 yield/取消方式，但不安装到用户场景，也不把事件交给 live audio。

原冻结 epoch 为 P1663、两眼各2418、SH2413。实际 prepared counts 采用**当前真实相机与水面 oblique projection**；主眼采用本次 lens focus 精确预测，镜眼保留它实际执行时的旧 focus（见 [focus/lifetime note](R41-PREPARED-VIEW-FOCUS-AND-LIFETIME-NOTE.md)）。记录完整物理快照/账本、launch receipts、counts 与当前 source/settings 身份；JS 引擎 binary64 差异不能用静默 epsilon、改时间或改 counter 掩盖。必要时以新浏览器完整捕获单独定性，不能覆盖 R39 原数据。

CPU 预检必须早于任何 SH/T prepare；失败明确不提交。private route 准备与实际消费使用同一 handles，首眼真提交才增加 requestVersion；field generation、ledger generation、optical generation 分开验证。R41 P=0 的 emitterMedium=null、no-active T=0、enabled SH cold-neutral2 等规则原样保留。

## 一次帧的预声明预算

固定 first-crossing 预期：主 T=4,021,134，镜 T=4,021,134，SH=4,012,819，联合 **12,055,087 pairs /12,091,520 padded64 slots /21 numeric draws**；每核6map+final。完整 private 数值输入按真实运行预检，不因输入不符而裁行。

| 项目 | 本次建议上界 / 条件 |
|---|---|
| main / reflection / output | 1209×1292，现真实 reflection samples2/scale1；不改变用户质量 |
| scene inventory | 替换 launcher 后 visible units≤35，原 opaque element envelope≤6,411,630；不符先停止 |
| 完整 native draw / renderer.render | **146 /44**：R31的143/41加3次数值 pass；不是33-draw后段预算 |
| index/vertex elements×instances | **19,291,677**：R31 19,279,476 +双眼新增 `(2418−1402)×6×2` +3 fullscreen×3；保守保留旧2301-volume额度，当前1663不扣减 |
| native 操作 | ≤10 blits、≤5 mipmaps（冷1+反射写4，稳定可4）、≤32 clears |
| 数值 owned storage | 单 borrowed T+SH **14,622,720 B**；不保留双眼到统一读回，不造两张 T |
| 捕获 | 一张 RGBA8、6,248,112 B；依已审 EXT 路径把实际 RGBA16F default blit 到 owned FBO，query后只读一次 |
| 时间 | 一次连续完整 query，**100 ms retrospective 上限**；ready/non-disjoint/健康后才读图；失败不重试、不临时加上限 |

数值+capture 规划20,870,832 B不等于总 VRAM；原场景 RT、纹理、保留的原 field/rig、CPU输入及 driver 开销另在场。预算须由本次只读 scene inventory 与 CPU plan 确认后封存，再由 root 唯一执行。R31旧配方单帧59.307 ms只是参考，后续阶段分析137.605 ms曾失败；均不能预报新双发帧或推导FPS。

R40延长计数到18.15 s显示：observed最大P4096、两眼/ledger各自最大2880（不同时间），联合峰25.273m、**33 numeric draws**，12m每job仍count-fit。这些独立最大不可笛卡尔拼成“同一峰值”。它们留给后续门；不得用本次21-draw frame通过外推全生命周期或持续多发成本。

## 安装、恢复与成功含义

像 R31 一样先保存原 FW/host/T field 引用、rig parent/sibling/visible、时间/风、frame/radiometry、相机/target、renderer/target/dimensions、lens/HDR、water phase、body.inert/controls；另保存 pilot bool、review-profile 标记和 pending/active/fault/last。原 pair 必须为空且没有 pending handle。owned rig 添加装饰后暂入 scene，原 rig 仅隐藏、不重挂；不调用会 dispose 原 field/host 的公开 toggle。

CPU yield 每次检查用户 fingerprint；安装后仅短同步事务 inert。最终先清 owned pending/active handles、撤销私有 route，再恢复原引用与 pilot 状态；恢复 inner native 状态必须在目标销毁/重建前，外层只承诺合法 Three 语义、尺寸/意图和健康，不承诺历史 RT handle/caches 位相同。保留原设置，不把 pair 的 source settings 写回用户。HDR/交互/controls 的独立 finally 保证；如 resize 或用户变化则取消并尊重新意图。

owned host/FW/T资源由其 owner 最后 dispose。原 empty-scene 正常 HDR 重建只能在计时、检查器卸载、状态恢复之后另行记录，不混进测量或在失败后暗中重画。实际成功须证明一份 fresh SH、两眼新 T 的匹配即刻消费、0 CPU transmission queries、正常全场景图像、计数/GL健康与用户恢复；这仍是一次 coherent fresh frame，不是稳定FPS、照片感或整体目标完成。
