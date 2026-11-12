# ACES2 可选显示变换：最小集成合同（研究稿，未接生产）

2026-10-27。只读核对当前 `lens.js`、`hdr-output.js`、`main.js`、`scene-radiometry.js`；本轮只新增此文档。推荐先用 **WebGL 最终输出 pass + 已验证浮点 HDR 拷贝桥**，不再平移一份 WGSL 色彩算法。默认继续 legacy；本合同不表示 HDR 观感已修复。

## 1. 当前边界与必须保留的单位

当前 `lens.js:328–338` 是 aerial → lens/effects → 一次 PSF → SMAA → HDR present 或 SDR OutputPass。该 `result` 仍是 **P 后的 scene-linear709**，不是已经施加 C 的 master。`scene-radiometry.js:29` 与 `main.js:655` 给出：

```
storedRGB = rawRGB * 2^P
outputExposure = .76 * 2^(C-P)
exposedRGB = storedRGB * outputExposure = rawRGB * .76 * 2^C
```

候选两种输出共用同一 `result` 和同一 `outputExposure`，在输出 shader 的局部变量中乘一次；不另做昂贵的 exposed master RT，也不改上游 P、C 或灯/烟源。如果以后调用方真的改为预先施 C 的 master，必须显式传 `exposure:1`，不能再使用当前默认 exposure。

`hdr-output.js:189–195` 当前执行 legacy filmic + tail + 一次 OETF；`nativePresent:350–360` 同步绘到 RGBA16F WebGL canvas 后，同 task 拷贝到 WebGPU extended canvas。候选替换该映射，不在它前面再加一个 DRT。SDR 候选也必须绕过 Three `OutputPass` 的 ACES/OETF，不能让两次映射串联。

官方导出的完整函数已经含一次 709/D65 → AP1/D60 色适应、声明的 AP1 域限制、AP1→AP0、ACES2 FF、输出范围限制；不能再加旧 filmic 矩阵、预先逐通道 clamp 或额外 Bradford。输出为 display-linear709，**数值 1 = 100nit 参考单位**，尚无 OETF。

| 路径 | 输入/映射 | 送到声明 sRGB surface 前 |
| --- | --- | --- |
| SDR 候选 | 同一 exposedRGB → 100nit target | 函数结果直接一次 sRGB OETF；作为标准 SDR100 参考归一值 |
| HDR 候选 | 同一 exposedRGB → 所选精确 peak target | 函数结果 × `100 / browserSDRWhiteNits`，再一次 extended-sRGB OETF |
| legacy | 保持现有流程 | 保持原默认与对照 |

SDR100 是参考显示条件，不保证 Windows SDR white=280 时屏幕白实际仍为100nit。HDR 的 `700/280=2.5` 是浏览器线性白参考的峰值，不是 scRGB 的 `/80`，也不是把编码值再除280。保持 `rgba16float + colorSpace:'srgb' + toneMapping:'extended'`，不引入 PQ/HLG 或再次 OETF。

**ACES2 自己决定中调。** 现 oracle 的18%灰在100/700/1270 target 约为10.00/13.84/14.95nit。不能再乘 legacy `paperWhite/sdrWhite` 以宣称原 look 不变；候选下 `paperWhiteNits` 不参与映射，应在UI说明/禁用。Windows SDR white 仍参与 HDR 单位转换。相同 C 的 HDR/SDR候选、以及 legacy 日景，不保证中调与色彩相同；须给可选对照，不自动改 C 或重新调灯。

## 2. 可复用资产与明确非官方部分

冻结 `verification/aces2-oracle/` 原官方 shader/表、CPU oracle 与52/53首报告不动。新77/77报告 `verification/aces2-atan-gpu-first.json` 是 **nonOfficialCandidate=true、productionIntegrated=false**：角度9/9、颜色53/53、插桩15/15，三目标各963样本沿用原 CPU 期望及原误差门。

可选候选使用 `verification/aces2-atan-candidate/` 的显式数值变体：只将唯一 `atan(Aab.b,Aab.g)` 换成通用 range-reduced degree17 atan2；完整文本可严格逆回原官方函数。必须命名如 `aces2-ocio26-accurate-atan-v1`，不能称未修改的官方 FF 或官方认证。色矩阵/压缩/两张表均不改；原52/53失败保留。

