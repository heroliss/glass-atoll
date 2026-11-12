# C2云底连续性：已证实反例与窄修合同

2026-10-27，计划/数学审查，不是运行时修改授权记录。本文件写成时sky仍保持原生产公式；root须先完成棕榈A/B重载，之后才决定开启这个独立候选。weather.g高度warp继续HOLD。

## 证据足以支持什么

`cloud-layer-edge-probe.json`使用实际生产CPU闭包、同一时刻/固定三方向共768列、球形altitude坐标：

| 天气 | base−1mm | base+1mm最大/均值 | +1mm正值列 | base+1cm最大/均值 |
|---|---:|---:|---:|---:|
| fair | 0 | .0204061 / .0015603 | 52.99% | .0204728 / .0015702 |
| humid | 0 | .0145130 / .0023692 | 58.46% | .0145460 / .0023769 |

epsilon降低十倍，密度没有朝0降低相应数量级，而是趋向非零平台；结合下述公式，**内侧base跳变已在实际field确认**。top内外探针均为0，和之前顶高切片/上界相符。delta=0行受球形坐标逆变换的机器舍入影响，不能拿它区分严格边界两侧；±1mm才是明确内外采样。

这是与合法共同LCL平底不同的连续性问题，也与“weather.g没接C2所以所有顶面矩形”不同。新的密度切片已显示不等高圆顶，实际64/128步视觉差异很小；不借这次真实base错误重新授权高度warp、puff尺度或其它造型变更。

## 数学原因与最小候选

现有代码的offset来自**noise texture的shape.g，不是weather.g**：

```text
h=(altitude-cloudBase)/layerHeight
delta=(shape.g-.5)*.018
baseA=smoothstep(0,.052,h+delta)
rhoA=F(h,p)*baseA        // C2其余因子非负、有界、连续
altitude<=cloudBase 时外层guard强制rho=0
```

delta>0时，h趋0的右极限为`F(0,p)*S(delta/.052)`，可非零；delta最大.009时S约.079498。这解释内侧实测的正平台。

候选仅令：

```text
deltaB=min(delta,0)
baseB=smoothstep(0,.052,h+deltaB)
rhoB=F(h,p)*baseB
```

因为deltaB≤0，h趋0+时baseB→0；min和smoothstep连续、F有界，故rhoB右极限为0，与外层guard相接。更强地，`0<=baseB<=S(h/.052)`；层底密度按O(h²)起步，不会依赖精确浮点相等判断来“补0”。这只是连续的数值云水生长包络，不声称是完整湿微物理。

并且deltaB≤delta、smoothstep单调，所以**逐点0≤rhoB≤rhoA**；不会新增云到原support外。对delta≤0位置完全不变；对h≥.052两者都饱和为1，也完全不变。即只有云底最初不超过fair49.4m/humid93.6m的正offset部分被削弱，LCL/top、上部轮廓、天气、噪声和光学参数不动。

## A/B及legacy保留协议

新增一个内部QA uniform，建议名`uCloudBaseContinuity`：**初始默认0**，A保留原生产计算与乘法顺序；1才启用候选。不能一落盘就把未经A/B的B作为默认。

- `uCloudShapeBlend=0/1`两条旧shape在uniform0或1下都保持原base，避免把旧分支也改了却失去对照。
- 默认生产shape2在uniform1时使用baseB。
- 若保留shapeBlend在1..2之间的连续API，先分别求`thermalBody*baseA`和`billowBody*baseB`再按原混合权重混合；不要让热团旧分支也被新的共同base悄悄改变。默认uniform0走原表达式，要求CPU对原闭包严格回归；中间混合态不承诺整体base连续，只有C2新分量保证连续。
- 外层球形层界guard保留。不能通过取消guard允许LCL以下云水来消除跳变，也不随机抖云底或修改RH/LCL。
- setter/诊断仅供这次QA，不向普通用户增加工程开关。baseline开关值、source hash和快照状态须记录。

## 通过门槛

1. uniform0对保存的生产密度采样不变；legacy0/1在uniform1下也不变。检查固定dense点、随机点、负/正层边、两天气与多个LOD。
2. C2候选在原768列重复base±1mm、+1cm/+10cm/+1m，内侧密度趋0。可按`rhoB<=uCloudMoisture*S(h/.052)`校验epsilon级上界，而非任意设一个方便通过的阈值。CPU/GPU球形altitude误差需以实际epsilon代入容差，不用严格delta=0判定。
3. top原检查不退化；逐点`rhoB<=rhoA`、weather-support保守性、CPU/GLSL同值回归通过。没有新增纹理/pass/steps，但最终光度不保证逐点更暗：少自阴影也可能使局部更亮。
4. root先固定同一云、同相机/时间/曝光进行A/B。看base是否从硬切变柔和，同时共同平底仍在；不以整体slab必须消失作为事后改更多参数的理由。64/128、weather.g或其它puff变化不混入本对照。

