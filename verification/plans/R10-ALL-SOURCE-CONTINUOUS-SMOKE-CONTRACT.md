# R10 全十型持续烟：只读代码门与最小合同

2026-10-28。只读核对现有[全源审计](ALL-SOURCE-SMOKE-COVERAGE-AUDIT.md)、[generic原型](GENERIC-BURN-PROFILE-REVIEW.md)、[燃烧体基础](../COMBUSTION-METADATA.md)、ring/palm/fan实现及R9证据；未改运行时、未重跑浏览器或覆盖报告。这里建议的接口尚未实现。R9应用adaptive只改变尾迹成像，不改变生产point/.20/12/Brownian/two-births烟源，原照片感目标继续active。

## 确定缺口，不把元数据当源覆盖

| 路径 | 当前确定事实 | 全十型还差什么 |
|---|---|---|
| 十型逻辑图 | `fireworks.js:4–40`完整描述aerial-root/child、ground-comet、lift/burst；`matter`的fuel/yield/relativeWeight仍unknown | 图本身足够描述当前全部燃烧体；不需要编造kg或给材质图填“实测燃料” |
| 真实过去位置 | `fireworks.js:394–408`的describe仅roots；sample第404行明确排除parentBody。`fireworks-physics.js:40–49`已有同风时线递归sampleBody | 新增只读body采样入口；否则crossette144子星始终不能发真实轨迹烟。不能延长父life或复制根轨迹代替 |
| 当前持续候选 | ring仅48条代表轨迹；palm/fan覆盖全部12/9根，但profile只处理这两型；生产仅12代表早期沉积 | 其他空中类型没有全life持续源；bouquet104头仍只有嘴口9包；元数据完整≠每条实际路径被查询 |
| 计划与事务 | `pyro-smoke-trajectory-events.js:39–40`只在`!ground`中排root；第69–75行依赖展开全部plans、next索引和完整事务 | 把新profile改成每逻辑stream一个游标，不能简单取消类型if或提高trajectorySlots就叫全源 |
| host | `pyro-smoke.js:11–19`只允许two-births/ring/palm-fan三个profile | opt-in新profile与明确参数转发；旧三个分支逐字/真实输出保护，不顺带提升默认 |

实际对象数量：牡丹224、菊192、柳160、棕榈12、默认笑脸120、爱心144、闪星160；十字36父＋144子；fan9个各自lift/comet；bouquet1个lift＋104个comet。布局变体按实际graph数量，不能硬写所有ring都是120。carrier是筒射弹道载体；现无沿飞行持续烟不自动等于缺陷，也不把上升装饰亮光视为发动机推力/烟产率。

R9清洁palm45/45＋fan45/45只是两个候选的技术闭合，`visualAccepted:false`；未推广到所有类型。没有必要重做physics、state扩散、renderer或音频才能补源接口，但它们现有性能/光学限制仍约束是否可交付为默认。

## 一个可实现的最小合同

建议新独立opt-in `emissionProfile:'logical-family-continuous-v1'`，新纯模块`pyro-smoke-logical-burn.js`负责profile与流式游标，现adapter只增加明确路由。保留原profile和生产默认；不把Taylor、核宽、M、曝光、受光模型同时偷换。源码可从既有QA `burn-profile-prototype.mjs`迁移数学，但其预展开cells/masses及简化commit不是生产事务实现，不能整文件改名即验收。

建议接口（尚未存在）：`createPyroSmoke(…, {sourceModel:'trajectory-v1', emissionProfile:'logical-family-continuous-v1', kernelModel:'past-segment-v2', centralFraction:.20, groundChargeFraction:.10, dispersionModel:'brownian'})`。新profile直接消费`describeCombustion`的全部body，旧`trajectorySlots:12|48`只属于旧代表分支，不得继续截断新profile。诊断应区分`coverage:'all-logical'`、参与/实际查询的body数、source cells与提交Gaussian包数；不能用包数冒充独立轨迹数。第一轮只改变源选择/时程和明示的ground分配，扩散仍Brownian；若改Taylor必须另列变量与对照。

