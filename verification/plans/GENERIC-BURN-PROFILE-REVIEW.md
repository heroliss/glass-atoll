# 持续释烟推广：最小可落地候选，尚未接生产

**建议保留用户选择的B方向，先做棕榈与扇形两类的可见对照，再推进分裂子星。** 核心是把既有物质逐步留在燃烧体经过的位置，不是提高烟总量、I、光晕或曝光。当前生产仍为12代表/point/two-births；ring-burn/Taylor48是QA组合。本轮只新增verification原型与CPU检查，未修改这两条路径。

## 最小方案与真实接口缺口

- `fireworks-combustion.js`重导出的`describeFireworkCombustion`/provider.`describeCombustion`已提供十型逻辑DAG、family/body/sourceID、birth/life，包含36个分裂父体与144子体、9根fan及104根bouquet。未知fuel/yield/relativeWeight仍保持unknown。
- `provider.describe`有根星初始速度，现有`chooseRoots`能选空间代表；`provider.sample(kind:'root')`只接受无parent的燃烧体。**子体虽然有元数据，实际采样仍被拒绝**，不能借延长父life或复制root坐标声称解决。推广时最小新增接口应是独立`sampleBody(eventId,{bodyId,time})`，只接受active且born的逻辑体，按同一wind和parent继承采过去；保留旧sample语义。ground本身也是现有无parent root，可复用其轨迹。
- 持续源复用`pastSegmentSourceMoments`的五个过去内点、held风积分、热龄化、fullΣ及Taylor q；不重写state/renderer。每格≤.30s、body.id确定性错相首格、最后格取剩余质量，格末才物化。只预留时钟/物质，不预存未来XYZ；每body游标避免展开几千个pending plans。正常事件退休前仍有消费窗口，真正失去descriptor或因果风时必须拒绝。
- 空中整发仍20.35，fan仍.9，bouquet仍2。launch/burst沿用现有短时触发源形状与声音时钟；触发节点life0不冒称真实装药燃烧时长。tails、快门、mirror和光场账本不再领一份烟。carrier是无持续推进的壳体；装饰上升火光的烟产率未建立，不自动补发动机烟。若以后明确增加附着装饰源，应在既有launch预算内单列，不从亮度包络推烟质量。

原型的两项**明确作者分配候选**：空中中心比例.05（沿B组合），ground将既有预算10%留给嘴口、90%转到comet路径。这不是实测比例。若对照生产基线，应显式传原中心.20；不能同时换分配、扩散、光学和释烟时程后只归因于持续源。ground重分配须单列为一次视觉决策。

分裂家族只领一次预算。设root路径份额为1，父体分成n子体后各继承父份额/n；定义`D=Σ(pathShare_i × life_i)`，每体分得`M_family × pathShare_i × life_i / D`，再沿自身life均匀释放。当前四分裂时总物质率在分裂点连续，子体不是新增四份完整质量。这是可审查的作者物质率，不是已知燃料继承或化学产率。

## 三个最重要的视觉反证

本轮实看[R8 hot](../pyro-r8-ascent-hot.png)、[late](../pyro-r8-ascent-late.png)，并对照用户归档第[11](../references/user-lake-single-shell-20261027/11.png)、[17](../references/user-lake-single-shell-20261027/17.png)张。参考没有原视频、快门或统一尺度，且是球状烟花，不能用其饱和橙黄亮度反推笑脸I或烟量。

1. **规整辐条不一定因时间分布而消失。** R8 hot仍能看到由脸心向外的规则细缕，眼部周围的交汇也很整齐。沿48条代表路径分很多格仍可能只是更多规则烟线；不能按“包数更多”通过。下轮固定I/C/风、同physical event的front与oblique各拍hot/late，并看整段运动，若仍像花瓣/轮辐，则时间推广没有完成形态验收。
2. **平滑椭球/香肠是空间核与受光近似的独立问题。** 过去段矩能拉长核，但不能造出细微旋卷和真实遮光；光场颜色正确也不等于烟自然。新增格可能把球排成项链。应检查上传后Σ/eigen、轨迹接缝和代理覆盖面积；不能用shader随机噪声、增glow或任意降alpha掩盖。当前原型没有解决这个问题。
3. **后续发光体若没有对应源，早期中心烟再好也会脱节。** crossette父体.78s后结束，子星仍燃；两地面类型也有真实移动头。必须在这些时段看烟是否留在它们真实过去位置，熄灭后仍随风扩散、被下一发重新照亮。R8远景late的烟很淡，不能据此断言物质已丢失或长期形态已自然；这一张笑脸也不能验收子星/ground。

