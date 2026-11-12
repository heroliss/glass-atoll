# 有界轨迹烟源：候选合同与三轮反审

**研究稿，不实施生产。** 先完成 legacy / RMS / phase / 两者的同相位光学四组对照；如果仅照明改进已消除“黄棉团”，本方案可以不进入生产。依据见 [视觉与物理复审](../PYRO-SMOKE-VISUAL-PHYSICS-REVIEW.md)。本轮只新增 verification 原型与本文，不修改 runtime、音频、半径或物理时间。

## R1：先推翻数量与物质假设

**被否决的第一直觉：**“原9中心包 +16轨迹包 =25包”。它漏算现有9个 launch 烟包，空中单发实际34包。仅称每次 burst25包会误导总成本。当前 fan 更是9个独立launch×9包=81包，不能声称全部10类均受25包约束。

**最小首测候选 trajectory-v1：**只覆盖8类空中事件；保留原 launch9，burst 改为中心3+真实轨迹12，总24包/完整空中单发。burst参考面积仍20（中心4、轨迹16），launch仍.35，整发20.35。中心比例20%是明确的作者分布假设，不是实测烟产额，也不是预定更好看。两个地面类型先维持现有 launch 政策，不能为统一上限伪造 ground burst 或偷偷删烟；如要求 fan 全发≤25，需另立地面源合同。

- 中心3用现 sourcePackets 的中心与第一对反向偏移，mass分别4/3、相同旧 covariance；时刻 burst+0/.075/.15s。默认 legacy9 的源码与行为不改。
- 轨迹12各只排放一次，6个在母星出生+.35s、6个在+.65s。每个 mean 必须是该实际 star 在精确出生时刻的世界位置。初版沿用 burst covariance diag[2.56,1.21,2.56]m²、thermal12、buoyancy.35，以便先隔离源空间分布；不同时增加拉丝噪声、光强、各向异性核或核数量。
- sourceModel 首版只作工厂选项 `legacy9`（默认）/ `trajectory-v1`。不要把它复用为 `clusterModel`：一个改变烟物质分布，一个改变照明代理。可见 persistent checkbox 仍只管光学开关，不改变物质。
- 参考物质均分给逻辑母星，再按几何分区所代表的母星数量给12个代表核权重。不得读 candela、RGB、strobe开关、`intensityScale`、audio.energy、C、P或画质档。零光测试仍有相同烟物质。

**选择规则：**只选 `!parentBody` 的真实母星；使用不可变 `baseVelocity − baselineBurst.velocity` 进行世界几何 maximin 分层，稳定 body ID 破同值。笑脸四部位各保至少一个代表，再填满12；球形需覆盖三轴正负。其余所有母星分给最近代表，其数量作为作者等物质权重。选择不随相机/当前亮度变化，不推进任何生产 RNG。末包只闭合数值余量，绝不补增源强。

**反例仍在：**母星等参考物质不是实测每颗药粒质量；crossette .78s才分裂，首测仅覆盖母星，未解子星排烟；长柳十余秒燃烧也未解。两个时间层是有界时空求积，不应称完整持续排烟。12个实际位置代表几百条路径仍可能产生“更多亮球”。

## R2：时间、事件、清烟不能靠看起来顺

### 必须到时采样，不能在 burst 冻结未来坐标

在 event 创建/爆点时可锁定 body ID、分区权重、未来**时间**，不可填未来 position。等 `birthTime <= throughTime`，使用已收到的真实 `windTimeline` 与 `sampleBody(body,birthTime,timeline)`。不读 getBounds 的恒风未来预报，不用当前头坐标代替精确出生坐标，不按显示帧插值、补发或重定时。body 与 rocket 的实际 burst pose 必须已按该风历史解析。

生产源描述符必须在 active prune 和 wind prune **之前**被源提供器消费/保留到最后+.65s。不能事后用 audio 的 burst点猜回整组星。最稳妥的最小扩展是在 simulation 的事件创建/推进阶段提供只读观察钩子，发出意图、到时取样后才 prune；不改数值积分/RNG。若首测只利用当前 main 的物理dt≤.055s约束，必须对大步穿过整事件而失去 descriptor 显式拒绝，不能无声丢M。这个边界是生产前P0合同，不是原型已解决的任意大步保证。

### 单个宿主合并源；声音仍只拿原数组

当前 `fireworks-audio.js:52` 将未知 kind 默认当 launch。**新源不得加入 drainEvents/audio数组**，即便复用字段看似方便。

建议协议（仅接口草案，未落生产）：

```js
const events = fireworks.drainEvents(); // 全局只一次；声音原流不改
const sourceFrame = fireworks.drainSmokeSourceFrame({ throughTime: time });
// sourceFrame: { intents, anchors, readyThroughTime, revision }
// intent有稳定key/时间/物质份额，无未来XYZ；anchor仅含已到时的实际XYZ。
fireworksAudio.enqueue(events, originalAudioOptions);
pyroSmoke.update({ time, windVector, events, sourceFrame }); // 唯一烟宿主
```

host 选择一个完整 sourceModel 分支，不能把原 adapter 的20面积中心源与新轨迹源同时注入。新分支将 launch/中心/轨迹都作为计划；所有已到时的 kernel 按 `(time, 稳定UTF-16 key)` 合并后，由一个宿主分配严格递增 emissionId，统一 queueEmission，再 advanceTo。稳定身份建议 `(epoch,eventId,modelVersion,component,bodyId,slot)`；可重送但须 fingerprint一致，冲突或容量不足在完整batch接收前失败。不得从sourcegain/相机或帧号生成身份。

