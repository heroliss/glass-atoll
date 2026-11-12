# R10 实际热场景 CPU 归因

状态：仅分析，未改运行时。原始cpuprofile与scene JSON保持不变。可复跑：`node verification/r10-hot-fireworks-cpu-analysis.mjs`。完整数据：`r10-hot-fireworks-cpu-analysis.json`。

原始profiler长203.030秒，后段大多暂停，不能用全部135955样本算烟花百分比。真实热段墙钟348435.300..351910.800ms，共3475.500ms。停止锚点有141.500ms不确定性；按固定单调速率假设，使用所有可能offset共同热区间738647556027.000..738650890027.000μs，共**3334.000ms**。2259个采样间隔按与该区间的重叠长度加权，总量恰好覆盖该区间。主表将相邻样本时间差归给右端样本，JSON另保留左保持约定敏感性；这不是纳秒级精确计时。

## 最重要的归因

`fillRecords`含子调用2269.226ms；源到相机的`transmission→between`中，`between`占1987.100ms（59.601%），主要落在Gaussian column、erf、ray包装/验证。这个证据优先于先前“投影诊断可能最贵”的假设。只改变尾迹GPU积分不能去掉这一共同CPU成本。

实际捕获为1920×1080、中档、adaptive、双菊、C16.5；**resolved smoke field关闭**，不能把这一轮归因给field bake。源传输列的初末诊断差为314356条ray、5439733次kernel、内部计时1806.200ms；这些是完整初末快照差，不冒称重新裁到3334ms内。

## 自耗时前20

| 函数 | 毫秒 | 热窗口比例 |
|---|---:|---:|
| erfcPositive (pyro-smoke-columns.js:46) | 416.748 | 12.500% |
| getParameter (native/builtin) | 335.168 | 10.053% |
| query (pyro-smoke-columns.js:214) | 263.152 | 7.893% |
| between (pyro-smoke-columns.js:249) | 251.184 | 7.534% |
| finiteColumn (pyro-smoke-columns.js:71) | 214.222 | 6.425% |
| fillRecords (fireworks.js:369) | 198.775 | 5.962% |
| intersects (pyro-smoke-columns.js:189) | 183.055 | 5.491% |
| vector (pyro-smoke-columns.js:19) | 144.390 | 4.331% |
| whiten (pyro-smoke-columns.js:35) | 93.589 | 2.807% |
| (garbage collector) (native/builtin) | 85.076 | 2.552% |
| writeSourceBound (fireworks.js:85) | 83.629 | 2.508% |
| clock (pyro-smoke-columns.js:7) | 70.812 | 2.124% |
| nextUp (pyro-smoke-columns.js:9) | 63.036 | 1.891% |
| addUpper (pyro-smoke-columns.js:15) | 60.171 | 1.805% |
| projectSourcePoint (fireworks.js:76) | 57.368 | 1.721% |
| erfPositive (pyro-smoke-columns.js:40) | 51.827 | 1.554% |
| erfDifference (pyro-smoke-columns.js:59) | 51.192 | 1.535% |
| visibility (indirect-lighting.js:218) | 50.221 | 1.506% |
| starEnvelope (fireworks-physics.js:128) | 37.206 | 1.116% |
| now (native/builtin) | 35.449 | 1.063% |

## 含子调用前20

| 函数 | 毫秒 | 热窗口比例 |
|---|---:|---:|
| (root) (native/builtin) | 3334.000 | 100.000% |
| frame (main.js:1010) | 3208.780 | 96.244% |
| drawFiniteEffects (main.js:751) | 2704.312 | 81.113% |
| render (fireworks.js:457) | 2397.887 | 71.922% |
| fillRecords (fireworks.js:369) | 2269.226 | 68.063% |
| transmission (pyro-smoke.js:39) | 2002.240 | 60.055% |
| between (pyro-smoke-columns.js:249) | 1987.100 | 59.601% |
| query (pyro-smoke-columns.js:214) | 1717.925 | 51.527% |
| render (water.js:318) | 1541.153 | 46.225% |
| render (lens.js:285) | 1300.349 | 39.003% |
| finiteColumn (pyro-smoke-columns.js:71) | 827.426 | 24.818% |
| erfDifference (pyro-smoke-columns.js:59) | 515.481 | 15.461% |
| erfcPositive (pyro-smoke-columns.js:46) | 433.584 | 13.005% |
| getParameter (native/builtin) | 335.168 | 10.053% |
| erfPositive (pyro-smoke-columns.js:40) | 257.116 | 7.712% |
| updateScenePhotometry (main.js:694) | 218.872 | 6.565% |
| renderTransientClouds (sky.js:774) | 217.002 | 6.509% |
| intersects (pyro-smoke-columns.js:189) | 183.055 | 5.491% |
| vector (pyro-smoke-columns.js:19) | 153.016 | 4.590% |
| writeSourceBound (fireworks.js:85) | 140.023 | 4.200% |

含子调用行沿调用树重叠，不能相加；native `getParameter`的具体上层调用栈另保留在JSON。它可能含driver等待，不是单纯JavaScript算术。

## 主循环阶段

只取`started`落在原热墙钟区间的**46/323**帧，未把随后暂停帧计入。该选择与较窄V8共同区间不同。阶段合计3439.200ms；11阶段覆盖记录范围，另有末尾第二次时间戳读取间隙0.200ms（单帧最大0.100ms），已显式列出，不伪称精确相等。

| 阶段 | 总毫秒 | 每帧均值ms | p95 ms |
|---|---:|---:|---:|
| water-captures | 1633.500 | 35.511 | 43.900 |
| main-lens-display | 1399.500 | 30.424 | 39.900 |
| photometry | 226.100 | 4.915 | 7.100 |
| firework-simulation-audio | 114.300 | 2.485 | 3.500 |
| environment-capture | 32.300 | 0.702 | 1.200 |
| physical-simulation | 12.700 | 0.276 | 0.500 |
| celestial-navigation | 10.600 | 0.230 | 0.400 |
| ui-audio | 4.300 | 0.093 | 0.400 |
| shadow-caustics-sand | 3.600 | 0.078 | 0.200 |
| locators-cloud-GI | 1.700 | 0.037 | 0.100 |
| timer-read | 0.400 | 0.009 | 0.100 |

`water-captures`与`main-lens-display`包含各自effects填充和烟透射；不能把整阶段解释为水shader或GPU忙碌时间。profiler与GL观测均有开销，本轮不构成未插桩FPS承诺。

## 唯一优先最小提案

先做**相同数学的T-only query数据通路**：保留公共query/between与完整诊断返回；新增内部入口供host只读T，去掉重复endpoint复制/验证和未被调用方使用的返回数组，使用同步私有scratch。必须保留原方向二次归一化的浮点顺序、BVH访问顺序、Kahan累加、外向scalar遗漏界与1e-5预算，以及当前高精erf/完整SPD积分；不改频率、几何、源强、C/P、质量、光程或音频。先证明旧/新T与遗漏决策逐值一致，再重复同一热段profile。该提案只能省包装开销，不能宣称消除整条59.6%路径或保证60fps。生产尚未改，host路由所有权需与当前负责者协调。

原始文件SHA256：profile `0e3217d8444593e49fb220f745e28e832161a5da5fc4a0aa157a2ec6c045b2d8`；scene `89c3917e73b388cde734b1283774bf1d6dc8abecbe1502e95f1c37a7abd683aa`。当前冻结main/FW/audio与owner声明版本核对一致，详见JSON。分析自检5/5。
