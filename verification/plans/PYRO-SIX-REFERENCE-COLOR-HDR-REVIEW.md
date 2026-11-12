# 六张实拍输入：尾迹、烟、颜色生命周期与HDR/SDR输出

2026-10-27。只读图像/源码/primary技术研究；没有改runtime、光强、声增益或HDR曲线。timed3 actual为另一个单参实验，不在此混改。以下六图已逐张用图像工具实际查看像素；不是只读文件名。仅保留用户本地输入引用，不擅自下载/再分发其它照片。

## 1. 六图能支持哪些视觉目标

所有输入均为8-bit RGB PNG，只有IHDR/IDAT/IEND，无嵌入曝光/色彩/HDR metadata。它们可能来自已经tone-map/调色/压缩的视频或截图；无法恢复原拍摄曝光、原HDR、cd/nit、米制尺寸或瞬时火焰体积。六张不是同一实体的连续时间序列，不能据此断言一颗具体星如何逐毫秒变色。

| 实看输入（本地路径） | 可见特征及可信分类 | 不可由单帧认定 |
|---|---|---|
| [ddaa7e14](C:/Users/herol/AppData/Local/Temp/codex-clipboard-ddaa7e14-5db3-44e5-a5b0-79f439547c67.png)，1243×634 | 大量蓝白亮点和很长的细蓝下垂丝，少数橙金束形成明显色/寿命反差；底部另有较厚软烟。 | 细丝可能含发光碎屑的运动/曝光历史和被照细烟，不能全部判作同样宽度的实体烟管；点阵也不自动等于真实star数。 |
| [0815abfc](C:/Users/herol/AppData/Local/Temp/codex-clipboard-0815abfc-5468-4070-8a71-5afeff90c8af.png)，1257×701 | 多个径向白亮直线，中心强烈白化/溢光；周围及前景大量粉白软团和细扭曲带，前景建筑/灯提供遮挡层次。 | 中心白片不是巨大的均匀发光球；长线不等于瞬时整条都在燃烧；白化可能来自源、快门叠加、传感器和显示剪切。 |
| [86d189fa](C:/Users/herol/AppData/Local/Temp/codex-clipboard-86d189fa-1ca7-48bb-b907-11fd68f96e89.png)，1251×640 | 下层红粉色发射和烟幕，地标上方红色软层较厚，远处背景大范围被照亮。 | 上层块团可含历史烟或天气云；没有时序/气象/距离信息不能把整层确定为气象云，更不能据此反推本站813m云底应有同亮度。 |
| [844d9a52](C:/Users/herol/AppData/Local/Temp/codex-clipboard-844d9a52-2e24-48f7-af61-dcdcd8708627.png)，1257×703 | **紫红亮头＋细金尾同帧并存**，上下层效果不同；地面扇束较短、上层爆开较宽，粉色烟团遮部分尾迹，水中有截取的倒影。 | 不足以反推出每条金线的准确燃烧秒数；粉烟不等于物质本色粉红，更可能随当前光源改变。 |
| [524ebe7b](C:/Users/herol/AppData/Local/Temp/codex-clipboard-524ebe7b-3039-4e2c-9339-018704224c58.png)，1225×707 | 蓝点/蓝色小簇与白金短爆、局部红光并存，跨画面的低频烟幕没有被每颗点单独切成同样棉球。 | 不能从散点数量反推当前单发120star，也不能从烟中红斑反推材料自发红光。 |
| [5b5309af](C:/Users/herol/AppData/Local/Temp/codex-clipboard-5b5309af-79c9-4c48-ac9e-df0fe6ad82fc.png)，1096×675 | 近地金色喷发/彗星，炮口附近小而亮的橙色烟/火光，向上较细稀疏金迹，背后大部分仍黑；与大空爆白幕明显不同。 | 不代表每个mortar shell上升时都具有发动机大烟柱。橙色炮口团也不能全当自发光燃烧体积。 |

SHA256依上表顺序：

