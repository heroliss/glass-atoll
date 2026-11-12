# 双菊花交错成本：窄克隆与真实密集窗口

入口`runAdaptiveTailDenseScenePerformance`来自[新helper](adaptive-tail-dense-scene-performance.js)，不改原单palm helper、运行时、默认或任何数值门。caller准备同刻两发菊花（每发192头，例如owner声明seed42/43），唯一活动事件数2、queue0、autoLaunch关、共同burst+.1附近暂停；固定相机/质量/C，声音由caller保持开启。无新发射、清烟、光强、时钟或曝光补丁。

```js
runAdaptiveTailDenseScenePerformance(a,{
  gl:originalMainGL,seconds:8,
  burstTime:preparedFirstLaunch.burstTime,declaredSeed:42,
  drainMs:2000,minSamplesPerMode:30
});
```

不要持有qaRenderLock，caller独占one-shot frame-probe槽。`declaredSeed:42`标记双发fixture，42/43均是owner声明而非从activeEvents读取；两发完整现有元数据保留在`setup.fireworks.activeEvents`，原`setup.event`仍是首发。`burstTime`须取实际launch且两发由owner在同物理时刻准备，不从名义高度推算。caller另存真实两个launch记录以核对seed/时间。

仅七处授权hunk：header、export名、observer消息、两发preflight、schema、seed说明及“一发palm”范围文字。唯一可执行条件变化是严格两发`chrysanthemum/actualStarCount192`；其余计时/WeakMap begin标签/每帧轮换/元数据/原GL操作次数/8秒/每模式30样本/drain≤2秒/统计/恢复字节全等。证据为[源码＋preflight检查](adaptive-tail-dense-clone-check.json)：窄逆完整恢复冻结原`b8cd721c…`，实际新predicate的正确两发、错类型/数量/队列/auto等八案例通过。它是CPU源码证明，不是新GPU或实景成本通过。

沿[原夹具边界](ADAPTIVE-TAIL-SCENE-PERFORMANCE.md)：整段是一个演变事件窗口中的逐帧交错；按begin锁存mode，绝不由probe后的end重新标注。有效样本必须各≥30并全部正常返回，pending/null/contextloss不能补零。模式GPU值是现有主query的完整帧elapsed，包含其他场景工作与CPU提交空隙；不是同相位paired A/B、独立模式FPS或纯尾迹成本。probe/元数据/模式切换开销在场，声音开启成本也在场，结果不能直接与上一声音关palm窗口作受控差值。

结束暂停、恢复原requested模式并resetHistory:true，恢复GL方法和probe；不回退物理事件。下列真实结果是root独占浏览器执行后独立只读复核；本文不作默认决定或60fps承诺。

## 927版本的实际交错结果

[r9-adaptive-tail-dense-scene-performance.json](r9-adaptive-tail-dense-scene-performance.json)，SHA256 `157a8bcd13e4db099980ca26b3125d1b33d60c1dd44ad885d14a1370bc7085f6`。`valid:true / issues:[]`，唯一209个query全部实际返回且ID/帧号一一对应，legacy105、adaptive104；最后5个在暂停后72.8ms原loop drain返回，未补零、未超2秒、零pending/foreign。最终方法和probe恢复、原adaptive选择恢复并重建历史、留暂停；caller后置GL[]、program live且非delete-pending、未中断。此JSON没有单列独立entry错误快照，不把后置检查写成未记录的entry证据。

实际1920×1080/q1/MSAA8、28mm、DOF关、SDR legacy输出、**声音开**、风1.8m/s、C16.5恒定；P按真实预算自然在11.5–12变化。相机`[-300.09762934,12,-215.35019089]`、target`[60.99829364,92.23852438,25.77410829]`全程未漂移。两发实际ID为`42-0.00000 / 43-0.00000`、各192头/I1、同一burstTime5.33112119；seed仍按owner声明而非从不可见字段独立验证。生产point/.20/12/Brownian/two-births烟源，非前一palm持续烟QA组合。

| begin锁存模式 | 实际返回query | 完整帧GPU elapsed均值 | p50 | p95 | burst后相位 |
|---|---:|---:|---:|---:|---|
| legacy8 | 105 | 27.820038ms | 19.764288ms | 57.535488ms | .1215–6.5432s |
| adaptive | 104 | 28.039814ms | 19.868672ms | 66.145632ms | .1590–6.5297s |

原始ns独立复算与报告相符，均值差 **+.219775ms / +.790%**。这是一个完整演变窗口中两标签的观测差：不是同相位paired A/B、独立模式FPS、纯tail成本或“零代价/无改进”的证明。p95也不能用平均差较小代替；相邻帧仍有真实工作量差，单次窗口不提供重复试验置信区间。