**1. 只读采样。** provider新增`sampleBody(eventId,{bodyId,time})`，保留旧sample(root/event)语义。查实际active event与真实body；`birth≤time<birth+life`、`time≤simulation.time`、完整因果wind仍在，才调用原physics.sampleBody。分裂继承由原递归parent/velocityDelta完成一次，不再额外加parent速度。future graph可含birth/life/谱系，但无未来XYZ/风；sample返回有限位置值，不泄漏可改body指针、不推进RNG/物理时钟。普通.055s主循环下源末格距原event退休仍有余量；缺失/已退休/大跳越界明确拒绝，不建无限档案或重建未来历史。

**2. 参考预算与作者分配。** 空中每发仍`.35+20=20.35`，launch形状/原clock保持；中心`20c`、燃烧家族`20(1−c)`。首轮对生产做因果比较应显式取现`c=.20`；若比较B方向可显式`.05`，但不能把分配变化归因于时间连续。两者必须在报告中标明。fan每个既有`.1`预算仍`.1`，九次合`.9`；bouquet仍`2`。ground采用明确作者参数`groundChargeFraction=.10`，即fan每lift嘴口`.01`/其comet`.09`，bouquet嘴口`.2`/104家族共`1.8`。这是原预算内部重分配，不是实测10/90产率。全体参与模式不允许用c=1或groundChargeFraction=1使全部body分得0后仍声称覆盖。

每个root family只领一次正份额，默认等家族权重。无child时沿该body原life均匀释放；crossette父/四子用`pathShare(root)=1`、`pathShare(child)=parentShare/nChildren`，令

`D_family=Σ_i(pathShare_i·life_i)`，`M_i=M_family·pathShare_i·life_i/D_family`。

随后`rate_i=M_i/life_i`。当前父死即四子生时，四子总初始率与父率相等；四子不是各领一份完整family预算。future life是已声明的作者时间，不是对未来风/位置采样。`node.matter`继续unknown，参考分配单列`authorProfile`及归一权重，不能改标签冒充fuel。I0/I64、颜色、strobe、尾迹段数/快门、mirror/bloom都不进入M或产率。

统一均匀参考率已使不同life、不同路径的烟时程不同，但**不能满足“各真实品种的总烟产率已标定”**：八类空中总量仍相同20.35，真实差异未知。后续可增加有参考依据/明确作者设定的归一累计曲线F(age/life)，用`M_i[F(b)−F(a)]`保持总量；本合同不先凭想象给十型不同kg、用闪烁亮度控制烟或顺带改源I。

**3. 流式因果cells。** 一个body保留稳定sourceID/familyID、nextCellIndex、下一格时钟、已分配/剩余M，O(body)未来状态；不保存几千格plans，更不保存未来坐标。沿用body.id确定性错相首格.1–.3秒、后续≤.30秒、末格准确到life，末次取余量；不能静默略去最后短格。只对已到时cell使用GL5内部过去点，走既有pastSegmentSourceMoments/held-wind/热龄/fullΣ及当前选定扩散；不为R10再调K/TL/σ。使用past-segment核是公开变量，时程A/B应对两边固定相同核/扩散/分配。

每ready批次按`time/eventID/sourceID/cellIndex`稳定排序，再分配唯一EmissionID；sourceID不是每个render record。launch/burst继续消费原drain批次一次，无新增声音事件，child出生无需重新写声音队列。fan九个错时lift各自保留原时钟，bouquet不虚构高空burst或104个lift；新光学源不领第二份M。

**4. 事务与clear。** 只扩展现有prepare/commit：所有provider读取、ready容量/时钟/质量/IDs预检完成后才提交游标、预留及state队列；known失败全不变。不可预测的部分queue失败仍如实记已接受数并fault-lock，不能假回滚。`allocated = materialized + reserved + cancelled`，state侧`airborne+pending`单列闭合；不因冷却/不可见删M。clear同时取消所有未物化body游标/trigger预留并tombstone旧event，旧burst/child不会复活；严格旧时间拒绝、同刻新eventID仍合法。释放完成descriptor/风历史，不靠小时级event引用保存冷烟。

## 数量、矩与光场：必须区分三个门

