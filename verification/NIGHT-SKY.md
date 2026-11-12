# 夜空、大气和云形验证

## 天文数据与方向

夜空采用本地 NASA SVS4851 的4096×2048线性HDR星图，来自恒星目录并含银河暗尘带。月面为NASA SVS4720/LRO反照率贴图；来源、原件、转换误差、hash和许可在 [assets/night/SOURCES.md](../assets/night/SOURCES.md)。没有海岛/天空整景照片替换场景，也没有随机点伪装星座。

本地固定commit、MIT许可的AstronomyEngine计算J2000到本地天空旋转、月位/月相/角半径。右手场景坐标为+X东、+Y上、−Z北；`rotationDegrees`可调整场景北向，星图与月亮一起旋转。天空太阳滑杆是独立的构图控制，不等同于所选日期的真实太阳位置。

- 月夜默认：仙本那4.5°N/118.6°E，2026-10-26当地22:00（UTC14:00），月相约99.60%，月亮仰角55.86°。不能同时当作无月银河条件。
- 暗夜星河：2026-08-13当地22:00，月相约.98%，月高−44.57°；银河中心约西南213.31°、仰角49.22°，因此默认岸边朝东北的低视角看不到核心。
- [实际银河视角](navigation-night-galaxy-first.png)已确认能看清分叉暗尘带和恒星层次，树冠保留剪影。原[低空岸边视角](navigation-night-stars.png)偏黑、偏橙，与视线避开银河及较强低空消光有关，不能单凭这张图把恒星整体提亮或染蓝。

## 日落到夜间的光路与预曝光

直射太阳在被地球遮挡后归零；球形指数大气用Chapman柱近似替代仅适用于白天的平面空气质量外推。单次散射在高空仍可形成暮光；模型仍是8步RGB单散射及有限扩散近似，不是完整多次散射LUT。

月光、恒星和空气散射在同一场景线性预算内。物理夜间数值约为日间单位的1e−9..1e−6；单纯在OutputPass最后加曝光会先在RGBA16F里下溢。现在天空、主光、环境cube、`skyTint`在写入半浮点缓冲前统一乘`2^preExposureEV`，最终曝光减去同值，保持原照明比率。自动曝光建议月夜约17.7EV、无月约21EV，属于相对日间的长曝光摄影补偿，不代表肉眼暗视觉，也不宣称绝对lux/ISO校准。

`lighting()`的`sunStrength/moonStrength/keyStrength/skyTint`已预曝光；`physicalSunStrength/physicalMoonStrength/physicalKeyStrength/skyTintPhysical/physicalSkyIrradiance`没有预曝光。水、叶片、空气透视和云阴影共享`keyDirection`；天空私有`sunPosition`继续保存太阳方向。`uCloudLightDirection`负责同源主光遮蔽。天空环境cube关闭日月圆盘的直接光贡献以避免重复计入，星光与大气散射仍保留。

```js
await atmosphere.ready;
atmosphere.setNight({
  latitude:4.5, longitude:118.6,
  date:'2026-08-13T14:00:00Z', // 显式UTC；UI当地时间须附+08:00
  rotationDegrees:0, automaticExposure:true
});
const L=atmosphere.lighting();
// scene directional intensity = 3.6 * L.keyStrength
// final exposure EV = userEV + L.recommendedExposureEV - L.preExposureEV
```

关闭自动曝光时建议曝光和预曝光同时归零。星图采用线性mip及接缝安全梯度；没有每帧随机闪星。月面只有近似libration和Lambert局部照明，没有地形自影或完整Hapke反射；未实现自然气辉、黄道光、光污染、行星和完整视宁度模拟。

## 云形矩形缺陷：候选及可复核范围

密度不是由max-support纹理的矩形单元直接绘制，也没有云AABB盒作为最终形状。旧viewLOD3却使64³噪声只剩8³，阈值密度易形成大尺度平片；旧`h/(.6+.4*weather.g)`加统一inversion也将二维上升气流挤成近同高的柱。仅降低LOD及旋转噪声后，[月夜首图](navigation-night-moon.png)仍可见明显枕头轮廓，尚不足以称修好。

候选1把上升气流与竖直Gaussian相乘，但[同位0/1对照](navigation-night-cloud-shape-1.png)仍像扁椭球，未被接受。

**最终采用2**：现有体积纹理的原空闲A通道存独立Worley8形状，三维隆起成为主要支撑（约250m横向/115m竖向尺度），另有大团背景和独立中高频侵蚀。液水量采用连续`1−exp(−1.7 max(mass,0))`，不再过早将全部内部饱和成同高不透明块；最高层前的mass已为负，避免统一顶部切帽。RGB保留，因此旧0/1对照不受A通道改变影响。新增一次3D采样，没有新增纹理或渲染pass。这是程序化三维液水支撑近似，不是气象流体求解。

[实际同位旧形0](navigation-night-cloud2-0.png)与[最终2](navigation-night-cloud2-2.png)已独立审看：右侧旧块的直立边/平顶消失，轮廓成为多个小隆起并有开口；左侧连续大片也有团簇高低与空隙，改善不只是把透明度调低。2确实更薄、略偏碎/层状，远处仍有步进采样痕迹，不称完美实拍。全域采样平均密度由旧.02934变为.00959，固定extinction未变，因此该A/B同时改变云体质量，不能称仅改外轮廓的等光学厚度实验。

`setCloudShape(0/1/2)`保留历史对照，默认为2；变更后调用者应刷新云影、环境cube及暂停缓存。最终明亮白天/高覆盖观感及性能由根代理另验。

max-support只提供保守跳过区间，当前额外外扩一段，`uCloudSupportEnabled=0`可隔离它的影响。CPU52万密度采样中支持范围误剔除为0；这个检查不证明每个远处云都好看。候选最终观感与性能以根代理同位截图、视频及完整rAF/GPU记录为准。

## 已有证据

- [night-sky-math-check.json](night-sky-math-check.json)：30/30，含右手旋转、连续时钟、夜间预算、预曝光范围、Chapman与独立球面积分比较。
- [weather-math-check.json](weather-math-check.json)：10/10；[weather-support-check.json](weather-support-check.json)：520704个密度点、7040个正密度点、误剔除0（最终2）。
- [navigation-night-sky-gpu.json](navigation-night-sky-gpu.json)：实际GPU5/5。满月/暗夜含云的14个33²视向没有NaN/Inf或负RGB，最大HDR值3776；RT、viewport、scissor及标志恢复。
- 同一GPU夹具中，不预曝光的FP16相对Float32像素RGB总和损失约98.33%；21EV预曝光后误差约−.0355%，3267个正RGB通道全部保留。这是相同射线像素的数值存储对照，不是全场景总能量守恒证明或帧率测试。

手机性能、任意硬件每帧60FPS、路径追踪级夜景均不由这些数理/小图GPU检查保证。
