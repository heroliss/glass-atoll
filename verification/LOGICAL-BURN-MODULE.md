# R10 全逻辑燃烧体：独立纯模块

实现范围仅新`pyro-smoke-logical-burn.js`及本专项QA。**没有接生产、没有修改fireworks/physics/host/旧adapter、没有GPU或视觉通过。** 合同为[全十型源门](plans/R10-ALL-SOURCE-CONTINUOUS-SMOKE-CONTRACT.md)。生产provider仍只提供root/event采样，后续新增sampleBody/router是独立接线工作，不能由本模块CPU通过推断已经上线。

```js
import {
  LOGICAL_BURN_PROFILE, buildLogicalBurnProfile,
  createLogicalBurnCursor, logicalBurnCell
} from './pyro-smoke-logical-burn.js';

const profile = buildLogicalBurnProfile(actualCombustionGraph, {
  centralFraction: .20, groundChargeFraction: .10
});
const cursor = createLogicalBurnCursor(profile, {maxReadyCells:8192});
const token = cursor.prepare({throughTime:now, sampleCell});
// token.cells[i] and token.samples[i] correspond. Stage/validate all queue data.
// Queue only after all predictable validation, then commit actual accepted prefix.
cursor.commit(token); // complete acceptance
// cursor.commit(token,{acceptedCount:n}) for observed partial external acceptance
const nextTransactionCopy = cursor.clone();
cursor.clear(now); // explicit cancellation of remaining reference matter
```

## 值与因果回调

`buildLogicalBurnProfile`读取真实`describeCombustion`的v1图；graph可带额外event geometry字段，但模块不读取/复制XYZ、风、I/RGB、render ledger或RNG。lift/burst保留原time/kind/seed；body/parent/family的life只是原作者物理时间。输出深冻结的自有值，每stream只含身份、时钟、参考M及常数，无body/event原指针；原`matter.fuel/yield/relativeWeight`继续unknown。

空中总M仍20.35（launch.35、central20c、body20(1−c)）；fan总.9、bouquet2。groundChargeFraction=.10为明确作者分配：fan每嘴口.01/对应comet.09；bouquet嘴口.2/104家族共1.8。不是实测kg、燃料或不同品种产率。每root family领一次正预算，child按`pathShare/nChildren`与life积分分份额；当前36父/144子分裂后总初始物质率连续，不重复领四份预算。c必须<1、groundChargeFraction严格0..1内部，避免宣称覆盖却给所有body0。

每body常量元数据O(body)，没有预展开ends/masses/plans。首格按bodyId确定性错相.1–.3秒，后续≤.30秒，最后短格必要时与前格重分；用累计M差及末次残值闭合。完整未来cell数仅一个标量，柳seed42为6291格，但只保存162个stream。逻辑图/stream上限4096、单stream≤32768格；ready批次≤8192，可传更小值。超限明确拒绝，不截源。

`logicalBurnCell(profile,streamIndex,index)`只生成一个身份/时间/M值，不调用采样。`prepare`先枚举已到时格并预检整个ready容量，再按time/key稳定排序调用同步`sampleCell(cell,throughTime)`；不调用未来格。burn cell含`start/end/time/mass/bodyId/sourceID/familyID`；trigger含`eventKind/eventSeed/sourceTime/packetIndex/triggerArea`，time可晚于原触发clock（原.075间隔）。回调应复用既有过去段矩和原触发包形状，不重复实现光学：

```js
// Proposed integration, not currently callable through the root-only provider:
// burn -> pastSegmentSourceMoments({start:cell.start,end:cell.end,mass:cell.mass,
//   samplePosition:t=>provider.sampleBody(cell.eventId,{bodyId:cell.bodyId,time:t}).position,
//   windHistory, transport, sigmaPerp:.30})
// trigger -> provider.sample(kind:'event',time:cell.sourceTime,...) then existing
//   createPyroSmokeEventPackets(...)[cell.packetIndex], overriding only allocated M.
```

