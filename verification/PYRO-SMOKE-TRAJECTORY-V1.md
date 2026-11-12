# trajectory-v1：有限真实轨迹烟源候选

**已实现、默认关闭；CPU验收，不等于实景通过。** 合同和反审见 [研究稿](plans/PYRO-SMOKE-TRAJECTORY-SOURCE-CONTRACT.md)。此轮没有改 main、physics、audio、state、renderer、光学g/I或原始烟核covariance；主代理负责显式接线及同相位图像/GPU成本验收。

## 接线

```js
const fireworks = createFireworks(THREE, existingOptions);
const smoke = createPyroSmoke(THREE, renderer, {
  time, wind, capacity: 4096,
  sourceModel: 'trajectory-v1',
  sourceProvider: fireworks.smokeSourceProvider
});

// 保持现有一次drain；新源不进入声音数组。
const events = fireworks.drainEvents();
fireworksAudio.enqueue(events, existingAudioOptions);
smoke.update({time, windVector, events});
```

不传 sourceModel 时仍为原 `legacy9`，原支路的状态输出、9核几何与事件处理保持不变；没有自动启用新模型。sourceModel为工厂选择，不提供混杂来源的live切换。要换模型需显式重新建宿主/清理epoch，不可让原legacy adapter与新scheduler同时注入同一事件。

### 只读provider

`fireworks.smokeSourceProvider.describe(eventId)` 返回深冻结元数据：真实root IDs、baseVelocity、birth/life、shapeFrame、baselineVelocity、burst/end clocks及原source-event clocks。它不返回未来世界XYZ、颜色、candela、P/C，也不提供parent/child可变对象。

`sample(eventId,{kind:'root',time,bodyId})` 返回该root在精确出生时刻的实际世界点；`kind:'event'`配eventKind/seed返回原launch/burst位置。只允许已出生的past/current时间；真实event必须仍active且风历史覆盖其因果launch。future、未燃烧root、child冒充root、缺descriptor或风裁剪均明确拒绝。位置通过现有sampleBody与实际windTimeline得到，不推进RNG/模拟，也不用未来恒风预测、当前帧插值或旧burst点补位置。

provider只用WeakMap缓存不可变副本，没有强event archive。宿主在最后一次source提交（空中burst+.65s，ground最后launch+.6s）后释放租约；没有延长active2寿命。失去因果范围的大步必须报错；仍active且因果充分的约5.5s大步已实际CPU通过，并非一律拒绝>.055s。单次物理catchup还受原state最多200个20Hz tick限制，新host在提交前显式拒绝越过此预算，不能偷偷跳过物理时间。

## 固定物质与有界计划

| 类别 | 核数 | 参考面积 |
| --- | ---: | ---: |
| 8类空中完整单发 | launch9 + 中心3 + root12 =24 | .35 +4 +16 =20.35 |
| fan | 9个独立launch×9 =81 | .9 |
| bouquet | launch9 | 2 |

只有空中单发满足≤25的候选上限，不能把fan的原81包藏在“25包”宣传里。burst总20不增；20%中心/80%轨迹是作者候选分布，不是测量的烟产额。root按immutable初始相对速度做确定性几何分层；笑脸保四部位，按所代表的等参考物质母星数量分配mass，不读光强、颜色、闪烁、音频能量、曝光、相机或画质。0/.35/.65等时钟属于此候选的有限求积，不意味着真实燃烧只发生于这几刻。

新模式在launch时预留整发面积，未来计划仅存逻辑key/clock/物质份额，没有未来XYZ或数值emissionId。到时才查provider，将launch/中心/root全部已到时源按time和稳定key排序，由唯一scheduler统一分配单调ID。原sourcePackets闭包仅通过文件末尾export alias复用，原函数及默认输出没有修改。

中心用旧中心和首对反向偏移，原covariance；root的birth covariance逐字节为旧[1.6²,1.1²,1.6²]m²，不改thermal12/buoyancy.35。没有增加烟量、光强、bloom或新纹理。

## 事务、清烟、诊断

每次先 `prepare` 完整batch：身份、profile、容量、可表示的每包M、所有provider位置均验证后，host才改wind、提交源并advance。普通输入/provider/容量失败不会改变物理状态或源账本。prepare/commit token与epoch/revision/state ID绑定，不能重用或越过其他状态写入。

底层queue若意外抛错，**没有假rollback**：通过实际lastEmissionId核实已接受数量，记录fault/partial acceptance并锁定，必须显式clear。测试包含“第3包抛错已接受2包”及“接受后才抛错”的情况。

清烟前仍先消费原drain batch；然后 `smoke.clear()` 同时清除物理烟并取消已知旧事件全部未出生reserve，包括launch时已预留的futureburst/root。原source事件晚到不重生烟，同刻真正新eventId合法，numeric emissionId不重置。已忘记身份且早于watermark的未知stale事件明确拒绝，不能静默丢M，也不能重建位置。上层若已经遇到不可恢复provider错误，恢复时应直接clear故障host；不要先重复一个已知必失败的flush阻止clear。

