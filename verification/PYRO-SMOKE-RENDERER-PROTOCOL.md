# Gaussian烟渲染StageA实施协议

后续共享局部光照opt-in扩展见[PYRO-SMOKE-LOCAL-LIGHTING.md](PYRO-SMOKE-LOCAL-LIGHTING.md)：当前renderer冻结SHA982682…32818、CPU13/13，原air-only07914版本作为GPU baseline保留；本文件中07914结果归属于该历史air阶段，不能混称全部新GPU已过。

2026-10-27。生产接口已在独立`pyro-smoke-renderer.js`实现；**未接main/lens/water/旧fireworks，未改state**。首个无空气源SHA256 **594c5b289d98f83b0f58dc6667e74538bb144a7bb6a24c214b1a1319832aff86**已保存到`baselines/pyro-smoke-renderer-before-air.js`。该版root实际运行[GPU helper](pyro-smoke-renderer-gpu-check.js) **18/18通过**，结果[pyro-smoke-renderer-depth-gpu.json .smoke](pyro-smoke-renderer-depth-gpu.json)。不能把独立夹具通过写成app全链已接通。

首次实际GPU已保留[7/15失败结果](pyro-smoke-renderer-gpu-first.json)。8个失败都是T背景见证RGB为0，alpha却与CPU的1−T吻合；独立debug tau/mean、P与HG均通过。确证根因为helper用white/alpha0初始化：本地Three`WebGLState.ColorBuffer.setClear`在premultipliedAlpha上下文会先做RGB*=alpha，实际清成黑。修复仅在helper：white/alpha1测背景T，并独立black/alpha0测透明opacity，原容差未变；renderer源没有改。v2 helper SHA **91df09d3700e40c587682b2f667aba755155eaa87efe3f40e827c8642ed277a3**，新增初始化见证与独立alpha检查，共18项，root重测18/18通过。失败不是改阈值消失。

当前GPU depth用CPU projection编码的1×1 synthetic DataTexture，验证clip数学与GPU采样；**不是实际opaque geometry draw/depth resolve/copy链**。v2已改名和limits明示。root另做独立真实geometry的depth-copy夹具，结果须分别归属，不能从本组推定生产深度资源链已验证。

随后授权的opt-in前空气修正已落到同一独立模块，air-only阶段冻结SHA **07914ffaf2114a527653eeb2811be1ac0c7a8753a32aeea790f7ca4515081e77**。旧math18/18与新[air math15/15](pyro-smoke-air-math-check.json)通过；[air GPU helper](pyro-smoke-air-gpu-check.js)14项已提供，实际GPU结果另记，不能沿用无空气版18/18冒称新层已实测。

## Opt-in前段空气层

`render({...existing, air:finiteAirPayload()})`可选，缺省/`enabled:false`保留先前RGB语句与uniform关闭路径。`getRadianceBound(lighting,{air})`向后兼容原1参；`components`报告`smokeSource`和`airFront`。air字段为`enabled,betaRayleighRGB,betaMieExtinctionRGB,betaMieScatteringRGB,rayleighHeight,aerosolHeight,asymmetry,sunDirection,rawSunRGB`。系数米制、非负；Mie散射必须≤消光，height为正Float32，|g|≤.9。`ambientIrradianceRGB`本层不作为额外空气入射，避免暗中重复天光。

每个packet以**真实有限column的光学conditional-mean**处折成薄层：主视线从真实眼点，镜像从water-hit开始；到此点用与旧finite effects一致的4个距离平方分段、中点高度指数系数积分`Tair,Sair`。输出为`opacity*(Tair*SSA*sourceStored+SairStored)`，alpha仍是`opacity`。已含clean-air的背景在被烟衰减时也会衰减烟前方空气，`opacity*Sair`恢复这一前段，不能只增加Tair。理想有序薄层下可由分段传输代数证明，两个层的CPU反例/恒等测试已包含；**真实重叠Gaussian、用conditional mean替代整段散射与4步高度采样仍是近似**，不是完整联合RTE。

rawSunRGB已来自root太阳/月亮raw radiometry，不再额外乘太阳透过率；CPU仅与其他raw源相同乘一次`sceneScale=2^P`，shader不二次乘P，不读C。日光树/云遮挡、source→puff衰减、新烟源照空气、多散射仍未做。空气高度`max(0,worldY)`与旧局地模型一致，不代表地下空气或曲地球积分。

