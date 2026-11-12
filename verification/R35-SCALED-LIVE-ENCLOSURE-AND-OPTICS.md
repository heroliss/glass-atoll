# R35 新尺度的 live 包围、尾迹与源溯源

仅本 lane 修改 `fireworks.js` 与 `firework-show-envelope.js`，未改 shader、曝光积分、接触方程、燃烧曲线、光度或已验收音效。两源当前 SHA 分别为 `c643c387ff08db221404efc56e214d999ec9d0b3e573985641094a3a649bb665` 与 `eb100d09a6a2ccc03a6d5e091802393802e0397a2b43ea04caca6e022be38ac5`。

`three-heart-scale120-v1` 的未知 seed 家族上界明确为 76m/s＝原19m/s×alphaCap4；旧 profile 的19m/s和 powered 合同均未放宽。通用 `getFireworkShowEnvelope` 新增可选 `sourceRadialScaleAlpha`，仅用于调用方声明的已编译源子集，不传仍覆盖整个 cap4 家族。普通 family planner 仍限定 definition-rise/apex，并明确自己的适用范围。

新的纯 `getScaledFireworkLiveEnvelope(event,{windRanges,shutterSeconds})` 则从真实载弹初始位姿、速度和固定飞行 life 解析未来 burst 区间，支持现有合法 explicit-height。它采用实际每根已编译 kick 分量，并检查其模长不超过19×真实 alpha；不调用未来 pose/RNG，不把时间采样最大值当全域证明。对各根完整 life、任意分段恒定的空间均匀风，利用正 drag kernel 的组件端点和连续时间驻点给出源/尾迹中心范围。

尾迹为固定 lag 的 Eulerian 亮度场。光学 padding 单独给出 source velocity、acceleration、field velocity、lag derivative、detached travel、半长尾迹 stretch 和快门延伸界。除 midpoint 的 S/2外，还覆盖 extinction 后仍有历史亮度的 midpoint、birth backward extension，以及相邻节点各自 birth-clamp 对 stretch 的贡献。当前1s接口支持并非长曝光曲线路径积分精度认证。

`fireworks.getBounds({shutterSeconds=1}={})` 只对新 ID 验证0..1，并把真实快门、真实 alpha 和完整已提交风史的组件极值加入缓存键；root 的构图调用传当前镜头快门。新包围与原 sampled/smoke 范围取 union。旧 profile 忽略该新 options，返回结构和行为原样。`smokeSourceProvider.describe` 仅新 ID 增加 `effectProfile` / 递归冻结的 `radialScale`，roots 和 sample 始终来自真实缩放后的物体。

`r35-live-scale-envelope-check.json` 当前 **7/7**，无浏览器、context 或 GPU：

- 18处闭合逆变换逐字恢复 R35 两份原源；FW 的 CRLF、envelope 的 LF 保持，所有 shader未改。
- 13旧 style：39个 pure envelope、52个 actual-factory live bounds、13个 source descriptor 比较全部 exact。
- 18个新事件覆盖3 seeds、25/78/90°及 definition/explicit-height；31,266个 source、93,798个 tail、458,460个 causal shutter/stretch 端点 witness 通过，作为解析推导的补充而非采样证明。
- 已提交风史同 bucket/cache失效、之后816个未来源点、实际快门 cache、选择旧样式但保留 active new event 的行为通过。
- 192个真实 provider roots、9,282个 main/reflection CPU optical rows、8次 inert effects render；两个 generation counter分别记录，ledger对象与完整 physical state不变。该78°例的 contact-local 数为0，不能冒称局部分段验证。
- 另外的25°/30m低高度实际例产生非空既有 contact-local rows，检查现有 clipping、实际 linear raster support 与物理 state不变；不增加新接触分支。

初始 counter fixture 将独立的 `recordsGeneration` 与按需生成的 ledger `recordGeneration` 错当同一计数器，5/6原报告保留于 `r35-live-scale-envelope-check-before-counter-fixture-fix.json`。修正为分别记录，并验证 ledger对象和完整 physical state不变。一次加入新-only合同断言后尚未同步逆变换清单的5/6报告也保留于 `before-inverse-manifest-update.json`；更新清单后 inverse恢复 exact。最终 source 与数值结果均已明确钉住。

另：solver输入契约初审4/5及失败负例保留；Smoke修复后的 `3f2c09a7…` 已独立5/5。不能把 authored120m pre-contact 参考称作实际 supplier 测量、全部角度 contact后可见宽度或质量 COM不变。风史界不预测未来用户超范围调参；Gaussian quad/DOF/bloom与长期烟尘仍需各自 margin。以上 CPU结果不等于 GPU图像、HDR、帧率或最终视觉验收。
