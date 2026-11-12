# 十种大型复杂烟花：参考与实施取舍

2026-10-31。只做资料与视觉方案，不改生产、不运行浏览器/GPU、不下载图片或视频。保留全部旧样式；新样式使用独立 ID。

## 证据边界

本轮直接读取了下列专业公司、官方烟火大会和教材页面。厂商页面中的效果名称、图片入口和官方示范视频链接已核对；**没有逐帧播放或测量这些视频**。表中的尺寸、时间、分层比例是本项目的初始美术/物理模拟目标，不是厂商测量值，也不是从普通视频反推的 SI 光度。搜索服务返回空内容，故使用只读 HTTPS 正文核对；不可访问的页面没有用作证据。

专业展示公司确实提供变色、套花、环形、牡丹、菊花、棕榈、十字分裂、闪烁、彗星与低空喷发等类型。[S1] Pyrogenie 的具体产品进一步证实：多种颜色、环与花芯可以复合，马尾可以转银闪，牡丹可以转旋子，游鱼可以与落叶和闪光底花组合。[S2–S8] 这些支持“效果类别真实存在”，不证明本项目每个组合在现实中就是同一枚成品。

## 十种建议配方

所有 `t` 均从主开花开始计，不含上升段；宽度为初始目标最大水平跨度，高度为主开花中心高于海面的目标。低空类型另列，不把低空扇形硬塞进高空球壳。数值仍须通过实际轨迹、接触裁切、镜头和预算检查。

| 建议新 ID / 名称 | 形态和明确的时序差别 | 初始尺度 / 发光时长 | 真实性、参考与实现决定 |
|---|---|---|---|
| `chromatic-crown-v1` 五彩星冠 | 对应用户参考：外层黄→红→粉→紫→绿；内层蓝紫首先熄灭；最后只留倾斜平面环。三组不是同时整体淡出。 | 宽120–140m；高210–250m；4.7s | 真实变色/复合环类别，**具体五色时序为创作组合**。[S1–S3] 首选主打款；环有独立寿命而非无限残留。 |
| `ghost-peony-v1` 幻色牡丹 | 稀短尾蓝色球壳逐扇区淡暗，再转红/紫；白色小花芯先灭。保持空隙，突出“消失再出现”，与第一款的连续变色区别。 | 宽100–120m；高180–230m；4.2s | Ghost/变色产品有依据。[S4] 暗隙是确定的燃烧时程，不能由随机每帧闪烁制造。 |
| `brocade-double-ring-v1` 双环锦冠 | 金色锦尾外冠转绿色端点；较小红色闪环与中心细小簇花组成三种空间频率。先退中心，后退红环，最后绿端点。 | 宽130–150m；高230–280m；5.0s | 厂商已有非常接近的复合名称。[S2] 固定两环各自平面，只给小随机姿态，不把球壳旋转当动力。 |
| `thousand-blossoms-v1` 千轮叠绽 | 一次母花散出若干子花中心，0.35–1.1s 分批开成小牡丹；子花颜色交错、寿命不同，中央不过分堆亮。 | 总宽130–170m；高240–300m；4.8–5.5s | Shell-of-shells 与官方千轮/二段咲有依据。[S1,S9] 子花数先取8–12簇；它是多次明确事件，声音/烟源/光源均须跟随。 |
| `golden-horsetail-v1` 金马尾银梢 | 主体向下张开的金尾束，尾长逐步展开，末端转少量银闪；不做完整均匀球面。 | 宽70–100m；高220–270m；4.8s | Golden Horsetail→Silver Strobe 是真实产品。[S5] 与柳类区分靠较紧的束状方向分布；下降靠阻力与重力，不给火星虚假浮力。 |
| `silver-waterfall-v1` 高空银瀑 | 一道宽而略弯的空中冠，银色长尾形成垂帘，下部夹少量蓝色落叶；顶部逐渐熄灭，帘向下延伸。 | 宽100–140m；高230–280m；5.0–6.0s | 依据银柳瀑布/落叶组合。[S6,S7] **这不是字面 Niagara**：真实悬挂式瀑布是有支撑发射线的持续下落效果；项目没有桥或支架，不凭空放悬浮发射排。[S10] |
| `chasing-rings-v1` 追光双环 | 两个倾斜环，环上四至六段依次明亮，外环金→红、内环蓝→紫；可见光段沿环推进，几何点仍各自弹道下落。 | 宽100–130m；高200–250m；4.5s | 真实环与闪环为参照。[S1,S2] **追光顺序是风格化编排，未找到本轮原始资料证明此精确成品**；不称刚体旋转环，不让整环无外力转圈。 |
| `v-fan-comets-v1` 对开彗星扇 | 离岛一处固定装置向两侧对称V形放3–5对彗星，左右错开0.12–0.2s，金尾红梢→银尾蓝梢；末拍垂直小底花。 | 扇宽40–70m；顶高45–80m；整段4–5s | 现实有 fan-shape、comet、mine 和扇形底花。[S1,S7,S11] 本项目短段是编排改编；用真实发射位置和带惯性的分次弹道，禁止整个扇面像网格一起漂移。 |
| `silver-tourbillon-v1` 银旋飞梭 | 先是稀疏红牡丹，再出现少量短时自推进银旋子；每个旋子留下弯曲细尾，0.5–0.9s 后熄火转纯弹道，中心红点更早灭。 | 总宽90–120m；高180–230m；4.5s | Peony→Silver Spinners、银旋子扇形产品有依据。[S8] “旋子”类别真实，**本项目规则螺旋参数不是测量拟合**；不把普通无动力星粒强行画成固定螺线。 |
| `blue-leaf-silver-fish-v1` 蓝叶银游鱼 | 蓝色落叶缓缓散开，8–16条短命银游鱼在其中分散游动，鱼0.6–1.0s 熄火；余下少数蓝叶/金闪慢退，运动方向和寿命有种子化差异。 | 宽80–110m；高170–220m；4.5–5.0s | Silver Fish + Blue Leaves + Silver Strobe 有直接产品参照。[S7] 游鱼与旋子不同：较不规则偏航、不同步熄火，不能每帧重新抽随机方向。 |