air上界为`max(rawSunRGB)*max(3/(8pi),HGmax(gAir))*1.00002`，和raw烟source上界相加；**使用空气g≈.76，不能误用烟g=.32**。passive约束确保同通道散射≤消光；分层over的非负权重和≤1，因此不按历史packet数放大。1.00002为4步旧small-tau积分用ds近似及Float32的小余量，CPU穷举短cell比率≤1.000005；不是对任意驱动算术的形式证明。`diagnostics`与lastRender记录frontAirEnabled/frontAirCells，关闭时不跑4步。无新RT/sampler，启用后每个烟片元增加4个局地高度cell的指数计算；实际GPU成本须另测。

## 本轮选定的有限方案

选择每packet一个instanced保守屏幕proxy，frag用真实世界SPD Gaussian沿有限射线的列积分。proxy只分配光栅覆盖，**不以proxy中心深度作完整遮挡**。全部instance按latent中心view depth从后到前，一次premult draw；**没有额外tauRT**。

Neutral extinction使每层`alpha=1-exp(-tau)`，`RGB=S`已premult。blend为ONE / ONE_MINUS_SRC_ALPHA，alpha也同式，因而背景的总透过率在实数算术上为`prod(exp(-tau_i))=exp(-sum(tau_i))`，与层序无关。Float32 erf、GPU blend/目标精度、有限proxy截尾仍有误差；这不是无偏GPU或像素/光圈积分的承诺。

