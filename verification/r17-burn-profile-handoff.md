# R17第一阶段：纯燃烧profile原型与接线边界

仅新增`firework-burn-profile.js`、本说明及CPU夹具/结果；没有运行时import、没有修改现有fireworks/physics、生产默认、烟尘状态、画质或已验收声音。所有颜色、强度、燃尽和约1秒推进窗为**author reference**，不是烟花测光、真实质量/燃料或发动机数据。

## 实际API

```js
import {
  createBurnProfile, instantiateBurnProfile, sampleBurnProfile,
  integrateBurnEmission, sampleBurnShutter, sampleMaterialCDF,
  integrateMaterialFraction, createMaterialLedger,
  advanceMaterialLedger, clearMaterialLedger,
  EXAMPLE_BURN_PROFILES, EXAMPLE_EFFECT_DESCRIPTORS
} from './firework-burn-profile.js';

const bodyProfile = instantiateBurnProfile(EXAMPLE_BURN_PROFILES.twoColour, {
  eventSeed: 42, bodyId: 7, layerId: 'outer',
  lifeVariationFraction: .06, intensityVariationFraction: .12, opticalScale: 1
});
const instantaneous = sampleBurnProfile(bodyProfile, relativeAge);
const shutter = sampleBurnShutter(bodyProfile, {age: relativeAge, shutterSeconds: 1/120});
```

`createBurnProfile`返回schema=`glass-atoll.burn-profile.v1`的深不可变描述，复制输入数组及metadata，不保留调用者可变引用。工厂最多256时间knots、年龄0..3600秒、非负有限通道≤1e9、非负材料率、有界纯JSON metadata。未知mass/volume/area明确null。内部WeakMap只给已验证的工厂对象做身份标记，不能把任意JSON clone传给采样器；若跨worker/持久化，应另做有验证的deserialize入口，当前没有。

### 光学单位与采样

`emissionKnots`为`[{age,rgb:[r,g,b]},...]`，严格递增时间，首尾black（显式连续起灭），range外0。RGB含I：

`emissionRGBReference(t) = I_cd_reference(t) × unitPhotopicYColour(t)`。

它是线性sRGB原色下的参考cd加权通道，不是sRGB显示码值、已乘P的scene RGB、瓦特或实测cd；不能再乘一次I。相邻knots线性插**整个参考RGB向量**，所以I=Y(RGB)也线性；色度本身不要求线性。`sampleBurnProfile`给出RGB、I、安全unitYColour、colourNormalization状态及材料CDF。0/极小subnormal时unitYColour返回0并标`zero-or-subnormal-unresolved`，保留原RGB，避免除零/NaN；如此极小数值不要以I×colour重建，直接使用保留的RGB。

`integrateBurnEmission(profile,fromAge,toAge)`按每段与窗口的局部重叠解析梯形积分，返回RGB·秒、整个原窗口的平均RGB/I/色度。窗口在源life外的部分为零光，仍计入曝光时长；反向/非有限窗拒绝。0宽积分为0，平均值取瞬时极限。`sampleBurnShutter`以relative age居中；报告真实binary64可表示窗宽和requested宽；完全无法表示的正快门窗拒绝。

不要用两个大prefix相减算极短窗，也不要`avg(I)*avg(colour)`。夹具给出实反例：正确RGB `[1,.5,0]`，错误独立平均得到`[1.3410,.3986,0]`；在约1e12的早期prefix后，晚期1e-8秒窗口的prefix差可为0，局部积分仍正确。

`profile.emission.sourceMaximumRGB`为全phase每通道端点max。非负线性段都位于端点凸包内，故这是解析**单源参考RGB**界，不是全场重叠/PSF/快门空间投影界。

### 稳定body扰动

固定`schema/profileID/eventSeed/bodyID/layerID`生成完整identityKey；每通道用独立key hash得到一次timeScale、intensityScale、directionSeed。没有全局随机流或逐帧随机，遍历/画质/帧率不影响结果。life扰动0..25%，强度扰动0..50%，opticalScale0..64；缩放后仍须通过所有profile域约束，超域显式拒绝。

`metadata.instance.identityKey`是完整无损身份，应与原event/body/source ID继续共同使用；`id`末尾的32位hash只是短标签，不保证全球唯一，**不能替换真实source ID**。`opticalScale`只乘发光RGB，不改材料CDF或推进描述。timeScale伸缩所有life，同时材料rate反比缩放，归一CDF形状随相同相对年龄伸缩、总参考预算保持外部给定；它不是变质量模型。

### 材料CDF与pure ledger

`materialRateKnots=[{age,rate},...]`非负，解析积分正且可表示，归一为单调CDF；life前0、life后1。总材料量不存入profile，用外部预算显式分配：

```js
let ledger = createMaterialLedger(bodyProfile, {budget: bodyReferenceMaterial});
const proposal = advanceMaterialLedger(ledger, throughRelativeAge);
// Validate downstream capacity/causal moments and commit emissions atomically.
// Only after successful downstream commit retain proposal.ledger.
ledger = proposal.ledger;
// On explicit clear, cancel unmaterialized reservations:
ledger = clearMaterialLedger(ledger);
```

