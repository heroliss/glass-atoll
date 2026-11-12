# HDR显示映射：独立反审与最小候选

仅研究，不改运行时。建议顺序是**先HDR输出变换，再从同一线性master建立SDR输出**。不要用已映射HDR截图裁成SDR，不改烟花I/RGB、灯、烟物质或源谱来补显示问题。

## 已确认的问题与不能下的结论

[hdr-emission-drt-study.json](../fireworks/hdr-emission-drt-study.json)的6/6是当前链路的数值诊断，不是新DRT验收。实际blue作者profile在level1的R/B约.039，经当前fit、尚未final clamp时已约.912；只删clamp并不能恢复颜色。原作者SPD→positive RGB也已经用加中性色做过近似，DRT不能反推被该步骤改变的原谱；本阶段保持它不动。

源码位置：`hdr-output.js:155–171`的SDR fitted anchor再加作者tail，`:186–200`和`:222–237`分别在GLSL/WGSL重复同一映射；它不是官方ACES HDR Output Transform。`lens.js:335–338`从同一pre-OutputPass浮点result分别走HDR和SDR，这个分叉位置正确。`scene-radiometry.js:29`的输出曝光为`.76×2^(C−P)`：新DRT只接收`storedRGB×outputExposureScale`一次，不重新乘P、光强或当前fit内的`.6`补偿。

当前证据说明fitted显示映射会大幅改变这组蓝色，**不证明全部白光/黄烟都是同一个显示缺陷**。真正过曝后趋白、目标色域容不下的颜色，仍可能需要合法降色度；不能要求所有强度都保持输入RGB比例。新变换须对照官方参考的外观结果，而非把“永不去饱和”当物理正确。

## 推荐：ACES 2参考算法为准，LUT作为有误差门的加速