回调的返回内容是adapter自有opaque结果，模块只冻结samples容器，**不深复制/验证transport记录**；source世界域、Σ正定、profileId、全局EmissionID/physical queue容量等仍由adapter验证。回调必须只读，不执行queue或其他外部副作用；模块无法回滚调用者的外部操作。异步返回拒绝；回调重入本cursor的prepare/commit/clear也拒绝，保证其本地事务不被中途改写。

## clone、提交、失败与clear

prepare不改变游标、materialized、reserved、watermark或IDs。token仅属于该cursor和当时revision；foreign、重复提交或竞争旧token拒绝。clone共享冻结profile，复制O(stream)进度/账目/fault，不共享tokens或可变游标，供adapter在完整外部prepare事务中建立proposal。

完整commit才推进到requested throughTime。部分commit要求caller给**实际已入队的已排序prefix数**，应结合原queue回执/lastEmissionId，而不是把抛异常一律当0；模块只推进这些cells，记真实materialized并fault-lock，未接受部分仍reserved。它不回滚外部state。acceptedCount0且ready非空也fault-lock；空ready完整commit可以合法推进时间。跨event的全局prefix可按每event筛得对应prefix数，但全局排序/ID分配仍归adapter。

clear取消所有余量、置closed、使token失效，部分失败也可clear；不删除已提交物质或回退时钟。重复clear幂等。一个cursor只属于一个event，**跨事件重复拒绝、同刻新event合法性、bounded seen/tombstone、物理clear和音频只drain一次仍由外层adapter/host负责**；不是本模块已经接好的功能。diag始终列`allocated/materialized/reserved/cancelled/accountingResidual`，没有年龄删M或camera/P依赖。

## 已执行的CPU证据与限制

`node verification/logical-burn-check.mjs`：[23/23](logical-burn-check.json)，actualGPU=false、productionIntegrated=false。

- 十型×三seed真实DAG：所有body正份额；触发clock/seed与lift数量正确，crossette36父/144子、fan9lift/comet、bouquet1lift/104comet；布局变体按真实120/144头，不硬写120。
- 全十型30/60/120Hz和不同batch分割，keys/clock/M逐值相同；每体整个life无缝覆盖、末格M闭合；柳6291格不预展开。
- prepare失败/容量预检在任何callback前拒绝、reentrant拒绝、clone隔离/foreign/stale tokens、部分/零接受、clear与同刻独立新event、两event全局prefix分摊、invalid graph/大绝对clock均覆盖。
- 真实工厂仅在测试dataURL源码中暴露私有simulation/body，未改磁盘FW。child不是虚构XYZ：7485次实际子星内部采样，与独立逐风段`flightSegment`递归路径比较最大位置差0；复用真实GL5/pastSegmentSourceMoments、原trigger packet shaping和physical state。
- fan/bouquet/crossette在真实held风下30/120Hz的ID/time/M相同，出生μ/Σ最大差约1.07e−14；独立位置oracle最大差7.11e−14m。此oracle独立于生产wind-prefix求值过程，仍复用既有单段物理公式，不称独立实物轨迹验证。
- 专项运行期间FW/physics/audio/host/旧adapter/state/source-moments七份文件SHA前后相同。这里不代表所有旧GPU/整场测试已重跑。

旧[20/21](logical-burn-check-first.json)保存：async拒绝夹具选了无ready的窗口，callback根本不执行；改为实际有ready窗口后通过。再加reentrancy门时[21/22](logical-burn-check-reentrancy-fixture-first.json)是旧大小写敏感`/Stale/`与新消息`stale`不匹配，改夹具为大小写无关，未放宽数值门。之后添加双event prefix门，最终23/23；未覆盖原失败。

没有全source cohort、没有GPU bake或新合并算法。现4096密度merge会丢多峰/未来热速度相关；可选resolved光场仍受1,048,576 pair cap。十型源“可以规划”不等于形态自然、分钟积烟或60fps预算通过；实际接线后仍需G6/G7。源M不是kg，原始参考图/曝光不能反推其绝对值。声音SHA仍4e5ede41…，本模块不消费或制造音频事件。
