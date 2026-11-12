# R17：GPU烟尘遮光、燃烧点基础与图形审查

2026-10-29。本轮交付的是已接入的遮光优化、亮度UI修正、精确天空照度缓存，以及尚未接入场景的燃烧profile基础。整体照片感、所有烟花丰富度和60FPS目标仍未达成。

## 当前运行行为

- 主场景仍为本地Three r180 / WebGLRenderer / WebGL2。WebGPU仅用于HDR输出桥。未升级引擎或替换渲染器。
- 烟花面板新增“GPU烟尘遮光 · 实验选项”，兼容设备默认启用。每个renderer初始化只做4射线/1烟包的同步兼容检查，一次64字节读回。实际运行透射结果直接由GPU顶点着色消费，不逐帧读回CPU。关闭或未通过检查则走原CPU路径。
- 完整SPD Gaussian烟包沿有限射线累计光学厚度，再取RGB透射率；没有削减烟量、寿命或光源ledger。主视图与海面镜像分别使用自己的射线及水面命中起点。
- 最大资源为14000条源、4096烟包、每视图1048576对。固定GPU数值资源约15.50MB，CPU输入缓冲约0.94MB；实际partial pass只绘制当前有效tile行。超出预算仍会回退CPU，可能明显变慢；大量持续烟尘的普遍流畅保证尚未建立。
- 正常亮度滑块为0.1–32×，1×明确标为本站参考，未按实物测光标定。0×移入折叠的“关闭烟花发光，保留运动与烟尘”调试项；退出调试恢复此前正倍率。倍率影响之后发射的光源，音频、运动和参考烟材预算独立。
- 天空CPU照度缓存以13个Double依赖逐项比较，替代7位字符串key及无条件清缓存。积分、光谱与GPU着色公式未改；存储曝光P在返回时独立应用。
- 固定场景计时加入真实输入epoch、独立暂停意图、灯光设置及结束时复核。输入、页面隐藏、context中断、renderer占用或不足2帧均不得报告有效FPS。清理尊重用户继续/暂停及故障暂停。

## 实际浏览器证据

以下均复用当前IAB中的同一个renderer；无新浏览器进程/测试服务/图形context，无驱动或系统调整。撤回的aerial/splash候选没有重试。

| 检查 | 结果与边界 |
|---|---|
| [最终小场景/跨tile/烟气受光](r17-xyz-default-fbo-gpu-check.json) | 实际GPU25/25、22/22、30/30全部通过，含VTF、MRT/viewport恢复与GL错误检查；已包含下述XYZ和默认FBO修复 |
| [真实两发透射抽查](r17-native-two-transmission-oracle.json) | 7/7通过；3456行、48烟包、256分层样本。最大原Double物理T差1.689e-6；GPU相对量化Double差9.05e-8。完整14080texels的finite/range/alpha/padding通过。不是任意输入误差证明 |
| [最终运行兼容预检](r17-default-fbo-runtime-support-native.json) | 4条射线最大T差6.384e-8，1次64字节读回，state恢复通过，entry/exit GL错误均为空；只做硬件sanity，不能替代上面实际集成准入 |
| [最终真实两发复验](r17-xyz-default-fbo-native-two.json) | XYZ/默认FBO修复后7/7通过，main/mirror各3456源、各0CPU列查询；修复没有改透射shader、烟质量或寿命 |
| [三窗同工作量](r17-paired-native-summary.json) | GPU16.83 → CPU3.45 → GPU18.24 FPS；各3秒、同物理时刻79.6972、同相机、两事件/48包，main和mirror各3456条。所有before/after及跨窗签名一致（仅后端开关不同）。GPU两视图CPU查询均0，CPU两视图各3456。此为冻结场景实际绘制，不是正常动态全场景FPS |
| [最终版本短测及CPU采样](r17-final-two-gpu-benchmark.json) | 另一个物理时刻45.304、同类型两发，34.82FPS、CPU median25ms。与前一组三窗不是同一次工作量，不将其直接作为缓存优化的因果提速证据；也不是60FPS达标 |
| [操作干扰](r17-frozen-guard-native.json) | 原生亮度输入使计时cancelled/invalid，保留新倍率1×及原暂停。没有锁用户输入 |
| 界面 | [桌面](r17-controls-desktop.png)、[390px](r17-controls-mobile.png)、[滚动到GPU开关](r17-controls-mobile-gpu.png)；scrollWidth390，无横向溢出；正常倍率2.5→调试0→恢复2.5已原生检查；机械检测[r17-ui-detector.json](r17-ui-detector.json)为空 |

原79.78FPS“CPU对照”有0个实时光源且相机/时刻不同，继续排除，保留invalid旁证。外层GPU timer包含提交空泡，不当作单独透射kernel耗时。

### 最终日志反审查出的两项修复

