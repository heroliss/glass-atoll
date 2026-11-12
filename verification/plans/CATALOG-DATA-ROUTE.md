# R2冻结稿：catalog-hybrid数据与合成契约

2026-10-26，研究阶段。根代理已传达用户明确选择**仅个人非商业用途、可用署名星表**。据此选I/239原Hipparcos + I/259 Tycho-2，不为网页不可见的额外毫角秒精度强加HIP2来源。未下载全表、未生成上线派生数据、未改runtime。

## 许可证据与用途边界已明确

这不是从页脚推断NC：[I/239 ReadMe](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239?format=html&tex=true)与[I/259 ReadMe](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/259?format=html&tex=true)本机最新正文，在作者End之前均写 **`License: CC-BY-NC-3.0 IGO`**。本地原文分别为 `assets/cds-hip1-readme.html:1130`、`assets/cds-tycho2-readme.html:376`。搜索服务较旧缓存漏掉I/259该行，已以直接下载原文推翻“ReadMe未声明”的早先判断。

[ESA目录正文](https://www.cosmos.esa.int/web/hipparcos/catalogues)的“License and credit”针对1997 Hipparcos/Tycho目录要求 **Credit: ESA**，不是通用网站图文页脚。独立HIP2 ReadMe未见显式license，故不据I/239随意推及作者新表，也不反向当作无限制。Gaia官方[专属Data License页](https://www.cosmos.esa.int/web/gaia-users/license)正文同样NC，不是本次的商用绕行；HYG作者发布CC BY-SA不足以在本轮消除其底层来源疑问，不进入已选数据通路。用户已选非商用途，因此停止这条额外查证，不擅自扩大网页用途。

研究raw与后续runtime派生应分目录保留源/hash/取得时间/列/过滤版本及各自许可证，不把NASA、ESA、作者和CDS一概写CC0。建议最小署名：

> Credit: ESA. Hipparcos: ESA (1997), ESA SP-1200. Tycho-2: Høg et al. (2000), A&A 355, L27. Catalogue access: CDS/VizieR, DOI 10.26093/cds/vizier. Catalogue data and derivatives: CC BY-NC 3.0 IGO. Milky Way visualization: NASA/Goddard Space Flight Center Scientific Visualization Studio, Ernie Wright, SVS4851; retain that asset's own source terms.

该NC记录只描述所取数据/派生的条件，不擅自给整个网页原创代码增加同一许可证。商业使用不能沿用本次个人非商授权。

## 已实取的小查询与单位

以下两条已各取5行到 `assets/hip1-query-sample.tsv`、`assets/tycho2-query-sample.tsv`，读取真实表头/units，不只照抄说明：

```text
https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=I%2F239%2Fhip_main&-out=HIP%2CRAICRS%2CDEICRS%2CRAhms%2CDEdms%2CVmag%2CB-V%2CpmRA%2CpmDE%2CProxy%2CCombMag%2CCCDM&-out.max=5&-sort=HIP
https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=I%2F259%2Ftyc2&-out=TYC1%2CTYC2%2CTYC3%2CRAmdeg%2CDEmdeg%2CpmRA%2CpmDE%2CBTmag%2CVTmag%2CHIP&-out.max=5&-sort=TYC1
```

| 数据 | 位置/epoch | 光度 | 不能混淆 |
| --- | --- | --- | --- |
| I/239/hip_main，118218行 | TSV `RAICRS,DEICRS`是deg、ICRS、位置epoch J1991.25；`pmRA,pmDE` mas/yr | `Vmag`为Johnson V、`B-V`；保留Proxy/CombMag/CCDM及质量标记 | raw ReadMe名`RAdeg,DEdeg`在当前VizieR查询中改叫RAICRS/DEICRS；请求错误名字会被静默省列，不允许继续用默认0 |
| I/259/tyc2，2539913行 | `RAmdeg,DEmdeg`是deg、ICRS、均位置epoch J2000；pm为mas/yr | `BTmag,VTmag`是Tycho通带 | `RAdeg,DEdeg`是约1991年**观测位置**，不是J2000均位置；缺均位置时保留其实际观测epoch/质量 |

两表的pmRA均已是 `μα cosδ`。先建单位方向与两个正交切向基，再用 `normalize(d+Δt·(pmRA·eRA+pmDE·eDec))` 做相应epoch的低阶自行传播，角单位转换一次；不要再给pmRA乘cosδ。此近似不含径向速度/透视加速，网页年代范围须有界，不宣称测量级跨千年历表。

另取HIP2五行发现：字段虽名`RArad,DErad`，当前ASU返回units却是 **deg**；raw hip2.dat本身才是rad。它不进已选首版，但这是“按列名猜单位”会放大57.3倍的真实反例。

Tycho近似转换按原[ReadMe说明](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/259?format=html&tex=true)：`V≈VT−.090(BT−VT)`，`B−V≈.850(BT−VT)`；这是通带近似，保留误差/缺色标志。缺BT而有VT时可明确fallback V≈VT、颜色白/保守默认，计入诊断，不丢掉其全部通量，不把Hpmag/VT无条件当精确Johnson V。

## 全表获取通路与已核体量

首版推荐**一次离线bulk原表 + 流式解析**；浏览器只拿派生结果，不在用户机器实时查CDS。

| 官方/数据中心端点，HEAD已200 | 已核bytes | 状态 |
| --- | ---: | --- |
| [I/239 hip_main.dat](https://cdsarc.cds.unistra.fr/ftp/cats/I/239/hip_main.dat) | 53,316,318 | 只HEAD；`.gz/.Z`猜测端点404，不把它们写成可用下载 |
| [I/259 tyc2.dat.00.gz](https://cdsarc.cds.unistra.fr/ftp/cats/I/259/tyc2.dat.00.gz) | 8,407,799 | ReadMe定义`.00`–`.19`共20片，前19片各127000行，尾片126913行；本轮只HEAD首片，不声称已测合计压缩量 |
| [I/259 suppl_1.dat.gz](https://cdsarc.cds.unistra.fr/ftp/cats/I/259/suppl_1.dat.gz) | 671,712 | 补表17588行，可填main缺项；suppl_2多疑似伪/扰动项不无条件加入 |
| [ESO Tycho bulk镜像](https://archive.eso.org/ASTROM/TYC-2/data/catalog.dat) | 528,301,904 | 作者页直接链接的数据中心备用端点；同样来源条款，不因镜像变NASA/ESO自有数据 |
| [NASA无Hip/Tycho银河4K EXR](https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/milkyway_2020_4k.exr) | 36,436,668 | 仅HEAD；4K首版足够，未下载/上线 |

若bulk不稳，可按列ASU分块：HIP用不重叠HIP数值区间；Tycho用TYC1的GSC区域区间1–9537，不用RA切片漏掉`pflag=X`缺均位置项。服务端取一批安全行数并显式验证无truncation/overflow；同一stable id去重校验。全表先取所需列，**不要仅用VT≤11.5预筛**再做Johnson V转换，红星可能被错丢。流式离线筛选比一个`out.max`超长响应更易重试/hash审计。5行查询证明列选择可用，不等于全表/分块已下载验收。

## 合并、分界和最小完整范围

不以坐标相同就当重复：实际5行Tycho样本 `TYC 1-17-1/2`具有相同均位置、不同通量，属于可有意义的分量。亮双星在当前PSF不可分辨时可以合并**积分通量**，不能只保留更亮一条，也不能HIP合成光度再加Tycho分量一次。

建议离线master规则需写入版本并输出逐项计数：

1. HIP原表优先提供有Johnson V的亮系统；源id/CombMag/分量关系保留。Tycho变换到约定V体系后，以HIP交叉id、组件标记和位置交叉核对。已由HIP合成光度表示的系统不再叠加其Tycho分量；多分量替换时明确移除系统光度后再加入分量和。
2. 8等是**来源优先区间**，不是两个独立不相容滤镜：HIP V=8.1/Tycho估计V=7.9等边界不能因一边只收<8、另一边只收≥8而双双丢掉。先合并master/查重，再按选定master光度划分。Tycho无HIP对应的<8亮星也保留。补表只补缺失stable source，不覆盖已选main两次。
3. 首版建议master到约定V≈11.5；运行时点源阈值先试V≤6.5，余下6.5–11.5**全部**离线聚合为保角通量背景。点/背景集合必须是同一个master的互补分区，交集0、并集等于master，不能只取几千亮星再忘记官方背景移走了整个Hip/Tycho层。若点阈值因成本改变，迁移通量到背景，不直接删星。
4. NASA作者额外补的18颗Yale星及典型变星/缺项要单列检查，不假设I/239和NASA的HIP2列表完全相同。已选I/239较HIP2多的行不按“extra”全删，也不把同名/双星抹成一颗。
5. 公开NASA说明没有给出完整生成代码与逐源交叉表；Gaia G与Johnson V的精确分界、极红/变星边界不能仅凭文字证明无任何重复/遗漏。必须保留该窄范围误差边界，做8/11.5附近和18补星清单审计。不能宣称逐条复刻了1.7B星的作者全流程。若严格重建该边界超出本轮，标“HIP/Tycho重建+NASA较暗背景近似”，不伪称完整银河绝对测光。

最小可行是**完成master与全部暗星聚合再换掉旧full atlas**，而不是只上线12颗实验星。派生二进制至少含点源 `stableId,dirEQJ,RGB integratedFlux,pmTangent,epoch,flags,phaseSeed`，背景含每级texel立体角/累积通量、源表hash和分界版本；全目录不必随网页发布。

离线聚合按 `L_texel=ΣF_star/Ω_texel`，RGB与所有mip按真实面积加权；在赤道/60°/89°做相同输入通量测试，不用普通ERP像素平均在高纬凭空加能。NASA银河层增益独立标定，星等约束仅约束同目录相对积分通量；没有实测相机通带/SPD，不称绝对lux。

## 入天空、云和反射的最小接口

候选共有一个源函数：

```js
stellarIncidentRadiance(rayEQJ, rayDxEQJ, rayDyEQJ,
                       physicalSeconds, exposureSeconds, viewKind)
// 返回物理relative RGB，尚未乘空气/云透射与scene storage exposure。
// 同目录：narrow point core + 保通量的较暗源/银河背景。
```

它在sky的clear celestial incident部分、**体积云积分之前**调用。clear-air消光恰好一次；cloud march与透射统一遮挡点/暗星，星不会贴在云前。主视图、镜面反射、cube捕获使用同源数据/UTC快照和其自身射线足迹，不能用主相机屏幕RT冒充所有方向。环境存角通量/辐亮度，不烘入主相机的景深与宽PSF。

root希望免去全frame starRT时，首选**预建方向cube-tile候选表的窄原型**：将点源保守复制进其最大kernel support覆盖的tile，每个fragment只查当前tile一次的offset/count，再查少量星；不用每像素遍历全目录，也不以ERP固定3×3邻域在极区漏星。跨cube face边、极区、亚像素相位和最大FOV/q足迹必须覆盖。记录真实最大候选数，无静默固定上限截星；自行/时间导致出tile support时重建或扩大保守范围。

这通常只需两类紧凑texture：tile headers/indices + star records。是否便宜由真实数据候选密度和GPU证明；不承诺“.5ms”。若全skyfragment查询反而贵或核积分困难，再选一次小成本point-field RT，让相应view的sky在march前采样；主/镜面/cube各用正确view数据。**首轮不同时实现两套后端**，先验证tile原型，不因避免一个RT而接受漏星/每像素几百次纹理读取。

窄点核只做像素覆盖/明确的一次有效窄PSF，已有全图宽镜头散射与DOF不再各烘一遍。必须以归一核积分通过不同星等、焦段、q、滚转/亚像素相位和cube texel的通量检查。capture/storageEV沿用独立标签/快照；源数据与相机EV不互相改写。

## 用户要求的默认弱闪烁

本轮R3选择**默认弱、连续、快门平均**，不再默认彻底关闭。建议RMS约.03作为明确的有效模型调节量，非当地测量：seed依stableId，几条互不齐相的连续频段、总调制有界且均值1；正弦项的曝光积分乘`sinc(πfT)`，物理秒控制相位，UTC rate不改闪速。不能每帧random、不能随机改几何位置、不能让银河背景整体眨眼。

seeing/闪烁不是同一现象，缺Cn²/真实高空风剖面时不声称严格当地大气湍流；本地RH/海风只可作公开的弱参数联动。长曝光应衰减高频，30/60/120Hz同一物理时刻应一致。扩展日/月不套同一闪烁。弱星FP16下溢、burst/近灯时storage P变化、同一条空气/云透射是否执行一次，仍是实现后的GPU门。

## 实施门与冻结状态

- 全数据清单/hash/license、master计数/缺色/缺位置/合并分量/8与11.5边界、18补星单独输出；目录子集/聚合并集与源master可复算。
- 目录暗星0/60/89°积分、5等100倍、同一星不同亚像素位置/24–70mm/q守恒，不靠变暗或放大降低闪动。
- 点星与diffuse同时过云/消光；main/reflection/cube及预曝光epochs一致；低帧率闪烁可重现、曝光积分有效。
- 固定UTC、观察者、相机、天气快照/物理时刻、输出尺度做性能A/B；另测UTC加速和capture年龄。数据存在/数学通过不代替GPU成本、真实夜景与弱星观感验收。

至此研究接口可冻结。所有新文件仅在verification/plans；未开启全catalog下载、未动runtime、不在用户用途明确后继续扩查商用替代。