**为何不能两条队列各自编号：**当前 state (`pyro-smoke-state.js:114–119`) 要求 emissionId严格递增，而 legacy adapter 会提前排入未来.6s的中心包。若一边预占/提交未来ID，一边晚到轨迹核持较小ID，会被拒绝，或不同分帧改变merge顺序。新模式所有未到时源只保留意图和 `reservedArea`，没有未来位置、也不先提交ID；legacy9默认分支原样保留。首版不支持一个host内混杂两种sourceModel的live切换；若要切，必须明确clear/取消旧reserve的epoch边界，不暗中迁移。

### clear 是同一条事务

1. 同刻先 drain 原事件一次及到时anchors，并消费到当前 time；声音只消费原事件。
2. 取消/墓碑化旧epoch所有已知、尚未到时的计划；否则旧星将在clear后重新冒烟。
3. clear物理状态，计入 airborne、state中待提交量及源提供器尚未materialize的reserved量。分别报告 `materialized / reserved / explicitlyCancelledReserved`，别把尚未排出的M称airborne或重复计入emitted。
4. emission ID不回退；已知旧包晚到不重放，真正新eventId在同一暂停时刻仍合法。

源分配面积、已生烟面积与被用户取消的余量满足同一账本，源到时数量完结后释放body引用。不能把source计划留在长期烟库、延长active2槽位，或按源年龄删物理M。关闭显示仍继续物理累积；暂停冻结物理time且不重复到时排放。所有画质档共享同一源序列，不能以降档抽掉source换性能。

## R3：原型通过不等于新烟形通过

[CPU研究脚本](../pyro-smoke-trajectory-research.mjs) / [完整结果](../pyro-smoke-trajectory-research.json)：**12/12**，不调用GL、不修改runtime。

- 8空中类型×3seed的原型最多24包，burst面积20；零光/普通/16倍光的源选择和物质相同。launch9形状调用现有 sourcePackets 原闭包的内存副本；不是重写其随机形状。
- ring/crossette在相同timestamp风输入下，30/60/120Hz的源ID/time/position及20Hz烟状态逐字节相同。双发实际合并48包、面积40.7，原audio仍只有4个launch/burst记录。
- burst冻结未来坐标的反例：+.2s变风，在+.65s轨迹核处错7.909cm。原型在出生时精确采样，对各自实际风历史的oracle误差0。
- 按main每帧1.4s指数平滑得到的是不同piecewise-held风输入：30vs120Hz的出生点差0.629mm，60vs120差0.208mm。不能把“同一个平滑公式”冒称相同输入；这不是源队列的帧率独立性失败，也不应量化风来让数字为0。
- 全部物质materialize后，在零风输运中到60s仍24包/面积20.35，未按年龄删除；这不证明60s后应持续肉眼可见。
- clear在部分源已出生时，将剩余reserve一并取消，总计20.35；这是CPU计划协议见证，尚非生产host的迟到重送/故障原子性验收。

**空间归约的自我反证（非通过门槛）：**对等母星作者物质、按代表的相同出生时间比较全部母星真实位置，12代表路径已有可观误差：

| 类型 | 轨迹物质质心偏差 | 代表点RMS偏差 | 最大代表点位移 |
| --- | ---: | ---: | ---: |
| peony | 0.137m | 3.809m | 7.863m |
| ring | 0.296m | 2.495m | 5.920m |
| crossette | 0.490m | 4.147m | 6.750m |
| willow | 0.406m | 3.753m | 7.780m |

它们是几何求积误差，不是与真实烟尘测量的误差。不得以“用了真实star坐标”声称完整位置/第一二阶矩守恒，也不得为了抹掉偏差把烟核挪到不存在的星上。本候选故意只给最小可推翻A/B，不预定可上线。

## 最小生产准入与拒绝条件

唯一owner一次接 source provider/host/clear；先不动光学、烟核covariance、g、源gain、事件宽度、曝光或音频。落地后须补：同timestamp风30/60/120完整host（含双发/重送/清烟/暂停/zero-I）、缺失descriptor fail-closed、分配/保留/取消面积账本、capacity故障不半注入、source引用在+.65s后释放、legacy9默认完整QA仍通过。原型的12项不代替这些生产测试。

实际图像A/B固定seed、phase、密度时钟、风、camera、C与相同光学配置，P按各自安全bound选择并记录输出补偿。至少正面/侧面/镜像各一张及连续展开到冷烟短片。检查中央团是否减轻、是否变成规则12亮球、眼口附近是否出现错误烟轮廓、旧烟是否自然变薄而不自发光；不可用改变摄影/光强隐藏失败。

成本以完整单发18→24包（+33%存留数量）记账，但GPU overdraw不按包数线性预测：位置展开会扩大覆盖，长期4096包的容量合并/采样误差也会更早出现。沿用现有renderer/columns测同viewport单发、双发及逼近容量时实际CPU/GPU，不把Node原型当FPS。不以降档删M/改source数、抬opacity或添bloom兜底；图像或成本不成立就保留legacy9，或另立有明确上限的下一候选。

## 当前冻结

本轮只新增本文、`verification/pyro-smoke-trajectory-research.mjs/.json/.log`。生产 `fireworks.js`、physics、audio、events、state、host 的开头/结束hash均相同；音频仍为 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。尚未增加sourceMode接口、生产队列、UI、截图或性能承诺。
