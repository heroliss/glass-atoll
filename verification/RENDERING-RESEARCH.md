# 渲染能力核实与工程建议

核实日期：2026-10-26。针对本目录本地 Three.js **r180** / WebGL 2 场景；本文件记录技术依据、源代码审查及已取得的局部数值/GPU 证据，不修改应用。完整画面、音画与最终配置的验收由 [VERIFICATION.md](VERIFICATION.md) 汇总；研究建议不自动等于已实现功能。

## 能提供的能力与名称

| 方案 | 本 HTML 的可行性 | 应使用的准确名称 |
| --- | --- | --- |
| WebGL 2 多重采样、SMAA、着色细节预滤波 | 已接入主视图与材质 | MSAA / SMAA / 材质抗锯齿 |
| FSR 1 EASU + RCAS | 已以 FP32 WebGL 2 实际接入，q<1 执行；独立 GPU 功能 6/6 | FSR 1 空间超分辨率，不是 DLSS |
| NVIDIA DLSS / DLAA / DLSS Ray Reconstruction | 本网页没有浏览器 API 可直接调用 NVIDIA 原生 SDK | 不提供假开关 |
| 浏览器 WebGPU 的标准硬件 RT | 本次核实的公开标准能力没有可依赖的 RT 管线/AS 功能；不能靠切换 renderer 获得 | 未来能力，不能列为当前可用 |
| SSR | 可用普通着色器对屏幕深度搜索 | 屏幕空间反射；不是 RTX / 硬件光追 |
| 高度场 ray marching | 可针对既有海床/水面做有限步软件射线求交 | 高度场射线步进；不是完整场景路径追踪 |
| 软件 BVH 路径追踪 | 原理上可在通用 GPU shader 中实现 | 软件路径追踪；不能由此推断动态场景可达 60 fps |

