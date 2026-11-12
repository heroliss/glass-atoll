# 尾迹去珠串：光学积分候选A

默认仍`trailIntegration:'legacy8'`。可在factory或`fireworks.configure({trailIntegration:'adaptive'})`显式选择，不修改物理设置；没有公共UI开关。palm/fan持续烟源、弹道、发光records、时间、RGB/I、meanEmission、stretch、ledger及原raw bound不变。

R9 palm细节图的CPU同参数重放：96尾段投影长度中位17.32px、最大30.38px；旧每段8点导致点距中位2.165px、最大3.798px，σ仅.281–.320px。段端缝中位.0063px、最大.429px；快门全小于1px，图像为原生1920×1080而非FSR。主因是尾段内部的空间积分点太疏，不是烟源或该图的大快门三点分支。这个重放不是live Float32上传的逐bit证明。

## 算法与预算

仅对尾段，令L为实际投影stretch长度、σ为原像素Gaussian宽度：

`targetStep=.5*max(1,σ)`；`x=max(7,L/targetStep)`；`N0=floor(x)+1`，`N1=N0+1`。

分别在原`t∈[-.5,.5]`区间做完整正归一midpoint积分，再用`clamp(quintic(fract(x)),0,1)`混合两级。窄核点距<.5px，宽核<.5σ；整数N转换连续。F32的quintic可能略超1，所以显式clamp保持凸混合。head仍沿原8快门路径；小快门方差和大快门独立三点积分不变。

每pixel仅计算投影轴范围`pixel box半宽+6σ+.02px+大快门投影`内的全局index，但分母始终是完整N；不作局部重归一。先float clamp index到有限域，再转int，避免极短L/宽PSF的int越界。每级最多128局部样本，global N≤65536；vertex为整source选择adaptive或legacy8，绝不逐pixel切换或截前128项。

正归一平均保持总源量，理论峰值不超过原point-Gaussian上界，采样点仍位于原stretch区间。6σ局部省略的数学全平面漏量≤约1.973e−9；这不包括erf近似、F32、原有限quad裁边与遮挡近似。资源fallback边界不宣称视觉连续或无限近景适用，实际片必须记录有没有触发。

## 切换与诊断

显式调用configure后，`diagnostics().tailIntegration.requested/effective`提供选择状态：未绘制为`awaiting-render`，绘后adaptive政策为`adaptive-with-legacy8-budget-fallback`，显式切回原模式为`legacy8`。从未显式选过mode的旧默认诊断布局保持。

`estimates`是CPU投影估算，含adaptive/fallback/clipped数量及原因；不是GPU执行计数。`kernelEvaluations`明确为每源两级最多256局部空间评估、大快门最多768的上限，不宣称每pixel实际做满或仍只有旧8/24次。没有额外pass、texture或runtime读回。

## 验证边界

- 当前专项CPU：`node verification/fireworks/adaptive-tail-cpu-check.mjs`，7/7。先以1处端点分支窄逆恢复f0c，再以6处坐标修复窄逆回到8ef候选，最后原17处窄逆完整回到40189旧源；三层各自的缺失/重复均拒绝。实际默认factory的records/clock/ledger/cluster/bound逐值相同，live mode切换不改源，requested/effective与先clamp再int已覆盖。
- 独立数学oracle由另一代理维护：`gaussian-streak-oracle.json`及`GAUSSIAN-STREAK-ORACLE-NOTES.md`。窄核实际L17/30的旧最大pixel误差约.04931，候选约.0008539；端部仍约1.45%相对1/L尺度，不能假称逐pixel1%已过。内部波纹显著改善与端部误差应分别记录。
- 可实际调用：`runAdaptiveTrailGPUCheck(THREE,renderer)`，文件`adaptive-tail-gpu-check.js`。复用caller context、128²Float32 RT，测独立F32候选goldens、.1%通量门、point ceiling、模式间head bitexact、实际vertex政策和caller状态恢复；无需新context。保留冻结8ef原GLSL的legacy/head逐位门，并新增冻结f0c的adaptive端点/内部混合整图门，当前共10门。GPU-vs-candidate工程容差仍为`5e-5+5e-4*abs(expected)`，103组golden未改，不把连续精积分差异混为GPU算错。f0c坐标修复版本实际9/9记录保留在下方，不能改称最新端点候选已过GPU。
- 40a中间源曾依次通过physics22、metadata15、ledger13、phase10、clip11、past16、scalar7。其首次hash依赖未刷新失败报告已保留，随后按依赖顺序通过。最终8ef窄修仅做专项5/5及source精确逆，不把中间SHA的广回归改写为最终SHA已重跑；遵照本轮有界验证范围。

