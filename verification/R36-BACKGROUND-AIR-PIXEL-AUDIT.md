# R36 当前 quadratic 背景空气开关：已存像素复核

这是对 root 已保存 on/off/on-repeat 的 CPU 图像、JSON 和当前源码审查。没有浏览器、GPU、重放或生产修改。`r36-background-air-pixel-audit.py/json` 记录输入哈希、逐 ROI 统计、核心逐行统计及相同物理状态核对。坐标为原图1209×1292、左上原点、零基；所有差值都是截图编码后的8bit值，不能视为线性 radiance/nit 差值。

三次 time296.07830880196366、camera/target、全部1561个烟包（revision3270）和 clusters 严格相同。air frames21870/21879/21919，flag0/1/0；storageEV11、exposureScale6.08、flare=false一致。实际 setup 也补足上一轮未知项：water farField=curved、reflection.directionMode=geometric，65.536km外海与固定2m环境cube的局限仍明确存在。

## 开关有效，细带未因此消失

天空 ROI x100..1108/y200..599 中，两张 off **全部像素逐字节相同**。on相对任一off有64,213个像素改变，最大通道差25/255、平均绝对通道差0.303603。这足以否定“开关只是诊断数值变了、实际画面没有作用”的判断。

全幅 on−off 最大差108、MAE0.178478；y648..657、x100..1108带状ROI最大差102、MAE1.937265。全幅最大值主要不能单独代表细带强度：第一次off的temporal frozen41/history24，而on仅9帧、repeat仅8帧；off-repeat花区仍有13,723个像素变化，max113，天空则完全复现。必须保留这项时域历史混杂。

核心x450..719中，on−off平均RGB增量在row651为[16.122,13.081,11.644]，到row652降为[1.530,0.000,−0.156]；row658均值近零。原off的row653/655中位最大通道为18/18.5，on仍17/19；肉眼可见细带没有被填平。这和背景附加S只在sky类生效、opaque类仍走独立重建的边界相符，但这些截图不能分解其前置附件，也不能证明哪一段shader是唯一成因。

因此应撤回“只缺背景local-air S就是这条线的主因”作为确定结论。上一轮源码发现的sky/opaque处理差异是真实的；本次实际干预没有解决细带，不能据此推广background开关或撤回的support积分候选。

## 当前 uniform 链未发现失效

`main.setBackgroundLocalAir` 同时写aerial配置和parameters.air，随后setAir/update/photometry并重置history。`applyCoefficients`真实写`uBackgroundLocalScattering`；integration/composite共享uniform对象，update反复刷新同一值。sky pass写独立−2类并实际执行`colour+S`，opaque类仍`T*colour+S`。lens在烟花effect renderer和bloom之前调用aerial。源码链与天空像素的可逆变化相互支持，不是只看diagnostics flag推断GPU生效。

on使medium raw bound由1.259369355增至1.618941404，整体stored bound改变；P与输出曝光没有改变。它仍是6步/12km quadratic近源欠分辨模型，没有因此通过物理精度或视觉验收。

## 最小下一项观察建议（未实现/未执行）

保持当前暂停time、源/烟/光/镜头/FOV/质量与background=0；只把相机Y加20m，仍指向同一个世界花心：

- camera `[-26.367924748274802,153.02981104670693,-41.775295996796075]`
- target `[79.63207525172518,133.02981104670693,104.22470400320395]`

共用球面/FOV模型预测中央海平线从y652.50移到y541.66，花心目标仍在约y646。若细带跟着移，优先检查几何海天/depth类别/水边界；若仍穿花心，则优先检查source/smoke/effect/post链。它不需要新shader，不改亮度或密度，也不是性能配对；新眼位会改变合法的反射/SourceT射线计数，应记录而非强求旧计数。最后恢复原相机与原air字段集合，不能将QA开关永久保留。

现有air总开关是另一项粗分类观察，但`finiteAirPayload.enabled`也随之改变烟前空气等接收端，不能将“总air off后变化”直接归因为aerial单个模块。当前证据尚未解决根因，不需同时改water、sky和后处理。
