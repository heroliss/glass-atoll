# R40：延长真实双发计数与最小生产接线建议

唯一 CPU worker **15.405 s** 完成固定 0→18.15 s：生产物理更新 60 Hz（1,090 次），首次爆炸后按 20 Hz 采样（263 个 epoch、526 次双眼 fill 观察）。同 R39 的 radiant120、seeds 42/43、0/+2 s 发射、N8、风向/风速、真实 saved native 主相机及水面 oblique 镜相机。原始光学行未减量；不求 T/SH 数值、没有 renderer context/GPU。R39 原 capture 的物理 cadence 是 **20 Hz**，本研究为独立新 60 Hz 时程，不将两者冒充逐值相等。

| 观察指标 | 当前真实采样最大 | 时间 / 对应计数 |
|---|---:|---|
| MAIN / MIRROR 每眼 pairs | 8,426,298 | 9.45 s；P=3,678、N=2,291/眼 |
| 共享 SH pairs | 8,421,700 | 9.50 s；P=3,710、ledger N=2,270 |
| 三消费者 logical pairs | 25,272,520 | 9.50 s；双眼 N=2,271、SH N=2,270 |
| 单 job map 次数 | 10 | 每 map 仍 ≤1,000,000 个保守 64 槽 |
| 联合新鲜数值 draw 次数 | 33 | 两个各 10map+reduce 的 T，再加一次 10map+reduce SH |

跨 epoch 各自最大 padded64 槽为 25,576,064、reduce texture fetch 为 668,114、数值 raster texel 为 408,330；它们不必发生在 logical 最大的同一 epoch。当前生产 4m/8maps 在 **7.55–10.95 s 的 69 个采样 epoch** 拒绝。即使只提高 request ceiling，8maps 仍在部分阶段不足。现有 QA **12m/16maps** 的 count model 覆盖全部 263 个采样 epoch；未证明其他种子、机位、质量、更多发射或任意持续时间均适用。

峰值三个位置均在 **0 merge** 时；10 s 才出现首个常规 density merge，10.2 s 出现首个 forced merge。终点为生产原有容量 4,096 烟团、755 merges（其中 568 forced）。保留它们并报告，不称整个生命周期“完全未合并”。全 384 个逻辑 body 完成，allocated reference matter=40.7，emitted=40.69999999999991，future=0、remainingCells=0、duplicates/releaseErrors=0；最大账本浮点残差 1.358e-13。峰值时仍有 6.64 reference matter 的未来释放，研究继续覆盖到完全释放后，未在首次 4m crossing 停止。

有限 read audit **5/5**。首轮 4/5 是审查器把空源阶段的两个 `cameraKey:null` 当作有源镜眼身份失败；只修 neutral 分类，首轮保留在 `baselines/r40-lifecycle-audit-before-neutral-key-fix/`。不重跑 producer、不改 raw 数据。另以既有 R39 planner 对 263×2 policies×2 storage 做纯计费：无完整私有 epoch token，所以 `reservedWork` 全为零，count-fit 不是执行许可。raw 内 generic rectangle neutral descriptor 不是实际 dispatch：后置 policy report 正确按未提交 T=0、fresh tiled64 SH 冷 zero 的显式 map+full final write 计费；正源峰值不变。

## 推荐下一步：唯一 prepared-view 路径 + 明确的全 epoch 预检

优先保留现有光学、packing、64 项求和与 reduction。完成 R39/R40 固定三数值门后，以已审 QA 12m/16maps 作为**显式候选**接入；同时拆出 `fillRecords` 中目前唯一的 eligible→真实 Float32 culling→stable depth sort→original-double ray 构造段，产出实例私有的 `preparedView`。它不是通过 `render` 或 fake ack 获得的“估算”行数。后续真实 FW render 只消费该对象一次；不再做第二次 fill，不为 preflight 增加 request sequence，也不借用另一眼的 T。

最小接口建议：

