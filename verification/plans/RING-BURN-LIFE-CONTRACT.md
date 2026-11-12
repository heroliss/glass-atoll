# Ring burn-life opt-in：批准的有界合同

默认 `emissionProfile:'two-births'` 精确保留旧输出；新增 `'ring-uniform-burn-v1'`，只对当前120根星笑脸生效。使用既有48代表根及其空间权重，不改发光源120根的 I/RGB/运动/RNG/音频。源参数固定 past-segment-v2 /48 /centralFraction.05；状态无需新算法。

- 整发预留20.35=发射.35+中心1+轨迹19。每代表根份额按其实际life均匀产生，不用亮度或strobe当物质率。
- 首格结束 `δ=.1+.2*u32(imul(bodyId,2654435761)+1013904223)/2^32`，后续格≤.30s，到原根life恰好结束；不调用RNG。GL5只查询已发生轨迹，将过去源点送至格末，同现有风/热/fullΣ/q闭合。格末才物化，延迟≤.30s。
- 最后格/最后代表根精确取剩余份额；无可表示内点的最终小格与前格重新分成两个有效格，不丢质量或放宽最大间隔。极大绝对时钟若不能稳定表示GL5内点，明确拒绝，不采未来/根死亡点。
- key含profile/eventId/bodyId/cellIndex；EmissionID只在ready后统一排序分配。launch时预留完整未来质量，不预计算未来XYZ/风。
- 既有prepare/commit、容量预检及异常部分提交fault-lock保留。clear先消费原批次，再取消整发尚未物化的预留并墓碑到最后计划出生；已物化的airborne/pending归物理clear账目。无年龄fade。
- ≤14格/代表根，≤684包/发，两发≤1368计划，保留2048计划/8192队列上限。33种子只读计划为617–633包（seed42=627）；正常.055s窗口实测计划最多22根格/110次GL5查询，这不是性能benchmark。旧烟保留仍可能触发现有4096容量merge，不能称原始轨迹细节不变。
- 默认模型不变。其他类型仅在**同一现代QA组合**内使用原two-births释烟，并明确标记non-ring-not-applicable；分裂子星和地面产烟不在本次改造内。

**不能直接推广为全类型生产默认。** 本QA host同时为past48、Taylor TL10、中心.05，与原生产各组合的差别不止ring时间分布。推广须event-specific选择，或保留清楚的experimental开关。先看I1真实动态、分段节拍、轨迹烟形和实际GPU/CPU成本；此模型为作者指定物质时间分布，不是化学产率或通用CFD。

所有旧默认字节由独立精确逆向校验；新增检查只针对质量预留、实际过去采样、分段时序、跨帧率、clear和失败事务。主main/host/renderer/光学/physics/audio不由本实现修改。