S是每团的光学conditional-mean处取源函数，再做常源层近似。**中心排序不解重叠介质的source顺序**；T正确不使S自动正确。原作者[PBRT transmittance](https://pbr-book.org/4ed/Volume_Scattering/Transmittance)明确区分透过率与in-scatter。Gaussian体研究也区分解析transmittance与仍需积分的散射；不是把3DGS alpha贴片换名字就得到完整体传输。[作者项目](https://arcanous98.github.io/projectPages/gaussianVolumes.html)

## API与单位

```js
const smoke = createPyroSmokeRenderer(THREE, renderer, {
  maxPackets: 4096, supportSigma: 5, anisotropy: .32
});
smoke.setState(smokeState.snapshot());
smoke.render({
  target, camera,
  opaqueDepth,                 // 独立且已resolve的depth纹理/原始depth-copy
  reflection: false, planeY: 0,
  frame: { storageEV, sceneScale }, // 若同时给，须sceneScale==2**storageEV
  lighting: {
    ambientRGB,               // raw irradiance参考，按本轮约定除4pi
    rawDirectionalRGB, directionalDirection, // 已到局地的raw入射，不是disk radiance
    rawPerCandela: 3.6e-5,
    clusters: [{ position, radius, referenceCandela, color }] // 最多2
  },
  optics: { vignette, focalMm: 28, sensorHeightMm: 24 }
});
smoke.getRadianceBound(lighting); // raw beforeP；冷烟凸组合source上界
smoke.diagnostics();
smoke.dispose();
```

lighting全部是**未乘P的raw值**，不能传tone-mapped framebuffer、已传至眼的屏幕星点RGB或已预曝光颜色。模块仅将入射uniform乘sceneScale一次，输出不再次乘P；不读取摄影C。若同时传P和sceneScale而不一致直接拒绝。ambient/4pi沿用当前参考协议，不把未标定ambient解释成完整测量IBL分布。

只接受`extinctionPerMassRGB`三通道相等的profile（包括近零时的相对检验）；SSA可为RGB。非neutral profile明确拒绝。water当前单alpha剩余sky语义不能编码RGB T，不能悄悄把彩色消光转亮度。state仍保完整相对M；renderer不删除packet或改变物理寿命。0 opacity profile可不绘制，但物理库不变。

## 数学与数值步骤

每团`Sigma=L*L^T`，用一般3×3 Cholesky，保留相关项。`normalization=M*k/( (2pi)^(3/2)*det(L))`。沿camera起点o的单位世界射线d，先得到实际可见区间[a,b]。改用局部变量t=s−a，白化：

`q=L^-1*(o+a*d-mean)`、`v=L^-1*d`、`A=v·v`、`B=(q·v)/A`。

垂距用`q-v*B`算，避免`C-B²/A`相消。然后：

`tau = normalization * exp(-.5*|q-vB|²) * sqrt(pi/(2A)) * DeltaErf(sqrt(A/2)*B, sqrt(A/2)*(b-a+B))`。

光学均值使用同区间的一阶积分I1/I0；不是latent mean、proxy中心或虚拟image中心。小I0/病态尾区显式回到区间内closest point近似；正常分支与fallback由debugMode1可读。clamp的是理论应在[a,b]内的取光位置，**不是末端颜色clamp遮NaN**。tiny erf区间用两节点导数积分，避免erf(0)常数误差与相近tail相减。CPU state公开column与独立密度RK/Simpson作oracle，GPU仍有Float32近似误差。

包中心每view以Float64在CPU减camera world，再上传Float32，协方差保世界轴。拒绝非有限/非SPD、无可表示normalization和超GPU参考光学动态域，不在shader末端静默改物理值。

## 有限段、近面和main深度

actual inverseProjection在每次render从**当前camera.projectionMatrix现场求逆**，不依赖可能陈旧的projectionMatrixInverse属性。主/镜像均如此。普通near/far depth线性化公式不能用于oblique mirror。

- 由fragment UV和inverseProjection构造真实perspective ray。
- 采样独立opaque depth，若有opaque，则反投影其世界距离，截end。
- main从camera光心start=0积分，**不因烟核中心位于near之前而删掉整团**。近面只裁几何，不代表光心→near之间不存在烟。
- proxy是屏幕rect，depthTest/depthWrite均关，手工按真实volume ray/end裁。中心在树后而近端烟在树前时仍保留正确前段column。
- camera在support内/球跨光心时使用全屏fallback；完全位于光心后方且不相交的support可按尾误差界省掉。
- resolved depth是最近opaque表面；透明叶覆盖/MSAA、背景DOF已经重建的边缘仍有限近似，不能宣称多层透明深度已解。

当前renderer没有volumeDOF。main callback在opaque空气/DOF之后，给S选项式补一次同镜头vignette；T与已有vignette相乘可交换。反射不应用主镜头vignette。未来要体烟景深，应有光学深度矩/有限分层或额外射线，不能读背景depth假装烟深度。

## 镜像与透明reflection RGBA

当前`water.js:338–345`先画scene到透明reflection target，然后有限效果callback；`water.js:186–187`用`reflection.rgb+(1-alpha)*skyCube`补剩余天空。StageA neutral烟合成：

`Cnew = T*C + S`，`Anew = 1-T*(1-A)`。

水最后得到`T*(C+(1-A)*Sky)+S`，保留正确剩余sky权重。RGB extinction没有单一A能同时表达，故本轮不支持。RGBA16F混合的很多极薄层会有舍入损失，必须用helper扩展压力夹具量化，不能因为实数恒等式就叫FP16完全精确。

镜像射线的物理空气起点为water-hit：`start=max(0,(planeY-eyeY)/dY)`，并要求dY>0。end仍由**mirror的独立opaque depth**截断，源均值在水面后不等于其全部Gaussian都被挡。camera→water前景烟和water-hit→反射世界是两段，各算一次；水下虚拟camera→water不能当空气。平面0光路裁切不是质量reflecting-kernel，两者不可混称。

**当前生产callback的opaqueDepth=null不满足新协议。** 新module默认拒绝缺深度，`allowUnoccluded:true`仅独立无opaque夹具。不能直接把reflection.depthTexture一边附着在drawing target一边采样；模块发现同对象就拒绝feedback。生产应先resolve/copy为独立R32F depth或分离opaque RT，再绘烟/星。copy和resolve由root集成，module不暗建RT。

mirror projection在water中直接改oblique矩阵元素，并未保证camera.projectionMatrixInverse随之更新；现场逆P是必需步骤。原颜色RT mipmap仍可之后由caller维护；媒体shader只textureLod(depth,0)，不使用varying-loop implicit derivatives。

## 发光星、旧烟和光源反馈：待接的准确顺序

本模块只绘烟，不偷偷改变旧fireworks里的星/短烟路径。

**main建议：** opaque/水→现主空气/opaqueDOF→独立持久烟→发光head/tail（每源先乘其自己到眼的T_smoke）→一次共用bloom/SMAA/tone-map。独立烟若已启用，旧8.5s烟必须显式关，不得两份质量叠画。

**mirror建议：** opaque scene→resolve独立depth→持久烟（水hit起点）→镜像head/tail（各自水hit→源T_smoke）→必要的当前瞬态cloud delta→供water读取。不要将烟/flash写进长期skyCube/PMREM，再在反射callback重复加。

旧烟先画、星后显式T可以避免烟alpha第二次遮同一个星。**不能把到opaque的整像素T套到所有星**：前星不应被身后烟遮。纯point head在其真实ray attenuation后进入现PSF；尾段需按真实anchor/空间积分粒度采样T，整条长尾只用head的T属额外近似。blurred point PSF各像素来自同一理想点，中心ray近似不等于有限光圈体积散射已解。

最小可测方案是CPU BVH按head/tail anchor查解析column，候选按support和可量化tail界剔除；**不能每fragment遍历全4096**。BVH worst case仍可命中4096：不能静默cap候选丢质量；须报告ray数/visited/尾段端点T梯度与实际CPU时间，超预算应明确选择coarse density/deep-transmittance cache，而非宣称固定无损成本。

## source function与尚缺的光路

本轮`q=SSA*(ambientRaw/(4pi)+phaseHG*rawDirectional+sum(E_cluster*phaseHG))`，cluster采用rawPerCandela*I/max(d²,radius²)。minus-HG的mu是`dot(viewRayFromEye,L_toSource)`；两外向量时应反号，沿用已修方向约定。[原作者相函数约定](https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions)

取光点是该packet有限column的conditional mean，zero-distance有限源用有界isotropic中心近似。不读target/烟RT作为照明，不将屏幕源颜色当入射，不把散射再变成一个新发光簇。冷烟只有散射，无自发光。

**以下本轮未做：** source→smoke的T_light、烟自身shadow、tree/cloud/torch遮挡、完整联合air+smoke、多散射。原始18项isolated GPU helper刻意air disabled；新增可选前空气薄层修正和单独oracle见文首，不能把本轮解析tau称为完整joint media。

对两个不同source function的体层，即使tau可交换，S不可交换；同位置强叠、near light梯度和厚烟是本近似的主要反例。`getRadianceBound`只给当前未遮挡raw source的保守上界：最大SSA×[ambient/4pi+HGmax*(directional+sum(I/r²))]。分层over的S是有界source的凸组合，不随历史packet数线性放大；它不能给未来新self-shadow/GI/cloud路径背书。

## 资源、截尾与成本

- 一个instanced quad，6个attributes，约68bytes/packet动态数据，4096时约272KiB/view；主/镜像同一世界packet状态，仅各自重排/重基准。1个独立depth sampler；两簇光uniform；无新增water sampler/无额外tauRT。
- 当前proxy用`supportSigma*sqrt(trace(Sigma))`世界包围球，再投影其AABB，包含5sigma椭球但对细长packet可能过宽，overdraw并不小。一次draw不等于一团或一帧固定成本；大量全屏fallback可退化到高overdraw。诊断记录instances/culled/fullScreenFallbacks，真实timer与像素覆盖预算须另测。
- 对missed R-Mahalanobis support的射线，单团遗漏column上界可用`M*k/(2pi)*||Sigma^-1||F*exp(-R²/2)`，因为`||Sigma^-1||F>=1/lambdaMin`。报告所有团上界之和，T绝对误差≤遗漏tau之和。proxy内仍积分整个真实有限射线，不将其在世界support入口/出口截掉。此界是point-ray光学厚度界，不是全场“删除质量”或pixel/光圈成像误差。
- 4/5sigma并不自动给任意源强固定视觉误差；质量/消光大时界会大。物理库M完全保留，渲染尾部舍入与proxy误差须公开。subpixel Gaussian pixel-average不是exp(-meanTau)恒等式；本轮未实现完整足迹积分。
- 若未来改τRT，加法logT可绕开每层T≈1的FP16丢失，但32bit float blending需实际能力夹具；Khronos明确32bit浮点blend依赖`EXT_float_blend`与renderable float支持。[规范](https://registry.khronos.org/webgl/extensions/EXT_float_blend/) 本轮未采用此RT，不偷偷增加资源。
- 只有T(opaque)一张图无法给任意emitter深度T；需要额外射线查询、体密度cache或deep opacity。早期deep-shadow工作正是存不同深度的visibility，而非单depth值。[原作者论文页](https://www.graphics.stanford.edu/papers/deepshadows/) 有限层cache仍有深度/过滤误差，不能命名“精确”消除它。

## 独立验证→生产准入

已提供`runSmokeGaussianGPUCheck(THREE,renderer)`：私有场景/Float32RT、复原caller状态，无app/browsing依赖。覆盖single finite tau、conditional mean独立RK、中心在opaque后仍有前段、inside、near之前烟、相关SPD、actual oblique inverse+water hit、mirror独立depth、feedback拒绝、多团T、P一次、HG前后与raw bound。必须实际运行并保存GL errors/读回结果；失败保留，不能以改变阈值掩盖。

后续还要扩：17/33px全图proxy边界与per-ray tail bound、近面横穿、极薄多层FP16失真、主/镜像同点路径、不同q厚叠与独立joint RK误差、极端P/蓝源及所有RT IEEE非有限扫描。固定时间/packet/相机/曝光测CPU bounds-sort-upload和真实GPU时间，含相机进入最浓处。当前不宣称满4096、1440×900或30/60fps已通过。

生产root接线前须先完成：独立resolved mirror depth；关闭旧短烟；发光源自己的T_smoke；新clean-air前段GPU/场景协议；raw source/P/反射skyalpha夹具。以上未封闭前，独立模块通过不能写成网页已升级完成。
