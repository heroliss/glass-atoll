# R5 累积烟：已知成本、缺失测量与最小优化门

2026-10-27。只读分析 `verification/pyro-r5-burn-accumulation-benchmark.json` 及当前源码；无 runtime 编辑、无 GPU/浏览器调用。建议先测量可隔离的体积绘制，而不是据一次光场 timer 把性能归因给光场或直接改烟量。

## 1. 报告确实说明什么

1920×1080、native scale1、DPR1、中档 profile 实际8×MSAA、reflection1920×1080/2×MSAA、HDR external-copy、flare/bloom、64步云、field opt-in。8.06墙钟秒的240个 frame intervals：平均29.7767fps，frame P95=66.2ms；CPU callback均32.9805/P95=65.3ms，整帧 GPU query均29.9631/P95=54.461ms。**均值接近30fps不等于稳定30fps，60fps更未达到。**

CPU callback 是 `frameStart..frame末尾` 的墙钟时间（`main.js:974,1066`），包含提交渲染、驱动/同步等待及 UI，不是纯 JS self time。GPU query 也是整帧包围（`main.js:988–1055`），236个有效结果与241个CPU样本没有逐帧 ID，不能把同一数组下标配对、不能把 CPU+GPU 两均值相加。

原始数组按样本顺序分三段的**描述性**结果：

| 样本序列 | 前约1/3 mean ms | 中约1/3 mean ms | 后约1/3 mean ms |
| --- | ---: | ---: | ---: |
| GPU | 42.100 | 23.712 | 24.231 |
| CPU callback | 50.958 | 23.509 | 24.580 |
| frame interval | 51.454 | 23.898 | 24.860 |

前段明显更贵，与发光/源出生阶段相容，但没有 phase/sourceCount/packetCount 随帧记录，GPU结果还存在查询回收延迟，**不能据此证明是 GL5、字段 bake、瞬态照云或体积中的任一项造成**。按帧数切分也不是等墙钟时长。最终1260包、M40.7、无 merge、无 pending；最终并不是活跃发光压力的代表帧。

### CPU 列查询已是实测大项，但窗口要分清

顶层 `initial` 与 `smoke` 的物理请求时间分别186.4930000和198.9704000，差 **12.4774s**，不是 benchmark的8.06s。两次累计 counters 之差：

- column queries **+2555.5ms / +22,702 rays / +13,272,219 Gaussian kernels**，约112.6µs/query、584.6 kernels/query；有显著实测成本，但不能除以 benchmark 的240帧冒充单帧成本。
- column update **+309.5ms /245次**；169次refit、76次structural rebuild、0次quality rebuild。并非每次都全重建；新ID源出生导致结构变化是当前主要重建类别。
- state +249个固定tick、+1511 revision，merge仍0。最终 `lastUpdateMs=3ms`，其中columns最近refit=.8ms。

`pyro-smoke.js:21` 的 `lastUpdateMs` **仅含 snapshot+columns.update+volume.setState**，不含 `events.prepare/commit`、GL5/provider/wind查询、`state.advanceTo`、CPU emitter→eye columns、field prepare 或两次 render。不能用3ms推出全部 smoke CPU 只3ms，也不能把累计columns时间再与这3ms直接相加（有包含关系）。

`fireworks.js:272–278` 每个非旧烟发光记录调用 `medium.transmission`；主/镜面各填一次 records，镜面 ray 起点还被截到 water-hit（`pyro-smoke.js:39–42`）。每个尾段也可能是独立查询，不能用120个根星推导只有120条ray。R5没有main/mirror/head/tail分类计数，不能直接决定该在哪条路径优化。

### GPU 体积与字段

最终 `lastRender` 为主视图1260实例、0 culled、0 fullscreen fallback、1080p、4个非pyro local source、4格front air、3次vertex field fetch；**不是1260个独立draw**，是一个instanced draw。但每个覆盖片元仍重建ray、采depth、解Gaussian有限列、条件均值照明、4格空气并混合。depthTest=false，所以前景无法靠硬件early-Z直接跳过整个体积核。片元重复数可远高于屏幕像素。

