# 真 GPU 辐射范围归约工具

`radiance-range-gpu-check.js` 只用于验收，不修改运行时。主入口：

```js
const {readRadianceRange,runRadianceRangeGPUCheck} =
  await import('./verification/radiance-range-gpu-check.js');
const fixture = await runRadianceRangeGPUCheck(THREE, renderer);
const range = await readRadianceRange(THREE, renderer,
  completedSceneTarget.textures[0], completedSceneTarget.width, completedSceneTarget.height);
JSON.stringify(range); // Infinity retains explicit "Infinity" / "-Infinity".
```

输入必须为完成渲染/resolve后的整张2D颜色纹理；可传RT（读取其首张color texture），不可直接传CubeTexture、数组、体积或深度。width/height须与已知纹理尺寸一致，避免只读局部却声称覆盖全部。测water.reflection、lensTarget和主scene MRT首个颜色附件均可；alpha的水/叶标签忽略。

输出是采样到的当前**存储曝光P之后**的线性RGB，没有额外摄影曝光、tone mapping、gamma处理或乘2^P。包含`minRGB/maxRGB/maxAbsRGB`与全局极值、NaN/正负Inf/有限负分量计数。计数单位为RGB分量，不是像素；`countNegative`包括负Inf，`countNegativeFinite`单列有限负值。

所有像素由分层4×4 texelFetch覆盖，边缘越界只跳过，最后归约为1×1的四个RGBA32F附件。仅读四附件各一个像素，共64字节，不做全帧CPU读回。四附件保存最小RGB、最大RGB、计数low16和high16。每级low的最大和`16*65535<2^24`，再按65536进位，避免普通Float32大整数累计丢1；并非把大图计数当近似值。

NaN先识别、计数，不让未定义的min(NaN)污染归约；Infinity直接参加极值，绝不先clamp成65504或0。全NaN的通道无可比较极值，以null明确表达。JS返回值中的Infinity仍为数字无穷，`encodedExtrema`与自定义`toJSON()`将其写成字符串，避免JSON默认静默变null。all-NaN与真正Infinity因此可区分。

真实第一轮报告[playground-second-gpu.json](playground-second-gpu.json)的`rangeFixture`发现ANGLE/D3D fast-math把`isnan()`分类优化失效：有限/Infinity极值与计数正确，但NaN计数错误地全部为0，all-NaN的105个分量也漏计。**该旧报告不能证明生产纹理无NaN。** v2改成`floatBitsToUint`后用IEEE指数/尾数/符号整数掩码识别NaN与正负Inf，不依赖浮点`isnan/isinf`；报告标`classifierVersion:'ieee-bits-v2'`。保留原全部夹具，另加正负quiet/signalling四种NaN位型。浏览器仅cache-bust夹具不一定更新主lens缓存的静态import，正式inspect也须确认v2标记或重载。

## v2 真实 GPU 结果

2026-10-26，[playground-third-gpu.json](playground-third-gpu.json)的`fixture`实际 **11/11通过**。原失败的NaN分类、HalfFloat非有限源、all-NaN与新增四种NaN位型均通过；极值、正负Infinity、负有限值、边缘覆盖、计数进位与状态恢复夹具保留。没有通过删掉失败项或把NaN期望改成0获得通过。

同报告`scene`里的opaque、composed、reflection都已核对`classifierVersion='ieee-bits-v2'`，`counterConsistency=true`且`stateRestored=true`。每张1209×1292，共1,562,028像素、4,686,084个RGB分量，逐像素覆盖；该帧存储P=−1，摄影C=0。下表数值保留在**P之后**，未反向除2^P或套显示映射：

| 实际目标 | RGB全局最小值 | RGB全局最大值 | NaN分量 | Inf分量 | 有限负分量 |
|---|---:|---:|---:|---:|---:|
| opaque | 0.0008916855 | 0.9125976563 | 0 | 0 | 0 |
| composed | 0.0011720657 | 0.8090820313 | 0 | 0 | 0 |
| reflection | −0.0071296692 | 0.1118164063 | 0 | 0 | 2 |

反射R最小−0.007129669189453125、G最小−0.0002760887145996094，B最小0；这是两个**有限负分量**，与NaN/Inf溢出不同，仍由独立材质/GI消融定位。这里不把负值截掉，也不宣称它已修复。上述零NaN/Inf只证明这一次记录的三个完成目标，不能外推所有日期、机位、烟花叠加、预曝光变化或后续源码均安全；生产阶段仍需有界源与压力回放。

使用临时Float32四MRT、两个RawShaderMaterial(GLSL3，高精度sampler)、全屏三角形；检查FBO完整与真实program LINK_STATUS。完成/异常均恢复原RT、face/mip、当前viewport/scissor与逻辑状态、XR/shadow/autoClear、READ framebuffer/readBuffer和PBO绑定，并释放自有目标/材质/几何。不释放调用方纹理或renderer。`stateRestored`为恢复后复核，不仅是声称执行了finally。

`runRadianceRangeGPUCheck`复用调用方renderer，不创建页面或新canvas。包含奇数尺寸/最后角像素、RGB非有限/负值、NaN alpha不计、真实HalfFloat Inf位型、all-NaN、16位计数进位、1×1边界和状态恢复，对照独立CPU输入oracle。源码语法可离线检查，但是否GPU通过以root实际运行报告为准。

该小读回仍可能同步等待GPU完成；不要每帧调用，不把归约墙钟耗时当场景FPS。此工具只审所给纹理的实际数值，不能证明更早被clamp的源从未溢出，也不能代替亮度校准/主观画面验收。