ACES 2在简化Hellwig 2022的JMh空间中分开处理明度、色度与目标色域；其gamut mapping沿恒定感知色相方向工作，之后才按目标设备编码。它不是当前逐RGB通道fit换一条曲线。[官方结构](https://docs.acescentral.com/system-components/output-transforms/)、[gamut mapping](https://docs.acescentral.com/system-components/output-transforms/technical-details/gamut-compression/)、[显示编码](https://docs.acescentral.com/system-components/output-transforms/technical-details/display-encoding/)。

建议固定OpenColorIO版本与ACES配置/Transform ID/参数/资源hash，生成独立CPU oracle及GLSL ES 3.0参考shader。OCIO 2.5已提供正式ACES 2配置，可固定`cg-config-v4.0.0_aces-v2.0_ocio-v2.5`，而非运行时追`latest`；新实施可选已发布2.6.0并记录版本。GPU shader及其辅助纹理应从同一个processor导出，不能凭名称手写一个“ACES2近似”再与自己比较。[OCIO发布说明](https://opencolorio.readthedocs.io/en/v2.6.0/releases/ocio_2_5.html)、[shader接口](https://opencolorio.readthedocs.io/en/v2.6.0/api/shaders.html)、[2.6.0发布](https://github.com/AcademySoftwareFoundation/OpenColorIO/releases/tag/v2.6.0)。

| 候选 | 可实施价值 | 风险/准入条件 |
| --- | --- | --- |
| 官方processor导出解析shader | 最小正确性基线；不需猜LUT误差 | CAM、幂/三角函数、gamut表的实际ALU/纹理成本未测，不承诺≤1ms |
| 同一processor的shaper+3D LUT | 推荐最终低成本候选；合并到现有输出pass，不重画场景 | 先试33³/65³，和CPU/解析GPU独立比较；不是先假定65³足够 |
| 作者保RGB比例曲线+自制gamut压缩 | 可做短期诊断A/B | RGB比例不等感知色相；极亮蓝/红仍有色域难题，不能称官方ACES或直接成为默认 |

LUT的稳妥域是：linear-sRGB/D65正确转换到ACES AP1/D60，应用官方processor规定的AP1有限输入域，再做shaper。不能把AP1与sRGB同名、漏白点适应，也不能直接把高动态scene RGB裁到cube的[0,1]。OCIO参考先做AP1范围控制，目标峰值参与其范围；应逐项复现这个定义，不另造任意亮度截断。[官方OCIO实现](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/transforms/builtins/ACES.cpp)。

65³ RGBA16F约2.10MiB/target，33³约.274MiB；这是存储算术，不是性能实测。硬件trilinear为一条3D采样指令但内部有多texel访问；若误差不合格可试四点tetrahedral/F32，而非放宽色差门。所有sampler须显式highp，LUT数据不做sRGB纹理解码。接近黑及高饱和边界都必须单独测量，防止shaper/half精度造成新条带。

目标峰值改变会改变变换，不应将两套peak LUT线性混合就称精确ACES。最小首轮只支持明确烘焙且通过的目标（例如本机系统记录的700/1270及用户手选1200）；任意新峰值须重新生成/验证processor与LUT，或走解析reference。生成放配置变更/worker或离线阶段，绝不每帧CPU造LUT；未就绪时保持上一有效target并明示状态。首轮不额外引入运行时OCIO/WASM或改server，依赖准入另立实施合同。

## 同源HDR/SDR、白点与编码协议

建议后续公共契约：`master=scene-linear sRGB/D65 floating RGB`，独立`exposureScale`，`view=legacy|aces2`、`target=hdr|sdr`、`limitingGamut`、`encodingGamut`、`peakNits`、`whitePolicy`与`browserSDRWhiteNits`。输出模块须报告实际生效Transform ID/版本、LUT域、目标峰值、白点策略与encoding；不能只显示一个ACES开关。

- HDR：scene master→一次摄影曝光→色彩空间转换→ACES2 rendering/gamut→display-linear RGB（明确定义nits归一）→当前浏览器canvas编码一次。
- SDR：同一master/同一摄影曝光→独立100nit/sRGB目标rendering→sRGB编码一次；不能读取前一个HDR canvas，也不能再套旧ACES OutputPass。若仍用SDR FSR1，应接其已有perceptual/sRGB位置，避免重复编码。
- `legacy`完整保留当前日景look，作为可选对照。新模式的目标不是逐RGB复制旧anchor，否则其已有色相错误也被锁死。

**必须先解决paper white语义。** 官方ACES2曲线在1000nit目标下，scene .18对应约14.512nit，而100nit目标约10nit；当前legacy灰.18在Windows白280时约59.6nit。这三者不能在“同曝光、纯官方ACES2、完全保旧中间调”的同时精确相等。[官方tone scale数值](https://docs.acescentral.com/system-components/output-transforms/technical-details/tone-mapping/)。

首选先提供reference-white模式，按官方峰值目标检查数值；保留UI白点信息，不静默把paperWhite/203后乘到官方结果。若另需“桌面白280/匹配旧中间调”模式，应明确为自定义view/锚定校准：在rendering前确定单一曝光/外观参数并重新施加target gamut/peak约束，给出独立oracle；不能后乘把700nit输出顶到更高后clamp。改变EV补偿属于显示/摄影选择，不能变灯或源I，也不能声称仍是原参数官方ACES2。

留存[原生探测](../display-hdr-native.json)报告两个输出分别700与1270nit、SDR white均280nit，是系统/驱动报告，非测光实测，也不是1200nit已确认。当前700/280=**2.5个线性浏览器白单位**；sRGB编码值不是2.5。Windows原生scRGB的80nit规则不能直接再套到浏览器已按SDR白管理的surface，否则重复缩放。[Windows白点说明](https://learn.microsoft.com/en-us/windows/win32/direct3darticles/high-dynamic-range)、[SDR白点字段](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-displayconfig_sdr_white_level)。

当前`hdr-output.js:329`明确`rgba16float/colorSpace:'srgb'/toneMapping:'extended'`，`:362`的external copy也标srgb。它需要extended-sRGB编码数据，不能把线性scRGB或PQ码值冒充srgb写入。原生探测的DXGI ColorSpace=12描述系统输出端PQ/2020，不代表WebGPU canvas输入也应PQ。[DXGI枚举](https://learn.microsoft.com/en-us/windows/win32/api/dxgicommon/ne-dxgicommon-dxgi_color_space_type)、[Chrome HDR canvas说明](https://developer.chrome.com/blog/new-in-webgpu-129/)。

留存GPU报告UA为Chrome156；Chrome官方已介绍`srgb-linear/display-p3-linear`新canvas色域。但本轮没有重新探测这些模式及external-copy转换，不能仅凭版本切换。建议第一阶段保留已验证的encoded-sRGB桥；新linear/P3链另测>1、负分量/广色域色块与复制一致性后再启用，避免把DRT修复和编码迁移混成一个无法归因的补丁。[Chrome155–156说明](https://developer.chrome.com/blog/new-in-webgpu-155-156/)。

HDR色域推荐最终P3-D65目标+匹配的P3 canvas编码；若实际桥只验证了srgb，则首轮明确709-limited HDR，不隐瞒限制。不能把P3 RGB直接标srgb，或声称选择Rec.2020参数后显示器就能输出全部2020。官方ACES允许分开选择rendering target和display encoding；这是两项，不是一个“色域”标签。[官方实现建议](https://docs.acescentral.com/system-components/output-transforms/implementer-notes/)。

## 最小准入门（尚未运行）

1. **六色×亮度ramp**：R/G/B/C/M/Y至少各64个log亮度点，加黑、灰、thermal和当前五作者profile；含低亮、level1、高亮极限及目标边界。先核对固定版本CPU reference，再读真实GPU。不能只测中性灰，或要求高亮低色度点仍有定义良好的hue。
2. **独立中性标尺**：用官方.18/1/2的nits表检查reference-white模式；700/1000/1200/1270目标分别生成，paper203/280策略分别记录。验证目标gamut内、有限、峰值界与平滑单调，不只验证“没有NaN”。
3. **感知与LUT误差**：报告display-linear RGB/nits误差及统一参考下的JMh/适用HDR色差；按亮度/色度分箱。门限先约定，若33³/65³失败就提高网格/插值精度或保留解析，不靠改源色/放宽门让它通过。
4. **P不改变显示**：同raw master与C，P取−2/0/10.5/21重建stored样本，经`.76×2^(C−P)`后结果相等到输入精度；C的变化只应用一次。F32夹具先隔离算法，F16生产输入再单测量化误差。
5. **桥与编码**：GLSL/native copy和PBO/fallback分别读回；按其声明EOTF解码后再比较oracle，覆盖>1与目标primaries。`extended`只开放可用HDR范围，仍可能被浏览器/OS投影或压缩；数值通过不等测得面板nits。
6. **同master的两种输出**：保存同一个浮点frame与摄影参数，HDR/SDR各自render，不经已映射截图；确认切换不改灯/烟/天气/时钟。当前`main.js:488`的`a.screenshot()`强制`sdr:true`，不能作为HDR可见证据。
7. **日景/夜景A/B**：固定master、C、UTC、云和镜头，legacy与新view分别看海水、白沙、皮实植被和六色烟花。保留不满意样本；HDR实际显示的人眼检查和数值oracle分开，AI看普通PNG不能替代HDR显示验收。
8. **有界成本**：同1920×1080非均匀浮点输入，暖机后交错AB/BA至少30个有效GPU query；分别记录原输出、解析、LUT成本，桥CPU/延迟另报。目标新增输出GPU约≤1ms只是候选预算，未实测不得保证。不要用Node/LUT烘焙耗时或单点场景fps代替GPU成本。

最小实施分期：**H1锁定oracle/白点与域协议并做HDR六色GPU门→H2比较解析与LUT成本、实际HDR显示→S1同master独立SDR→可选P3/linear bridge**。此前保持legacy可回退，不宣称问题已经修复。

## 补充反审：低成本luma/neutral-axis作者候选

Root提出的可选解析候选有清晰的数学价值：先用709线性luma `Y=.2126R+.7152G+.0722B`，只对Y应用旧neutral scalar-fit及有界HDR shoulder；令`q=RGB×Yout/Y`，在目标RGB空间沿`n=(Yout,Yout,Yout)`压缩`q−n`。这避免三通道分别进入曲线产生不同的非线性RGB偏移，但**只是固定luma的RGB neutral-axis变换，不是JMh恒感知色相或官方ACES**。

若`0≤Yout≤H`，一个明确的合法化定义是`out=n+t(q−n)`，其中t是所有通道满足`0≤out_c≤H`的最大0..1系数：q_c>H时约束`(H−Yout)/(q_c−Yout)`，q_c<0时约束`Yout/(Yout−q_c)`。正确的目标primaries/luma权重下，该操作保持选定的Yout，且不会靠逐通道裁切改掉它。硬min是连续但一般不保证导数连续，不能预先保证亮度/色度ramp无拐点或动态色闪。

**最强反例是低亮toe，而不只是高光。** 旧neutral-fit的零交叉约为Y=.001951815542；把同一toe放到Y上后，当前blue作者profile×.001为`[.000484699,0,.012423173]`，luma=.001，因此新候选输出整像素黑。旧通道fit仍可能留有可见蓝分量。红色和thermal也有类似问题：只是“保neutral灰阶”，并不表示保所有彩色暗部的可见阈值，可能改变弱星点看似燃烧到何时。若改成黑点导数非零的toe解决它，则须明确这是另一作者曲线，不能同时宣称旧neutral完全相等。

另一个可复核例子：采用旧neutral scalar-fit，Y>1时使用前文同形式的bounded tail，H=2.5（700/280），当前blue profile在level1的`Yout≈.763397`，固定Y压色后约为`[.685059,.611373,2.5]`。R/B≈.274、G/B≈.245，确实缓和旧fit的R/B≈.912品红偏移，但仍显著去饱和。原因不是数值失败：709纯蓝在H=2.5时最多只有约.1805的luma，不能同时维持.7634的Yout和同样饱和度。这应作为目标色域容量的解释，不把“没有变紫”宣传为“蓝色已物理精确”。上述是读取实际作者profile做的CPU标量例证，**尚无候选GPU或HDR实看通过**。

还需约定的四条边界：

1. **Y=0/小Y**：非负RGB与正luma权重下，Y=0只能是黑；先处理黑，不能用`max(Y,epsilon)`让低亮颜色凭空变色。对于非负输入，有`RGB_c/Y≤1/min(weights)`的有限界；若允许有负RGB抵消，这个界就不存在。生产当前positive profile可作为首轮域，但不得宣称它已支持任意负宽色域/原谱RGB。
2. **负profile**：若未来把原作者preCompression负分量传入，可能Y≤0或极小正Y导致大比例放大；Y=0且非零chroma无法以相同Y映射到正RGB，必须舍弃/另行压缩。不要先max各通道0再称保色；应明确输入域/负值策略，并在真实GPU检查黑、零luma色向量与近抵消样本。当前阶段不改source profiles。
3. **white与gamut**：若paperWhite=W、浏览器白=B，neutral基底的幅度应明确为a=W/B，最终上限H=peak/B。不能套`a×fit(Y)`后仍用H−1的tail；tail预算至多H−a，且要求a≤H。SDR target1是浏览器相对白，不能又声称100nit绝对输出。若换P3，先做709→P3转换并按P3色度处理，不能把709 RGB标签改名。
4. **日景/对比**：灰阶可以保旧，但饱和玻璃海、绿色暗叶、暖沙和蓝色反光的对比/饱和度会变化；同一luma曲线不会保留旧三通道fit的每个彩色像素。压色也不是成像能量守恒，只是保持选择后的显示Yout。保留legacy与固定摄影对照，不能把作者luma模式自动推广为全部日夜默认。

取舍建议：**可批准独立`luma-neutral`低成本opt-in原型**，用于快速检验通道fit造成的品红偏移及HDR headroom，不取代官方ACES2参考轨。至少把六色×log亮度ramp、上述弱蓝toe/level1实例、Y0/负抵消、HDR/SDR两target、P补偿不变与day/night实际对照列为准入；如GPU和显示确实更好，可作为明确作者模式保留。它的公式少、无需LUT/额外fullres pass只是结构优势，尚不能据此报零成本或性能值。官方ACES2更适合作为长期可靠色彩管理基线；解析作者模式更适合有清楚限制的有界快速迭代。
