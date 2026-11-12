# ACES 2任意目标峰值：只读可行性门

结论：**700/1270nit可以直接作为官方OCIO FixedFunction参数，既不必冒充1000nit preset，也不需要先把1000nit结果乘比例后裁切。** 但该FixedFunction只是完整输出链中的display rendering，裸接当前线性sRGB master会少矩阵/域限制/归一与编码。本轮未安装OCIO、未调用该CPU函数、未改运行时；下述合法性来自固定版本官方源码/API，而非已运行候选。

## 官方参数：九项，peak须整数

OCIO v2.6.0的`FixedFunctionOpData.cpp:655–667`要求该style恰好9项，peak范围1..10000且不接受小数；没有“仅允许preset峰值”的分支。700与1270满足此门。此检查不意味着任何随意的xy坐标或极低峰值组合都适合作完整输出链，应使用已定义的709/P3-D65 primaries。[官方验证源码](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/ops/fixedfunction/FixedFunctionOpData.cpp#L655)。

官方Python API接受`FixedFunctionTransform(style, params, direction)`。参数顺序由其CPU构造器明确读取为`[peakNits,Rx,Ry,Gx,Gy,Bx,By,Wx,Wy]`：[API](https://opencolorio.readthedocs.io/en/v2.6.0/api/transforms.html#fixedfunctiontransform)、[参数与算法入口](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/ops/fixedfunction/FixedFunctionOpCPU.cpp#L991)。

```python
# 文档级候选；本机尚未安装模块，未假称此段已经执行。
transform = OCIO.FixedFunctionTransform(
    style=OCIO.FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20,
    params=[700, .64, .33, .30, .60, .15, .06, .3127, .3290])
# 1270nit只改第0项；调用validate()后再创建processor。
```

P3-D65的九项为`[peak,.68,.32,.265,.69,.15,.06,.3127,.3290]`。输入是ACES AP0，输出是所选limiting primaries的线性RGB，**100nit归一为1**；不自带sRGB/PQ/HLG编码。官方完整wrapper还做AP1输入范围控制、输出0..peak/100限制、可选白点模拟和编码色域转换，不能误把单个FixedFunction当作已经完整的display view。[完整官方wrapper](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/transforms/builtins/ACES.cpp#L464)。

## targetBrowser为linear-sRGB extended时的明确组合

首个可审查候选选择**709-D65 limiting +709-D65 browser encoding**，尽量沿用当前已测桥的色域。对同一`stored linear-sRGB/D65`：

1. 乘现有`.76×2^(C−P)`一次，得到exposed scene-linear颜色。
2. linear709/D65→ACES AP1/D60，**Bradford适应一次**。可直接使用官方`UTILITY - ACES-AP1_to_LINEAR-REC709_BFD`的inverse；不把sRGB数值直接命名成ACEScg。
3. AP1每通道按下述官方域限制，再以`ACEScg_to_ACES2065-1`变AP0，**不再适应白点**（二者均D60）。这些builtin与矩阵行为可直接核对[官方注册代码](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/transforms/builtins/ACES.cpp#L558)。
4. `FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20([peak,709-D65 xy])`，随后按官方wrapper限制0..peak/100。D65作为target white，由其appearance模型完成从ACES输入的rendering；不要额外再套一次D60→D65 adaptation。
5. limiting709→encoding709为identity；乘`100/browserSDRWhiteNits`，得到浏览器线性单位。白280时，700nit峰为2.5，1270nit峰为4.535714；不是乘paperWhite，也不是除80。
6. 若真实启用并验证`rgba16float/colorSpace:'srgb-linear'/toneMapping:'extended'`，**不再做OETF**；若仍是现有`colorSpace:'srgb'`，则在最终呈现数据上做一次extended-sRGB OETF。不能把PQ码值放进这两种surface。

当前native桥的WebGL drawing buffer仍标`srgb`；即使最终WebGPU canvas改linear，external copy也可能执行源/目的色空间转换。不能将线性值写入标srgb的WebGL源后再被浏览器解码一次。应保留源编码标签一致，另做>1及六色转换probe；PBO路径若直接上传display-linear再写linear canvas则不需OETF。可行组合不等于现桥已通过该新组合。

若以后改P3 limiting而仍编码到linear709，需要准确的P3-D65→709-D65矩阵（无白点适应），结果可能有负709分量；现桥对这种域尚未验证。不要把P3 RGB直接标srgb或max负通道后称广色域正确。优先另测匹配P3 canvas。官方区分rendering target与display encoding，本候选也必须分别记录。[官方实现说明](https://docs.acescentral.com/system-components/output-transforms/implementer-notes/)。

paperWhite不在这九个参数内。这里是reference-nits模式，browser白280只做单位转换；若想锁旧日景中间调/人为白点锚，应另定作者view，不把后乘白点包装成官方ACES2。SDR也须明确“100nit绝对模拟”还是“桌面相对白”：直接将100nit reference输出当0..1写入普通SDR canvas，在白280桌面上并不等于物理100nit。

## 65³ LUT如何覆盖当前float master，而不偷偷裁源

当前FP16安全界限制的是**P后的存储值**，不是摄影曝光后的LUT输入域。`storedBound×.76×2^(C−P)`可明显大于65504；例如只取允许存储界16376、P10.5/C16.5，exposed上界已约796,529。此数是范围示例，不是本轮实景测量。

官方wrapper在AP1中用`U=8×(128+768×ln(peak/100)/ln(10000/100))`限制每通道0..U，之后才进FixedFunction。这样任意当前有限master经同一官方预处理后，都落入明确的有限LUT域，而不是假称整个raw HDR直接装进[0,1] cube。[该域限制源码](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/transforms/builtins/ACES.cpp#L474)。

| peak | AP1上限U（双精度计算近似） |
| --- | ---: |
| 100 | 1024 |
| 700 | 3620.141179 |
| 1000 | 4096 |
| 1200 | 4339.244788 |
| 1270 | 4414.885031 |

生产oracle/GPU须取同一pinned processor的精确常数/float舍入定义。LUT在该AP1域使用明确的log/低端线性shaper，保留黑点；不能65点均匀跨0..4400而期望暗部精确。先做shader域处理，再查65³ LUT，LUT烘焙函数包括AP1→AP0、FixedFunction及后续明确限制/归一。若不采用官方AP1限制，则必须重新声明实际exposed域与超域算法，不能继续以该LUT声称完整官方结果。

65³只是网格候选，不保证误差通过。近黑、六色轴、cube边/角、高饱和与高曝光输入都须对独立官方CPU oracle检查；源/镜头/物质完全保持。峰值参数改变会重建参考processor/该LUT，不在每帧修改lookup域去糊弄旧表。

## 本机依赖门（2026-10-27，只读）

- PATH Python：3.14.0，`C:\Users\herol\AppData\Local\Python\pythoncore-3.14-64\python.exe`；`find_spec('PyOpenColorIO')`为None。
- Codex bundled Python：3.12.14，同样未安装PyOpenColorIO；另查现有anthropic-validation Python3.14环境，也未安装。
- 只读查询[PyPI官方2.6.0 JSON](https://pypi.org/pypi/opencolorio/2.6.0/json)：存在cp312/cp314 Windows x64 wheel，分别3,933,809与4,103,522字节，metadata未声明Requires-Dist。未下载wheel、未pip安装，DLL实际加载仍未验证。
- cp312 wheel SHA256：`89fd094448a0cacc8998fcc8e3631f3721548c106c592aad90bd8cbaf1165d5d`；cp314：`6b4daf1f2c74ef4b035ec7898a1a5f366ecbe6ba7feaaddb9b7b1e40bf9369d0`。

因此**官方库不是明显的体积/构建阻断**：后续可在项目隔离的build/QA环境固定wheel，导出CPU oracle与离线LUT，网页运行时不必依赖Python/OCIO。但本次不能声称已经import、参数processor运行或GPU速度达标。若正式依赖准入/导出仍受阻，保留前稿的`luma-neutral`作者analytic opt-in作为有明确限制的短期备选；不因有备选而把它改称ACES。