旧的3个全屏计算三角形position只有XY、itemSize2，Three在排序时仍按XYZ计算boundingSphere，最后getZ越界成undefined。已全部改为同样的三点XY、Z=0、itemSize3；RawShader仍消费XY、绕向和drawCount不变。[真实Three CPU反例5/5](r17-fullscreen-position-geometry-check.json)及上面实际GPU复验通过。当前两份GPU诊断夹具同类几何也已修正；没有用关闭排序掩盖错误。

随后首错跟踪[r17-first-gl-fault.json](r17-first-gl-fault.json)查出：本浏览器在初始默认DRAW framebuffer下，查询8个DRAW_BUFFERi会都返回BACK，旧恢复把8个BACK传给drawBuffers，引发1282。默认framebuffer现规范为仅恢复第0项，offscreen仍保留全部MRT；独立READ_BUFFER也保存/恢复。兼容检查新增entry/exit GL错误核验，任何错误明确失败。旧版“GL1282但passed=true”的CPU反例保留。[admission12/12](r17-smoke-transmission-admission-check.json)、[factory8/8](r17-smoke-transmission-default-buffer-check.json)和正常启动/GPU复验均通过。

临时GL调用跟踪只用于定位，会消费错误标志，不能作为验收/性能结果；其main导入和启动调用已撤除，最终页面不带gltrace参数。修复前的数值/性能报告保留为历史，不把它们当作最终无报错声明。

[最终正常页面运行检查](r17-final-runtime-clean.json)通过：以当前document的timeOrigin筛选保留日志，没有新warning/error；同一个场景context的GLerror=0、无临时trace、URL已回正常主页。最终设置/相机在这次正常启动后重新恢复并核对。

## 燃烧点基础：已经写好，尚未进入场景

新增[firework-burn-profile.js](../firework-burn-profile.js)：不可变版本化profile、每body稳定seed扰动、线性参考RGB生命周期与局部向量快门积分、独立单调烟材CDF、补偿材料proposal ledger。质量/体积/迎风面积未知值保持null；不把作者参考M写成kg。

双色、192体三层、约1秒有限推进bee的描述已提供。它们尚未替换现有十型烟花，也没有实现推进轨迹。原生画面不能用来声称新多层效果已验收。

[CPU检查](r17-burn-profile-check.json)19/19，通过两轮独立数值复核。首次稀疏RGB、长ID和巨大prefix后小烟量丢失三个失败已保留并修复。新材料amount已经是最终建议量，不能再加一次amountCorrection；CAS及现有烟尘host原子提交仍是下游责任。

[接线图](plans/R17-LAYERED-INTEGRATION-MAP.md)列出了必须一起修改的当前/过去亮度、尾迹、完整ledger、光照/bound、烟/云/GI、main/mirror和实际曝光窗。不能只给shader变色。不同寿命后峰值预算与时间积分不能同时默认守恒；新寿命超旧范围必须重新检查构图包围。

## 已完成的审查与下一步

- [燃烧系统两轮反审](plans/R17-COMBUSTION-FOUNDATION-DELTA-REVIEW.md)：区分弹道礼花弹、附着升空光和主动推进星；燃烧发光不直接等于净推力。
- [图形性能审查](r17-graphics-performance-audit-plan.md)：海浪、潮流、焦散、沙、植被、间接光、阴影、MRT/MSAA、镜头及HDR；区分实测、确定工作量和待测候选。
- [天空与引擎路线](r17-sky-environment-engine-plan.md)：保留当前基线，WebGPU/TSL单独验证。GLSL ShaderMaterial及onBeforeCompile不能通过更换构造器自动迁移。
- [最新CPU采样](r17-final-two-gpu-cpu-profile-summary.json)与[下一轮精确优化方案](r17-next-cpu-optimization-plan.md)：flightSegment、fillRecords和GL状态查询成为剩余热点，scalar打包已不在最前。下一轮先消除重复轨迹采样/镜像重复包络，再处理分配与精确系数缓存；READ/DRAW/MRT状态恢复不能盲删。

`npm run check`通过；`npm run verify:r17`包含运行预检12/12、计时guard9/9、profile19/19、天空缓存13/13、factory状态/viewport8/8、全屏几何5/5。天空相关另97/97 CPU回归通过。测试数量不代表照片感、听感或所有硬件性能达标。

用户的时间、相机/中心、暂停、画质、图形、镜头、天气、空气、海况、原烟花设置、灯光/手电和面板已恢复，[15项值比较](r17-final-manifest.json)通过。先前已说明reload会重启当前烟尘/试验烟花，未声称恢复累积物质。新增GPU选项处于开启就绪状态。

已认可的主爆音频文件未改，SHA256仍`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。残余黎明天际黑带、冲滩求解候选、太阳能量/烟花光度标定、丰富多层与有限推进的实际视听验收继续待办。目标保持进行中。
