# R40 检查点：完整双眼与共享烟气受光数值门

R40 完成了同一真实双发快照的镜面 SourceT、SH 和三消费者联合 GPU 验证，并加入了生产 FW 的私有 prepared-view 交接接口。**正常 main 尚未调用该接口；日常 4m/8maps 未提高，超过预算的 CPU/coarse 回退尚未移除。整体目标 active，完整帧性能与视觉验收未完成。**

## 实际 GPU 结果

沿用 R39 冻结的真实 radiant120 双发：1,663 烟团，主眼与镜眼各 2,418 条有序光路，SH 使用另 2,413 个 ledger sources。请求时间 7.55，committed tick 7.550000000000001；optical generation 156、ledger generation 51 与两眼 request 101/102 保持各自命名空间。三项共 **12,055,087** 完整配对，没有删源或删烟。

| 本轮单次任务 | 实际验收 | prepare / draw | 全量及 partial 读回 | 单次 GPU 时段 |
|---|---:|---:|---:|---:|
| 镜面 SourceT | 4/4 | 1 / 7 | 38,816 B | 0.937984 ms |
| SH 受光 | 4/4 | 1 / 7 | 80,208 B | 2.622464 ms |
| 主眼 T + 镜眼 T + 共享 SH | 6/6 | 3 / 21 | 157,840 B | 2.196480 ms |

原始回执为 [mirror](r40-dense-mirror-actual-gpu.json)、[light](r40-dense-light-actual-gpu.json)、[joint](r40-dense-joint-actual-gpu.json)。独立保存数据审查 [6/6](r40-dense-actual-independent-audit.json)，没有另跑 GPU 或大型 oracle：检查全部两眼输出、全部 **19,956** 个 SH 系数、每核 8 个实际 partial 地址、signed C1、角向/逐包/全局界及状态恢复。镜面最大 physical T 误差 8.914e-7；SH 最大 C0 / C1-vector 归一误差 5.391e-7 / 8.916e-7。联合与单核恢复出的 Float32 词保持相同，两眼结果确实不同。

三项均为独立的顺序数值任务，计时不可相加，也不可互作 A/B。CPU 提交 21.6 / 20.8 / 75.4 ms 包含冷编译、打包、上传与检查。它们没有正常水面、体积填充、场景、镜头或 HDR 呈现工作，**不是完整帧 FPS、连续多发或照片感验收**。私有联合门持有两张 T+一份 SH，数值分配 19,329,024 B，不是驱动显存测量；正常即时双眼消费方案只需一张 borrowed T。

23 个 source pins、17 个 cached functions 绑定通过；GL/shader errors 为空，检查器描述符和受支持 Three/native 状态恢复通过。页内数值门后保存的 [状态](r40-user-state-after-numeric.json) 为空场暂停、0 active/queued/smoke、GL 空、原 program/VAO 有效。最终用户完整设置恢复与封存由本轮 root 回执另行记录，不把单个数值门的恢复代替整场景验收。认可的 `fireworks-audio.js` 仍为 `4e5ede41…ec31`。

## 首次 crossing 之后的实际负载

新一次 CPU continuation 使用同 seeds42/43、0/+2 s 发射、N8、风场与真实 oblique 镜面，相比 R39 的 20 Hz 物理 capture，本次明确为 **60 Hz 物理 / 20 Hz 光学采样**；不是旧 artifact 的逐值重标。唯一 worker 15.405 s，1,090 updates、263 epochs，到 18.15 s；不计算数值 T/SH、不运行 GPU。[raw](r40-dense-lifecycle-count.json) 与 [有限审查 5/5](r40-dense-lifecycle-read-audit.json) 保留。

- 每眼 T 采样峰值 **8,426,298** pairs：9.45 s，P=3,678，N=2,291。
- SH 峰值 **8,421,700**：9.50 s，P=3,710，ledger N=2,270。
- 联合峰值 **25,272,520** pairs、**33** 次新鲜数值 draw；每 job 最多 **10 maps**。各峰值均发生在 merge=0 时。
- 现有 4m/8maps 在 7.55–10.95 s 的 69 个 epoch 拒绝。QA 12m/16maps 的纯 count model 覆盖全部采样；它没有私有 epoch 所有权，reservedWork=0，不能据此获得生产执行许可或普适上限。

10 s 后原生产容量合并开始；终点为 4,096 烟团、755 merges（568 forced）。完整 384 个逻辑 body 的参考烟量 40.7 全部释放、future=0、remainingCells=0；没有用清烟或减源消除成本。全寿命并非“完全未合并”，熄光后 4,096 烟团的体积填充也不等于零成本。raw 中 generic neutral draw descriptor 与实际 SH cold-zero 的区别已由 [既有 planner 的后置计费](r40-dense-policy-accounting.json) 明确校正，正源峰值不变。

## 生产交接已做、正常场景尚未启用

`fireworks.js` 当前 `50895d4a…815d8` 提供 `prepareSourceView`、只读 `getPreparedSourceViewInfo`、幂等 `discardPreparedSourceView` 和 `render({preparedView})`。单一准备路径保留原 optical rows/culling/stable sort/original-double rays，实际镜眼→主眼只在提交时递增 request sequence。过期、跨实例、重复消费在 renderer/透射查询前拒绝；prepared unsupported 不转 CPU fallback。storageEV/sceneScale 可在 photometry 后更新。每实例最多 4 个 pending handles，丢弃/消费释放私有大引用。

[owner CPU 6/6](r40-prepared-view-check.json) 与 [独立源码审查](r40-prepared-view-independent-source-review.json) 通过：旧默认、新默认、新 prepared 的 R39 实际两眼原射线、12 个有效光栅属性、排序/taps、每眼完整 281,600 个 packed U32、ledger/provider 相同。原 shader/material 源区 13,063 B 精确保持。旧默认 fallback 合同未改；main 当前 `388afa4f…6674f` 只有固定 QA 入口，尚无 live prepared/preflight 调用。详细范围见 [实现说明](r40-prepared-view-implementation.md)。

失败原件仍在：数值审查最初误读 bound shape 的失败、neutral key 检查失败、被 Three 重算的无效 inverse-matrix 测试及补 discard 前版本均未覆盖。没有放宽原数值门、提高正常请求预算或改认可音效。

下一步按 [R41 live integration](R41-LIVE-INTEGRATION-PLAN.md) 接真实两眼时序和联合预检，再做一个完整新鲜场景事务；先解决实际 >4m 的不可控回退，不以较早数值时段推导 30/60FPS。烟花尾迹/烟云地表受光、视觉编排、真实水面接触、冲滩/水花暗边、天际与总体照片感仍待完成。
