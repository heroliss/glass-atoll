# 瞬态照云与有界一跳反弹：实施前合同候选

2026-10-27。只读当前生产源码，新增独立CPU研究夹具；**未接生产、未修改renderer/main/sky/water/GI/星体或音频**。相关输入hash在`verification/transient-light-proof.json`。它不是烟渲染已交付、性能或照片级结论。

## 1. 确定的现状与接线位置

| 当前来源 | 源码位置 | 必须保留或补齐 |
| --- | --- | --- |
| 当前两簇 | `fireworks.js:201–206` `getLightClusters()` | 对实际head及tail records按当前发光强度求和、质心和RGB；未乘P。`referenceCandela`是作者参考，RGB是I加权色，最多2簇。不是所有星的单独求光；`radius=clamp(age*8,2,28)`是近场平滑半径，**不是实际星体支撑界**。 |
| 有限点光/地海 | `local-lights.js:66,74–75`；`water.js:153–162` | pyro slots4/5默认range280m，当前云底约813m，直接照搬`localIncident`会把照云截为0。custom水下海床已用该局部入射；不要再额外加一遍相同直射。`pathFlags.specular:false`是簇元数据，native PointLight并未自动执行这个限制；水面的可见星倒影仍应走真实effects，避免给簇另造宽镜面光团。 |
| 主云 | `sky.js:394–434` | 当前只有Sun/Moon方向与ambient；3个230m太阳遮光样本是无限远光近似，不能照抄成有限点源路径。云源项中的22与.34是现有天空近似的归一/散射调节，不能拿来给烟花偷偷增亮。 |
| 主云存储 | `sky.js:438` | 全色最后乘`uSkyPreExposure`一次；新增入射/散射计算必须保持raw。 |
| 镜面天空 | `water.js:181–187,338–345` | 反射RT黑底alpha0，隐藏sky；water用`reflection.rgb+(1−alpha)*skyCube`补背景。只改主sky会留下无瞬态照明的旧cube倒影。 |
| 环境捕获 | `sky.js:499–512`；`environment-capture.js:49–54,110–134` | snapshot会复制所有uniform，capture clone共享uniform。新增flash uniform若直接加入snapshot，可能被捕获冻结或写进PMREM。必须明确capture scope禁用瞬态，保存/恢复原状态；不随每次flash重建六面图。 |
| 现有一跳库 | `indirect-lighting.js:193–210,256–275` | 缓存只接受Sun/Moon方向入射，low2Hz/high4Hz并以.18s渐变；它还没有地灯/烟花反弹。不能把快速burst塞这个慢时间槽后称同步。 |
| 同帧光度 | `main.js:631–648`；`scene-radiometry.js:2–5,19–38` | 先取一次raw簇并算新源界，再选P，最后各模块设置P。`RAW_PER_CANDELA=3.6/100000`是声明的有效场景参考，不是绝对传感器标定。现`medium=localBound*.25`不能用于任意新cloud/smoke相函数。 |

近水shader的活跃语义预算已满16：7个折射/反射/地形/沙/焦散/cube，5个波谱+SWE，2张云影，1张树影，1张torch影。**不向water新增第17张云/烟纹理**；新天空/独立效果shader分别核对自己的活跃sampler上限。下述两簇只需4个vec4及计数，GI可在CPU合并现有18×RGB×SH1数组，不增sampler。

## 2. 实际量级与真实测光证据的边界

独立夹具直接导入生产`createFireworks`（仅建立CPU几何，不建WebGL），读取10类、四个燃烧时刻的真实`getLightClusters`。默认29°C/RH.68给云底**812.956m**。seed42、80°牡丹在burst+1.1s：224星，簇1277.391参考cd，质心高116.162m；取正上方云点，距离696.794m，未遮挡法向照度仅**.002631参考lux**。若假设簇各向同性，形式上的总光通量`4πI`为16052参考lm；它不是测得商业壳弹总lm，更不能将累积长曝光照片当瞬时通量。

