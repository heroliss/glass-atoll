# 实际页面的接收面照明验证

2026-10-31 最终环境 A/B 已完成：[baseline-receiver-scene.json](baseline-receiver-scene.json) **30/30**、[current-receiver-scene.json](current-receiver-scene.json) **31/31**，[browser-lighting.json](browser-lighting.json) 的 `passed` 与 `coreReductionAccepted` 均为 `true`，九份生产源码指纹与当前文件匹配。首轮植被遮罩失败及相机浮点比较失败均保留，不能用最新通过覆盖历史失败。三款最终回放与媒体检查 **3/3**、[审看页实际 Chrome 检查](review-ui-check.json) **12/12** 亦已通过；完整结果见 [ACCEPTANCE.md](ACCEPTANCE.md)。

`receiver-scene-check.js` 是实际生产场景的 QA fixture，不替换岛屿或构造额外光源。本轮 `browser-lighting.cjs` 显式发射一发 `display-flower`、seed 619，精确停在同一事件主爆后 0.008、0.08、0.8、1.7、2.6 秒，各阶段比较同一物理时刻的照明开启、关闭、恢复。

关闭分支同时临时包裹 `fireworks.getLightClusters()` 和新 `getReceiverLightClusters()`，使生产 photometry 更新自然清零云/GI及本地接收灯；粒子与其可见 core 不关闭。每次切换均用已有 `setDiagnosticCameraEV` 强制正常更新，摄影 C 固定，读取的线性存储 RGB 分别除以该次的 `2^P` 后相减。最后在 `finally` 恢复两个 getter，再触发正常生产更新并等一个实际帧。

原 `getLightClusters()` 仍供云等原消费者，但持续烟气共享 `localLights`，也会采用当前新的 receiver 代理及本地灯范围。因此不能由旧 getter 保留推导烟气受光全部不变；本 A/B 只对声明的沙滩、grove 与海水接收面作定量验收，未单独证明密烟场景。

root 已在 `main.js` 的 `window.__ATOLL__` 中接入 QA 入口，fixture 的准确导出为 `runReceiverLightCheck(atoll, options)`：

```js
async runReceiverLightCheck(options={}) {
  const {runReceiverLightCheck}=await import('./verification/lighting-choreography/receiver-scene-check.js');
  return runReceiverLightCheck(window.__ATOLL__, {
    ...options, THREE, renderer, fireworks, lens, camera, terrainHeight,
    localLights, scene
  });
}
```

不要给此入口设置阻止正常 rAF 的 `qaRenderLock`，fixture 需要正常生产更新；由 root 确保此时没有其他诊断。旧 `runTrajectorySceneCheck` 传参不足以提供实际 fireworks/lens/localLights，因此本版采用上述独立入口，未修改或劫持旧验证模块。

最小调用：

```js
const report = await page.evaluate(() => window.__ATOLL__.runReceiverLightCheck({
  type:'display-flower', seed:619,
  phases:[.008,.08,.8,1.7,2.6],
  width:320, height:240, capture:true
}));
const {images,...metadata}=report;
await fs.writeFile('receiver-scene.json',JSON.stringify(metadata,null,2));
for(const item of images){
  const marker=';base64,',at=item.dataURL.indexOf(marker);
  if(at<0)throw Error('PNG data URL missing base64 marker');
  await fs.writeFile(item.name,Buffer.from(item.dataURL.slice(at+marker.length),'base64'));
}
```

调用前可设 medium、SDR、DPR1，等待 ready；页面必须没有既有 active/queued 烟花。fixture 会保存偏好并恢复，但无法倒转物理时钟或消除已发射事件，因此基线/候选都应使用新页面。图片命名包含阶段及 `receivers-on/off/repeat`、`core`；还会保留相机定位见证图。图片是实际生产 SDR 画布，仅用于人工核对受光区域，定量值来自 tone mapping 前的纹理。

实际接收面来自主场景 MRT：水面采用生产 `.70` alpha tag，`leaves` 键采用真实 grove 覆盖深度附件，沙滩采用 depth 重建世界位置与真实 `terrainHeight` 一致且高于海面的像素。`leaves` 是保留的报告字段名，其实际语义为棕榈与灌木植被，包含树干、叶轴、叶鞘、枝条及叶片，不能当成纯叶片分割。采样数不足会失败，不把空/全黑读回判作照明通过。沙滩分类是有界的几何近似，需用 PNG 核对；报告不会把它说成手工验过的完美语义分割。

