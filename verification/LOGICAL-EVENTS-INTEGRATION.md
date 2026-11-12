# R10 全逻辑体源：独立adapter与host opt-in

实现只改新增`pyro-smoke-logical-events.js`和host的显式profile路由；原trajectory adapter、source moments、state、renderer、物理与音频没有由本实现修改。纯cursor继续冻结235dff。**main没有选择新profile，无GPU/视觉/性能通过声明。** 新FW的G1和columns T-only接口由另一代理独立实现/验收；这里记录其CPU消费边界，不把它们冒充本实现或已完成真实网页接线。

```js
createPyroSmoke(THREE,renderer,{
  sourceModel:'trajectory-v1', sourceProvider:fireworks.smokeSourceProvider,
  emissionProfile:'logical-family-continuous-v1',
  kernelModel:'past-segment-v2', dispersionModel:'brownian',
  centralFraction:.20, groundChargeFraction:.10
});
```

past-segment-v2/Brownian须显式匹配，不能借缺省point默默切换。trajectorySlots仍由旧host允许12/48，但新profile不以它截断body：coverage为all-logical。原three profiles与legacy9保持原路由，不提升Taylor/palm-fan或改变默认物质量。`.20/.10`是作者分配，不是kg、fuel或实测产率；空中20.35/fan.9/bouquet2保持到浮点舍入误差。

## 真实provider、事务与清烟

`createPyroSmokeLogicalEvents({state,sourceProvider,…})`要求真实`describe`、`describeCombustion`、`sample`及`sampleBody`，缺失明确拒绝，绝无root/假XYZ回退。两个descriptor的event/type/seed/ground/time/burst/end、全部root元数据和trigger clock/seed逐一交叉核对；graph未来birth可以预留M，采样只在到时的过去GL5内部。body响应身份/time和有限世界坐标也检查；触发包复用原createPyroSmokeEventPackets的形状与种子，仅取已分配M。

接口与旧adapter协议对应：`prepare(events,{throughTime,windVector})`→opaque token；`commit(token)`、`consume`、`clearForState(fresh,{time})`、`diagnostics`、`dispose`。没有音频drain或重放，也不分配与render tail/快门/mirror对应的额外M。

- prepare克隆每个pending cursor，只有完整provider读取、ready量、身份/时间/ID、世界域、full-SPD/归一化、温度/浮升及总M检查通过后才返回token。不会先往物理队列写几包再发现可预测错误。每次ready≤8192、pending event≤128、stream≤2048、身份≤2048，seen/tombstone与recent/completed日志有界；没有全部未来plans或position archive。
- 原wind历史保留“上次source horizon−.30”及前一个held knot，覆盖当前尚未到时的跨帧格；不从新horizon裁掉本批旧cell所需风。风数值不量化，不读未来风。直接adapter调用者仍须提供与host原生transport一致的Brownian state；published Brownian诊断不暴露全部K/热常数，不能声称任意外来state配置都已自动验证相同。
- 提交前检查state time/lastEmissionId没有变，按全局`time/key`排序，唯一递增EmissionID只在adapter实际queue阶段使用。意外queue异常结合实际lastEmissionId识别已接受prefix；其M和cursor如实提交、其余保留reserved并fault-lock，不假回滚。
- fault后host的physicalTime可能仍是上次成功值，而proposal cursor已有更晚throughTime；clear丢弃这些cursor并取消其余reserve，不倒退调用cursor.clear。fresh state必须为空、同profile、同当前time，4000秒不会重从0追赶。已入队airborne/pending由host原explicit-clear账目处理，source侧仅取消未入队reserve，不双算。
- 清烟tombstone到整发最后source出生，旧burst/child不会复活；同刻新ID仍合法。未知旧时间拒绝，不重建已退休历史。完成后释放provider缓存；release异常只披露计数，物质不重发。

`diagnostics`区分pendingStreams与remainingCells、all-logical参与数与完成后materializedBodies；源cell数不是Gaussian视觉精度。completed/recent仅32项，不能拿它当所有历史物质档案。长期冷烟由物理state保留，非燃烧事件强引用。

## 独立T-only host消费者

host另增`writeTransmission(origin,endpoint,out,{reflection=false,planeY=0}={})`，只接受Array/Float64Array length3并返回同一out。原`transmission`实现逐字保留；空场/无效水面交点写[1,1,1]，有效mirror仍从原water-hit开始，委托`columns.writeTransmissionBetween`。没有改反射光程、增加雾或截断负交点。四类主/镜像射线×Array/F64已与原T逐值相等，但完整FW/GPU/性能门归该独立fastpath验证，不用四条CPU射线外推整场。

两层inverse分开：

1. `normalizeLogicalBurnHostSource`只逆五个profile import/signature/allow-list/guard/router片段；
2. `normalizeHostTransmissionWriterSource`只移除可选writer方法块。

两层合成后完整恢复封存host SHA `6cdd9a3da7aa359bba0f90a0403261823edc2ac92ed0159477990308ad1e717a`。各层缺失/重复拒绝，额外其他变更不会被擦掉。基线在`baselines/r10-host-before-logical-burn/pyro-smoke.js`。旧host源码守卫若直接读新host，须显式前置这两层再进入原guard；本实现没有去改旧测试令其跳过范围。

## 专项CPU结果与未通过的范围

`node verification/logical-events-check.mjs`：[18/18](logical-events-check.json)。

- 实际十型事件全部body路径最终有M：224/192/160/12/120/144/180/160/9/104；packet数2498/2911/6291/261/1562/1948/1632/3414/192/973。总M在约5e−14浮点误差内闭合，reserved0；所有body是实际工厂私有物理对象，未制造未来XYZ。
- child/fan/bouquet真实held风30/60/120Hz，IDs/time/M逐值相同，出生μ/Σ数值差在1e−9门内；完整单元纯cursor另有23/23与独立8/8。本专项不重复GPU。
- known provider/graph/numeric/capacity失败前原物理state与adapter账目不变；同key冲突/重复/未来/缺launch、stale tokens、queue异常前接受或接受后抛、旧time fault clear、同刻新ID、4000秒origin均覆盖。
- 三个旧profile真实host与冻结旧host的完整snapshot/event诊断相同（two-births、ring、palm-fan）；legacy9亦同。新groundChargeFraction缺省.10与显式.25实际入队比率2.5，整发.9不变，证明不是仅字段标签。
- G1落盘后，另用**真实原生provider**直接喂新host，crossette180体、fan9体、bouquet104体全部完成，无QA sampleBody wrapper或root回退；这是CPU集成，不是当前已加载浏览器/生产默认。

全源正确性回放使用capacity65536以隔离旧密度merge成本。第一次误用4096跑完整柳6291格会重度触发原有merge，我停止了自己的测试，保存[范围记录](logical-events-capacity-scope-first.json)，没有发布通过数。**65536测试不代表生产4096性能通过**，也未改变生产容量。初期15/15另存first；G1落盘后旧“生产provider缺sampleBody”的负fixture过时导致[16/17](logical-events-g1-domain-first.json)，改为明确删掉sampleBody的root-only负fixture后通过，未调整运行时去拒绝合法新API。

现4096容量merge丢多峰与未来热速度相关；没有全局cohort来掩盖形态。可选resolved light-field仍有1,048,576 pair cap；新profile可以规划不代表“所有源＋全部高级照烟”同时支持。生产仍point/.20/12/two-births，新profile尚未main opt-in；分钟积烟、子星/地面实际烟形、主镜像范围、4096压力与真实整场CPU/GPU/照片感是下一门。音频原4e5ede41…、源I/RNG/ballistics均未由本实现更改。