新模式诊断：

- `smoke.diagnostics().events.allocatedArea`：已接受事件的全部作者预算。
- `materializedArea`：已提交给state的量（state可能还有小于一tick的pending）。
- `reservedArea`：尚未到时/提交的量。
- `cancelledReservedArea`：显式清烟/释放宿主时取消的未出生预算。
- `accountingResidual = allocated − materialized − cancelledReserved − reserved`，仅有浮点余量。
- host原 `explicitlyCleared` 只计物理state中airborne+pending；与cancelledReserved分账，避免把未出生M叫airborne或重复计数。

关闭persistent显示不改变物质；pause的同刻重复调用不重排源。新适配器与旧events诊断字段不同，不应继续用旧`queuedReferenceArea`当新模式预算。预留/identity/seen均有硬容量；容量失败显式报错，不丢包。物理烟仍由原4096容量状态做同profile守矩合并；本候选未改变合并误差或删烟策略。

## 实际CPU证据

[生产CPU检查](pyro-smoke-trajectory-check.mjs) / [完整JSON](pyro-smoke-trajectory-check.json)：**29/29**。

- 全部10类实际factory/provider/host串联；空中24包，ground81/9，面积如上，最终provider租约为0。
- 同timestamp真实风输入下，双发48包/M40.7在30/60/120Hz的packet/source时空与原4个sound事件逐字节一致。它不把不同分帧的风平滑采样冒称同一输入。
- source出生点与独立sampleBody查询完全相同；捕获实际queueEmission验证root covariance逐字节等于旧sourcePackets。
- zero/1/16/64倍I不改变源物质/几何；descriptor重排不改变ID分层；0面积、无效profile、重复/冲突、tiny不可表示M、容量、stale token/ID、真实provider异常均检查。
- clear在launch就取消整发futureburst/root；同刻新ID、pause重复、迟到旧burst不再生M。
- 60s仍24包/M20.35，无年龄删除、强event archive或未完成租约；不是持续肉眼可见保证。
- 三个default源的精确inverse normalizer可逐字节还原本轮封存版本，不做宽泛代码块/空白抹除；默认legacy9实际factory快照/事件也与原源码一致。

已重跑：旧events **36/36**、host **20/20**、state **50/50**、physics **22/22**、audio **12/12**、intensity **17/17**、cluster **14/14**、medium **12/12**、past-bounds **16/16**、scalar **7/7**、phase **10/10**。日志前缀 `verification/trajectory-*-default.log`，对应原JSON为当前源结果。

```powershell
node verification/pyro-smoke-trajectory-check.mjs
node verification/pyro-smoke-events-check.mjs
node verification/pyro-smoke-host-check.mjs
```

## 尚未验收/边界

仅12条母星路径、两个释放年龄，未覆盖crossette子星或长柳整段燃烧；等参考物质不是实测质量。几何分层不是完整星群密度矩守恒，研究稿已经量出2.49–4.15m代表点RMS误差。新烟可能从一个椭球变成多个亮球，必须用固定摄影/相位/风/光学的正面、侧面及镜像图和连续短片判断。

renderer仍保留条件均值照明、中心排序/薄层空气折叠、无source→smoke自遮挡和volumeDOF等既有近似。provider精确不代表联合流体/辐射传输精确。24比原18增加33%长期包数，展开位置可能增加覆盖；没有GPU/整景FPS成本结论，不能据此承诺60fps。

## 封存

原文件与报告：`verification/baselines/smoke-before-trajectory-v1/sha256.json`。physics/audio/state/columns/renderer与该封存逐字节相同；音频仍 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。

当前文件SHA256：

- `fireworks.js`：`6b37e0a635975ede060589c8b42ed0b273a79ed75aa8cbbca36095e3a63e731f`
- `pyro-smoke.js`：`174adec41bf2214896cdc6b8698806042891a9f5c5974f2c9ba2ca5c870c789d`
- `pyro-smoke-events.js`：`9914c16b30e564c241bba1cb58abe82b5b1df551a95ffb60131a3727ebd0dcc1`
- `pyro-smoke-trajectory-events.js`：`a3461a355800b00546dd03c3a6a2cd9179d53a32f3463eedbc595d8169d654ea`
- `verification/trajectory-default-normalize.mjs`：`34dfcae90f245d1c7c4c0d15f32a5a755a1fc107247f9db8c893f0c290d3d064`
- `verification/pyro-smoke-trajectory-check.mjs`：`1c4e4355cca5553acb39277beb57533e7a19a6aef0baad02b997e051e17ad2d1`

独立接口反审补充：prepare/commit token检查state clock/ID/epoch，但不检测provider在同clock被另一驱动改写风或root pose。当前host在唯一主线程同步调用prepare→setWind(state)→commit，中间无await且不调用provider更新，符合provider在该短事务内不可变的契约；不能把token本身说成具有provider版本冲突检测。
