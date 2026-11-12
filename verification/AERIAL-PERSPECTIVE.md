# 有限距离空气透视：接口与数值检查

2026-10-26。`aerial-perspective.js` 接收统一物体/海面的线性 HDR 颜色与标准透视深度，在植被/水面历史处理之后、镜头之前运行。根程序需关闭旧 scene fog 与水面独立 haze，避免重复计算。

```js
const air=createAerialPerspective(THREE,renderer,{camera,atmosphere,sunLight});
air.configure({enabled:true,aerosolScale:8,shadows:true,quality:'high'});
air.update({time,weather,sunDirection,quality,sunLight});
const hdrTexture=air.render({colour,depth,width,height});
```

- `render` 直接返回 Texture；尺寸为实际内部绘制的**物理像素**。输入不应已经过 ACES/sRGB 编码。默认内部全尺寸 HDR 输出，也可传相同尺寸的 `output` RT。
- `enabled:false` 且无外部 output 时返回同一输入 Texture，不绘制；`shadows:false` 只移除空气积分内的树影/云影可见度，保留消光与散射系数，用于 A/B。
- 高档 8 步、树影 2 tap；流畅档 6 步、树影 1 tap。半分辨率 MRT 存 RGB 入散射、RGB 透射和深度，再做四邻域深度感知合成；全深度天空直接旁路。无时间随机抖动或空气历史积累。
- 共享近/远云影缓存与实际方向光阴影图。太阳输入为 **sunLight.color × intensity**，已含上层大气减光，不再重复乘整层 solarTransmission；局部云/树可见度只作用一次。
- RT viewport 使用物理尺寸，不调用会再次乘 canvas DPR 的 `setViewport`；try/finally 恢复 render target、cube face、mip、实际 viewport/scissor、XR 和阴影设置。
- `setSize / configure / update / diagnostics / dispose` 提供尺寸、参数、状态和资源管理。诊断中的 CPU 提交时间不是 GPU 时间或 FPS。

`marineAirCoefficients` 导出 `radiusGrowth`、`areaGrowth`、`normalizedMieScale` 和 RGB 系数，供天空共享 Mie 增幅。默认 dryMie550 为 `3.996e-6 m⁻¹`，`normalizedMieScale = aerosolScale × (1 + κ RH/(1−RH))^(2/3)`；RH 上限 .95，κ=.6 为预设混合海洋粒子近似。RH=.68、scale=12 时 wetMie550 约 **8.295e-5 m⁻¹**。空气密度随 Rayleigh / aerosol 标高指数衰减；气溶胶控制不是实测质量浓度。

湿增长参考 [Petters 与 Kreidenweis 的 κ 参数化原始论文](https://acp.copernicus.org/articles/7/1961/2007/)。这里忽略 Kelvin 曲率，使用亚饱和 bulk 半径增长；面积比例只在干粒子数固定、消光效率近似不变时成立，没有严格重算粒径谱、Mie 相函数或完整天气流体。零干气溶胶浓度时，湿度不会凭空产生 aerosol。

[aerial-math-check.json](aerial-math-check.json) **18/18 通过**：无介质 HDR 恒等、零距离、独立 Simpson 积分对照、分段组合、薄/厚光学极限、RH/浓度分离、散射不超过消光、相函数归一化和天空归一化系数。可用 `node verification/aerial-math-check.mjs` 重跑。

[aerial-gpu-check.js](aerial-gpu-check.js) 导出 `runAerialGPUCheck(THREE,renderer)`，以合成 HDR/深度和黑白云影验证 disabled 同引用、零介质 GPU 恒等、天空旁路、透射范围、均匀介质解析合成，以及云遮挡/太阳强度的源项耦合。实际 GPU 结果需另存报告，不以语法或 CPU 检查冒充浏览器验收。

边界：6/8 步有限距离单散射；深度边缘无匹配邻域时仅作一次中点积分；近处细薄阴影可能变柔或有步进痕迹；没有完整多次散射、逐采样体积阴影或额外环境散射求解。资源预算为全尺寸 RGBA16F 加半尺寸双 RGBA16F，约 `8WH + 16 ceil(W/2)ceil(H/2)` 字节，实际整体性能由主场景持续基准决定。
