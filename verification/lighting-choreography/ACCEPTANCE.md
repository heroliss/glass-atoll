# 编排、环境受光与画外源：验收记录

2026-10-31。本轮编排、接收光 CPU、自然播放、环境 A/B、画外源 GPU、三款最终声画回放及审看页技术检查均已通过。直接打开 [本轮审看页](review.html) 查看金羽、银瀑与岛屿机位花冠；结果与范围见下表。主观听感、照片感和密烟持续性能仍未由这些技术检查证明。

## 已实施的生产行为

- 金羽保持 128 发与四轮往返，间隔由 0.15 秒变为 0.10 秒，末发由 19.05 秒变为 12.7 秒；身体燃烧由 3.6 秒延至 4.1 秒，尾迹由 0.7 秒延至 1.05 秒。
- 命名持续光源采用有界平滑余辉，复杂尾焰上限 1.2 秒。银瀑高仰角子体为 7.6–8.1 秒，接入 2.2 秒真实释放尾迹；母彗星保留横穿方位与固定水平/竖直分量。低角按离地余量缩短燃烧，事件保留覆盖实际完整尾迹。详见 [CHOREOGRAPHY.md](CHOREOGRAPHY.md)。
- 独立主爆/子爆源由 0.18 秒、0.55 m 改为 0.075 秒、0.04 m，0.004 秒达峰。相机直接可见表示采用 `OPTICAL_FLASH_CORE_VISIBILITY=0.0025`，环境受光仍使用完整对应源的参考光强。
- `localLights` 使用最多两个专用 receiver 簇，原 `getLightClusters()` 仍供云等原消费者。持续烟气也共享 `localLights`，因此会采用新 receiver 代理，不能声称烟气受光全部不变。本地烟花灯的工程截止范围为 4096 m，并保留距离衰减；它不是声波/冲击波作用半径或实测照度范围。
- 存储预算先使用实际完整四边形的画外判定，再对极端投影源使用高精度核支持判定。新增世界空间扫掠体判定，将 `position ± stretch/2 ± velocity*shutter/2` 的完整物理域连同高斯/景深支持边距交给公共侧平面测试。

世界扫掠体是**实际画面行为修正**：透视端点之差重新居中到投影中心，可能在整个物理尾迹都在画面外时产生伪尾迹。新规则在生产上传前剔除此类源，并同步排除其虚高预算。生产 shader 未改；这不等于旧 shader 对这些源本来就为零。`main.js` 只在实际 vertex/fragment highp 均具备至少 23 位精度及对应 Float32 指数范围时启用该路径；烟雾、不确定边界及无穷输入保留原有路径。

## 当前确定的验证

| 检查与报告 | 当前结果 | 范围 |
| --- | --- | --- |
| [编排 CPU](choreography-check.json) | **9/9** | 方向/I0、持续余辉、银瀑离地、空间包围、事件保留与真实工厂属性路径；源码 pins 匹配 |
| [接收光 CPU](receiver-light-check.json) | **6/6** | 光学份额与 receiver/原有消费者的源数据合同；源码 pins 匹配 |
| [生产工厂扫掠体 pins](swept-factory-pin-check.json) | **13/13** | 10 个 phase 及工厂/默认/受控开关合同，28 份 pins 匹配 |
| [独立扫掠体 CPU](swept-hull-independent-check.json) | **8/8** | 1600 用例、920 个 outside，155480 个连续采样及 3680 个角点；DOF outside 490，无失败 |
| [密集时域 CPU 扫描](budget-dense-scan.json) | **completed，0 尖峰** | 爆后 1.4–3.7 秒、步长 0.005 秒、461 帧；最大源预算约 0.0006670264；此项没有 GPU/光栅证据 |
| [自然播放](natural-light-probe.json) | **passed** | 1079 个实际帧，爆后门覆盖 233 帧；最低存储 P=11.5，最大源预算约 1.665222；GL 无错误，九份生产源码 hashes 匹配 |
| [环境 A/B 汇总](browser-lighting.json) | **passed** | baseline **30/30**、current **31/31**；早期 core 降低门通过，生产指纹匹配 |
| [专用实际 GPU](kernel-viewport-gpu.json) | **72/72，passed** | 实际 960×720 RGBA32F，每通道 32 位；源码运行中稳定，issues/GL/shader errors 均为空 |
| [三款录制与来源](dynamic-gallery.json) | **passed** | 1555 张 compositor 源图、9 张阶段图；九份生产源码和十四份音频文件指纹，raw/final 与来源核对完成 |
| [媒体封装与连续性](media-check.json) | **3/3，passed** | 三段均为 960×720 VP8/Opus；全文件及参考解码、音视频包连续性、墙钟时长、非静音检查通过 |
| [实际 Chrome 审看页](review-ui-check.json) | **12/12，passed** | 三片实播、双款 2×裁看/恢复、序播前进/停止、390 px 布局、四张受光图及页面错误检查通过 |

