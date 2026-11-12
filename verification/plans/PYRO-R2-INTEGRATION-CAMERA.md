# 烟花R2：光路、合成与导演镜头独立审查

2026-10-27。承接[总体路线](PYRO-R2-ROADMAP.md)与[持久烟方案](PYRO-R2-PERSISTENT-SMOKE.md)。除root另行批准的纯pose导演模块外，本稿只研究，不改renderer、main、UI、云、水或光源。A形状/高度及HG窄修由root/reference拥有；不能以A通过宣称照云、持久烟、反弹或镜头全部完成。

**最小顺序：C0导演独立接线；B0统一原始源与预算；B1选择并验证唯一烟/空气合成协议，再做B2瞬态照云及镜像；B3有界一跳；镜头ghost最后。** 不建议把以上同时塞进一次视觉补丁。

## 1. 当前实际到哪里

| 源码位置（本次读取） | 已有能力 | 不能扩大成的承诺 |
|---|---|---|
| `fireworks.js:201–211` | 最多2个当前星/尾迹加权簇，以当前发光强度照短烟；有有限源半径 | 不是持久烟、分布式所有星的逐源照明或完整自遮挡 |
| `local-lights.js:74–75`、`aerial-perspective.js:123–136` | 两簇进入native PBR、水/air共享槽，默认range280m；air有Rayleigh/HG局部源项 | range是计算截断，不是280m以外光物理消失。云底约数百米，简单加range不会自动照云 |
| `sky.js:394–438,557` | 云沿日/月方向取三点自遮光，最后乘一次`uSkyPreExposure` | 没有有限烟花点光；`uCloudLightStrength`不能改成烟花增益，否则会改整片日月云光 |
| `fireworks-physics.js:132–137,147–170` | event active内的7/18团短烟、8.5s年龄fade、风段裁剪 | 不能改life=1800来实现分钟烟：会占发光槽、扩大排序/上传/风史与bound成本 |
| `fireworks.js:132–175`、`lens.js:328–335` | opaque TAA→air→DOF→有限效果→一次PSF→SMAA→输出；main效果手动opaque depth，mirror走硬件depth | effects已有自己的有限air段，不能再让同段空气/同份烟被另一个pass重复积分 |
| `indirect-lighting.js:201–206,256–279` | 静态surfel几何、仅方向日/月入射，低档2Hz/高档4Hz，SH缓存约.18s混合 | 不是烟花一跳；照搬此节奏会漏短flash或出现滞后残亮 |
| `environment-capture.js:29–32,126–140` | 固定[0,2,0]双cube、12faces/s、独立captureEV和原子发布 | 6面约半秒，不能冻结瞬态flash进长期cube/PMREM，也不能每发全重建 |
| `optical-bloom.js:9–20` | 1.8%无阈值线性HDR PSF重分布；`lens.js:331`只调用一次 | 不是额外可无限叠加的发光源，更不是HDR显示亮度校准 |

另一个实质语义风险：`fireworks.js:205`的`pathFlags.specular=false`只是metadata；native PointLight路径并未读取它。不能继续宣称所有native接收者已“禁用烟花specular”。合同必须选择保留物理PBR响应并纠正文案，或明确实现路径限制；不能让注释替代实际材质行为。

## 2. B0：先有一个原始光源账本

建议固定每物理时刻最多2个有限簇：`id/position/radius/referenceCandela/linearColour/envelope/sourceBounds`。来自真实当前星/尾迹源，独立于可见性、相机C、存储P、bloom和tone mapping。主/镜像、surface、air、cloud、smoke及GI派生同一份状态；预算用保守包络，着色用当前envelope。源参考未实测，仍是作者标定，不因用了I/r²就成为绝对测光。

各消费者选一种明确单位：CPU/raw使用`RGB×I×RAW_PER_CANDELA`；现local uniforms已经乘sceneScale，使用它们不能再乘P。sky/cloud末尾统一乘P，那里应接**raw源**，不能把已预曝光local RGB直接加进去。C、SDR/HDR显示映射只在最后。

光程区分：source→smoke/cloud的Tlight与smoke/cloud→eye的Tview是两条路径，分别出现不是双计；把已经到屏幕、已含source→eye消光的火星RGB当作原始灯，再传播一次才是双计。只有手电有共享局部阴影，当前地灯/簇的可见性仍属近似。