当前runtime SHA256：`927b044a20fd6497ee052a84a70e73b4a1d4bfaf5193f6cde12943ba89db2a0d`。端点优化前f0c完整源保存在`verification/baselines/fireworks-before-adaptive-endpoint/fireworks.js`。已撤回的d280双端点版本保存在`verification/baselines/fireworks-before-adaptive-zero-only/fireworks.js`，首次9/10实际结果保留。坐标修复前8ef完整源保存在`verification/baselines/fireworks-before-adaptive-centre/fireworks.js`。原legacy完整源在`verification/baselines/fireworks-before-adaptive-tail/fireworks.js`，SHA `40189f53842b6361a487fa4fa0af78de02727b2de1a23c5720f9128f18c97b9f`。音频与烟源未改。

## 实际首轮失败与坐标归因

原始`r9-adaptive-and-radiance-gpu-first.json`保留：8ef候选7/8，只有103组GPU对候选golden门失败，7个端部样本最大差`7.3957849e-5`、最大预算比`1.2287`。通量、head、point上界、vertex政策和GL/状态门均通过；这不是通过报告。

实际`r9-adaptive-tail-varying-probe.json`为4/4。103组原始生产fragment与QA插桩终点全部逐位相同；读回的smooth `vOffset`相对指定像素中心最大偏移`.0017004013px`。查询`SUBPIXEL_BITS`实际为**4**。独立离线1/256像素顶点吸附模型虽能拟合原103组至最大残差`2.15e-7`，它只是拟合模型，不能据此称硬件报告8bit。

独立`adaptive-tail-interpolant-recheck.json`直接用实际读回的p/motion/σ/N/blend重算，最大残差`5.26739e-8`，原固定门下0失败；仅替换actual offset已降至`4.23524e-8`，反之保留requested offset而换其余actual数仍约`7.39655e-5`。光幅归一差最大仅`2.74e-8`。这把根因定位为扩大quad的栅格插值偏移，无需改变erf、N、权重或验收容差。

因此仅adaptive函数改用`gl_FragCoord.xy-flatProjectedCentre`；flat中心在quad扩张前由真实clip中心计算。局部index与Gaussian q共用该偏移。旧`vOffset`、旧8点循环、head快门、quad范围、σ、N、颜色/源量及raw bound均未改。旧requested中心失败不会通过修改golden来消除。新`adaptive-tail-varying-probe.js`还可同时读legacy插值offset与physical offset；两者不能混称。

首次更新CPU scope时，旧17处缺失测试直接在已含新6处的源码上删旧重叠字串，因目标已被新层替换而误报“未抛异常”。已保留`adaptive-tail-cpu-centre-scope-first.json`；现先严格逆6处、再逐项破坏原17处，且两层各自独立拒绝缺失/重复。没有为了该夹具问题再改运行时。

## 修复后的实际GPU结果

`verification/r9-adaptive-tail-gpu-fixed.json`记录f0c版本在生产renderer/context实际执行**9/9**。103组与未改的F32候选golden比较，最大绝对差`2.30745049e-7`、最大预算比`.0035402285`；原`5e-5+5e-4*abs(expected)`门保持。与连续精积分的最大差仍为`.0008538843`，属于已声明的离散midpoint/像素核误差，不能用GPU精度门通过来消除这项边界。

四组完整source通量均无负值或非有限像素，adaptive归一总量约`1.000000242..1.000000330`；相对legacy的`.1%`门通过。实测最大归一pixel峰`.05446645`低于原保守point上界1。原head的两mode比较差为0；额外使用冻结8ef原始GLSL比较head8、axisTail、obliqueTail及widePSFTail四组，所有RGBA全图最大差均为0，确认新增flat varying没有改变这些旧路径的实际driver输出。

