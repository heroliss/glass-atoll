# 多尺度海况：当前机制、受控改动和边界

本轮修改 `waves.js`、`spectral-waves.js`、`hydrodynamics.js`；主场景、水光学、UI、浮叶和声音的增益接线由根代理负责。以下数值是解析波谱默认值，不把数理检查当作照片观感或60FPS验收。

## 原来已经有大小波、不同周期和随机相位

原版本是256个固定seed模态、四张256² RGBA16F波场。每个模态的波数、方向、振幅、初相位不同，时间演化服从重力—毛细有限深度色散。随机性在生成时确定，不是每帧加入噪声；不同频率自然形成拍频波群，也没有强制把所有波按一个短视频周期循环。

旧版最长9.7–52m一组占**高度方差52.3%**，所以“波浪能量全是短波”不准确。但它只占**坡度方差0.305%**，而最短6–45cm一组占坡度方差68.7%，视觉反光很容易被细波主导。真正可定位的问题是所有尺度都混同一宽方向分布、没有独立涌浪峰、所有模态都随局地风归零。线性高度场没有Gerstner式水平挤压或非线性破碎波峰。

## 本轮保留预算，分开两种波系统

| 系统 | 处方 | 默认数值与实际离散谱 |
| --- | --- | --- |
| 窄向涌浪 |64模态；频率Gaussian抽样，峰值周期7.5s、频率标准差16%；方向中心−.68rad、方向抽样标准差.14rad |Hs=.16m；离散能量加权平均周期7.773s，方向标准差8.81°，有效能量模态约36.2个；不随局地风关闭 |
| 较长风浪 |64模态；2.2s峰、gamma3.3的JONSWAP形频率权重；按log-k抽样密度作重要性权重修正 |坡度RMS=.025；约81.4%高度方差落在1.8–2.5s；方向标准差约25.3° |
| 短风浪 |64模态，较宽方向谱 |坡度RMS=.055 |
| 重力—毛细尾部 |64模态，继续保留高频细坡度 |坡度RMS=.090 |

默认总谱Hs由旧.14403m变为**.18757m**；总坡度RMS由.108563变为**.108580**。因此主要增加可感知的慢起伏和有方向的涌浪，并未把细波坡度整体放大。纯涌浪在零风时Hs=.16m；5m/s时两系统方差相加，总谱Hs约.21918m，不能把整个Hs都乘风速因子。