首轮 fixture 设置 `temporal:false`，而 `lens.js` 仅在 `requestedMotion && useTemporal` 时启用植被 motion capture；`vegetation.js` 在 capture 关闭时明确把附件 2 的 `groveCurrentDepth` 写为零。这使五阶段 `leaves` 均为零样本，属于 QA 配置错误，不能解释成机位没有树或植被不受光。root 已将首轮 fixture、两臂报告、50 张 PNG 及汇总报告共 54 个文件归档到 `before-first-leaf-mask-check/`，保留失败证据。修正后的 fixture 使用 `temporal:true, temporalJitter:false`，使实际覆盖深度可读且不引入人工采样抖动。

接收面定量读取的是 `opaque`/`sceneTarget`，位于 temporal resolve **之前**；开启 temporal 的目的在此是取得原生产 pass 的植被覆盖附件。A/B/repeat 的 RGB 差值不经过历史重投影、历史混合或最终 SDR 曲线。PNG 则来自完整生产画布，可能包括 temporal resolve，仅供画面核对，不能反推定量值。

纹理由 root 新增的只读 `lens.getDiagnosticTargets()` 获取：`opaque` 是实际 `sceneTarget`，`composed` 是实际 `lensTarget`。fixture 不再临时包裹 `renderer.render`。重建位置使用 shader 实际选中的 source texel 中心；各材质统计同时报告全体样本和正差样本的 `uvBounds`，可核对测量覆盖范围。默认 `receiverCamera` 是已有 island 视角 `[-65,30,54] → [2,3,0]`，24mm，朝岛俯视，适合沙滩/植被/近海接收面；此机位无需把高空花冠纳入画面，core 单独采用 `fireworks-close`。

`sample` 可以补充世界点投影 patch 与固定画面 patch，不改变全幅判定。所有 UV 均以左下为原点，`radiusPixels` 以生产 source texture 的像素为单位；`rect` 是 `[u0,v0,width,height]`。例如：

```js
sample: {
  worldPoints: [
    {id:'island-centre', position:[-1.5,1.3,-1], radiusPixels:24, receiver:'sand'},
    {id:'near-sea', position:[-12,0,28], radiusPixels:32, receiver:'water'}
  ],
  fixedPatches: [
    {id:'lower-sea', rect:[.05,.05,.9,.3], receiver:'water'}
  ]
}
```

示例世界点只是几何候选，未声称它们在所有机位都可见。每阶段 `patches` 报告实际投影、入镜状态、中心实际材质/重建世界坐标、中心相对请求点的径向深度差、三类真实接收面各自的样本数和差值。世界点可能报告 `outside-camera`、`occluded-at-grid-centre`、`point-in-front-of-observed-surface`、`no-covered-centre` 或 `geometry-consistent-at-grid-centre`；该状态仅是有界 grid 中心的粗深度检查，邻域统计只描述实际看见的几何，不证明被遮挡世界点自身受光。没有覆盖会保留零样本，不伪造可见性或让它自动通过。

实际两臂由 `browser-lighting.cjs` 在独立浏览器 context 中顺序运行，使用 medium、SDR、960×720、DPR 1。这里的 baseline 是为隔离光学表示和接收光改动构造的混合基线，范围如下：

| 项目 | baseline | current |
| --- | --- | --- |
| 编排、物理依赖、当前爆闪出生/寿命/半径、shader、lens 和 QA fixture | 共享当前版本 | 共享当前版本 |
| 烟花渲染工厂 | 路由到 `before/fireworks.js` 原件；只补 `getReceiverLightClusters = getLightClusters` 的接口别名 | 当前 `fireworks.js` |
| `localLights` 接收簇（地表及共享此灯的持续烟气） | 原有云/烟簇的别名 | 当前最多两个专用 receiver 簇 |
| 本地灯实现/截断距离 | 路由到 `before/local-lights.js` 原件，烟花范围 280 m | 当前本地灯，烟花范围 4096 m |
| 摄影 C | 基线固定值 | 使用基线报告同一固定值 |

因此该对照不代表整套旧编排或旧 0.18 秒爆闪物理的回放，也不是只改一个变量的消融。它比较上述光学表示、接收簇和本地灯组合；原 `getLightClusters()` 输出及物理依赖的隔离一致性另由 CPU factory 检查说明，不代表所有烟气照明消费者都不变。每个 metadata 的 `baselineScope` 与最终汇总 `sourceHashes` 保存运行范围；两臂是否完成和通过以对应 JSON 实际结果为准。

