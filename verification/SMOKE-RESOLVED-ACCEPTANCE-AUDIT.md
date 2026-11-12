# 逐源烟光场：实际验收与默认交付独立审计

2026-10-27。只读审查既有实际报告与当前源码；没有重跑GPU、操作browser或修改runtime。

**结论：照明候选的数值、接线和隔离成本已有可信证据，可以作为明确的可选功能交付；尚不能据此宣布默认烟雾已经升级或烟形达到真实照片。** 三份报告都通过，但覆盖的命题不同。

| 实际证据 | 通过 | 可以支持的结论 | 不能扩展为 |
|---|---:|---|---|
| [隔离GPU与计时](pyro-smoke-resolved-field-gpu-perf.json) | 127/127 | 特殊函数/缓存/排序/cull/主镜像/P/恢复通过；隔离bake有有效计时 | 全岛60fps、全部容量/设备/天气、视觉真实 |
| [GPU补测](pyro-smoke-resolved-field-supplement-first.json) | 21/21 | 14000源完整累加；DPR1/2强制重烘逐位同值；只替换locals4/5，保留0/3 | 14000个真实分散星点的全部空间分布、真实阴影/共同RTE |
| [同一真实事件实景对照](pyro-smoke-resolved-field-scene-first.json) | 32/32 | 相同完整物理烟快照，仅照明policy改变；主/镜像HDR安全，实际on/off有效 | 图像已经好看、形状已经真实、默认参数已经采用候选 |

## 实际数据核对

补测1packet×14000sources，只有两种位置/发光方差，独立oracle按上传Float32 RGB和折叠为2次Laplace积分；最后一行有显著flux sentinel，遗漏它约产生2.96%错误，无法躲过`.002`门。实际C0误差`6.53e−5`、C1误差`1.18e−4`（均除以峰参考C0），角下界`.006954>0`，有效非disjoint GPU query为`4.626432ms`；CPU prepare记录`5.2ms`，不能忽略。

DPR夹具真正执行了两次新bake（bakes2→3→4），logical32×32，drawing32×32/64×64，全部RGBA32F texel逐位一致，原size/DPR/viewport/scissor/RT恢复通过。六灯fixture使用实际local工厂与借用uniforms：把4/5改为强红后像素与rawBound完全不动；开启0只增红、开启3只增绿，最后回到纯蓝field逐位同基线。该夹具shadow关闭、air关闭，不伪称真实torch阴影已复验。

实景的`frozenSnapshots.proxy`与`.resolved`已另用Node深度严格比较，**完整相等**，包括Σ、q、均值、温度、浮升、出生时钟、profile与ledger。都是60包：9launch/M`.35`，3central/M`1`，48root/M`19`，合计参考干消光面积`20.35`，无pending、无merge；不是kg。共同commit time`42.47290000009552s`，共同physical phase`42.481278958402015s`，约8.38ms差来自既有20Hz状态提交，并非逐源模式偷改年龄。

四次capture raw clusters相等，C都为16.5；front的P由11.5自然变11.25，detail均10.5，补偿公式通过，所以不把stored HDR极值直接作相同P亮度比较。真实field为60×120=7200pairs，bakes/version保持1，front/detail共享raw field。opaque/composed/reflection均无NaN/Inf/negative，四张native1209×1292 PNG非空。same-host on→off的effective/shader flag恢复关闭、物理状态与数值安全通过；没有声称PNG逐位回到原图。`visualAcceptance`仍明确是`pending_root_review`。

本次实景音频关闭，原launch/burst被discard，未播放录音；只能证明音频源码/设置未改，不能把该32项说成新的试听或波形验收。

隔离bake每种规模只有**一个**有效非disjoint计时，分别为：60×120`.66048ms`、256×240`1.248256ms`、1024×240`1.288192ms`、4096×240`3.072ms`。计时包围prepare提交的bake/数值纹理更新，已做该规模的预热；不包括独立oracle/readback，也没有给出全场CPU/rAF、p95/p99或热稳态。它们不是均值/分位数，不能从`16.67−3.072`推导保证60fps。单packet×14000比4096×240更慢，也提醒源循环串行度/上传/布局不同，不能仅按pair数线性外推。`4096×14000`更超过1048576pair工作上限，不能据这份报告声称支持。

## 当前生产默认与最小决策

核对的是当前 `main.js` SHA256 `66f6cf72861dab0dfa4ec38b35df833ed8c4d6898475a16efca7d5f7eb2bcd23`：

- `main.js:261`确实创建`sourceModel:'trajectory-v1'`，不是legacy9；但没有传kernel/fraction/slots/dispersion，依`pyro-smoke.js:11`仍为**point/.20/12/Brownian**。
- `main.js:64`与`ui.js:37`的`resolvedSmokeLighting:false`、`intensityScale:1`仍是默认。逐源照明已经有生产开关/状态与超预算提示（`ui.js:133–134,191`），所以应说“可选接入、默认关闭”，不能说整个功能完全没接线。
- Taylor TL10 /segment/.05/48只在`main.js:319`的临时QA hosts中显式采用；32项的源强也为16。它不是默认I1/24包场景。把四项密度参数和lighting一并默认打开，会同时改变多个因果变量，不能拿这份固定密度照明A/B当作全部默认切换的证明。

**最小合理交付：保留已实现的逐源照明可选开关与预算状态，可明确宣称修正空间色受光的候选已验证；不改模块兼容默认，也不把QA烟源/扩散组合默认为“已上线”。** 当前截图视觉仍未被本审计判定接受，烟形/湍流仍是近似，不能写“烟雾已照片级”。

若主入口必须默认出现本轮改进，建议下一步只针对**当前生产密度**做同源/M/时钟的照明off/on最小对照，确认视觉与短全场帧时间后，再由root只改`resolvedSmokeLighting`默认或明确演示预设；不要同时无声更换density四参数，也不提高I来掩盖烟形。若root另选Taylor48组合，应在main显式写出并说明它是被选定的作者模型，另保留可回退基线，不能靠factory默认漂移偷偷上线。现有证据足以支持小的交付决策，不支持用技术项数代替视觉判断。

报告SHA256：supplement `120a6c7d78f276b30a0d367de9018fca043a8c28bdfa075ae66455716169b9a7`；scene `dfa7f0a1ca2640988252d285e3542aea14a5a3b9bf6ad7eb0ebb059e72916084`；isolated-perf `a4adcf744486902886cbac08381b8614e622dfef1dd03387003ed342730377d8`。原始报告/失败历史/helper字节均未改。
