# R3：有限距离烟花效果层的反证与最小路径

2026-10-26。只读研究，未修改运行时。审查根候选：opaque+water→TAA→aerial→主DOF→独立finite-effects→一次Bloom/SMAA/display；效果手动比较opaqueDepth、不写场景深度，自行处理有限air/CoC/短曝光；镜像相机重画到水反射，不写sky环境。**主路径可接受为有边界的实时近似，但镜像空气起点、附着depth反馈和透明排序必须先纠正。**

## 1. 有限空气与烟的准确合成式

设 d 为相机至当前薄烟层的实际射线长度；`T_d` 为该段空气RGB透射、`S_d` 为该段向相机累积的空气散射；`C_bg` 是已经处理空气的背景。烟层自身灰透射 `τ`、`α=1−τ`，`L_s` 是烟层自己的**预乘、已积分出射辐亮度**，不再乘一次α。则：

`C_out = τ·C_bg + T_d·L_s + α·S_d`。

若输入是未预乘的烟色/散射源近似 `C_s`，先设 `L_s=α·C_s`。最后 `α·S_d` 是补回本不该被这层烟遮掉的前景空气，不是把整条背景空气重加一次。纯自发光、无消光的火星只加 `T_d·L_e`，**不能加S_d**。空气 S 与效果 RGB 使用同一sceneP；T/α无量纲，不乘预曝光。

