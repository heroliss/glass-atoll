# R36 逐点烟演化测量

实际原生中档、8×MSAA、N8、HDR外部拷贝，普通与逐点烟的保存测量并列：

| 路径 | 墙钟 / 物理推进 | 帧 / 平均FPS | GPU均值 / P95 | CPU均值 |
|---|---:|---:|---:|---:|
| 普通代表烟 | 3.0321 / 3.0036 s | 101 / 33.31 | 22.89 / 33.258 ms | 29.09 ms |
| QA逐点烟 | 3.0282 / 2.7988 s | 64 / 21.13 | 29.15 / 38.39 ms | 45.82 ms |

两组是不同时间的单发演化测量，有 profiler 开销、不同缓存/环境调度和不同结束年龄，**不是受控A/B，也不是最亮峰或稳定FPS验收**。逐点烟profile有65条CPU帧而benchmark计64帧，边界不同，全部保留。CPU与GPU时间重叠，不能相加。

逐点烟主要CPU wall/submission阶段：FW/排烟刷新 **10.84 ms**、光度准备 **10.81 ms**、water captures **10.06 ms**、main/lens/display **10.15 ms**。普通烟分别2.65/11.06/6.52/6.57 ms。`firework-simulation-audio`源码边界实际包括`flushPyroSources`的连续排烟/状态刷新，声音关闭，不能误叫10.84 ms的纯音频或纯烟花运动成本。光度准备仍是约11 ms的重要CPU段，包含bounds/cluster和SH提交/可能等待，不能直接等同SH的GPU耗时。

逐点烟包前后1561→2442，SH源1699→47；烟体主眼proxy像素上界约1.31m→3.21m。光源在消退而烟在扩散，负载方向不同。初始暂停快照虽`SH reused:true`，演化区间真实增加 **65次SH bake、130次SourceTprepare、532次SourceT数值draw**，不能把整场说成缓存测试。保存数据只有端点/累计计数，不足以重建每帧pair峰值。末次T field记录48行，与瞬时SH47行不同；普通最终field还留着上次3行，实际live两眼已无源，不能把field诊断当当前眼消费。

逐点烟GPU最大179.628 ms保留；最大CPU profile168.5 ms中有122.7 ms的environment-capture离群事件。没有对齐的分阶段GPUquery，不能把这个峰值归因于烟或某一次环境捕获，也不能删掉后宣称达标。

物理推进比墙钟少229.4 ms。当前循环明确 `delta=min(clock.getDelta(),.055)`；raw帧间隔有14次超过55 ms，裁掉204.3 ms，解释了大部分差值，其余来自before/benchmark/after边界未对齐。观测物理速度约墙钟的92.4%，说明该保护在慢帧时会让动态变慢；不是海浪/烟花物理模型变了，也不能用该区间评价严格实时时程。普通为99.1%。

[只读审查4/4](./r36-logical-performance-read-audit.json)，不改原raw/生产、不做新GPU。当前仍需优化连续排烟CPU与光度准备，并对稳定工作负载做后续有界测量；本组数据没有证明多发或推荐60FPS能力。
