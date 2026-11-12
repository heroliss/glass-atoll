# R13 G1：独立二维近岸候选首版

2026-10-28。该候选默认关闭，`main/hydrodynamics/water/sand/caustics` 均未导入它。本轮只新增 `shoreline-dynamics.js`、`shoreline-boundary.js` 和 `verification/r13-shore-*`。这是数值基础交付，**还不是最终海水效果或 G1 全部准入完成**。

## 已实现的物理状态与求解

- 每格保存守恒水深 `h`、两个水平流量 `qx=h*u` / `qz=h*v`，和不影响水量的固定床面接触记忆 `W`。单位分别是 m、m²/s、m²/s、作者湿度比例。
- 实际二维、非分方向的 hydrostatic reconstruction + Rusanov 面通量；地形压力补偿只进入对应面的法向动量。面质量通量由相邻格共享，湿干界没有原 8cm 固定排除区。
- `h` 不作事后裁剪，速度、振幅也没有救场 clamp。实际二维 CFL、非有限字段、负深度或体积闭合失败，会拒绝整个私有物理 tick。所用 CFL 是两个方向特征率之和，不是把一维稳定步长分别套两次。
- 半隐式 Manning 阻力只改动量；默认 `.018` 是作者参数，未按礁坪粗糙度实测校准。`W` 在 `h>2mm` 时按 8/s 湿润，退水后按 35s 常数衰减；不是沙粒孔隙渗透模拟。
- 来波直接取原 `waves.js` 64 个 swell 模式的 k、方向、振幅、omega、相位，与场景同绝对时间；不新增独立随机浪或旧 20s 边界。开边界保留出射特征量，只向指定入射边（默认 west）提供向内模式，其余湿边作近似吸收。

