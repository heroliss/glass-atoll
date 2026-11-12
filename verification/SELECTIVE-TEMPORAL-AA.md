# 植被亚像素采样候选

本轮只修改 `lens.js`、`vegetation.js`，并增加相关验证文件；未改地形、水体、天空或 UI。候选需要根代理在实际用户远景、风速 5 m/s 和相机拖动下作 GPU/动态验收，不能由静态图或 CPU 通过宣称没有拖影。

## 原因与方案

用户远景中小叶真实宽度投影远小于一个像素，MSAA 4× 也会漏掉部分覆盖；SMAA/FSR 1 无法重建未被任何样本捕获的叶片。扩大实际叶宽会改植物尺寸，因此本方案保留所有物理几何，改为植被专用的短历史、多位置像素采样。

主 HDR 绘制时，植被顶点在最终 clip xy 加入严格零均值的 8 点 Halton 周期，范围小于半像素。位移乘 clip.w 并按实际内部像素尺寸换算，因此不随深度改变，不修改相机矩阵、FOV、世界位置或法线。水、天空和普通地形不抖动；主绘制完成后在 try/finally 中将控制 uniform 恢复为零，反射与阴影继续使用原投影。

植被保持 opaque RGB、不启用透明混合或 alpha-to-coverage。主 HDR 的 alpha 临时写为 .25，MSAA resolve 后形成覆盖标记；其余 opaque 目标 alpha 为 1。选择性 resolve 在标记的一像素邻域工作；没有当前或有效上一帧支持的区域直接旁路。HDR alpha 此后仅保存历史深度，镜头输出重新写 alpha=1，不作为画面透明度。

历史使用 camera-depth reprojection、植被深度膨胀、越屏/深度拒绝和 YCoCg 邻域均值/方差盒裁剪。累积始终在 HalfFloat **线性 HDR** 中进行，随后才进薄透镜、SMAA、OutputPass 与可选 FSR 1。没有第二次曝光或 sRGB 编码。

这不是完整 object-motion-vector TAA：没有逐叶片上帧变形或反射运动向量。使用相机屏幕速度、共享风速/模拟时间间隔估计和颜色历史修正量，保守减少强风近景、快速拖动及突然遮挡时的历史权重。动态风和离屏边缘仍需实测，不能声称该近似解决所有时间混叠。

## 集成 API

原 `lens.render(scene, focusDistance)` 两参调用保持有效。lens 自动查找 `grove.userData.temporalAA`，不要求 main 传 jitter 或改相机。

- `lens.configure({...原参数, temporal:true, temporalWeight:.84})`：默认候选开启；权重限制到 0–.9。
- `temporal:false`：关闭植被抖动与历史累积，作为 MSAA/SMAA 基线。仅把 weight 设 0 不能替代关闭开关。
- `lens.resetTemporalHistory(reason)`：显式丢弃历史，建议在太阳/强光照突变时调用。
- resize、镜头/曝光/景深/AA/质量配置变化、大相机切换和模拟时间跳变自动 reset。
- `lens.state.temporal`：enabled、active、historyFrames、historyWeight、jitterPixels、lastResetReason、scope、maximumMissingCoverageFrames 和历史缓冲的字节数。

main 现有 setLens 全量转发参数，因此可直接 `__ATOLL__.setLens({temporal:false})` / true 作 A/B。UI 可增加独立的“植被稳定采样”开关，并把参数默认值显式设为 true；未在本代理修改 UI。

## 当前证据与待验收

- [temporal-aa-math-check.json](temporal-aa-math-check.json)：**20/20**。8 采样严格零均值、范围/重复、clip 位移像素大小、用户远景相机深度重建；六个植被 mesh 的全部 position/normal/tangent/UV/风属性与 index 对照旧基线逐字节不变；风变形 GLSL 不变；阴影不注入 jitter。
- 原薄透镜 6 项数值检查仍通过。基线源码留在 `baselines/vegetation-before-temporal-aa.js` 和 `baselines/lens-before-temporal-aa.js`。
- `temporal-aa-gpu-check.js` 导出 `runTemporalResolveCheck(THREE,renderer,selectiveTemporalGLSL)`。实际 shader 从 lens 导出；覆盖非植被旁路、HDR、首帧/深度/越屏拒绝、历史裁剪、mask 局部性、高风响应及 renderer 状态恢复。[temporal-aa-gpu-final.json](temporal-aa-gpu-final.json) 实际 GPU 为 **9/9**。
- 两张 RGBA16F 历史目标及各自的 R8 年龄附件共为每内部像素 18 字节；每帧增加一个选择性全屏 pass。R8 由同一个 MRT 绘制写入，没有新增运行时全屏 pass。实际 GPU 成本和 60 fps 预算尚未由本代理测量。

