# R17：天空、大气、环境照明与渲染后端评审计划

状态：调研/方案，未实施运行代码变更；未创建浏览器或GPU上下文、未运行GPU测试。R16当前运行源保持冻结，先由主代理完成新打包、有效partial范围与native回归。本文不是性能验收或迁移承诺。

## 判断

目前保留Three.js/WebGLRenderer作为正式基线最合理。不能说Three.js在所有项目里“最好”，也不能从WebGPU更新推导这个场景一定更快。这个项目已经包含大量经过实际验收的自定义光学、覆盖率、历史缓冲、浮点范围和反射逻辑；其中主要成本来自算法、采样、分辨率、数据组织与同步，而不是引擎品牌。

WebGPU值得做隔离原型，特别是大规模烟雾/发光源计算、存储缓冲和直接HDR呈现。但当前项目不是替换构造器就能迁移。先证明哪部分受CPU提交、GPU算术、带宽、透明覆盖或同步限制，再决定是否有足够收益支持迁移成本。

本地vendor为r180。本次查询官方最新公开release为[r186，2026-09-24](https://github.com/mrdoob/three.js/releases/tag/r186)。这是查询时结果，不是升级指令；r180后端迁移、Three版本升级和光学模型修改应分别A/B，避免同时改变三个变量。

## 证据分级

### 已有实际证据

以下由主代理在同一实际renderer取得，本子任务没有重新运行：

- R16两场完整烟花，main/mirror各3456可见源、48烟包，GPU透射路径有效且CPU mediumQueries=0，GL错误为空。
- 256实际源的native透射检查7/7，最大physical T误差约1.267e-6，主要来自输入量化。
- 优化前一次冻结3秒样本：CPU43.7ms、外层GPUtimer27.65ms、FPS20.3。它属于旧pack/调度状态，不能作为新版本最终帧率，也不能归因于天空或PMREM。外层计时不足以区分局部算术、上传、CPU提交间隙和驱动等待。
- 天空/海平面四组实际图表明，dawn黑带在finite-air关闭后仍存在；漫射天空候选只能部分改善。性能优化不能顺便掩盖这项视觉问题。

本领域目前缺少sky、cloud、capture faces、mipmap和PMREM的独立实际GPU时长。下文的热点是代码证据/待测假设，不写成已测瓶颈。

### 源码可以确认的结构

| 模块 | 当前行为 | 确定的风险或约束 |
|---|---|---|
| CPU天空照度 | `main.js`每rAF调用`setCelestial`；`sky.js`无条件清`skyLightingKey`，随后solar/moon各16方向×8段积分 | 相同天体输入也使cache失效，至少256积分段及大量exp/Chapman计算重做；实际毫秒占比待profile |
| 主天空 | 球面Rayleigh/Mie/ozone单次散射，默认8段；半球漫射为一轮近似 | 不等同完整多次散射LUT；换后端不自动提高物理准确度 |
| 云 | 32次weather/support探测，随后中档64段view march；有密度处再取3次light-depth密度 | 每次density本身含多次3D/2D取样；成本随覆盖、视角和透射early-out变化，不能只乘固定样本数估算 |
| 云support开关 | 探测循环仍执行，开关只决定是否缩小view区间 | “关support”不是去掉32次probe的成本测试，测试解释必须准确 |
| 天空遮挡 | far-depth天空在opaque之后绘制 | 已有early-depth机会；不能假定天空shader总覆盖全屏，也不能直接把MSAA8理解为云着色成本8倍 |
| 水反射 | 普通反射buffer隐藏完整sky，透明像素由水shader取skyCube补齐 | 常规水反射不会再完整march一遍普通天空；烟花transient-cloud反射delta是另一个条件性通道 |
| 环境 | 双256²RGBA16F cube、12faces/s、六面完成后发布；PMREM最多约每2秒生成 | 平均face预算受控，但clock/weather强制refresh可同一帧绘六面并做PMREM，形成尖峰 |
| 光照空间 | 环境capture默认固定[0,2,0] | 与高机位/远处水面不是同一空间辐亮度场，是视觉近似；单纯调更新频率不能修正 |
| 环境曝光 | cube/PMREM保留自己的capture P，通过2^(sceneP-captureP)使用 | 不可改成跟随瞬时相机C；不可因烟花峰值重烘焙环境后再重复乘P |
| 瞬时烟花 | captureSnapshot默认剔除transient，main和镜像另绘delta | 已避免把闪光污染长期PMREM；不能为“实时GI”盲目每次爆炸重建PMREM |
| HDR呈现 | WebGL线性浮点目标→float drawingbuffer→WebGPU外部图像copy；备用PBO读回/上传 | 外部copy不是承诺零拷贝；备用路径确实经过CPU；需分别计时而非混成一个HDR开关 |

按纹理几何计算，两个256²、六面、RGBA16F、完整mip链cube约8MiB，未含驱动padding、PMREM和其临时目标。PMREM应从实际target尺寸/类型计数，不把普通mipmap当作等价的roughness预滤波。官方[PMREM说明](https://threejs.org/docs/pages/PMREMGenerator.html)也将其区分为按材质粗糙度使用的环境预滤波。

## 先做的性能审查

### 1. 固定工作负载与计时边界

保留当前renderer、qaRenderLock和实际图像配置，禁止并发上下文或重新启用曾造成图形中断的support9bb。记录分辨率、DPR、MSAA、云步数、sky步数、环境face/PMREM revision、native HDR模式和显示transform。

覆盖白天/日落/夜晚；晴空/默认云/高云覆盖；海平线/天空占比高/树冠近景；无烟花/相同冻结烟花烟尘。一次只动一项，先小尺寸功能gate，再在同renderer做有界原生场景对照。

分开记录CPU阶段和独立GPU阶段：

- CPU：`setCelestial/lighting`、环境snapshot/调度、cube publication、PMREM提交、HDR enqueue/present。
- GPU：主天空、每个实际cube face、mip生成、PMREM、transient云delta、HDR最后绘制与copy。若嵌套timer不可用，使用互斥标记或不同固定轮次；不增加gl.finish等同步来测快慢。
- 输出中位数、p95、实际pass数量/像素尺寸和定时器有效/disjoint状态。不能把单次平均FPS当作某个shader的成本。

### 2. 第一候选：相同输入不破坏CPU照度cache

只在天体/光源/气溶胶/恒星平均照度等实际依赖改变时重新算irradiance。优先复用现有完整数值key，避免另建低精度太阳角量化或减少积分点。这样相同输入可保持逐值等价，不改变GPU或画面。

反审：不能仅按UTC秒数、physicalRevision或P缓存。太阳/月亮方向、月亮亮度、太阳距离、Mie、恒星平均能量都可能变化；冻结snapshot期间的uniform与live cache也必须恢复。测试应覆盖暂停、多次相同setCelestial、连续白昼、dawn快切、月亮接管、天气变化以及snapshot finally恢复。

### 3. 有GPU数据后才选云/环境候选

- 若主云占主导：先检查early-out、support命中效率、view/light density重算及空覆盖区，不先降低默认分辨率或再引入逐帧随机采样。稳定细叶/高光已有历史问题，新增temporal云重建必须单独证明不拖影、不闪烁。
- 若CPU/face尖峰占主导：预编译所需变体、限制非交互更新的每帧工作；保留完整六面冻结snapshot和原子发布。强制时间跳变的延迟策略必须明确，不能拼接不同时间的cube faces。
- 若PMREM占主导：可研究与water cube分离的PMREM尺寸/更新率，但必须验证粗糙面能量、金属/湿沙/树叶间接光和曝光独立性。不要以raw mip替代PMREM并宣称等效。
- 若HDRcopy占主导：先比较现有float-copy与SDR同场景时长，确认瓶颈确实在呈现桥。迁移到nativeWebGPU才有消除跨API最后copy的机会；不能把此机会算成已获得收益。

## Three.js与WebGPU的官方能力边界

[WebGPURenderer官方文档](https://threejs.org/docs/pages/WebGPURenderer.html)说明其默认尝试WebGPU，并可回退到它自己的WebGL2 backend。这不是原有WebGLRenderer的透明替身。官方[ShaderMaterial文档](https://threejs.org/docs/pages/ShaderMaterial.html)将其限定于WebGLRenderer；[Material文档](https://threejs.org/docs/pages/Material.html)也将onBeforeCompile限定于WebGLRenderer，并推荐Node Material/TSL。

因此本项目sky/water/fireworks/烟尘/lens/aerial的GLSL，以及tree/sand/local-light的onBeforeCompile修改，都需要明确移植或另建对应Node/TSL/WGSL实现。不能假定换成WebGPURenderer后旧GLSL会自动转译，或forceWebGL能继续运行旧自定义管线。

当前r180本身已有[WebGPURenderer双backend源码](https://github.com/mrdoob/three.js/blob/r180/src/renderers/webgpu/WebGPURenderer.js)、[NodeMaterial的vertex/fragment/MRT接口](https://github.com/mrdoob/three.js/blob/r180/src/materials/nodes/NodeMaterial.js)、[MRT例子](https://github.com/mrdoob/three.js/blob/r180/examples/webgpu_multiple_rendertargets.html)和[compute例子](https://github.com/mrdoob/three.js/blob/r180/examples/webgpu_compute_particles.html)。这些证明能力存在，不证明当前效果可以免移植或更快。

### 迁移影响表

| 当前实现 | WebGPU对应方向 | 代价/风险 |
|---|---|---|
| GLSL ShaderMaterial/RawShaderMaterial | NodeMaterial/TSL或明确WGSL函数 | 光学数学、宏、插值、纹理LOD、导数和精度逐项迁移；若要双backend需避免只支持WGSL的核心依赖 |
| onBeforeCompile树叶/沙滩/局部灯 | 对应NodeMaterial位置、法线、薄叶透射、局部光/阴影节点 | 不能遗漏旧材质定制及运动/覆盖率MRT输出，否则画面“能跑”但已变样 |
| MRT4附件/历史元数据 | RenderTarget+MRT node/显式pass输出 | 校验附件格式、对齐/每像素预算、MSAA coverage以及history语义，不只验证RGBA颜色 |
| WebGL MSAA8 | WebGPU1或4采样+重新验收时域/空间AA组合 | [WebGPU规范](https://www.w3.org/TR/webgpu/#multisample-state)的multisample count为1或4；当前中档8x不能照搬，边缘稳定须重新证明 |
| 纹理中的数值数组与VTF | textureLoad/instance_index，或storage buffers | storage可减少纹理寻址/打包，但GPU计算顺序和Float32结果仍需独立oracle，不自动恢复CPU精度 |
| fragment map/reduce计算烟雾/波场 | compute storage buffers/textures、可选workgroup reduction | 有机会减少FBO/pass/CPU打包；分组/缓存/工作量决定收益，逐项raymarch/exp并未消失 |
| GL framebuffer/depth blit与state恢复 | 显式render/compute pass、资源usage、depth读取/resolve | WebGL与WebGPU坐标/深度约定不同；镜像clip、depth重建、遮挡和MSAA深度resolve不能原样复制 |
| 双cube+PMREM同步publication | Node天空capture+common PMREM，先初始化/预编译并冻结完整job | r180[common PMREM源码](https://github.com/mrdoob/three.js/blob/r180/src/renderers/common/extras/PMREMGenerator.js)有异步初始化接口；不能在现有同步withSnapshot内部await而泄漏全局uniform状态 |
| HDR单向WebGL→WebGPU桥 | 同WebGPUdevice从线性HDR目标经过最终display transform直接呈现 | 可以去掉该跨APIcopy，但须重建同等色彩/曝光/peak-nit/显示白点语义，不能重复tone map |

[WebGPU规范](https://www.w3.org/TR/webgpu/)要求按实际adapter/device检查limits和features。现4附件基础字节约19B/sample尚不等于最终合法pipeline：还需检查每格式renderability、sample count、布局和总预算。Float32纹理可读不等于可线性过滤；float32-filterable、float32-blendable、shader-f16和timestamp-query都不应假定无条件可用。数值τ/反射/FP16储存P尤其不能为了“半精度更快”统一降成f16。

### HDR应如何迁移

Chrome的[WebGPU129官方说明](https://developer.chrome.com/blog/new-in-webgpu-129)给出了rgba16float与extended toneMapping的HDR canvas配置；规范的[canvas configuration](https://www.w3.org/TR/webgpu/#canvas-configuration)定义其呈现语义。当前主机已经实测能使用WebGPU HDR呈现，但这不代表所有浏览器/显示器都具备相同链路。

native迁移应保持：物理scene-linear RGB→一次存储P→输出前抵消P、应用一次相机C/补偿→一次SDR/HDR显示变换→正确颜色空间及extended canvas。灯光、云、海面、粒子都不能提前剪成[0,1]。

当前WindowsDXGI报告的peak/SDRwhite仍是系统元数据，不是光度计校准。标准WebGPU能力检测不等于自动获取准确显示器nit，Three的HalfFloat内部buffer也不单独保证HDR输出。保留SDR fallback、device-lost处理和实际canvas/最终显示变换数值验收。

## 三轮反审后的迁移建议

1. **“WebGPU较新，所以全换会快。”** 推翻。CPU数组分配、每帧cache失效和相同云积分不会因为后端名称消失；我们已经见到GPU透射有效但总帧率仍低的实例。先修可证实的数据与调度问题。
2. **“只把烟雾compute移到另一WebGPU device，再送回现有WebGL。”** 暂不采用。现有HDR桥只是最后图像单向copy，不提供通用GLtexture/GPUBuffer共享保证；读取T回CPU再上传WebGL会重新引入同步和带宽。除非有实际互操作证据，否则不能将其视为低成本优化。
3. **“先把正式renderer改掉，再逐个修shader。”** 推翻。旧材质接口不兼容，加上MRT、1/4采样、depth/clip和HDR差异，会产生大范围回归。先做受控原型和明确go/no-go，正式基线保留。

推荐后续顺序：

- R17A：完成当前WebGL分阶段性能/画质基线，修同输入照度cache等低风险CPU问题。
- R17B：独立小原型复用相同天体/天气/曝光参数和CPU光学oracle，先实现Node/TSL sky-only，再加cloud；比较输出误差、实际GPU时长、初始化/编译、分辨率斜率和device支持。
- R17C：若B确有收益，再试同device烟尘compute+instanced draw和nativeHDR。必须证明减少了当前真实瓶颈，而不是将成本换成copy/提交/编译。
- R17D：只有上述原型得到可靠收益且用户接受范围后，才扩展海水/叶片/镜头/完整MRT/反射。保留WebGL已验证版本作为可切回路径。

每一阶段都以相同光照、尺度、RTE语义、质量和工作负载对照；不靠降低默认云/阴影/采样质量制造“引擎性能提升”。绝对帧率仍按用户要求作为参考，优先透明呈现画质与成本。

## 资料与交付核对

资料为2026-10-29本次HTTP读取的官方文档、Three官方tag源码及W3C规范；原始提取与URL/失败记录在`r17-primary-research/manifest.json`。尝试的WebGPU-Migration-Guide URL实际回到wikiHome，已标为不可用；两个ChromeHDR猜测URL为404，也没有用于结论。所有迁移结论优先依据实际可读的官方ShaderMaterial/Material、r180源码和WebGPU规范。

本任务只新增方案与调研材料，没有修改sky/environment/HDR/renderer运行文件，也没有开启GPU实验。
