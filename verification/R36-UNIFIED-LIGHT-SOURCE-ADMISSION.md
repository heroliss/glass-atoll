# R36 统一发光源与单发 GPU 门：当前源码审查

本轮只读生产源码，并运行一个 6/6 的小型 CPU preflight。没有浏览器、GL context、GPU 提交或生产改动。新的持续发光/短爆闪候选尚未验收。脚本和结果是 [r36-source-light-admission-check.mjs](./r36-source-light-admission-check.mjs)、[JSON](./r36-source-light-admission-check.json)。首轮 5/6 的唯一失败是测试把逗号声明误写成 `const ordered` 的源码断言；原件留在 `baselines/r36-source-admission-before-declaration-fixture-fix/`，没有生产故障或放宽数值门。

## 已确认的消费链与缓存

物理 `burnProfile`/`trailProfile` → `updateRecords` 的当前头/尾 RGB → `getEmissionLedger` 全部正发光行 → 一次新鲜 SH bake；同一记录表另生成两个最多两组的空间矩光簇，供地表、水面、薄叶、云和间接光使用。主眼/镜眼分别生成各自的光学行和 SourceT，准备后立即消费，不能共用两眼的透射纹理。

- `fireworks.js` 每次 `updateRecords` 重建记录数组并清空 cluster cache。`getEmissionLedger` 只在记录数组身份与 `rawPerCandela` 相同才复用；新 raw 比例推进 ledger version，物理记录刷新还推进 emission record generation。其 Float32 data 是借用的可复用缓冲区，跨更新必须复制。
- SH 的 key 是 `snapshot/revision/ledger/ledgerVersion/data/count/bakeMode`，不会 hash RGB 内容。就地修改曲线或借用的 ledger 数据、维持旧 version 会造成错误复用。新角色应编译成真正的物理源并经过常规更新，不能只注入云/地面 cluster 或 shader uniform。
- SourceT 每次真实 fill 都有独立请求序号；包只含密度和几何射线，没有 I0/颜色。主眼、镜眼、物理记录代数、ledger 代数是不同计数器，不能靠数值偶合绑定。
- 当前没有独立的“照明源角色”缓存。可见发光与环境照明来自同一当前头/尾记录；两组 cluster 是近似照明代理，SH 仍使用全部正发光行。新增短爆闪不能只加一个 cluster，否则源光学/SourceT/SH 会缺失该源。
- 当前 camera exposure 的 main 调用没有传图像 histogram，使用昼夜/手动 prior。更强 raw 光降低的是保护 FP16 的 storage P；最终相机增益另算，并不自动抵消发光增强。CPU 中 raw bound ×64 后 P 降低 6 stops，`sceneScale × outputExposureScale` 保持相同。当前参考不是测得 candela/nit。

## 变亮、延长和变多的成本不同

实际 N8、seed42 的当前新尺度 profile 在 +0.7/+1.7/+2.5 s，gain1 与 gain64 的 SH 正发光行数、所有原始位置/半径/伸展、固定相机投影 rect/visible 完全相同，Float32 发射 RGB 和投影峰值正好 ×64。gain0 的 ledger/cluster 是零，几何 alpha 不变。这不认证任意新曲线。

当前 source quad、保守视野裁剪和烟体代理不按亮度扩张：源范围由位姿、半径、伸展、快门、DOF 决定；烟体范围由密度/协方差决定。因此，固定支持、相机和几何下统一提升正 I0 不增加这两类代理覆盖或数值 map 次数。它主要改变源/SH RGB、cluster/receiver 能量、storage P、显示压缩与曝光历史。局部 reactive mask 是能量阈值加固定范围；镜面 mask 来自 burst enclosure，不是按亮度细分体积。

但长尾不是这种纯 gain 实验。Motion 的新私有建议 D=.88/.66/.40、尾份额=.72/.56/.38 会改变释放时刻、伸展和可见寿命。即使 N8 的未接触完整行数仍不超过 1728，180 m 观测时 outer 的 adaptive n 上界约 9→48，片元核工作和覆盖可能明显增加。接触分段还可能增加光学行，必须重新取得真实两眼 preplan。延长燃烧支持/新增 secondary birth 会增加 SH source count 或改变烟源时程；不能用本轮 gain 测试替代。不得为了省算力稀释、截断正发光行或删除烟质量。

## R35 实际单发快照的精确重算

下面以现行 4,000,000 **每请求**、1,000,000 **每 map 的 64-slot 上界**、最多 8 maps 重新调用当前生产 planner。`fresh draws` 是相同记录数假设完全新鲜计算所需的 SourceT 主眼 + SourceT 镜眼 + SH；不是截图时实际计时。全部六份 raw 的 SH `reused:true`。

