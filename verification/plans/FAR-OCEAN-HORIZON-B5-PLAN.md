# B5：局部海面与球形远海的有界方案

2026-10-27，研究/接口建议，**尚未实施**。基线为`verification/baselines/b4-production-20261027-040831/sha256.json`，其中B0棕榈与cloudBaseContinuity1已冻结。本文不改运行时、资产或灯光，不把旧/新截图差异当性能结果。

## 建议与决定边界

首个候选建议采用**原近岸局部平面 + 独立轻量曲面远海**，先以曲面ring的标准硬件深度接入验证。保留岛、地形、72m SWE、投石、64m焦散和原平面镜像捕获；仅在远离岛屿后接地心一致的球面，远海用统计坡度BRDF，不把昂贵近岸shader铺到150km。

它比全曲面改造容易保住现有数值/交互，也比“天空里画一片海”更容易维持现有opaqueDepth、DOF和有限烟花遮挡语义。**并非只加ring即可交付**：clip/depth、半精度历史、有限空气光程及固定cube视点是准入门槛。下面任何门槛无法通过，应保留B4，不能以更远平面、手工雾带、伪造深度或末端颜色混合替代。

三条路线的取舍：

| 路线 | 保留/新增 | 主要风险 | 本轮建议 |
|---|---|---|---|
| A：局部平面 + 曲面ring | 近岸求解不动；新增低顶点、少sampler远海材质，普通有限深度 | 需更远clip及远水历史分类；远处天空/air近似需统一 | 首个可推翻候选 |
| B：全部水面/地形改球面 | 整体位置/法线几何一致 | SWE的H/y0、海床求交、投石、浮叶、平面反射与碰撞全需坐标变换；收益不匹配范围 | 否决本轮 |
| C：背景ray-sphere海面 | 球面求交无需铺巨mesh；可不改主camera far | depth1会被air/DOF/picking视为sky，烟花在地平线后漏出；写自定义clamped depth又会骗现有重建 | 保留备选，不默认绕过语义门槛 |