最相关的公开primary定量证据是[Juknelevicius等，2021，Table2](https://onlinelibrary.wiley.com/doi/10.1002/prep.202000114)：十种蓝焰实验样本约10–388cd、五次平行，静态约16.8mm样本；0.5m绝对光谱仪经过NIST溯源核验，部分积分时间达500ms。论文也说明飞行气流与残烟反射使静态结果不能直接代表实用星。它支持“10到百cd级确实有实验例子”，**不证明本场景每颗星应取哪个值**，也没有本场景90/120/150mm商业shell的逐毫秒总I(t)。

[Huang等2021摘要](https://onlinelibrary.wiley.com/doi/abs/10.1002/prep.202100038)另报绿色实验发光体34665cd，但公开摘要不足以明确可迁移的样本尺寸、燃烧面积与方向分布，不能按每星34665cd照抄。2017《Colored light》研究存在[2021正式勘误](https://snu.elsevierpure.com/en/publications/corrigendum-to-characterization-of-display-pyrotechnic-propellant/)，不把搜索片段中的9.69kcd插值当实物标定。本研究未复制配方/制造流程，也未取得可迁移的商业burst高时间分辨测光曲线。

点源`I/d²`来自[NIST测光关系](https://www.nist.gov/pml/sensor-science/optical-radiation/realization-candela)与[PBRT点光模型](https://www.pbr-book.org/4ed/Light_Sources/Point_Lights)。当前5–10cd作者范围处于上述蓝色静态实验低端；不能说它必然错误，也不能说它对所有颜色/飞行星已经真实。

若用户要求更明显地照岛/云，建议先做**唯一的作者参考源强**候选，不改transport倍率：

| 作者源强比例 | 普通星参考范围 | 同一牡丹相位到云的未衰减参考lux | 用途 |
| --- | --- | ---: | --- |
| 1 | 5–10cd | .002631 | 当前基线 |
| 4 | 20–40cd | .010524 | 温和候选 |
| 16 | 80–160cd | .042095 | 公开蓝焰百cd例子仅作量级背景，**仍为作者候选** |
| 64 | 320–640cd | .168382 | 上界压力档，非默认建议/测量结论 |

所有可见heads/tails、cloud/smoke、local native/custom surface、海床和一跳使用同一源定义；形态/寿命/高度/音频4e5不动。先固定C与相位比较1/4/16；不按每一路单独乘100，不靠曝光补偿把云抬亮同时让星不变。最终选值需记录“作者参考标定”，而非宣称实测。更强源需要重新跑主/镜像、近源/离轴/蓝色、多源重叠的FP16预算和弱夜空精度；更亮并不免除源峰动态范围问题。

## 3. 统一raw输入与瞬态cloud delta

建议独立`pyro-transient-lighting`层接受同帧冻结的两簇：

```js
prepareTransientFrame({physicalTime, clusters, rawPerCandela})
// 每簇 {eventId, position, referenceCandela, linearColor, falloffRadius,
//        extentRadius?, pathFlags}; JrawRGB=I*linearColor*RAW_PER_CANDELA
getCloudRadianceBound() // raw before P; maximum-channel bound
setSceneExposure(P)    // 只给写入/合成，不能改raw输入/密度
prepareCloudView({renderer,camera,frame,reflection,planeY})
renderCloudDelta({renderer,target,camera,reflection,frame})
```

生产`color`别名可在入口转为`linearColor`；不得读取已曝光PointLight颜色、屏幕PSF、bloom或到眼已衰减星RGB来照云。簇的`extentRadius`需按records实际范围另算，仅作近/远近似诊断；现`falloffRadius`不是等价的实物发光球半径。默认云高且源远时，2簇是低频照明近似；RH高/云底低到与星混合时不能假装2个质心能重现每颗星的近场自阴影。

### 单散射最小方程

在云点p，`L=normalize(lightPosition−p)`、`rd`为观察者指向p的射线：

```text
Eraw(p) = JrawRGB / max(|lightPosition−p|², falloffRadius²)
          × Tclean(source→p) × Tcloud(source→p) × Tsmoke(source→p)
mu = dot(rd,L)
pCloud(mu)=.82 HG(mu,.62)+.18 HG(mu,−.25)
ΔLraw += TcloudViewBefore × (1−Tsegment)
         × omegaCloud × pCloud(mu) × Eraw(p) × Tclean(observer→p)
```

先取明确声明的`omegaCloud<=1`；不沿用22或.34给局部源额外散射能量。主源和观察者都在云下时通常是回散，mixture在mu=−1为.041279/sr，而mu=1为.738944/sr；不能翻HG方向救亮度。[PBRT两外向量采用相反符号约定](https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions)，本式minus-HG使用`dot(rd,L)`。

`|source−p|≈0`时不能直接`normalize(0)`；安全L及明确的proxy内部相函数约定必须保持finite，不能靠输出clamp掩盖。点源只走有限段空气T，不能套`atmosphereSunTransmission`再乘一次Sun/Moon上层透射。现base云/atmosphere的22并非已按3.6参考做过全绝对测光，加入raw点源不会自动修成绝对校准；若要统一Sun的云/白卡比例，应另立固定基线测试，不能在flash打开时临时改变22。

有限源遮光只积p到source的实际段；不要把太阳的690m固定march直接移植。可先4–6个有限段样本、优先分配在云层相交部分，并测receiver/source都在云内与跨云底。清洁空气取共享有限段T，不新增手调雾色。烟的source→cloud T需要共同density/cache；没有该路径前只能明确“暂不计烟对云入射遮蔽”，不能声称完整Tyndall/自阴影。view烟遮挡交给后续smoke compositor，不在delta与compositor两边重复乘。

### 最小接入及成本选择

首选窄候选：主sky现有云march同时累积**纯新增**`ΔLraw`，不增加主view的另一次density march；mirror用独立transient-only云pass。只有源非零才运行，且主/镜像使用相同physicalTime、天气密度、源envelope，不能等六面cube更新。

代价不是“只多两个灯uniform”：每个非零cloud step若2源×3次light density，原density+3次Sun查询会从4升至约10。允许带证明的辐亮度误差剔除：若某源此点`Jmax*phaseMax/max(d²,r²)<epsilonRaw`，忽略它的整段误差最多epsilonRaw，因为所有view权重之和≤1；不是生硬range280m。epsilon=0用于reference QA。实际GPU仍需测浓云与两簇，不能保证60fps；高级档可约30，由实际结果决定。

若实际成本不合格，再比较半线性分辨率的16/32步独立delta RT（main+mirror各一份）与全分辨率reference。它只降低频云照明，不降细星PSF。RT可存RGB新增S、alpha=`1−Tcloud`元数据，alpha不是最终覆盖率；主sky用已有高分辨率cloud opacity约束上采样，不能把低分辨率亮斑贴到无云像素。可将`S/opacity`作为有界平均源，插值后乘当前opacity，设有效权重门限并证明≤源界；不能将已积分S再无解释地乘一次opacity。这是独立过滤候选，不预先声称视觉/成本更好。

### mirror与capture合同

`water.render()`当前明确隐藏sky，所以要在`water.js:344`场景画完、有限烟/星合成前，向**同一反射RT**画delta-only远深度pass：RGB为正新增亮度、alpha输出0、premult ONE over，硬件深度挡住树/岛，旧cube仍只补base。最终`reflection.rgb+(1−alpha)*baseCube`没有重复base sky，也不增water sampler。

mirror射线从虚拟相机生成，但空气/云view传输必须从实际water-hit开始：`q=mirrorEye+rd*((planeY−mirrorEye.y)/rd.y)`；p仍在真实世界云场，不镜像烟/云/源。不能直接clone主sky沿用`cameraPosition.y=max(2,y)`，那会把负Y镜像观察者改成错误的2m观察者。camera→water段由主aerial一次处理，water-hit→cloud段由delta一次处理。倒影DOF仍沿用现水面近似，不宣传全光程镜头。

该water-hit公式有严格有效域：`abs(rd.y)>epsilon`、`t>=0`且t/q有限，并且交点在所用有效水域路径内；无命中ray必须输出Δ=0。反射RT覆盖整视锥，不是每个像素都命中水；不能把分母clamp为epsilon硬造遥远交点。测试近地平线、极端俯仰、相机跨水面和扰动UV邻采边界，并保证无效区黑RGB/alpha0，不向附近有效水像素泄漏亮带。

delta view必须使用该次真实相机的投影（含lens实际jitter）、viewport和分辨率；独立pass不要附进主scene被refraction layer1或environment clone顺便重画。colour-only合成要保持MRT的water/leaf/depth/reactive元数据，不将cloud alpha元数据写进场景标签。借用renderer的RT/face/mip、viewport/scissor、clear、shadow dirty、autoClear、toneMapping/output色域及uniform snapshot状态均须finally恢复。

delta-only输出不得带`clearSky*Tcloud`、旧cloudLight或`clearSky*(1−Tair)`；那些已经来自base。captured cube/PMREM必须强制瞬态禁用，snapshot不冻结两簇；try/finally恢复原view/P/uniform。固定origin与旧cube的base云会有明确年龄/视差误差：新delta是当前云，base仍是旧snapshot，因此不能宣传反射整幅天空都完全同步。若这一差异可见，才另审当前view base反射，不在本轮偷换整条海面模型。

## 4. bounded一跳：复用surfels/probes，但分离时间槽

当前最多77个地面格和96个双面叶patch，18个SH1探针；static visibility/transport已有。新增瞬态入射：

```text
Ei_raw = Σ Eraw(source→surfel_i) * visibility_i * max(ni·Li,0)
B0_i = rho_i * Ei_raw                     // exitance，绝不是radiance
Eprobe_pyro = projectDiffuseProbe(B0)       // source→surfel→receiver一跳
Ereceiver = EbaseSunCached + EpyroCurrent
```

`indirect-lighting.js:203–210`现`directInput`只算Sun；可新增`prepareTransientSources`，复用它的terrain/porous-foliage visibility与`:243–251`probeWeights。**不要再把B0当native direct加回receiver**；native PointLight/custom海床已经算了直接光。第一次只做一跳，`solveDiffuseBounces(...,1)`即可；现high的第二反弹不自动扩大为烟花多跳。

分开保存baseSun与pyro probe系数，CPU相加后仍写现有54个vec4，`uGIExposureScale=2^P`只在GPU一次应用。不要让快速源进入2/4Hz+.18s基线槽；I(t)/RGB每帧调制、归0即清零，不留.18s残光。可缓存固定source pose的单位强度SH响应，当前IRGB逐通道乘；线性性只在**位置/可见性/半径固定**时严格成立。若10Hz或移动2m才重算该空间响应，须明确运动遮挡近似并测试树边，不将其称精确；首个reference可逐帧算最多2×173的入射与18探针，成本单列后再选择缓存。静态rest叶可见性、SH漏光与风不重建是现有边界，不因新源而消失。

不将瞬态反弹写sky environment，不全局抬ambient。云→地面、烟→地面、地面→云和云内多散射属于另行耦合，不因本轮有一跳就宣称全部GI。

## 5. FP16、源账本与可证伪验收

设`K_l=maxRGB(Jraw_l)/r_l²`，cloud mixture保守峰界
`pMax <= .82*(1+.62)/(4π(1−.62)²)+.18*(1+.25)/(4π(1−.25)²)=.763900/sr`。
因SSA/T≤1、view权重总和≤1，**实现的两簇代理**满足`ΔLmax <= pMax*ΣK_l`，不乘CLOUD_STEPS、不随烟团数线性叠发光源。该界不替代分布在簇外的真实星峰界；近云/近源代理偏差必须另测。

GI的总反射功率守恒不等于点wise radiance界。对每个探针/颜色SH系数(a0,a)，`Emax=max(0,a0+|a|)`；取18探针max，双/三线性插值及edge≤1不会增界。乘最大漫反射率/π才是surface辐亮度界。已有transfer互易且行和≤1限制可选反弹，但不能拿它给所有probe点wise峰值背书。

把cloudDelta和transient-GI界在选P之前交到`main.js:645`，一处计账。`SAFE_HDR_MAX=16376`留四倍余量；主与mirror分别查实际HDR像素，不只看平均。保存历史/env的captureP只作采样比率，不在每flash重建；冷烟density/τ无P。还需测近大源迫使P下降时的弱云/星FP16下溢，finite零错误不是弱信号可见性证明；C固定的P sweep应对比raw reference，不用末端clamp。

最小准入序列：

1. GPU homogeneous cloud/slab解析Beer+点源散射，零源/零密度严格恢复base；mu正反、source与receiver在云内/外，finite source path长度正确。CPU研究13/13只证明公式与当前CPU源输入，**不是GPU接通**。
2. main/mirror同事件同phase关→开，确认下一真实主帧就响应、源归0即无残光；capture/PMREM像素及tag不含flash。镜像从water-hit起，水近场仍≤16sampler。基线RGB不重复加、云影/烟T各路径只一次。
3. P−12/0/8/21、固定C；黄/红/蓝、2簇重叠、近云、相机飞近、HDR暗地/弱星同框，实际main/reflection/media均无NaN/Inf/负物理RGB并满足界；灰卡验证1/r²及颜色/强度全链同源。
4. GI点源→两块漫反射片，receiver direct遮挡与一跳单独开关；总功率、SH界、光停立即归0、2Hz边界无阶梯；关闭旧ground hemisphere重叠，不在PMREM重复反弹。
5. 固定phase/天气/相机/C/P拍source1/4/16主云、岛、海与旧烟再照，随后5s动态；同时记录新增CPU空间响应/GPU主云/mirror/烟各自mean/p95，浓云不能用无云仰视当压力证据。若60预算不合格，按明确高级档约30或关闭新增项，不承诺任意硬件每帧60。

与烟renderer合同：正delta alpha0只能表示新增照明，不能表示烟对base云/星的消光；后者由受限T/S合成负责。新烟stageA的water剩余sky只有scalar alpha，所以先neutral烟κ=[1,1,1]；彩色T需新协议。源→云/烟与云/烟→eye是不同段，烟source自遮挡未完成就明示近似。旧烟先作用背景、星之后显式Tstar，不再对星重复smoke-over。stageA解析τ的近似S不等于全cloud/smoke联合积分完成。

## 研究依据与复跑

- [PBRT Transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance)：分别处理光源与观察者有限段；光学厚度与透过率不可混成一次屏幕颜色乘法。
- [PBRT Diffuse reflection](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection)、[NVIDIA GPU Gems2 Ch14](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-14-dynamic-ambient-occlusion-and)：现有disk/surfel算法的来源，本文额外强调互易/行界和SH峰界，不声称路径追踪。
- [Guerrilla实时云原始演讲](https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn)：工程背景，不将其游戏光照近似当烟花绝对cd证据。

复跑`node verification/transient-light-proof.mjs`，当前**13/13 CPU通过**，真实生产CPU簇40组，包含源量级表、phase归一/符号、有限段反例、P/C代数、有限代理上界、现有transfer互易/行界、1跳和SH点wise界。源码hash与全部数值在相邻JSON。没有浏览器、GPU、新增生产效果或声学改动。
