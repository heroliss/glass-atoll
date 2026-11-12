# C1：同一次镜头PSF内的有限ghost/veil候选

2026-10-27。候选核心为[optical-bloom.js](../optical-bloom.js)；随后按独立授权接入lens与“镜头光晕与鬼影”复选框，main由根代理接线。**库和界面默认flare=false**，保留旧PSF；没有新增第二次bloom、全尺寸pass、光源或摄影曝光增益。

## 接口

`createOpticalBloom(THREE,renderer)`、`setSize`、`render`、`resultTarget`、`dispose`保持原接口。

- `configure(bool)`保持旧完整开/关语义，并关闭flare，避免旧调用意外启用新效果。
- `configure({bloom,flare})`更新给定布尔字段，未给字段保留当前值；先验证再原子更新，无效值不会修改当前配置。
- `state`补充`bloom/flare`、`budget`、`operatorPeakBoundRGB`和近似范围。宿主如要保持flare选择，应持续传object，不能下一帧又用旧bool覆盖。
- 两项均关闭时返回**原texture对象**，`resultTarget=null`，零draw、零目标切换。

| 状态 | 直达 | 原PSF | ghost | veil | 重分布总预算 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 仅bloom（默认） | .982 | .018 | 0 | 0 | .018 |
| bloom+flare | .982 | .013 | .003 | .002 | .018 |
| 仅flare | .995 | 0 | .003 | .002 | .005 |
| 全关闭 | 1 | 0 | 0 | 0 | 0 |

开启任一效果仍是原四层降采样+一次合成，共5draw。ghost复用t1，veil复用t3；只在原合成shader增加采样。HDR sampler显式highp，全部在线性HDR处理，没有阈值、tone mapping、sRGB编码、随机闪烁或回照场景。

## 能量与峰值边界

各ghost采用`sourceUV=.5+s*(destinationUV−.5)`，s=−.72/−.48/.86，采样乘`s²`面积Jacobian。这是扩张映射，**不允许|s|>1的聚焦**。RGB coating权重分别非负且逐通道和为1；只是作者设定，不称实测镀膜光谱。veil为t3上的s=.24扩张低通，不假称全帧平均。超出UV的采样为零；裁出的ghost不重新归一增强。

合成式为`L'=(1−b−g−v)L+bKb[L]+gKg[L]+vKv[L]`。原归一正核/双线性采样的峰值增益≤1，ghost增益≤Σw·s²，veil≤.24²。非负有限输入下，flare候选每RGB全算子峰值界约为`[.99652664,.99649208,.996484064]`，不增加既有P峰值预算；生产FP16范围仍由宿主负责，不在这里clamp源值掩盖NaN/溢出。小量舍入另由实际GPU夹具核对。

Jacobian约束使连续模型的积分在传感器裁切前守恒、裁切后不增加。离散纹理/半浮点存在误差，因此没有把连续证明当成像素计量通过：GPU夹具另测中心、离轴、边、角点总通量，并与独立double栅格参考比较，保留可测裁切损失。

**已主动找到离散限制：**double参考的131×97中心单点通量比约1.000779（+0.0779%），63×47中心约.998494；原因是继承的ceil降采样/重采样相位，即使没有半浮点也存在。原始数值已放入CPU报告的`oddSizeDiagnostic`，不能把它叫作纯FP16误差，也不能宣称任意尺寸离散通量严格守恒。当前128×96 GPU夹具只验其明确尺寸；严格L1全尺寸零增益需另行批准滤波改动。上述逐像素峰值界仍成立，未因此增加FP16 P预算。

## 核验

[CPU脚本](optical-flare-check.mjs) / [结果](optical-flare-check.json)：**12/12通过**。包含bool兼容/配置原子性、四组合预算、RGB权重、独立连续Gaussian积分、double纹理参考、边角点裁切、峰界与P补偿。第一次配置边界失败保留在[optical-flare-first-candidate.json](optical-flare-first-candidate.json)：显式undefined被默认值吞掉，现已在配置入口拒绝。

[实际GPU入口](optical-flare-gpu-check.js)：`await runOpticalFlareCheck(THREE,renderer)`。优先复用主代理提供的现有上下文，不改canvas尺寸/DPR，结束后保留context并恢复调用者状态；只有未传第二参才自建不挂DOM的上下文。根代理已在生产renderer实际执行，证据[pyro-r2-final-gpu.json](pyro-r2-final-gpu.json)的`flare`：**22/22通过，outerStateRestored=true，shader/GL/errors均空**。