### 主打款的可验时序

`chromatic-crown-v1` 初稿：外层在0–0.8s偏金黄，0.8–1.6s偏红，1.6–2.4s偏粉，2.4–3.1s偏紫，3.1–4.0s偏绿，4.0–4.3s退光；内层蓝/紫在约2.0s前退尽；环在约0.15s后显露，4.1s后成为最后可见层，4.7s退尽。用短平滑过渡与各层有界的固定个体偏差，避免全体同时像RGB灯带换色。每个点的初亮、平台、衰减都独立但可复现。

亮度/能量占比不能从截图直接标定。先采用一个可解释的整体参考预算，在外层/内层/环间分配，而不是每多一层就无上限加一份同等预算。蓝紫的视觉饱和度、白芯剪裁和金尾能量分别检查；不能用 HSL 绕一圈或把所有颜色同峰值当作“化学模拟”。教材支持发射光谱与能级跃迁的基本关系，**并不提供烟花的颜色曲线、光强或燃烧时长**。[S12]

## 最小落地边界

- 先做静态几何/变色的1、2、3、5、6，复用既有粒子/燃烧/尾迹/接触系统；4为分层子事件，7需确定性点亮时序，8需真实低空发射序列；9、10才涉及有限自推进。没有证据支持把后两者伪装成普通球壳换一个位置公式。
- 旧样式、旧光度和已认可音效不改。所有新色变必须同时进入屏幕发光、烟/云/地表/海面照明、烟源时程和曝光账本；不能只改 sprite 颜色。固定种子决定相位/姿态，不引入逐帧 RNG。
- 烟量按效果分开：短尾牡丹较疏；锦尾/银瀑较多；鱼/旋子有局部烟；地面发射有小烟源。研究没有给出可测质量值，不能把所有样式乘同一烟量然后称物理标定。
- 单款先验：远近/斜视/反射、0.7/1.7/2.5s和熄灭末段、低角度接触、新尺寸包络、完整光源和烟预算；再做32场自动秀的成本检查。不能从新样式在空场单发通过推断32并发流畅。

## 已核对原始来源

