# 多场并发的FW容量

FW初始光栅/账本容量仍14000。光栅属性按需倍增，上限262144行；瞬时账本按需倍增，上限131072行。全部分配先完成再替换，超上限明确抛错，不截断光源。诊断增加 `capacityLimits`、`sourceRayCapacity`，`physicalLedgerCapacity` 表示实际保留的账本backing行数。32个菊样式在N16时的参考行数为 `32×192×17=104448`，落在112000行账本分配内。

prepared-view仍最多4个未消费视图，与场数无关。每个private视图只持有实际有序行所需的原始double射线；普通共享射线按需增长，不按262144硬上限预分配。两簇受光近似和两组账本聚合继续保留全部场次；cluster输入按event一次分组，保持原累加及最近邻合并顺序。shader、光度公式、快门和powered分段合同不改。

大账本缩回≤14000源时，以原14000行capacity和无复制subarray视图发布，私有backing不反复缩放。现有SH bound既检查count也检查capacity，故不能把大backing容量继续当作小源集合的发布capacity，否则小场景无法恢复原SH输入域。

CPU检查 **6/6**，`fw-capacity-check.mjs/json`：实际双发小producer与归档factory的shader/有效属性/账本/cluster/已有诊断值完全相同；28001行完整写入及排序；32个event ID完整聚合；private射线ownership/释放；超限时已有数组、账本和request版本不变；104448行账本与grow→shrink真实bound准入；powered长快门在renderer访问前拒绝。大行数是私有注入的容量fixture，不是32发物理模拟、GPU或FPS验收。

旧FW原件和首轮fixture错误均在 `before/`。首轮脚本哈希URL参数错误未写报告；随后5/6误把深度排序后的首行当输入首行，修正测试并保留原件。先前6/6候选在增加shrink-view保护前亦保留。

显存风险：43个Float32属性在262144硬上限约45.1MB CPU，另有相近GPU属性空间；131072行账本约4.2MB。还需考虑射线、JS记录和驱动开销，不能当作整场景显存测量。SourceT的18000源、SH的14000源及完整配对预算未提高；大源完整烟尘路径仍不支持，应明确使用light/off或拒绝，不能回退巨大CPU查询。极端terrain/contact的64子段可能超出光栅硬上限，保留显式拒绝。容量支持不保证32场同时可达到目标帧率。
