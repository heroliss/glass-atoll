# R10 性能与全逻辑烟源检查点

本页仅汇总已封存证据及范围，不改变运行时或默认值。原目标仍是可自由观看、光照一致、能互动且第一眼像真实离岛照片；数值门通过不代表该视觉目标已完成。此前用户接受了第三次主爆音量对照的冲击感，以及部分候选的相对改善，不能外推为全场照片感验收。音频仍锁定 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。

## 性能：保留 CPU 收益，同时保留 GPU 与慢帧事实

| 证据阶段 | 实际源码版本与结果 | 能证明的范围 |
|---|---|---|
| 原 V8 热点定位 | FW `927b044a…`、columns `cad9b4f1…`、main `d9181b47…`；[分析](r10-hot-fireworks-cpu-analysis.json) | 共同热窗口内 `between` inclusive 约59.60%；它与下层 `query` 的比例不能相加。不是整个203秒profile都属于爆炸热段，也不是尾迹算法单独耗时。 |
| T-only 静态兼容 | columns **`0c2a14e9…`**；[实际GPU10/10＋同场景7/7](r10-transmission-gpu-scene.json) | 同一暂停事件、相机、C/P、物质及源状态；完整SDR PNG byte-exact、三个HDR缓冲极值相同、GL[]。不是全部HDR master逐像素hash或性能通过。 |
| 实际交错计时 | FW `b37ea388…`、host `01c4c66e…`、columns **`d44a897a…`**；[原始257个query](r10-transmission-scene-performance.json)全部返回 | d44仅修非法Array输出的前置验证，合法输入数学路径未变；不把0c2原报告改名为d44实跑。无丢弃、context loss或最终GL错误。 |

源码全hash与版本边界：

```text
原 FW       927b044a20fd6497ee052a84a70e73b4a1d4bfaf5193f6cde12943ba89db2a0d
原 columns  cad9b4f1fc01e47fc2f961274cb56f441cb12070af1b8dd83f7b6145114641a4
原 main     d9181b476d93b5e5f5eb35b720823a961de13c550c101bc226dec46e942b3908
静态 columns 0c2a14e9b8bd4181c022a70eb0fc34d04b65f25bce8e28d20201eef6c3a11e7d
计时 columns d44a897ab8c7c9f58e0c7f974d07d1206b374d44dbb228bf05ebbe71131afad6
现 FW       b37ea388471b6f50a307327fab95ccc10d7f9aaa1dc46ed921fc1abd9c890e43
现 host     01c4c66e15579f429e472a0089fda9f5ba1f17d782d3cd63d69a226b30225a89
```

[逐帧归属分析9/9](r10-transmission-performance-analysis.json)核对了主loop顺序、起止时间、全部256个相邻间隔及257个begin标签，才将CPU数组按index归给对应route；不是只靠数组长度相等。CPU elapsed包含JS、driver等待/GL提交、probe、UI/audio及可能的GC，不是纯JavaScript compute，也不能与GPU时间相加。

| 窗口 | legacy CPU mean/p95 | fast CPU mean/p95 | legacy GPU mean | fast GPU mean |
|---|---:|---:|---:|---:|
| 整段129/128帧 | 32.51163 /84.5ms | 28.92031 /69.1ms | 24.03532ms | 24.16844ms |
| 预声明burst phase [.1,2.5]，23/22帧 | 75.92174 /98.1ms | 63.01364 /78.2ms | 45.60684ms | 41.91597ms |

CPU整段观测下降 **3.59132ms/11.05%**，预声明热段下降 **12.90810ms/17.00%**；热段样本低于原每mode30门，仅作描述性子窗。整段GPU均值约 **+0.55%**，基本持平略升，不能只报热段GPU较低。

真实配置为1920×1080/q1/中档、声音OFF、风1.8m/s、双菊seed42/43各192头/I1、production point/.20/12/Brownian/two-births，resolvedSmokeLighting关，尾迹两路均adaptive。C16.5固定，P自然11.5–12。8.024秒墙钟中整体 **31.90429fps**，rAF p95/p99 **81.5/87.8ms**，125/256帧（48.83%）超过1000/60ms；物理只推进7.0068秒。

这是一次相邻演变帧交错，不是同相位paired、各模式独立FPS或纯T函数成本。CPU热点收益有量级，但整场瓶颈没有消失，不能宣称整体FPS提升或任意硬件每帧60。R9的声音、受光场、配置与源码不同，不能拿其25.93fps与本次31.90直接作受控增益。完整方法与原始边界见[性能说明](SMOKE-TRANSMISSION-SCENE-PERFORMANCE.md)。

## 源覆盖：从纯事务到实际子星路径