C若保留真实有限距离，须另有明确的物理distance/visibility协议，或正确扩展标准深度后写`gl_FragDepth`；前者会改多个pass，后者仍没有消除clip/depth问题，还可能失去early-Z。不能因为平方根便宜便称整条路径更快。[Khronos关于fragment depth与early tests](https://wikis.khronos.org/opengl/Early_Fragment_Test)

## 已有证据与实际源码

`cloud-base-{fair,humid}-{0,1}.png`的海天线色带在连续性A/B两边都存在。由真实camera/target、70mm、filmGauge36、1209×1292计算，fair球形地平线y1040.96到平水边界1076.42，差35.45px；humid827.40到833.94，差6.53px，接近可见约35px/8px的色带。详见`CLOUD-DENSITY-EVIDENCE-REVIEW.md`。这是强几何证据，尚非GPU逐像素分类证明。

| 生产位置 | 明确事实/后果 |
|---|---|
| `water.js:258–264` | 220m网格仅把最外圈拉到XZ各±10000m；仍是有限平面 |
| `sky.js:63–69,195–220` | 云/空气采用R=6360000m球形高度；天空光线有球形地面求交及hitsGround底色 |
| `main.js:163–175` | camera near.15/far24000；Orbit maxDistance230/maxTargetRadius1500只是轨道设置 |
| `camera-navigation.js:46–63,70` | 飞行直接平移camera/target，恢复pivot还会扩大轨道范围；没有1700m或固定世界边界 |
| `water.js:277–299` | 镜像相机仍以世界y0平面反射，复制主projection并做oblique clip；不是球面反射 |
| `lens.js:42–45,69–96,189–194` | alpha.70是near-water tag；水历史把线性深度写入RGBA16F alpha |
| `lens.js:173–179,224,270` | 主MRT4附件、UnsignedInt深度；DOF按标准projection重建；pickFocus把z>.99999标sky |
| `aerial-perspective.js:8,105–107,141,163,175` | 默认maxDistance12km，密度按world-Y，depth≥.9999999旁路sky |
| `fireworks.js:139–141` | 有限效果用主opaqueDepth手动遮挡，固定深度容差1e−6 |
| `water.js:184,202` | 反射向量强制global R.y≥.006/macro.y≥.012，只适用于当前局部平面近似 |
| `cloud-lighting.js:10–18,24,41` | 远云影仅±8192m，域外clamp边值；不能未经说明无限延伸 |
| `environment-capture.js:32,45–55,110–145` | cube默认原点[0,2,0]，独立冻结天气/UTC/P、六面后发布；只捕天空 |

上述行号对应B4检查时源码；实施前应以checkpoint hash核对，不以README代替事实。Three r180的near/far、filmGauge及投影实现可直接核对其[PerspectiveCamera源码](https://raw.githubusercontent.com/mrdoob/three.js/r180/src/cameras/PerspectiveCamera.js)。

## 必需的尺度与数值几何

以下为球形几何、无折射的视线地平线；不冒称真实地球大气折射已求解。h是**球形高度**，相机离原点较远时不等于world-Y。

`d_tangent=sqrt(h*(2R+h))`，`dip=acos(R/(R+h))`。

| h(m) | 切线斜距(km) | 地表弧长(km) | 俯角(°) |
|---:|---:|---:|---:|
| 12 | 12.355 | 12.355 | .11130 |
| 60 | 27.626 | 27.626 | .24888 |
| 190 | 49.161 | 49.160 | .44287 |
| 1700 | 147.061 | 147.035 | 1.32460 |

因此24km far在60m机位已不足。验证范围先明确为球形高度12–1700m、岛附近world-XZ约±2km；不能把它包装为当前无限飞行导航的全地球保证。静态far约300km/ring半径180–200km是覆盖该测试范围并给depth保留余量的**候选**，不是无需验证的常数；飞出该范围应有明确诊断/后续自适应策略，不悄悄出现新边缘。不能每帧随高度小变就反复重建资源/重置history。

取统一地心C=(0,−R,0)，q=x²+z²。远球面局部高度用有理化式：

```text
ySphere = -q / (R + sqrt(R*R-q))
gradXZ(ySphere) = -(x,z) / sqrt(R*R-q)
```

不能用`sqrt(R²−q)−R`在Float32里做两个六百万量级数相减。相同问题适用于球形高度：

`altitude = [x²+z²+y*(2R+y)]/[sqrt(R²+x²+z²+y*(2R+y))+R]`。

生产cloudAltitude已经使用后一形式，远海/air应复用这一坐标定义。72/240/500/1000m半径的球面下沉分别约.000408/.004528/.01965/.07862m，说明近岸可保局部平面，但远近之间不能只拼位置不拼法线。

若C路线或几何oracle求ray-sphere，令O为局部eye、d为单位射线：`b=R*d.y+dot(O,d)`，`c=O.x²+O.z²+O.y*(2R+O.y)`，`D=b²−c`。外部入射且D≥0、b<0时，近根可写`c/(-b+sqrt(D))`，避免`−b−sqrt(D)`的近根相消。必须单独处理on-surface/inside/无交点；不能用宽松clamp把真实无交点强变成海面。切线判定的Float32误差应对CPU Float64 oracle量化。

## A候选的最小几何与光学契约

1. 内部原地形/SWE/焦散/碰撞、海床高度与y0不动。初始比较可取r≤500m维持原局部高度，500–1500m接曲面，r≥1500m用球面。这是待测试的接缝半径；近岸视角不应靠修改海床遮缝。
2. 接缝使用C2平滑权重w；`y=w*ySphere+g*waveHeight`。正确导数包含`w*grad(ySphere)+ySphere*grad(w)`与`g*grad(waveHeight)+waveHeight*grad(g)`。不能用位置弯曲、normal仍world-up；也不能将旧side-effect waveField状态错当可重复纯函数。
3. g降低已解析波形时，丢失坡度方差转入BRDF，不能使远海变镜子。共用实际swell/windSea/uWind能量与方向，不增加另一套随机时钟或周期格纹。远区优先只保统计坡度、粗反射/体散射，不做海床求交、焦散、SWE或四张细波场反复取样。方向性坡度矩可先受控近似，但不能声称等同完整海洋论文。
4. 远海使用独立材质/模块，避免突破near-water当前16片元sampler上限。geometry预算假说：约128–256方位×24–40径向段，即约6k–20k三角形；70mm轮廓误差须实测，不能只看顶点数。额外约1 draw，无新增求解pass是目标，非已测成本。
5. 平面reflection仅供应岛附近物体反射。远球面不能直接沿用同一planarUV并假装具有球面物体倒影；远区先用天空与直接日/月统计反射，过渡处应按有效几何覆盖淡出planar物体项。近岸反射相机/oblique clip不改变，不把远环画进自己的镜面形成feedback。
6. 远海反射的法线是局部球面normal；不得复制`R.y=max(R.y,.006)`或macro global-y clamp。相对当地水平合法的射线可以有负global-Y。直接日/月采用同一实际keyDirection/physical强度、cloud字段和sceneScale一次；不重新把已含大气透射的key irradiance乘一次相同上层透射。

几何→normal→未解析BRDF的能量转移参考原作者[Bruneton/Neyret/Holzschuch 2010](https://evasion.inrialpes.fr/Publications/2010/BNH10/)；本候选只借其层级原则，不声称已实现论文完整照明积分。

## 深度、MRT与时间管线：不可省略的准入项

- **不伪造depth。** 若ring按普通projection绘制，主far、反射projection副本、辅助reconstruction和uniform必须同步更新；禁止把远点clip.z强压到1−ε却继续当标准depth重建。R32Fsidecar、多frustum或背景ray-sphere都属另一条明确协议，不能悄悄混入。
- **远水不能直接进现有半精度线性深度history。** RGBA16F最大有限值65504；147km会溢出。首选为far-water显式semantic并bypass短水history，远细节由统计BRDF稳定；near-water .70及叶coverage不动。若另选归一深度或Float32历史，须同时改所有写/读/校验与带宽报告。不能随意挑一个alpha导致被当树叶；MSAA交界混合的分类必须测试。所有MRT的motion/leaf-depth/reactive都要显式确定输出，不能留未写附件。
- **还有第二处独立的半精度米制深度。** interface反审确认`aerial-perspective.js:58`的volumeTarget是HalfFloat，`:166`将完整linear viewDepth写入scatterOutput.a，`:182`参与双边权重；147km同样会Inf。只绕开water history仍不够，air的距离存储/解码也需归一化或足够范围的格式，并检查无效邻居及0权重运算不会传播NaN。详见独立`FAR-OCEAN-INTEGRATION-AUDIT.md`。
- **背景epsilon不是距离常数。** near=.15时，z>.99999在far24km已把>9.23km标sky；far300km时仍把>14.29km标sky。air的1e−7阈值在far300km对应约250km，可覆盖本测试147km，但需留真实分配深度精度余量。pickFocus不能继续误报远海为sky；DOF在这些距离近似无穷远通常合理，但点击返回“物理距离”必须诚实。
- 当前深度申请UnsignedInt，需实际GPU核实D24等内部格式。标准1/z在near不变时，增加far对近处米制精度不应被夸成必然大幅恶化；真正危险的是远处只有少数depth码及既有epsilon。D24在147km的单码距离量级约8.6km，不能拿它做精确远距离测量/薄层排序。相关原理见[NVIDIA深度精度分析](https://developer.nvidia.com/blog/visualizing-depth-precision/)。
- 烟花固定`+1e−6`在近场尚小、在远处可跨数公里。需独立以ray-sphere/实际有限距离或深度误差界证明地平线后效果不漏出。不要仅凭附近岛上烟花可见就宣称通过。
- 暂不切log/reversed-Z。Three r180支持选项不代表本项目自定义projection、oblique镜像、depth重建、shader及MSAA都兼容；这是更大变更。[r180 WebGLRenderer源码](https://raw.githubusercontent.com/mrdoob/three.js/r180/src/renderers/WebGLRenderer.js)

## 空气、cube和P：让颜色接上必须靠同一光程

正确构成为`Lcamera=T(camera,surface)*Lsurface+S(camera,surface)`，只应用一次。近岸已在主HDR后走aerial，远海若自己算S/T就必须在后期明确旁路；若都交aerial，就不能再在far shader加一层雾。当前12km cap/world-Y密度无法用于147km曲面，且源强/积分标度与sky的22系数未证明完全等价，**几何改对后仍可能有辐射接缝**。

建议A首先共用球形高度、空气系数与有限endpoint积分契约，远海交一个完整camera→surface光程；初始8段，离线/小ROI64段作为误差参考。太阳到空气/海面的照明已经含何种透射必须明确：沿用原点key irradiance是有界的区域近似，不能再乘上层透射；若要在远点重算，则应从未衰减源开始且只算一次。低太阳/月夜尤其不能靠加亮背景修缝。原作者的有限段transmittance与aerial定义见[Bruneton实现](https://ebruneton.github.io/precomputed_atmospheric_scattering/atmosphere/functions.glsl)。

远云影cache只覆盖±8192m，clamp边值不是实测几十公里天气；不得把边值条带当真实海面云影。B5可以明确保留低频平均远云遮蔽近似，或另设可审查的world→光路投影策略，但需固定天气/日月A/B证明不引入径向/矩形边缘，不重启云形造型。

固定cube原点[0,2,0]的内容/天气/P是冻结一致的，但**它不代表距岛50–150km海面处的真实天空辐亮度**：云有视差、当地上方向改变、地平线附近差异最大。主view sky可在真实camera位置计算，cube仍在岛上，这是不同观察点。近岸保原cube；远区若先复用，必须标为低频天空近似并检查日/月低空反射，不能旋转整张cube掩盖horizon而把天体方位也转错。更准确的远点clear-sky反射可作为独立后续候选，不能不测成本便嵌套完整云march。

cube/PMREM保各自captureEV，采样乘`2^(sceneP−captureP)`一次；远海新增材质必须参与同一比例更新与raw radiance bound。camera C不用于工程缩放。重建env必须冻结完整UTC/天气/shape/continuity/sun-moon与P，六面一致后发布；远海不进入纯天空env capture，也不把一帧firework残光存入sky cube。

## 捕获/层/状态侧效应

`water.render()`只隐藏现有mesh。若新增far mesh，必须成组保存/隐藏/恢复near+far；不能把far海画进refraction layer1或planar reflection，不能影图里突然多出180km表面。保持scene sky、background、clearAlpha、camera layers、RT/cube face/mip及viewport/scissor恢复；异常路径也要恢复。环境capture克隆只有sky，应保持只有sky。far材质要被motionCapture的非叶MRT初始化正确处理，不新增半定义标签。

主far更新还需同步所有相机矩阵/逆矩阵与oblique计算的近远plane，重置/验证相关history；near plane不为depth方便而抬到数米，避免飞近灯/叶被裁。sky mesh的z=w/最后opaque early-Z策略保留，不能把sky重新先画全屏又被远海覆盖。

## 可推翻的实施与验收顺序

1. **几何oracle先行。** 固定B4与A候选，h=12/60/190/1700m，70mm，8方位；另测实际fair/humid四图原相机。Float64计算sphere tangent、ray hit与投影。GPU输出water/far-water/sky-ground分类及真实深度，无tone map；目标地平线位置误差≤1 native pixel，接缝无洞/双覆盖台阶。每一height的多个世界XZ应纳入，不仅原点相机。
2. **保近场。** 0–240m的terrain/SWE/波高/法线/折射/焦散、投石与浮叶，对同相位B4逐值回归；近岛正常/镜像相机图差单独计，不把新的远处区域算近岸回归失败或成功。
3. **深度夹具。** 12/50/80/147km远水与稍前/稍后小不透明/发光目标、sky清背景；看DOF/pickFocus、air分类、TAA history无Inf、MSAA水/sky/leaf边界；开启/关闭水AA均有限，不留ghost。若D24无法满足排序需求，推翻当前深度方案，不能放宽到恰好过。
4. **单次光路。** 真空/零散射、有吸收、同质介质可解析T/S夹具；far8段对64段小ROI；切换aerial开关与far路径不得出现双雾。固定同C/P比较day及月夜、太阳低角和水平/下视角；检查sky反射、直接日/月高光各一次与raw HDR有限/非负。物理上海天可以分明，不要求强行同色。
5. **连续视觉。** 在接缝两侧缓移/拖动、跨方位、风0/5、海况两端，检查ring分段轮廓、固定纹理周期、波矩转移闪烁、反射有效区、云影cache边缘。70mm之外再看28/120mm；不将单张静态通过等同运动通过。
6. **实际成本。** 同canvas/DPR/q、同相机/天气/time、预热后连续A1/B/A2；分别记录主view、mirror、air及near-waterGPU，raw rAF/GPU p95/p99与完整滚动1秒最低FPS。候选目标新增GPU成本≤约1ms只是预算假说，未测前不承诺60fps；含云70mm地平线与1700m下视大海像素覆盖两种压力视角。若为省时关云/海风或降q，必须另列，不作受控增益。

若以上支持A，再由root确定具体半径、surface-kind协议、空气实现和默认；interface对深度/MRT反审在`FAR-OCEAN-INTEGRATION-AUDIT.md`独立记录。未通过前不开始水代码编辑；本计划不改变B4冻结状态。
