# R10：同数值烟透射数据通路与 G1 接口

运行时只改 `pyro-smoke-columns.js` 与 `fireworks.js`；宿主 `pyro-smoke.js` 的可选转发由另一 owner 独立维护。本层不改变源、密度、光强、颜色、C/P、20Hz、轨迹、误差预算或音频。

## 实际归因

`R10-HOT-CPU-ANALYSIS.md` / `r10-hot-fireworks-cpu-analysis.json` 严格裁出3334ms共同热窗口（2259个加权间隔）；原始203秒135955样本大部分暂停，未拿来计算烟花比例。`between`含子调用1987.100ms、约59.60%；`fillRecords`含子调用2269.226ms。停止对时有141.5ms边界不确定性，CPU阶段包含driver等待和profiler开销。该轮resolved field关闭。

## 可选 T writer

`columns.writeTransmissionBetween(from, to, out, options={})` 返回同一个 caller-owned `out`。输出限长度3的普通Array或Float64Array；可选options只接受errorBudget，默认仍为1e-5。旧 `query` / `between` 的函数体、返回对象及数组所有权完全不变。

新路径一次验证endpoint、使用同步私有scratch，仅输出调用方实际使用的RGB T。保留原始两次方向归一化的浮点顺序、完整SPD/erf/erfc积分、Kahan累加、BVH访问/子节点顺序、相同scalar外向遗漏界及每次遗漏决策。只跳过未请求的逐通道误差返回数组和完整result对象。计数与实际两次时钟仍执行，未把关闭的计时伪报成0。

FW为可选 `medium.writeTransmission(origin, endpoint, out, {reflection,planeY})` 持有一个私有Float64Array；没有新writer时继续使用原 `medium.transmission`。宿主writer必须按原规则从water-hit开始镜像光程；不由columns再做一次折射/空气处理。输出仅即时用于原Float32颜色乘法，不把共享scratch作为原API的新返回别名。

专项 `node verification/r10-transmission-fast-check.mjs` **7/7**：1078组含0/非0遗漏预算、旋转SPD、短/长/内部/零长度射线，T与所有非计时计数逐值相同；原完整kernel与query代码逐字不变。实际FW+实际宿主的双菊、5时点×主/镜像，共10路填充，所有活跃Float32上传属性逐位相同。这是CPU真实模块与submit stub，不能称GPU截图验收。

真实双菊seed42/43、burst+1.4的48包/3456发光record生成6912主与water-hit镜像ray；6组AB/BA、各1暖机的Node块均值：旧43.096ms，新32.743ms，checksum完全相同。只说明该CPU工作负载，仍须浏览器同热段重测。首版使用内部Float64Array的候选曾51.757→75.351ms变慢，源码和`r10-transmission-fast-typed-scratch-first.json`均保留；最终只把内部scratch改成可复用普通数字数组，未改公式。另一次合成射线复测保留为`r10-transmission-fast-array-scratch-synthetic.json`，不与真实双菊工作负载混为同一测量。

原columns独立数学20/20、连续refit8/8、adaptive CPU7/7、原combustion metadata15/15及ledger13/13均重新通过。没有为通过降低原数学断言。

## G1：完整 native burning-body 因果采样

`fireworks.smokeSourceProvider.sampleBody(eventId, {bodyId,time})` 返回深冻结的 `{eventId,bodyId,time,position:[x,y,z]}`。支持实际 `event.heads` 中的root、child与ground-comet；carrier不是发动机/燃烧体，不在此body集合。要求安全非负整数bodyId、有限 `time<=simulation.time`、active且未丢失因果风历史、`birth<=time<birth+life`。使用原physics `sampleBody`，不读render tail、I或RNG；不提供未来XYZ。

native-body索引WeakMap只在首次G1调用时创建，body对象仍取实际当前状态；没有强持有退休event的archive。旧 `sample(kind:'root'|'event')` 函数体和计数语义未改，child仍被旧root入口拒绝。G1本身不改变旧provider诊断计数、records或ledger缓存。

`node verification/fireworks/combustion-body-sampler-check.mjs` **7/7**：十型1048 aerial roots、144 children、113 ground bodies，共2646个因果点与实际原physics坐标逐值相同；crossette .78s分裂、旧入口拒绝、未来/出生前/恰death/退休/历史裁剪/disposed均覆盖。默认事件、旧sample、RNG结果、records、ledger、bounds及音频保持。

## 独立基线与严格逆变换

- `verification/baselines/r10-before-transmission-fast-path/`：FW927与columns cad9完整基线。
- 性能层只逆FW2处、columns3处，固定字串缺失/重复拒绝；columns完整回到cad9。
- `verification/baselines/r10-fireworks-before-body-sampling/fireworks.js`：性能层后的FW36e5基线。G1独立2处逆变换精确回到它，再逆性能层恢复927。
- 原adaptive/坐标/端点各层继续严格组合，未用宽正则掩盖其它修改。

当前冻结源SHA256：FW `b37ea388471b6f50a307327fab95ccc10d7f9aaa1dc46ed921fc1abd9c890e43`；columns `d44a897ab8c7c9f58e0c7f974d07d1206b374d44dbb228bf05ebbe71131afad6`。音频仍 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。0c2原版的实际GPU记录仍标为0c2，不能换成新SHA；热段成本由owner另行实测，不由Node结果推导FPS。

## Array 输出预检的一处硬化

独立代理最初147组彩色SPD/AABB边缘数值与计数通过，但公共Array输出预检有真实漏洞：长度3的稀疏Array继承readonly[0]时，计算和计数完成后才在写回报TypeError。生产FW使用的私有Float64Array未受影响。原独立6/7保存在`r10-transmission-logical-independent-first.json`，完整0c2源保存在`baselines/r10-before-transmission-array-out/`。

d44只改Array预检一行：own可写data允许；对holes先确认可扩展，再沿prototype找到最近descriptor，readonly或accessor均在任何积分/计数之前拒绝；没有descriptor或最近为可写data则允许。合法holes、own可写覆盖继承readonly、可写近层覆盖远层readonly及sealed dense array继续可用，没有扩大整数TypedArray支持。Float64分支、全部数学、scratch、时钟和计数代码未变。

`r10-transmission-array-out-check.json`专项6/6，包含原始readonly反例、两层prototype accessor且未调用getter/setter、合法稀疏/遮蔽以及拒绝时所有计数保持0。原完整T专项再过7/7，1078射线与498864个上传分量保持逐位相同；本次同一Node块均值43.211→33.796ms，作为重测变动单独记录，首轮43.096→32.743不改写。新增严格1处逆变换`r10-transmission-out-normalize.mjs`恢复0c2，再与原3处逆变换恢复cad9；独立数值/行为断言保持。

独立owner随后复验`r10-transmission-logical-independent-check.json` **7/7**：只在原columns SHA门前接该1处严格逆变换，实际d44与归一0c2分别记录，其余FW/host/adapter SHA与七个行为/数值断言不变。同一继承readonly[0]反例现为rays0→0、kernels0；147条彩色SPD、输出别名及真实G1/G4事务仍通过。原6/7未覆盖。独立最终JSON SHA为`346dcbb225446d9bf2b45a8955d8285039241ca08e7dbf7f93534e0da42f0ed3`。