最终 `npm run check` 退出码为 0。上述通过不包含下文保留的旧版兼容检查；后者没有被改写成通过。

自然播放的三张截图实际相位约为 **0.80002257、1.70342257、2.60472257 秒**，对应 [natural-0.png](natural-0.png)、[natural-1.png](natural-1.png)、[natural-2.png](natural-2.png)。逐帧门验证预算/曝光稳定性与读回有限；正常速度的后段观感可结合最终录像审阅，静帧和技术门不代替主观观看。

GPU 的 legacy/adaptive × DOF 关/开四组合分别选择 **119、119、35、35** 条真实 trace 核画外源，逐源 RGBA 非零与非有限分量均为零；两条非尾迹尖峰另走完整四边形排除验证。新扫掠体覆盖五条密集 CPU 剩余尾迹及一条自然播放尖峰，共 **24/24** 组合；中心、画内与真实跨屏尾迹正控 **12/12** 保留且实际发光。

扫掠体 GPU 使用只在内存 QA Blob 中增加的 `__qaSetRows` 记录注入 seam，原 `opticalRows → prepareSourceRows → cull → fillRecords → render` 完整执行，没有在 render 后覆写 buffer 绕过剔除。启用时要求 `worldSweepCulled=1`、实例数零及整幅纹理全零；关闭时有 **8 次绘制实际出现亮像素**，明确表明这里修正了旧投影伪尾迹。QA 与生产 shader hash 精确一致。旧 trace 缺少标量八段发光权重，验证使用真实几何/颜色/未调制强度与八段单位满发光上包络；旧快门由归档 probe 配置及生产默认值 1/120 秒确定，限制记录在 GPU 报告。

## 环境 A/B 的解释边界

实际使用同一 `display-flower`、seed 619，在爆后 0.008、0.08、0.8、1.7、2.6 秒比较 on/off/repeat。摄影 C 固定，线性 RGB 分别除以对应 `2^P`，定量附件在 temporal resolve **之前**读取。覆盖沙滩、grove 植被及海水，并检查足够采样、有效差异、源亮度/颜色/位置变化及完整恢复。方法、相机、patch 状态与全部限制见 [fixture-notes.md](fixture-notes.md)。

baseline 是混合范围：共享当前编排、物理、shader、lens 与 QA fixture；烟花工厂路由到 `before/fireworks.js`，只补原云簇 getter 的 receiver 接口别名，本地灯路由到旧 280 m 范围版本；current 使用新光学表示、专用接收簇与 4096 m 本地灯。因此它比较这一组合，既不是整个旧版本回放，也不是只改一个变量的消融。

早期 core 门仅比较本组 **0.008 秒**：线性峰值 **8.16251475 → 0.20912248**，比值 **0.02561986**，约下降 **97.44%**。不能把该比例解释成整发能量或所有晚期阶段统一降低。seed/type/C/crop/focal 精确匹配，相机与 target 的欧氏位置差分别允许 **1e-9 m**；本次实际差均为零。

报告中的 `leaves` 是沿用字段名，其实际 mask 是 grove 覆盖，包含树干、叶轴、叶鞘、枝条及叶片，**不是纯叶片分割**。沙滩由真实地形高度与深度一致性估计，水面使用生产 alpha tag；它们是有界采样规则，不是完美手工语义标注或植被叶片测光。

## 保留的历史失败与中间结果

