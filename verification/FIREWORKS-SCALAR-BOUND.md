# 烟花辐射预算：标量投影与分配复用

2026-10-27。独占修改`fireworks.js`的source-bound/聚合预算路径，不动shader、fillRecords、getBounds、物理、声音或main。旧基线与hash保存在[fireworks-before-scalar-bound](baselines/fireworks-before-scalar-bound/sha256.json)。

修改前factory SHA256：`22881d28ac39ddd5f97903f80b7a16b598db256f40f3d44c8281a452ded26e4f`；修改后：`892dd94713a82b27da414e723e10197444a7f4ead1ce1b4bcd6c6319ea397d74`。physics与wind-response的hash在前后基准中相同。

## 保留上界，减少临时工作

原每source建立project闭包、多个position.map/端点数组、shutter/stretch/extent/rect和返回对象，同一视角不断读取相同摄影常量。现在每camera在一次预算调用前更新上下文，标量投影写入一只Float64 scratch；聚合路径复用一组out/rect及1024个Float64 bins。公开`getFireworkSourceBound`仍每调用返回独立对象/数组，历史调用不会被后续覆写。

投影保持原V/P点积运算顺序，没有把P*V重组来引入阈值差异。真实快门和独立stretch的两组端点仍各自投影，保留近平面全屏fallback、Gaussian峰、pixel solid angle、DOF、边界余量和1.2聚合余量。Float32Array位置原map造成的端点舍入也显式保留。每帧仍计算全部source、全部端点和相同bin范围，没有降低频率、源数、采样或预算安全余量。

烟雾项仅把filter/reduce分配换成同顺序for循环；数值/源语义不变。getBounds风字符串cache key未改，变风时依然立即响应。

## CPU 对照与压力结果

[scalar-bound-check.json](fireworks/scalar-bound-check.json)：**7/7通过，12,491个比较案例**，所有公开数值的绝对/相对差均0，peak向下偏差0，visible/nearFallback分类变化0。包含12,000个随机camera/source、镜像/偏轴/修改投影、near精确边界、独立shutter/stretch、DOF、蓝色重叠、Float32端点、公开输出不别名和真实factory聚合上下文更新。另逐字比较shader、fillRecords与getBounds源片段，确认未动。

[scalar-bound-benchmark.json](fireworks/scalar-bound-benchmark.json)：同一Node进程，双菊4254–4260 records；30/60/120Hz恒风与1.8→5m/s、τ1.4秒平滑；每条件64样本。before/after使用同一已经优化的wind-prefix物理，避免把上一轮收益算进本轮；完整运行7.13秒。表中双bound为main+mirror radiance bound均值之和：

| Hz / 风 | 双bound均值旧→新 ms | 含update/clusters/getBounds均值旧→新 ms | 组合p95旧→新 ms | 组合max旧→新 ms |
|---|---:|---:|---:|---:|
| 30 / 恒风 | 5.62→1.73 | 9.12→4.99 | 13.29→7.69 | 22.19→18.38 |
| 30 / 平滑阶跃 | 5.17→1.51 | 12.96→9.23 | 15.40→11.05 | 19.74→13.33 |
| 60 / 恒风 | 5.08→1.56 | 7.77→4.46 | 8.92→6.01 | 9.91→6.46 |
| 60 / 平滑阶跃 | 4.89→1.50 | 12.24→8.97 | 13.91→10.91 | 15.58→14.18 |
| 120 / 恒风 | 4.90→1.52 | 7.60→4.23 | 9.40→5.36 | 12.07→5.73 |
| 120 / 平滑阶跃 | 5.34→1.49 | 13.57→8.84 | 16.25→10.14 | 18.47→13.81 |

各条件同physical时刻384heads的前后位置/速度差都0。变风getBounds均值仍约3ms，未以旧预测缓存换取本轮结果。

复跑入口：

```text
node verification/fireworks/scalar-bound-check.mjs
node verification/fireworks/scalar-bound-benchmark.mjs
```

上述是CPU成本和旧/新数学一致性，不含GL上传、shader绘制或完整场景FPS。root还须重载当前source，重跑`verification/fireworks/bound-gpu-check.js`的7项真实GPU峰/覆盖夹具，再用实际HDR场景4秒窗口检查photometry与总帧时间。本报告不提前宣称GPU7/7或实景帧率已通过。