| 门 | 已封存结果 | 适用范围 |
|---|---|---|
| 有界纯cursor | [23/23](logical-burn-check.json)＋[独立8/8](r10-logical-independent-check.json)，module `235dff62…` | 全十型的逻辑family、ready cell、30/60/120Hz、clone/prepare/commit、故障与清烟账本；没有GPU、跨event物理队列或照片感结论。 |
| 真实provider＋adapter/host | [18/18 CPU](logical-events-check.json)，adapter `5f7bf8b0…`、host `01c4c66e…` | 全body/child/ground、因果采样、全局EmissionID、接受prefix与fault/clear等。完整十型正确性回放使用**65536容量**隔离旧merge成本，绝非生产4096性能验收。 |
| 实际crossette | [14/14](r10-logical-crossette-scene.json)，actualGPU，visualAccepted:false | 真实4096 host，180体＝36母体＋144子体；三个实际相位、三HDR缓冲安全、无GL错误。单发，不是十型或长时压力通过。 |
| 实际bouquet | [14/14](r10-logical-bouquet-scene.json)，actualGPU，visualAccepted:false | 真实4096 host；三相位104/104体均已查询，packet数270→973→973，末相位M2.0000000000000018、reserved0，merge/forced merge均0，GL[]。不是全十型视觉或长时性能通过。 |

当前main的 `setSmokeReviewProfile('logical-all')` 是显式QA opt-in：`logical-family-continuous-v1`、past-segment-v2、Brownian、centralFraction .20、groundChargeFraction .10。**生产点源烟默认未变**：trajectory-v1 / point / .20 / 12 / Brownian / two-births。旧报告中“provider尚无sampleBody/main尚无opt-in”属于当时的阶段说明；原生G1和QA入口现已存在，不把旧阶段文字当现状，也不改写旧报告。

crossette实际结果（M为作者参考干消光面积单位）：

| burst后相位 | 已查询/声明逻辑体 | 实际packet | airborne M | pending M | reserved M | merge |
|---|---:|---:|---:|---:|---:|---:|
| .8s | 36/180 | 135 | 7.77940731 | 0 | 12.57059269 | 0 |
| 3.6s | 180/180 | 1481 | 19.36348889 | .07297481 | .91353630 | 0 |
| 10s | 180/180 | 1632 | 20.35 | 0 | 0 | 0 |

每相位C16.5/P12，airborne＋pending＋reserved闭合20.35，末相位reserved为零。图见 `r10-logical-crossette-{0p8,3p6,10}.png`；root观察宽景烟很淡。本页核对了报告，不将路径计数、有限值或淡烟可见性称为照片级烟形。源覆盖只指当前逻辑图中参与分配的body；mortar carrier/装饰上升光仍缺少明确燃料/燃烧产烟语义，不能说“所有现实火焰都已覆盖”。也没有把render tail、mirror记录或audio energy重复转换为M。

bouquet的.8/3.6/10s原始记录现已独立读取，报告SHA256 `cb5d94fdfe27baa84c6dbbf54b7d1b2834a819b8a511b53c1559788a37616bb0`。实际图见[.8s](r10-logical-bouquet-0p8.png)、[3.6s](r10-logical-bouquet-3p6.png)、[10s](r10-logical-bouquet-10.png)；C均16.5，P自然11.75→12→12。它补上真实地面104体路径证据，没有把暂停readback耗时作为FPS或将视觉状态升级为通过。

## 仍未关闭的目标与下一优先级

1. **G7容量与长时预算。** 单柳完整CPU源有6291格，超过生产4096容量；强制merge、分钟积烟、连续多发与帧预算尚未闭合。保存M/μ/Σ不能保证多峰烟的射线τ或视觉形状，不能用一个全局cohort掩盖这个风险。清烟/寿命策略仍须分别验收。
2. **物质与受光标定。** .20/.10及每型参考总M都是作者profile，不是kg、燃料或实测品种产率；父子family不重复预算，不代表已知真实燃烧量。可选resolved light-field另有1,048,576 packet×source pair上限，与基本源规划/4096 state容量是两种不同限制。
3. **可见照云与烟形。** 既有RH.68、约813m云底场景I1/4没有可见cloud-only差分、I16仅4像素1byte，不能写“已显著照云”。几何/烟源、共享光账本与显示变换要分因果验收，不能靠额外增益掩盖形状问题。光谱、产烟率、低云配置与长时风场仍有近似。
4. **原始照片感仍待验收。** 云团水平结构、棕榈远景/叶层、海天接缝与远海球面方案、任意视角白沙/清水反光、细节与动态稳定性仍需真实参考和实际图像/影片反审。烟花多层壳、发光/颜色生命周期与品种烟量差异也未全部实现。不能以本轮源覆盖或HDR技术门替代这些目标。

保留早先失败、过时fixture和版本边界，包括stage-sum首报告、65536范围纠正、原生G1加入后失效的负fixture，以及R9原失败与后来clean复验。本页不替root尚待完成的最终npm、默认恢复、manifest或新视觉验收作通过声明；实际手机性能仍未测试。
