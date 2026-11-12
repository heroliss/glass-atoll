# R18向量发光records：CPU集成夹具

运行`node verification/r18-vector-records-check.mjs`。最新读取的FW为`a00b56cbbde14e17776f18889f59bff4684c86b30f9de725aa81973e21a3f398`，**11/11**。每轮原报告保存在`r18-vector-records-runs/`，latest为`r18-vector-records-check.json`。这份夹具是新接口验收，不重跑或修改旧sealed检查。

使用实际`vendor/three.module.js`构造真实createFireworks/BufferGeometry/材质；renderer替身没有context。仅在内存源副本加入只读records/active/ordered getter与受控单fixture setter，不改生产文件。真实baseline为`baselines/r18-before-vector-render/fireworks.js`（3fb39738），**其physics import明确重写到r17保存的原fb6be290文件**，并核SHA，防止新旧都误用新physics造成假等价。

已验证：

- 无参构造与默认peony、4型12phase的records/full ledger/clusters严格deepEqual。
- legacy8/adaptive、main/mirror共4视图的旧公有上传属性逐值/字节相同；新temporal2..5为零。
- 两candidate各192头＋1920尾；current RGB与完整ledger/两代理总RGB一致，原I0倍率只乘一次。
- 8格RGB按6个连续vec4打包，S0及正常1/120、main/mirror共8448个向量行与head/固定release gold解析窗匹配；1920个cooling ember另验。
- 静止XYZ/variance、相同densityRevision7下，只改变发光RGB会改变ledger.version/数据/cluster，消费者cache key必须变化。此项是CPU源代际合同，非实际GPU SH1 bake。
- CPU透射及throw/stale GPU失败回退只在white colour乘一次T；rgbTaps保未衰减完整RGB。有效mock GPU为0 CPU列查询，绑定正确texture与ordered double endpoints；未声称执行真实VTF。

第一轮8/9失败来自夹具错误：用请求`1/120`严格比较uShutter；root正确采用physical endpoints的实际binary64窗宽（0.008333333333333748）。夹具已改为与resolve.durationSeconds精确比较，原报告仍在`2026-10-28T21-04-12-664Z.json`；不属于运行修复或放宽阈值。随后9/9，再补默认/cooling后11/11。

没有GL编译、shader像素、云/GI图像、实际烟光场bake、GPU耗时或照片级通过结论。测试捕获时root仍可能接线，后续hash改变应在最终freeze后用此新夹具重验；不要把此结果外推到未测试源。