```js
const mainView = fireworks.prepareViewForFrame({ camera, optics, reflection:false, ... });
const mirrorView = fireworks.prepareViewForFrame({ camera:mirrorCamera, optics:mirrorOptics, reflection:true, planeY:0, ... });
const epoch = pyroSmoke.currentCommittedEpoch(); // 内部稳定标识，不以每次 snapshot() 新 wrapper 指针判断
const ledger = fireworks.getEmissionLedger({ rawPerCandela });
const plan = preflightSmokeFrame({ epoch, ledger, mainView, mirrorView, policy, aggregateBudget });
// 所有输入身份与总工作通过后，才准许当前 frame 的任何数值 prepare。
```

`preparedView` 必须绑定真实 optical records generation/物理时刻、质量/visibility、完整 camera V/P 与 eye、width/height、shutter/legacyShutter、DOF/focal/focus/aperture/sensor、rawPerCandela、reflection/planeY 与接触来源；变动就失效。`epoch` 绑定内部 committed density revision/time/layout，ledger 使用自己的 version/recordGeneration/time。**optical generation 与 ledger generation 不相等也不应强行相等**。request sourceVersion 则只在真实提交时分配，并由同眼 input→result→consumer 连通。对外摘要可读，行/原始数组由实例私有持有；不引入通用异步 coordinator。

`updateScenePhotometry` 现在在 main.js:993 先 prepare SH；FW `fillRecords` 在 fireworks.js:645–724 直到实际 draw 前才知道真实 ordered count，失败后进入逐源 CPU fallback。因此单独改 pack ceiling 不能完成联合预检。预检应位于 `fireworks.update`/`flushPyroSources` 已生成当前状态之后、SH prepare 之前；SourceT 行数不依赖 storageEV，固定 rawPerCandela 的投影可先准备。保持 photometry 使用本 epoch SH bound，再按原正常顺序水面镜眼→主眼消费：**一次 fresh SH，单个 borrowed T field 每眼 prepare 后立即匹配绘制**。volume 使用同一个已完成 SH，禁止 bake 第二遍。

建议复用 R39 的明确 aggregate 计费，不制造默认“每帧 1m”限制。必须一起计算两眼完整 ordered count（包括 inactive/zero-length 行）、共享一次 SH、partial padding、三附件 reduce fetch、upload/owned buffers、数值 raster 及 live 场景后续填充。12m allocation：一个 live borrowed T+SH=14,622,720 数值字节；保存两眼直到统一读回的 QA 则为 19,329,024，不能混称。全量三 job upload 上界 2,768,896 B/epoch，另有实际 CPU pack/光学行成本，不把 GPU 门的低 ms 直接换算整帧 FPS。

任何预检不支持必须在第一个数值 prepare 之前明确返回 **whole-epoch not-submitted**；不能偷偷进入现有 `fillRecords` CPU fallback，不能发布半个新 SH/T、不能用旧 T 画当前行。这个失败状态仅避免不可控 CPU 卡死，**不是**超预算内容的完整渲染解决方案，也不能无期限冻结后声称成功。超出已测 envelope 时，后续选择是测量后明确扩展完整预算，或另行验证能降低总工作量的算法；本轮不减烟、不截断源、不改用户发射时序。

最小有用实测先使用已有 R39 同 epoch 全参考，完成双眼+SH 一次 fresh joint（21 数值 draw），再用同 current producer 做短正常 scene transaction 验证准备/消费身份和零 CPU queries。延长计数揭示的 **33 数值 draw /25.27m** 峰值仍须单独完整预算/时间门；不能用较早 7-draw MAIN 的 2.864 ms 推断它或完整原生场景。烟光熄灭后仍保留 4,096 烟团的 volume fill，数值 pairs=0 并不代表全帧零成本。

生产没有改动。当前 main 为 `388afa4f…6674f`（R40 QA wrapper），FW 为 `03fdb703…c735`；旧 R39 artifact/pins/raw 不动。脚本/报告完整 SHA 在相应 JSON：count raw `00fd9ab3…2be2`，count script `16eeea6d…5f93`；read-audit `02aa3b51…43b38`；policy report `1aa08f65…9533c`。