`main.js:634`旧medium=`.25*local.maxRGB`不能直接给新相函数背书。新界应按有限半径的最大入射、`phaseMax`、SSA≤1及`(1−T)`构造；多源按RGB各通道最坏重叠相加。g=.76 HG峰约2.43/sr，不能因为典型角很暗就用.25代替最坏界。更新P必须在首次变亮draw之前；main/mirror及新cloud/smoke/GI都纳入，不能只检查可见星。`scene-radiometry.js:18–29`的P降低/补偿与C分离机制保留。

## 3. B1：持久烟先定唯一光路

支持独立干质量/中心/协方差/热状态库，不支持延寿旧records。无风不按年龄删质量，30min是验证时域；发光槽、星源bound和getBounds不遍历全部旧烟。烟库增量推进并保质量合并；物理存量、渲染cache、radiance bound和相机排序分别有revision。冷烟自发光为0，后来烟花可以重新照亮旧烟；不能保留出生亮色几十分钟。

**生产接入前需明确一份介质拥有权：** 有限表面路径沿同一射线合并`σt=σair+σsmoke`与散射源，然后输出一次`Lout=T*Lin+S`。不得先在aerial算同份烟，又在有限效果层画它一次。sky depth只旁路已由sky计算的清洁空气，不能旁路局部烟；但直接把整张已积sky乘Tsmoke，也会错误衰减烟前方的clean-air in-scatter，不能称精确RTE。精确版本需局部段边界radiance/替换协议；有界近场近似则应明确列限，而非拿RGB有限替代光路正确。

可见星需用真实source→eye的Tsmoke；冷烟、opaque及星的合成必须有前后关系。main是eye→surface；水反射是water-hit→反射世界，主air稍后负责eye→water，不能镜像相机下海后仍从其伪位置积空气。主/镜像共享质量状态，各自求射线，不能共享错误view排序。

阶段A的3D Gaussian有限段柱积分是可接受的**夹具候选**：τ可按团相加，但不同位置/照明的散射source不交换，中心排序over不等于统一介质积分。质量/质心/Σ守恒也不保证局部峰、columnτ或图像守恒；merge/cache须另查射线光学厚度误差和有限源上界。不要每像素循环2048团；局部列表/cache是否值得，先测隔离成本。此阶段未定协议前，不默认接生产。

## 4. B2：照云必须连反射一起设计

云应在现march的真实样本p加入有限源`E(p)*phase*SSA`，source→p的烟/云T与p→eye的view T各一次；不复用太阳22倍经验系数，不统一染整片云。813m云底对120m爆源有约693m间隔，光不会在280m物理消失，但也可能确实很弱；应报告真实当前参考源下的结果，不为可见单独给云乘100。源量要提高时必须是全链统一作者源参数与新预算。

首选研究**base sky/IBL不含pyro，瞬态cloud-local正增量独立**。capture snapshot内显式关瞬态，不因scene P变化触发物理重捕。主视图与mirror用同一源时刻；不把主屏cloud texture贴到水，也不加near-water第17个sampler。

一个有界mirror候选：在现reflection RT里，opaque之后、有限星/烟之前，按mirror射线从water-hit起计算cloud-local delta，作为alpha0加性辐亮度；硬件depth遮挡finite objects，禁止读取当前附着depth。随后有限烟/星正常premult over，水仍用`reflection.rgb+(1−alpha)*baseCube`，这样烟可衰减delta，base sky只出现一次。必须验证MSAA/透明边缘、斜视、云前物体与清背景；不能只证明主天亮了。若采用的是烟对base cloud的消光而非仅正照明增量，alpha0正delta已不足，需另定T/S替换，不能靠负色裁剪糊过去。

当前固定cube视点近似、cloud已有aerialTransmission经验项也须保留边界：新增delta使用同一必要view消光一次，不再套整层solarTransmission。应先有零源恒等、有限点光/均匀云可解析小夹具，再进入实际云图与成本；不复制整套新QA框架。

## 5. B3：有限一跳，不是全场ambient提亮

可复用现surfel可见性/传输与18个SH1 probes，为新源另算raw入射`E_j`，形成`B_j=ρ_j E_j`后投至receiver；它表示source→surfel→receiver的一跳，**不把source→receiver直接项再加一遍**。与原solar GI线性叠加，保留albedo上限、互易/行和约束；不能把烟的散射再当同一surfel反弹。

