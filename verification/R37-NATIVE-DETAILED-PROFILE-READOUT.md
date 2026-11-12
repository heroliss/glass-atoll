# R37 native 光度子段读数

只读取 root 已保存的 `r37-native-detailed-profile.json`；算术/源码关联检查 **6/6**，没有重测或生产修改。生产 FW 为恢复后的 `03fdb703…d45c735`，main 为仅增加分段记录的 `08b43c65…0cbedf`，被拒绝的缓存未启用。

本次是普通代表烟的单发生长/衰减实景，native1209×1292、N8、HDR、sound=false。3.032 秒墙钟产生 91 个帧间隔，记录平均 **30.013 FPS**；88 个异步 GPU 样本均值 **22.420 ms**、P95 **30.540 ms**、最大 **228.351 ms**。这些是此段观察值，不是推荐档达标、峰值覆盖或受控 A/B。

91 条内部 photometry 记录全部 `force=false`，内部总耗时均值 **12.973 ms**（外层同段含边界开销为13.020 ms）。每行15项之和与内部 total 精确闭合。

| CPU wall/submission 子段 | 均值 ms | 中位数 ms | P95 ms | 最大 ms |
|---|---:|---:|---:|---:|
| main source bound | 8.333 | 7.600 | 11.700 | 16.300 |
| resolved smoke lighting | 2.497 | 2.100 | 3.600 | 15.100 |
| mirror source bound | 0.800 | 0.800 | 1.000 | 2.700 |
| indirect + cloud shadow | 0.695 | 0.500 | 1.300 | 2.800 |
| source clusters | 0.316 | 0.300 | 0.400 | 0.800 |
| source world bounds | 0.064 | 0 | 0.500 | 1.400 |

`main-source-bound` 占这组内部光度均值的64.24%，但**不是**孤立 `writeSourceBound` 的8.333 ms。源码顺序是：本帧更新生成新 records → clusters/world bounds/SH ledger（不消费 `opticalRows`）→ main bound 首次遍历当前快门的光学行 → mirror bound。首次遍历会构造 emission-window/anchor/contact 行；同快门的 mirror 随后命中已有行缓存，仍执行自身投影与 overlap bin 累加。因此两眼不对称与现有缓存顺序一致，尚不能把约7.533 ms差值全部归因于曲线/CDF或任一子函数。SH 子段同样含 CPU 组装/pack/提交及可能等待，不是独立 SH GPU 时间。

早段 index2（从0计数）的全帧 CPU171.8 ms 中，`main-lens-display` 为142.5 ms；index3的最大光度24.9 ms 中，SH段为15.1 ms。没有删掉这些值，也没有证明它们由冷编译产生。GPU最大样本与 CPU 行不能按数组索引配对：异步完成的 GPU 样本88个，CPU样本92个。

| 保存端点 | 起点 | 终点 |
|---|---:|---:|
| physical time s | 5.946209 | 8.836909 |
| smoke packets | 24 | 24 |
| 每眼 optical sources | 1600 | 985 |
| SH ledger sources | 1600 | 980 |
| 每眼 T pairs | 38,400 | 23,640 |
| SH pairs | 38,400 | 23,520 |
| 两眼T + SH 不同核总pairs | 115,200 | 70,800 |

两端 T/SH 都是 effective GPU，CPU medium query均为0；每眼T3 draw、SH3 draw。区间累计 **SH fresh bakes +92**、T prepares **+184**、T draws **+552**、optical record generations **+92**，说明持续演化时没有跨帧复用一张静态 SH 来冒充 fresh 计算。91条 profiler 行与92个更新/CPU样本存在测量窗口边界的一帧差；端点计数不能伪造逐帧工作量曲线或最大源数。末端 SH `reused=false`，起点观察时的 `reused=true` 只说明该时刻已准备过。

物理时间推进2.8907秒，为墙钟的95.34%；差141.3 ms。保存的帧间隔有3个超过55 ms，按现有时钟上限计算的间隔裁剪代理为124.7 ms；余16.6 ms包含不同边界/计时钟，不能全部归咎于该上限。没有据此改时钟。

下一项有效定位应在 main 首次光学行构造中区分 emission-window、contact/anchor 与投影/bin 成本。此处只给测量边界与源码依据，不把它写成新的优化或收益承诺。完整分布、顶部异常行、输入hash和6项检查在 `r37-native-detailed-profile-readout.json`。
