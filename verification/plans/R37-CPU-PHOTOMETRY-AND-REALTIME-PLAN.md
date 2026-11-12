# R37：小范围 CPU 光度准备与实时时钟方案

仅方案。依据R36实际数据/当前源码，不改生产，不创建新GPU框架，也不把这些假设写成已测收益。先做一项可回退的CPU候选，时钟调整另立版本，不能同时改完再比较。

## 1. 当前证据与第一假设

普通代表烟与QA逐点烟的 `photometry` CPU wall/submission均约11 ms（11.063/10.808），即使烟包24对1561→2442，光度段并未随烟包规模等比增长。该段包括 `getBounds`、light clusters、SH准备、主/镜源光度上界、camera/storage选择及GL提交/可能等待；**不是SH独立GPU计时**。这支持先检查共同的CPU源投影/曲线采样，但不能证明它独占11 ms。

逐点烟另有 `firework-simulation-audio` 约10.84 ms（普通2.65）；源码边界包含 `flushPyroSources`，声音关闭。这个排烟/物理刷新问题要另计，不能通过减少光源、降烟密度或错用缓存伪装修好。

最明确的同刻重复候选在 `fireworks.js`：`getRadianceBound`对每眼执行 `writeSourceBound`；该眼随后 `estimateTrailSampling`再次对同一组光学行、同相机/光学参数执行它。它重复投影中心、快门/伸展端点、sigma、footprint等。这两个调用使用同一函数，适合精确复用。**`fillRecords`的保守Float32裁剪是另一套数值契约，不能拿上界rect替代它。**

第一步仅在固定单发、正常native1209×1292/N8/1/120、原主/镜相机处统计该函数calls/hits和CPU分段；此统计先证实相机/optics实际相等及数量，再决定实现。不要先宣称可省一半光度时间。

## 2. 已有缓存必须保留

| 现有机制 | 已经避免的工作 / 禁止的误判 |
|---|---|
| `opticalViewCache` / `contactViewCache` | 同记录与快门的8bin RGB/接触光学行已经复用；不能再声称两眼重算全部积分 |
| `opticalAnchorCache` | 同body/field node、record generation、快门的中点pose已经复用 |
| `tailFieldNodes` | 同body/lag的纯尾场描述已缓存；不是每次新建全家族 |
| `getLightClusters` | 同记录generation只归约一次；主/镜/烟重复getter通常命中 |
| `getEmissionLedger` | 同records身份+rawPerCandela返回同一ledger；借用buffer不能跨刷新持有不复制 |
| SH field key与packet pack | 完整snapshot/revision/ledger/version/data/count/bakeMode缓存已存在；物理光源变化需fresh bake，不能跨时复用旧RGB |
| `withWindResponseMemo`及wind prefix | 已缓存风的仿射响应，不是没有运动缓存；scope只含风项，不是任意body pose认证 |
| `getBounds` | 现有2Hz key、过去sample缓存、scaled/powered风域+快门合同；不要再套只有time的宽松cache |
| `pyroSmoke.refresh` | 仅density revision改变才重建columns/volume；空时钟header不是每帧重新装包 |

`boundCache`目前只是最后结果/diagnostics，不是完整带key的radiance memo；`sourceProjectionCache`/`uploadProjectionCache`只复用投影容器，不能把它们当逐源投影结果已缓存。

## 3. 第一项有限实施：逐眼精确投影结果复用

建议只改FW私有CPU工作空间，不动shader/光学公式、SourceT/SH、采样数和global clock。

- 第一次 `writeSourceBound` 结果存入该**当前记录行对象**的私有、不可被consumer修改的快照；`estimateTrailSampling`只在全部key相等时读。main和reflection分别保留一份，不跨眼共享值。
- key至少包括 records数组身份/generation、simulation.time/当前风history版本、光学行身份、requested/represented shutter、原始与legacy shutter、camera view/projection矩阵的完整数值拷贝、near、viewport宽高、focal/aperture/focus/sensor/dof、rawPerCandela、colour maximum。来源body/burn/trail/I0由冻结profile和记录generation约束；未来允许其可变时也必须失效。不能只按camera对象或hash判断。
- 复制 `writeSourceBound` 的全部输出字段与数组，保持原算序，不重写sigma/峰值公式。最多当前generation的两眼有限工作空间；下一代丢弃旧行，不能增长成全时间缓存。可以用有界typed scratch减少对象分配，但先测复制/GC成本，若收益抵消就撤销。
- `onSourceBound`诊断回调仍逐源执行、提供自己的冻结副本；不因命中而漏回调。实际source visibility、depth clip、排序、SourceT请求序号和即时消费保持原流程。
- 可顺带评估缓存一次当前generation+shutter的光学行数组，减少多次generator/Array.from遍历；**只是列表复用，既有行积分已缓存**。排序须在独立per-eye数组上做，不能改共享列表。它是后备小项，不能与第一项合包掩盖贡献。