- **S1 专业展示公司的效果谱**：[Pyro Spectaculars — Our fireworks and special effects palette](https://www.pyrospec.com/the-fireworks-special-effects-palette/)。页面列多种高空/低空效果并给其高空展示范围300–1200ft；本项目高度是其中保守的设计选择，非某件产品证书。[其官方作品入口](https://www.pyrospec.com/our-portfolio/)。
- **S2 双环/芯/变色复合**：[Pyrogenie — Brocade To Green Ring With Red Special Strobe Ring And Popping Flowers Pistil](https://pyrogenie.de/produkt/125mm-brocade-to-green-ring-with-red-special-strobe-ring-and-popping-flowers-pistil-and-brocade-rising-tail/)，厂商链接的[官方演示](https://vimeo.com/1020212635)。
- **S3 现实多色类别**：[Pyrogenie — Multicolor Peony With Silver Glitter Palm](https://pyrogenie.de/produkt/red-orange-yellow-lemon-blue-purple-peony-with-silver-glitter-palm-2/)，[官方演示](https://vimeo.com/395470162)。产品列多种颜色，**不等于同一个星粒按本项目五色顺序变化**。
- **S4 Ghost与水母复合**：[Pyrogenie — Blue/Red Ghost To Popping Jellyfish With Timerain Tentacle](https://pyrogenie.de/produkt/100mm-blue-red-ghost-to-popping-jellyfish-with-timerain-tentacle/)，[官方演示](https://vimeo.com/1123835815)。
- **S5 马尾转银闪**：[Pyrogenie — Golden Horsetail To Silver Strobe](https://pyrogenie.de/produkt/100mm-golden-horsetail-to-silver-strobe/)。
- **S6 柳瀑**：[Pyrogenie — Silver Tail To Silver Glitter Willow Waterfall](https://pyrogenie.de/produkt/silver-tail-to-silver-glitter-willow-waterfall/)，[官方演示](https://vimeo.com/344068542)。
- **S7 游鱼/落叶/闪光与变色落叶组合**：[Silver Fish With Blue Leaves And Silver Strobe Mine](https://pyrogenie.de/produkt/silver-fish-with-blue-leaves-and-silver-strobe-mine/)，[官方演示](https://vimeo.com/272798868)；[Blue Star to Red, Blue Falling Leaves and Gold Strobe Waterfall](https://pyrogenie.de/produkt/single-row-blue-star-to-red-blue-falling-leaves-and-gold-strobe-waterfall-3/)。
- **S8 旋子**：[Peony To Silver Spinners With Red Pistil](https://pyrogenie.de/produkt/red-peony-to-silver-spinners-with-red-pistil/)，[官方演示](https://vimeo.com/372245651)；[Silver Tail To Silver Spinner With Silver Strobe Mine](https://pyrogenie.de/produkt/silver-tail-to-silver-spinner-with-silver-strobe-mine/)，[官方演示](https://vimeo.com/261788788)。
- **S9 官方大型花火**：[片贝町烟火协会 — 祭典与奉纳烟火](https://katakaimachi-enkakyokai.info/enka_info.html)，页面明确列黄金垂帘/千轮二段咲；[官方视频入口](https://katakaimachi-enkakyokai.info/movie.html)。这里只借鉴类型与分层语言，不把四尺玉规模搬到小岛。
- **S10 真正下落瀑布类别**：[Pyrogenie — 35s 8m Waterfall](https://pyrogenie.de/produkt/35s-8m-waterfall/)，[官方演示](https://vimeo.com/200495303)。页面明确35s、8m落深，说明该持续瀑布与4–5s高空柳瀑不是同一效果。
- **S11 地面扇形/水边展示**：[Pyrogenie — Silver Fan With Color Pistil](https://pyrogenie.de/produkt/silver-fan-with-color-pistil/)，[官方演示](https://vimeo.com/272719862)；[诹访湖大会官方简介](https://suwako-hanabi.com/kojyou/overview/)明确湖上发射台与水上展示。本项目短时大扇形不是把该2m/60s底花无说明地等比放大。
- **S12 光谱原理**：[OpenStax / Rice University — Chemistry 2e §6.2](https://openstax.org/books/chemistry-2e/pages/6-2-the-bohr-model)。仅用于能级/光子/离散发射光谱的基础解释，不导出焰色配方、器材或绝对cd。

以上仅链接参考，不转载素材。精确视觉与性能验收仍未实施；本文件不是新增样式已完成的声明。
