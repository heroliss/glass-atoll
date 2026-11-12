# R36水平细带：当前源代码与已存图像定位

范围：查看已有+1.70 HDR、+2.50 HDR/SDR PNG及同帧JSON，纯CPU核对当前代码和几何。`r36-horizon-source-diagnosis.json` 4/4通过；没有新浏览器、GPU、source replay、参数或生产变更。图像呈现的细带确实位于花心附近，光学flare在实际保存态为false。

## 已排除的首要猜测

保存机位水平看，+1.70相机高141.664m，+2.50为133.030m，FOV65.47045°、画面1209×1292。按当前共同地球半径6360000m，真实球面海平线分别约42.450km/41.136km，俯角.3824°/.3706°，投影在中心列约y652.71/y652.50，即画面中心下6.5–6.7px。它本来就会穿过这次花形中心附近，不能把“高空水平视角中的海天线”本身当错误。

当前water默认curved，外海网格半宽65.536km，距保存相机最近边仍约65.49km，明显在该几何地平线后；camera far120km也足够。`ocean-geometry.js` 的稳定球面datum与 `sky.js` 的地平线使用同一地球半径。**在curved默认实际生效的前提下**，这不是老10km平海面的有限边缘直接露出。保存的三个JSON没有waterDiagnostics实值，仍应先只读确认实际mode，没有凭构造默认宣称一次新的浏览器验证。

花心约180.422m远，而真正海平线约41–42km远。海平线水面距源至少40.95km，远超local280m范围，所以不能将这条水平线解释为“烟花照亮海面到280m后截止的圆边”。280m在**相机附近空气**仍可参与散射，不能因此把所有local光影响排除。

三个保存detail视图的reflection实例数均0、reason均 `no-active-source-rays`。没有直接火花镜像条纹，不能把无源镜面当成渲染失败或CPUfallback。

## 最有依据的当前接缝来源

`aerial-perspective.js` 当前有一个真实的depth分类差异：

- `AERIAL_DEFAULTS.backgroundLocalScattering=0`。对于sky depth，integration写中性T/空S，composite直接返回原sky色。
- 对邻接的opaque水面depth，`integrateAir→sourceAt` 包含local火花的有限半径/280m入射和Rayleigh/HG散射，然后合成 `T*water+S`。
- 因此在同一相机射线角附近，海平线上方sky没有近处local-air S，下方water有。局部光越强，这个处理类别边界越可能成为蓝/金色水平细带。

这证明**当前源存在该类不连续机制**，又与保存图像中几何地平线的位置相符；尚未用隔离GPU对照证明它是该PNG的唯一或全部成因。

保存的中档明确 `renderSampling.airSteps=6`，虽parameters.quality为high，显式采样覆盖优先。12km二次分段的前两个midpoint为166.667m和833.333m：第一个与约180.422m的花心仅差13.755m，仍在280m范围内且可能进入event有限半径核心；第二个已出范围。这里一格0–333m用单个近源样本代表，积分会对机位/半径很敏感。不能把打开background-local后出现一个巨大彩色空气光团称为“物理正确”，也不能从中直接选择更多亮度。

还有尚未隔离的次要来源：water用固定2m环境cube，而主观察者在133–142m；低频grazing反射能量补偿、粗远海facet和半分辨率depth重建可能影响边界颜色/1–2px位置。它们不能仅凭PNG归因，当前也不需要把这些候选全部同时更改。

## 最小后续观察，不是推广

先只读保存当前 `atoll.air()` 的backgroundLocalScattering/steps/maxDistance，以及 `atoll.waterDiagnostics()` 的farField/directionMode，消除上述runtime flag未知项。

Root可在同一个暂停physical phase、同机位/烟/源/EV，用**当前已有生产quadratic路径**做 `setBackgroundLocalAir(true,{model:'quadratic'})` 与off观察；不加载撤回的support/aerial9bb，也不触water候选。如果on填平接缝、off恢复，支持“opaque/sky缺失local-air S”归因。若只是换成大片不自然亮雾，仍不能通过积分精度或照片感验收。保持实际P由完整bounds正常选择，记录cameraEV不变；P自身不是相机曝光。

新工作主要在原来early-return的天空像素中执行6步local散射，原2个air pass/targets不变，但fillrate和源求值增加。没有新的sourceT/SH请求不表示免费；异常或明显卡顿即停止，不连续压力重试。最后正常reload并恢复原parameters.air的字段集合，特别是原来缺失的backgroundLocalScattering，不把QA字段永久写进用户设置。

如果这一当前代码on/off仍不能归因，再考虑单独审核只在已有aerial.render调用内屏蔽firework local项的只减法诊断，或现有air总开关的粗分类控制；共享uniform值必须立即恢复。这里没有请求或实现新shader、GPU实验、withdrawn候选推广或性能优化。