数值方向依据 [Audusse 等原论文](https://publications.imp.fu-berlin.de/478/1/file_2004_siam.pdf)。该方法并不保证任意陡坡、薄水与格宽组合都准确，[Delestre 等反例](https://arxiv.org/abs/1206.4986)正是必须保留网格敏感性验收的理由。

边界速度采用深度平均长波阻抗 `sqrt(g/h0)`，内部也是静水压非线性浅水方程。它不解决中深水完整色散、翻卷破浪、三维湍流、气泡、礁外绕射或精确斜入射透明边界。相位来自共同波谱，**不等于**已证明与外海视觉接口无反射。默认 24×24m ROI 中心是 (−34,−1)，为真实西岸地形候选块；8×8m 平坡测试另行明确标注为切平面替代物。

## API 与失败语义

```js
import {createShorelineCPU,createShorelineGPU} from './shoreline-dynamics.js';
const options={terrainHeight,resolution:256,time:sceneTime};
const cpu=createShorelineCPU(options);
const gpu=createShorelineGPU(THREE,renderer,options); // 显式调用才分配
await gpu.advanceFence(sceneTime+1/60);
const committed=gpu.snapshot(); // texture 是借用的当前 GPU 纹理
const copied=gpu.snapshot({readback:true}); // 诊断性同步全格读回
```

`advanceFence` / `advanceTo` 的输入是期望到达的绝对物理时间。只发布从固定 origin 开始的完整 `1/60s` tick；显示帧不会截断最后一个微步。一次调用默认最多 4 ticks（可配置 1..120），未完成则报告 `completed:false`、`behindSeconds`，重复相同目标继续追赶，不丢时间。长暂停的宿主策略仍待接线，不能直接假设所有积压能一帧算完。

微步数 K 在构造时按格宽、参考水深与速度预算确定，最大 256；每个微步又检查实际状态 CFL。预算影响分配，不限制物理高度或速度。运行超过预算导致实际不稳定时会报错，外部应选择更安全配置并重放，不应隐式截断水。

发布状态 C 与两个私有工作状态分离。中途失败保留 C、其时刻和 revision；同一次调用先前已成功的 ticks 保留。`requestedTime` 记录接受的目标，`lastFailure` 单独记录失败 tick 和已完成前缀。无效时间请求不改这些记录；重入 mutation 被拒绝。CPU 查询数组及 GPU `readback:true` 数组都是副本。GPU 的默认 texture 查询是借用句柄，不是历史帧归档；未来 C 轮换后其底层纹理会重用。公开 Uniform 是固定身份的只读 getter，不能通过替换 `.value` 在提交边界抛错。

GPU 内部 `RGBA32F=(h,qx,qz,W)` 加验证附件。今后光学层可再打包 `(eta,u,v,W)` 到现有 `uHydroState` 入口，避免增加第 17 个采样器；**本轮未接线**。CPU `handoffData()` 仅提供诊断性同类转换。活跃 ROI 的 eta 应替换低频 swell，不可再加上原 swell 与旧 20s 扰动的完整高度。

## 已实际运行的检查

`node verification/r13-shore-cpu-check.mjs`：**14/14 passed**，记录为 `r13-shore-cpu-check.json`。

| 强判别检查 | 实测 / 结果 |
|---|---|
| 原 64 模式、绝对 t=0/4000 等 | eta 最大误差 4.86e−17m；大时间 phase wrap 有限 |
| 斜坡、台阶、干岛和非零海平面的静水 | h 改变 0；最大速度约 9.82e−16m/s |
| 闭域二维扰动 + 摩擦 + 接触记忆 | 体积残差约 −2.84e−14m³；非负水深 |
| 干邻格中的对角高速湿格 | 单方向 CFL 看似允许的 dt 被二维条件正确拒绝；安全 dt 保持非负且守恒 |
| x/z 转置 | 含切向通量、地形补偿的最大差约 1.73e−18 |
| 30/60/120Hz 相同 fence | 完整物理字段 SHA 一致；受限追赶重复 fence 与一次足额追赶一致 |
| 首 tick 实际 CFL 失败 | C / clock / revision 完整保留；requestedTime / failure 记录正确 |
| 第二 tick 验证器注入提交前失败 | 第一 tick 保留；去掉注入后重试字段与无故障控制完全一致；注入只在验证源码副本中 |
| 湿度时间常数 | 独立核对精确指数增长、干燥衰减，不改变水量 |
| 1m 水深小波包，32/64/96 | 波速约 3.13208..3.13209m/s，接近 `sqrt(9.81)` |
| 0.25m 与 1m 深度 | 波速约随平方根变化，深度四倍约两倍速度；零 swell 无入射 |
| 真实地形 ROI | 192/256/384 有界分配；32² 的 6s 实跑保持有限/守恒，末 tick 最大流速约 .205m/s |
| 生产路径与声音 | 原 hydro/waves/spectral/sand/FW/audio 字节哈希未变 |

`node verification/r13-shore-runup-check.mjs`：**3/3 passed，actualGPU:false**。在 β=.094092 的真实西侧切平面上，用相同 64 模式、8×8m、18s 来波；每个 worker 最多 30s，不无限扩大计算。

| 格数 | Δx | 最大爬高 | 探针上冲 / 回流峰值 | 体积闭合残差 |
|---|---:|---:|---:|---:|
|32²|.250m|.0823m|+.538 / −.583m/s|3.50e−15m³|
|64²|.125m|.1117m|+.668 / −.749m/s|−1.39e−16m³|
|96²|.0833m|.1294m|+.715 / −.819m/s|1.67e−15m³|

三者均产生移动湿前沿、回流及干后仍湿的接触记忆。**64→96 峰值差 13.64%**，只通过临时的粗格 25% 趋势门；没有达到计划中的最终 10% 门。阈值前沿本身按格心测量，也有离散测量误差，但不能因此忽略未收敛。真实 2D ROI 的 192/256/384 长时细化、反射/通量对照仍未做。

## GPU 首轮失败与编译修复

根代理实际运行首轮基础门禁后，报告为 `r13-shore-gpu-first.json`：**2/9，整体 failed**。初始化 RGBA32F 读回成功，但 step fragment 的四个 `Cell` 结构体三元表达式被当前 ANGLE/WebGL 编译器拒绝。后续正常物理提交因此失败；不能把其中失败回退项的绿色记录解释为 CFL 数学已经在 GPU 上验证。

首版状态源码 `1b8f46e3…957e07`、边界、GPU helper、页面、失败报告、CPU/爬滩报告和 manifest 已逐字保存在 `r13-shore-first-1b8-*.txt`，未覆盖失败证据。当前生产修改**仅**将四处返回结构体的 `?:` 改为等价 `if/else` 赋值。`r13-shore-compile-repair-check.json` **4/4** 明确证明整个生产源码差异就是这组替换，CPU、通量、CFL、体积与时钟逻辑未改。

GPU 重入验证器另有一个 JavaScript 时序错误：先 `await` 一个已拒绝的重入 promise，会允许原本有效的推进继续提交下一个 tick，随后再强行断言仍为 tick1 就错了。现把第二次 advance、dispose 与只读快照都同步发出，最后再 await。纯 JavaScript 微任务 oracle 证明原写法观察 tick2、现写法观察 tick1；**生产 busy 契约、步长和任何数值容差未改**。同时立即接住待完成推进的 rejection，避免编译失败路径留下未处理 promise。

修复后 CPU **14/14**、二维 runup **3/3** 已按新源码重跑通过，数值与首版相同。**当前修复版的实际 GPU 编译/数值结果尚未运行**；本代理没有创建或操作 GPU/context。主场景近期的独立图形重置另由根代理处理，不能把它归因于这份已明确留存编译日志的小型门禁，也不能因此擅自重复整场景 GPU 压测。

页面 `verification/r13-shore-gpu-review.html` 是隔离入口，不自动运行、不导入主场景。导出函数 `runR13ShoreGPU(THREE,renderer,options)` 在 `r13-shore-gpu-check.js`；页面上也可调用 `window.runR13ShoreGPU(false/true)`。报告保存在 `window.__r13ShoreReport`，可下载 JSON。

基本门禁覆盖实际 shader/MRT 初始化读回、静水 CPU/GPU 对照、对角湿干正深度、实际 CFL 失败、阶段绘制异常回退/重试、绝对时钟与显示节拍、重入阻止、调用方 framebuffer / viewport / scissor / flags 恢复，以及 shader / GL 错误。额外按钮才运行实际 192/256/384 地形的初始化和一个 tick。根代理应在主场景稳定后重新加载此隔离页，只先运行小型基础门禁；**没有假装修复版 GPU 已通过**。

G1 GPU 每个完整 tick 都进行一次同步 1×1 Float32 验证读回；`async` API 并不隐藏 GPU/CPU stall。验证附件沿固定格缩小到 1×1，核对 finite/invalid、CFL、总水量、边界流量；失败后不发布。初始化另有非零哨兵与格数核验，不能把没画出来的全零纹理当作成功。

默认 24m ROI 的成本上界是源码计算，不是实测 GPU 时间：

|分辨率|Δx|微步 K / 1/60s|微步 dt|每 tick 绘制（含缩小验证）|三份物理+验证附件|
|---|---:|---:|---:|---:|---:|
|192²|.125m|7|.002381s|15|3.54MB|
|256²|.09375m|9|.001852s|17|6.29MB|
|384²|.0625m|14|.001190s|23|14.16MB|

另有 bed、缩小纹理、CPU 配置与驱动开销。默认最大初始水深约 2.41m，分配深度约 3.41m，作者速度预算 4m/s。在方格、两个方向都具有相同特征速度的保守估算下，微步容许每方向约 10.125..10.5m/s 的 `|u|+sqrt(g*h)`；真实判定按每格相邻四面的速率和。它不是可以任意把水速设到 10m/s 的物理许可。

即使 shader 基础门禁通过，也还需要真实完整场景 p95 GPU 计时、连续 wet/dry 稳定性、全质量分辨率对照、相位/边界误差、和主水面/反射/折射/泡沫/湿沙/焦散一致接线。未测性能不能称达到推荐档 60fps，更不能将该数值首版称为已完成照片级水面。

## 首版冻结与保护证据

- 当前 `shoreline-dynamics.js`: `83233bb94540ce748a114c91217684c9090e2430d8ded1b9b8cbb836dc81fdb1`
- `shoreline-boundary.js`: `c6fd1347bdb246f9c1c9a440f522b48d365b2fd135c08e3ecb7e38568a678707`
- 已接受 `fireworks-audio.js`: `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`
- 原 `fireworks.js`: `bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b`

`r13-shore-cpu-check.json` 和 `r13-shore-runup-check.json` 已复跑，对应上述当前源码冻结。初始 `1b8` 及其原报告保存在前述文本副本。独立审查协议为 `r13-shore-independent-protocol.md`；独立执行审查尚未恢复，不能把作者自检称作独立通过。
