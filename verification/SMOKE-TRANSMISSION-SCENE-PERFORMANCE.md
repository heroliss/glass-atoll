# 烟透射完整帧交错成本：实际结果与CPU逐帧归属

入口[smoke-transmission-scene-performance.js](smoke-transmission-scene-performance.js)，SHA256 `f4c847c950b20470ef561ad315b93fb90a397cd60c781ae23efc3dfb7de62825`。

```js
runSmokeTransmissionScenePerformance(a,{
  gl:originalMainGL,seconds:8,burstTime:actualCommonBurstTime,
  declaredSeed:42,drainMs:2000,minSamplesPerMode:30
});
```

root先准备同刻两发实际菊花、每发192头（例如seed42/43，seed由owner声明）、无queue/autoLaunch，burst+.1附近暂停，固定相机/C/质量/风。tailIntegration.requested必须是**adaptive**，两透射模式中均不改它。caller独占one-shot probe槽，不持qaRenderLock；声音、烟profile、受光状态等保留caller现场配置并写入setup，helper不补曝光/清烟/发射。

只切`a.setSmokeTransmissionMode('legacy'|'fast',{resetHistory:false})`，用`a.smokeTransmissionMode`读实际回显。legacy由main仅向FW隐藏medium.writeTransmission，保留同一actual host/原transmission函数；fast使用真实host writer。source/density/renderer/物理回调及adaptive尾迹不由helper切换。调用方先做暂停同事件三缓冲/图像等价门，不能以本计时替代数值兼容性。

从冻结双菊夹具244fe7作16处明确窄改：export/schema/标签、MODES、setter/getter/restore、实际routeEcho、固定adaptive前置及原频率元数据guard。新[协议/源码11/11](smoke-transmission-scene-performance-check.json)证明这些hunk可逐字逆回完整原helper，未列出的core字节不变。参数仍强制8秒、每模式30个有效返回、drain≤2秒；原beginQuery/getQueryParameter各只调一次、无新query/getError/getExtension/手工draw/poll，原方法与probe最终恢复。16项列表在[固定差异](smoke-transmission-clone-edits.mjs)。此检查用fake mainloop，没有实际GPU或性能成绩。

begin时锁存当前mode，帧末probe记录getter routeEcho并核对，然后只切**下一帧**；不会因endQuery发生在probe后而误标。FW诊断仍仅原31帧中相邻两帧调用，tailIntegration只作元数据与adaptive守卫，没有为每frame新增昂贵getBounds；新route getter是低成本回显，其开销保留在观测窗口。

有效报告需query实际有限正返回且每模式≥30，pending/null/contextloss/配置漂移等明确invalid，不补零。finally恢复原transmission getter值并resetHistory:true、留暂停，不回退物理时间/事件。CPU setup/probe/switch/包装/统计/恢复开销及逐query原始ns、source phase/C/P/pose保留。

计时是单个真实演变事件窗口的逐帧交错，**不是同一物理时刻精确paired A/B、纯T-only函数耗时或各模式独立FPS**。完整GPU elapsed还包含其它渲染/CPU提交空隙；整段FPS包含观测开销，长帧物理delta上限可能使8秒墙钟不等于8物理秒。晚期源过期与不同phase工作量会影响均值，需看原始分布。既有R9的25.93/51.46等不同窗口不可直接当新模式优化收益。

## 已封存实际窗口

[r10-transmission-scene-performance.json](r10-transmission-scene-performance.json)，SHA256 `f9b029750750b56e1e94963c523e82eae00733d034f0fbca766f6da4cd6efebf`，实际valid/issues[]、257个完整query全部返回（legacy129/fast128），末五个在68.9ms原loop drain内取回，零pending/foreign/contextlost，后置GL[]、program live且非delete-pending。准备阶段entry/prepared GL亦空。

真实配置为1920×1080/q1/中档/MSAA8、声音OFF、风1.8m/s，双菊seed42/43、各192头/I1，production point/.2/12/Brownian/two-births；persistentSmoke/cloudIllumination开，**resolvedSmokeLighting明确关**。tail两路始终adaptive，抽样峰3072tail/3492records，不靠减源或改烟量加速。C16.5固定，P自然11.5–12；Moon UTC固定1793023200000。保留autoFrame飞行后实际相机为`[-300.097879,12,-215.349834]`、target`[60.998294,92.238524,25.774108]`，不是发射前初始岸边坐标。

该计时使用FW `b37ea388…`、host `01c4c66e…`、columns **`d44a897a…`**。此前[r10-transmission-gpu-scene.json](r10-transmission-gpu-scene.json)在columns **0c2a14e9…**记录GPU10/10及同事件7/7：整张实际SDR PNG bytes相同、source/clock/C/P/相机/tail不变、三缓冲extrema/counters相同且GL[]。d44是随后非法Array输出前置验证的窄修，合法输入数学路径未改；**不把0c2原报告重标成d44实跑**。SDR字节相同＋HDR极值相同也不是全部HDR master逐像素hash。原始PNG见[legacy](r10-transmission-legacy.png)/[fast](r10-transmission-fast.png)。

