# R17 frozen benchmark guard 独立审查

只读审查 root 第一版 `benchmarkFrozenSmoke` / `frozenWorkloadInfo` / frame guard / finally。root 正在修订 main，因此此文记录被审查版本的行为，而非声称最新修订仍存在全部问题。没有运行 GPU、创建 context或修改运行文件。

验证方法：从当时实际 `main.js` 提取 benchmark 方法及 frozenWorkloadInfo，在内存中注入纯 CPU stub；实际方法控制流不重写。五个有界场景均复现。没有调用 renderer、执行 shader或写入临时运行文件。

## 修订后的复核结果

root 已将 setup 纳入 try，加入 interactionEpoch / pauseIntentEpoch，签名包含稳定的 local lamp/flashlight 配置，await后再次核签名，finally尊重contextlost和显式pause/发射/投掷意图。

新增独立 CPU 提取夹具 `verification/r17-frozen-benchmark-guard-check.mjs`，实际运行 **7/7 passed**：原五个反例全部修复，另验证无干扰时正常完成/恢复原pause，以及只有action epoch变化也会废弃。未导入 main 模块、创建DOM/renderer或执行GPU。被测 main SHA256：`f67a56ab130524855fe15c05ebfdea96a0252aa9c50fec89fdb093bad37326e0`；提取method+signature+public pause摘要：`86d989f616ca535061300f92d7c56bf57d67e26e9dfa61b0bb07aaabea482c4b`。后续root改源码后可重跑此轻量夹具。

以下表格保留为第一版历史问题，不代表修订版仍未修复。还应处理的窄边界是 visibility/其他QA占用：frame会在document.hidden/qaRenderLock时于guard之前early-return，而timeout自身仍可报valid；可在visibility change取消并在结束时核hidden/lock/最低有效帧数。本夹具没有模拟真实DOM事件派发或原生FPS，不能替代实际UI/GPU验收。

## 必须修复的控制流

| 严重度 | 场景与实际观察 | 原因 | 最小建议 |
|---|---|---|---|
| P1 | setup 的 projection setter 抛错后，qaFrozenWorkload=true、paused=false、qaCameraExposureEV仍为临时值 | 改状态与模式 setter / updateScenePhotometry 在 try 之前 | 校验参数先做；所有已开始的临时状态变更纳入同一个 try/finally。before可先声明为null，清理不能依赖 setup已完成 |
| P1 | 原 paused=false；contextlost handler设 paused=true并 cancel；finally最终变回false，workload.interrupted=false | 外部 cancel没有将 guard.cancelled置true，finally仅按该flag判断。contextlost不是签名diff驱动 | 统一取消入口并记录reason；finally优先保持 graphicsContextInterrupted 下的 paused=true，不允许临时状态恢复覆盖故障暂停 |
| P1 | 原 paused=true；benchmark临时写false但UI仍显示暂停；用户点“继续”仍写false；签名未变，完成后 finally写回true | 值相同不能证明没有发生用户意图；现launch/throw计数只覆盖两类显式resume | 独立 pauseIntentEpoch，在 onPause / public pause / 用户发射与投掷等显式意图处同值也增加。仅当epoch未变时还原benchmark自己的临时pause；不能仅看最终布尔值 |
| P1 | 最后一次 RAF之后、timeout完成之前改 current，返回 completed/valid、interrupted=false，却有 before≠after | 签名只在下一 RAF顶部核对，timeout可以先完成 | await返回前再次核对最终signature/epoch，并将结果置invalid。真实输入发生时立即cancel更好，不能只依赖下一帧 |
| P2 | 改 localLights亮度/颜色，冻结签名仍相同，返回valid | signature只有parameters，没有独立localLights状态；类似nightSettings、leaf/debug等也有外部状态 | 增加真实用户 action epoch，或把图像相关状态全部纳入签名。不要依靠无限扩展脆弱的手工字段表 |

其他应补的边界：