| R35 单发观察 | 烟包 P | 两眼 SourceT 行 | SH 行 | 完整新鲜 logical pairs | 新鲜 numerical draws |
|---|---:|---:|---:|---:|---:|
| 普通 +.70 | 24 | 1728 / 1728 | 1728 | 124,416 | 3+3+3=9 |
| 普通 +2.50 | 24 | 1700 / 1700 | 1699 | 122,376 | 3+3+3=9 |
| QA logical +.70 | 396 | 1728 / 1728 | 1728 | 2,052,864 | 3+3+3=9 |
| QA logical +2.50 | 1561 | 1700 / 1700 | 1699 | 7,959,539 | 5+5+5=15 |
| QA logical +2.50 近景 | 1561 | 1700 / 0 | 1699 | 5,305,839 | 5+0+5=10 |
| 普通 +2.50 SDR 近景 | 24 | 1700 / 0 | 1699 | 81,576 | 3+0+3=6 |

近景零镜眼的 `backend:cpu/reason:no-active-source-rays` 是无请求的中性路由，查询数 0，不是有源 CPU fallback，也不代表非空 GPU 镜像。源位置/相机不同，不能拿它替代完整两眼性能。

QA +2.50 每眼 T 为 2,653,700 pairs，SH 为 2,652,139。每眼 T 的四个 map conservative work 是 999,424 / 999,424 / 720,896 / 256；SH 是 999,424 / 999,424 / 688,128 / 10,432。全部单请求小于 4m，但合计近 8m，4m 不代表全帧预算。同样 1700 行时 P 最多 2352 才仍在 T 的 4m 内；这只是固定计数断面，不能宣称全寿命或多发覆盖。

当前一份 SourceT field + 一份 SH field 数值 GPU allocation 共 6,627,328 B，来源 raw/当前 planner；不含灯、阴影、烟代理 VBO、scene/lens/HDR targets、fixture、JS、driver 或总显存。更强 RGB 本身不会令这些固定数值纹理自动变大。

## 候选实现前必须过的小 CPU 门

1. 固定一个新 opt-in profile/version、原单发 seed、N8、1/120 shutter、真实 source/烟配置。亮度、色曲线、尾分配与短爆闪都由物理 source 数据产生，所有 consumer 同源；不修改旧版本。
2. 两个正 gain 和 0x 验证 finite/profile extrema、快门时间积分、all-phase RGB 上界、完整 ledger/cluster RGB 与原始轨迹。0x 不得改变几何校准或烟质量。新曲线若影响 R35 的 10% 宽度门，应重新使用其真实 pre-gain reference，不硬套旧模板。
3. 重新计算完整寿命光源/烟包计数、真实接触光学分段与两眼真实 rays。逐请求≤4m、逐 map≤1m、maps≤8、物理/光学容量全部满足才进入 GPU；aggregate separately report。只拒绝更大请求而不避免 CPU fallback，不能称性能问题解决。
4. 新尾 D 超出 .35 时，明确更新新版本的编译限制、source/tail/live envelope、shutter/接触窗口与 descriptor；不能改 table 后让 framing bound 默默拒绝。新的 secondary/burst role 也必须进入这些支持与缓存键的真实 generation。

## 最小后续实际 native 门（候选批准后才执行）

先只做**一枚、普通生产烟路径、固定 +2.50 s 的一帧**，沿用 R35 原生 1209×1292 主眼/实际镜眼、夜晚、同 camera/光学/环境意图；不启用 QA logical-all，不加第二枚。候选真实 CPU replay + 两眼 producer preplan 必须在 GPU 前完成。新鲜实例必须 SH `bakes+1/reused:false`，共享同一 density/ledger generation；每眼 T 对自己的完整 ordered rays 重新准备并马上消费，`mediumQueries=0`。不得仅取暂停缓存结果。

一帧实际执行原 `updateScenePhotometry → water → lens`，并保存完整 native 图像。首门推荐原有可审查的 SDR composition + RGBA8/UNSIGNED_BYTE capture（6,248,112 B，逐像素原值，无增强）；它不替代 HDR 原生显示验收。R35 old 图仅作构图/亮度参考，环境相位和编译冷态不同，不能当像素/速度 A/B。

根据**实际新 preplan**加现有固定场景 inventory预先冻结 draw/element/blit/mip/clear/read/bytes 上界；不得盲套旧 143 draws，因为新接触光学行和 adaptive 核工作未定。使用现有严格 native/Three 状态守卫、query 非嵌套、第一故障停止、完整结果后发布，完整场景 query 仍为预声明 100 ms 上界，不提高预算；16.7/33.3 ms 只是推荐/高级参考。报告实际 shader workload、SourceT/SH counts、proxy pixel bound、trail sampling 最大 n、storage/camera EV、raw/stored bound、实际 HDR/SDR route与 GL/restore。

这一步只回答“新候选在完整单发场景是否贯通、是否能看见预期持续照明/尾迹及其一次成本”。未跑不承诺通过；单个冷帧不证明 FPS/收益。若需要性能比较，再由 root 明确安排同资源、预热、有限 ABBA；此轮不创建新通用框架、不做多发压力或把历史 59/137 ms 不同测量阶段当因果比较。短爆闪的后续门另外选择其真实 peak 与消退时刻；当前 SH/cluster 是瞬时光，光学源是因果快门积分，SourceT 仍是每光学行 midpoint T，并非完整 `T(t)` 时间积分。