## CPU数组可以如何归帧

离线[分析脚本](r10-transmission-performance-analysis.mjs)和[结果](r10-transmission-performance-analysis.json)9/9只验证已有数据/代码协议，不是新GPU测试。这里不是仅凭`cpuTimes.length===frames.length`就zip：

- `main.js`同一个同步frame先取得frameStart，在实际render之后调用probe(frameStart)，随后endQuery、UI/audio，最后唯一调用`renderBenchmark.frame(frameStart,performance.now()-frameStart)`；该函数中无await，不会被timeout/Promise在中途截断。
- benchmark.start将previous置null；每个active frame只追加一个CPU值，除首帧外追加一个相邻时间差。finish先置run=null，再snapshot/resolve，结束后的drain帧不再追加CPU。helper同步设置measuring/注册probe后立即start benchmark，不跨rAF间隙。
- 实际raw.start=132907.30000007153，首probe.frameStart=132908，说明没有夹进一个start之前已半途执行的frame。raw.previous精确等末probe.frameStart=140918.30000007153；末CPU结束140930.89999997616早于由elapsed得到的finish140931.30000007153。
- 257个CPU值与257个连续probe frame对应；全部256个raw.frameIntervals逐项等相邻probe时间差，最大仅7.1e−15ms浮点误差；257个begin标签/routeEcho/query frame也一一对应。因此本次可按index把CPU elapsed归给该帧实际route，不是任意移一位或把晚返回GPU query归给返回时route。

捕获JSON没有内嵌main源码hash；分析同时记录当前冻结main/benchmark/helper hash和上述时间戳见证，源码协议依据本次owner确认的同主循环版本，不冒称已从原报告还原不存在的源码hash。CPU elapsed包含JS、driver等待/GL提交、probe、UI/audio和可能的GC，**不是V8独占JavaScript compute、纯列积分耗时或可直接与GPU相加的时间**。

## 完整窗口与预声明热阶段

以下p95均为nearest-rank`ceil(p*n)-1`，不混用原benchmark对rAF的floor分位。热阶段在分析前由root指定为rendered burstPhase **[.1,2.5]含边界**，沿早先V8 hotwindow；没有看结果再移动边界。

| 范围/route | n | CPU elapsed均值 | CPU p95 | GPU elapsed均值 | GPU p95 |
|---|---:|---:|---:|---:|---:|
| 整段 legacy | 129 | 32.51163ms | 84.5ms | 24.03532ms | 55.42515ms |
| 整段 fast | 128 | 28.92031ms | 69.1ms | 24.16844ms | 60.67302ms |
| 热段 legacy | 23 | 75.92174ms | 98.1ms | 45.60684ms | 71.05229ms |
| 热段 fast | 22 | 63.01364ms | 78.2ms | 41.91597ms | 63.25862ms |

完整窗口CPU观测差 **−3.59132ms/−11.05%**，预声明热段 **−12.90810ms/−17.00%**；整段CPU中位却15.7→15.8ms，说明不能说每一类帧都相同比例变快。热段仅23/22个样本，**不满足原整段每mode30的门**，是预声明描述性子窗，不是另一份足量独立基准；其末相位legacy2.4783/fast2.4233也不完全相同。

**整段GPU均值24.03532→24.16844ms，约+.55%，基本持平略升，GPU p95也更高。** 不能只突出热段GPU均值约−8.09%而隐去整段结果。交错相邻帧的源age、更新cadence、driver等待/GC可能不同；一次窗口没有独立重复样本或严格同相位paired因果量，不提供速度提升置信区间。

整体8.024墙钟秒，256个rAF间隔、平均 **31.90429fps**；原benchmark floor分位rAF p95/p99 **81.5/87.8ms**，125/256（48.83%）慢于1000/60ms。实际物理phase.121→7.1278，仅推进7.0068物理秒；不是8物理秒。原benchmark封口只存252个三位小数GPU值，上表使用含drain的257个完整ns结果，未混用集合。R9的25.93fps有不同声音/受光场/源码/时段等配置，**31.90不能减它宣称前后FPS提升**。

## 受益是否足够

热段CPU elapsed约13ms、整段约3.6ms的观测下降有量级，支持快路减少分配/非必要包围结果工作对该热点有用，配合静态等价证据值得保留并继续观察。它不是整场瓶颈已消除：热段fast CPU仍约63ms，整段GPU没有降低、实际窗口仍31.9fps，尚未证明独立模式整体FPS收益或达到60fps预算。不能拿Node单函数倍数冒充实际网页提升，也不能因GPU均值平就说CPU观察毫无价值。

观测probe累计28.6ms、mode切换.7ms、wrapper metadata估计2.2ms；有包含关系与时钟量化，不能相加或从均值机械扣除。兼容性、这一窗口的性能观察与最终生产默认分别记录；分钟积烟、不同机位/更多烟、手机或所有场景的通用收益仍没有被本报告验收。原始报告保持不变。
