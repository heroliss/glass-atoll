# Tick-graph v1：生产状态、提交屏障与失败语义契约

状态：**实施前契约，不是已上线功能**。基线 `pyro-smoke-state.js` SHA67fa保持全部字节；本契约不授权修改生产代码。依据为R12完整6291格的原生源、无容量oracle、朴素batch、局部图与固定commit诊断缓存实验。实验表明有足够算法收益继续推进，但它没有生产事务/查询隔离语义，不能直接复制变换上线。

## 1. 入口、依赖与共享策略

新增显式工厂 `createPyroSmokeTickState(options)`，新模型标记 `tick-graph-v1`。原 `createPyroSmokeState` 仍为67fa，调用、默认值、即时same-clock输入和全部旧测试不变。host新增 `stateModel:'legacy-per-source'|'tick-graph-v1'`，默认前者；只有明确QA/高级候选可选后者，逻辑烟源覆盖与stateModel分开选择。

建议生产模块划分：

| 模块 | 职责与允许依赖 |
|---|---|
| `pyro-smoke-tick-state.js` | 新队列、COW staging、fence、发布/回滚、公开API；依赖新math/graph及已有dispersion |
| `pyro-smoke-tick-math.js` | 校验、核/热学/扩散/合并/误差诊断的纯函数；只依赖既有limits/dispersion，不依赖host、renderer、verification |
| `pyro-smoke-merge-graph.js` | 共同时间的profile/source邻接边、heap、诊断缓存；参数传入必要math回调，不自行读取时间或全局state |
| `pyro-smoke.js` | 明确选择工厂；update在源提交后总是调用对应advance/fence，clear使用同一已选工厂 |

**共享约束的真实取舍：** 67fa的数学函数是私有的，保持其字节不变时无法直接import这些函数。因此新math需要一次小而有清单的固定提取/复写，约旧文件前80行的数学与验证，而不是复制整个旧工厂。新state和graph共享该生产math。测试记录其来源范围、函数逐值等价及差异；旧67fa保留为冻结legacy，不悄悄改成另一个import外壳。若未来要完全去重，必须另批机械抽取并重新验收legacy，不能同时宣称“零重复且67fa未改”。

禁止运行时读取JS源码、eval/data-URL编译、import verification实验、循环依赖或在模块顶层建场景/状态。旧data-URL夹具继续只改它们已知的旧导入；新state的夹具正常import或统一重写全部相对ESM导入。FW仍只有现有physics导入，不为本功能加FW静态依赖。host的冻结旧版比较器使用冻结旧host源码，不能通过替换其中的旧state import来伪造legacy比较。

## 2. 公共状态与队列定义

永久保留一个**已提交块C**，其中packet数≤capacity，包含物理时刻、tick、wind、packets、质量/合并账本及稳定ID状态。输入队列Q与已接受输入ID水位独立于C。所有输入复制、校验后才原子接受；调用者不能通过之后修改输入数组来改队列。暂存块S仅在一次同步commit内可达，从不返回给外部。

| API | tick-graph-v1语义 |
|---|---|
| `queueEmission(e)` | time≥C.time（保留原1e−10规范化规则），ID严格递增，数值/SPD/profile/总M/队列预算全预检。**即使time==C.time也进入Q并返回 `{accepted:true,queued:true}`**。成功后更新accepted-ID水位；尚未增加airborne/emitted。非法输入不改C、Q、ID或requestedTime。 |
| `setWind(e)` | time≥C.time；包括same-clock均先排队；同一时间尚未消费的wind保持原last-write-wins规则。非法输入不改状态。 |
| `advanceFence(target)` | 先校验有限、可表示且不倒退target，然后更新requestedTime。对same-clock待处理输入做一个零时间commit，再按20Hz完整tick提交，最多maxStepsPerAdvance个时间tick。每个commit独立原子，不能跳时刻。 |
| `snapshot / sampleMedium / columnOpticalDepth` | 只读C。snapshot的packets与所有数组是外部副本，永远≤capacity。返回的pending数/M来自已接受尚未提交的Q；绝不把S混入airborne。 |
| `diagnostics` | 同样只读C+Q。`lastEmissionId`是已接受ID（含pending），ledger.emitted是已物理提交质量，ledger.pendingMass是Q中质量。显式报告模型、pending同clock、staging峰值、失败commit边界。 |

