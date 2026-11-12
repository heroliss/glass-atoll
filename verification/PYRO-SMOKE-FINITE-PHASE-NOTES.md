# Pyro近场角分布opt-in：有限范围近似

2026-10-27。只改`pyro-smoke-renderer.js`和专属QA/说明；不改main/local-lights/physics，不改上游cluster半径选择。source冻结SHA **05293e2130f1afdb5d3d5ffa99a87c511574dd7bdfe2a2614e2d18b819a80c6a**，原97fd源及viewport原5/5报告保存在`baselines/smoke-before-finite-phase/`。

## API与近似

`render({finiteClusterPhase:false})`默认关闭；缺省或false走先前HG原表达式。true只影响共享local slots4/5两烟花源，或fallback路径的2个clusters；Sun/Moon方向光、ambient、3地灯与手电完全不变。lastRender诊断记录flag，不读C、不改P/I/色彩/距离衰减/质量/柱密度/排序。

在当前packet有限column的光学conditional-mean处得到物理接收点p，令`q=distance(source,p)/sourceRadius`：

```text
w = smoothstep(1,2,q)
phase = (1-w)/(4pi) + w*HG(mu,gSmoke)
```

q≤1各向同性、q≥2原HG，过渡C1连续。距离权重不依赖观察方向，因此**固定物理p**的角积分仍1；不能把Gaussian conditional mean随view改变的整体图像当已解精确体积分。源强、inverse-square/radius近场分母、range/cone仍由原source/localIncident负责，phase没有额外能量增益。HG的原全角峰界≥1/4pi，所以`getRadianceBound`整个源码不变仍保守。

这是球对称远/近平滑近似，**不是真实扩展源角积分**。平面ring/smiley、非均匀星分布和观察点位于源体内部时的真实相函数卷积仍不同；radius8.8m改为moments/RMS是上游独立候选，不能把两个改动混称一个精确球。亮棉团是否改善须分开半径模式/phase模式固定时间A/B，不能从角积分通过直接宣布照片感提升。

## 验证与可回退性

- `node verification/pyro-smoke-finite-phase-check.mjs` **9/9 CPU通过**：多半径近/中/远8192段角积分、各向同性、远HG、端点连续/导数、旧HG峰界、只pyro分支、P/原falloff/source范围。
- `pyro-smoke-finite-phase-normalize.mjs`仅7个逐项exact replacement，每处先断言出现恰1；结果**完整逐byte还原97fd**。缺失/重复必失败，不宽泛删shader/render；无关mutation不会被消掉。viewport guard v2仅先过此normalizer，原97fd检查/原JSON封存，不能用v2冒称新shader已GPU通过。
- 原renderer math18/18、air math15/15、actual local factory+stub13/13均在新源下通过。
- 新GPU helper `runSmokeFinitePhaseGPUCheck(THREE,renderer)`来自`pyro-smoke-finite-phase-gpu-check.js`，14项，冻结SHA **c932693dac0ec5ac39f06343e908fac19f9e1f94d3a81a2ed036445059c764d9**。覆盖默认/false/air/P相对97fd逐位、local近3方向/过渡/远、fallback同相函数、远inverse-square、P一次、非pyro原样、原raw bound、true→false/null回切、alpha/有限/状态恢复。**待root实际运行，不能以提供helper称通过。**

GPU夹具为1pixel、synthetic far depth；没有生产PBR/深度/MSAA/画面/性能已通过的扩展含义。没有新sampler/RT或循环计数，true最多2源额外distance/smoothstep，false保旧表达式；真实成本与当前烟量/overdraw仍应由root实测。旧DPR9+shared50实际GPU结果仅归97fd阶段，manifest单独记录。
