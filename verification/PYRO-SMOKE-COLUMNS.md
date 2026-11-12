# 烟气CPU有限光程：受控误差BVH与两轮更新优化

2026-10-27。模块[pyro-smoke-columns.js](../pyro-smoke-columns.js)只消费不可变快照，为CPU源路径查询RGB光学厚度；**未由本任务接入main/fireworks**。质量、风、热状态、合并和物理步长仍属于`pyro-smoke-state.js`。不代表全烟体渲染、源自遮挡或整场帧率已验收。

## 接口与边界

```js
const columns = createPyroSmokeColumns(snapshot, {
  errorBudget: 1e-5, leafSize: 8, refitRebuildThreshold: 2.5
});
columns.update(nextSnapshot);
columns.query({origin, direction, start: 0, end, errorBudget: 1e-5});
columns.between(from, to, {errorBudget: 1e-5});
columns.diagnostics();
columns.resetDiagnostics();
```

使用状态库原有`packets[].mass/mean/covariance/profileId`及`profiles[].id/extinctionPerMassRGB`。长度为米，质量是参考相对干质量，消光为作者设定m²/参考质量；不称实测kg/PM。query的direction须归一，start/end满足0≤start≤end；between以真实端点计算距离/方向，重合端点安全返回τ=0、T=1。不会重设源位置、读相机、P/C、年龄、曝光或随机数。

返回`tauRGB`、`T`、`errorBound/errorBoundRGB/actualOmittedBound`、`transmissionLowerRGB`和visited/kernels/omitted/cost。errorBudget是省略τ的L∞预算，默认1e−5；设0会计算每个非透明包，不使用5σ硬裁切。`errorBoundIncludesRoundoff=false`明确表示界针对主动省略，不是整个binary64实现的形式化区间证明；核数值误差另由独立积分测试。

介质为**无限支撑、完整SPD Gaussian**，未实现地面/海岸halfspace、沉积或域外消失。相对质量不因查询或BVH省略而改变。未来边界须另定协议，不能把5σ盒当物理边界。宿主若取火星中心或尾段锚点T，仍是扩展源近似，不等于对整个发光体逐空间积分。

## 有限列积分与省略证明

Cholesky白化后，沿单位方向d的密度是`N·exp(−q_perp²/2)·exp(−A(t+b)²/2)`，A=dᵀΣ⁻¹d。有限start/end通过erf差积分，不使用容易相消的`C−B²/A`。实现采用erf级数/上不完全Gamma连分式及近端点四点积分。短段先算实际`end−start`再缩放，避免7m处10nm段因两个大端点相减损失精度。

任一完整无限直线的列质量有保守界`M·trace(Σ⁻¹)/(2π)`；乘各RGB消光给出τ界。每包建立`mean_j ±5√Σ_jj`的保守AABB。射线未命中节点盒，意味着有限段上每个相关Gaussian的Mahalanobis距离平方≥25。若无限直线的垂距已≥5σ，全线积分直接带`exp(−12.5)`；若仅有限区间避开近心部分，则区间位于一侧Gaussian尾部，用`erfc(x)≤exp(−x²)`仍得到该保守因子。因此节点省略界可取各包完整线界之和再乘`exp(−12.5)`。

**只在节点未命中且加入该界后累计仍≤budget时省略**；否则下探。叶内仍超预算的包照实积分，没有包数cap。正数界用向上相邻double及保守余量相加，避免普通求和下舍入悄悄突破预算。解析界仍有公开的浮点实现边界，未冒称任意极端病态SPD的机器证明。

## 数值结果

运行`node verification/pyro-smoke-columns-check.mjs`，见[20项结果](pyro-smoke-columns-check.json)：**20/20通过**。