公开读在重入时也只能看到旧C+已接受Q；新的mutator在输入校验或advance期间重入须拒绝。输入getter/Proxy异常、测试注入错误等不能让半个输入或半个S被发布。实现不需对任意恶意对象提供复杂支持，但必须在读取输入前建立busy guard，并在finally释放。

`advanceTo`若为兼容保留，必须只是`advanceFence`的同语义别名，不能绕过fence直接公开staging。host应显式调用`advanceFence`，让接线的选择可审查。

## 3. 一次commit的算法与边界

每次commit仅创建一个packet数组浅副本和工作计数/队列本地cursor；packet实行copy-on-write。

1. 记录C、Q版本及该commit可消费的emission/wind前缀。Q的真实head不移动。
2. 从C派生S；不改C或Q。对即将演化/被核函数写缓存/合并的packet，先复制其物理数组及可变缓存。每个packet在该commit最多clone一次；不能让旧C与S共享可被写的mean/covariance/Cholesky/normalization。
3. 按原时间顺序推进到每个输入时刻；同一时刻先wind、后emission。真实出生之前绝不增加airborne。所有源仍在其原时间出生，只把压缩延到当前commit末。
4. 精确推进到commit末，完成所有数值/SPD/质量上限检查。此时才在共同时间建局部候选图、执行原每类前8/完整诊断/原quality比较，直到packet数≤capacity。不能删除M、跳星体或合一个全局cohort。
5. 核验最终计数与质量闭合；将packet、wind、clock/tick、消费cursor、发射/合并ID和统计组成一个候选发布块。
6. **一个发布点**：替换C，并推进Q head。之后才清理已消费队列前缀与旧stage。外部任何观察都只落在发布前或发布后。

`capacity + maxPendingEmissions` 是stage packet硬上限；tick-graph-v1的maxPendingEmissions至多8192。默认capacity4096时最多12288；实际单柳实验峰值4137不是永久默认容量提高。超预算需在接受相应输入前可预检的阶段拒绝，不允许stage无界增长。graph使用该stage的固定N做精确pair key，N²须在安全整数范围；最终renderer/columns只接收≤capacity的C。

一次advance的最大commit数≤maxStepsPerAdvance+1（最多一个初始same-clock fence）；无输入、无物理tick变化的重复fence应为空操作，不重新建graph、不改density revision。COW的克隆、stage/graph分配和发布成本必须进入后续性能实测，不能沿用实验2.57s当作生产预算。

## 4. Same-clock与确定性：必须声明的边界

每次advance一开始，只要有time==C.time的待处理emission或wind，便先完成零时间fence；即使target更远也不能把这些输入直接与下一tick合并。这避免“target是否跨tick”悄悄改变已知同clock输入的压缩时刻。

但是 `queue A → fence(c) → queue B → fence(c)` 与 `queue A+B → fence(c)` 是**两个不同的输入/fence分区**，容量合并可能不同。不能宣称新模型对任意分批调用仍只有timestamp决定结果。可复现记录必须包含输入因果可用顺序及fence水位/顺序；本模型保证相同完整输入/fence序列得到相同状态。

不能简单拒绝所有fence后的同clock新输入：用户在暂停的当前时刻发射新烟花就是合法的新因果操作。native adapter在每个update中先将已知ready源全部排队、再fence；应实测该协议在30/60/120Hz下的状态/账本稳定性。若仍存在实际cadence差，须定位并另定源交付watermark，不能放宽断言或把不同fence分区当同一测试。

## 5. 局部图与缓存的生命周期

图仅属于一次共同时间的S。x排序键为真实mean.x再packet.id；profile相隔≤4及非null同源相邻边规则保持。packet相对顺序标签用于同分score的i/j字典序，新merged节点继承较小标签。

- 删除/插入节点须更新移除位置、新位置附近的profile±4与source±1边；mean.x并列与新负mergeID也必须按实际键处理。
- endpoint物理内容变化或sourceId变null，相关旧边必须失效。heap可以惰性跳无效条目，但其总空间须有明确倍数/常数重建门；graph结束全部丢弃。
- `mergeDiagnostics`缓存只属于未变的edge端点、该commit时间及相同profile/热学参数。每次候选仍按原公式计算当前负ID的mergePair；仅复用不依赖ID的诊断值。不能将旧candidate的merged对象/旧负ID用于后来选择。
- 原质量门仍只是局部采样，不升级为全局光学误差界。强制合并必须继续公开标记。