NVIDIA SDK 的 Vulkan 接口要求原生 `VkInstance`、`VkPhysicalDevice`、`VkDevice` 和命令缓冲，网页不持有这些句柄。官方 DLSS 编程指南列出 DX11、DX12、Vulkan 集成环境；WebGPU 不是其中的替代入口。[NVIDIA DLSS 指南](https://raw.githubusercontent.com/NVIDIA/DLSS/main/doc/DLSS_Programming_Guide_Release.pdf)、[官方 Vulkan SDK 接口](https://raw.githubusercontent.com/NVIDIA/DLSS/main/include/nvsdk_ngx_vk.h)。

GPUWeb 当前公布的功能枚举不含 ray query / acceleration structure；2026-10-13 创建、仍开放的工作组问题说明此项正在研究，不能把 native `wgpu` 的实验扩展等同于浏览器已暴露功能。这是当前部署判断，不是“WebGPU 永远不会有光追”。[GPUFeatureName](https://gpuweb.github.io/types/types/GPUFeatureName.html)、[GPUWeb #11053](https://github.com/gpuweb/gpuweb/issues/11053)。

## 抗锯齿：先解决本场景真正的采样问题

初始版本直接使用 canvas 的 `antialias:true`；当前已迁移到 HDR 场景目标上的 MSAA，canvas 设置为 `antialias:false`、`preserveDrawingBuffer:false`，避免最终全屏输出再付一次冗余采样成本。保存照片时显式重绘后读取图像。几何 MSAA 不负责消除沙粒、细波高光或小叶内部高频着色的闪烁，水面与砂粒仍保留采样尺度过滤。风动细叶是实体细三角形；材质 `alphaToCoverage` 只对真正的 alpha 覆盖及多采样目标有意义，不能自动修复所有细几何。

`antialias:true` **不会自动让离屏纹理得到 MSAA**。r180 `RenderTarget.samples` 默认 0；当前在 HDR 场景目标显式请求高档 4 samples、流畅档 2 samples，并受设备支持裁剪。水动力、焦散与云影等数据纹理没有统一开启 MSAA。[r180 RenderTarget](https://raw.githubusercontent.com/mrdoob/three.js/r180/src/core/RenderTarget.js)、[r180 WebGLRenderer](https://raw.githubusercontent.com/mrdoob/three.js/r180/src/renderers/WebGLRenderer.js)。

当前实际链是：

`线性 HDR 场景 RT（MSAA） → 薄透镜近似 → 可选 SMAAPass → OutputPass`

`q=1：直接显示；q<1：编码 RGBA8 RT → EASU 12-tap → RCAS 5-tap → 完整尺寸显示`

**版本细节：r180 SMAAPass 明确工作于 linear-sRGB，位于 OutputPass 前。** OutputPass 统一处理 tone mapping 和输出转换，避免天空、水体、后处理各自重复曝光或重复 sRGB 编码。SMAA 有边缘检测、权重搜索、邻域混合三个全屏阶段及中间纹理，适合比较斜树干和细叶轮廓；它不能凭空恢复未采到的细叶，也不能代替高光预滤波。MSAA 与 SMAA 是否叠加由实际帧时间和动态录像决定。[r180 SMAAPass](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/postprocessing/SMAAPass.js)、[r180 OutputPass](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/postprocessing/OutputPass.js)、[SMAA 原作者论文与代码](https://www.iryoku.com/smaa/)。

不要直接套 r180 `TAARenderPass` 到不断风动的树和海面。其源码明确没有 reprojection，适用于静态场景逐帧累积。稳定动态 TAA 还需要上帧风变形、水面位移的运动向量、反射变化处理、遮挡历史剔除与历史钳制；仅 jitter 相机并混合前帧会产生叶片拖尾、水光残影。相机停止不等于场景静止。[r180 TAARenderPass](https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/postprocessing/TAARenderPass.js)。

FSR 1 已实际接入 `upscaler.js`。EASU 重建与 RCAS 锐化接收**已经抗锯齿、tone-map 后、perceptual 色域的 [0,1] 输入**，不需要运动向量或历史帧。`OutputPass` 把编码结果写入 `NoColorSpace` RGBA8 目标：这里 NoColorSpace 表示不自动转换这份已编码数据，不代表内容重新变成线性光。FSR 两个 pass 不再做 tone mapping / sRGB 转换；输出画布保持完整尺寸，只有场景内部尺寸随 q 调整。q=1 走直接 OutputPass 分支，不执行两次超分绘制。[AMD 官方 FSR 1 输入要求](https://gpuopen.com/manuals/fidelityfx_sdk/techniques/super-resolution-spatial/)。

AMD 原始源文件、MIT 许可和固定 commit `a21ffb8f6c13233ba336352bdff293894c706575` 保存在 [vendor/fsr1/source.json](../vendor/fsr1/source.json) 与 [license.txt](../vendor/fsr1/license.txt)。移植采用 EASU 12-tap 和 RCAS 5-tap，不是普通双线性放大，也不是 DLSS 或帧生成。

[fsr-gpu-check.json](fsr-gpu-check.json) 的独立 WebGL 2 上下文读回 **6/6 通过**：平色、黑白极限、原生复制、梯度和斜边图案；无 GL / shader error。1080×675 → 1440×900、31 个非 disjoint GPU 样本测得中位 **0.118784 ms**、p95 **0.122864 ms**。计时包含两个 GPU 绘制与目标切换，排除预热，**仅代表独立超分模块成本，不是整场景帧时间或照片级画质验收**。动态细叶、闪烁高光与锐化光晕仍需场景录像检查。

## 镜头、曝光和太阳

真实镜头首先是投影、曝光和正确动态范围，并不要求强景深、色散、暗角和颗粒。广角晴天风景常有较深景深；建议先按 35 mm `filmGauge` 和约 24–35 mm 焦距建立镜头，随取景变焦；用 `setFocalLength()` 确保 UI 数值改变真实 FOV。Three 的投影相机本身不会因为设置 ISO、快门或光圈而自动改变 renderer 曝光。[Three PerspectiveCamera](https://threejs.org/docs/pages/PerspectiveCamera.html)。

曝光可使用 `EV100=log2(N²/t × 100/ISO)`，相对基准用 `exposure=exposureReference × 2^(EVReference−EV100)` 绑定。ISO 倍增、曝光时间倍增都应让线性曝光倍增；光圈值乘 √2 应减半。若只实现这个相对关系，应称物理参数驱动的相对曝光。绝对 photometric 标定还要求太阳、环境和自定义水体统一单位；不能只把太阳从约 3.6 调成 100,000 而保留旧 HDR/水体标度。[Filament 曝光、光度单位与成像管线](https://google.github.io/filament/main/filament.html)。

当前天空硬编码太阳亮度与 DirectionalLight 是相对艺术标度。太阳圆盘应维持约 0.5° 角直径，且从相机方向和像素角宽计算平滑边缘；当前 dot 阈值对应约此大小。太阳反射宽度同时来自有限太阳圆盘与波面坡度分布，不能靠夸大圆盘来抹平所有闪烁。镜头眩光应只在太阳在镜头前且无遮挡时出现；模糊/光晕不能修复不一致的照明。[NASA Solar Math 的太阳角直径](https://science.nasa.gov/wp-content/uploads/2023/09/Solar_Math.pdf)。

DOF、快门运动模糊的精确实现需要有限光圈/有限曝光时间采样；一个参数标签不能代替真实积分。若仅用深度后处理，应明确为近似，并检查透明海面深度、树冠遮挡边缘。默认宜清晰，避免把小岛拍成微缩模型。[PBRT：Film and Imaging](https://pbr-book.org/4ed/Cameras_and_Film/Film_and_Imaging)、[PBRT：Projective Camera Models](https://www.pbr-book.org/4ed/Cameras_and_Film/Projective_Camera_Models)。

## 天空、大气和照明必须共享同一个状态

代码基线的 HDR 拍摄天空只旋转方位并作暖色调节；`uCloudTime` 未在其 GLSL 中使用。它没有按太阳高度重新求散射，也没有实际云移动。该摄影天空可保留为参照或特定晴天档，但不应称动态物理天气。

较可行的演进是单一太阳状态驱动 Rayleigh/Mie 消光与相函数、太阳入射透过率、天空辐亮度和 aerial perspective。Hillaire 的方法通过低分辨率 LUT 分开处理透过率、散射、天空视图与大气透视，避免每个像素完整嵌套积分；不必原样搬整套引擎，且简化实现不能自称完整复现论文。云若使用平面密度层和 `exp(-τ)`，应称平面云层近似，不能称三维多次散射积云。[Hillaire 原作者实现](https://github.com/sebh/UnrealEngineSkyAtmosphere)、[原论文](https://sebh.github.io/publications/egsr2020.pdf)、[Epic 对 LUT 含义的说明](https://dev.epicgames.com/documentation/en-us/unreal-engine/sky-atmosphere?application_version=4.27)。

建议至少保持以下工程不变量：

- 背景、反射 skyCube、PMREM 漫反射环境和水面远距大气来自同一模型及同一太阳/天气状态；不把最终 tone-map 后的天空塞回线性环境光。
- 太阳穿过云层的透过率同时调节陆地直射、水下日照、太阳高光、叶片透光；云影随同一密度场平流，不能只让天空变阴而沙地仍晒亮。
- 云覆盖增加时通常是直射减少且漫射比例提高；用统一 irradiance 分解，避免额外 Hemisphere 再叠一层不受天气影响的强填光。
- 移动云、背景和环境可分频更新，但切换天气时立即刷新必要光照；环境探针 1–4 Hz、阴影/反射 15–30 Hz 是**待测起始值**，不是已达标配置。调太阳时用限频更新保持方向同步，避免拖动期间长时间“太阳走了、光照没走”。

这些不变量是针对本场景的工程建议。现有 grazing horizon 的低频天空补偿仍是经验近似，没有求多重水面反射的完整能量积分。

## 小范围射线效果是否值得加

现有 Snell 光线与海床高度场迭代求交已是实际几何光学求交。可选近景高度场反射可沿 `P+tR` 检测与高度图的交点，再精化命中；这只能看到高度场可表达的几何，无法由海床图得到树干/叶片的完整反射。若用屏幕深度，则离屏、被遮挡和背面内容缺失，必须带置信度并退回现有平面反射/天空。现有平面反射对离屏棕榈反而有实际优势。

建议仅作为独立质量档试验：半分辨率、近距 10–20 m、8–16 步搜索加少量精化、严格 early-out，实测无效或超预算就关闭。每步重新计算完整 35 分量波场会迅速放大片元成本；应优先采预先生成且适当过滤的高度/法线纹理。名称应为“局部高度场射线反射”或“屏幕空间反射”，不能标“RTX 光追”。该建议未实现，也没有性能保证。

## 60 fps 的验收方式与音画同步

60 fps 的预算是每帧 16.67 ms。验收需固定分辨率/DPR/画质/相机轨迹，预热后记录至少 30 s 的帧间隔 p50/p95/p99、超过 16.67/33.3 ms 的数量，以及可用时异步 GPU timer；不能只显示最近一个 FPS 或把离屏 GPU 时间当整页帧时间。计时查询需等待结果可用并丢弃 `GPU_DISJOINT_EXT` 样本，不能同步阻塞读取。[Khronos WebGL 2 GPU 计时扩展](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)。

推荐先分摊场景、双辅助视图、阴影、焦散、浅水步进、天空探针与后处理成本；优先降低昂贵辅助视图的分辨率/频率，给主视图边缘保留采样。动态分辨率应用滞回、平滑和上下限，持续超预算才降档，持续留有余量才升档。截图、调试 readback、窗口被遮挡和后台运行应另列，不能混进稳定帧时间宣称。历史桌面 144 fps 或 DPR 2 手机视口报告不等于新天气/镜头版本，也不等于实体手机结果。

旧海浪音量由与水动力无关的两个正弦驱动，不能称为物理同步。改进可以让岸边采样点的波高/速度/水位变化驱动浪声包络，风强驱动风声频谱和增益；投石声音与同一个冲击事件、位置、强度触发。使用共享模拟时钟映射到 `AudioContext.currentTime`，暂停/恢复时重建锚点；增益变化用音频自动化平滑，位置声随相机 listener 更新。这里只表示参数/事件同步，不是求解真实流体声辐射。[W3C Web Audio 时钟及 AudioParam 规范](https://www.w3.org/TR/webaudio-1.0/)。

## 后续独立 QA（无需占用浏览器控制权）

1. 源代码检查：最终输出只曝光/编码一次；MSAA 实际作用目标正确；SMAA 尺寸为实际绘制像素；暂停后所有时间状态一致；探针更新恢复 RT、viewport、clear、shadow 状态。
2. 数学检查：EV 每档比例、焦距到 FOV、太阳角直径、消光非负与透过率范围、云覆盖改变太阳透过率、日光/阴影/水体共享 uniform。
3. 根代理捕获后作独立画面审查：叶片动态闪烁、拖影、太阳轮廓/眩光遮挡、天气过渡及海天连续性；不能用静帧替代动态抗锯齿检查。
4. 读取实际新性能与 GPU 证据，核对其版本、尺寸、画质和计时范围。研究建议本身不计为通过。

## 本轮只读预审结果

新 `lens.js` 的 CPU 薄透镜函数已直接提取执行，与独立极限解和比例关系比较，**6/6 通过**：焦平面模糊为零、无穷远极限、f-number 倍增模糊减半、像素数倍增模糊倍增、半焦距物距与无穷远极限对应、极近距离有限且非负。35 mm / f8 / 对焦 10 m / 24 mm 画高 / 1080 px 时，5 m 物体与无穷远的 CoC 直径均约 0.69148 px。这只验证 CoC 函数，未验证 GPU 景深遮挡与边缘。可运行 `node verification/lens-math-check.mjs`，结果与源码 SHA256 见 [lens-math-check.json](lens-math-check.json)。

新链的静态代码符合“线性 HalfFloat + 显式 MSAA → lens → SMAA → OutputPass”；当前曝光 UI 是 compensation，并没有伪称 ISO 绝对标定。初审指出每 120 帧 GPU 抽样可能与固定频率阴影/焦散更新锁相，根代理随后改为非固定间隔抽样，并提供连续 GPU 查询和完整 rAF/CPU 数据的 benchmark 路径；真实结果仍需单独运行，不从实现推断达标。

质量控制器的实际纯模块闭环测试现为 **40/40 通过**：原有 30 项覆盖 6 s 预热、250–5000 ms 孤立 CPU stall、GPU 孤立极值、四档 `cost ∝ scale²` 反馈、最小尺度、持续负载、8 s 健康恢复/冷却、不震荡、禁用、NaN 及长时间隐藏间隔。独立测试先发现 5000 ms 单帧 stall 的 EWMA 长尾会误触降档，根代理将“持续过载”按原始 cost 计时、EWMA 仅决定降幅后，该回归通过。新增 10 项针对 rolling 帧间隔控制：孤立 23 / 5000 ms 慢帧、低于阈值的突发不降；约 8.33% 慢帧配合 10 ms GPU 负载会降档，同样慢帧配合 3 ms GPU 负载不会盲降；pacing 降档后 45 s hold 加 8 s 健康窗口再以 .025 小步恢复，GPU 很低时可提前渐进恢复。输入 delta 使用实际生成帧间隔。运行 `node verification/quality-governor-check.mjs`，结果、负载轨迹及源码 SHA256 见 [quality-governor-check.json](quality-governor-check.json)。这验证控制策略，不测浏览器真实 60 fps；异步旧 GPU 样本被重复使用仍是集成时需要考虑的条件。

另一个初审问题是旧水体只有标量太阳输入，太阳高光与叶片附加透光使用固定色。根代理已增加共享太阳 RGB 到水体透射/体散射/高光与叶片透光。

### 新天空接线复审

- 确认 `cloud-lighting.js` 在保留原材质 `onBeforeCompile` 后取最终 `transformed`，因此树的风变形进入云影世界位置；实例与 batching 变换也包含在内。PBR 直射和附加叶片透光各自只衰减一次；水的海床直射、体散射、太阳高光、泡沫也各自只乘一次同源云透过率。环境漫射没有被额外统一乘云影。
- cube 每 1/12 s 更新一面，每完整六面生成 mip，PMREM 至少间隔 2 s；当前主循环调用位置的原 RT 为 null，恢复到原目标正确。若将来嵌套到其他 cube face/mip，需要额外保存 activeCubeFace/activeMipmapLevel 并用 `try/finally` 恢复，不能把当前调用范围的正确性推广为任意嵌套安全。
- 低太阳初审发现颜色按 peak 归一而强度按 luminance 比例缩放，导致 5° 相对 RGB 额外衰减至应有值的约 .586。天空作者已改成 `sunStrength=peak*intensity`，与 peak-normalized 颜色相乘重新得到 Beer 透过率的相对 RGB。修复后 5° 为约 `[.57919,.27506,.08303]`，48° 参考为 `[1,.977,.94]`；这仍是相对标度。
- 新天空不沿用旧 HDR 的 .12 环境增益；当前 .8 PMREM 环境增益为相对校准。额外 Hemisphere 只提供沙地反弹：skyColor 设线性黑，groundColor 取 `.55 * SunRGB * SunIntensity * max(sun.y,0) * cloudShadowIsland`。Three 在 diffuse 路径把该项当 irradiance，再乘材质 `ρ/π`，因此此处不应重复除 π。全岛单值和 .55 系数是有限反弹近似，未求逐点可见性或完整间接光。
- 初审曾在交叠编辑期间读到 main 35 mm / UI 28 mm 的临时快照；重读后 main、UI、HTML 和 reset 已全部统一 **28 mm**，该冲突闭合。前面的 35 mm 数值例仅为独立测试参数，不是最终默认镜头。
- `main.js` 的音频包络现在从 `waves.js` 同一解析波分量的 phase、频散和 currentOffset 计算岸边波高/速度；它不读取 GPU 长波瞬时速度，代码已明确此边界。投石声音使用同一冲击事件并加入距离/343 的传播延迟；暂停和 hidden 状态渐隐并挂起音频上下文。

以上为只读源代码及局部数值审查，不能替代最后的 GPU 颜色、动态云形、反射、音频主观听感和持续帧时间验收。云积分条纹与形状的迭代由天空作者及根代理继续处理，未把编译成功等同于形状通过。

### 云影透过率缓存复审

优化前的 [实际连续 benchmark](render-benchmark-noon-native.json) 记录平均 77.37 fps，但 929 个帧间隔中有 130 个超过 16.67 ms，约 **14.0%**；rAF p95 / p99 为 22.4 / 26.0 ms，GPU p95 / p99 为 14.288 / 15.001 ms。因此不能由平均帧率宣称每帧稳定达到 60 帧。

`createCloudShadowCache` 将同一 `cloudShadowGLSL` 的太阳透过率在 **y=1 m** 平面生成 256² HalfFloat 数据纹理，范围为 x/z 各 ±256 m，单元 **2 m**，最多 **4 Hz** 更新。最终沙地、植物直射/附加透光及水体读取同一个缓存；天空的三维体积分保持原算法，岛心地面反弹仍用 CPU 三采样原函数。这里缓存的是透过率，保留在线性数据空间且不 tone-map；没有在已有透过率外再乘一遍云消光。

叶片高于参考平面时，沿太阳光线回投的公式 `qXZ=pXZ−sunXZ*(pY−1)/sunY` 符号正确：同一太阳射线经过高点与参考平面点，投影后可复用同一云层积分。实际代码将高度差夹为 `max(0,pY−1)`，因此低于 1 m 的水面/低沙地不作完整高度修正；水面约有 `cot(elevation)` 米的位置误差，48° 约 0.9 m、8° 约 7.1 m。这是相对宽阔云影的近似，不是对所有高度精确等价的三维射线积分。`max(.08,sun.y)` 在当前 UI 最低太阳高度 8° 内不会触发额外角度截断。

缓存另有以下边界：

- x/z 最大绝对值约 230.4–253.44 m 的环带淡出到透过率 1；远海没有完整的逐点云影，不能称全球范围准确云遮挡。若阴影恰好跨缓存边缘，需在低机位画面检查亮度环带。
- 4 Hz 更新采用保持上一张纹理，未作时间插值。默认高空平流约 2.88 m/s，即每次约 0.72 m；最高 5 m/s 海风对应约 8 m/s 高空平流，即每次约 2 m。低太阳下的形态演化还可能放大投影运动，应在实际云影边缘验证闪跳。
- 三次光线密度采样、有限纹理格、双线性过滤、平面高度回投仍是近似；缓存不提高原云密度/积分本身的准确度。若以后改变云参数，需像当前 `setSun` 一样触发强制刷新。

渲染状态恢复代码通过 `try/finally` 保存并恢复原 RT、active cube face 和 active mip level，未手动设置 viewport；Three 使用各 RT 自己的 viewport/scissor，因此避免了此前 DPR 重复缩放问题。全屏输出不 discard，目标无深度，原 clear/autoClear 值未被修改。`setSun` 即使暂停也强制刷新，普通帧由同一模拟 time 限频，时间暂停后缓存自然保持不动。该复审未占用浏览器。

复审时 `cloud-lighting.js` SHA256：`052b7e4fa5fbe7a9914c481a91c2279d47e357dc235867c87dc53d0f323e4b41`；`sky.js`：`23094d8376559328ed4c4c8437a94926eada978efecb82f43da6977da0200d4b`。后续源码变化需重新对照，不把这份静态审查当作新版本 GPU 验收。

天空绘制顺序的后续优化也通过依赖审查：将 opaque 天空的 `renderOrder` 提至海面与岛屿之后，保留 `depthTest=true`、`depthWrite=false`、远平面 `z=w`。当前水材质不透明并写深度，且从独立 skyCube 取反射，不依赖已绘制的背景颜色；天空可在已被海水/岛/植被覆盖的样本上深度失败。透明水花仍在 opaque 队列后绘制，而天空不写深度，因此不会额外遮住它们。反射视图相同，只有天空的环境探针无顺序差异。无 `discard` / `gl_FragDepth` / shader 副作用的天空具备 early-Z 条件，具体 GPU 节省仍以驱动实测为准。若以后把海水改为透明混合或读取当前颜色作透射，需要重新审查这个依赖。

根代理随后保存的 [组合优化实际 benchmark](render-benchmark-noon-optimized.json) 包含云影缓存、天空后绘制及去除冗余 canvas MSAA：平均约 **97.97 fps**、GPU 均值 **9.945 ms**、GPU p95 **11.617 ms**，比上述基线改善。但 rAF p95 / p99 仍为 **18.2 / 20.9 ms**，1176 个帧间隔中 89 个超过 16.67 ms（约 **7.57%**），因此继续增加 pacing 控制。此为组合优化实测，不能把全部收益单独归给缓存。

### pacing 控制与 FSR 1 接入后的实际记录

以下为当前桌面 1440×900 输出的具体取景和配置，不代表所有视角、实体手机或任意 OS 负载：

| 记录 | 内部尺度 / 输出 | 平均 fps | rAF p95 / p99 | GPU 均值 | 超过 16.67 ms 的帧间隔 |
| --- | --- | --- | --- | --- | --- |
| [正午海岛](render-benchmark-final-noon.json) | q=.85 + FSR 1 / 1440×900 | 114.30 | 13.8 / 17.8 ms | 8.488 ms | 30 / 1372，约 2.19% |
| [仰视天空](render-benchmark-sky.json) | q=.99 + FSR 1 / 1440×900 | 143.45 | 7.3 / 9.8 ms | 6.665 ms | 1 / 1148 |

正午记录的 p95 已低于 16.67 ms，但 p99 仍有少量慢帧；不能把“平均超 60 fps”写成“所有帧都稳定 60”。这些整场景 GPU 时间已经包含对应配置下的渲染链，不能再用独立约 0.12 ms 的 FSR 成本替代或重复相加。最终滚动 1 s 最低帧率、低太阳、音画同步和输出文件检查由根代理继续补入 [VERIFICATION.md](VERIFICATION.md)。
