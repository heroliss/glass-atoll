# B1：独立RGB分段传输库

2026-10-27。只完成数学库与独立夹具，**尚未接入生产天空、空气、烟、星体或反射链**。不代表持久烟、烟花照云或相应画面已经交付。

## 接口与单位

模块：[radiative-transfer.js](../radiative-transfer.js)。无依赖、无全局状态、无渲染器访问。

| 接口 | 约定 |
| --- | --- |
| `homogeneousSegment({extinctionRGB,sourceRGB,length})` | 返回 `{T,S}`；β为m⁻¹，j为每米辐亮度源（等价每体积每球面度功率），length为m |
| `combineMedia(...media)` | **同一几何段**内不同介质相加β、j，再积分一次 |
| `sumSources(...rgb)` | 多个灯只相加j，介质β不能随灯数重复相加 |
| `composeTransfers(front,back)` | front最近眼睛；`T=Tf*Tb`，`S=Sf+Tf*Sb`；可结合，不可交换 |
| `applyTransfer({T,S},backgroundRGB)` | `L=S+T*background`，RGB逐通道计算 |
| `scatteringCoefficients(beta,SSA)` | SSA可标量或RGB，严格限制0..1 |
| `scatteringSource({scatteringRGB,incidentRGB,cosine,g})` | `j=σs*E*HG`，不再乘Lambert余弦或1/π |
| `hgPhase` / `hgPhaseMax` / `rayleighPhase` | 归一化相函数与HG全方向峰值，单位sr⁻¹；允许−1<g<1 |
| `scatteringCosine(incoming,outgoing)` | 光传播方向：source→sample与sample→eye点积；不是两个朝外向量直接点积 |
| `scaleTransferRadiance(transfer,factor)` | 仅缩放S，T不变。调用方同步缩放背景和入射源，一次使用存储P |
| `radiativeTransferGLSL` | 同构`rt*` highp函数与`RTTransfer`/`RTMedium`结构，无sampler/uniform/输出色/隐式P |

`T=exp(-βL)`，`S=j·∫₀ᴸexp(-βs)ds`。β=0直接用jL。光学厚度x<.25时CPU/GLSL共用10阶积分因子级数，首个省略项在边界≤4.978×10⁻¹⁶；较厚段CPU使用`expm1`，GLSL使用高精度`exp`。不会加一个任意β下限消除0/0。CPU检查输入finite、非负、SSA/g范围与输出可表示性，溢出报错，不用clamp伪造能量。

共享GLSL仍需调用方保证输入域，highp算术与最终FP16存储是两项不同约束。库不分配场景预算P，也不能证明整个生产链有足够的FP16余量。

## 独立CPU验证

执行 `node verification/radiative-transfer-check.mjs`，结果为[radiative-transfer-check.json](radiative-transfer-check.json)：**33/33通过**。

- 48组固定seed RGB场景，用独立RK4积分`dT/ds=-βT, dS/ds=jT`，最大绝对差1.5632×10⁻¹³；不是拿同一闭式公式自比。
- 另一套Simpson路径源积分最大绝对差2.8422×10⁻¹⁴。非均匀七段细分差2.2737×10⁻¹³；三种介质前后串联与分段ODE差8.8818×10⁻¹⁴。
- 实际HG g=.32/.76的球面积分分别1.0000000000000002、1.000000000000001；峰值分别.2271675226、2.4315338528 sr⁻¹。对应前/回散射比7.31467535与394.37037037。另测负g与Rayleigh归一。
- 零长度、真空、黑源、纯吸收、β=0、subnormal小β、大光学厚度、SSA0/1、多灯、输入无效值、只缩S一次以及输入不被改写均有独立检查。
- 保留错误操作的负对照：前后段交换、把共址空气/烟当相邻层、每盏灯重复加β、重复乘P，必须与正确结果明显不同。

## 实际GPU入口

[radiative-transfer-gpu-check.js](radiative-transfer-gpu-check.js)导出：

```js
runRadiativeTransferGPUCheck(THREE, renderer)
```

由renderer所有者在没有并发draw/query的时刻调用。它仅绘制4×1 RGBA32F临时目标，12个数值夹具，加编译/GL错误与状态恢复检查共14项；复用真实共享GLSL。CPU期望值使用实际binary32 uniform输入，输出容差为`2e-7 + 6e-6·|expected|`。不创建浏览器或上下文，不改生产材质；恢复target/cubeface/mip、当前viewport/scissor、read-FBO、pixel-pack绑定、debug钩子、统计及开关。临时资源释放，调用者context保留。

**此封存时GPU夹具尚未实际执行**。`node --check`只确认JS语法，不代替GLSL编译/真实GPU结果；后续若根代理运行，应另存实际报告，不把此说明当作GPU通过证据。

## 下一阶段接线边界

必须由唯一所有者确定主视图与镜像视图的物理距离、共同分段和介质积分顺序。库只处理均匀段/给定j，不决定异质场采样、烟团Gaussian状态、密度cache或多次散射。**禁止用除以小`T_air`的逆解，从已经采用另一套离散步骤的背景猜回同一条清洁光路。**旧烟sprite与新体积质量也不能同时重复表示同一质量。此次未修改任何生产文件或package脚本。

源码SHA256：`5f286c608529efac5cc3fe69821dd3837081ebdfdb48fc4095c73662e3e78e4e`。