当前代理取 `radius=5sqrt(traceΣ)` 再投影view-space立方体8角（`pyro-smoke-renderer.js:153,162–168`）。各向异性长缕会被宽方框包围，**存在明确的过绘机制**；但R5没有 Σ/rect面积、sum(area)/(W×H) 或片元计数，不能声称它占了29.96ms中的多少。`lastRender` 被主/镜面覆盖，只留下最后一项，反射实例/覆盖面积/排序时间也缺失。

末尾字段是 `sourceCount=0,requiredPairs=0,knownZero=true,zeroReuses=621`；已通过的zero20/20及原127回归证实退休后不会把旧光继续照烟，也不会因空ledger generation重复零bake。这里不能再把末尾慢解释成“光场一直烤旧光”。从629→1260包期间字段bakes增加276、zeroReuses增加158，但没有逐帧计时，不能转成GPU预算。独立 `.66ms(60×120)` / `3.072ms(4096×240)` 各只有一次有效query，既非完整scene，也不能线性外推本场景。

此外活跃源会改变光度bounds、CPU T查询、局部GI、主天空及镜面瞬态照云（`main.js:674–696,729–735`）；这些与烟代理draw是独立成本。主scene8×MSAA不会自动把late烟体片元工作乘8：主烟在 `lensTarget` 后绘，镜面目标则实际2×MSAA。镜面独立depth copy/resolve、mipmap也不是字段bake成本。

## 2. 先补哪些测量（一次有界场景）

**推荐先测R5同两发、同accepted pose的一个场景，区分hot与cold两个固定物理时刻。** 保存真实snapshot/source ledger/UTC/天气、相机和mirror投影、独立opaque depth、光照与P。cold取两发烧尽后仍1260包；hot取第二发燃烧中同类积累状态。主/镜面分别保留结果，不只保最后 `lastRender`。不得以清烟或关闭整个 persistentSmoke 当成单项消融，因为那同时删体积、source T与field。

1. **先用现有 `profileFrames(8)` / `frameProfile()`** 分离 firework-simulation-audio（含源/状态）、photometry（含field/bounds/GI）、water-captures（含mirror effects）、main-lens-display。它是CPU callback分段，不是假装GPU分段。
2. 后续若授权一个QA helper，在parent renderer lock下、**生产整帧query之外**，对同snapshot的main volume、mirror volume、field bake分别串行EXT timer；预热后各16–24个短样本，检查disjoint，禁止嵌套query/以readPixels计时，整轮≤数秒且单项>50ms停止升级。main/mirror GPU draw用实际独立depth/oblique投影/lighting，不用全白背景替代真实path。
3. 同时记CPU细分 `source prepare/GL5`, `commit+advance`, `snapshot/refit/setState`, `render sort+projection+upload`, main/mirror column queries（计数+time增量）、field raw bound/pack/upload/dispatch。分配/GC、depth-copy、PSF/HDR也须在外层phase保留，避免把驱动阻塞误标JS算法。
4. 两视图记 `instances,culled,fullscreen,sum(clippedRectArea)/(W×H),maxRectArea`、σ特征值/条件数、state/source版本、源数、requiredPairs、fieldbakes。rect之和是着色工作上界的线索，不是实测fragment invocations。

第一门是实际 attribution：若volume GPU不足总瓶颈的显著部分，先拒绝半分辨率改造；若CPU query/GL5主导，降低片元分辨率不会解决其停顿。目标可先定用户允许的稳定30fps（33.33ms预算），但应留余量并看P95，不能只把29.78四舍五入验收。

## 3. 三种有损方案的真实资源/风险比较

