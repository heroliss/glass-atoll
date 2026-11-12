# R13 水下小物体：有限真实边界与深度验证

运行时只修改 `water.js`。最终候选SHA256为 `65a597fe6946a23d8bf7599369dc8ca5d7ec6f51cbdb5c199b4f25792865c27a`；保存的原始 `r13-refraction-baseline-water.js` 为 `7f3ba0f5eaa599ac8cf60dcc299a440d134a708ea336ae7e8999081a883df4c8`。未修改main、石子、水花或已恢复的aerial模块。

## 原因与新契约

旧逻辑仅在解析海床的投影UV附近查看辅助深度，并要求物体高于海床6cm以上。直径2.5cm的石子静止时不可能通过这个门槛；下沉中的石子也不会总投影到海床命中UV。另一方面，辅助缓冲只捕获layer1，父代理已在石子模块中修正了layer0/1双层。

新API `setSubmergedObjects(objects)` 接收最多36个真实边界快照：`{id,position:[x,y,z],radiusMetres}` 或 `{id,position:[x,y,z],diameterMetres}`。使用真实米制半径，没有最小视觉直径或放大参数。输入完整校验后才提交；列表与位置深复制并冻结；非法批次保持之前列表，未改变的快照不增加revision。36对应12个移动石子加24个静止物；父代理每帧在`water.render`前提交水下与静止物状态。

默认数量为0，追踪函数立即返回，保留解析世界空间海床。只增加一个count和36个vec4 uniform；没有增加生产RenderTarget、sampler、场景pass或历史缓存，原本16个sampler的硬限制不变。

## 命中与光学

从当前水面片元以现有法线、1/1.333折射率产生Snell射线。真实球边界仅选择解析海床之前的正向有限搜索区间，不提供颜色或代替真实几何。先算垂直残差向量再平方，避免远处近共线球的大数相减误差。

每个有效区间最多4次粗采样加6次二分深度读取。最后一个有效高端点在循环内缓存，没有额外的第11次验证读取。每次深度必须投影在辅助摄像机画面内，不能夹到屏幕边缘；重建点必须仍在对应真实边界内、位于局部水面入口平面后，并在折射射线的一像素有限分辨率容差内。通过才采真实辅助RGB。最近的已验证命中缩短后续区间；球体本身永远不能凭空生成彩色表面。

命中物体后，出射Beer距离改为入口到实际重建命中的距离；体散射中点/区间也随之缩短。入射水中光程使用实际接收点深度，不再借用更深的海床距离。未命中物体则完整保留世界空间解析海床，没有屏幕边缘替代纹理、6cm高度层或全屏颜色遮罩。

有明确局限：辅助缓冲仍是原摄像机可见的native RGB/depth，不是完整3D光追；离屏、被遮挡、极薄或掠射几何可能保守漏掉，返回海床，不生成假物体。像素容差只处理光栅离散/二分误差，真实射线仍必须先穿过未放大的球边界。native RGB没有太阳/天空/局部光分解，入射衰减沿用按接收点深度计算的一次太阳光程代理；不能称为完整水下照明解算。

## 检查与实际验收

`r13-refraction-check.mjs/json` CPU **6/6**：原始基线、0新增RT/sampler、2.5cm真实半径、原子不可变快照、实际factory数量/清空/暂停revision、0/20/45/65° Snell几何、遮挡/离屏/水上/海床后拒绝、真实物体Beer长度。CPU几何检查不是生产GPU编译或最终照片观感验收。

实际GPU入口：`runRefractionPropGPUCheck(THREE,renderer,{water})`，文件 `r13-refraction-gpu-check.js`，SHA256 `c73148029db150d54196397bdaac7e9dd783778b48e7d4a43a9f9618a28c24c0`。父代理的wrapper在现有健康renderer及qaRenderLock中调用；不会另开完整应用上下文。它直接从已加载的生产material中提取三个GLSL函数，在256²自有夹具里使用真实2.5cm IcosahedronGeometry、真实颜色/深度、独立三角形射线和核心覆盖检查，测下沉/静止、35/60°观察、真实Beer、遮挡/离屏、最近物体、有限HDR和实际链接sampler数。还需父代理新主页面中的实际小岛折射照片、连续入水过程与开销判断。

新调试模式16输出真实验证命中mask，17输出真实出射路径米数（无命中为0）。它们只用于验收，不是用户的常态画面。

首轮实际GPU报告`r13-refraction-gpu-first.json`只通过6/9，并且全部真实命中为0；报告内实际有两次GL502，隔离夹具程序的active sampler为0。旧夹具已封存为`r13-refraction-gpu-first-helper.js`（75493258…）。本轮只修正夹具：RawShaderMaterial GLSL3缺少Three为普通ShaderMaterial自动加入的`#define texture2D texture`；依据是本仓库`vendor/three.module.js`6433–6451行。新增实际compile/link日志并在编译失败时禁止继续读取像素。生产water源与原来的覆盖/Beer/拒绝阈值完全不变。下一轮须由实际GPU结果确认这个原因；不能把全0缓冲的数值检查解释为通过。详见`r13-refraction-gpu-first-audit.json`。

后续同一renderer的实际`r13-refraction-gpu-alias.json`已通过 **9/9**，GL错误为空，context未丢失；自有程序62的vertex/fragment均编译且链接成功，日志为空。仅加兼容alias就让同一生产函数从全0变为333/167/159/172个真实深度命中；四种normal/35°/60°/2.5cm静止核心覆盖均为100%，没有超出真实球边界，最近接收物、真实路径Beer、遮挡、离屏与有限HDR均通过。生产链接程序仍16sampler，隔离夹具2sampler。由此确认首轮是Raw GLSL3夹具编译错误，不是生产追踪逻辑错误，也没有修改任何原数值阈值。有限像素footprint允许轮廓边缘的光栅近似（60°下149/159命中还通过独立精确三角形射线）；这不是完整光追。实际主小岛照片、连续入水观感和0/1/12/36边界性能仍待父代理验收，不能将9/9隔离夹具等同于这些事项完成。

父代理后续在真实主页面完成原生左键入水4/4及一个近岸静止石子的实际画面验证。`r13-native-prop-mask.json`对已捕获的生产debug-mask离线计数为181个正命中像素，边界12×17px；对应真实2.5cm石子坐标[43.1206,−.226059,7.3846]，layer1、列表count1，实际GL错误为空。证据包括`r13-native-stone-entry.png`（入水约0.11s）和bed-reset normal/mask/path/repeat。最早debug图像复用过已静止的时域历史，未清历史版本保留，正确版本显式reset history。这个证据只覆盖该实际相机/一个物体；不能由保留record或这个单视角推断任意角度可见性、所有遮挡情况或性能通过。
