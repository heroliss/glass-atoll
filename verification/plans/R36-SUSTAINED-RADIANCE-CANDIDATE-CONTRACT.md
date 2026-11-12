# R36：持续星光候选合同（只读方案，未实现）

保留R35的 `three-heart-scale120-v1` 和所有旧profile。下一候选应独立命名，例如 `three-heart-scale120-radiant-v1`：相同192主体、相同寿命/随机性/3D径向尺度和接触模型，用明确的作者参考光度目标替代旧5–10参考cd/星的归一化目标。不是burst flash，不改相机EV、夜间ambient、系统HDR峰值或已认可音效。

现有1×是**未测量的作者参考**。建议首个可归因对照仅采用固定 `authorOpticalGain=16`、原尾迹配方。这个16是供外观审查的设计选择，不从“某些闪光超过30000cd”、实验药柱或在线视频饱和RGB推导，也不声明为这枚礼花的实测倍数。先保留原I(t)形状，再独立比较更长/更多金尾；否则无法判断改善来自光度还是尾迹覆盖。

## 已有源强究竟如何衰退

`r36-sustained-star-photometry-audit.json` 是实际生产factory的纯CPU采样，共29个0–5秒时刻，quality8，与R35同seed/方位/仰角/旋转/风。未创建renderer/context或运行GPU。所有正发光记录与cluster总RGB闭合，SH输入Float32总RGB最大相对误差1.18e-8。+.70和+2.50的总参考强度/颜色与保存的R35实景状态相符。Node径向alpha与浏览器值相差4.44e-16，单独记录并保留最初严格相等fixture失败；本报告不是跨引擎严格物理重放准入。

以下Y是参考cd解释下的光度权重，不是绝对SI标定。零时刻尚有约1.609参考cd的旧rocket尾迹，星头/星尾均为0，不能把它当burst flash。

|爆开后秒数|星头Y|星尾Y|全部源Y|参考RGB总量（约）|岛中心受光，含280m截断|最近云底入射上界，无消光|
|---:|---:|---:|---:|---|---:|---:|
|.04|1192.804|51.847|1245.822|1895.57 / 891.31 / 2844.28|.01788|.002844|
|.70|1087.368|188.815|1276.183|1958.22 / 938.18 / 2616.02|.01662|.002896|
|1.00|1030.901|178.218|1209.119|1828.88 / 896.46 / 2481.32|.01544|.002728|
|2.00|779.869|128.183|908.052|1088.24 / 741.35 / 2028.78|.01167|.001992|
|2.50|536.042|76.482|612.524|357.28 / 603.77 / 1450.79|.00806|.001321|
|3.00|357.645|49.757|407.402|142.33 / 462.56 / 641.54|.00549|.000862|
|3.60|167.539|28.683|196.221|62.90 / 254.72 / 9.35|.00277|.000405|
|4.00|101.925|17.976|119.901|39.38 / 155.36 / 5.75|.00173|.000244|
|4.60|13.232|3.010|16.243|6.55 / 20.68 / .83|.000231|.000032|
|5.00|0|.002807|.002807|.00692 / .00186 / .000063|4.05e-8|5.31e-9|

“参考照度”假定当前参考cd可作SI、各向同性event点矩代理、没有空气/云/烟/几何遮挡；岛面还包含入射余弦。它不是实际像素或测光。云底采用R35保存的812.956m。完整分层RGB、头尾分配、RMS半径与每时刻距离保存在JSON。

原尾迹分配为outer6%/D.10s、middle14%/D.20s、inner24%/D.32s；其余留在头部。瞬时tail比例受过去release时刻的I(t−lag)影响，不能把每帧tail/source比固定解释为这些百分比。颜色降温曲线有单位Y，金色RGB和头部彩色RGB不同。

## 唯一增益接缝与真实预算

当前compiler会把任何模板的峰Y重新归一到native body.intensity。因此只把模板RGB乘16会被归一化**完全抵消**。候选应明确：