## 原型与数量门

`verification/fireworks/burn-profile-prototype.mjs`：

```js
const profile=buildBurnProfile(actualCombustionGraph,{centralFraction:.05,groundChargeFraction:.10});
const cursor=createBurnCursor(profile);
const token=cursor.prepare({throughTime,sampleCell}); // 同步构建完整ready批次；失败不提交
cursor.commit(token);                              // 验证后推进游标/物质账
cursor.clear(time);                                // 取消全部剩余预留
```

profile仅含逻辑身份、时钟和物质，完整覆盖所有logical bodies；它不分配EmissionID、不写state、不改物理轨迹。生产的queue预检、异常部分接受fault-lock、clear墓碑和音频只drain一次仍须原host承接；本原型不声称已接好这些外部事务。

seed42，.30s格，包含触发源的完整事件包数：

| 类型 | 全logical bodies | 全路径cells | 现48-family选择的数量估算 |
| --- | ---: | ---: | ---: |
| 牡丹 | 224 | 2498 | 541 |
| 菊 | 192 | 2911 | 741 |
| 垂柳 | 160 | 6291 | 1903 |
| 棕榈 | 12 | 261 | 261 |
| 笑脸 | 120 | 1562 | 627 |
| 爱心 | 144 | 1948 | 663 |
| 分裂十字 | 180（36父+144子） | 1632 | 1632 |
| 闪星 | 160 | 3414 | 1022 |
| fan | 9 | 192 | 192 |
| bouquet | 104 | 973 | 458 |

最后一列执行现有空间chooser，仅统计所选family的cells；**不是已经实现的群组质量/时间/空间oracle，也不是每条原路径都采样**。全路径垂柳单发就超4096密度容量，不能静默截包。种子42相同20Hz起点的单tick最大ready包为5–64，只有CPU数量，不是耗时。所有源最后birth距既有event退休至少.95s，正常dt可消费，不需新增强档案；这不保证任意大跳步仍可采。

保留现有20Hz物理步长和长期M：`airborne+pending+reserved+cancelled`必须闭合。冷热/可见度下降不是删除M；当前Taylor边际方差可体现增长速率变化，但不是爆压最初快速膨胀的流体解。本轮不再调K、TL、σ或新增膨胀模型。容量merge虽保瞬时M/μ/Σ，也会丢多峰形态，应如实报告。

1,048,576 source×packet光场cap同样会约束推广：4096包×菊的1728账本行约7.08M对。不能拿笑脸成功外推全部类型，也不能只算新烟、让旧烟不再受新烟花照亮。超限须显式显示unsupported或另立有误差预算的层级求和项目，不能无声回退中心点光云。本轮不改光场算法。

## 决策建议与CPU证据

先授权**棕榈12条全部路径**与**fan9条全部路径**，在原总预算下做一组连续A/B。包数小、形态差别可读、无子体provider缺口；先证明沿运动留下烟比嘴口/早期棉团改善。再做crossette严格family继承和body采样；最后推进高数量类型/受控代表或merge，不能为“全覆盖”一次引入数千包并假称性能免费。全程源I/RGB、爆时、摄影C、风时序、音频gain和总M锁定，核查同场front/oblique、完整水反射、hot/late/cold与实际成本。

`node verification/fireworks/burn-profile-prototype-check.mjs` **10/10**：30个真实十型graph、总量/子继承、ground重分配、过去cells、30/60/120Hz相同key/mass/真实sampleBody点、失败prepare/clear、真实child GL5/fullSPD、I/色彩独立及provider缺口。7份相关生产源SHA前后完全相同，音频仍`4e5ede…`。仅CPU协议/数值原型，无GPU、电影观感、长时merge光学或全场性能通过结论。