- 实际编译保留的旧PSF[A源码](optical-bloom-c1-baseline.js)与默认候选逐像素比较。
- HDR平场≤输入、黑0、中心/离轴/边/角点总flux及crop、真实ghost响应、峰界、P补偿。
- 开启、异常、cube face4+已分配mip1的target/viewport/scissor/read-FBO状态恢复；关闭精确旁路。
- 最外层`outerStateRestored`另作为总gate：恢复逻辑与实际rect、目标metadata、read-FBO/packbuffer、debug、XR/shadow开关及render统计。传入的renderer绝不dispose或forceContextLoss。
- 使用RGBA16F中间纹理并复制到RGBA32F计量；像素/总flux容差明确包含半浮点存储和硬件过滤误差。不把readback墙钟当GPU成本或FPS。

独立反审实际数字：flare关闭与保留的原PSF最大差**0**；受测中心/离轴/边/角点通量比约.99463–.99899，峰值均未超过输入。2048平场实际输出2040，低于连续界约.0434%（半浮点存储/运算差异已在容差内），没有通过增亮伪造HDR。混合场输入峰值`[4096,1,256]`、输出`[4024,.98974609375,251.5]`，无负值或非有限值。P=−4/+8补偿最大绝对差分别9.5367×10⁻⁷、5.9372×10⁻⁸。异常draw及cube face4+mip1恢复也有实际检查。此反审未发现需要再改核心源码的失败；仍不外推为全尺寸严格L1守恒或实测镜头。

## 独立成本入口

[optical-flare-benchmark.js](optical-flare-benchmark.js)导出`runOpticalFlareBenchmark(THREE,renderer,options)`。复用现有生产context，按实际drawingBuffer尺寸建立同一份静态非均匀RGBA16F HDR输入；原PSF bloom-only对候选bloom+flare，默认8对暖机、32个有效查询/组，逐pair平衡A/B和B/A顺序。CPU render-call提交墙钟和真实`EXT_disjoint_timer_query_webgl2`GPU时间分别报告mean/median/p95及原始样本；源生成、probe、暖机、poll和readback不进入查询。

默认15s总上限与4s单批poll上限，disjoint/timeout/缺扩展明确无效，不以CPU数替代GPU；不resize、新建或销毁调用者context，finally恢复target/face/mip、逻辑/实际rect、read-FBO/packbuffer、debug、XR/shadow、clear/tone状态及render统计，并检查临时资源释放。宿主应在普通渲染暂停且没有active query时调用。

主代理已实际执行，证据[optical-flare-benchmark.json](optical-flare-benchmark.json)：1209×1292，同一HDR纹理，各32个有效查询，AB/BA首位各16，状态与资源计数完整恢复，shader/GL错误为空。

| 范围（毫秒） | 原PSF mean / median / P95 | 新bloom+flare mean / median / P95 |
| --- | --- | --- |
| EXT GPU elapsed | .07903 / .06963 / .17818 | .37315 / .33894 / .84378 |
| CPU render-call提交墙钟 | .04687 / 0 / .20000 | .43750 / .40000 / .90000 |

新增GPU mean约.2941ms、CPU提交mean约.3906ms，**不是零成本**。两种时间可能重叠，不能相加成整帧成本。GPU query包括整render内的状态保存/恢复；若提交被同步state读阻塞，GPU elapsed可包含队列空泡，不应把全部差额叫作纯shader ALU。源码相较旧版增加3次`getParameter`、1次`isEnabled`及read-FBO/readBuffer恢复，它们也是CPU/驱动同步成本的可能来源，尚未做逐调用归因。

旧CPU median为0，反映浏览器计时量化；JSON中的medianRatio=null来自除以零后序列化，不能解读倍数。报告保留原样，没有为了通过而改变计时。新增state读取在bloom开启、flare关闭时仍存在，因此默认flare关闭只避免额外ghost/veil采样，不能据本对照声称已恢复旧版全部CPU成本。此为孤立PSF成本，不是整场FPS或普适硬件保证。

候选SHA256：`52508e641fda1aec9594444c583f2523f9285e7dfec67ca7a25fa0157a2b9601`。旧baseline SHA256：`4bf96b00252cf79403a865b3d35b902c2aa8dcb9732c4dab4169ac96c1aaca63`。

## 物理范围

[Hullin等的原论文/作者页](https://resources.mpi-inf.mpg.de/lensflareRendering/)讨论了镜片间反射、像差和镀膜对flare的影响。本候选只借用“镜头内杂散光重分配”的物理动机，**没有实现该论文的镜组追迹或标定镜头**。

只从已可见的HDR成像取样；真实被挡、脑后或离屏源若没有进入输入，就不会凭空生成光晕。黑输入夹具验证的是这个边界，不是本模块做了几何遮挡求解。均匀场会因有限传感器crop稍降，不用增益补回。没有光圈衍射星芒、真实镜组变焦响应、传感器饱和或离屏入瞳路径。真实画面A/B、成本和是否值得默认启用仍交由主代理下一阶段判断。
