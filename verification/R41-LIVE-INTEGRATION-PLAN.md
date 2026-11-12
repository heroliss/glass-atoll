# R41：生产 prepared-view 与联合预检接线计划

本文件为下一轮计划，**尚未实施 main 接线、提高日常预算或完成真实整帧验收**。前提是 [R40 数值门和 CPU 交接](R40-CHECKPOINT.md) 已通过；保留现有 source/physics、光学核、64 项求和、完整源/烟、用户设置与音效。

## 最小可交付改动

1. 在 current FW update / smoke source flush 完成后、首次 `prepareLighting` 之前，取得同一 committed density 与当前 emission ledger，并构造真实主/镜两个 `prepareSourceView`。直接复用生产唯一行准备路径，不调用 fake render、不给 preflight 分配 SourceT requestVersion，也不重复构造/上传第二份有序行。
2. 用真实 ordered count（包含 inactive/zero-length 行）、activeRayCount、同 epoch 的 packet/ledger count，原子预检两眼 T+一次 SH。分别绑定 optical generation、ledger version/recordGeneration、density revision/time/layout；不能以三个数值“碰巧相等”证明身份。
3. 全部通过后才允许该事务首个 GPU prepare。SH 在 photometry 中只 bake 一次，两眼 volume 使用同一 field；按原水面镜眼→主眼顺序，以同一个 T field 每眼 prepare 后立即消费。禁止跨眼 T 复用或在下一眼 prepare 后消费上一眼 borrowed T。
4. 新 prepared 正源失败明确中止当前完整事务，不进入旧逐源 CPU fallback、不发布半成品、不用旧 T 画新行。正常旧 API 与正常 4m/8maps 先保持；12m/16maps 只有在明确 source/caller/aggregate gate 通过后才能单独推广，不能仅改字面容量。

## 镜头时序必须与真实 caller 一致

按 [Focus 与 Lifetime 独立笔记](R41-PREPARED-VIEW-FOCUS-AND-LIFETIME-NOTE.md) 接线，不能通过删掉 focus/matrix guard 或加 epsilon 绕过失效：

- `currentOptics()` 在 photometry 时仍读上次 lens render 的 focus。water reflection callback 没有单独 optics，因此镜眼准备应使用**此时实际旧 focus**、真实反射 target 尺寸、dof=false、legacyShutterSeconds=0。
- 本次主眼 focus 则按 `lens.render` 的同一现有公式预报。target 模式为 `Math.max(.3,camera.position.distanceTo(controls.target))`；manual 为实际 configure 后的 focusDistance clamp `.3..24000`。不能将尚未应用的 UI 参数冒充私有 uniform 值。
- 本次主眼 sensorHeightMm 用 `camera.getFilmHeight()`；其余焦距、光圈、DOF、快门采用已配置值。不要为了统一两眼而改变旧渲染行为。
- lens temporal jitter 没有改相机/projection 矩阵，不预加不存在的 jitter；预检及实际 water capture 的 reflected matrices 必须相同。
- storageEV/sceneScale 可以由后续 photometry 更新；它们不影响已准备行。物理时刻、raw、镜头、模式和密度仍严格绑定。

## 生命周期与其他入口

四个 pending handles 是有界所有权合同。预算拒绝、中途异常、paused cached frame 不实际 render、反射被跳过、main-only screenshot、旧计划被替换时，一律在 finally 中 `discardPreparedSourceView` 未消费句柄；成功/失败的真实 render 已单次消费并自动释放，重复 discard 安全返回 false。不得改无界集合或 fake render 来“释放”。

正常帧、强制刷新与 screenshot 必须有明确域：只有主眼的入口构造 main-only 计划；不能借用上次 full-frame 剩余 handle。resize/相机/质量/visibility/密度/源 generation 改变后重新准备。原 render 没传 handle 时的行为继续保持，不靠静默回退掩盖新接线错误。

## 本轮已知预算与下一次实测

R40 首次 dense 快照是同代 **12,055,087** 总 pairs / **21** 次数值 draw；完整两眼+SH 参考与独立审查已就绪。先以这一真实工作量验证生产接线和一个正常完整场景事务，保持原生尺寸/质量/真实纹理、一次 fresh SH、两个即时 T，确认 prepared counts/rays、提交/消费版本和 0 CPU transmission queries；不用 reference GPU、预制 field 或减烟替代。

延长研究已知实际更重阶段为每眼约 **8.426m**、共享 SH **8.422m**，联合 **25.273m / 33** 次数值 draw，最大 job 10maps。12m/16maps 仅覆盖此固定 263-epoch 采样，不是任意持续多发的通用保证。使用已审 R39 显式总计费：两个 T 分别算、SH 一次；map padding、三附件 reduce fetch、上传/私有内存和体积/场景填充均记账。live 单 borrowed T+SH 数值存储为 14,622,720 B；延迟统一读回的两张 T+SH 为 19,329,024 B，不当作驱动显存或整场景内存。

实际完整帧的 draw/element/resolve/mipmap/clear/capture 与时间上限必须在 root GPU 调用前固定，不能把 isolated kernel 的 25ms 门或本轮三项单次时段自动当作全场景预算。先记录一次 coherent fresh frame 与同次图像/状态，再进行有明确冷/暖及工作量定义的短正常演化；冻结 SH cache 命中不能冒充 fresh field 性能，GPU query 非 disjoint/健康条件失败就停止并保留证据。较重的 33-draw 峰值是单独后续门，不由 21-draw 通过外推。

若某 epoch 仍超过完整预算，whole-epoch not-submitted 只是防止不可控 CPU 卡死的明确失败状态，**不是**永久冻结当前画面的成功方案。继续释放的烟和更多事件会增加成本；后续可据硬件实测扩展明确预算，或验证减少总工作量的新算法，本计划不截断源、不减烟、不沿用旧 T、不改变用户即时发射要求。

## 验收与保留项

先保存 main/预算接线前原件，做聚焦 CPU source/caller tests：相同两眼默认与 prepared 行/打包数据、真实 focus 时序、过期/失败/skip/screenshot 释放、SH 一次、版本命名空间及完整预检前无 GPU；不重跑无关历史全套。再由 root 独占已有 renderer 做预声明的一次真实场景门，保存 raw 与图像、所有状态/用户意图恢复，最后才决定显式生产容量推广。

这不代替视觉与总体目标：目前没有多发持续 FPS、照片感、环境受光、冲滩、水花暗边或天际完成结论；55ms 全局时间截断与剩余 CPU 光度成本仍需独立处理。