每个 peak：完整函数约15k字符，reach 与 cusp 两张363×1 Float32表。RGBA32F上传各5808B；NEAREST、CLAMP_TO_EDGE、无mip、NoColorSpace、flipY=false，sampler显式 highp。主纹理+两表共3个片元sampler，不增加水面的16sampler压力。表内插由官方函数完成，不能改成硬件线性插值。

## 3. 最小代码边界和接口建议（尚未实现）

新增 `aces2-output.js` 与项目自有 `vendor/aces2/` 资源清单，不让生产 import verification 路径。保留原资产、OCIO许可、上游版本/函数与表SHA，以及 atan 候选替换/逆变换记录。

```js
createACES2Output(THREE, renderer, { resourceBase })
// 一对象持有100nit SDR和当前HDR目标；不含曝光策略或OS设置
await pass.prepareTarget({ peakNits: 700 }); // 加载+hash+编译+独立小draw，失败不发布
pass.render({ input: result.texture, exposure: renderer.toneMappingExposure,
  peakNits: 700, nitsToLinear: 100 / browserSDRWhiteNits,
  encodeSRGB: true, target: null }); // 同步；无 await；完整状态恢复
pass.state; // requested/effective peak、pending、generation、asset hashes、errors
pass.dispose();
```

- `lens.js` 增 `setDisplayTransform(pass|null)`；SDR候选选100目标，最终直接绘到屏幕，或原 `encodedTarget` 后沿用既有 FSR1。不再调用 OutputPass。直接写编码值的目标是 NoColorSpace，shader `toneMapped:false`，不让 Three 自动再编码。
- `hdr-output.js` 增同名 setter。现 nativePresent 内同步调用候选的最终输出，不再执行 legacy HDR_FRAGMENT，再沿用同 task copy。缩放坐标/viewport与现路径一致，避免额外 fullres pass。
- 首个最小候选 **只准 HDR native float-canvas copy**；现 PBO/WGSL fallback 仍只实现 legacy。若桥退回PBO，候选明确降为 legacy 并报告原因，不能拿 legacy 输出冒称 ACES2。以后若真要支持PBO，可先在WebGL中做同一DRT后读回，再用仅copy/encode的WGSL；这增加RT/pass/传输，须单独验收，暂不手译两套官方FF。
- `main/ui` 只新增显示模式、状态同步与禁用说明。变更不碰 physics/I/RGB/M/C/P、摄影自动布尔或旧日景默认。`screenshot({sdr:true})` 继续是明确 SDR 导出，不能拿它当 HDR surface 证据。

输出 pass 必须保存/恢复 target、cube face/mip、viewport/scissor/test、autoClear以及它触及的renderer状态。不对调用者renderer执行setSize/dispose。多个异步prepare用epoch，旧请求完成不能覆盖新显示器/新峰值；dispose也使pending失效。

## 4. 任意整数峰值与资源切换

峰值写进官方代码与两表，**不能给700的表只换一个1270 uniform**。本机固定 OCIO2.6.0的FF validate 已只读验证100、700、701、1200、1270、10000可接受；这不是这些新峰值的 GPU 通过。首轮仅允许已生成并验收的100/700/1270，未生成目标必须显式 pending/legacy，不伪报生效。

下一最小生成入口：新项目CLI `tools/export-aces2-target.py --peak <integer> --out <fixedCacheRoot>`，从冻结 exporter 拆出单peak导出，写到新目录，不运行会重写旧46件资产的原脚本。首范围100..10000整数；保留官方AP1域/输出策略与独立CPU期望，生成原件及明确atan候选，UTF8 LF按实际文件bytes哈希。

如必须在网页里自动支持任意新显示器峰值，再由同源server提供**独立的显式生成端点**（不是现只读display探测端点）：仅接受整数peak，固定venv/脚本/缓存根，spawn参数数组，无shell拼接、无任意path/代码，单并发并去重、容量有界。缓存key含OCIO版本、限制primaries、candidate版本、peak；ready manifest为最后原子提交物。无venv/失败时回legacy并说明，不安装全局包、不访问外网、不改WindowsHDR。

prepare含资源完整性/格式检查、实际GL compile/link和小CPU锚点GPU门，下一帧同时切完整程序+两表+peak；不能出现新shader旧表的半更新帧。大套963门先作为离线每目标准入，不必在用户每次热切换时全部阻塞执行。white变化只更新wrapper单位uniform，不重建ACES资源；C/P变化也不生成资源。

