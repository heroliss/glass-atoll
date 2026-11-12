# R37 源投影缓存：独立依赖与最小验证边界

本文件为当前代码的CPU/source审查与候选验收设计；没有生产修改、浏览器、GPU或性能结论。读取基线：`fireworks.js` SHA256 `03fdb7038bffbfc769924ffff6ee57a51b5e9f8b2d3c72169d06e72b9d45c735`，R36 manifest `87cb9a288371eb593c6867ab32beea62f49629944e7314a777dead57bc24ff78`。

## 可复用的最小边界

只复用`writeSourceBound`返回值及其明确写出的结果；不复用radiance bins/总和、`fireworkCentreDepthClipped`、Float32 quad裁剪、排序、上传、SourceT或SH结果。原有raw光度累加、源/烟计数、裁剪和同眼SourceT请求顺序必须继续执行。缓存结果属于当前私有光学行与已解析投影输入，不属于一个裸camera对象。

`prepareSourceProjection`当前返回的`V/P/E`是原矩阵元素数组的别名。key必须比较数值拷贝，不能把同一数组引用当成不变矩阵；主镜相机都可原对象原地更新。反射的projection有真实oblique near-plane修改；`prepareFireworkDepthClip`使用完整P×V的Float32矩阵，仍应在原调用处执行。

| 实际读取 | 必须约束的值 |
|---|---|
| 投影中心与端点 | 完整V和P数值；width/height；world position前三分量及其是否Float32Array（决定端点是否fround） |
| 距离/角像素面积 | E[12..14]眼位、rawPerCandela、P[0]/P[5]与resolved viewport；保存完整E是更保守的做法 |
| sigma/defocus | radius、near、resolved focal/focus/aperture/sensor/dof；focus与focusMetres同时用于不同裁剪公式，不能混用 |
| peak | 有maximumReferenceRGB时其最大通道；否则(unmodulatedIntensity??intensity??0)×maximumColour；colourMaximum须保持现有算序 |
| shutter端点 | rasterVelocity??velocity??zero；vectorEmission；vector有效rasterExposureSeconds??viewExposure.durationSeconds??resolved shutter；scalar使用legacyShutter??shutter |
| stretch端点与trail分支 | stretch完整length/平方和决定是否trail，前三分量决定端点；不能只按数组引用比较 |
| 光学行生命周期 | 私有records身份/generation、requested shutter、实际optical row身份/顺序；当前重建会换records并增加generation，time/wind变更应由这个完整谱系失效 |

当按完整generation谱系限制私有行不可变时，不必把所有body/燃烧参数再复制进逐源key；那些量没有被`writeSourceBound`直接读取。但不能同时允许原地改p内容又仅比较p引用。如果为了测试暴露可变行，应比较上述有效输入或明确旁路该测试注入路径。

key使用`Object.is`或对非有限值旁路可避免NaN/+0/−0问题；不要用有碰撞hash作为唯一相等认证。当前投影输入还有默认值区别：width/height用`||`，多数镜头值用`??`。应比较原函数得到的resolved值，不重新发明归一化方式。

## 两项实际容易遗漏的行为

1. 深度<=.01时，原函数只写peak=0、visible=false、nearPlaneFallback=false和rect清零；其他scratch字段保留旧值。可以仅保存`projected:false`供estimate跳过，或者false直接重算。若声称完整scratch逐字节替代，就必须保持这项部分写入语义，不能把未写旧值错误地当新结果。
2. `onSourceBound`既是每源诊断，也可能重入API或修改同相机的矩阵。最小安全办法是在该回调非null时旁路新cache，原逐源callback及冻结副本构造保持原样。无需为少用的诊断回调扩展复杂的可重入缓存协议。

主眼/镜眼实际镜头输入并不完全相同：main对mirror的radiance查询显式`dof:false, legacyShutterSeconds:0`；实际render又用target实际width/height。必须让这些输入相同才命中；mirror不得误用main sigma/快门。`estimateTrailSampling`的RAW固定3.6e−5，公共radiance接口可传其他RAW，这应失效而不是借用。

## 有界独立检查建议

冻结候选后只需覆盖下列七组，不另造全场景框架：

1. 基线/候选实际factory，在原单发两阶段、原主镜眼，比较完整radiance返回、每源trace、adaptive estimates、排好序的上传属性及SourceT原double射线/active mask；证明输出相同而候选确有重复命中。
2. 同camera对象原地改V/P/eye，主镜切换及同一镜眼的oblique矩阵更新；每项都不能得到旧值。
3. resolved viewport/near/焦距/焦面/aperture/sensor/dof、requested/legacy/represented shutter、RAW改变；逐项使用同一个缓存槽验证失效。
4. 当前generation内实际p属性/Float32端点、rasterVelocity、viewExposure、stretch分支与all-phase RGB上界覆盖；使用原`writeSourceBound`作为精确oracle，不复制其数学公式。
5. 同time执行quality/clear/rebuild或有wind更新并重建records；检查新代旧缓存已被丢弃，空行也不沿用旧计数。
6. callback仍逐源运行且冻结其输出；回调路径旁路缓存，并至少验证一次允许的同相机数值改变不会读旧投影。
7. near-plane false/true、0×/64×与接触拆行分支；缓存输出不可被consumer改写，估计器不sort共享行列表，shader/物理/burn/audio与SourceT/SH装包仍未变化。

CPU计时应单独保留调用数/命中数、基线与候选原始短样本，以及新增key比较/复制成本。它只能证明CPU准备工作有没有减少；没有同条件实际原生整帧数据前，不声称解决11ms、提升FPS或GPU更快。