- `document.hidden`、qaRenderLock、contextInterrupted当前在签名检查之前 early return；隐藏3秒可让timeout报completed但没有有效新帧。visibility/其他诊断占用应取消，或最终以实际有效帧数/状态拒绝。不要将0帧completed当有效性能证据。
- 用户主动操作可以被允许继续；cancel只是废弃测量，不应撤销用户的相机、灯光、发射或设置。输入发生时记录epoch可同时减少每帧深拷贝/JSON工作；最终签名仍保留作双保险。
- `paused=false`是benchmark的内部执行细节。UI无需假装场景已正常播放，但用户点击“继续”的意图必须立即接管；用独立pause intent明确区分二者。
- `result.status !== 'completed'`、guard.cancelled、签名变化、contextlost应共享invalid处理。不能从一个cancelled结果的完整统计数组再抽出FPS当有效值。
- before/after 包含 camera rounding到1e-8，并非逐字节相同输入证明。若描述为strict same input，应保存原Double值；若保留容差，就明确该容差而非声称exact。
- projection/bake模式是否在调用后保留属于API契约选择；若函数负责临时切换，应以独立版本/所有权条件恢复，不能覆写用户中途新选择。当前第一版没有保存旧模式。

## 建议的最小状态所有权

1. 保存原pause与QA exposure及其意图epoch，建立本次run token。
2. try内设置临时freeze/曝光、执行准备，再创建before/signature并启动。
3. 统一 `cancelFrozen(reason)`：标记token invalid、存reason，cancel renderBenchmark；不修改用户场景状态。
4. 捕获实际用户操作和pause意图，检查visibility/context/其他诊断；用户操作同值也能取消。
5. await结束后核最终signature/epoch、有效帧数与context；不同即返回invalid，而不是仅把after附在valid结果旁。
6. finally解除本次freeze。contextlost保持paused；用户pause意图未变时才还原原pause。对QA exposure/模式也采用同样的“只恢复自己仍拥有的临时值”原则。

这些是最小架构建议，不要求在控制函数内阻止用户操作，也不要求增加审批。

## R17 方案交叉审查：第一优先项

已读 `r17-graphics-performance-audit-plan.md`、`r17-sky-environment-engine-plan.md`、runtime admission handoff及纯burn profile handoff。

**先修测量guard并完成新 scalar pack / active-partial 的原生paired接收。** 旧 profile前3.6秒中 pack main+mirror inclusive占约35%是直接证据；后续水/云/MRT成本还没有逐pass硬件数据。失效的79.78FPS样本已排除，不可用它作CPU对照。

root 后续已保存 `r17-native-two-interleaved-benchmark.json`：同一time79.6972、48包，主镜各3456源，GPU→CPU→GPU三窗分别16.83 / 3.45 / 18.24 FPS，workload.interrupted=false；GPU窗query=0，CPU窗各3456。此为同冻结工作负载的直接方向性证据，不能和先前不同物理快照的绝对FPS混比，也未证明连续运动或所有机位达到60FPS。

下一项低风险源码候选是 **相同天体输入不破坏CPU天空照度cache**：main每rAF调setCelestial，sky.js的setCelestial无条件清skyLightingKey，lighting再算solar/moon各16方向×8段。保持相同输入与原积分，能精确减少冻结/重复输入工作；正常运动的命中率/毫秒仍需测量。

反审重点：现cacheKey使用 `toPrecision(7)`。仅删除清空会让不同Double输入合并，不能称逐值等价。应使用完整精度依赖tuple/精确比较，并在 changed input继续重算；withSnapshot finally恢复同一tuple。不能只按UTC秒或P缓存。已将此意见反馈给sky方案作者。

WebGPU迁移、几何LOD、焦散domain、云重建、MRT/pass压缩是后续分支：目前有明确源码工作量和迁移理由，但没有证明它们是当前最大瓶颈的硬件数据，优先级不能越过已测CPU热点。

## 另项短审：runtime GPU admission

`smoke-transmission-admission.js` 的PACK布局与恢复顺序未发现具体问题：读前unbind PBO，alignment4、rowLength/skip0，4×1RGBA32F为64字节；恢复先绑定原DRAW再drawBuffers，原READ再readBuffer。dispose后再stateEquals是合理检查。此结论仅为只读状态审查，实际GPU由root验收；所列状态相等不是对所有program/VAO/texture bindings的完整证明。