显示器切换若新peak资源未就绪，立即回已验证legacy（使用新校准）或SDR，不继续把旧高峰当作新低峰。保留 requested/effective/reason 与最后错误。自动读数精度不应每帧产生不同整数任务；只在实际选择/读数变化时请求，不能混用峰值与全屏峰值。纸白和峰值仍不是光度计测量。

## 5. 实际GPU准入与退出条件

1. 现同renderer复跑100/700/1270候选963样本和原始门，零GL/shader错误；独立实际查程序/两表/过滤/mip/单位。新增精确任意目标须有自己的CPU oracle与同门，不能只靠700插值。
2. 输出级别测一次 exposure/OETF、P±8与反向补偿不变、黑与极暗蓝、六hue×亮度ramp、五实际profile、灰/白、负/域边界；RGBA32F数值oracle先于F16/bridge误差。不能靠最终clamp掩盖坏输入。
3. 真 native HDR桥验证>1值、100/white换算、显示器700↔1270/手动1200请求竞争、关闭/开启/resize与SDR强制截图。检查 WebGPU errors 数组，不能只看console。截图SDR与真正HDR surface语义分开。
4. 同一float输入/同一C、日景+月夜+蓝/绿烟花实际A/B与原图；不靠调I/C掩盖候选变化。记录中调、色相、峰端去饱和及负域策略；77项夹具不是照片接受或HDR显示认证。
5. 真实输出分辨率 warmup+交错 GPU query/CPU submit，对legacy和候选分别测；表内采样/atan较多，不能由小64×16夹具推断60fps。输出失败必须可立即回legacy并恢复显示buffer，不留黑屏。

## 6. near-apex A：用现height接口做最小电影验证

无需新flight实现。现 `createFireworkEvent:146–153` 的显式 **height是worldY**，默认定义高度才是muzzle以上rise；必须固定80°，保留apex（不传timed3/delay）。当前main默认78°，只在launch options里传80会使物理origin仍按configure的78°炮口计算，因此**先把现fireworks设置改到80°**再launch。

main origin固定[29,0,7]。按现 `terrainHeight(29,7)=.6170756417647985`、rig基础+.04、炮口Y=`baseY+.17+.66*sin80°`，实际炮口Y约 **1.477048758752856m**（若terrain/rig改变必须重算，不能永久硬编码）。A候选：

```js
a.setFireworks({autoLaunch:false, autoFrame:false, elevation:80});
// 旧默认对照：不传height；同seed42 / 同type / 同I与palette
a.launchFirework({type:'ring', seed:42, flightModel:'apex'});
// 另一次已清理的episode：raise120→140m，绝非提前爆或补vy
a.launchFirework({type:'ring', seed:42, flightModel:'apex', height:muzzleY+140});
// strobe另作160→200m相同对照，不与ring叠发混成一项测试
```

当前rig对应ring显式worldY约141.47705；strobe约201.47705。须读真实event的origin/heightInfo/爆点vy核对，不能以导演预览 `rigY+.83` 的近似炮口替代验收。record从发射前至燃尽；固定UTC/天气、native wind0为第一组、相同camera/focal/C/源I，保持同一烟profile与field选择。主图和全幅水反射均应入画；先按实际event live getBounds人工选固定共同画幅，不依赖director只拟合默认height的预览，也不每发重新fit。

记录飞行时长、burstY/vy≈0、birth/life/drag、I01/I10最低Y、D(t)、声音事件时刻与烟reserved/airborne闭合。height改变爆炸时刻和源位置，声传播自然随之改变；不能强行把旧音轨保持在旧burst时刻。比较同参数重现的独立episode，不称同一绝对波面/同帧像素等价。旧240case/7项study支持这是优先作者候选，不是产品校准或烟火安全认证；本合同不把它推广默认。

## 核对源与primary

本轮未改运行时：lens `23432072…`，HDR `4ce6ba6f…`，main `dc776e45…`，radiometry `f9426456…`，FW `963bc4fe…`，physics `3bbac197…`。原近顶点研究见 `verification/fireworks/NEAR-APEX-ENVELOPE-REVIEW.md`。

[ACES输出变换结构](https://docs.acescentral.com/system-components/output-transforms/)明确区分rendering与display encoding；[Chrome extended canvas说明](https://developer.chrome.com/blog/new-in-webgpu-129/)说明extended不把颜色限制在[0,1]；[OCIO transforms API](https://opencolorio.readthedocs.io/en/latest/api/transforms.html)为接口参考，当前本机导出版本以固定2.6.0原始资产和源码为准，不把latest API文档当2.6.0数值证明。