- [before-first-leaf-mask-check/](before-first-leaf-mask-check/) 保留两臂因关闭 temporal 而没有 grove 深度、五阶段植被零样本的失败及 PNG。当前开启 temporal、关闭 jitter 以读取生产附件；不能把旧失败解释成岛上没有树或植被不受光。
- [before-camera-tolerance-fix/](before-camera-tolerance-fix/) 保留 baseline 通过、current 仅核兼容比较失败的记录。约 `2.84217e-14 m` 相机差及 `4.08176e-14 m` target 差被精确数组比较误拒，当前仅以 1e-9 m 位置容差处理舍入。
- [旧套件快照](existing-check-summary.json) 中，旧几何 **1/4**、合同 **18/20**、包围 **10/20**、对数余辉 **5/6** 未通过。失败断言仍要求旧 19.05 秒扫射、并发上限 25、5.6–6.1 秒银瀑、9.1 秒家庭时域、统一 0.88 秒尾迹或 0.18 秒闪光。本轮没有改写这些历史断言；当前数值由新编排及真实工厂检查覆盖。旧包围脚本在参数断言处退出，不能视为当前空间位置已经通过。
- [scalar-bound 最终日志](existing-check-results/scalar-bound-final.log) 为 **5/7**：12475 条源的公开投影字段保留精确对照，但旧完整工厂聚合亮度仍有约 **1.0579%** 差异，旧 normalize seam 也已不存在。[R18 legacy-bound 最终日志](existing-check-results/legacy-bound-final.log) 为 **4/6**：512 个公开源界案例通过，旧 scalar 光量与完整工厂/fixture 的两项对照失败。日志将历史 1.0579% 见证定位到旧构造器传参造成的轨迹差异，但这不使上述失败自动变为通过，也不能用新扫掠体门替代全部旧兼容性结论。
- [budget-source-pin-check.json](budget-source-pin-check.json) 的旧 **9/9** 使用已过期的 `fireworks.js/main.js` pins；[range-audit.json](range-audit.json) 的 `fireworks-physics.js` pin 也已过期。两者保留为中间机制证据，不能列作本轮最终生产验收。当前以表中的匹配 pins 报告为准。
- [budget-dense-scan-before-sweep.json](budget-dense-scan-before-sweep.json)、[before-viewport-budget/natural-before-sweep.json](before-viewport-budget/natural-before-sweep.json) 及其它 `before-*` 归档保留虚高预算/投影问题的修复前证据。归档通过或失败均不借用为当前媒体、视效或性能结论。

## 最终声画交付

| 完整回放 | 最终时长 | compositor 源图 / 阶段图 | 媒体检查 |
| --- | --- | --- | --- |
| [金羽·往返扫射](display-vfan.webm) | **20.04 秒** | 541 / 3 | passed |
| [星河·横空银瀑](display-waterfall.webm) | **20.48 秒** | 547 / 3 | passed |
| [流彩·星冠（岛屿机位）](display-flower.webm) | **17.64 秒** | 467 / 3 | passed |

三款已按 `record → finalize → media → 更新时刻 → UI` 完成，审看页媒体时刻及九张阶段图均对应本次录制。录制保留实际生产 WebAudio 音轨；compositor JPEG95 源帧按墙钟节奏保留，经 concat 量化至 40 ms 网格，不作时间缩放或插帧。媒体检查阶段只做 stream copy 添加时长/索引，没有再次音视频编码。音画分别采集并近似同步，尚未建立共享实测采样时钟，不能声称毫秒级同步。

当前九份生产源码、十四份音频文件、三个最终视频及九张阶段图指纹均与报告匹配，gallery → media → UI 的报告指纹及 `review.html` 指纹也一致。音频来源快照是在录制后、媒体验证前取得的 provenance 记录，不是采集期间的响应封存。

重录与封装顺序、归档和恢复注意事项保留在 [ACCEPTANCE-DRAFT.md](ACCEPTANCE-DRAFT.md)，其中旧“待复跑”状态是收尾准备时的历史快照；最终状态以本文件及对应 JSON 为准。媒体封装后不可再用 finalize 改写已对应的 gallery hash。

## 限制

参考光强/颜色、0.0025 可见份额、4096 m 截止、代理接收灯及持续光包络均为工程作者参数与有限近似，没有绝对 lux/nit、真实燃料、热/冲击波或辐射能量标定。加长尾焰与加快节奏会增加中后段光量和并发，金羽最大发光身体并发由 24 增至 41，不能声称总发光积分守恒或免费提速。

银瀑离地证明使用零垂直风与水平海面；低仰角主动缩短寿命，完整地形遮挡仍由运行时处理。独立扫掠体/GPU门覆盖声明的相机、光学和真实 fixture，不是任意相机与输入的普遍数学证明。三款录制使用预热独立 Chrome、中画质、SDR、轻烟；截图/读回/录制开销不能解释成持续网页 FPS。密集长留烟、冷启动首发成本、真实移动设备、毫秒级声画同步及主观听感/照片感仍不由这些数值门覆盖。
