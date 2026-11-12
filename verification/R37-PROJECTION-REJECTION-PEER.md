# R37：投影复用负收益的独立复核

决定：同意拒绝本候选，不进入native缓存A/B。这里只读既有CPU源码/216条样本/6项等价结果及恢复字节；没有重跑计时、factory、浏览器或GPU。

样本计时覆盖同一个实际生产factory实例的双眼`getRadianceBound`及随后mirror/main `estimateTrailSampling`。每次先重建records generation，更新本身在计时外；三阶段+.7/+1.7/+2.5，各3组A1/B1/B2/A2、每组6次，共108 off和108 on，没有删除样本，18次预热不计入。相同generation内确实出现重复投影，不能用跨帧旧bounds虚增命中。

按原始样本重算，off均值13.823164815ms、on17.528521296ms，比值1.268054135；中位比1.293380739。三阶段均值比都>1。双眼bounds均值由11.937917593升至14.387376852ms；双眼estimate由1.885247222升至3.141144444ms。`passed:true`表示测量完整/等价成立，收据明确`performanceAdmissionPassed:false`，并非优化通过。

源级机制与负结果一致：capture阶段即使原投影仍全部执行，也增加每源输入键构造、bound/scratch拷贝及WeakMap写入；estimate命中仍重新构建/比较键并复制结果。池最多分配3456行后复用，排除了“只有首帧无限新分配”这一解释。现有数据不能进一步把增量独立归因给键、拷贝、WeakMap、GC或JIT中的某一项；没有逐项成本实验，也没有必要为拒绝候选再做原生压力测试。

范围限制：fixture使用保存机位与镜头输入、实际constructor/光学行，但mirror由clone翻转Y/lookAt构造，**未应用water.prepareReflectionCamera的oblique投影修改**。这是代表性CPU双眼调用，不是当前native镜矩阵的严格逐值重放。计时没有render/fillRecords/SourceT/SH提交或真实GL；不能把它当完整光度11ms、浏览器FPS或GPU结论。它仍足以说明该候选在已测重复路径没有收益，故无需进入硬件准入。

只作为后续建议：当前正常生产记录由闭包拥有；公开framing/trace复制位置/伸展，exposure对象冻结，ledger是另行打包数据。若以后单独证明“同generation+requested shutter私有行不可变、无callback注入、无共享可变别名”的合同，可以研究以身份替代逐源数值键，估计器仅读私有缓存结果而不拷回scratch。但这需要独立所有权证明和收益数据，不能直接删除当前保护，更不能把测试注入的可变私有行当不变。先看真实光度子段profile，再决定是否值得第二个缓存候选。

恢复已独立核对：生产`fireworks.js`与前基线字节完全相同，SHA256 `03fdb7038bffbfc769924ffff6ee57a51b5e9f8b2d3c72169d06e72b9d45c735`；候选`3d8d6bffe8a26e58a6f44c90e3aef1bdd09b11b43b3cf3b621d3f6e2a4d2809f`仅保留于`baselines/r37-rejected-source-projection-reuse/`。新缓存API/分支不留在生产，radiant物理/燃烧/音频未由本审查修改。
