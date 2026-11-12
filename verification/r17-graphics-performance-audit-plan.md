# R17 图形性能只读审查与验证计划

审查日期：2026-10-29。范围：水、海浪、沙滩、植被、间接光、阴影、几何、镜头、HDR、CPU/GPU 数据流。大气/云/烟花自身的专项审查由其他代理补充。

本轮只读取源码和已有原生报告，没有运行 GPU、创建渲染上下文或施加压力，也没有修改运行代码。以下区分“已有测量”“确定的源码工作量”和“待测候选”；源码工作量不等于硬件耗时。已有数字是原生 QA 的仪器记录，未在本轮重测或通过 game-dev sealed bundle 重新准入。

## 1. 当前管线与决策

主场景是本地 **Three.js r180 + WebGLRenderer / WebGL2**：`vendor/three.core.js:6`、`main.js` 的 `new THREE.WebGLRenderer(...)`。另有一个 WebGPU canvas 用于 HDR 呈现桥接；它不代表场景已经由 WebGPURenderer 绘制。

合适的近期方向是：完成已经测出的 CPU 热路径修复，保持数值/色彩/时序一致，再按 pass 找出 GPU 成本；让适合并行且结果直接供着色器消费的工作驻留 GPU。把所有工作改成 GPU，或者直接替换引擎，均不能保证提速。少量交互查询、双精度时间/坐标、事件调度、声音和低频小型缓存可继续在 CPU，避免为了 CPU 消费结果而增加读回。

