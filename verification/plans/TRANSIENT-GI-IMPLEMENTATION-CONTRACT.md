# 瞬态局部光一跳：最小实施合同（冻结候选）

2026-10-27。**仅只读研究与CPU proof，未改indirect-lighting/local-lights/main/water等运行时。** 接续[PYRO-R2-TRANSIENT-CLOUD-GI.md第4节](PYRO-R2-TRANSIENT-CLOUD-GI.md)。root同意先保留本方案待准入，不以本文件表示已接通或达到.2ms。

## 1. 现有数据与唯一新增路径

`indirect-lighting.js:198–209`的directInput只处理Sun/Moon；`:276–281`在low2Hz/high4Hz解算，`:287–288`使用.18s滤波。实际patch上限77地面+96双面树叶=173，18个probe，现有`probeWeights[p][j*4+k]`已经包含patch→probe的方向、盘面积与地形/多孔冠层可见度（`:246–252`）。这些静态权重可以复用，不能把逐个叶triangle Raycaster加进每帧。

新路仅为`6个raw local sources → diffuse patch → existing probe/receiver`；一次漫反射。地灯3、手电1、pyro2直接复用`local-lights.records`的rawRGB/position/radius/range/direction和原生spot角度，不从已P的`uLocalColour`或屏幕颜色反推。native/custom direct已经算receiver直接光，**本路不重复添加source→receiver的direct**；不写天空、PMREM、烟源、cloud delta或新的ambient。原Sun/Moon一/二跳缓存保持原算法，新增局部项固定只一跳，high不能暗中扩大它为二跳。

每源l、每patch j，几何响应为：

```text
q[j,l] = Vterrain+porous(offset(pj), sourcePosition)
         × max(nj·Lj,0) × rangeCut² × spotCone / denominator
denominator = max(distance², radius², groundLamp ? .01 : 0)
unitExitance[j,c,l] = clamp(rho[j,c],0,.95) × q[j,l]
unitSH[p,c,k,l] = Σj unitExitance[j,c,l] × existingProbeWeight[p,j,k]
```

JrawRGB乘unitSH逐通道得到该源当前反弹。B是exitance=`rho×irradiance`，不是radiance；现probe权重已经含`1/pi`盘传播，不再乱乘/漏pi。最终receiver按现`BRDF_Lambert`或水床`albedo/pi`使用irradiance一次。源原始RGB是声明的作者参考，RGB通道被动界不等于完整光谱绝对能量标定。

source→patch复用`createVisibility`（`:168–188`）：97²地形cache、4–48个有限段高度采样、每个静态冠层ellipsoid解析相交与Beer代理。**终点是真实source.position，不是太阳160m射线**。patch→probe已经预烘权重，不重算。手电cone/range与localIncident同公式；CPU不readback torch shadow贴图，也不承诺与GPU精确叶影一致。冠层rest模型、地形采样漏细障碍和18probe空间泄漏保留为边界。

## 2. 必须先封闭的SH负背瓣

原SH1基为`[.25,.5w]×8/9`，有负背瓣。若直接把新的有符号SH加到旧数组再末尾max：旧`[1,0,0,0]`、新增`[.2,.4,0,0]`、normal=−X，会从1降到.8；不能说“总反射功率有界所以正确”。

**推荐：每个source、每个probe、每个channel的unit response单独做cone约束**：保a0不变，若`|a1|>a0`，令`a1 *= a0/|a1|`；然后才乘该源当前非负rawRGB并线性相加。这样每源增量对任意单位normal≥0，关闭/增强任何一源都不会让旧baseline变暗，静态source unit响应也可直接缓存。只约束新局部项，**不改旧太阳SH**。

不能先混合6源再投影后声称逐灯单调：投影非线性，proof保留A=`[.25,.5,0,0]`、B=`[.25,0,.5,0]`反例，添加B后某normal仍会变暗。逐源unit-cone解决这一特定反例；不是在所有可见度变化中保证亮度不变。

该约束软化方向，改变半球/原先clipped角积分；**保留每channel a0，因此整normal球的未裁剪Y00积分`4pi*a0`不变**。不笼统宣称“总能量一定丢失”，也不宣称它是正确Lambert面积源。它是现低阶探针模型的非负角近似，不能替代完整GI。

## 3. 源envelope与旧缓存严格分账

建议新增、待授权实现的最小API：

```js
indirect.prepareTransient({sources: localLights.records, enabled, physicalTime});
indirect.getRadianceBound({component: 'combined'}); // raw，选P之前
indirect.setSceneExposure(P);                     // 现已有接口
indirect.diagnostics().transient;
```

初始化时在本模块私有缓存中继续保留surfels/probeWeights/visibility，新增baseFiltered与published分开。**不能把flash直接写现red/green/blue后让下次.18s基线blend读回**，否则旧flash会进入太阳缓存并留尾。建议流程：

```text
旧update()仅更新baseFiltered，遵守原2/4Hz+.18s
prepareTransient()每帧读取当前raw RGB/pose；off立即全0，无.18s历史
published = Float32(baseFiltered + Σ(unitConeSH_l × currentRawRGB_l))
现54个vec4仍指向published；GPU只乘uGIExposureScale一次
```

