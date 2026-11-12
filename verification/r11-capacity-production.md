# R11：精确前8候选选择已落地

`pyro-smoke-state.js`已仅替换容量合并中的候选选择一处；当前冻结SHA256：

```text
67fa049f11928d23edf7b57798fd899fdbacb8956c3d939a479839642b429172
```

[单点逆变换](r11-capacity-top8-normalize.mjs)将新选择块恢复为原filter/sort/slice块后，源码完整等于已封存R10基线`verification/baselines/r10-sealed-runtime/pyro-smoke-state.js`，SHA256 `1aa90d24f42adbf6416bd871e8de56d26c4841535e7f0d7f80e591286c6a2cba`。R10报告与manifest没有改写，前一只读[容量审查](r11-capacity-audit.md)仍是原版本证据。

实现按原`score → i → j`比较器，为同源、其他两类各维护最多8个有序候选；二分插入的`<=0`使全键相等的新对象排在已有对象后，与stable sort一致。输出仍同源类在前。原pool生成、seen去重、完整15点/36射线diagnostics、quality严格`<`、负merge ID、M/μ/Σ合并、热学与Taylor/Brownian演变、光学函数、packet splice次序、容量4096、source接口和音频均未改变。

## 已执行检查

[执行器](r11-capacity-production-check.mjs)及[原始结果](r11-capacity-production-check.json)：**10/10**。

1. 单点逆变换与基线全字节相等；缺失、重复或新旧选择块共存均被拒绝。
2. 30组空池、单元素、少于8、恰8、多于8及分类边界。
3. 8组全分数并列、全键重复但对象不同、signed zero、最小正数及宽有限分数；逐对象identity和稳定顺序相等。
4. 固定LCG的400组池，399558个对象；大量分数和索引并列。
5. 100000候选池的最终16个对象identity完全相等；冻结输入未被修改。
6. 8组真实状态：Brownian/Taylor、容量1/2/7/32、多source、多profile、各向异性核、不同温度与升力；完整snapshot/diagnostics及96条射线/点采样精确相等。
7. 原生willow seed42生成完整6291格源带（65536只隔离源带生成），M20.350000000000037、reserved0。
8. 该源带前4112格输入原4096容量，baseline→production→production→baseline四次回放，精确16次合并；完整snapshot/diagnostics bit-exact，forcedMerges均0。
9. 四次回放中每次16×16候选的顺序、索引、同源分类和分数逐位相等，共306668个生成候选/256个选中候选。
10. 测试前后生产state源码hash保持上述67fa；没有测试期间改动。

## 本次性能观察与限制

16次合并中，原选择阶段80.4793/106.6201ms，生产新选择阶段7.3435/6.6066ms。算法选择工作由全池O(E log E)改为O(E log8)比较和最多8项移动，额外选择空间O(8)。**pool本身仍存在**；分组、x序构建与成对生成仍约113.27–184.63ms/16次（baseline两次），新版本对应约133.29–150.03ms，时变/GC噪声明显。

整条4112格预填/演变墙钟baseline528.10/797.14ms、production509.56/770.99ms。这个回放一次排入全部未来前缀，queue校验/插入成本与真实逐帧流式调度不同；它用于同输入等价和容量热点定位。不得把以上数值称为浏览器FPS或整体稳定增益。最坏场景、完整6291格的4096容量回放、双柳、分钟积烟和GPU预算仍未通过；根目标继续。

原光学诊断仍只有采样误差，合并瞬时矩守恒也不保多峰与未来异温分离。精确选择改动没有提高其光学保证等级，照片感仍须实际画面验收。