```
a509d67d7e7e9fc7ec6e326bc614c64179520b9e5d2eebbc0e7d8f71be9827cc
5fa09735ffcd7a193d24dbac8cd659dbd1a1424fe3ce39fe96b119f3e365200c
85bb56b228fb84581ef08d7886978feb21f352df50a192d5606c9a744ebf579a
188c2f4cad78efe5733bec48382379fc713e74507eaa601a6c56c4f7954c1d70
08f9d88f2241b34ac867b7dbf4369402bf1d9b7aee0cf95e7a8124c743e3875f
d7c8c7a942f7964ff6678b812edea79cd99f37d2c19db92a5084452af262b543
```

可取的目标是**不同类的尾迹持续时间、亮头/余烬颜色、排烟位置/量和时程不同；同一旧烟由新源重新着色，光灭后不随star立刻删除**。不是让每类都配一整屏白幕。参考中有多发/多层叠加，本站最多两主事件的画面不能仅靠给每发加独立cloud gain来冒充同样的总光与总烟。

## 2. 当前源码已有什么、真正缺什么

本轮快照：`fireworks.js=963bc4fe…`、`fireworks-physics.js=3bbac197…`、`hdr-output.js=4ce6ba6f…`、`lens.js=23432072…`。实际完整hash保存在下节JSON。其它agent的timed flight/metadata窄改不等同于新增色彩生命周期。

| 当前位置 | 实现事实 | 边界/缺口 |
|---|---|---|
| physics `emissionColour/EMISSION_PROFILES`，约`:73–100` | 作者谱带或2850K热谱→近似CIE→RGB；负通道加中性色后归一Y | 非实测烟花SPD、非完整光谱RTE；该gamut近似已改变色度。黑体不能单独生成窄谱蓝绿/紫。 |
| physics `body/overrides`，约`:159–185` | 一颗body的colour在创建时固定；笑脸不同部位可双色；willow用thermal；其它类别有固定palette | **没有随body年龄变换谱带/颜色的API**，不是每型已有多阶段变色。 |
| physics `starEnvelope`，约`:128–134` | .028s点亮、按age衰减、末期衰减，strobe有独立频率/相位 | 有亮度生命周期，不能报告“亮度完全固定”；亮度变化与颜色变化不是一回事。 |
| `fireworks.js:245–259` | head用body固定色；所有tail固定thermal。trail/rocket分出34%；willow/palm/rocket/其它tail window=.88/.62/.50/.35s；余烬有自身gravity、drag1.35、出生速度为当时star速度的.25 | 已能有彩头金尾，**不能误称头尾全同RGB**。但所有tail同一种固定热色/34%和有限几档时程，无法表现多种冷却/材质余辉。tail sample数是积分质量，不是排烟实体数。 |
| 同文件`:319` | 快门8个年龄样本目前只取亮度envelope，colour属性仍单个RGB | 新变色若只改当前RGB，会漏快门跨phase边界的色积分；不能只在fragment屏幕染色。 |
| `getEmissionLedger/getLightClusters/getRadianceBound` | 从真实head+tail rawRGB共享发光及受光/预算 | 这条一致性需保留：可见变色后，烟、云、地表、海和GI不能继续用旧色；但烟M仍独立于亮度。 |

建议下一阶段一个小而同源的光谱/发光接口：`sampleEmitter(body, age)`与`sampleEmber(body, emissionAge, emberAge)`返回该时刻的非负reference RGB强度、source radius和profile标签；可选用“参考cd＋单位Y色”表示，但必须管住蓝色高最大通道。`rawPerCandela`只在既定入账点乘一次、P只在存储端乘一次。先用少量有来源/作者标记的profile，不做十类每帧随机换色。

head变色层与热余烬不是同一对象：一条旧金尾可以是此前释放的热碎屑，颜色/亮度取决于释放时刻与之后冷却；不能一律把历史tail全部改成当前head RGB。用预计算光谱/年龄LUT可以避免每record实时积分380–780nm；若沿用RGB作者曲线，明确是光谱家族近似。后续颜色、亮度和尾fraction曲线会改变总光预算，须先定义保持什么，不能说换色天然守恒真实J。

