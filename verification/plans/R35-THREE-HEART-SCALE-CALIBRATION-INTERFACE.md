# R35：three-heart-scale120-v1 的最小校准接口

本文件对应私有纯CPU原型，尚未注册生产profile，也未修改旧compiler/物理/光学。新版本与 `legacy`、`three-heart-v1`、`two-colour-v1`、`powered-bees-v1` 分开；旧19m/s、4.876s、192点及各自材料/光度/推进契约不改。

## 推荐定义

新ID固定为 `three-heart-scale120-v1`。作者定义：爆开后2.5s，外层仍燃烧、源photopicY为各自峰值至少10%的主体，水平任意两点最大距离为120m。门、时间与统计量都不是供应商测量；120mm示例缺少展开时程和光度曲线，不能把该定义称为口径普遍定律。

使用**全局gain/I0归一之前的实际逐点instanced burn曲线**求源相对门，峰值是整条分段线性RGB曲线各knot的photopicY最大值，而非各通道最大值再相加。这样0x仍有同一几何参考，metadata明确它不可见；0x不引入NaN，也不让亮度滑块改变alpha。正I0时它与对应实际own-peak比例一致。

所有192点共同使用 `v' = Vcarrier + alpha*(v−Vcarrier)`，三个坐标同倍数，各层比例/随机方向不重新抽样。`Vcarrier` 是壳/爆心的COM参考速度，不等于已测量的物理质量COM，也未强制等于192点算术平均速度；有限采样的残余平均kick也会随alpha缩放。源质心/空间矩应据真实点重新计算，不能复制旧矩。

同birth、同初始位置、同线性drag/重力、无parent/thrust时，共同风漂移与壳平移在点对距离中相消。由真实patched初速度和 `G(t)=-expm1(-k*t)/k` 求外层宽度，`alpha=120/W`。不使用理想对称球的`2vG`代替真实离散点对。根求解只在独立输入契约之外的复杂模型才需要；本版本拒绝混合阻力、延迟birth、split和主动推进，避免扩大问题。

校准是**free-flight、pre-contact参考**。保持25–90°发射支持，不按worldY或terrain额外拒绝。低仰角下真实接触可能令仍燃烧的完整可见宽度小于120m；现有物理contact、光学clipping和水面处理仍是最终依据。

## 已实现的私有接口

模块 `verification/r35-three-heart-scale-calibration.js` 只import burn采样器，没有physics/layer/Three/renderer依赖循环：

```js
compileThreeHeartRadialScale({
  nativeHeads,          // 原始192个native根，未被layer补丁覆盖
  layerPatches,         // 已有逐点三芯velocity/life/burnProfile补丁
  burstVelocity,        // 壳COM参考速度
  referenceBurnProfiles // [{id, profile: 本次已有的pre-I0 instance}]
})
// → {schema, effectProfile, velocityPatches:[{id,velocity,baseVelocity}],
//    limits, radialScale}
```

同一compiler循环中保留已有instance引用供solver使用；不能为校准重建第二套运动、随机方向或物理事件。solver输出仅有新的速度向量与自有冻结metadata，不冻结/更改输入，未patch profile、birth、life、I0、材料或尾迹。所有校准完成后，生产compiler才可原子合并这些速度补丁。

`radialScale` 的稳定字段为 `alpha`、`calibrationAgeSeconds`、`targetOuterHorizontalWidthMetres`、`unscaledOuterHorizontalWidthMetres`、`eligibleOuterBodyIds`、`widthWitnessBodyIds`、`maximumActualIntrinsicSpeedMetresPerSecond`、`shellCarrierVelocity`、`sourceGainIndependent`，另含精确源门、共同drag/travel、seed、零预算标记与free-flight/contact/wind限定。生产event应原样把该对象放入 `event.layerProfile.radialScale`，供未来bounds和descriptor溯源，不依赖临时全局开关。

输入检查：IDs0..191完整唯一；outer/middle/inner原划分；共同birth/position/drag/gravity；无parent/thrust；零ignitionDelay；creation velocity/baseVelocity一致且分层速度必须按原算序等于carrier+(native−carrier)×1/.7/.4；原始/分层kick均≤旧19m/s输入界。reference是对应ID/layer/seed/lifetime的已有独立正峰曲线，实际归一profile的ID、每个age和RGB必须按原compiler算序等于reference×nativeI0/peak（包括0x）。这些是可信compiler现有instance的集成对齐检查，不声称认证一个同时伪造reference与实际profile的调用者。alpha>4或零宽度直接拒绝，不clamp后谎称达标，不返回部分patches。

新固定limits采用alphaCap4、最大intrinsic kick76m/s；life4.876s、尾迹0.35s和无主动推进保持。cap4的方向覆盖/扰动下界由独立Bounds lane研究，不能把本原型少量seed通过当全seed证明。它也不等于新的快门上限、动力或安全高度模型。

