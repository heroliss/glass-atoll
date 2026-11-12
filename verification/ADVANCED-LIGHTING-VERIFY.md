# 间接光、HDR、阴影与海况验收

2026-10-26。此文件是最新轮次；此前 AIR-FLICKER / FEEDBACK 等记录保留作历史证据。交付为推荐设置、动画运行、声音关闭、浅海视角。PNG 是 SDR 预览，无法展示 HDR 屏幕峰值。

## 阳光与反射光

阳光能量感包含直射/阴影对比、可见高光范围、叶背反光及空气光程，不能只加全局亮度。此轮删除旧 Hemisphere 太阳地面补光，保留 PMREM 天空，加入有限太阳漫反射。

137 个地形/植被面元、18 个 SH1 探针，低档一次反射2Hz，高档两次4Hz。缓存地形与65个按真实叶面积拟合的多孔树冠椭球可见度；太阳直射随云遮挡更新。61个额外fragment uniform vectors，零新sampler/场景pass；本机片元uniform上限1024，水纹理sampler仍16。

反射光乘材质反照率/π。水下海床沿界面近似和视线RGB Beer衰减，不加到镜面天空反射。输运行最大.981388，互易误差8.88e-16。开放岛屿第二次反弹功率仅约第一次R .98% / G 1.56% / B .26%，没有夸大成明显整体增亮；默认一次。

GPU查询40点对CPU最大误差约2e-8。同一暂停时间/相机的实际SDR图：[关闭](advanced-gi-off.png)、[一次](advanced-gi-low.png)、[两次](advanced-gi-high.png)。一次对整图平均RGB绝对差约[.421,.638,.142]/255，主要在植被；两次与一次接近。

这不是完整无限反弹、水面镜面GI、云层多次散射、SSGI或硬件路径追踪；SH1会漏掉窄方向细节，也可能小范围漏光。独立CPU夹具更新约1.11ms中位/1.77ms P95；真实浏览器高级组合中曾见4ms级更新及16.2ms峰值，不能把Node成本当浏览器承诺。已修复RH微变导致太阳签名绕过2/4Hz更新的问题，并按真实delta混合缓存。

## 高光、HDR与阴影

镜头微量散射在曝光前的线性HDR中，用四层归一化PSF重分配1.8%辐射，无阈值、无额外additive能量；独立GPU点源总通量偏差约−.04%，关闭完全旁路。它是屏幕PSF近似，未经真实镜头测量。

真实可选HDR链：pre-ACES浮点RT → RGBA16F WebGL drawing buffer → 同任务external-image copy → WebGPU rgba16float / toneMapping extended。没有将SDR画布乘亮度当HDR。当前环境报告HDR/P3且实测[2,.5,.25,1]完整穿过复制链；生产显示映射测试高光encoded 1.765625>1。

首选路径无显式CPU读回，不保证驱动零拷贝；后备PBO明确经过CPU。2/4/8×是相对普通白点的上限，不是测出的nits。SDR输出继续ACES；普通PNG导出专门走一次SDR OutputPass。未更改Windows设置。

已修复首次开启/关闭异步竞争；显示/设备错误会回退SDR。限频用累计截止时间，避免90Hz源配60Hz上限意外只更新45Hz。根场景上限120Hz。60/30/24帧参考只控制自动分辨率，不锁帧；关闭自动平衡保留原生尺寸。降低帧率参考会立即恢复相应像素预算。

阴影实际分配1536/3072/4096/6144四档均已读回确认。固定世界树冠与地面足迹紧配到约71.4×72m，推荐texel约2.34cm，极致约1.17cm。陆地PCFSoft、水中9tap比较；不是PCSS太阳角大小半影或级联阴影。

## 波浪

256个确定seed的Fourier模态、4张256²半浮mip场，合成预算不增加。现在独立窄向涌浪峰7.5s、Hs16cm，风浪峰约2.2s，另叠加重力/毛细短波。默认总Hs18.76cm。随机相位一次生成，随色散关系连续传播，干涉自然成组；不是每帧随机抖动。