整段benchmark elapsed为 **8.0217秒**，208个rAF间隔合计 **8.0078秒**，平均 **25.929666fps**。原benchmark采用`floor(p*(n−1))`分位，rAF p95 **92.7ms**、p99 **105.0ms**、最大118.2ms；120/208即 **57.69%** 间隔大于1000/60ms。CPU提交区间均值37.8876ms、p95 92.3ms，不能把25.93fps写成达到每帧60，也不以GPU均值的<1%差掩盖共同瓶颈或慢帧。

测量帧的物理phase从.1215到6.5432，仅推进 **6.4217物理秒**；这不是8物理秒。当前主loop对长帧delta有.055秒上限，物理时钟与真实墙钟不能混用。报告不改时钟来追齐。原benchmark封口前只存204个三位小数GPU值；上表来自含drain的209个完整ns值，不混用两个样本集合。

每模式7个源元数据抽样帧，峰值384头、3072tail、3492records；adaptive抽样最大N9、局部上界9、无fallback。它们是CPU投影估计，不是逐帧GPU指令计数。phase约5.35秒起的后段抽样tail已0，因此整段均值包含自然过期后的低tail阶段，不能推广为所有高峰帧成本等价，也不能据远视图N9外推近景N91或无限近距离。

probe累计30.5ms、切换累计7.2ms、包装metadata估计2.4ms，分项有包含关系且timer量化，不能相加或机械从GPU差值扣除。与上次声音关、单palm、不同机位/烟源的51.46fps不是受控增减对照。

## 高源量安全门与电影版本边界

[单adaptive高源量场景](r9-adaptive-tail-high-count-scene.json)另存 **5/5**，两发192头与真实尾段、main/composed/mirror有限非负安全、活动数有界、后置GL[]。其8秒平均约29.70fps、rAF p95约83.3ms、GPU均值约25.7ms；它是较早独立窗口，不能替代上表、与25.93fps计算模式提升，或把实际头/尾多就等同小时积烟压力。热态图为[r9-tail-dense-scene-hot.png](r9-tail-dense-scene-hot.png)，单截图也不能验收动态无闪烁。

本轮性能对应`fireworks.js` **927b044a20fd6497ee052a84a70e73b4a1d4bfaf5193f6cde12943ba89db2a0d**。其零权重循环优化相对冻结f0c的实际[10/10 GPU](r9-adaptive-tail-zero-only-gpu.json)保留输出逐位兼容；不是所有帧更快的证明。原[珠串坐标修复后的9/9](r9-adaptive-tail-gpu-fixed.json)与[静帧13/13](r9-adaptive-tail-scene.json)属于较早f0c阶段，原7/8及中间失败报告均未覆盖。

[16秒实际影片](pyro-r9-tail-motion.mp4)、[原生WebM](pyro-r9-tail-motion.webm)与[捕获记录](pyro-r9-tail-motion.json)由root在 **f0c6251c3125a5aa3355b9f9a02907f1546aaffa9443ce1a1447ed027590bf03** 版本录制，**不是927重新录影**；capture JSON本身未内嵌fireworks.js hash，版本归属依root录制记录及冻结基线，不假称仅由媒体自身独立证明。它是单palm/I1、显式palm-fan-burn烟源、C16.5/SDR legacy/adaptive，一次真实近景切镜头，不是本双菊生产烟窗口或同发legacy/adaptive动态A/B。

[媒体技术12/12](pyro-r9-motion-media-check.json)：H264 1920×1080/yuv420p/CFR30＋AAC48k立体声，MP4/WebM全片解码，16.02秒封装、475个CFR视频帧；保留WebM实际273个原生视频帧，CFR可重复/丢帧，不能用30fps称renderer稳定30/60。音轨有限非空、无full-scale样本且已锁定audio SHA不变；不等于新增主观试听或真峰值/SPL测量。[原生播放器](pyro-r9-tail-native-player.json)实际readyState4、1920×1080、seekable0..16.02并ended于16.02，证明可播放完整到尾，不自动验收烟形/尾迹照片感或完整倒影构图。

## 尚未闭合的预算与决定

密集窗口显示两模式共有显著整场成本，且这次完整帧均值观测差较小；**目标预算仍未闭合**。还缺最终生产选择后的全场/近远景/有声动态成本、长时间烟包累积和资源阈值切换，不能从单源、远视图或可播放电影推出60fps保证。本文不修改application/module默认；root将在真实主接线验证后单独记录选择依据。锁定音频SHA仍为`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。