## 同源照明与缓存风险

CPU probe、view shader、反射sky/cube、cloud-shadow shader必须共用同一flag与base公式。uniform应进入`captureSnapshot/withSnapshot`；六面env捕获要同一个版本，不能混A/B。cloud-lighting缓存及sky.lighting的缓存key必须随flag失效，暂停时也要可强制更新；否则出现主画面B、海岛云影A的假对照。

少了base密度，太阳透过/阴影可能真实变化；需要刷新cloud-shadow cache、环境cube/PMREM和依赖光照的GI，重置旧帧TAA/曝光尺度历史，再锁定同一C/P协议。物理源强/曝光预算不为“图看起来差不多”而重调，不能用手工环境补光掩盖变化。点位support不会扩大，但高透过率可能让march更晚终止，实际总GPU工作仍应记录，不能仅据0新增采样指令断言性能不变。

## 当前状态

最初写成时仅有数学与实际CPU边界证据，运行时未改。随后root完成棕榈12视角A/B并批准按本合同实现；以下是实施后的独立记录，不能混作初稿时已经通过。

## 已获准实施：初始默认0，实际GPU及视觉记录

`sky.js`冻结SHA256为`953f672cd91e7bf64b8c13abeb6fe3137d587c6ffe3a91c8f2cc82a17a0832f0`。原64ed文件完整保存在`verification/baselines/cloud-base-before-sky.js`。API为`atmosphere.setCloudBaseContinuity(0|1)`；默认0，诊断包含flag及`cloudDensityKey`，snapshot捕获flag，冻结回调内setter会拒绝突变，嵌套/异常均恢复。root负责setter后的cloudcache/GI/env/history强制更新；本模块没有改main、水、植被或音频。

`cloud-base-continuity-check.json` **69/69通过**：原式flag0对保存的64ed逐值bitwise一致、legacy0/1不变、h≥.052不变、候选非负/不增、候选support无误剔、snapshot完整。768列base+1mm的fair max由.0204061降至9.44e−10，humid由.0145130降至3.25e−10，符合epsilon数学上界。既有weather数学10/10及support520704样本/7040正值/误剔0也通过，均记录新源码hash。

实际GPU helper为`runCloudBaseContinuityGPUCheck(THREE,renderer,atmosphere)`，使用传入生产GLSL/CPU闭包及同一纹理，只创建自己的Float32探针，3个sampler，无运行时新sampler。`visual-round-b4-gpu.json.cloud`记录 **24/24通过**，覆盖两个天气、shape0/1/1.5/2；legacy0/1 GPU输出bitwise不变，较高层不变，候选无增量/负值/非有限值，实际fragment上限16，结束时live snapshot与renderer状态恢复。实际GPU第一厘米最大密度fair由`.02041853`降至`9.35e−8`，humid由`.01445977`降至`3.19e−8`。全部形态GPU/CPU最大绝对误差不超过`.001887`、RMS不超过`.000132`；这是公式与精度校验，不是独立云微物理模型。

`playground-cpu-b4.log`的17份回归报告共 **310项**，均通过；本次独立解析各报告数目得到310，与root的allExit0汇总相符。此处包括cloud69项，不应再加69重复计数，也不代表GPU性能。

已离线实看`cloud-base-{fair,humid}-{0,1}.png`全部四张实际生产截图；`cloud-base-view-check.json`确认每组0/1相机、target、物理time`.055`、70mm/f8/DOF关闭、C0及组内P一致（fair−.75，humid−.5）。三路opaque/composed/reflection范围检查均无NaN、Inf、负值；本视角reflection全零，不能拿这组反射范围记录声称有植被倒影的压力场景也通过。开关只轻微改变最低云层/底缘，未见明显轮廓恶化或整体云量突变，但大片云形几乎不变，**不能称云已照片级或整体slab缺陷消失**。公平/湿润两组显示编码RGB平均绝对差分别`.0000320`/`.0001216`；这是静态图差异大小，不是物理能量守恒或主观质量分数。

从数值连续性、无新增可见退化的范围看，没有证据否决候选1；默认是否切到1由root结合整场成本与验收决定。本次文档核对不改source/default。已有海天线蓝灰水平带在A/B均存在，与本候选分开记录，见`CLOUD-DENSITY-EVIDENCE-REVIEW.md`的后续几何诊断。音频4e5ede41继续锁定。
