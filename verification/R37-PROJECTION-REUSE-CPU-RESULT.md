# R37：源投影复用首个 CPU 候选未获性能准入

同刻重复确实存在，但本次完整键校验/结果拷贝的复用候选更慢，默认保持关闭。未执行浏览器或 GPU，也未声称省下 R36 的约 11 ms 光度阶段。

基线为归档 `fireworks.js` 的 `03fdb703…d45c735`；候选为 `3d8d6bff…4d2809f`。固定实际生产烟花 seed341070、radiant120、N8、native1209×1292 尺寸及原快门，用保存的主相机与 CPU 平面镜像相机，在 +0.7/+1.7/+2.5 秒分别确认 2816/3072/3052 次 `getRadianceBound` → `estimateTrailSampling` 的原始投影调用完全重复，输入、输出数组与 scratch 数值均精确相等。镜像相机没有生产水面 `prepareReflectionCamera` 的 oblique 投影修改，故这是代表性 CPU 两眼测量，不能称完整 native 镜面渲染。该仪器化探针 3/3 通过；它的时间不是性能测量。

候选只把刚算出的 true 投影结果存入当前 generation、最多两眼的有界私有池；上界循环仍逐源原算，估计阶段只有完整相机/optics/源数值键相等才复用。false 早退不缓存；有 callback 的查询旁路。`fillRecords`、Float32 裁剪、光学行/采样数、物理、源亮度、shader 与音频未改。运行时 getter/setter 不进入物理配置；默认 `false`。旧/关/开、旧五类 profile、键失效、源对象内容变化、callback、false 路径及源码不变检查为 6/6。

CPU ABBA 使用同一个实际生产实例，18 次预热流不计入统计；每个计时样本前刷新记录 generation（刷新本身在计时外），完整计时两眼上界与两眼估计，没有 `render`/`fillRecords`。三阶段各 3 组 A1/B1/B2/A2、每组 6 次，共 216 个样本，不删除异常值。

| 相对爆炸时刻 | 关闭均值 ms | 开启均值 ms | 开/关均值比 | 开/关中位数比 |
|---|---:|---:|---:|---:|
| +0.7 s | 12.2652 | 15.8476 | 1.2921 | 1.3251 |
| +1.7 s | 13.9098 | 16.7397 | 1.2034 | 1.1815 |
| +2.5 s | 15.2946 | 19.9983 | 1.3075 | 1.2177 |
| 全部 | 13.8232 | 17.5285 | 1.2681 | 1.2934 |

这是当前 Node/CPU 固定阶段结果，包含实际光学/接触准备、JIT/GC 和调度噪声；不能外推浏览器全帧或 GPU/FPS。两眼池在本次测量最多累计分配 3456 行，之后复用。每次 capture 都构建源键、拷贝 bound/scratch 并写 WeakMap；估计命中仍构建并比较键、拷贝结果。这解释了为何短投影计算可能比完整缓存协议便宜，但本次没有逐项独立归因。统计文件的 `passed:true` 仅表示测量完整且数值有效，**不表示性能准入通过**。

Root 已决定不保留关闭状态的候选分支/QA API。候选代码、实际输入、所有 CPU 脚本/结果及静态依赖共 106 项（4,354,325 字节）已逐字归档到 `baselines/r37-rejected-source-projection-reuse/`，archive manifest 为 `2339e4fd…a8933a`；生产 `fireworks.js` 已恢复完整 `03fdb703…d45c735`，语法检查通过。恢复收据为 `r37-projection-rejection-restore.json`。未开展 native cache A/B。

下一步仅读取 root 新增的光度子段计时，定位尚未归因的成本。默认开启、native A/B 收益、全帧收益和视觉验收均未准入。

证据：`r37-projection-baseline-probe.json`、`r37-projection-reuse-check.json`、`r37-projection-reuse-cpu-abba.json`。历史 R36 文件未变。
