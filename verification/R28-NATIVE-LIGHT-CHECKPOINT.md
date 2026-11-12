# R28：完整原生阶段的烟气受光已接入 GPU

2026-10-29，整体目标 **active**。本轮将同一真实阶段的 **755 个烟团 × 1728 个发光源**完整受光请求接入生产 GPU 路径，并修复失败计算误用旧缓存的问题。后段单枚烟花和连续积烟仍会超过当前预算，整场性能与照片感尚未验收完成。

## 已部署的改变

沿用原有 trace-isotropic Gaussian SH1 受光模型，将完整请求拆为精确矩形，保留全部发光源、原始颜色/亮度、烟团、64 项块内累加和统一归约。日常场景显式使用 **140 万完整配对 / 每 map 100 万保守槽 / 最多 8 map**。本轮固定请求为 1,304,640 配对，实际使用三块加一次完整最终归约。

三个 RGBA 浮点目标分别存储 RGB 的 C0/C1 系数；第四通道是带符号 C1.z，不能当作透明度裁掉。原 .32 各向异性和 .002 数值门保持。该模型计算烟团平均入射光，不包含光源到烟团路径上的完整烟影或完整各向异性辐射传输；没有将近似模型升级冒称为完整物理模拟。

旧 `maxBakePairs` 默认与正安全整数接口保持兼容，新增显式 `maxRequestPairs` 仅扩展 tiled64；serial-reference 比较路径不被暗中扩容。库默认 64 map 覆盖旧物理容量域的矩形碎片边界，日常三条 host 创建路径显式传入上述较小预算。新参数通过 host、体积 renderer 传到实际 field；没有更换体积 shader、烟花运动、烟量、寿命或已认可音效。

独立 CPU 见证复现了旧缓存问题：A 成功，B 在最终目标被写入后失败，再回到 A 可能复用已变成 B 内容的纹理。新实现会撤销失败代的 key、成功缓存和可见 field，恢复 A 必须重算。各 map/最终写入的失败及 serial/tiled 两条路径均已覆盖。

## 完整数据与硬件验收

本轮复用 R27 的完整真实密度快照和 **1728 行 emission ledger**；它与 SourceT 的 **1734 行光路**是不同消费者。没有用 SourceT 行冒充受光源，也未缩减源、烟团或参考行。

全部 **755×12＝9060** 个参考系数在 CLI 离线用独立 256 节点 positive-Laplace 积分计算；更高节点的选定复核收敛。浏览器只持有预先计算的完整参考，不在线执行全配对 CPU oracle。详见[数据说明](R28-NATIVE-LIGHT-FIXTURE.md)。

| 检查 | 结果 |
| --- | --- |
| 完整数据自验 / 独立复核 | [8/8](r28-native-light-fixture-check.json) / [6/6](r28-native-light-independent-check.json) |
| 候选实际 GPU | [4/4](r28-complete-native-light-actual-gpu.json)，1 prepare / 4 draw / 36,624B |
| 实际部署 GPU | [4/4](r28-production-native-light-actual-gpu.json)，同一完整数据、构造参数和绘制预算 |
| 最大 C0 / C1 向量误差，按每烟团参考峰值 C0 归一化 | **3.5659e-7 / 5.9865e-7**，低于原 .002 门 |
| signed C1 / 正角向值 / 光照上界 | 2973 个负分量保留；全部有效行与逐烟团、全局上界通过 |
| 候选与部署输出 | 全部 **9060** 最终词及 **96** 个采样 partial 词的 Float32 数据一致，0 变化 |
| 生产结果独立审计 | [7/7](r28-production-native-light-actual-independent-audit.json)及[5/5](r28-production-receipt-independent-check.json) |
| 实际部署调用链 / 根代码审查 | [6/6](r28-deployed-integration-independent-check.json) / [4/4](r28-production-root-audit.json) |
| `npm run check` | exit **0**，见[日志](r28-runtime-syntax-check.log) |

候选 GPU 0.92672ms，部署 GPU 0.786432ms；CPU 提交约 26.8 / 26.7ms。这是两个各一次、含首次上传/可能编译及 QA 包装的独立数值任务，**不是 A/B 提速、纯 CPU 算法耗时或整帧 FPS**。完整固定数值分配 1,966,080B，输入缓冲 516,096B；不是整进程显存测量。