## 6. 失败、catchup、源账本与清烟

**无效target**在更改requestedTime前拒绝。有效target已记录后，某commit若校验、演化、graph、诊断、内存/测试注入等失败，则丢弃S，本commit对应C/Q head/ID/质量/合并计数不变；requestedTime可保持该有效目标，记录失败边界。此前本次advance已成功发布的较早commit不回滚。

accepted输入ID水位和Q在advance失败后保留；source adapter已经接受的prefix不被假装撤销。其materializedArea对应airborne+pending，不仅airborne。修复可重试同target；若错误不可恢复，显式清烟会把已接受pending一并记入cleared。测试钩子仅在verification注入，不新增生产任意callback。

到maxStepsPerAdvance时，返回completed:false/behindSeconds，公开C停在最后完整commit；不跳过中间输入、不以target伪装committed time。再次相同target从现有Q head继续，不能重复提交已消费源、wind或负mergeID。

host clear顺序：先构造并验证相同stateModel的新空state，再检查旧ledger的airborne+pending，调用现有G4 `events.clearForState(next,{time:physicalTime})`，最后发布新host state并增加explicitlyCleared。provider release错误沿用既有显式计数；pending材料不会丢失或重复计clear。adapter的nextEmissionId跨clear继续单调，tombstone/epoch阻止旧事件复活；新state内部lastEmissionId可以重置，adapter采用已有max逻辑协调。

host update保持现有原生源所有权：prepare → 排wind → commit源到Q → advanceFence(now) → refresh已提交snapshot。即使now==C.time也必须fence。failure时不得把physicalTime/columns/volume发布成未完成的S；已排入Q的合法源保留供重试或clear。

## 7. 必需验收门与执行顺序

1. **默认边界：** 67fa全部字节及默认legacy host状态/图像/源/声音保持。新模块无verification依赖与循环导入，Node/浏览器ESM和既有data-URL夹具均可加载。
2. **输入/查询隔离：** 非法time、ID、profile、NaN/Inf、SPD/尺寸/M、pending/staging预算、错误array/getter、重入mutator全部不半接受。成功same-clock排队后，airborne与公开packet不变、pending增加；fence后才转airborne且≤capacity。
3. **原子性故障：** 在clone/transport/首个与中间合并/诊断/发布前注入一次失败；逐字段比较旧C/Q head/负ID/质量/统计。requestedTime唯一允许按规则改变。移除故障后同target重试，结果应等于无故障fence序列。
4. **队列/时间：** same-clock wind先于emission；同clock wind覆盖；多次same-clock新因果操作；混合未来输入、origin0/4000、20Hz跨界、30/60/120Hz native交付协议、maxSteps catchup、无输入重复fence。区分真正同fence序列与刻意不同分区。
5. **图/缓存等价：** 与事务化朴素batch参考的完整物理状态、队列账本、全部选择顺序、负ID和公开诊断（除新模型明确字段）一致。覆盖sourceId变null、多profile、x并列、长条SPD/多峰、温度/风、Brownian/Taylor、heap重建和缓存别名。新计数`stagingPeakPackets`与旧公开`peakPacketCount`含义分别断言。
6. **G4 host：** 实际逻辑provider的母/子星与地面体、partial source prefix/fault/clear、same-clock新事件、tombstone、watermark和release计数。host失败与重试不能让源adapter水位和state accepted-ID脱节，clear计入pending全部M。
7. **完整成本与光学：** 完整6291/default4096 native单柳（继而双发/分钟积烟）包含COW与发布总成本；对65536无容量oracle做多个物理相位的M/μ/Σ、点密度与有限列τ/透射比较，列BVH误差预算单独记录。多峰/小浓团反例不可只用平均误差。没有全局误差证明就如实保持采样范围。
8. **实际浏览器：** 真实all-logical host、近/远视角、早中冷三阶段与连续两发重新照烟；main/mirror/opaque/composed安全、变风/清烟/暂停/恢复、HDR P/C稳定性、实际GPU与帧分布。CPU通过不构成可见烟形/性能达标。

前6门闭合后才允许接QA host进行实际图像/预算试验；第7/8门未完成前不能变正常默认。需要大幅改善的是完整逻辑源的实际可用性，不能用只测少源、少帧或关闭烟气功能替代。
