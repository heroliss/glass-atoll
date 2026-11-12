# 细叶 MSAA 颜色外插：有限根因修复

2026-10-26。只改 `vegetation.js` 的两个叶材质颜色varying声明，不改UV、normal、几何、风、透射、GI或最终RGB范围。

## 已观察与可排除项

root在固定暂停场景的真实全像素范围检验发现镜像缓冲只有两个RGB分量负值（R最小−.00712967，G最小−.00027609），全场无NaN/Inf。关闭GI仍有负值但幅度下降；unlit或colour=0常量颜色后清零；normal=0不变、transmission=0仍有负值、specular=0反而暴露更多负值。记录为 `playground-reflection-negative.json`；后续四项消融记录由root保存。这个方向指向diffuse颜色输入，不能用增加正照度或末端clamp遮住。

`leaf-colour-audit.mjs/json`实例化真实种子和地形，扫描6组几何、材质色与11张8bit程序纹理，均非负且finite，索引无越界。pinnae 505,992顶点的RGB范围为(.04343,.11369,.01693)至(.34998,.44498,.09202)，albedo字节范围R198–232、G180–247、B116–199；源数据不是负色。薄叶粗糙度已有最终min1，Beer与GI输出的合法参数均非负。

## 插值位置：已由真GPU和同场A/B封闭的根因

MSAA像素可以有被三角形覆盖的样本，而像素中心不在三角形内。默认smooth varying可能在中心外插，重心系数不再全为正；即使顶点色全为正，极细三角形及其1.8%中脉/边缘色差也能外插成负色。CPU报告给出了明确代数反例，**没有把它冒称为实际两个像素的坐标重建**。

[Khronos GLSL ES 3.00规范](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) §4.3.4要求centroid输入在像素与图元的交集内求值。这里将两叶材质的vertex/fragment `vColor`声明同时改为`centroid varying`（Three WebGL2转换为centroid out/in），因此pigment是覆盖三角形内的凸插值。没有改UV/normal的smooth插值，避免将centroid采样位置跳变带进mip梯度/法线导数。

默认启用。仅供QA的 `grove.userData.setCentroidColour(false/true)`改变两叶材质的program key并标记needsUpdate，便于相同time/pose/env进行A/B；`userData.centroidColour`及`diagnostics().leafOptics.centroidColour`返回状态。

## 基线与验证

- 修改前基线：`baselines/vegetation-before-centroid-colour.js`，SHA256 `e6eeb5f1d8d41d3376c3628c98475c835a21e6098f2a6bdb1d1a79e594469d74`。
- 当前候选SHA256 `f81f4dfe20fa737d9498e5124d14a66c577db37e36e9cd08f8cf8c60fcad7ef0`。
- `leaf-centroid-check.mjs/json`：**7/7 CPU通过**；两叶两端声明、开关/重编译、UV/normal保持原方式、风/法线/depth与光照公式逐字保持。
- `leaf-centroid-gpu-check.js`导出 `runLeafCentroidCheck(THREE,renderer)`。在隔离HalfFloat MSAA目标绘制相同正顶点色细三角形，分别请求0/2/4/8样本，拷贝至Float32逐像素回读；检查centroid非负和alpha覆盖逐像素、积分完全一致。硬件可能把请求样本数取整，报告查询到的actualSamples及支持列表；超上限明示unsupported。若默认负色未复现，报告inconclusive，不宣称复现。夹具不改运行时材质/时钟，保存并恢复renderer状态。
- root真实运行结果：`playground-centroid-gpu.json.fixture` **9/9通过**。硬件RGBA16F实际支持2/4/8样本；0/2/4样本的这组隔离几何没有复现负值，8样本的smooth输出产生12个负分量（minR −.0000869036），centroid负值0。所有0/2/4/8样本的alpha覆盖逐像素完全一致，alphaDifferences=0；各自积分为24、24、23.5、23.25，两种插值逐项相同。未将“此夹具2/4样本未复现”写成对应样本数永远安全。
- 同一个暂停physical time、camera pose和冻结环境下，root以QA开关对照真实完整场景，`playground-centroid-gpu.json.baseline/candidate`。默认smooth：opaque 6个负分量、composed 4个、reflection 5个；反射minR −.006664276、minG −.002485275。centroid：三条缓冲的负分量均为0、NaN/Inf均为0，反射minRGB=[0,0,0]。opaque/composed仍保留正值，并非把输出清黑。主镜像使用IEEE位分类v2全像素reducer，已独立通过NaN/Inf夹具，不依赖先前被ANGLE错误优化的isnan分类。
- 同文件`motion` **14/14真GPU回归通过**，确认原运动、覆盖和当前/历史depth协议保持有效。运行时代码与资产在接口完成后继续冻结；没有为了通过测试改RGB clamp、几何覆盖或提高填光。

这些证据足以确认这处负色的根因是MSAA图元外颜色外插，并且最小修正确实生效。这修复的是颜色插值域，不是通过加宽叶片、模糊或改变MSAA覆盖来隐藏边缘。centroid不能代替几何覆盖抗锯齿，也不证明风、阴影或所有闪动来源已经消除。