每个硬件门仅三块 map 和一次完整 4096 行 MRT3 最终写入，直接读取全部 755 个有效烟团和八个 partial 格点。未在四次绘制里夹带参考 GPU、体积消费或正常场景绘制。最终零后缀由固定 shader、完整 viewport 及 CPU 零/缓存测试保持，未逐像素读完整零后缀。

所有声明的原生/Three 绑定状态、上传状态、描述符与资源所有权恢复；两次硬件门 GL/shader 错误为空。25ms 整次 timer 门是事后判断，不能抢占已排队的块。使用已有 renderer，未创建新图形上下文，未做多发烟花压力测试。

候选的数值对象经过 CDP 按值传输，少量十进制有极小 binary64 序列化偏差；原回执未改写。独立审计以小于 4 epsilon 且远小于半个 Float32 邻距的界证明唯一最近 Float32。生产回执改为页内 `JSON.stringify` 原文保存，9060 个有效值及 partial 均无 Float32 解析漂移；没有因此放宽 .002 光学误差门或声称原按值传输保留 signed-zero 位。

## 生命周期结果改变了下一步

[当前 N8/contact 生命周期研究](R28-NATIVE-LIFETIME-COUNT-STUDY.md)检查 203 个光学时刻，重复运行与 R27 +1.18s 完整输入一致，仍无密度合并。采样峰值分别为：

- SourceT：**2,243,416** 配对，爆开后约 +2.70s。
- SH 受光：**3,219,099** 配对，约 +3.90s。
- 同一采样时刻的联合需求：**5,157,272**，约 +3.85s；两个核不能按等成本相加估计时间。

该机位倒影行数始终 0，不能代表其他机位；这些是采样最大值，不是连续时间峰值或多发负载证明。历史约 3.986m 属于不同 N10/no-contact 夹具，未冒称本轮峰值。因此 **1.4m 只修复当前中间阶段，仍未覆盖完整单发后段**。

下一步按[完整生命周期与联合门方案](plans/R28-NEXT-N8-LIFETIME-JOINT-GATE-INDEPENDENT.md)验证实际后段、更大完整请求和同代主/镜/受光联合成本，再测推进中的场景与积烟。现有 `benchmarkFrozenSmoke` 的 delta 为 0，SH 可命中同 key 缓存；它的 FPS 不能代表新鲜受光计算或动态性能，下一步需要记录真实代变化、`reused:false` 和 bake 计数。

## 历史失败与恢复

未修改原测试断言。旧 field 套件当前与精确旧基线均 **13/15**；旧 tiled 套件当前 **3/8**、旧基线 **7/8**。四个新增失败来自旧 fake GL 缺少新的标准 `isContextLost`/状态接口，另一个几何/源文本夹具差异及 field 两个历史 normalizer/诊断形状差异早已存在。分类见[报告](R28-LEGACY-LIGHT-ASSESSMENT.md)，**不称旧套件全部通过**。当前失败报告与原断言的基线重跑均保留；本轮对这两份历史 JSON 没有预运行备份，不伪称已有备份。

CPU 夹具别名、换行、provider 形状和十进制断言的中间失败均归档。最初晋升命令因 Node 混用 require/顶层 await 在解析时退出，未执行写入；随后用保存的 ESM 脚本完成晋升。没有因这些夹具或命令问题重复 GPU 或修改物理误差门。

用户设置、机位、时间、灯光与界面[28/28 精确恢复](r28-user-restoration-check.json)，自动 HDR 派生峰值本轮 700→700；最终 console/GL 为空，program/VAO 有效。服务 `127.0.0.1:5186` / PID 23820 未重启，主场景与原高清对照页保留。[恢复截图](r28-restored-ui.png)仅证明原夜间暂停状态，不作为新照片感验收。

源码、备份和回执见[r28-final-manifest.json](r28-final-manifest.json)。后段/积烟性能、烟尘尺度与受光层次、烟花编排、冲滩、水花暗边、天际带及整体照片感仍待完成；不重试已撤回 aerial9bb / splash a9、e21，不改已认可主爆音效。