1. 先用原pre-gain模板完成几何的2.5s/10% gate与alpha求解。保持运动、I0随机序列、192ID、物质量调度和burst/launch事件完全相同。
2. 定义 `nativeI0WithUserGain=body.intensity`，`derivedReferenceI0=nativeI0WithUserGain*16`。向量burnProfile的RGB峰归一到derivedReferenceI0，`emissionReferenceI0`也必须是这个derived值。已有user intensityScale只出现一次；0×仍是全暗。
3. 可以保留physics body.intensity为native值：当前向量shader读取rgbTaps，不依赖scalar shape.z；head/all-phase读burnProfile，tail实际I读sampleBodyEmission，接触tail的上界及opticalView尾上界显式读emissionReferenceI0。但必须审计并标明 `unmodulatedIntensity`、上传shape.z等旧native诊断字段，不能将其误称为候选峰值。若选择改为derived值，也必须证明不会再次增益或改变材料/几何输入。
4. 新profile公开 `nativeI0Budget`、`authorOpticalGain`、`derivedReferencePeakBudget` 和当前实际源RGB/Y；不能仍声称最终峰预算1421.293不变。几何radialScale中的原input budget仅代表pre-photometry输入，不能冒称最终发光预算。现有“native I0、no second gain”的归一化文字要在新候选改成真实的新策略。
5. renderer、local、cloud、ledger或SH后端都不再乘16。它们统一消费上述derived源值，`RAW_PER_CANDELA`仅转raw一次，P仅用于存储并在输出解除。auto/manual cameraEV与HDR/SDR显示变换不为候选暗中调整。

在**尾迹不变**的对照中，固定16会使本canonical案例+.70当前源Y为20418.94、+2.50为9800.38、+4为1918.41；全部峰目标预算22740.69。理想岛中心参考照度相应约.266/.129/.0277，最近云底无消光入射约.0463/.0211/.00390。不是承诺这些值就能通过照片感或让高云如大型密集烟花表演一样明亮。初稿24k canonical目标提案已归档，当前建议固定16，不根据机位或接收点距离实时求解源强。

## 更长金尾必须作为第二个对照

候选配方可先限定在现有D≤.35s的已声明域：例如outer fraction.20/D.30、middle.26/D.35、inner.32/D.35。使用独立recipe ID，沿用有界单位Y gold-cooling曲线；不改物质量、烟源数量或星体寿命。正tail权重需完整归一：更多尾部必须从head份额扣除，不能保留整颗head再额外加全额尾迹。

与原配方比较，outer尾时长3倍、分配3.33倍，配合16参考光度时尾迹单位长度不会被无意稀释成几乎不可见的细线。实际场景仍需看近/远图与连续过程。这些是作者外观参数，不是实测粒子温度/燃烧或真实尾迹长度。

该配方改变瞬时head+tail曲线的滞后分配，不能要求每帧精确等于原总Y×16；应核验完整时间域光度Y积分的份额守恒以及每阶段真实账本；这不是RGB谱辐射能量或燃烧能量守恒声明。原有live validator还精确要求 `layered-gold-v1`，新recipe必须显式准入并重新证明lag/shutter/stretch包围。D不超过.35避免本轮扩张旧时域上界；仍不能只换recipe名字而绕过validator。

## 接收者与独立模型缺口

同一derived源必须到达：主眼/镜面source raster与sourceT输入；完整emission ledger→resolved smoke SH；event moments→local native PBR、叶片透光、water direct/specular、air、transient GI；cloud source→cloud→eye两段透射；烟的完整与明确fallback路径；全通道/全阶段radiometry bounds/reactive masks。Resolved smoke不可再叠加同一cluster份额。瞬时receiver照明与source raster因果快门积分仍是现有近似，不冒称全时域光输运。

R35变宽使RMS半径从+.70约17.43m升到+2.50约43.16m，同总源强在cluster近场会更分散。custom water/air/cloud使用max(d²,R²)，native Three PointLight使用punctual1/max(d²,.01)，resolved smoke使用每条独立源的有限variance；这些不是同一近场模型。本次岛/云距离远大于R，近场差异不能解释全部黑暗，也不能通过抬G来伪称修好了它。

Local/native/custom water/air/GI仍有280m有限范围：本例+.70岛中心cut约.61146，而云底距离约664m，local类路径严格为0；cloud自身没有同样硬截止。持续增亮不修复这个传播差异。本轮先保留cutoff以归因，后续单独比较一致的无硬截止inverse-square策略；不要补constant ambient或跳过真实消光来“照亮所有东西”。

## 最小准入

CPU阶段只需有意义的同源核验：旧profiles全部不变；0/1/2userGain与author16的作用顺序；几何alpha/头ID/寿命/材料/烟调度/audio不变；实际头尾RGB、光账本与所有receiver输入闭合；每head emissionReferenceI0包住所有Y峰；全RGB/快门/接触上界不低于实际；新tail完整积分及有限支持；容量失败原子且不删源。

增益本身不增加逻辑sources/烟包，但raw radiance、P、安全界与可见/反应区域会改变。长尾仍可维持每body的8节点预算，实际fillrate和源投影覆盖会扩大。4m/request、1m/map、8maps及原设置保留，先记录真实完整请求，再做固定camera/exposure/源/烟的近景+远景HDR/SDR对照。此前41帧pause收敛的reused SH不是fresh bake性能证明。没有GPU结果前，不声称帧率、照片感、实测cd或物理能量校准通过。