这是有限传输式与premultiplied-over的直接组合，未表示完整多散射烟求解。[PBRT 有限路径传输](https://pbr-book.org/4ed/Light_Transport_II_Volume_Rendering/The_Equation_of_Transfer)、[W3C Source Over 定义](https://www.w3.org/TR/compositing-1/#porterduffcompositingoperators_src_over)。最低代数夹具：α=0恢复背景；α=1得到`S_d+T_d C_s`；T=1/S=0退化为普通over。示例T=.8、S=.1、Cbg=.5、α=.4、Cs=.6，正确结果.532；省去前景补偿则.492，误遮掉.04的前景air。

可统一一套**预乘over**：火星`RGB=T·Le, alpha=0`，烟`RGB=T·Ls+αS, alpha=α`，使用`ONE / ONE_MINUS_SRC_ALPHA`。这样能把星与烟排在同一远近列表，减少混合模式切换；不是对所有RGB再乘普通SRC_ALPHA。

**不得只排序烟再把所有additive星画在最后/最前。** 一颗远星、透射.5的烟、一颗近星各亮度1，正确结果1.5；先画两星再画烟得到1，先画烟再画两星得到2。首版按粒子/短尾段的视空间深度统一排序；大烟片交叉与长尾穿烟只用中心深度仍是近似，可分短段或有限深度bin。加权无序透明不能未经比较就称精确前后关系。

## 2. 遮挡、CoC与短曝光：可以小，但不能伪造能量

- 主DOF后的目标应为**不附着opaqueDepth的color-only目标**，效果采原opaqueDepth可行。深度比较在同一相机/投影下用view-Z或同一非线性depth；空气长度用欧氏射线长度，不能把view-Z直接当斜射线长度。反Z/镜像oblique投影也不可套普通near/far公式。
- 以每粒子实际深度求CoC、归一像素核和固定短快门轨迹积分，避免让旧背景depth替效果决定散焦。主DOF已跑过，效果不能再进同一全场DOF一次。当前镜头quad还包含vignette；拆管线时须把共同暗角留在全体合成后，或效果显式应用同一暗角一次，不能只暗背景。
- 核在遮挡前归一；被岛/树挡住、飞出画面的能量可以真的损失，**不要对剩余可见核重新归一**。有限发光面积先给真实resolved radiance，再与像素/CoC/快门核卷积；不能近看还用无限点源式，亦不能随q降低把亮芯加宽后不减幅。
- 手动opaqueDepth是已resolve的单深度，薄叶MSAA覆盖不完整；扩大后的CoC核按中央深度裁切也不等于真实入瞳可见性。主DOF背景已经跨像素混合，再做单层烟over同样不是精确多层薄透镜。**默认DOF关**可减少这项误差；开启时明确是分层散焦近似，不宣称全路径镜头。
- 采用固定物理快门（如候选1/120s）的路径时间平均，而非“每帧dt就是快门”；时间权重和空间核各归一，不能按帧率重复乘dt/曝光。长照片尾来自燃烧碎屑/摄影积分两部分，不能靠TAA历史。轨迹超过数像素时用有界的分段/解析线核，固定采样不逐帧换随机相位。[PBRT 摄影时间/像素积分](https://www.pbr-book.org/4ed/Cameras_and_Film/Film_and_Imaging)

## 3. 镜像路径必须单独定义transport，不是照搬主相机空气

镜像camera只负责投影与可见性。令C为真实camera、P为该反射射线的水面交点、X为火星；主aerial已经对C→P算一次空气。反射目标应提供P处入射辐亮度，例如火星项 `T(P→X)·Le`，之后由水面Fresnel反射，再由主aerial算C→P。若effect在反射RT按mirrorC→X的整段距离乘T，镜像长度约等于`|C−P|+|P−X|`，主aerial又乘C→P，就**重复消光相机至水面这一段**。直接从海面下的mirrorC积分真实高度密度/树影也不是实际折线路径。

同一renderer可复用，但API至少分开：`projectionCamera`、`transportMode:'camera'|'water-hit'`、`opaqueDepth/depthMode`、`backgroundAirConvention`、`applyOpticalPSF`。reflection模式逐片元求P，以P→X计算源侧空气；相机→P仍归主aerial。反射场不烘相机CoC/Bloom；主镜头会处理一次，水面反射像焦距暂按水面深度近似并明确边界。

还有一个WebGL硬条件：**不可同时采样当前FBO仍附着的depthTexture并向该FBO画效果**，depthWrite=false也不消除纹理反馈。最小reflection变体是在原反射RT用硬件depthTest、depthWrite=false，并编译/绑定一个不采该depthTexture的shader变体；或写独立color-only合成目标、采原depth，需要额外copy/RT。后者完成后才生成最终颜色mip，不能用加效果前的旧mip。

### 根追加的黑底透明反射：接受，附明确条件

旧水路径以reflectionDepth判定天空，会丢掉depthWrite=false的火星。根的新候选是不画sky，反射RT清为线性`(0,0,0,0)`，opaque物写alpha1，效果按前述premult-over积累`(C_r,A_r)`；水端改为：

`L_reflected = C_r + (1−A_r)·skyReflection(R)`。

**代数成立**：只有火星时`A_r=0`但`C_r=T(P,X)Le`仍加到天空上；烟在空背景时`A_r=α`、`C_r=T(P,X)Ls+αS(P,X)`，延后补天空得到正确的`τ·sky+T·Ls+αS`。多层远近premult-over与这次补背景兼容。它不需要用alpha0代表“没有RGB”，也不需要额外reflectionDepth sampler；反射FBO原depth仍可用于硬件遮挡。

实施条件：不按`A≈0`丢弃RGB，不unpremultiply；opaque物（含主叶片）在反射中alpha1，旧主pass叶/水标签不能误入；clear/background/sky可见性及renderer状态完整恢复。主色/alpha一起做线性mip，不分别重归一；像素边缘的`1−A`用于补天空覆盖。超出reflection UV/范围时才走明确fallback，不能在材质内部又把天空写入反射RT重复叠加。RGB与alpha混合须真实GPU验证，alpha按`A_s+(1−A_s)A_d`而非SRC_ALPHA再平方。

finite air仍需P起点：该方案并不允许按mirrorC→X消光，主aerial处理C→P一次。天空skyReflection应按P处天空辐亮度理解；现cube以固定capture observer近似，低空位置差是现有限制。旧opaque反射物尚未从P对背景算有限air，所以烟叠在它上面仍是raw背景air近似；不得声称新的alpha合成顺便修好了所有反射物的大气。这个边界可保留而不增加首版反射大气pass，对天空背景的火星/烟已比旧深度判定路径完整。

## 4. 最小可实施合同与验收门

1. 固定R3统一sceneP/C协议；主effects在color-only HDR目标、主air/DOF之后，独立深度比较、预乘over、远近统一排序；不进叶/水TAA。一次共同Bloom/SMAA/显示，暗角也一致一次。R8只保护被局部光快速改变的receiver/反射水域history，不承担透明颜色标签。
2. emission有界物理面积、像素积分与固定短快门；灰烟以`α=1−exp(−opticalDepth)`，自身散射近似与当前key/有限光簇同源。烟片相交、colored extinction、多次散射、全孔径遮挡仍是边界。
3. 反射共享粒子状态/时刻和镜像camera，但用water-hit transport；接受黑底alpha0+延后补sky的premult方案，用硬件depth避feedback，不写天空长期cube。保留旧opaque反射背景air/水面DOF的明确近似，不能借“同renderer”宣传完整同路径光学。
4. 数值预算用**最大RGB通道的所有可能加法项总和**，包括主星、尾、局部受光、烟、air S、反射与已有背景；正归一PSF不增单场最大值，但多个源叠加仍会增。按B下调storedP并保持cameraC，不能靠末端clamp；FP32中间层之后的FP16也逐个读回。

至少八组有意义夹具：①上述air/烟代数极限和无烟纯发光不增S；②远星–烟–近星交换顺序；③同源在主/倒影的T，改变camera→P长度验证不会双算；④真实shader无depth反馈、RT/viewport/blend恢复；⑤黑底空场A0、A0亮星、灰烟、A1遮挡物和mip边缘的deferred-sky合成；⑥q=.6/1、亚像素平移、30/60/120fps固定物理时刻的核积分/短快门；⑦DOF关/开、树细叶/前景物交叠的截图与动态视频，残余边缘需诚实记录；⑧自由飞近、饱和蓝、多源重叠的全部HDR场finite/peak/暗星保留率，以及真实主视角含烟overdraw+reflection+HDR提交的GPU/rAF分布。

结论：根候选解决了“用背景depth给近粒子算air/DOF”的主要结构问题；接受为**分层有限距离效果**，不接受“完整薄透镜/体积路径”表述。最小路径必须带上灰烟补偿式、统一远近混合、P起点反射空气及无depth反馈四项；默认DOF关不能替代这些基本正确性检查。
