# R39 同快照剩余参考

剩余镜面 SourceT 与烟团 SH 离线参考已完成；完整性检查 **6/6**。唯一 worker 用时 **47.709 s**，低于预定 180 s，没有重放物理、没有调用渲染器或 GPU，也没有修改已通过 MAIN GPU 门的原 artifact/helper/pins。

| 消费者 | 有序输出 | 完整 pair 数 | 离线参考 |
|---|---:|---:|---|
| MAIN SourceT | 2,418 | 4,021,134 | 原 artifact 完整 consumer 精确复制 |
| 镜面 SourceT | 2,418 | 4,021,134 | 独立真实镜面原始双精度射线，physical 与 packed-double 全行 |
| SH | 1,663 烟团 × 12 系数 | 4,012,819 | 全部 2,413 ledger sources，256 节点独立正 Laplace 积分 |

每个消费者保留 8 个原 64 项顺序的 partial 参考。SH 保留 9,504 个负 C1 分量，其中 3,703 个附件第四通道为负；没有以 alpha 或非负数截断。所有包围界检查通过；最大自身 group bound 比值 0.208703，角向最低值 3.43015e-7。选择的 512 节点复核与 256 节点最大归一差为 5.998e-16。镜面 original/packed-double 最大差为 8.58248e-7，镜面参考与 MAIN 不同。

新静态完整 artifact 为 `r39-dense-joint-fixture.js/.json`，导出 `R39_DENSE_JOINT_FIXTURE`、`R39_DENSE_JOINT_FIXTURE_DIGEST` 和 `r39DenseCanonicalJSON`。物理 snapshot、完整 ledger、事件、当前发光记录和原 MAIN consumer 均逐值、顺序及 canonical digest 不变。density tick 7.550000000000001 与 requested/source/ledger 7.55 的原有一 ULP 差、optical generation 156 与 ledger generation 51 的不同命名空间均原样保留。

首次完整性检查为 **5/6**：检查脚本错把真实字段 `captureMetadata` 写成 `metadata`，导致 canonical 序列器拒绝 `undefined`。原脚本和失败报告保留在 `baselines/r39-remaining-reference-check-before-fieldname-fix/`；只修检查字段名后为 **6/6**，没有重算参考或改 artifact。

新 artifact 的 CPU 参考完整，不代表 MIRROR、SH 或联合 GPU 已通过；`admittedNumericalJobs` 仍仅为历史 `main-source-only`。这不是整帧性能、全寿命峰值、视觉验收或默认 12m 生产预算的证明。原生产 4m 预算未变。

冻结值：

- JS：`cd73543e3fa9d86b1457cc0770289d57a01acce8e6c877485f329ec0da3918cf`
- JSON：`f6386b3c73870fabd2b3ffa48e85493c9fcb4557d0046311645500ece7a82ad4`
- canonical digest：`96780577818e0d25e0b31ba3dc207fec22db86abf66702380431eefe5c416303`
- generator：`a47aa562786b3a28a4cd02cf05f8ba8fbe12f4c0f42795bb1a6d4e252561618e`
- result report：`1457bfca4ba778d3b2e950a93d747bc226051577de4ce837908414d654b5a6ff`
- integrity script：`77207e4abf99c3710b6cbbcc00c4616b244c75de052cb60aa0d975565445273b`