入账/缓存合同：当前age、tail过去age、快门tap、主/镜、clusters/ledger、smoke resolved field、cloud/GI和rawbound必须读取同一发光定义；当**只有RGB phase变化而位置未变**时也应更新账本version/受光和界。bound应覆盖整个快门窗口的RGB最大值，不只当前相位；拒绝在蓝色中途出现更高通道时仍用旧色的P预算。`smokeClass/yield`与光profile分开，不由strobe暗帧、tone-map白芯或audio energy决定物质率。逻辑源覆盖合同另见[源图复核](PYRO-LOGICAL-SOURCE-GRAPH-REVIEW.md)。

## 3. HDR独立诊断：颜色偏移发生在哪里

[CPU夹具](../fireworks/hdr-emission-drt-study.mjs)已实际执行**6/6**，[完整数值与源码hash](../fireworks/hdr-emission-drt-study.json)。5个实际作者profile×exposed levels`[.0001,.001,.01,.1,1,10,100,1000]`，固定exposure1、诊断paper white203/peak1000/browserSDRwhite203。203/1000是这次诊断参数，**不是用户显示器实测nit**。

保留了：作者SPD→CIE→线性RGB在neutral-add之前的中间值、生产正值profile、原始曝光后RGB、fitted final-clamp前/后、当前HDR函数、以及“只移除final-clamp”的诊断输出。后者不是获批候选。

以实际blue为例：

| 阶段，level1 | RGB/比例 |
|---|---|
| 生产单位Y源RGB | `[.484698554,0,12.423172957]`，R/B=.03901568 |
| fitted最终clamp之前 | `[.952808487,.236825882,1.044194813]`，R/B=.91248154 |
| 当前HDR线性canvas输出 | `[4.693637867,1.166629961,4.926108374]` |
| 只移除fit clamp再加旧tail（诊断） | `[4.535309886,1.127276655,4.970303188]`，已超过本次4.926108374 headroom |

**不能把问题全归咎最终clamp。** R/B的大幅变化在fitted本体后、final clamp前已经出现（比值改变约23.39倍）；只删clamp不能恢复输入色，也可能破坏输出上界。不同曝光下源RGB比例不变，但拟合curve及矩阵/压缩改变显示比例；level100时各profile已接近白上限。因此“像素从蓝变品红/白”不能直接解释为真实火焰变色。RGB/xy比例诊断也不是绝对感知色相测量：显示gamut、适应亮度、目标峰值和OS映射仍需实际观察。

这6项仅证明数值路径/因果位置及文件未改；不是GPU parity、HDR显示正确校准或视觉通过。

## 4. 当前显示链审计

- `lens.js:328–339`：同一个scene-linear float链经air/DOF、finite effects、归一PSF、SMAA后分支。HDR从**OutputPass之前**的float result呈现；SDR走OutputPass及可选FSR。此处已保留统一输入，不能误报目前是“把HDR截图clamp成SDR”。
- `hdr-output.js:157–225`是Three r180 fitted SDR ACES anchor加作者bounded highlight tail，源码自述**不是官方ACES HDR Output Transform**。不能把成功保留`>1`或无GL错误称为correct HDR calibration。
- `hdr-output.js:330–360,414–436`用rgba16float、extended WebGPU canvas；原生float外部copy经过实际`>1`probe，否则PBO→CPU上传。不是WebGLTexture直接共享/保证zero-copy。HDR采样/上传/桥接成本与CPU延迟不应忽略。
- `scene-radiometry.js`已经分开camera C和storage P。`Lstored=2^P Lraw`，摄影补偿`.76×2^(C−P)`。HDR/SDR分支应保持同一Lraw/C/P语义，不为HDR单独乘scene gain或提高烟花I。
- `main.js:488`公共`a.screenshot()`明确强制`{sdr:true}`再toDataURL。这样的PNG是**SDR证据**，即使HDR UI显示开启也不能代替真实HDR外观。普通compositor截图/视频仍可能被系统down-map；不能拿8-bit白值推用户显示器nit。

## 5. 独立DRT门与primary依据

