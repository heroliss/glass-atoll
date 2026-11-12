# R41 正常帧接线：两眼 focus 时序与 handle 释放

只读接线笔记，不改 FW/main/lens，不新增 GPU 门。FW50895d4a 的 focus/matrix 严格失效 guard 保持。

实际顺序是 `updateScenePhotometry` → `water.render` 的 reflection effects → `lens.render` 的 main effects。`currentOptics()` 读的是 lens.state 的**上次 render focus**；`lens.render:288` 则先写本次 focus 和 film height，到334才把完整 optics 传给 effects callback。main 的预检不能直接复用 photometry 时读到的旧 currentOptics。

main 本次 focus 必须按实际调用精确预测：正常 caller 传 `camera.position.distanceTo(controls.target)`；target 模式用 `Math.max(.3,distance)`，manual 模式用 configure 时保存的 `THREE.MathUtils.clamp(focusDistance,.3,24000)`。manual 预测须保证参数确实经过当前 setLens/configure，不能假定未应用的 UI 值已经进入私有 uniform。focal/aperture/DOF/shutter 采用实际 configured lens 值，sensorHeightMm 用本次 `camera.getFilmHeight()`。不能为通过 guard 而忽略 focus、放 epsilon 或沿用上帧值。此预测是已有公式的接线副本，不新增自动对焦算法。

water reflection callback 目前没有提供 optics，`drawFiniteEffects` 因此合并当时的 currentOptics：此时 main lens 尚未执行，本帧 mirror 仍绑定旧 lens focus。即使 reflection 最终 dof=false，FW handle 仍明确比较 focus，该差别不能忽略。mirror 预检应复制这个**实际旧值**及 actual reflection target 宽高、dof=false、legacyShutterSeconds=0；main 则使用上段本次预测值。两眼不应为了“统一”而改旧渲染行为。

lens temporal jitter 只写 vegetation shader uniforms；源码明确没有修改 main camera/projection matrices。不要预先添加不存在的相机抖动，也不要删除 FW 对 matrixWorld/matrixWorldInverse/projectionMatrix 的比较。water.prepareReflectionCamera 在预检与实际 capture 前调用，需得到完全一致的实际 reflected matrices。

`prepareSourceView` 只消耗 CPU构造与私有所有权，不分配 sourceVersion、不调用 T prepare。四个 pending handle 的上限有意保留。以下路径均须用 `discardPreparedSourceView` 清掉尚未消费的 handle：三任务 cap拒绝、任一中途异常、paused cache跳过实际render、water/reflection跳过、只执行main的 screenshot、旧frame计划被替换。正常真实render成功或失败都会自动单次消费并 finally释放；重复 discard 返回false。不要为了绕过上限改成无界 Set，或在预检时调用假的render来清理。

root正常帧的预算入口应在首次 SH prepare之前；数值账目必须分别绑定实际两眼prepared count/activeRayCount和原始ledger count。若某个入口只执行main（例如当前 screenshot() 直接lens.render），应明确构造main-only计划并释放其它眼，而不是借用上次fullframe剩余的handle。存储曝光P可在预检后由photometry更新，FW owner已单独证明此改变不影响行/源几何；它不能用作放宽物理时间、镜头或密度失效检查的理由。
