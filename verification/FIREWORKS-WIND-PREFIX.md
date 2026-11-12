# 烟花变风压力：精确前缀修复

2026-10-27。本轮只改 `fireworks-physics.js` 与新增 `wind-response.js`；`fireworks.js`、风速平滑器、事件、源强、随机序列及全部风段均保留。

旧源码及SHA256：[baseline](baselines/fireworks-before-wind-prefix/sha256.json)。旧physics为`439ece89…4ac0fba`；本轮factory始终`22881d28…d26e4f`，没有改粒子表现/删逻辑源来换性能。完整最终hash另见[前后基准](fireworks/wind-prefix-benchmark.json)。第一候选基准保留为`fireworks/wind-prefix-first-candidate.json`，最终报告是`wind-prefix-benchmark.json`。

## 原因与保持的语义

主流程effectiveWind以τ=1.4秒指数平滑。风1.8→5时，每帧小变化仍生成真实piecewise-held段；t=6秒的30/60/120Hz历史分别182/362/722段。旧sampleBody从出生逐段积分，每个head、尾段出生点、ember及预测样本重复同一历史。getBounds的key含当前wind字符串，使变化期间每帧重算，而非通常的2Hz命中。

修复没有量化风、丢段或重采样。每个阻力k共享风专用响应`V'=-kV+kW`、`X'=V`，每个新增原段只解析累计一次。查询时二分所属段、闭式求部分段；同段/常风保留原flightSegment快路。对出生b、查询t，τ=t−b、a=exp(−kτ)、B=(1−a)/k：

```text
v(t) = a v_b + g B + V(t) − a V(b)
p(t) = p_b + B v_b + g(τ−B)/k + X(t) − X(b) − B V(b)
```

g是向下的重力向量。前缀使用局部时间差和JavaScript Number双精度，不计算exp(k×绝对时刻)；小τ的τ−B用稳定级数。有限起点前按首风回延，未来按末风延拓；查询顺序不要求单调。分裂继承仍根据当前父体姿态递归，**不缓存会被未来预览resolveBurst改写的父体姿态**，只共享风响应。

checkpoint以不可变segment对象为WeakMap key；追加增量构建，前部pruning可保留存活checkpoint，不因shift错位。输入段须在追加后保持不可变；编辑器/QA若改历史段内部值，应调用`invalidateWindResponse(timeline)`，运行时simulation本来只push拷贝和shift。每drag查询memo有96项上限，不永久积攒未来查询。

## 正确性与性能

- 原物理 **22/22**：[physics-check.json](fireworks/physics-check.json)。
- 原音频 **12/12**：[audio-check.json](fireworks/audio-check.json)。
- 新风响应 **14/14**：[wind-response-check.json](fireworks/wind-response-check.json)。覆盖500个多阻力随机旧逐段对照、独立6维RK4、近birth、过去/未来逆序、重复时刻、pruning、历史失效、分裂预览、姿态编辑和最高1e9秒绝对时刻。随机最大位置误差约2.97e−12米，RK4误差小于2e−9米。

同一Node进程、同seed双菊、4254–4260 records、1209×1292主/镜像相机，各16样本。core为factory update+clusters+两次radiance bound；forecast为主流程另外调用的getBounds。原/新均保留相同182/362/722段起始历史。最终完整前后重跑7.44秒；是CPU小窗口，不含GL上传/绘制，也不是完整场景FPS。

| Hz / 风 | core均值旧→新 ms | forecast均值旧→新 ms | 两项合计均值旧→新 ms | 合计p95/max旧→新 ms |
|---|---:|---:|---:|---:|
| 30 / 恒风 | 9.37→9.04 | 0.33→0.36 | 9.70→9.40 | 15.76→19.55 |
| 30 / 阶跃平滑 | 30.73→10.31 | 26.62→3.32 | 57.35→13.63 | 69.00→19.66 |
| 60 / 恒风 | 7.05→7.74 | 0.07→0.08 | 7.12→7.83 | 8.06→9.33 |
| 60 / 阶跃平滑 | 47.35→9.37 | 46.43→3.02 | 93.78→12.39 | 102.05→13.57 |
| 120 / 恒风 | 7.37→7.93 | 0.08→0.14 | 7.45→8.07 | 8.43→11.42 |
| 120 / 阶跃平滑 | 85.94→9.33 | 89.37→2.99 | 175.31→12.32 | 185.43→15.51 |

n=16的nearest-rank p95就是max，不能用它冒充长尾稳定性。恒风小窗口略有波动/开销，没有宣称所有路径都加速。变风前后同一时刻384heads：恒风完全相同；变风最大位置差5.74e−12米、最大速度差约1.31e−12m/s，低于Float32实例上传分辨率。

原30/60/120Hz各自的分段输入仍不同；旧诊断在6秒时，30对120Hz约1.15cm、60对120Hz约0.383cm轨迹差是**已有输入离散差**。本修复保持每种原输入，不宣称把平滑连续风的帧率离散也一并修掉。

## 尚余成本

getBounds变风时仍每帧重算，最终均值3.32/3.02/2.99ms，部分样本约4–6ms，已报告root超过约3ms门。这里没有擅自删除wind key或降低预测频率，以免自动构图/响应包围范围过期。若继续优化，优先在原预测点集内批处理、复用每body出生响应并减少临时分配；若改成低频缓存，须先证明随风变化的保守包络，而非直接放松缓存键。

实现后仍需root在浏览器重载、变风双发烟花实景验证和整体性能检查；此报告不宣称每帧60、声音主观验收或图像完全一致。
