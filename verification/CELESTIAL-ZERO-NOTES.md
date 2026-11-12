# 天体零权重路径：有界性能优化

2026-10-26。目录资产、天体时钟、星点PSF/通量、白天星光、地平线过渡形状全部保持。只修改`sky.js`、`night-sky.js`、`star-field.js`的函数调用与导数准备位置。

旧代码先执行目录/银河/月面radiance，再乘`skyVisible`。对几何地平线下`smoothstep`恰好返回0的射线，这些结果原本严格乘零；256低分cube的wide候选表平均41.52项，地平线下仍付出候选遍历代价。

不能直接把旧函数放在`if(skyVisible>0)`内，因为其EQJ方向/UV和月盘角SDF含`dFdx/dFdy`，会落入非一致控制流。第一次候选虽然把导数静态写在早退之前，但真实GPU边界验证失败，不能仅凭静态位置宣称安全，详见下面失败记录。

唯一一次修正进一步收窄：四参`celestialRadiance(rd,transmission,disk,skyVisible)`保留所有lane直到最终返回，不再地平线早退。EQJ/UV及全部屏幕导数和月盘覆盖无条件计算，NASA和diffuse的`textureGrad`也始终执行、消费这些导数；仅把严格零权重时的目录候选数置0，并在月面显式LOD取样条件增加`skyVisible>0`。因此不再尝试省掉两次廉价背景纹理读取。分支后的纹理操作只有`textureLod`、`texelFetch`，不含隐式LOD或屏幕导数。

`0<skyVisible<=1`保留原公式及最终乘法次序；不是按日光强度删除星，也不改半透地平线贡献。旧三参`celestialRadiance`及旧`catalogueStellarRadiance`仍为兼容wrapper。月盘导数依然对完整quad计算；不能为了再省少量运算把它移进分支。

## 验证与基线

- `baselines/{sky,night-sky,star-field}-before-zero-celestial.js`保存修改前源码；原完整GLSL字符串另存`baselines/celestial-zero-reference-glsl.js`用于真实GPU对照，不依赖当前实现拼一个“旧实现”。逐文件前后SHA256在`celestial-zero-check.json`。
- `celestial-zero-check.mjs/json` **8/8 CPU通过**，检查导数先于分支、prepared内核与分支内无隐式LOD/derivative、无可见度早退、背景导数被无条件消费、旧API保留、权重乘序与目录manifest不变。真实shader行为仍以GPU对照决定，静态通过不能替代它。
- 既有controller **26/26**、night math **30/30**继续通过；三个运行时文件及GPU helper语法检查通过。
- `celestial-zero-gpu-check.js`导出`await runCelestialZeroCheck(THREE,renderer,atmosphere)`，使用实际上传目录、NASA背景与月图，对比旧完整GLSL与生产新函数。八幅包含全部地平线下、全部上方、四个跨2×2quad相位、月盘跨界与最亮目录点核跨界；逐Float32 RGB要求完全相同，另确认零区确实为0、过渡带实际有可见能量。共10项，不用图像容差掩盖误差。保存/恢复renderer和atmosphere view状态；不操作浏览器。
- **首轮真实GPU失败，未放宽阈值**：`playground-zero-gpu.json.zero`为6/10，全部上方/下方相同，但3个地平线相位有3.17e−13至7.54e−12差异、约756–761个通道；月盘跨界18通道最大3.01e−6、相对差近1。最亮目录核测试相同，原PSF另测4/4。差异集中首次非零边界行及月盘少量边缘，符合跨quad helper lane被早退/驱动控制流优化影响的候选，**没有仅凭这个分布宣称已证实具体驱动指令**。
- **收窄后第二轮真实GPU严格通过**：`playground-zero-gpu-second.json.zero`为**10/10**。八幅每幅differingChannels=0、maxAbsoluteDifference=0，包括先前失败的三个跨quad相位和月盘跨界；原阈值没有变化。可保留这版只省候选循环/月面样本的实现，运行时继续冻结。证据仅覆盖本次实际硬件/驱动、数据与夹具视角，不泛化所有硬件，性能收益仍须另测。

## 性能验证边界

在编译与预热完成后，固定UTC、天气场、风、相机/FOV、RT尺寸、质量和环境face序列，用GPU timer比较窗口。额外单独记录256cube六面刷新；不能把同步Float32 readback耗时当生产渲染成本。预期减少的是严格零区的目录/纹理工作，仍保留EQJ/UV/导数开销；跨边界quad的收益与硬件分支执行有关。全场成本还含云/大气、反射、PMREM和更新调度，不承诺某个FPS或环境尖峰已完全消除。

可选的`celestial-zero-cost-gpu.js`导出`await runCelestialZeroCostCheck(THREE,renderer,atmosphere,{camera,width,height,cubePosition:[0,2,0]})`，传实际固定主相机及sceneRT尺寸。只在production render回调之外调用；固定同一快照、预热8次，原/新程序交替顺序，各取24个`EXT_disjoint_timer_query_webgl2`短查询，覆盖主投影完整矩形和实际256cube六面。查询不嵌套、不跨await、不包含readPixels；无扩展、外部query active、timeout或disjoint会明示unavailable/inconclusive。返回GPU分布/原样本、actualRT、星表候选均值及明确标为64×64 CPU角采样估计的零权重比例。

此夹具使用RGBA16F、0MSAA、固定透射，隔离天体函数；缺少主场景地形遮挡、云、大气积分与MSAA，所以主投影结果不是生产主帧耗时，六面和也不是PMREM时间。夹具尚仅完成语法检查，未预写GPU计时或收益数字；运行它不阻塞核心交付。
