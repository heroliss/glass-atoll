# 近景 scalar head 快门积分候选

原件 `before/fireworks-before-near-head.js` SHA `d12f74d5b66b4234dab71220a780e1162aa2e83505d8fe8c0cca6184b5d9796a`。当前 FW SHA `b7580d2e7388a7e95d5e5963a9de0612c65baed69d33b051092dcabbb6c3c9ff`。

只增加 scalar、无 stretch、非 smoke/vector、半径不等于 native tail `.0018` 的近景 head 分支，并更新诊断文字。由现有 `uTrailAdaptive` 开关控制。投影快门 S≤4×max(1,sigma) 像素，或 adaptive 关闭时，保留原8点操作；这包含全部 S≤4px 情况。尾迹、vector、bloom、源光度/轨迹/属性/账本/SourceT请求行数均未改。

近景分支保持8个 emission bin 的均值常量，各 bin 均匀细分。N 是8的倍数，按 S 变化在 N 与 N+8 间使用 quintic 正混合；每样本完整权重为原 bin mean/N。因此每个 bin 的总权重是 mean/8，不按像素的局部命中重新归一。每 level 全局最多65536样本，每像素只访问完整索引域内、投影6sigma支撑附近最多128点；若预算不成立则走原8点。两level最多256局部评估，不增加pass/RT/上传属性。

原 quad 覆盖完整快门半宽和3.65sigma光斑，正归一混合仍受原 source peak 上界约束，CPU source bound/culling无需扩大。原有限quad裁切、跨near平面近似和极限预算fallback仍存在；此候选不宣称修复硬矩形bloom底座，也不改变尾迹的3时间点积分。

`near-head-shutter-check.json` CPU **6/6**：60组远景原操作相同；64个细分level的逐bin份额闭合；4个轴/斜角、常量/变化8bin样本的局部/完整积分最大绝差2.26e-12、最大访问14点/level、flux最大误差1.05e-10。S32px/sigma.42常量机制例的中央峰谷比2157→1.0000000001。实际 Saturn 生产器759个optical rows的全属性、ledger、cluster、descriptor、radiance bound与原件相同。此为CPU数值证据，不是画面或性能验收。

可选 `runNearHeadShutterGPUCheck(THREE,renderer,{parentLocked:true})` 固定4个单head数值fixture，复用实际生产shader，在现有锁定renderer运行。一个64² RGBA32F RT（65536B），总4draw/24indices，4次完整read共262144B。每draw独立query ready/non-disjoint/≤25ms并通过所有像素绝差≤1e-5、flux差≤2e-4后才进入下一draw；不放宽失败门、不自动重试。独立光学fixture不等于真实场景火花。原始double CPU oracle在firstawait前生成，源码/实际shader/缓存函数9pin，支持现有Three/native状态guard与program/VAO缓存失效清理。helper SHA `67ca6a525ed7b7a53b20b751620876f5848818639897252ea28c2e7383013b5a`，`near-head-shutter-gpu-preflight.json` CPU **6/6**。本owner没有运行GPU或浏览器。

旧 style5/5、AA5/5报告是前一d12f epoch的完整历史证据，未重写成新shader的逐字相同声明。新的source inverse仅允许本head shader/诊断差异，默认属性/物理/光度仍由本次actual-factory门比较。