窄/宽PSF与σ=1两侧的vertex政策、global超预算及退化投影fallback均通过；实际program linked且info为空，entry/operation/restoration与caller后置GL错误数组均为空，caller状态恢复。GPU helper冻结SHA为`a773f4178b4cd7594f1efdda9fec90958682116c8675cb90d364723265ed12a1`。这一结果验证了小型实际shader夹具，不等于整场摄影真实感、动态零闪烁或整场帧率；1080p同事件前/细节A/B、连续近景及成本仍由主代理另行采集。

## 严格零权重短路候选

`r9-adaptive-tail-high-count-scene.json`记录f0c的实际双菊384头/3072尾段，技术5/5、主/镜面值安全且GL空，但单模式8秒平均29.70fps、p95帧间隔83.3ms。它没有同事件legacy基准，不能归因“adaptive增加多少成本”。16次CPU投影政策样本热段maxN/local均9，表示远景`x=max(7,...)`落在N0=8、N1=9、blend=0；这仍是CPU估算，不是实际GPU执行计数。

旧dispatch向`mix`传入两次函数调用；纯函数的零权重项不能依赖driver自动省略。当前候选只增加`blend==0`时求N0，**所有非零权重仍完整保留原mix表达式**。没有epsilon阈值、不跳过近零权重；N政策、Gaussian、6σ局部范围、正归一分母、源量、head/legacy、几何及bounds不变。显式条件只是减少无用计算的机会，编译器仍可选择展平，不能预先宣称GPU收益或每帧60。

新增`adaptive-tail-endpoint-normalize.mjs`只逆1处dispatch，当前SHA `45eee05785815d3045b614eaee07a960a1d291f80f6a375afb8a7f6b6928cae2`。当前GPU helper SHA `39282baa532c982ddd62f0c749db4f7c4f86b169c5fd68bcac2fede649a4e381`，新增9组实际全Float32图与冻结f0c旧adaptive shader比较：0权重横/竖、1权重22.5°/45°、内部权重横/竖/斜向/宽PSF/大独立快门，同时读实际vertex政策验证确实覆盖三类权重。严格要求逐位相同，不调整原103golden或原精度容差。

首次d280曾同时短路0和1，实际`r9-adaptive-tail-endpoint-gpu.json`为**9/10**：只有22.5°、实际blend=1的全图有21个分量不同，最大差`1.1102230246251563e-16`；其余8组逐位相同，原9门仍全部通过且GL空。尽管该差极小，严格bit门没有放宽；已直接撤回不必要的1权重优化，保留实际远景热段需要的0权重优化。原失败JSON与d280源码均保留。

最新927零权重版实际`verification/r9-adaptive-tail-zero-only-gpu.json`为**10/10**。全部9组16384像素的RGBA Float32图与冻结f0c相比，`differentComponents=0`、最大差=0、nonfinite=0；包括此前失败的实际blend=1、22.5°一组。实际vertex政策同时证明覆盖了0、1及内部权重（.5和.103515625），没有删掉失败fixture来通过。原103golden门仍为最大差`2.30745049e-7`、预算比`.0035402285`，容差不变；通量、point bound、head、旧legacy、vertex fallback、link及状态门全部通过。entry/operation/restoration和caller后置GL均空。该结果支持零权重分支的有限输出兼容性，不能单凭bitexact推断省时或提升FPS。

后续已完成[927密集交错成本](../ADAPTIVE-TAIL-DENSE-SCENE-PERFORMANCE.md)：209个实际query完整返回，整帧GPU均值legacy27.82004/adaptive28.03981ms，整段25.93fps；后段尾迹过期会稀释平均差，仍低于60fps目标。同事件近景图与独立f0c影片见[高清审阅页](../tail-optics-review.html)。root已只将应用构造选项设为adaptive；模块默认仍legacy8，生产烟源未变。[实际默认重载](../r9-application-default-scene.json)验证生效。数学/CPU及小GPU夹具不等于照片感、任意视角无闪烁或60fps验收，段端、快速镜头和长期积烟仍需继续审看。