此ledger是不可变纯**建议状态**，不是新host事务管理器。重复从同一旧状态prepare相同结果，调用者只有在现有host成功提交后才安装新状态。proposal有`baseLedger`，ledger有`revision`，调用者须先CAS检查`proposal.baseLedger === currentLedger`再commit/install；旧不可变分支仍可被纯函数读取，WeakSet验证工厂来源不提供全局单次提交权。清除吸收态只约束消费者持有的当前分支，不能回装旧分支重复写烟。

`budget = emitted + reserved + cancelled`使用各高/低双分量（`emittedCorrection`等）核算，`accountingResidual`披露有限数值残差；0预算允许、上限1e12参考M，无kg/PM/fuel含义。新排放amount来自**局部区间积分**，不会用两个巨大的double前缀相减。累计profile目标及剩余量用two-component算术，profile归一面积也保两分量；proposal的`intervalRoundoff`给出局部积分与累计差的数值差。不是任意精度实数运算，实际下游packet求和仍须保其补偿/误差合同。`amount`已经是最终四舍五入的建议packet质量，`amountCorrection`是诊断，不要再加一次。

`integrateMaterialFraction`用局部重叠积分给任意区间份额；ledger状态由同一profile的补偿CDF目标累计值决定，因此在30/60/120Hz或不规则分段下，同一末时刻有相同累计状态。即便新的小排放不足以改变累计量的高分量，局部`amount`仍可为正，低分量保留相应变化；极端超出两分量精度/最小正数的输入仍有有限数值域，不声称无限动态范围。

stage1未改`pyro-smoke-logical-burn.js`。后续应在既有事务游标的prefixMass处接CDF，继续family预算/父子继承、过去段五点矩、已有prepared token/故障锁和clear协议。**不能把每body都新建一份event总M**。本模块不分配family预算、不采未来XYZ、不生成烟packet、不延长event存活期。

## 三个示例描述已存在

1. `twoColour`：红到绿、连续亮灭与独立材料时程；演示raw向量插值，不声称实际光谱。
2. `threeLayer`：outer蓝3.4秒、middle绿4.6秒、inner红2.6秒；64×3=192的同总body描述、各层材料share共1、不同radial multiplier。它不是三张面向相机圆环，也没有轨迹实现/次级爆炸。
3. `poweredBees`：24个body描述，0..1秒有限作者加速度窗，最大12m/s²、积分加速度10.2m/s、上界12m/s，方向速率/knots有界；profile/descriptor都明确`trajectoryImplemented:false`。`accelerationKnots`中`rate`为加速度幅值，单位由propulsion.units明确，不是材料rate、N、比冲或实测motor。实例保留heading seed，尚未生成朝向knots/轨迹/推力。

推进时长随显式life扰动伸缩；约1秒只属于作者候选。普通shell和星体没有被自动改成powered。既有有效drag/g/wind完全不动。

## 下一阶段必须处理的接线

- 先增加opt-in profile字段；legacy路径不得无意被分段线性近似取代。原starEnvelope含指数/strobe，本文未声称新profile已与它逐值等价。
- head/tail/ledger/cluster/烟光/云/GI/镜像共用参考RGB采样；只GPU改变颜色会造成受光与bound不同步。descriptorVersion与动态emissionLedgerVersion区分，静止但变色也要使照明失效。
- 当前FW只有8个**标量**快门亮度tap。接入RGB phase要更新vector时间积分及其通道/投影界；现source烟透射T在快门内固定，本文不解决`T(t)I(t)c(t)`，蜂群跨陡烟边需独立误差门。
- 给新child/powered路径更新完整past sampler、风历史、保守show-envelope、最晚退休及容量预检；不从有限seed采样冒充全范围。
- I/P/C、4发active/14k source cap、已验收主爆音频4e5保持。本文没有新增现实质量/装药、GPUpass、音频事件或renderer迁移。

## CPU验证

运行`node verification/r17-burn-profile-check.mjs`，当前**19/19**，报告见[r17-burn-profile-check.json](r17-burn-profile-check.json)。包含解析窗口、独立Simpson逐段见证、avgI×avg色错误反例、晚期极短窗、黑/次正规数、单调CDF、三种帧率/不规则材料闭合、clear/rewind/纯proposal、固定body种子与0/1/2倍率独立、三示例/推进上界、全phase界及非法输入。每次后续运行另存`r17-burn-profile-runs/`，不覆盖其历史。

独立复核发现并实际复现过3项边界错误：稀疏RGB绕过map的finite验证、256字符baseID实例化超长、巨大已排材料前缀抹掉后续微小delta。首次失败为16/19，源与原报告保留在`baselines/r17-burn-profile-before-review-fixes/`及`r17-burn-profile-runs/2026-10-28T19-27-09-633Z.json`；修复后19/19。巨大材料反例使用1e12预算，1500→1501秒应排约9.999999995e-5，新局部量为正，未因累计高分量太大变成0。

受保护源SHA与之前冻结一致：FW`3fb39738…`、physics`fb6be290…`、smoke logical`235dff62…`、radiometry`f9426456…`、audio`4e5ede41…`。仅CPU契约/数值原型通过，未声称场景接线、照片级画面、真实声音、GPU性能或物理测量通过。

本阶段pure模块SHA256：`7308fd7a59ac918de80acbf296a0117f2d499e48d8de40bf2880d0b3c90436d7`；CPU夹具SHA256：`2aaf70a0c85deacc0e397ed4c15509b14cef74eb50af44d9a11ed2f66eeaca89`。`node --check firework-burn-profile.js`退出0。