| 候选 | 可确定的工作/内存变化 | 没有测量就不能承诺 | 必须保留的正确性边界 |
| --- | --- | --- | --- |
| 半分辨率depth-aware volume | 单视图1920×1080→960×540，volume覆盖片元约1/4；一张RGBA16F S/opacity约4.15MB（3.96MiB），另全分辨率composite。若缓存两个视图则翻倍；可顺序复用一张 | 不是整场速度×4，不省source/columns/GL5/field/排序。depth guide/upsample至少增加pass、带宽和RT切换；不能预填某个ms收益 | finite column/inside/opaque/水hit必须仍用actual逆投影；主/镜面独立path。depth边界、树叶、岸线、近海平面与subpixel烟可光漏/光晕。线性filter `S,T` 与filter τ非同一物理平均；不可用一个中心depth代替整2×2真实截断 |
| optical render LOD | 若用每packet列τ上界+累计遗漏budget，可少画弱包或选择支撑；不必改变state mass | 当前没有接受的screen-space误差指标。总包数少不等于近视过绘少；不省原CPU queries，除非另外改columns | 不能逐包τ低于阈值就丢（很多小项会叠浓）；radiance误差还依source上界/P前raw亮度，热亮背景/新灯可使“冷老烟”重现。camera-dependent LOD不可改变physical state；CPU T/GPU近似差须公开误差而非称同Σ精确 |
| 同源/近龄cohort moment merge | 真减少N，可同时减state/refit/queries/fieldpairs/实例数；同M、μ、完整Σ守瞬时矩，现Taylor q亦有同参数闭合 | 无merge的R5尚未证明某个包数可安全合并；搜索/误差查询也有CPU成本。目标如1260→630只是预算候选，不是必达 | 同矩不守column/峰/高阶形态；邻近但不同轨迹会填空隙；热/速度交叉矩已丢，未来会偏。若改state，所有columns/GPU共享合并Σ且必须记录误差；不可render合并却宣传CPU原细密度与GPU完全一致。不得按相机/P决定物理merge |

### 半分辨率若成为首个实现候选

推荐只尝试**无temporal history**的一次低分体积pass与一次full-res depth-aware合成，避免顺手引入额外历史/ghost协议。低分目标清0得到 `(S,opacity=1−T)`，再以 `S+(1−opacity)Bfull` 合成；保持当前P已乘一次，不再乘P/背景色。先主视图opt-in，main/mirror分别验过后再共享API。只在不连续深度边缘的错误已量化可接受或有明确full-res fallback合同后准入；普通bilinear不能叫depth-aware。

低分fragment的 `uSize` 必须匹配目标物理尺寸，depth按归一UV采实际full-res独立depth；不要改变相机FOV、planeY或把主depth喂mirror。guide若要存线性depth，格式/范围另有内存代价（例如低分R32F约2.07MB），不能偷用量化8bit。保留DPR2、RT.viewport物理矩形、public逻辑viewport、scissor及实际READ/DRAW FBO恢复；恢复shadow flags、clear state和原RT元数据，禁止attached-depth feedback。新RT无MSAA并不等于主scene可降MSAA。

GPU成本的可证关系仅为 `Tcandidate≈Tother + Tvolume/4 + Tguide+composite`（且只是同覆盖近似）；只有测出 Tvolume 后才有ms预算。若candidate扣掉新增pass仍只省<1ms且出现深度halo，则不值得收。不能用强模糊把烟段细节抹掉来换帧数。

## 4. 更窄的无新增RT门，优于立即做有损LOD

如果rect覆盖统计确认长椭球被trace立方体严重放大，可先考虑保守**view-axis ellipsoid AABB**：`Σview=RΣRᵀ`，轴半宽 `5sqrt(diagΣview)`；其3D盒包含同一个5σ椭球，投影8角，遇eye/near-plane仍保守fallback。相比现三轴都取 `5sqrt(traceΣ)`，不改密度/质量、列积分、source T/field或排序，也不引入RT/额外sampler。少做的仅是本来受当前off-proxy尾界覆盖的远尾射线；不是整场bitexact，须以同一累计tail τ上界审查，不能漏inside/oblique/offaxis。

这不是本轮实施建议定案，先看两视图代理面积和单draw timer：若紧proxy几乎不减覆盖，不能继续投资投影ellipse大项目。如果可显著减少无效片元，它比cohort merge的物理/形态风险低，也比半分辨率避免了新upsample误差。**最小下一步仍是上述一个R5场景的hot/cold分项测量，再只选一项候选A/B。**
