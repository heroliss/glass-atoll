# 官方ACES 2 CPU oracle / GPU descriptor候选

**本轮CPU/导出检查13/13；尚未宣称真实WebGL编译、GPU一致性、成本或HDR视觉修复。** 入口索引是[export-report.json](export-report.json)。网页运行时和默认HDR/SDR链没有接入这些文件。

## 隔离依赖与来源

项目内`.tools/aces2-oracle`使用Python3.14.0独立venv；不修改全局Python。官方PyPI固定OpenColorIO2.6.0的Windows cp314 wheel经SHA256核对后以`--no-index --no-deps`安装，实际native DLL/import、700/1270/100参数及CPU调用均已成功。[install-manifest.json](install-manifest.json)、[install.log](install.log)。

读取官方`Texture.getValues()`需要NumPy，虽OCIO wheel未声明该依赖。本环境额外固定NumPy2.3.4，仅用于导出纹理数组；同样核对PyPI wheel SHA后安装，网页无需它。[numpy-manifest.json](numpy-manifest.json)、[numpy-install.log](numpy-install.log)。

生成的官方函数/查表沿用OCIO BSD-3-Clause许可，附[OCIO-LICENSE.txt](OCIO-LICENSE.txt)。公式来源固定到[OCIO v2.6.0 ACES.cpp](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/transforms/builtins/ACES.cpp#L464)，不是从旧fitted anchor拟合出来的参考。

## 算法与单位

每个目标的函数接受**已经曝光的scene-linear Rec.709/sRGB D65**，不在函数内重复乘C/P或源光强。

1. 官方`UTILITY - ACES-AP1_to_LINEAR-REC709_BFD`的inverse：709/D65→AP1/D60，Bradford一次。
2. 按该目标官方wrapper的AP1输入域0..U限制。这是声明的高层wrapper域策略，不是裸FixedFunction本体。
3. 官方`ACEScg_to_ACES2065-1`：AP1→AP0，同D60不再适应。
4. `FIXED_FUNCTION_ACES_OUTPUT_TRANSFORM_20`，九项参数为`[peak,.64,.33,.30,.60,.15,.06,.3127,.329]`。
5. 官方高层wrapper的输出0..peak/100限制；D65目标，不额外模拟creative-D60白点。

**输出是display-linear709，数值1=100nit参考白。** 不是“1=panel peak”，也不是输入场景已绝对校准的证明。目标700/1270峰分别为7/12.7；拟传浏览器白280时才另外乘100/280，分别成为2.5/4.535714线性浏览器单位。

| target | Float32 exposed灰.18的CPU输出参考nits（R通道） | 函数字符数 |
| --- | ---: | ---: |
| 100 | 9.999912 | 15,238 |
| 700 | 13.840246 | 15,364 |
| 1270 | 14.949752 | 15,435 |

白与非中性颜色的矩阵roundtrip已测；完整自定义链另对照OCIO注册的100nit/709与1000nit/P3高层builtin，最大XYZ绝对差分别9.71×10⁻⁸与5.89×10⁻⁷。它们检查矩阵、顺序和单位，不代表700/1270已在真实屏幕显示正确。

## 文件与GPU接入协议

每个target（100/700/1270）有：

- `aces2-{peak}-official.glsl`：实际`GPUProcessor.extractGpuShaderInfo()`原文本，函数名`aces2Display{peak}(vec4)`。
- `aces2-{peak}-probe.frag`：独立GLSL ES3 fixture wrapper，头部明确`highp float/int/sampler2D`，原官方函数没有改公式。输入sampler为`tInput`。
- `aces2-{peak}-table-0/1.json`：纹理名字、sampler名字、binding、维度、原channel、NEAREST插值、原始F32数值、文件hash和完整上传建议。
- 原始`-raw.f32`分别是RED/RGB；另附`-rgba.f32`精确扩为RGBA32F，alpha1，便于Three DataTexture统一上传。
- `aces2-{peak}-cpu.json`：963行CPU中间值及最终参考；`gpuPattern`给出64×16、stride4的输入/期望F32 binary文件，61个padding像素为opaque black。

每套官方descriptor恰好**两张363×1的2D表**：reach RED363值，cusp RGB1089值；原表总5808字节/target，RGBA展开共11616字节。官方要求`INTERP_NEAREST`，shader自己按hue手动插值；不能擅改成LINEAR。上传建议为RGBA32F/FLOAT、NoColorSpace、NEAREST、CLAMP_TO_EDGE、无mipmap、flipY=false、unpackAlignment1。官方texture binding索引是1/2，WebGL实际以samplerName绑定。

没有3D纹理，没有官方动态uniform；这是**解析CAM/tone/chroma/gamut加两张小hue表**，不是任意cube LUT。peak固定在该processor生成的代码与表中；改peak要另生成一套。browser white和encoding只在probe wrapper中改变：

- `uNitsToLinear=1,uEncodeSRGB=0`：先测原始nits/100 CPU↔GPU一致性。
- 真linear浏览器输出：`uNitsToLinear=100/browserSDRWhiteNits,uEncodeSRGB=0`。
- 只有最终surface确实标srgb时才`uEncodeSRGB=1`，它执行一次signed-sRGB OETF。该wrapper不证明现native external-copy桥对新surface组合已经通过。

golden逆scale明确为`browserLinear×browserSDRWhiteNits = outputNormalized100Nit×100`；不得再乘80nit或paperWhite。实际pixel采用何种canvas编码与OS投影须由独立bridge测试确认。

## 输入、未夹中间值与误差门

[source-inputs.json](source-inputs.json)从当前`EMISSION_PROFILES`读取五个positive作者profile并记录physics/FW/HDR/lens/radiometry/audio SHA。颜色是作者近似、不是实测SPD。本轮没有改其色谱、I或RNG。

963行/target包括六色unit-Y ramp（每色至少64级）、五实际profile、灰/黑白、负输入/近抵消与AP1域上下界/相邻Float32。基本ramp为`.18×2^EV`，EV−20..+20共64点，另加0/.001/.01/.1/.18/1/2/10/100/1000/1e8与线性灰阶。

每行保留原double作者输入`input`，**先显式Float32舍入得到`inputFloat32`，再用这组三值求全部CPU过程与期望**；导出的RGBA F32 pattern逐行/逐bit相同。负值与超域探针有单独family/domain标签，不混成全是正常物理输入。

每行还保留：AP1域限制前后、送入FF的AP0、**不加输入域且不夹输出的裸FF结果**、输入域之后但输出限制之前的FF结果。不会用最终夹后的全finite掩盖原结果。裸FF的这组扩展样本无非有限值，但含负通道（target100/700/1270分别91/325/322个）；最终声明wrapper才限制到目标范围。

初始GPU门采用每通道**2×10⁻⁵绝对误差、RGBA32F输出**，依据[官方forward GPU单测](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/tests/gpu/FixedFunctionOp_test.cpp#L287-L345)，该框架默认不是relative比较。此门是严格起点，不是官方已保证本次新增全部极端/复合matrix样本都通过。若失败应保存具体case/family/差值后诊断；不得自动放宽。FP16输出的量化误差应另测，不能混进首轮F32门。

`.glsl/.frag`用UTF8原字节/LF写出，SHA对实际served bytes核对；纹理/输入/expected binary同样有hash。初始draft报告另存`export-report.initial-draft.json`，当时尚无served shader hash检查，不能拿它代替最终13/13记录。

## 复跑

在项目根目录执行：

```powershell
node verification/aces2-oracle/export-inputs.mjs
& '.tools/aces2-oracle/Scripts/python.exe' verification/aces2-oracle/export_oracle.py
```

这些命令只更新候选验证材料；不安装全局包、不接main、不更改默认显示、不构成HDR视觉或性能通过。