可见 core 使用已有 `fireworks-close` 相机，在源包围盒中心附近逐像素读取 192×192 的实际 composed HDR（爆闪已经合成、bloom/tone mapping 尚未应用）。报告保留 crop、相机、focal、C/P及 peak/p99/mean。先对基线新页面调用一次，导出不带 images 的 JSON；候选新页面调用时传 `baseline:baselineMetadata`，并固定相同 `exposureEV:baselineMetadata.fixedCameraEV`。core 降低判定仅比较 `phaseSeconds <= .04`，在本轮五阶段中即 **0.008 秒**；0.08、0.8、1.7、2.6 秒仍保留有限/非零检查和峰值记录，不要求晚期花冠持续变暗。早期峰值要求至少下降 2%，seed/type/C/crop/focal 精确匹配，相机位置及 target 的欧氏距离分别不超过 **1e-9 m**。没有 baseline 时 `coreReductionAccepted:false`，不会据单段自称爆闪已降低。

最终 0.008 秒的实际线性峰值为 **8.16251475 → 0.20912248**，比值 **0.02561986**，约下降 **97.44%**。该值比较的是上述混合 baseline 的早期可见 core，不是烟花总辐射能量或全部生命周期的统一暗化比例。最新相机与 target 差均为零；[before-camera-tolerance-fix/](before-camera-tolerance-fix/) 保留先前 baseline 通过、current 核兼容比较失败的报告。当时两臂位置差约 `2.84217e-14 m`、target 差约 `4.08176e-14 m`，被精确数组比较误拒。当前 1e-9 m 容差仅处理此类坐标舍入，未放宽 crop、焦距、曝光或事件匹配。

```js
// baselineMetadata 是上一实际页面的结果，别把图片数据重复传入浏览器。
const candidate = await page.evaluate(baseline =>
  window.__ATOLL__.runReceiverLightCheck({
    baseline, exposureEV:baseline.fixedCameraEV, seed:619,
    type:'display-flower', phases:[.008,.08,.8,1.7,2.6]
  }), baselineMetadata);
```

`report.passed` 包括读回有限、精确同一时刻、off 灯归零、沙滩/植被/水面每阶段足够采样、至少一阶段各自超过 on/repeat 数值噪声、源亮度与位置随燃烧变化及钩子恢复。`requireColourChange:true` 可对明确选定的多色烟花额外要求实际源色度变化；本轮 runner 对 `display-flower` 启用了这一检查，单色类型不应凭空要求变色。强制 default profile 是 legacy，本 fixture 暂未支持新 layer profile 的单独基线/候选选择。最终两臂均通过，current 额外通过匹配 baseline 的早期 core 降低门；首轮归档和旧中间报告不能替代最终指纹对应的验收。

接收簇、参考光强/颜色、4096 m 本地灯截止范围、爆闪可见份额与衰减均属于工程作者参数及有限代理近似。它们没有绝对 lux/nit、真实燃料、热/冲击波或辐射能量标定；本测试也不把 grove 统计提升为纯叶片测光，或把同步读回变成性能与主观亮度结论。

已有检查的范围：`transient-light-proof.mjs` 仅 CPU 数学/聚类证明；`runTransientIndirectCheck` 是孤立平面 GI；`runTransientCloudCheck` 是实际云 shader 的隔离高强度源/镜像 fixture。它们不能代替本 fixture 的真实沙滩、棕榈与海面 A/B。这里的同步 GPU 读回也不能当 FPS 测量。

最终声画证据见 [dynamic-gallery.json](dynamic-gallery.json) 与 [media-check.json](media-check.json)：金羽、银瀑、岛屿机位花冠分别 **20.04、20.48、17.64 秒**，1555 张 compositor 来源图、9 张阶段图及14份音频文件指纹已核对。音频指纹是录制后的来源快照，不是采集中响应封存。审看页的三片实播、2×裁看恢复、序播停止、390 px 布局与四张受光对照图均通过。原始生产音轨独立采集、源图按墙钟节奏量化到40 ms网格；技术连续性与非静音不等于主观听感或毫秒级声画同步。旧 scalar/legacy-bound 检查的实际失败另列于 [验收记录](ACCEPTANCE.md#保留的历史失败与中间结果)，未改写历史结果。
