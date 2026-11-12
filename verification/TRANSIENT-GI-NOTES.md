# Opt-in局部光一跳：独立实现与准入

2026-10-27。只修改`indirect-lighting.js`和本组独立验证/说明，**未接main/UI/water/local-lights**。冻结源码SHA256 **2299d1ebf24712fb7500256020d1051bcf7fda6c343af69c34d9c7a796a4079b**。原e32d0610…407d保存在`baselines/indirect-before-transient/indirect-lighting.js`。原25项CPU回归全过，新CPU23/23通过，GPU14项及旧40sample parity待root实际运行；不能称实际岛/水已新增GI或已达到某FPS。

## 接线

```js
await indirectLighting.ready;
// 每帧，localLights.update刚准备完同帧raw records，P尚未决定
indirectLighting.prepareTransient({
  sources: localLights.records,
  enabled: false,                  // 必须显式true；默认旧行为
  physicalTime: time
});
const rawGI = indirectLighting.getRadianceBound(); // combined，无P
// 统一radiometry把combined rawGI加一次；不要又加其分项
// 选好P后才对整个field应用一次：
indirectLighting.setSceneExposure(P);
```

保持旧`update`每帧调用、内部Sun/Moon仍2/4Hz+.18s；新的`prepareTransient`不使用那个节流。将raw baseline/transient准备移到选P前时，必须避免main旧位置又blend一次。`getRadianceBound({component:'base'|'transient'|'combined'})`可做debug预算，默认combined，包含`maximumRawIrradianceRGB`及albedo≤1时的`maxRGB=Emax/pi`，加1.000005浮点余量。只应预算combined一次；这个界是漫反射项，不是全场specular/绝对测光。

API返回本次`spatialSolves/cacheHits/visibilityQueries/updateMs/transportEpoch`。`diagnostics().transient`记录更新时间、固定6个源的unit捕获/安全归一/最近patch距离、功率、缓存次数与内存；诊断的sourceCapture保留各slot最后一次空间解，不active时需结合enabled/原raw输入解读，不是持续自发光。

## 严格保留与新近似

现red/green/blue数组仍只属于旧太阳缓存，原update算法没有更改。默认关闭时uniform仍引用这些原数组，逐值/排序与旧factory一致。开启时另写composed数组；关光或source rawRGB=0在同一physicalTime即时移除，无.18s余辉。flash从不写回旧太阳target/base，也不进入PMREM。GLSL、54vec4/共61vectors不变，无新sampler/RT/scene pass。

源仅用6条raw records（3地灯、torch、2pyro）的rawRGB、世界pose、radius/range及spot angle/penumbra，不读已P uniform。每源unit空间响应先算有限source→patch可见性、normal cosine与共享range/cone/近场分母，反射albedo逐RGB≤.95；再走原patch→probe权重。**每source/probe/channel先做`norm(a1)<=a0`的非负SH cone，再乘当前rawRGB并相加**，不先混源后投影。这样单位源响应与当前源强/颜色线性，开灯不会因负SH背瓣显著降低旧GI；保a0/整normal球Y00积分，改变方向与半球响应，不是假称正确面积源。

3个地灯的固定pose响应可直接缓存；所有6slot都按完整数值pose/radius/range/cone和私有transport epoch精确缓存，没有时间/位移量化。动态torch/pyro只要pose变就当帧重算；暂停下相同pose重用但raw envelope仍当帧乘。`invalidateTransientSourceCache()`仅flush源响应，**不重建旧地形/冠层/探针**；真实geometry改变须dispose并重建GI，不能传一个新epoch就宣称几何已更新。

地面新local采光明确使用`surfacePosition=[x,terrainHeight(x,z),z]`；旧`position=h+.065`不改，继续给原太阳/transfer/probe位置与可见性offset用。source→patch可见性从原proxy再沿normal偏置.04到实际有限源点，复用97²高度cache、最多48高度样本与静态多孔ellipsoid；不每帧Raycast真实树叶，不读回torch shadow map。与精确native叶影不同，wind/geometry不重建和18probe漏光仍是边界。

## 每源unit捕获上限

首次候选只有rho≤.95，但大patch近源点采样可过收能量：42m²、源正上方.108m时`ΣA Ei=3600.823`每unit I，而球源最多4pi=12.566。新增局部项现在先记录unscaled值，再以如下有限源上限统一缩放该源的unit exitance，**然后才投影cone SH**：

```text
OmegaPoint = 4pi
OmegaSpot = 2pi * (1 - (cosOuter+cosInner)/2)
safetyScale = min(1, Omega / sum_j(Aj * Ei_unit))
```

Spot公式是共享cos-angle smoothstep锥的解析积分：过渡区积分一半宽度，中心区积分全宽。range/visibility≤1。因rho≤.95，防过收后每RGB的unit反射功率≤.95Omega；raw源颜色/强度在之后相乘，P不参与。对上述42m²反例scale=.00348986064，ρ=.95时反射11.938≤.95×4pi。近spot示例Omega=.292224、scale=.0000811548。远场小patch cap=1。

这是**仅source→patch的保守安全归一**，不是精确面积光积分，不能证明probe整场精确能量。粗patch可把近torch光摊开；安全cap限制总量，不恢复缺失的空间分布。没有给旧太阳缓存新增cap，也没有更改source rawRGB/I/P或上游烟花源半径。各源`sourceCapture`固定6项：`safetyScale,capCount,unscaledUnitCapture,sourceSolidAngle,minimumReceiverDistance,maxUnscaledPatchIncident`；容量有界，无按flash历史增长的列表。

## 资源与验证

173patch时新typed buffers约18,840bytes：6×216 Float64 unit cache10,368、committed/pending SH3,456、composed Float32 864、patch scratch4,152；静态weights99,648bytes本来就有。每source最多一次单位响应，不按强度重复visibility。原研究Node合成fixture约.5ms不是本版实际场景预算；root须测灯-only、移动torch、双pyro和all6的实际CPU mean/p95，不能写死.2ms/60fps。尚未做额外性能refactor。

- `node verification/transient-gi-check.mjs` **23/23**：灰卡与1/r²、真地表高度、有限visibility端点、每源cone、42m²捕获反例与spot Ω、远场cap1/不依强度、原默认数组与GLSL、旧时间槽、实际local factory6源、pose/color缓存、无延迟开关、不污染太阳base、P不变、峰界/正增量、quality/非法输入/真实重建geometry、61vectors/无Raycaster。
- `node verification/indirect-lighting-check.mjs` **25/25**原回归。初版新CPU19/20仅因fixture误写`return0`已保留`transient-gi-check-first.json`，改成`return 0`后通过；没有靠改物理容差通过。
- GPU helper `runTransientIndirectGPUCheck(THREE,renderer,{parentLocked:true})`，来自`transient-gi-gpu-check.js`，冻结SHA **09710a6f944b7fff6bb4e9339ae467014eb9febe1c9a92c6a224509a6d8357b1**。**14项+共享旧40sample parity待实际运行**：默认/关闭比旧factory逐bit、真实MeshStandard receiver无native direct时有反弹、GPU/CPU lookup、P、bound、同刻off、2Hz槽、raw0、近源cap、61vectors/0sampler、finite与状态复原。

GPU helper要求parent独占renderer、当前DPR1（它复用的旧parity helper有此限制，先检查而不改DPR/画布）。私有flat terrain/receiver只能证明接线与shader，不是实际岛/叶/海床、完整阴影或FPS验收；source单位也只是声明参考。真实全谱、全场多跳、specular GI、水界面折射反弹、烟/云反弹和source→smoke自身遮光均未新增。