- 完整旋转SPD与独立adjugate矩阵逆、32768步密度Simpson积分比较，最大绝对差约1.424×10⁻¹⁴。
- 与原状态库48条暴力列积分比较，最大差约2.572×10⁻⁹；对照显式考虑原库A&S erf近似的端点差上界，未把它混成BVH省略误差。
- 8个5.01σ外包，预算不够全略过时实际精算3包、省略5包；实际差2.821×10⁻⁶，证书8.897×10⁻⁶。另用质量1e6的外盒包验证不能只因未命中而丢烟。
- 256组旋转/各向异性反例，实际省略τ/界最大约.2992；逆向、分段、inside、RGB、透明profile、输入无效值与原子更新均通过。
- 4096包×64条压力射线全部保留，平均精算28.23包。此固定样本下state绝对差最大2.116×10⁻¹⁰，省略证书最大5.254×10⁻⁶。查询计时是Node CPU工作，不是GPU或场景FPS。

第一次近端点精度失败保留在[pyro-smoke-columns-first-candidate.json](pyro-smoke-columns-first-candidate.json)，修复了输入区间缩放次序，没有放宽容差。

## 两轮有界更新优化

原版`c1e845…`源码、状态库及20项JSON原样封存于[baseline目录](baselines/smoke-columns-c1e845/)。原先4096包完整更新一次约39ms，不能按20Hz直接放进主循环。只进行了已授权的两轮：

1. ID集合未变时，保持树拓扑，按ID（含负merge ID）映射当前核；叶/父节点自底向上refit。结构ID变化或缺失/重复ID时重建，所有包仍保留。第一轮64个暖机后更新均值约6.63ms/P95 8.68ms，同run原版12.03/15.14ms；仍有大量新记录分配。
2. 两套暂存包/节点缓冲交替。完整验证proposal后才提交，错误不会改当前可查询状态；同样的Cholesky运算与核语义写入可复用数组，去掉按包/节点重复分配。**没有改变erf、列积分、查询、误差预算或物理步长。**结构/质量退化重建后再建立新暂存缓冲，不假称内存无代价。

质量代理为`Σ(surfaceArea(node)·packetCount(node))/(rootArea·N)`，相对最近重建增长超过默认2.5才重建，避免每次小扰动重排。它是树成本代理，不保证所有查询visited恒定。反例测试增长3.328触发回退，随后小扰动继续refit。

`node --expose-gc verification/pyro-smoke-columns-update-check.mjs`的[最终结果](pyro-smoke-columns-update-check.json)：**8/8通过**，连同核心20项共28项。含128个完整SPD、四次缓冲交换、64条uncapped射线，快路径与baseline差0；64帧4096包同输入交错对照中，最大uncapped差0、visited比fresh tree最大1.0。增加/merge/负ID、profile/核变化、无效更新原子性与核/query原文范围检查均通过。

| 4096包，暖机8次后64次连续update | mean | median | P95 | max |
| --- | ---: | ---: | ---: | ---: |
| 最终refit候选 | 3.183ms | 3.063ms | 3.933ms | 5.516ms |
| 同run原版完整重建 | 11.687ms | 11.406ms | 13.909ms | 18.815ms |

同一候选前一次固定输入记录约2.959/3.309ms（mean/P95），保留在[round2-before-spd](pyro-smoke-columns-update-round2-before-spd.json)，体现运行负载/JIT与样本差异，不拿跨run最小值宣称因果提升。上述比较只以每次run内同输入A/B为准。第一轮完整源码/报告保留在[round1目录](baselines/smoke-columns-refit-round1/)，最初未触发阈值的QA fixture失败也保留在[round1-first](pyro-smoke-columns-update-round1-first.json)；改用真实超过默认阈值的分离线性群反例，没有放松实现阈值。

暖机后的64更新，新包/节点**记录**计数均0；仍有profile、Set等小临时对象，不能写成zero-allocation。两套暂存数据也增加保留内存。整进程heap采样包含输入生成与交错baseline，约23.3MB开始、GC前153.6MB、最终GC后25.3MB、采样峰184.8MB；不是候选独占内存或累计分配字节。浏览器实景、快照复制、GPU上传/透明覆盖和每帧大量源锚点查询必须另外测量，不承诺这组Node数字能带来60FPS。

最终源码SHA256：`cad9b4f1fc01e47fc2f961274cb56f441cb12070af1b8dd83f7b6145114641a4`。实现冻结，后续生产准入由根代理另行决定。