## 必须贯通的最小依赖

| 层 | 最小改动与验收 |
|---|---|
| profile/compiler | 新ID/limits、原pre-I0 instance引用、最后统一3D速度patch；旧分支全文/随机顺序与旧证据保留 |
| physics/event | 仅新ID准入bounded-descent；把radialScale放进event/layerProfile；壳flight/apex、gravity、life和所有旧profile不变 |
| FW records/CPU-GPU光学 | 所有head/尾迹/曝光窗口都从真实新body状态取位置速度，保留因果快门/尾迹积分、sourceT和现有有限支持；不借用powered force或其1/60限制 |
| bound/镜面/未来构图 | 用76上界或实际alpha与真实future解析状态，缓存包含新profile/alpha身份；主/镜面眼各自验证，不能继续用旧19截断未来包围 |
| smoke provider/调度 | descriptor显式携带新ID/radialScale；新版本应有完整192逻辑体连续烟源准入，位置/协方差来自同一实际新运动；birth、IDs、event物质量与预留账本不变，不能按速度暗加质量 |
| emission ledger/SH/局部光 | 重算真实source positions、质心、空间矩及字段版本；RGB/I0和曝光P/C链保持；不得把旧空间矩、旧T或旧SH纹理借给新代 |
| contacts | 真实airSurface/水面接触与光学时段裁剪覆盖全25–90°，尤其低仰角；free-flight120m与contact后的实际宽度分别记录 |
| UI/配置与相机 | 显式新版本选择与launch诊断、show envelope/缓动构图用新半径；不静默把旧three-heart-v1换成新物理 |
| 性能/视觉 | 不改生产4m完整请求、1m/map、8map边界。先CPU与最小实际GPU，再原生明亮单发、全寿命/积烟、多发及HDR/SDR分别验收 |

空间扩张不自动修复峰预算1421级作者光度、burst-flash缺口或局部光280m截断。尺度阶段必须与光度阶段分开记录，不能通过改全局曝光或烟量掩盖距离照度差。

## 现有CPU证据与边界

`r35-three-heart-scale-calibration-check.json` **6/6**：五个实际native+旧三芯compiler seed经真实`sampleBody`在静风与共同分段风中达到120m（双精度算术误差门1e-10m）；0/1/2/5 gain得到相同alpha、向量与eligible IDs；混合出生/位置/阻力/重力、parent/thrust/ID/引用错误及cap超限原子拒绝；另验正gain与0x下的点火延迟、原层速度、emission age/RGB错位，共8项拒绝案例。旧registry/19m/s未改，无physics循环、无renderer/context。独立审查发现的原7135版本接收这些错位输入的缺口和初始5/5证据保留在 `baselines/r35-before-input-contract-fix/`，没有把原5/5当成完整输入契约证明。

另一个离线作者实例 `r35-scale-author-example.json` 复用了R34实际launch角度/seed但没有回放真实风：外层64点在2.5s、10%门下为46.7886425m，alpha2.564725；统一3D后宽120m、垂直跨度117.6223m，只拉水平虽然也宽120m，垂直跨度却仍45.8616m。该反例说明不能把球体简单压扁。默认角度的无约束静风burn-end最低Y约54.93m只是一项参考，不能替代全寿命contact/地形验收。

当前纯模块SHA `3f2c09a7f7bebb483e8be5ac912480eb5c532c3ec2ba2f75d2c335f6623404d3`。生产compiler/metadata/光学/烟源尚未接入，GPU与原生明亮视觉、全寿命contact和性能均未验收。

## 后续接线阶段

上段状态保留原型阶段的时间线。独立输入契约审查通过后，主代理把纯module按唯一import重定位复制到生产 `firework-scale-calibration.js`；本lane获授权仅修改 `firework-layer-profile.js`，当前SHA `2cf3bf64de718a69a26fbe13bd90dff15d3a72301db4bc54f1f47fba62e33b9c`。新ID/76m/s limits已加入，现有instance引用在同一循环中收集，solver成功后才统一合并192速度补丁，radialScale与原金色尾迹透传。其它生产文件由各自owner负责。

`r35-layer-scale-integration-check.json` **5/5**：36个旧profile编译输出与e42归档深度且JSON逐字相同；9个实际新事件保留192/life/emission/material/峰预算/金色trail；16个不同仰角/旋转/0或正gain实际sampler自由飞行宽度达标；新版阻力/type准入和原子错误检查通过。旧prototype的6/6是registry修改前证据，不改写成新registry验收。当前接线仍没有GPU、实际接触/完整烟源/原生明亮视觉或性能通过结论。