快速源不走旧2/4Hz+.18s总量混合。最小候选为少数簇的静态几何响应cache、每帧当前envelope调制，位置/可见性变化另有有界刷新；冻结树叶/烟可见性近似必须披露。先一跳，不同时做多跳或每星全场求解。水不是Lambert面：现海床/水下路径与Fresnel界面各有归属，不能把陆地albedo公式直接抹到海面。所有新反射源上界纳入P，实际路径完整后才比较“氛围更亮”。

## 6. C0：导演最小可实施合同（已单独批准纯pose）

新[camera-director.js](../../camera-director.js)只输出pose，宿主拥有`manual/orbit/fireworks-orbit`选择、一次性fit、camera/controls写入与输入。默认period240s；`start({position,target,centre,radius,eyeHeight,targetY,periodSeconds,direction,entrySeconds})`，`update({dt,paused})→pose|null`，`cancel(reason)`，`state`。radius为到orbit target的**三维距离**，水平半径由高度差解出；configure只改下次start的周期/方向/入口默认值。

入口位置smootherstep；角速度同样平滑从0升至ω并**解析积分相位**，完成时为ωD/2，随后连续匀速。朝向在展开yaw/pitch和look distance中混合，避免从外看切向内看时target穿过相机。t0精确原pose；非地面夹持时入口C2。floor=`max(.42,terrain+.5)`，不宣称避树/完整碰撞或限制大位移的最大入场速度；宿主先停navigation，较大转场应选更长entry时间。

root只在启用/换模式时按岛与发射包络fit一次，不每发重fit、追爆点或呼吸焦距；连续运镜不读取UTC倍率。global pause冻结且不积暂停dt；cancel之后立即null，永不定时自动恢复。controls.start、导航onActivity、canvas pointerdown、Home/预设视角/定位/手动对焦及摄影/质量政策变更应在任何导演pose写入前统一cancel；当帧用户输入优先。旧autoFrame与导演只留一个camera owner，不能同时抢写。

源码SHA256 `1eb098e2b721aecb7fb7869addaab52976045dc2d8da0d7ca5687c8421858d98`；[CPU检查](../camera-director-check.json) **19/19**，30/60/120Hz同240s输出位置差0，覆盖pause/cancel/入口导数/反向朝向/地面安全。原生输入、实际运镜美感和性能仍待root集成。未动UI/index/main。

## 7. C1：ghost/veil最后，属于同一个镜头预算

最小方案先在现1.8%预算内重新分配halo/ghost/veil，仍在线性HDR、effects之后、输出之前只做一次：`L'=(1−b−g−v)L+bKb[L]+gKg[L]+vKv[L]`，b+g+v=.018为初始实验预算，非实测镜头。各算子非负且通量有界；缩放ghost须考虑Jacobian，离开传感器的能量允许损失，不把截出画面的ghost重新归一增强。使用亮源mask时，直达项也须扣除同份被重分布能量，不能只加不减。

**通量守恒不保证像素峰值不增。** 有聚焦/缩放的ghost需给出算子峰增益上界并纳入中间FP16预算；不能照搬现归一卷积的最大值界。ghost/veil不回照云/烟/物体，不进长期IBL，不更改源P/C或显示器peak nits来伪造HDR。当前只从可见成像radiance做有限近似；若要离屏flare，必须新增真实镜头入瞳/遮挡协议，不能让脑后/墙后源仍无条件出鬼影。

最少复用现PSF/HDR检查：黑不自亮、均匀场/点源通量、峰界、遮挡/离屏/背后源、P变化补偿与main/mirror不重复。没有真实镜头标定时称“有限能量虚拟镜头近似”，ghost默认可关闭，不把更大的光晕当光源更强。

## 分期准入

1. A形状/高度与C0导演可分别封存；源/音频锁、精确优化同输入回归和native takeover先闭合。
2. B0源账本+最坏上界，B1唯一介质的小夹具/状态库先过；不将CPU质量守恒写成体渲染已完成。
3. B2主/镜像瞬态照云一起A/B，B3一跳随后独立加；各有关闭恒等、全通道finite、同摄影图与实际成本。短flash不能烘焙进cube或SH慢缓存。
4. C1镜头重分布最后增加；每期保留原版本可回退。当前目标仍是推荐中档争取60、高级允许约30，未经同场景实测不承诺每帧目标或照片级完成。
