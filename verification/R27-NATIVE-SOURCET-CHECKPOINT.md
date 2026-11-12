# R27：完整原生烟尘遮光已接入 GPU

2026-10-29。整体目标 **active**。本轮解决了一段真实负载因超过旧预算而退回 CPU 的问题；烟尘受光、连续积烟、整帧性能和整体照片感仍在推进。

## 实际变化

日常烟花的 SourceT（从燃烧点到相机的烟尘透射）现在支持完整请求最多 **1,400,000** 个源/烟团配对，旧值为 1,048,576。一次请求按精确矩形分块，每个 map 最多 1,000,000 个保守槽；所有块完成后统一求和并计算透射率。没有删除烟团、减少光源、降低烟量、借用上一帧结果或修改光学公式。

旧 `maxPairs` 参数和默认兼容，新上限通过显式 `maxRequestPairs` 提供。日常调用还显式设置 `maxMapDraws:8`；这个值覆盖原预算内一个需要四块的边界，避免新路径反而引入回退。完整容量证明和旧接口对照见[部署验收](r27-deployed-transmission-check.json)、[策略独立复核](r27-active-policy-independent-check.json)及[调用链复核](r27-deployed-integration-independent-check.json)。

生产改动限于四个透射/布局模块、main 的默认配置及两个独占 QA 入口、package 的语法检查列表。烟花运动、烟尘物质量/寿命、体积绘制与已认可主爆音效保持原实现；代码范围见[根审查](r27-production-root-audit.json)。当前仍为 **Three r180 / WebGLRenderer**，可选 WebGPU 仅承担 HDR 呈现桥。

## 完整真实负载

使用真实 CPU 生产者与原生相机/水面镜像提取重建并冻结数据，没有凭空制造计数。物理快照包含 **755** 个完整 SPD 烟团。该阶段三个消费者分别为：

| 消费者 | 有效行数 | 逻辑配对 | 本轮结果 |
| --- | ---: | ---: | --- |
| 主视图 SourceT | 1,734 | 1,309,170 | 完整候选及部署工厂均通过实际 GPU |
| 倒影视图 SourceT | 0 | 0 | 原生可见性裁掉，未制造额外派发 |
| 烟气受光 SH1 ledger | 1,728 | 1,304,640 | 完整输入保留；现有独立预算仍拒绝，尚未 GPU 验收 |

主视图的 1,734 条光路与受光 ledger 的 1,728 行不同，不能混用。合计 2,613,810 配对只是两个不同核的需求总数，不是等成本或整帧通过证明。

全部 1,734 行的原始物理及 Float32 打包双精度参考值均在 CLI **离线**计算，浏览器派发时不做全配对 CPU oracle。每次硬件门只派发同一完整请求：三块 `(256×61, 256×20, 72×1)` 加一次完整归约，读取全部输出和七处块边界 partial，总计 **27,856B**。所有权、来源和失败记录见[原生夹具说明](R27-NATIVE-TRANSMISSION-FIXTURE.md)。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| [完整候选 GPU](r27-complete-native-actual-gpu.json) | **4/4**，1 prepare / 4 draw，GPU 0.468992ms |
| [实际部署 GPU](r27-production-native-actual-gpu.json) | **4/4**，1 prepare / 4 draw，GPU 0.853696ms |
| 全部 1,734 输出对物理 / packed-double 参考的最大误差 | **1.6362e-7 / 9.6400e-8** |
| 候选与部署版本 | 全部 **6,936** 输出词和 **28** 个 sampled partial 词逐位一致 |
| [部署回执独立复核](r27-production-native-receipt-independent-audit.json) | **8/8** |
| [另一独立回执复核](r27-production-actual-independent-audit.json) / [实现方复核](r27-native-production-actual-read-audit.json) | **5/5 / 6/6** |
| [部署及原接口检查](r27-deployed-transmission-check.json) / [调用链独立检查](r27-deployed-integration-independent-check.json) | **6/6 / 6/6** |
| `npm run check` | exit **0**，见[日志](r27-runtime-syntax-check.log) |
| 用户设置、机位、时间、灯光、UI、显示意图还原 | [**28/28 精确**](r27-user-restoration-check.json)，本轮自动派生 HDR 峰值前后均 700 |

两次硬件门均使用现有、暂停且独占的 app renderer，分别普通 reload 后验证；没有创建第二图形上下文，没有多发烟花压力测试。全部声明的原生/Three 状态、描述符和资源所有权恢复，GL/shader 错误为空，最终 console 为空。服务仍是 `127.0.0.1:5186` / PID 23820，未重启。

上述 GPU 时间来自两个各一次、带 QA 包装的完整数值任务，**不是同工作量 A/B 提速结论**。CPU 提交分别 25.2ms / 18.3ms，包含打包、上传、包装和可能的首次编译；不是纯 CPU 算法耗时。四个 draw 同步提交，25ms 查询门只在事后判定，不能取消已经排队的块。完整固定数值分配 2,056,192B，CPU 输入缓冲 1,126,400B；这些不是整进程显存/内存测量。

## 保留的失败与限制

旧 R16 packing 套件本轮 **7/8**；它要求 14,001 行抛错，而精确的改动前生产基线早已支持 18,000 行，同套断言对该基线也为 **7/8**。因此是既有陈旧断言，不能称旧套件全部通过，也未放松断言。R17 admission **12/12**、R23 layout **8/8**；见[旧测试评估](r27-legacy-recheck-assessment.json)。

初次夹具捕获的 typed-array 序列化问题、独立夹具 schema/buffer 假设错误、生产 helper 构造参数尚未与真实调用一致的中间失败均保留。最终版本修复夹具/包装后分别复核；没有通过降低误差门或缩减原生数据制造绿色结果。

**仍未完成：** 超过 1.4m 的后续/积烟 SourceT；独立 SH 烟气受光预算；主/镜/受光与体积填充的联合帧成本；持续运动/连续燃放；烟量尺度、受光层次与编排、冲滩、水花暗边、天空侧天际带和整体照片感。没有声称密烟卡顿全部消除或达到 60FPS。1m/1.4m 是当前工程验证范围，不是用户永久限制。

## 下一步

按[独立 SH 方案](plans/R27-NEXT-EXACT-SH-GATE-INDEPENDENT.md)直接复用完整 **755×1,728** ledger：离线全部 755 行、12 系数参考；沿用已验核及三个 MRT，精确三块加归约；不重启微型合成测试。保持 signed C1、原 .002 误差门和完整零后缀约定。通过后再审查正常调用与体积消费。

随后先做当前 N8/contact/机位配置的 CPU 生命周期计数，再测完整正常帧和累计烟尘。历史约 3.986m 峰值属于不同 N10/no-contact 夹具，不能冒称是本轮配置峰值。继续按实测校准更大预算与精确优化，不重试撤回的 aerial9bb / splash a9、e21，不改已认可音效。

源码、当前/历史报告与备份哈希见[r27-final-manifest.json](r27-final-manifest.json)。[恢复后的界面](r27-restored-ui.png)仅证明原夜间/暂停设置恢复，不作为照片感验收截图。