用户复现条件：1270×1292、q=1、35 mm、f/2.8 景深开、风 5 m/s、太阳 8° / 强度 .4；相机约 `[-203.8836,98.7486,11.2666]`，target `[-2.4671,-12.0603,4.0006]`。约 230 m 对焦时树冠的薄透镜 CoC 很小，断点主要不能归因于景深。应同时比较静止采样收敛、强风树冠、平移/旋转、相机切换与反射边缘；全局水波/天空不能因候选历史而出现拖尾。

## 漏采连续性与深度元数据复审

`temporal-sequence-before-v2.json` 为根代理在同浏览器临时自有 WebGL2 context 上执行的实际 GPU 缺陷复现。旧 shader 在 40 个测量帧中有 10 帧把漏采的叶片历史深度清零，输出标准差 / 原始标准差为 .98354，说明此合成细叶几乎没有得到时间稳定化。正确的半像素重投影夹具还复现了深度与无效零值线性插值：内部历史贡献约 .01634，边界贡献为 0，错误拒绝了边界历史。首轮夹具漏乘齐次 w=230，实际只移动了 0.5/230 像素；该首轮不能用于判定半像素边界，修正后的 v2 才是相应证据。

修复在独立 R8 附件记录 `0=无效、1=新鲜、2/3=漏采一/二帧`，没有将年龄打包到深度小数。RGB 保持双线性，深度/年龄从周围有效离散 texel 选择；历史验证不再把前景深度与零线性混合。仅当前一帧同像素仍有有效支持、重投影位移不超过 1.25 像素、深度一致且没有新前景遮挡时，允许最多两个漏采帧的快速衰减桥接；第三个连续漏采帧清除，避免永久叶影。

`temporal-sequence-gpu-check.js` 导出 `runTemporalSequenceCheck(THREE,renderer,selectiveTemporalGLSL)`，涵盖半像素边界、周期漏采、三帧内过期、两像素相机移动拒绝、新前景遮挡拒绝和 renderer 状态恢复。该夹具使用真实 R8 MRT 附件；为跨平台读回，QA 内另作一次 R8→RGBA32F copy，**运行时没有该 copy**。[temporal-sequence-final.json](temporal-sequence-final.json) 实际 GPU 为 **6/6**：半像素边界/内部历史贡献比约 .999998，周期漏采的零深度帧数由 10 变为 0，输出标准差 / 原始标准差由 .98354 变为 .17755。特征完全消失时第三个连续缺失帧清除历史，快速相机与新前景遮挡均拒绝保留。此结果只针对夹具，真实风动、拖影和性能仍待视频验收。

上述 GPU 运行还暴露 ANGLE 的分歧循环隐式导数警告。选择性 shader 的所有无 mip 数据 RT 采样随后统一改为显式 `textureLod(...,0.)`，避免在有条件执行的候选循环中依赖未定义导数；CPU 20/20 与薄透镜 6/6 再次通过。该最后采样限定的驱动警告消除与 GPU 重跑由根代理继续核查，不能用改前报告替代最后运行结果。

独立管线检查未发现每帧重设 viewport/resize/configure/history 的问题。MSAA 4× 的覆盖标记最小非零值 .25，远高于 .012 检测阈值；确认的问题是所有样本均漏采后的支持中断。用户 q=1 时 FSR 1 不运行，RCAS 不能解释该原生分辨率问题。风 5 m/s、230 m 距离、60 fps 时纯风估计对应历史权重约 .75，90 fps 时约 .799；近至 30 m、60 fps 时约 .001，这是没有逐叶运动向量的保守响应，不能声称近景也保有同等时间超采样。

## 一手依据

[Playdead 的 INSIDE Temporal Reprojection 源码与讲稿](https://github.com/playdeadgames/temporal) 说明历史验证、邻域裁剪及移动物体 motion-vector 的必要性；本实现为针对本场景的原创选择性简化，没有直接复制其引擎实现。

[NVIDIA：A Survey of Temporal Antialiasing Techniques](https://research.nvidia.com/labs/rtr/publication/yang2020survey/) 将采样累积和历史验证区分为两个核心部分，也指出动态几何、遮挡变化和历史污染的技术边界。本候选保留这些边界，不把 TAA 当成无条件的清晰度开关。