Three 官方把 WebGPURenderer 定位为支持 WebGPU、并能回退 WebGL2 的新渲染器；TSL/node material 和新的后处理是其迁移路线。现有 ShaderMaterial、RawShaderMaterial、onBeforeCompile 自定义实现需要移植，不能只替换构造器。[官方迁移说明](https://threejs.org/manual/pages/webgpurenderer)

因此，**保留当前可验证的 WebGL2 基线；WebGPU 做独立且可退出的验证分支**。没有这一个场景在相同设备、相同画质下的对照，不能声称 Three、Babylon、Unity 或其他引擎中某一个“最好/最快”。

## 2. 已有证据及不能作出的推断

| 证据 | 已经支持的结论 | 不支持的结论 |
|---|---|---|
| R16 两发、48 smoke packets、3456 条可见源，CPU 列积分 query 179712/52 draws，累计 1883.5 ms | 旧逐光点烟尘透射约 36.22 ms/draw，是明确 CPU 热点；物理烟尘密度模拟并非这个瓶颈 | 不能由此认为烟尘生命周期/扩散也必须迁到 GPU |
| `r16-native-two-gpu-profile-summary.json` 的前 3.6 秒 | 旧 GPU 批量方案打包 main+mirror inclusive 635.9+622.8 ms，self 610.9+589.1 ms；约占窗口 35%。getParameter 多个栈合计约 0.3 s 是次级成本 | 不能把 water.render / lens.render 的 inclusive 耗时直接归因给水着色/镜头 shader；它们包含反射/主视图烟花打包 |
| `r16-native-two-gpu-benchmark.json` | 当时两视图均为 GPU 3456 instances、CPU mediumQueries=0；62 帧、3.05 s，20.32 FPS、CPU median 43.7 ms；这是修复旧 pack 之前的记录 | 外层 GPU query median 27.65 ms 不是孤立透射 kernel 时间，不能据此断言已纯 GPU 受限或承诺最新版本 FPS |
| R16 scalar pack 离线逐字节复放 6/6 + pack 契约 8/8 | 新 pack 消除了源循环的临时数组/typed views，旧新 packet/source buffer、元数据、错误域完全一致 | Node packing-only 提速不等于原生画面提速；须等 root 的新原生接收报告 |
| `r17-user-state-before.json` | 已保存的中档状态：1209×1292、8×MSAA，HDR `float-canvas-external-copy`、readback=null；主不透明场景统计约 2137290 triangles / 36 calls | 此状态是暂停且缓存后的状态；fps=0、旧 gpuMs 和最后一次 sceneStats 都不能当作当前持续帧率或全帧 GPU 成本 |
| 文件名 `r16-native-two-same-view-cpu-benchmark.json` 的旧采样 | 已查出 main/mirror instances=0、no-source-records、不同 time/pose；root 已另存 invalid 记录 | **排除其 79.78 FPS**，不可与两发 GPU 结果比较 |

R16 新 scalar pack + active-partial viewport 的实际接收由 root 顺序运行；本审查不替代那次验收。也不把冻结场景的精确缓存收益冒充正常运动时收益。

## 3. 哪些已经在 GPU，以及下一步能优化什么

| 系统与入口 | 现有实现/缓存 | 后续候选、代价与证据级别 |
|---|---|---|
| 海浪 `spectral-waves.js:6–55` | 4 张 RGBA16F、带 slope-moment mip 的 GPU Fourier 场；256 个模式、每 band 64 个。相同 physical time 跳过重绘。CPU 只更新双精度包裹相位，避免长期运行精度衰退 | **确定工作量**：4 passes；1024 比 256 是 16 倍 texel 数。先测各分辨率 GPU 时间。小型精确候选：预存固定 omega，避免每帧 256 次 sqrt/tanh；预计不是主收益。FFT/compute 只有在扩大模式数/已测热时再评估，不能把算法更换当同等画质免费优化 |
| 潮流/扰动 `hydrodynamics.js:190,225,348–369` | 384² GPU ping-pong 线性浅水求解，固定 dt≤1/120，每 substep 两个全屏 pass，最多 12 steps/update。静态潮流 pressure projection 在 CPU 初始化一次，交互 sampleFlow 读 CPU 场 | **确定工作量/待测**：运行时可能每帧多个 substep；记录 lastUpdateSubsteps 与每 pass GPU 时间。合并两子步必须重新证明 staggered 依赖/CFL，不能盲合成一个 pass。CPU 初始化可转 Worker/缓存以改善启动；不值得为了很少的碰撞/落叶查询引入 GPU 读回 |
| 海岸候选 `shoreline-dynamics.js:181–238` | 有 GPU wet/dry 保守求解候选，每 fixed commit reduction 后同步读 1×1 验证 CFL/体积；源码已明示 stall | **当前未接入 main**；不是当前每帧卡顿原因。未来准入前应设计非阻塞验证/提交边界并保留事务守恒，不能只删校验或宣称 async 函数消除了同步 |
| 水几何 `water.js:324–345`、`ocean-geometry.js` | 静态 640×640 分段网格，819200 triangles；同一网格外环指数伸展到曲率远海，无新增远海场景 pass。GPU 顶点位移 | **强代码候选**：以投影误差控制 clipmap/分块 LOD、近景密、远景稀，保留同一物理 surface/curved datum。需测顶点瓶颈；验证自由机位、近岸轮廓、地平线和时间连续性，不能只按离岛距离裁掉近相机海面 |
| 水捕获 `water.js:402–440` | 折射辅助 RT 已只画 layer 1 小型水下物体；海床直接 world-space 求交着色。反射绘制一次不含天空的镜像场景，再绘制 finite effects；天空在水 shader 中只加一次。中档 reflectionScale=1、MSAA=2 | **已优化部分应保留**。待测镜像几何、烟花、烟尘分别成本。可试 conservative reflection frustum/caster LOD；低频重用反射必须带相机/波面/发光/遮挡失效和 reproject/disocclusion，烟花高光时不应复用旧帧 |
| 水像素 `water.js:141–240` | GPU Beer–Lambert RGB extinction、折射海床、Fresnel/反射、阴影/焦散/局部光；最多 36 个水下物体 bounds，先解析球相交，命中后 4 probes+6 bisections 读辅助真实 RGB/depth；无每像素 CPU query | **待测**：近海全屏复杂 shader / 更多石头时的局部光与 bounds 循环。可做保守屏幕 tile bins/实际启用光源掩码、误差受控海床求交；不能以固定 opacity 替代距离吸收，也不能删水下石头或反射遮挡 |
| 焦散 `caustics.js:120–150,194,221–290` | GPU 顶点折射真实波面，3 次 receiver 修正，fragment Jacobian 光束聚焦；mip 过滤。中档 1280² 网格=3276800 triangles/update、最高 24 Hz，RT1536² | **强代码候选**：测实际 GPU成本后，按可见海床/光贡献对 source domain 作保守裁剪，接触/交互区域增密，缓存完全相同时刻。不是去掉焦散。当前 keyDirection 包括夜间月光，不能简单用太阳在地平线下就关闭；零贡献 gate 必须用实际光源/曝光和界限。降 grid / Hz 是画质选项，需检查聚焦能量、闪烁和时间采样 |
| 沙滩 `sand.js:151–230,235–263` | 静态 CPU micro-relief/法线/碎片生成；碎片 InstancedMesh。运行每帧只是时间和 caustic uniform。颗粒/湿度/roughness 主要 GPU，已有纹理导数/footprint 过滤 | **保持已有 GPU 路线**。启动生成可缓存/Worker；shader 噪声和同样沙底在水下重算需分 pass 计时。用预烘焙纹理替换程序细节可减少 ALU，但增加带宽/重复和纹理精度风险，不能未经 A/B 当必然更快 |
| 树木 `vegetation.js:31–53,248–372,534–604` | 约 6 类 merged mesh，层级风摆与前一帧解析风姿态在 GPU；CPU update 仅 windTime uniform。mipmap/trilinear/anisotropy8；匹配 wind 的 shadow-depth shader。保留两套 palm 几何供 A/B，未显示的版本主要占内存 | **强代码候选**：基于投影 coverage 的枝叶几何/阴影 LOD、保守分块裁剪；远景合并叶片需保留 coverage、透光和 temporal velocity。mipmap 不能过滤几何轮廓，不能靠模糊解决细叶闪烁。共享高度/leaf texture 已 GPU 化，无需 CPU→GPU 重写每片叶子。验收后可选择释放不再需要的 A/B几何，现阶段不能擅删用户保留的候选 |
| 间接光 `indirect-lighting.js:238–345` | 18 probes / 216 coefficients，low 1 bounce 2 Hz、high 2 bounce 4 Hz；几何可见性/transfer 初始化后缓存。6 local sources 的单位响应缓存，只改 RGB 时复用，GPU 材质采样 SH | **待测、低优先级迁移**：用 lastUpdateMs / transient.lastUpdateMs 分离真实 solve；整段 photometry 时间不是 GI 时间。先复用小数组、缓存完全相同请求。GPU probe solve 可行，但这种小/低频矩阵的迁移开销可能更大，且 CPU 仍需要照明界。它不是全路径追踪，也没有真实水界面多次反弹 |
| 阴影 `shadow-quality.js:1–34` | 单一稳定世界 caster atlas，texel snapped，固定 cached grove bounds；默认4096。具体中档 preset 45 Hz、4096（独立 shadow level 本身60 Hz）；仅 size/quality 变化才 dispose/realloc | **待测/可选质量**：caster vertex 与大 atlas fill。保留用户要求的默认4096；分离静态/动树 caster、coverage误差限定 shadow LOD、夜间实际零光贡献跳过是候选。只缓存太阳不动却忽视树在动会冻结树影；降低 Hz 要验证树影阶跃。8192 相比4096像素数4倍，不代表必然4倍帧耗时 |
| 环境 `environment-capture.js:29–31,140–193` | 256² 双 cube，frozen snapshot 保证六面一致；12 faces/sec 预算，PMREM 至少2秒间隔，物理天空/太阳角变化触发，预曝光分开标记 | **已有调度保持**。测峰值而非仅 median；避免曝光变化无谓重捕获、六面同帧峰值。初始/显式 refresh 的同步六面成本与平稳运行分开。异步 shader warmup / 工作切片可减少首次卡顿，不把缓存变陈旧当帧率优化 |
| 镜头/AA `lens.js:170–203,285–340` | 一次 opaque MRT 同时输出 radiance、风运动/coverage、foliage depth、reactive，避免额外全场 motion pass；GPU temporal + aerial + thin lens + bloom(5passes) + SMAA。暂停样本稳定后复用 history/最终画布 | **确定带宽工作量/待测**：四 MRT 共19 colour bytes/pixel，MSAA8增加写入/resolve与存储；已缩为 R16F/R8 的通道不能再笼统建议“改小格式”。后续逐通道精度证明、pass fusion/有效域裁剪、按动态对象 reactive mask 是可选。MSAA、temporal、SMAA解决问题不同，不能把同时启用直接叫冗余并删除 |
| HDR `hdr-output.js:256–307,373–407` | 原生有效路径：浮点 WebGL canvas → copyExternalImageToTexture → extended rgba16float WebGPU canvas，无显式 CPU读回。兼容 fallback：3-slot PBO+fence，ready后 getBufferSubData→writeTexture | **明确区分路径**。保存用户状态走 fast path、readback=null。跨 API copy 也可能有 GPU传输/同步，非保证零拷贝；fallback 的异步等待不消除全帧 GPU→CPU→GPU流量。测 HDR/SDR 时必须固定曝光、输出变换和相同输入，不能靠夹成 SDR 获得虚假性能 |

## 4. CPU/GPU 往返、分配及缓存优先级

### 已有热点：先完成，后重新采样

1. **烟花源透射 GPU 批量 + scalar pack**：结果纹理由 gl_InstanceID 直接消费，effective GPU 时应维持 mediumQueries=0。不读回 T 给 CPU。新 pack 只改数据打包而不改 Double 运算/两次归一化/fround 顺序，已有 bytewise 检查；以 root 新原生报告决定是否默认。完整质量 gate 仍包括 main/mirror、近水路径、source ordering、same-target feedback 和错误回退。
2. **保守有效区域**：新 active-partial viewport、椭球投影和 source cull 是减少确定无贡献工作的正确方向。它们与降低烟量/寿命/亮度不同；必须继续以原物理快照和误差预算验收。

### 低风险可做，但优先等新 profile

- `water.render` 的 `new THREE.Color().clone()` 每次两次临时对象，可复用 scratch；`lens.render` 的两处 `groups.map`、`lastJitter=[0,0]` 是很小的 per-frame 分配。海浪固定 omega 可初始化计算。这些是准确的源码候选，**不能承诺明显 FPS收益**。
- 不要把所有 `new` 都当每帧：RT、静态网格、叶纹理、steady projection 大部分只在创建/质量/resize 时发生。Three 的 RenderTarget.setSize 只在尺寸变化时重新分配；主 resize 另有 intentional temporal reset。自动分辨率当前关闭，不能把它当正在每帧抖动分配的原因。
- `setSubmergedObjects` 每帧组装/校验最多36个 bounds、有 unchanged 检查；可用可信 revision + immutable snapshot 降分配，但不能在调用者仍可变时信任旧 revision 跳过更新。其规模远小于旧数千源 pack。
- 能力/格式支持等固定 GL 查询可初始化缓存；Vector4/array scratch 可复用。**实际 READ/DRAW FBO、MRT drawBuffers、physical viewport/scissor 不可直接从 renderer logical target 猜出**。要消除重复状态查询，应先建立受控 frame-graph/restore-token 所有权，不是删 `getParameter`。
- `depth-copy.js:31–55` 是 GPU depth blit/resolve，非 CPU读回。格式/尺寸缓存已经存在；完整性检查/SAMPLES 查询可在 resize/generation 边界缓存，但前提是缓存键包含真实 FBO/format/sample/context generation，并保留故障验证路径。
- shader compile 的前台卡顿另测：目前主要材质依赖 uniform，quality/defines 改变才 needsUpdate。r180 有 `compileAsync` 可用于已知变体预热；不要每帧 compile，也不要用隐藏未受控第二 context 测试。[WebGLRenderer 官方 API](https://threejs.org/docs/pages/WebGLRenderer.html)

### 读回清单：不是都在每帧发生

| 位置 | 用途/频率 | 处理 |
|---|---|---|
| `lens.pickFocus` | 用户点击时 1×1 深度读回 | 保留交互精确性；若实际出现点击卡顿才异步化，不能当持续帧低的首因 |
| `hydroDiagnostics`、`lens.inspectRadiance`、`leafMips`、main 导出/inspect | QA/检查/用户导出，非 frame 主循环 | 不在生产帧加入这些函数；采样时排除诊断读回 |
| HDR fallback | 启用 async-pbo-upload 时全帧 PBO→CPU→WebGPU | 优先保留已接受 native fast path；fallback显式报告模式/字节量 |
| `shoreline-dynamics` reduce | 候选提交时 1×1同步 | 尚未接入，未来专项解决 |
| smoke source T、wave/hydro/caustic textures、depth blit | 正常结果都直接在 GPU 消费 | 不加入 CPU readback；数据纹理按用途 nearest/no mip 是正确的，不能要求所有纹理一律生成 mip |

## 5. 有界测量计划（未执行）

### P0：先建立可信的新基线

- root 完成 R16 新 pack/active-partial 的 tiny → cross-tile → 原生两发接收；同一短 job 内 CPU/GPU A/B，比较 physical time、density/source revision、ordered source count、pose、输出、画质签名。
- 继续允许用户操作；签名变化就取消结果，不能锁住用户，也不能在输入变了后继续报有效对照。profile只分析已确认的活动窗口，排除后面的 idle样本。
- 不将“关烟尘”“源已燃尽”“改相机使光点被裁掉”的样本与原两发样本比较。记录 CPU total/GC/pack、主/镜源数和 query 数、实际 HDR模式、GL errors、GPU disjoint。

### P1：用同 renderer 短测确定下一热点

每次只测一个候选，不开第二 GPU context、不自动压力测试、不 gl.finish；GPU query 异步取 available结果，剔除 disjoint。共享单上下文 exclusive QA锁，分段 query 避免与已有外层 timer嵌套冲突。

| 场景 | 保持一致的内容 | 要分开的指标 |
|---|---|---|
| 日间近岸，太阳斜照，水占画面多数 | pose、physical time、waves、exposure、resolution、MSAA、key lighting | spectrum、hydro substeps、caustics、opaque water、sand、main+mirror geometry |
| 日间远岛，细叶/树影 | 同上+wind frozen pose，另做短连续 wind序列 | vegetation/casters、shadow update vs reuse、MSAA+motion/MRT+temporal、边缘稳定性 |
| 夜间两发同物理快照 | 完整源/烟数量、主镜两视图、同 HDR变换 | source pack/upload/map/reduce、smoke volume、reflection effects、bloom、HDRcopy |
| 相机缓慢移动+昼夜切换 | 同样时序/输入轨迹 | cache失效、PMREM峰值、shadercompile、history invalidation、p95/p99 |

先采用短固定窗口及原父任务的 stop guard；不以3秒单段结果声称热稳态60 FPS，更不能为了审查自动升级到大量烟花。全帧 draw/triangle/RT台账要统一 frame reset：默认 renderer.info 每个 render会重置，当前 lens.sceneStats 只取 opaque draw 后值。官方也建议 multipass 用 autoReset=false +每帧手动 reset；若实现该遥测，应做独立可关闭补丁，避免改变现有计数契约。[官方 renderer.info 说明](https://threejs.org/docs/pages/WebGLRenderer.html)

### P2：按已测热点选择一个低风险候选

优先：重复数据打包/状态查询/临时分配 → conservative可见域/active区域 → 当前请求质量下的几何LOD和casterLOD → 通过精度与画面对照的 attachment/pass优化。保留当前图像设置、默认4096阴影、物理波速/尺度、烟尘质量和寿命，不以静默删细节换数字。

粗略带宽台账可辅助选目标，但不得替代 GPU测量：1209×1292 的四 colour MRT19B/px，8×MSAA +单样本 resolve 的 colour storage 算术量约254.7MiB，尚未含depth、driver padding或其他RT；两张 temporal history 合计约26.8MiB。真实驻留/带宽并未查询，也不能把这些加和当作显卡显存实测。格式已经按motion/radiance/depth/reactive功能分配，进一步压缩要先给出精度界。

## 6. 可选 WebGPU 重构的准入边界

WebGPU的可取之处是 compute/storage buffers、减少 CPU逐对象搬运、同一 API 内后处理/呈现的潜力。Three 的 node 后处理支持 MRT和兼容 pass合并，并建议按数据用途调整 attachment格式；这是未来分支的理由，不是现有GLSL自动加速的保证。[官方后处理说明](https://threejs.org/manual/pages/webgpu-postprocessing.html)

先做一条垂直切片：同一冻结烟尘/源数据 → GPU T或wave field → 一个简单 node材质 → 同样 HDR/SDR输出；比较物理/量化/GPU三层误差、CPU提交、GPUpass、传输、存储和启动时间。保留WebGL2完整回退；不要把最新文档API未核对就塞入本地r180。

迁移清单至少包括：water/spectrum/hydro/caustics 的 ShaderMaterial；sand/vegetation/GI/local-light 的 onBeforeCompile；lens/temporal/aerial/bloom/upscaler/custom colour transform；MRT motion/reactive和depth read/write顺序；raw GL depth blit/FBO恢复；HDR extended canvas与跨API桥。逐项保持单位、single storage exposure、线性光累加、相同太阳/月亮、反射water-hit起点、颜色空间及遮挡。通过一条垂直切片后，才决定compute wave/particle和其余材质的移植规模。

“把烟花运动全部GPU”还需解决CPU音频/时间轴、可回查历史轨迹、烟材prefix、光强上界、自动构图/碰撞等消费者；若再把所有结果读回，就抵消收益。先移只供GPU的图像工作，同时保留廉价保守CPU证书/必要事件数据。精度、确定性和错误回退都应单独验收。

## 7. 审查快照

这些 hash 标记本次源码观察；root 正在修改 main 的QA guard，所以 main 行号只作入口线索，后续实施前应按函数名重核。

| 文件 | SHA256 |
|---|---|
| water.js | d7d5b76dadf35e2e507b640b8975fb3819821b29d113ceeebf195080fd88b045 |
| spectral-waves.js | 58ae823709ff9b5db57b638813ff2350bdd70405c38f4c3892adae999afaf82a |
| hydrodynamics.js | 6ac8daffa0c27bd2387990edc7930ea60e91755e0261fd132eeb5cc3785c5ad9 |
| caustics.js | d7bb1842335db79bda99d7e1b5a7a70cafb48270b174fe956fe1d1558ed029ef |
| sand.js | 37b156b3ef9e9574596e284ed6b5e69bff35f0ffbc1e7089779d87e14fa61e91 |
| vegetation.js | a5f38eb00d66a86d26b923905240ae755adcb95e125f371f6089c2b2f8e37c4e |
| indirect-lighting.js | 2299d1ebf24712fb7500256020d1051bcf7fda6c343af69c34d9c7a796a4079b |
| shadow-quality.js | 39cf62218e58f44d4b58d6d0f6148adff538c6f88b4009bb6765cbb2ca2e98cf |
| lens.js | a3897b76115dc202e670545ee6da65eb07d95429babd5f2297143421d87ceebe |
| hdr-output.js | 9958bb923d18625291132e47cc70dfac43a61a3c45af50b24d7e1a2ee4cbbff3 |
| depth-copy.js | df73dd00d2fc5a99ae1376c2adc9eb627d3766b0e3c1216aeb81e0d3b268a622 |
| quality-presets.js | f4eed12f944d9b93cefed15247f153d3ac09f1e810f2e9808d7c928445b70d9f |
| environment-capture.js | f45243f1cd44efbf35f8a8594c8fbd2bbea6e7674362ca149474fd722dafe8fe |

外部资料核对时间为本次审查日，均为 Three 官方页面，描述最新文档而非本地r180兼容性承诺：[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[WebGPURenderer API](https://threejs.org/docs/pages/WebGPURenderer.html)、[迁移指南](https://threejs.org/manual/pages/webgpurenderer)、[WebGPU后处理](https://threejs.org/manual/pages/webgpu-postprocessing.html)。