3盏地灯的pose/radius/range固定时预计算unit-cone SH；brightness/color变化只乘rawRGB。任何真实pose/range/radius/cone/geometry-visibility epoch变化都使其失效，不量化时间或2m位移来伪称精确。手电与两pyro源首个reference逐帧重算空间响应；raw归0即时贡献0。所有六源pose/raw/基线都未变的暂停帧可精确复用结果，不将physicalTime本身作为强制miss条件。

paused下灯光/手电UI变化也必须先更新raw输入、重算bound并使呈现cache失效；time不变不能挡住真实控制。`quality=off`沿现GI开关让base+transient均0；若需单独local-bounce开关，清空transient但不改变base，不能调ambient代替。

## 4. P选择及main最小顺序

当前main在`updateScenePhotometry`内先localLights.update、后选P，而旧updateIndirect在其后（当前`:974`）。加入时应把一次raw baseline/transient准备移到localLights.update之后、P决策之前；移除后面的重复blend，避免每帧.18s积分两次。最终选P后只给combined uniforms设置一次`uGIExposureScale`，不能用旧P处理raw系数。

每probe/channel `Emax=max(0,a0+length(a1))`，取18probe最大；空间双/三线性权重与edge≤1不会增界。`maxDiffuseRawRadiance=maxRGB(Emax)/pi`（receiver diffuse albedo≤1）可作为combined GI的raw预算。radiometry当前是各分量求和，因此把该combined项加一次；若另提供base/transient分项，不能又加combined。不可用反射总功率替代点wise RGB界。

水床继续现有`getIndirectIrradiance(bottom,bn)`→albedo/pi→原Beer视线路径，不增第17sampler；这仍是原空气probe到床面近似，未解空气/水界面折射的一跳。新路不把海面当漫反射发光盘，也不宣传海水specular GI。

## 5. 资源与实际候选成本

现173patch×18probe×4 Float64权重99,648bytes；18RGB SH1=54vec4，含配置现共61个uniform vectors。新增无RT、无sampler、无scene pass；baseFiltered Float32约864bytes、transient Float64约1,728bytes、exitance scratch约4,152bytes、3个固定地灯unit SH约5,184bytes。动态逐源response可用同一216Float64 scratch依次处理，不一定留6份。额外对象/缓存必须有固定6源上限，不积累历史flash。

`node verification/transient-gi-contract-proof.mjs` **16/16 CPU通过**。只在内存给真实production GI加观测入口，使用真实setup/weights/visibility；fixture是48个合成三角生成173patch、18probe、13多孔体，**不是实际岛/椰树形状**。48个短样本、8次预热，本次Node结果：

| 候选 | median | p95 | source→patch visibility/frame |
| --- | ---: | ---: | ---: |
| 6源逐帧，合并后投影（仅成本参照） | .938ms | 1.104ms | 614 |
| 缓存3地灯、3动态，合并后投影（不保证逐灯单调） | .473ms | .599ms | 266 |
| **缓存3地灯、动态逐源unit-cone（推荐）** | **.496ms** | **.609ms** | **266** |

**未达到.2ms，不把Node合成fixture冒称实际浏览器成本。** 现visibility每query有array map分配和height/ellipsoid遍历；若要.2ms级候选，应另审无分配scalar实现并保持同源数值/可见性，而非先降源更新Hz。实际主线程timer需fixed paused phase或同物理相位录制：lamps only、camera moving torch、2moving pyro、all6；分别记空间响应、216系数组合、上传的mean/p95。若预算不合格，保留关档/高级档选择，不能承诺任意硬件60fps。

## 6. 已量化限制与准入门槛

1. 近地灯对现patch偏置敏感：地面patch.position=h+.065m，而灯中心h+.108m。5m水平距离，单点`I cos/r²`在raised proxy处约为真实地面点的**.398倍**。所以复用现数据不是近场精确面积积分。首版须明确这一量化偏差；若要修应单独记录真实surface point与visibility偏置，不能暗改所有旧太阳/probe几何。
2. source/profile、原始raw RGB与pose不因P/C/camera历史而变化；灯/爆源只能各计一次，新的反弹不反馈为新簇/PMREM。原source→puff自遮挡、烟/云反弹/水界面多跳均不在此合同。
3. 零源严格回旧数组；单灯unit test/各源正增量不能降低旧GI；静态缓存逐值对逐帧reference；source移动/遮挡边缘/point near field；两块漫反射面B0单位、光停即时0、2/4Hz边界无台阶；每probe/channel cone与SH峰界；P sweep固定C；全通道有限/非负。
4. 在真实land/leaf/underwater材质先native direct开、local bounce关/开做固定视角A/B；probe泄漏/黑背叶强反例必须保存，不能只看总功率与CPU16/16。实际GPU、主/镜像图、P安全与性能通过后才允许默认接入。

本轮证明文件：[transient-gi-contract-proof.mjs](../transient-gi-contract-proof.mjs)、[完整JSON](../transient-gi-contract-proof.json)。production源码本轮未改；API均为待实施合同。
