# R40：把完整数值门接回正常帧的最小接口

仅源码设计，无生产实现、GPU 操作或自动放宽上限。依据当前 `fireworks.js` 03fdb703、`r39-dense-joint-planner.js` e29f7eb5 与当前正常 photometry→water→lens 路径。

建议只做一项提取：把 `fillRecords` 645–676 的 **opticalRows → 同一可见性判断 → 同一稳定 z 排序 → 原始双精度 rays/masks** 提为实例私有的 prepared-view 构造函数。公开入口只返回不可伪造的当帧 handle 和完整计数；后续真实 `render` 消费该 handle，不再执行第二遍 eligible/cull/sort/ray 构造。不要调用假 renderer，也不要先真实 fill 再重做一次来数数。

裸 counts-only 查询也可以共用这个唯一构造函数，但只返回数量会丢掉已经完成的排序与 rays，真实 render 又需重算；因此优先 prepared-view。`getRadianceBound.visibleSources` 或 `getFramingSources().length` 不能替代：它们与实际 `sourceVisibility`、legacy smoke、可见性裁剪和排序输入并非同一合同。

## handle 和借用寿命

handle 私有保存实际 ordered `p` 列表、每眼独立原始 Float64 endpoints/origins、Uint8 active mask、完整 stats；不能把目前唯一的 `sourceRayBuffers` 同时借给两眼。返回的公共计数不暴露可修改数组。私有身份至少绑定：实例、recordsGeneration、simulation.time、sourceVisibility、camera projection/matrixWorld/eye 的实际数值、reflection/planeY、legacySmoke、最终 target 宽高、shutter 和用于该可见性计算的 optics。原有 `setSourceVisibility` 不增加 recordsGeneration，所以必须单独比较它；不能只依赖 camera 对象身份。

预检另绑定同一 committed snapshot 的 object/revision/time/requestedTime 及同一 ledger object/version/recordGeneration/rawPerCandela。密度 committed tick 与 requested/source clock 保留各自实际值，不能强行相等；光学 recordsGeneration 与发光 ledger recordGeneration 仍是两个计数器。simulation/update、源配置、camera/optics/viewport 或 medium/ledger 改变后，该 handle 必须拒绝，不能默默使用旧 rays。只允许同步当帧消费，下一帧不复用。

不在预检时增加 `sourceTransmissionRequest`；在真实对应 prepare 时仍按原顺序分配一次 request version。真实输出继续核对 count、sourceVersion、densityRevision、cameraKey 和目标反馈关系；prepared handle 不能作为已完成 GPU receipt。opticalRows 的现有 8-bin/contact/anchor 缓存和数值操作原序保持，不引入新采样、量化、近似积分或 shader。

## 三任务预检位置

正常 `updateScenePhotometry` 在 `main.js:992` 已开始 `pyroSmoke.prepareLighting`，因此完整预检必须放在该 SH prepare **之前**，取得正常 main camera 与 `water.prepareReflectionCamera()` 的两个 prepared views、当前 density 和完整 ledger。SH 按本帧实际 requested/visible 状态计一次；若要按 fresh 最坏情况收费，可显式保守计一次，不能把 QA planner 的“总是 fresh SH”误称所有正常设置都必执行。只有经过同 epoch 严格证据确认的实际 reuse 才能减去 SH dispatch。

SourceT 的 pair 数是 **ordered.length × packetCount**，包括 inactive/zero-length 行；activeRayCount 只决定当前实现是否完全跳过 prepare。倒影视线起点沿原来的 water-plane 求交，不能换成 mirrored camera eye。SH pair 数是 **完整 ledger.count × packetCount**，不得拿 optical 数或 clusters 数代替。按实际三项的 logical pairs、64-slot maps、draws、upload/target bytes 和总工作 cap 一次预约；不能各自独立都“低于12m”便称整帧已安全。

正常 water effects 先消费 reflection，lens 后消费 main。保留一个 borrowed T field 时，可以在每次完整 prepare 后立即消费对应 prepared view，再准备下一眼；不能到最后才一起读取两眼 T。若要求数值 joint 末尾同时保留两眼，则必须两套 field，当前固定数值空间为 19,329,024B；一个 T+SH 是 14,622,720B，不能混报。SH 三张系数纹理共享两眼，第四通道是 signed C1 分量而非 alpha。

## 明确失败策略，才能去掉卡死式 CPU 回退

当前 `fillRecords:711–719` 对 batch 不可用、失败或输出不匹配会逐行调用完整 CPU columns；单独加只读 count API **不会修复这个回退悬崖**。新的完整 GPU opt-in 路线需要一个窄而明确的 admission/failure 合同：三个工作有一项超 cap，任何 prepare 之前就返回 `unsupported`，不提交半笔任务，也不进入该大批 CPU fallback；已经提交后发生 GL/metadata 故障则停当前 GPU 路线并使当帧结果失效，不能沿用旧 texture。对这一帧显示保留正常其他场景、跳过相关烟花/烟照明还是采用另一个已验收后端，需要产品层明确决定，不能无声降低画质。旧默认 CPU 路线和旧 API 先保持。

实现验收只需比较同一真实 fresh generation 的原路径与 prepared 路径：完整 ordered/rays/masks/属性上传和两眼 sourceVersion、同一 SH ledger、contact 子片段、inactive/no-active、sourceVisibility 改变、camera/optics 改变后的拒绝，以及 >cap 时 **0 prepare/0 CPU column query**。之后才在正常 evolving 场景测完整帧；当前 fixed 三任务数值成功或 GPU elapsed 都不能代替正常帧性能与视觉验收。
