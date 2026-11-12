# R38：首次光学记录构建的一个候选

**只读方案，未实现。** 不改 kernel、shader、八个时间 bin、N8 尾部、空间积分、接触裁切、源能量或烟源。R37 投影候选仍先完成，下面只确定下一次的一项改动。

## 已测与推断分开

`verification/r37-native-detailed-profile.json` 的 91 个实际 photometry 帧：`main-source-bound` 均值 **8.332967ms**、中位数 7.6ms；`mirror-source-bound` 均值/中位数 **0.8ms**；`resolved-smoke-lighting` 均值 **2.496703ms**。这是各 CPU 段的包围计时，没有细分到 RGB 积分、运动采样、分配或 GC，不能把两眼的 7.53ms 差值当成一个函数的实测成本。

当前 `main.js:993–996` 总是先取主视图源上界，再取镜像上界。两次使用相同的当前物理时间及矢量源快门；`legacyShutterSeconds:0` 只影响旧式标量源，并不取消新曲线烟花的快门。

`updateRecords` 每个新物理更新替换 records 中的 p 对象，并递增 recordsGeneration。主视图首次遍历 `opticalRows` 时，可能承担：接触支持求解、光学锚点运动采样、八 bin RGB 构建、每行 24 个 Float64 的独立数组、尾部换色/分配、邻居拉伸锚点及缓存记录的构建。`opticalViewCache/contactViewCache` 按 p+shutter 缓存结果；`opticalAnchorCache` 按运动对象+generation+shutter 缓存。因此反射遍历通常已取得同一批光学行，仅另算它自己的相机投影、深度裁切和 32×32 上界累计。这是与差值相符的源码解释，**不是未测子步骤的耗时证明**。如果其他消费者先调用 framing/上界，成本也可转移到那个首次消费者；“主视图必然贵”不是模型规律。

## 只选一个：给完整空气支持行新增 taps-only writer

当前对应函数叫 `sampleProfileBodyEmissionWindow`（physics 公开包装为 `sampleBodyEmissionWindow`）；没有名为 `integrateCurrentSourceWindow` 的当前生产定义。正宽度路径已经是直接 RGB 短窗口积分，且 `verifiedWindowProfiles` WeakSet 已避免反复验证，不能再声称把“完整 CDF 采样换成 RGB 积分”是一项新优化。

不过 FW `opticalViewRecord` 的两处调用都提供 `outRGB:rgbTaps`，并**完全丢弃返回值**。内层仍每 bin 做 `totalR/G/B += r/g/b / width`，随后创建 `averageRGBReference` 数组、映射创建 `integralRGBReferenceSeconds` 数组、再创建含诊断字符串/字段的返回对象。这些汇总在这两处没有消费者。

建议下一次只新增 `writeProfileBodyEmissionBins(body,{fromAge,toAge,bins=8,outRGB})`，明确要求调用者的输出数组，返回相同数组或不返回汇总；FW 两处完整支持快路改用它。放在现有 layer 模块即可，FW 直接静态导入，现有依赖图没有新增回环。**旧公开 window 函数保持原输出与计算不动**，部分接触/动力分段继续走旧函数。本项预计只涉及 layer+FW 两个生产文件。

新 writer 复制原有验证和 bin 算法，仅不累计无用 totals、不建立两个汇总数组和返回诊断对象。仍保留每个最终光学行自己的 `Float64Array(24)`，不做池化，也不复用一块临时数组给多行。根据 N8 上界每个完整行可去掉约 24 次 totals 除法/24 次加法/3 次 integral 乘法，以及两个小数组和一个对象；这只是操作数，不是已兑现的毫秒收益。完整 RGB、运动和接触工作的绝大部分仍保留。

## 精确性和生命周期合同

- 仍由同一不可变烧灼曲线驱动。材料 CDF、物质时间表、emissionReferenceI0/G16、全时 RGB 上界、当前照明 ledger 都不变。R37 估算约 0.44ms 的孤立 CDF 机会发生在点采样/物理更新链，不足以解释这次首次快门构建段，本项不顺带实施它。
- 完整保留 `fromAge = exposure.from - body.birth - lag` 的左结合运算顺序，以及 `start=fromAge-delay/end=toAge-delay/width=end-start`。不能把 width 简化成别的时差表达式；绝对时钟上的舍入是现有输入的一部分。
- 八 bin 的 `start + width*bin/8`、末 bin 直接用 end、逐 knot 正向遍历、lo/hi overlap、u/v 除法、每通道补偿求和、最后除以 `width/8` 全部按原顺序。不能改成 reciprocal 乘法、斜率预乘、中心点近似或两个累计前缀相减。后者尤其会损伤很窄窗口的精度。
- 零宽窗口继续按旧点采样的 RGB 和原验证处理，不把这一分支当作普通 `1/120s` 收益。原 profile 必须来自受认可工厂，有限/倒序/不可表示窗口、bins、输出类型/长度的验证顺序与拒绝行为都需要保留。输出从第 24 项后的哨兵必须不变。
- 每行的 rgbTaps 从构建到两个上界/视图上传及该 generation 的缓存读取期间保持独占。不能回收给下一行、镜像或新 generation；也不能让共享缓存记录因一次重新填充而改写。继续允许旧缓存由 WeakMap 的键生命周期回收，不增加跨帧保留。
- 旧公开 sampler 的 average/integral **不能从最终 taps 重新推导**来“共享实现”：现有 `sum(r/width)` 与 `sum((r/(width/8))/8)` 不保证二进制相同。为了小范围、可逆、精确，本项宁可短循环复制，暂不做 DRY 重构。

本项不先动运动锚点、exposure 对象 interning、接触求解或缓冲池；这些有不同的时间、对象身份与别名合同。Immutable segment 的 dRGB/dAge 将来可研究，但不把除法换为预计算逆数，也不与本项合并，避免无法归因。

## 最小验收

1. 两文件闭合反向转换恢复旧文件逐字节，其他生产文件/所有 shader/批准音效哈希不变；旧完整公开 API 的全部字段和拒绝行为精确保留。
2. 使用实际 R36 192 个实例，跨发射/点燃/曲线 knot/熄灭/尾部滞后/零强度/非零延迟，0 与 1/120 等合法窗口；新 writer 与旧 window 的前 24 个 Float64/Float32 值逐项 `Object.is`，后缀哨兵不变。包含极窄可表示窗口和应拒绝的不可表示 bin；不以 epsilon 代替精确要求。
3. 通过实际 CPU factory 比较全部光学行（包括 rgbTaps、sourceAge、maximumReferenceRGB、position/velocity/stretch、曝光/接触元数据），以及两眼上传数组/计数、当前照明 ledger、物理 snapshot/烟源 descriptor。部分接触仍用旧路径，要有明确分支证据。不得为了通过而减少行或把黑暗当前值替代曾在快门内发光的历史。
4. 仅在上述精确门通过后，用现有已允许的正常 native 场景测首次消费者和镜像的 CPU 段；说明 JIT/GC/冷热状态，**不预设必有收益、不把 8.33ms 全算为可省**。没有稳定收益就不推广，而不是扩大改动或降低画质。