这一候选若真实keys很少命中，或维护完整key/快照开销太大，则停止；不降低key完整性追求命中率。

## 4. 第二项独立小候选（第一项之后才选）

当前 `sampleBurnProfile`会附带 `materialCDF`，而FW当前头/尾的光学采样只使用RGB、photopicY、unitY及all-phase maximum。材料CDF自身需要积分，却没有被这些光学consumer消费。可添加**仅光学**的纯采样入口，逐字沿用现有RGB插值/Y/归一算序，跳过CDF；旧完整API和任何材料caller输出不变。不要让光度查询推进材料ledger，也不要用近似曲线表取代它。它更可能影响FW刷新段，也可能间接减少光度初始化开销，须分别测。

另一个明确死算：profile尾分支前计算的legacy `bodyEmissionEnvelope`/`weight`没有在vector分支使用；同一个 `exp(-lag/duration*3.5)`重复用于I和decay。可独立删除未用分支或复用**同参数原算序**结果。N对应的归一sum、固定trailProfile/N对应的lag/decay/颜色可以用不可变小表，key含profile身份、N、duration及tail-colour模式；旧profile和powered保持原表达式。

特别注意 `lag=((j+.5)/N)*D` 后再除D的FP结果未必等于先约去D。不能用代数消元的`exp(-((j+.5)/N)*3.5)`替换原decay并声称逐位相同。一次只选一项，实际计时不支持收益就不部署。

不优先迁移到GPU：当前renderer还需要CPU的原始double rays、保守bounds、排序、接触窗口、storage上界和ledger；只把曲线值上传GPU会增加双份权威数据/读回或失配风险。先复用确定重复及删死算，远小于再造WebGPU后端的验证范围。

## 5. 验证和性能决策

1. 保存当前生产基线。单发固定seed341070，普通与logical各自固定+.7/1.7/2.5，另取0×和64×、主/镜光学、短/长快门、接触边界。CPU对照完整RGB/8bin、bounds全部数值、records/ledger/pack words、callbacks和请求顺序；预期精确，不自动放宽误差。已有的scope足够，不重跑全部历史suite。
2. 明确新命中/失效反例：同camera对象但矩阵变、同time但quality/profile/wind版本变、快门/viewport/focus/raw比例变、mirror切换、clear/rebuild、callback、0源。共享private数组不能被sort或consumer改写。
3. 小型实际CPU基准分开测 `updateRecords`、主/镜`getRadianceBound`、`estimateTrailSampling`与组合调用。固定数据、预热、有限ABBA与原始样本，比较时间和分配/调用数，不把fakeGL成本当native速度。
4. CPU等价后只做一个已审查的真实native单发固定workload frame，再做有限预热/交错整帧比较。沿用现有状态/恢复、4m/request、1m/map、8maps与完整场景已声明上界；源/烟/画质/HDR传输路径全同。SH必须fresh且双眼各自T，避免拿缓存帧冒充收益。失败、不稳定或完整frame没有改善就保留基线。
5. 普通和logical演化测量只作补充，再报告wall与physical推进；不能用R36两次33.31/21.13FPS的差值当这项优化收益。

## 6. 实时时钟：单独设计，暂不实现

现 `.055` cap确实在慢帧让世界慢：R36logical3.0282秒wall只推进2.7988秒physical；raw14个长间隔裁掉204.3ms，不能说动画严格实时。**直接删cap不安全。**

推荐另立clock候选：维护暂停感知、单调的目标world time；有解析解的FW轨迹/燃烧/天体/程序波面可按目标时刻查询，记录整个已提交风/参数变更时程。需要稳定积分的浅水/漂浮/其它动态在旧最大步长内substep追到同一目标；烟scheduler/传输按完整因果cell接收所有间隔与事件，而非只喂最后一帧。一个长帧不应丢掉发射、爆炸、烟质量或偷偷改速度。

必须先定义每个系统的requested/committed time与共同render frontier。若烟/数值流体未追上，不能把wall-now FW与旧density标成“同代fresh”，也不能把旧T贴给新源。有限catch-up预算耗尽时需要显式behindSeconds与既定呈现策略；持有上一张完整画面可作为短暂降级，但不是达到实时，禁止悄悄丢质量/篡改时钟。

风险包括：慢帧一次catch-up再次卡顿；GPU波/流体多步增加dispatch；自动发射跨越多个时刻、声音时延与旧事件处理；user pause/QA锁恢复；风改变的精确时间；contact/浮动物的数值稳定；相机手感和temporal history。先用实际gap序列CPU核对事件/M/风/终点，再单独有界native验证，不与光度cache同时推广。世界速度与流畅帧率是两个验收项。

本计划等待R36最终manifest独立检查后进入下一轮，不承诺11ms全消失、GPU迁移一定更快或60FPS已达成。
