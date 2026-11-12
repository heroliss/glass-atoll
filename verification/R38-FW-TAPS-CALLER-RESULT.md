# R38：完整支持光学行的 taps-only 接线

FW `3f1093fa…0004605` 的 CPU 精确门 **5/5**。默认仍为 `summary`，没有浏览器/GPU测量或自动推广。layer writer 由独立 owner 实现，冻结为 `411ebd75…d948715`；其7/7及 Bounds 独立5/5是另两份证据。

生产接线仅新增静态导入、一个每实例模式分派及两处完整支持调用。两个年龄表达式保持左结合减法原字序；旧 `sampleBodyEmissionWindow` API、部分 contact/force 分段、每行独占 `Float64Array(24)`、所有 shader/上传公式均不变。反向移除这一小段接线逐字恢复归档 FW `03fdb703…d45c735`。

`getEmissionBinsMode()` 返回 `summary` 或 `taps-only`；`setEmissionBinsMode(mode)` 只接受这两个值。模式不进入 physics/settings。真正切换时先在当前 simulation.time 调用既有 `updateRecords()`，更换记录身份/递增 generation，清除旧行可命中的条件，然后改变模式；不推进物理时钟，不排空事件。重复设置同模式不刷新。旧 RGB 行仍保留原值，新 generation 不借用它们的输出缓冲。

实际 seed341070、radiant120、N8，在 +0.7/+1.7/+2.5 秒比较旧/新summary/新taps：完整1600/1728/1703行、24个原始taps、所有源/运动/曝光元数据、上界/采样估计、照明ledger、烟描述符和活动物理对象精确一致。两眼使用当前保存的 native1209×1292主相机，以及从生产水代码提取的实际 oblique reflection 构造函数。全部12种上传属性的完整预分配 Float32 数组逐字一致。CPU假 renderer 仅确认调用/数组，不创建 context 或提交任何GL。

另验旧五类profile、0x强度及25°低仰角/.25秒窗口；后两接触案例明确产生109和42条 partial contact 记录，仍消费未改的 contact sampler，完整输出一致。没有把空分支当作接触门通过。

## CPU 结果：小幅聚合信号，阶段间不一致

三臂分别为归档03fd直接调用、新summary、新taps；每阶段每臂3次预热不计入样本，然后3组 `old1/summary1/taps1/taps2/summary2/old2`，每组6次。共324条，更新记录在计时外，每条都包含新的首次 main bound、镜像 bound及两眼估计，未删除样本。

| 阶段 | old 首次均值 ms | summary ms | taps ms | taps / old |
|---|---:|---:|---:|---:|
| +0.7 s | 10.2640 | 10.1393 | 9.9531 | 0.9697 |
| +1.7 s | 11.8211 | 12.0121 | 12.0472 | 1.0191 |
| +2.5 s | 11.2633 | 11.6165 | 10.7908 | 0.9580 |
| 聚合 | 11.1161 | 11.2560 | 10.9304 | 0.9833 |

聚合首次中位数 taps/old为0.9664、taps/summary为0.9599，但拟议 +1.7 秒点的首次均值/中位数都没有改善。这是含 JIT/GC/调度和完整行构造的 Node CPU 结果，不是8.33ms全部来源已定位或 native收益证明。原基线单列可见新summary分派/编译环境的影响，不能仅用开关两臂宣称优化成功。Root 已因收益混合且不稳定而拒绝本候选，取消 native A/B，不推广；root 负责完整归档及两份生产文件的逐字基线恢复。此文冻结时默认summary，自动推广false。整体目标仍未完成。

脚本/原始结果：`r38-fw-emission-bins-check.*`、`r38-fw-emission-bins-cpu-abba.*`。未实施其他CDF/缓存/采样/物理/画质更改。
