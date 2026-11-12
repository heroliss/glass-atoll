# 棕榈与扇形：可拍摄的持续释烟候选

已实现但**没有替换生产默认**。只改`pyro-smoke-trajectory-events.js`与host的profile allow-list；main、物理、燃烧体元数据/provider、源I/RGB/RNG、音频、扩散状态及renderer均未改。

```js
createPyroSmoke(THREE, renderer, {
  sourceModel: 'trajectory-v1', sourceProvider: fireworks.smokeSourceProvider,
  emissionProfile: 'palm-fan-uniform-burn-v1',
  kernelModel: 'past-segment-v2', centralFraction: .05, trajectorySlots: 48,
  dispersionModel: 'taylor', lagrangianSeconds: 10,
});
```

以上modern参数与原生预算为显式候选合同，组合不符即拒绝。原`two-births`及`ring-uniform-burn-v1`仍保留原行为；生产point/.20/12/Brownian没有被此选项自动改变。新profile仅作用原生palm12/fan9；其他八型保持原two-births物理计划，并报告`effective:'two-births'`、`reason:'palm-fan-not-applicable'`，不会强行套入候选。

## 唯一预期差异

**palm先验收。** 原launch9包M.35、原central3包M1及其计划逐值保留。12根真实root各自原来的份额共M19沿自身life均匀释放，整发仍20.35；不根据亮度、火星尾段或音频能量重新分物质。不是12条替代全部更多母星的代表路径：当前palm恰好只有12根，全部采样。

**fan随后验收。** 原9次launch及各自时钟不改，每次总M仍.1；作者候选把10%即.01留在9个原嘴口形状包、90%即.09转到同次真实ground comet路径，整发仍.9。此10/90是公开的作者分配，不是实测燃料/烟产率。没有额外burst事件，不增加发动机烟。嘴口核的既有位置/形状不因分配改变，只缩减它承担的质量。

每根按body.id确定性错相首格`.1..3s`，后续≤.30s，到实际life严格结束，最后格取剩余份额。GL5只采格内已发生的真实路径，通过原`sourceProvider.sample(eventId,{kind:'root',bodyId,time})`：当前fan的9根ground也是无parent root，此真实接口已实际调用验证，无需新增或虚构body API。风、热龄化/fullΣ、Taylor q均复用原段矩路径，不读未来风/死亡端点，也没有shader噪声或曝光增益。

launch时预留完整整发预算，不预存未来XYZ/EmissionID。既有prepare/commit/capacity预检、故障部分提交锁、统一排序ID、closedThrough、clear epoch/墓碑沿用原实现；clear取消所有未物化预留，不以年龄删除已在场的物质。格末批处理仍有≤.30s延迟；这不是连续化学或流体排放的精确解。

## 数量与CPU接受

`node verification/palm-fan-burn-check.mjs` **11/11**。33种子×真实十型共330个planner案例：

| 类型 | 完整包数实测范围 | 原生合同上限 | seed42 |
| --- | ---: | ---: | ---: |
| palm | 253–266 | 276 | 261 |
| fan | 190–197 | 207 | 192 |

上限还由原生ID/数量/寿命范围约束：palm每根≤22格、12根+12触发包≤276；fan每根≤14格、9根+81嘴口包≤207。数量、life或clock合同改变时拒绝，不静默截断。两发上界仍在2048计划容量内；这不是小时累积或整场性能保证。

实际old/new比较包括生产point默认十型，以及已有ring候选的完整source logs/state/diagnostics逐值相同；真实host的默认与ring分支亦逐值相同。palm/fan在相同held风下30/60/120Hz的时钟/ID/M严格相同，mean/Σ最大差约`1.16e-14`。单发最终reserved0，状态airborne+pending与预留/取消持续闭合。I0蓝色与I16红色不改变物质/路径。

新增门还覆盖provider/容量失败时状态与预留/ID/closedThrough不变、clear使旧token失效并可接受同刻新event、退休历史拒绝、底层部分queue失败仍如实fault-lock。原ring **13/13**、host **6/6**、Taylor **18/18**复跑通过。

首次专项夹具失败留在`palm-fan-burn-check-fixture-first.json`：夹具误用state.setWind参数形式、fan时刻未排序、以及把`.1*.1`误要求与十进制`.01`逐bit相同。修正的是夹具API/时钟/精确预期，没有修改运行时去迁就这些错误。

## 精确旧版保护与freeze

两份完整旧源封存在`verification/baselines/smoke-before-palm-fan-burn/`。新`palm-fan-burn-normalize.mjs`用9个adapter和1个host的固定字串逆变换，完整还原旧A40/d8字节；缺失/重复拒绝，额外段核改动不会被擦除。原ring/host历史scope检查只前置这个窄层；实际生产/候选行为仍由真实current factory与旧模块对照，不以逆变换假称新候选等于旧时程。

- adapter SHA256：`4070f8f053ff9f9c40205a2c7e0dadc48ea6a5d257d7093b12fb5b0d4d4cd4da`
- host SHA256：`6cdd9a3da7aa359bba0f90a0403261823edc2ac92ed0159477990308ad1e717a`
- 旧adapter：`a40d150973d9e7a0cd720bebe160c4ff8a7795ddbd10ea09bc37436da8b3b219`
- 旧host：`d8bcccf2803f95bcbd050eb0c6e5490dfc2c53922d56c99e6a37ff60977b63d4`
- 烟花音频仍：`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`

## 留给实际电影的门

root先拍palm，再拍fan：新旧同事件fanout，固定I1、摄影C、真实风时序、天气、源光场/光晕状态和总M；实际相机按事件包围选择，不为更多烟改曝光。至少看hot、燃烧后段、冷烟及完整倒影，连续播放检查有无格状节拍、规则烟绳/椭球串、源位置脱节和拖影。应记录field有效或显式unsupported、真实GPU/CPU成本与GL错误。

均匀释烟和Taylor边际扩散不等于爆压/涡流、源烟自遮挡或多重散射。即使CPU与质量账目通过，若只是更多平滑香肠或更淡的烟，仍不能接受自然观感。本报告无新GPU、电影形态、主观听感或性能通过结论。