波面、光学、焦散、浮叶轨道/Stokes、溅水CPU估高与声源共享各系统增益；方差按增益平方计算，风停仍有涌浪。另有20s附近三频SWE边界，归一化输入均方能量，默认1.5cm幅度，沿实际水深传播。

7.5s细谱仍以3m为参考深度，SWE非色散且固定岸线；二者不是完整统一的海岸波谱输运。没有破碎翻卷/上淹退水，也未声称完整Navier–Stokes。详见[波谱研究](SEA-STATE-RESEARCH.md)。

## 实际性能

本机NVIDIA Lovelace / Chromium156，1209×1292、DPR1、q=1、MSAA4、声音关闭，每段10秒。天气随时间演化，因此不是严格归因于某单项效果的A/B。原始区间和配置全部保留。

| 场景 | 主循环平均FPS | 画布更新Hz | 帧间隔P95 / P99 / 最长 |
| --- | ---: | ---: | --- |
| 推荐：一次反射/3072/SDR | 115.1 | 115.1 | 13.7 / 17.0 / 21.5 ms |
| 高级：两次/6144/HDR | 105.9 | 89.8 | 19.7 / 26.2 / 33.4 ms |
| 高级：太阳12°远海视角 | 106.1 | 87.8 | 19.7 / 25.6 / 43.5 ms |

HDR更新Hz由生产presentedFrames差计算，主循环FPS不冒充HDR画布更新率。WebGL计时器不包含另一WebGPU设备的全部工作，跨API成本以实际帧间隔一起观察。推荐不是所有硬件的60fps保证；高级长帧和OS/GC波动保留，允许画质优先。

原始：[推荐](advanced-recommended-performance.json)、[高级](advanced-hdr-performance.json)、[低太阳](advanced-grazing-performance.json)。

## 验证与边界

- `npm run check`：26模块语法通过，见[日志](advanced-check.log)。`verify:physics`、`verify:details`、`verify:lighting`最终均exit0，日志同前缀保存。
- 物理29/29、SWE38/38、镜头6/6、自动画质45/45；原有细节脚本全部通过。新增GI25/25、HDR数学10/10、海况26/26。
- 最新真实GPU：[advanced-acceptance-gpu.json](advanced-acceptance-gpu.json)：GI40点、海况12/12、HDR18/18、PSF8/8。另[上一组](advanced-final-gpu.json)波谱71/71与水面时间滤波11/11通过。
- 上一组旧sea为11/12：helper错把请求64的SWE当64²，实际模块最小96²。已明确96²并保持静止状态严格0等阈值，最新12/12。失败原件保留，没有覆写成成功。
- HDR暂停3张真实compositor截图非黑且SHA256相同，见[记录](advanced-hdr-pause-check.json)。窗口缩放会打破暂停缓存并重绘。390×844、DPR1手机图[可见完整画面](advanced-mobile-hdr-dpr1.png)，无横向溢出。
- DPR2 emulation的compositor PNG出现倍率/重复拼接，`advanced-mobile-hdr.png`保留为无效视觉证据，不据此通过DPR2画面。独立HDR GPU夹具的DPR2状态恢复另外通过。
- 最终重新载入后控制台warning/error 0，见[原始](advanced-final-console.json)。显示器峰值亮度没有仪器测量，WebGPU能力查询不能替代测量。
- [最终配置](advanced-final-state.json)、[交付画面](advanced-final-desktop.png)、[控制界面](advanced-ui-controls.png)。截图导出为SDR预览，不证明HDR nits。

原理来源：[Chrome HDR canvas](https://developer.chrome.com/blog/new-in-webgpu-129)、[Khronos WebGL浮点drawing buffer](https://github.com/KhronosGroup/WebGL/blob/main/specs/latest/1.0/index.html)、[Three LightShadow](https://threejs.org/docs/pages/LightShadow.html)、[有限漫反射记录](INDIRECT-LIGHTING-NOTES.md)、[HDR路径](HDR-OUTPUT.md)、[PSF实际GPU](OPTICAL-BLOOM-GPU.md)。