[ACES官方Output Transform说明](https://docs.acescentral.com/system-components/output-transforms/)将scene-referred rendering与display encoding分开；[官方presets](https://docs.acescentral.com/system-components/output-transforms/parameters/)按目标gamut/峰值/encoding定义输出。[ACES2 chroma](https://docs.acescentral.com/system-components/output-transforms/technical-details/chroma-compression/)与[gamut compression](https://docs.acescentral.com/system-components/output-transforms/technical-details/gamut-compression/)不能用逐RGB硬clamp替代。采用官方代码/LUT需记录版本、输入色域/白点转换、shaper、LUT误差及许可；给Three fitted曲线换个名字不等于ACES2。

[Chrome官方HDR介绍](https://developer.chrome.com/blog/new-in-webgpu-129)与[MDN configure](https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext/configure)确认rgba16float＋`toneMapping.extended`允许SDR白以上的输出，实际显示范围仍受屏幕/浏览器链限制。这是呈现能力，**不自动给游戏relative RGB绝对nit或真实photometry**。sRGB HDR也不等于已经具有P3/Rec2020宽色域；当前谱→RGB neutral-add造成的色度损失无法仅换canvas标签恢复。

[ITU BT.2408-9目录](https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BT.2408-9-2026-TOC-HTM-E.htm)本轮已确认03/2026版本包含reference white、HDR→SDR及监看章节；本轮完整PDF超时，未假称逐段读过。HDR reference white203的常用指导可见[ITU BT.2408-6官方文本](https://www.itu.int/dms_pub/itu-r/opb/rep/R-REP-BT.2408-6-2023-PDF-E.pdf)，不是所有显示设备/内容必须用同一实测白点。[ITU BT.2446-1官方说明](https://www.itu.int/pub/R-REP-BT.2446-1-2021)给HDR/SDR转换方法，进一步说明压缩需明确转换，而非clamp。

建议可执行范围：

1. **本轮先保持HDR runtime不动**，只完成timed3相同源/烟的actual A/B，避免飞行时程与DRT两个原因混在一起。
2. 下一轮固定同一float master、摄影C、发光I/RGB、PSF和同一物理phase，先在实际HDR链调好target peak/reference white的视觉层次；SDR从该**scene master/同一look**另走目标显示变换并做trim，不取已映射HDR截图再clamp。
3. 候选A：有来源/版本的ACES2输出LUT或shader，显式处理linear-sRGB D65到其要求输入的矩阵/适应；不能直接把当前RGB当ACES2065-1。候选B：可解释的luminance tone scale＋hue/gamut压缩，明确作者DRT、非官方ACES，仍需饱和发射色/日景验证。interface另做成本/候选反审，本报告不擅选更换。
4. `peakNits`、`paperWhiteNits`、`sdrWhiteNits`分别参与峰值、漫反射白锚与browser/Windows相对白的映射；系统/驱动报告不是测光仪。禁止每个profile各调一次曝光、自动拉满蓝色亮度或借去云/变烟掩盖DRT差异。
5. 成本必须实际测：完整ACES2色貌/gamut处理比旧fit复杂；预烘LUT可把运行时收敛为shaper＋少量纹理采样，但需要显示profile/LUT存储及精度验证。新增sampler仅在post pass，不应触碰已满近水sampler；真实HDR桥接/上传/刷新成本另计。不可承诺免费、不影响日景look或所有设备60fps。

### 最小验收矩阵

- 数值：固定source RGB，跨曝光16档、红绿蓝黄/热色及neutral ramp；看tone scale单调、目标peak/白点、gamut边界与NaN/负输出、同色高光偏移。保留官方参考或高精度CPUoracle，不把自己的shader镜像当独立真值。
- 同场：noon白沙/天空、月夜、暗夜、小亮点/密集重叠/照烟；同master/C/P下HDR与SDR分别输出，不修改物质或I。记录真实output format、transfer/primaries、OS HDR/显示参数。
- 时序：同一body的phase/RGB，head与过去tail的颜色，所有shutter样本、ledger/cluster/受光同步；I变化和真实色变与DRT造成白化分别标记。
- GPU/性能：主+mirror finite范围/FP16界、实际显示呈现时延、p95而非只孤立LUT成本；正常硬件能力失效时回SDR并明确状态。
- 视觉：六图只作为形态/相对层次参照；最终真实HDR由用户看实际HDR显示链验收，SDR另给同master输出。没有显示测量时不宣称绝对nit、真实产品光度或完整spectral calibration。