既有generic原型seed42完整记录（不是R10实测耗时）：牡丹2498、菊2911、柳6291、棕榈261、笑脸1562、爱心1948、十字1632、闪星3414、fan192、bouquet973个源cell/trigger。旧`maxPendingPlans=2048`因此不能承载新未来展开；游标需把这个限制改为**有界stream元数据＋每次实际ready批次**，不能直接提高成无限。原型30/60/120Hz等价只是10/10 CPU证据，不是现生产适配已完成。

1. **源可用门：** 全逻辑body都有正权重与实际过去采样，流式释放/总账正确。可以先逐body提交真实cell，复用现4096密度容量和已有同profile merge；不必为源码可用性发明新流体或新GPU场。
2. **密度形态/预算门：** 柳单发6291、两发更多，必可能触发4096 merge。它保持瞬时M/μ/Σ，不保持多峰/条件受光或未来热速度相关；forcedMerge必须显式报告，不能称画面自动自然。不要把所有同tick body合一cohort来“解决性能”：两个位于±10m、σ.3的窄核可保M/μ/Σ而凭空造中心τ、消掉两端峰，重现棉椭球。任何新增source cohort要另有相同profile/共同出生时钟、空间邻近及τ误差门，失败保多个cohort或明确unsupported；仅矩守恒不是全路径光学覆盖。本轮最小合同不新增这种合并算法。
3. **高级照烟门：** `pyro-smoke-light-field.js`可选resolved场限制`packetCount×ledgerCount≤1,048,576`；4096×菊1728≈7.08M会unsupported。**当前生产resolvedSmokeLighting=false**，所以此cap不是基础全源planner不可实现的原因；它约束“全源＋此高级照烟同时可用”。不能截前N光源、只照新烟或悄回中心proxy仍显示ready。原有main/mirror、P预算、sourceT/空气近似及完整字段状态须分别记录。

分钟积烟、小时残留、早期快速膨胀和落水熄灭/沉降不是此profile顺带解决的功能。分布变稀不等于M自然消失；允许光学性能淡出时也须另列误差与强制近似，不能借本合同暗删旧烟。

## 交付前的具体代码门

| 门 | 所需最小改变/验证 | 不得被替代的证据 |
|---|---|---|
| G1 provider | 新sampleBody；native root/144child/9fan/104bouquet过去点与原physics同风一致，future/dead/retired拒绝 | 旧describe/sample/diagnostics与默认逐值保护；不动I/audio/ballistics/RNG |
| G2 pure profile | 每型所有bodyID恰参与一次，正权重；全family/ground/lift总量闭合，split不重复领M | 不靠render ledger、亮度阈值、选48代表冒称每体路径 |
| G3 production cursor | 将新profile从完整future plans分离；稳定ready排序/IDs、30/60/120与不同batch边界一致 | 包含parent最后格/child第一格、fan错时、bouquet唯一lift、精度不足拒绝 |
| G4 transaction | 接现prepare/commit/queue capacity/fault/clear与same-time合法新ID，bounded seen/descriptor/wind | 故障注入前不改known状态；部分提交如实；clear后无future复活 |
| G5 scoped regression | 原two-births/ring/palm-fan及legacy9窄逆字节保护＋真实行为；host新allow-list不动state/render | 原R9失败/45+1282保留；audio4e5锁，M/I/运动各独立比较 |
| G6 actual source | 十型至少各hot/late/cold，固定事件/I/风/C与同核/受光，对比主＋mirror范围、child/ground真实留烟和下一发再照旧烟 | 全body权重与计数不是照片感；完整倒影/无节拍/烟绳不能由numeric pass推断 |
| G7 actual budget | 低/高数量、双柳/双菊、现有20Hz及4096附近/分钟积累，分phase CPU/GPU与merge/field unsupported | R9密集25.93fps已表明共同瓶颈，不能把新profile“可用”说成60fps预算通过或立即默认 |

推荐先完成G1–G5使十型新profile**可显式选择**，用同一合同连续做G6/G7；不要求先改画面增益、光谱、膨胀或旧音频。是否变生产默认由实际视觉与成本证据决定，不是为实现资格增加新的用户审批步骤。实现与验证阶段继续保存原图、报告和版本归属；当前没有新代码/GPU/视觉接受声明。

锁定音频：`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。以上来源使用现有已核一手研究与项目证据，无新物理常数或产烟率需要通过额外搜索虚构补齐。
