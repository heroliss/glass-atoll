# R36 持续光/长金尾层编译接线

本 owner 只改 `firework-layer-profile.js`、`firework-trail-profile.js`，新增 `firework-radiant-profile.js`。原 R35 源码已由 root 完整归档 `baselines/r36-before-radiant-profile/`。没有 GPU、浏览器、音频或材料 scheduler 改动。

新 `three-heart-radiant120-v1` 分支先递归调用一次原 `three-heart-scale120-v1` compiler，取得其已冻结结果；再由无物理/renderer 依赖的 `applyRadiantThreeHeartProfile` 生成独立结果。RGB emission knots 和 `emissionReferenceI0` 同乘一次作者 G16，原 `body.intensity`、192 IDs、分层、位姿、life、材料曲线、几何 `radialScale` 都不改。全相最大 RGB 从新 burn profile 正式重建。

`compiled.referencePeakBudget` 是派生光度预算，`nativeReferencePeakBudget` 保留原输入预算。`radianceProfile` 的 schema 为 `glass-atoll.radiant-three-heart-reference.v1`，含 `effectProfile/baseEffectProfile/authorGain/nativeReferencePeakBudget/referencePeakBudget/normalization/calibration`；每源再附 `nativeReferenceI0/derivedReferenceI0`。原 `radialScale.sourcePeakBudget` 继续表示几何求解时的旧输入预算，不冒充新光度总预算。0× 的派生 RGB/I0 仍为 0，几何校准相同。

新 trail 为独立 `glass-atoll.radiant-layer-trail-profile.v1` / `radiant-layered-gold-v1`：outer .72/.88、middle .56/.66、inner .38/.40，分别为参考尾份额/秒。头份额为 1−尾份额。沿用现有九节点 unit-Y 金色冷却、有限 N8 指数归一权重。旧 `createTrailProfile` 的 .35 秒域、所有旧 recipe/schema 输出保持不变；只有新构造器和新 schema 准入 .88 秒。

[CPU 检查](./r36-radiant-layer-check.json) 为 **5/5**：45 个旧 compiler 输出 deep 与 JSON 字节完全相同；9 个新 seed/gain 组合的 1728 源逐项核对；新/旧域分离与 303 个颜色采样；576 个完整 N8 延迟源 photopic 时间积分检查误差 <2e−15；失败原子性和原输入不变。全寿命完整积分包含延迟尾迹退休，不能解释为某一有限观察时间窗、接触后光能或燃料热能守恒。

该报告只认证层编译/源辐射/配方数据。Physics 的 event endTime、contact support、新 tail envelope，FW 的 derived unmodulated/all-phase 界和真实消费，烟 descriptor/SH、主镜实际图像与性能由其它 lane 分别验证。新默认 G16 是作者参考，不是测得 candela/nit，不表示已经达到照片感或帧率目标。

前置 [统一光源审查](./R36-UNIFIED-LIGHT-SOURCE-ADMISSION.md) 的 6/6 发生于生产候选接线前，JSON 保存其当时源码 pins；它不是本次新 profile 的实际 GPU admission。新的长尾可能增加像素核与接触光学行成本，即使根数/N8 不变，也不能据此宣称性能不变。