这只是受控的Gaussian/JONSWAP形处方谱，不是SWAN风输入、fetch、破碎、底摩擦及非线性相互作用求解。SWAN官方允许Gaussian或JONSWAP参数谱，并将频率谱与方向分布分开；其示例也区分较宽风浪与更窄涌浪的方向分辨率。[SWAN波谱边界](https://swanmodel.sourceforge.io/online_doc/swantech/node64.html) · [SWAN频率与方向网格](https://swanmodel.sourceforge.io/online_doc/swanuse/node11.html)

## 共享波面与坡度矩

`f = swellField * swellGain + windFields * windGain`，其中`windGain=waveWindFactor(speed)*windSea`、`swellGain=swellHeight/.16`。高度和一阶坡度同乘各自增益；未解析坡度方差`E(|s|²)-|E(s)|²`分别乘增益平方。纹理仍保存默认单位的`height/slopeX/slopeZ/slopeSquared`，因此不用重建RT或增加pass。独立系统之间忽略跨cascade局部协方差是统计近似；没有宣称精确各向异性像素足迹积分。

颜色、深度、焦散、折射、浮叶的高度与法线继续使用同一份`waveGLSL/waterField`。不只移动可见水网格来制造Gerstner外观：水平位移会使原来的Euler高度场参数化失效，还要同步反求位置、法线和光路交点，避免照片表面和焦散各自运动。GPU Gems明确区分垂直高度场与Gerstner水平位移，并给出过陡时产生折叠的条件。[NVIDIA GPU Gems，第1章](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)

## 近岸交给原浅水方程，不画假shoaling图案

原有深度加权压力投影、MAC面通量、固定CFL步长、干单元边界和两pass浅水更新均保留。西侧10m驱动带改为三种近邻长周期：**22.5018 / 20 / 17.4741s**，默认等效规则波振幅.015m，groupiness=.35。分量权重归一化为`sum(w_i²)=1`，改变成组程度不会自动增加长期平均输入方差。分量相位逐子步积分并独立取模；周期调节保留时间相位积分，但同时改变空间波长，不能保证整个边界每一点瞬时空间相位连续。运行默认固定20s。

三频只在实际驱动带计算；不增加全屏pass。关闭驱动仍保留原吸收/海绵机制，`setSwell(0)`可用于无外力测试。1.5cm默认值足够小，不以大振幅掩盖固定岸线模型的限制。

SWAN从色散关系取群速，并以能量/波作用通量描述浅化、流致频移及折射；仅按局部深度乘一个振幅系数不能替代相位传播。因此本轮不在全海面任意乘`h^-1/4`，仍由浅水解处理其适用的长波深度响应。[SWAN作用量平衡方程](https://swanmodel.sourceforge.io/online_doc/swantech/node12.html)

7.5s可见涌浪仍是3m参考水深的解析谱，**没有完整地形折射/浅化**。另一个20s浅水分量确实在实际地形上传播，但它是非色散近似，不是7.5s谱的完整继续。最短默认分量17.474s相对有限深度理论的相速高估约：3m深处.664%，最深实际西驱动边22.826m处5.30%，32m外海参考处7.60%。没有湿干岸线移动、卷破、飞沫守恒体积或完整三维流体求解。

## 集成API与增益同步点

```js
waveSpectrum.setSeaState({swellHeight: .16, windSea: 1});
// swellHeight: Hs米，范围0..0.32；windSea: 风浪振幅倍率，范围0..1.5。
// uniforms.uSwell = Hs/.16；uniforms.uWindSea = windSea。

hydrodynamics.setSwellState({amplitude: .015, period: 20, groupiness: .35});
// amplitude: 0..0.02m，period: 14..28s，groupiness: 0..0.8。
// 旧setSwell(amplitude)兼容；setSwell(0)关闭所有驱动分量。

waveSpectrum.sample(x, z, time, {windFactor, currentOffset: [ox, oz]});
// 返回[height, slopeX, slopeZ]，解析谱CPU估计，不含GPU SWE状态。
```

- 水、浮叶GPU、焦散：共享`uSwell/uWindSea` Uniform对象；焦散显式列表要补两项。海况变更须强制更新焦散和失效时间历史，暂停缓存也要认出参数改变。
- 浮叶CPU高度、水平轨道振幅、声源高度和速度：每模态用`waveComponentGain(w,windFactor,seaState)`或同等`kind`分支；Stokes漂移用gain²，不能仍全同乘风因子。
- 水面宏观遮蔽与短曝光坡度方差：用导出的`swellRmsSlope/windRmsSlope`及`swellTemporalSlopeVariance/windTemporalSlopeVariance`分开按gain²合成。
- 处方峰值周期、方向暂为常数。没有用“改变动画速度”伪装改变周期；那会破坏色散。

## 验证与剩余验收

`node verification/sea-state-math-check.mjs`：**26/26**，输出[独立物理检查](sea-state-math-check.json)。覆盖默认Hs、频谱/方向分离、零风涌浪、非单位增益的高度梯度、实际GLSL方差式、色散逆解、自然波群、SWE边界RMS和长波阻抗。既有光学与浅水CPU检查本轮另实跑通过（29/29、38/38），其各自JSON保存源码hash。尺度审计已从当前常数读取20s/.015m，避免旧regex失配退回4s。

`runSeaStateCheck(THREE,renderer)`位于[sea-state-gpu-check.js](sea-state-gpu-check.js)：创建独立波谱/小SWE，验证真实共享GLSL的增益线性、方差平方和实际驱动；不修改主场景时间，结束恢复renderer状态。GPU结果以根代理保存的实际JSON为准，不能把这份可运行helper当作已经通过。

四张256²纹理、每张64模态、四次合成pass和原mip链预算保持；SWE不增加pass。**不据此保证60FPS**，最终还须在当前远景、风动、拖动及厚云下复测GPU时间、rAF慢帧和主观波形。高画质允许用户选择更低帧率预算，不把任意平台锁死到一个承诺。
