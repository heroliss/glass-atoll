# 原版光学构建归因：一次有限 CPU 运行

状态：**只读诊断，没有优化实现**。脚本/完整报告为 `verification/r39-optical-construction-attribution.{mjs,json}`；`r39-original-fw-instrumented.js` 只是验证源副本，经内存 import 重定位后使用，应用不导入它。

原版 FW 严格锁定 `03fdb703…c735`，当前生产已恢复相同字节，layer 为原版 `41124296…c537`。沿用已保存的 R38 actual-factory CPU fixture：192 根 radiant、seed341070、N8、真实 terrain/bounded air surface、117°/78°固定配置、固定原生相机及实际水面斜裁切镜像、固定风。这里不是原浏览器发射轨迹或 V8 物理状态逐位重放。

预定三臂只有原版、相同插桩但只计数、计数+整函数/粗块计时；每个 +0.7/+1.7/+2.5 物理阶段做六次新 recordsGeneration，交替臂顺序。重复同一已提交时刻，不推进物理时间。共 54 个 case；总进程 **1.67 秒**，没有调参后重测、浏览器、GL 或 GPU。三阶段全部完整光学行、上界结果及物理/接触诊断与未插桩版本 deep-exact（行数 1600/1728/1703）。

## 首次工作确实由主视图承担

| 阶段 | 原版首次主视图均值 / 中位数 ms | 原版缓存镜像均值 ms | 首次 RGB 窗口 | 首次真实过去锚点 | anchor cache 请求 |
|---|---:|---:|---:|---:|---:|
| +0.7 | 13.454 / 13.044 | 1.494 | 1600 | 1600 | 4416 |
| +1.7 | 11.951 / 10.251 | 1.050 | 1728 | 1728 | 4800 |
| +2.5 | 12.961 / 13.441 | 1.497 | 1728 | 1728 | 4780 |

镜像每阶段只出现 contact-row 缓存查询与相机投影计数，**没有** RGB-window、contact-support resolve 或 motion anchor 调用。+1.7 首次锚点的实际运动为 192 次头部和 1536 次尾部场采样；同时有 1728 次 contact support 检查、3456 次 FW 级 exposure 构建。尾部相邻节点的 4800 次请求已经被现有锚点缓存压到 1728 次实际过去姿态，不能再把所有请求当成重复运动积分。

这与保存的原生 91 帧 `8.333ms/0.800ms` 不矛盾：本表是不同引擎环境/固定阶段/CPU fixture 下的新诊断，不能替换原生数值或声称帧率。它确认的是首次与复用的工作结构。

## 粗计时能说什么

+1.7 计时插桩臂的嵌套 inclusive 均值：RGB window **2.730ms**；anchor-cache+past pose **3.400ms**；contact support **0.767ms**；projection **0.386ms**。RGB 大块（数组+窗口+尾部换色）inclusive 为 3.838ms，其中窗口以外 residual 约 1.108ms；optical-row 其他 exclusive residual 约 2.947ms，包含缓存、stretch、对象/数组、验证、包装和 JIT 开销，**不是纯分配耗时**。父子 inclusive 不能相加。

插桩干扰明显：+1.7 首次段计时臂减计数臂 **+1.827ms**；+0.7 首次段计数臂减原版却为 **−1.795ms**；+2.5 update 差为 **−3.851ms**。完整报告保留有符号差值，不夹成零，也不把这些数从类别时间中扣掉“校正”。`performance.now`、函数包装、嵌套表和对象操作会改变内联/GC/调度；这里没有每个标量操作的计时。不能据此认定某个小算式吃掉整个 8.33ms，更不能把未来候选节省量直接算出来。

当前 update 阶段还确认旧 envelope 在 radiant 尾部循环被调用 1408/1536/1536 次，其结果在 profile 分支不用；这是已有死计算线索，发生于 update，不是首次上界段。本次没有顺带改它或 CDF。

## 排除一个看似很大的新机会：这里已经有 wind memo

原版 `fireworks.js:833` 的 `getRadianceBound` **整个函数体已经包在 `withWindResponseMemo(simulation.windTimeline,()=>{…})` 中**，首次 `opticalRows` 迭代、contact、anchor 和 `sampleTailReleaseFieldNode/sampleBody` 都同步处在此作用域。实际 helpers 收到同一 timeline，且同一个文件 URL 的 wind module 被复用。

因此，“updateRecords 有 memo，但被测首次 optical constructor 没有”对这条正常主视图路径不成立。再包一层只会建立独立嵌套缓存，不能补一个不存在的空缺。未包 scope 的直接 `getFramingSources` 或 render-first 公共用法确实存在，但不是这次正常 main 上界先行的调用顺序，不能拿来解释现有热段。当前 `windResponseDiagnostics` 是前缀 checkpoint 诊断，不提供 bulk scope 命中率，不能把它的零 prefixQueries 当成没有 bulk memo。

## 一个可执行的下一候选，仍需承认不确定性

若下一阶段继续优化 FW，建议只研究 **generation+shutter 级完整光学行缓存，替代两个按新 p 建立的小 Map**，先不改锚点缓存、曲线数学或数组所有权。当前每个新物理 generation 的 1728 条 profile 记录都会新建 contactViewCache 的 Map 和 opticalViewCache 的 Map；约 **3456 个 Map/generation** 及两层逐行查询是源码确定的工作，处于刚测到的 cache/row residual 与镜像复用路径中。下一候选可用一个至多四 shutter 的 generation 表保存完整、已构建的 row 列表；主视图构建一次，镜像/estimate/upload 复用相同 row 对象与 rgbTaps，而非修改或池化旧数组。

这是比再次删 summary 算术更接近结构性成本的候选，**但本次没有测出这 3456 个 Map 的独立毫秒，收益仍未解决**，不能承诺推广。最先做的 CPU 门应是：完整源/光学行与上传 exact；四 shutter 上限、±0、缓存清空、generation、mode/quality 失效；旧迭代器保留的数组/对象不可被后代重写；includeSmoke 与次序保留；黑行/null/部分 contact/powered 分段不丢失；同步回调、错误的先后与原来的懒迭代行为不能被悄悄改掉。若将当前懒构建改为 eager 后无法保持公开 callback/异常合同，应停在未解决，不为了性能放松它。

在这些合同能闭合以前不实现此候选；没有证据支持新增 wind memo、减少时间/空间采样、换 shader，或再次推广已拒绝的 taps-only。生产、音效与所有旧记录在本次运行中保持原哈希。
