# 固定快照的天空环境捕获

2026-10-26。`environment-capture.js` 独立模块；未编辑 main/renderer/sky。导出 `createEnvironmentCapture` 与纯函数 `chooseEnvironmentExposure`。

```js
const environment = createEnvironmentCapture(THREE, renderer, {
  atmosphere, cubeSize:256, faceRate:12, pmremInterval:2,
  onPublish(info) {
    // Complete GPU results published in one synchronous transaction.
    skyCubeTarget = info.cubeTarget;
    scene.environment = info.environmentTexture;
    scene.environmentIntensity = .8 * info.environmentRatio;
    water.uniforms.uSkyCube.value = info.cubeTexture;
    water.uniforms.uSkyCubeScale.value = info.cubeRatio;
  },
});
environment.initialize({time,utcMs,storageEV,physicalRevision,sunDirection});
// Every frame, after live atmosphere state was updated:
environment.update({time,utcMs,storageEV,physicalRevision,sunDirection,paused});
const {cubeRatio,environmentRatio} = environment.setSceneExposure(storageEV);
// Apply both ratios even if no new publication occurred.
```

`initialize(args)` 与 `refresh(args)` 同步画完整六面、生成PMREM、发布两者。`update(args)` 返回本次publication或null；普通调用最多画一面，12faces/s预算不追补一帧的全部积压。离散revision、单步UTC跳变>900秒、job超龄2秒或轮次边界太阳变化≥2°可排整刷；需累积6-face预算且间隔≥.5秒。显式initialize/refresh是调用方请求的同步整轮，绕过普通预算。建议拖动输入时由root节流调用，不每帧强制refresh。

正在捕获的连续UTC轮次不因每帧新时刻取消。真正离散revision/大UTC跳变会废弃尚未发布的后台轮次，前台仍保持上一套完整结果。全局paused不推进普通job，也不因墙钟超龄自己刷新；暂停中显式改变物理revision仍能排整轮响应。`physicalRevision` 必须表示**离散物理变更**，不能每tick递增。天空/weather连续密度相位由快照统一冻结。

## 曝光与原子性

每轮在 `atmosphere.captureSnapshot()/withSnapshot()` 内冻结日期、天体、云、均匀量，并冻结该轮shader/defines；每面调用`prepareStarView`。捕获暂时使用`uSolarDisk=0`，不往主scene增删对象。模块只拥有独立scene的sky克隆、两只HalfFloat cube、最多两只复用PMREM输出及其生成器；共享天空几何/纹理不由它释放。

captureEV根据天空自身P无关的`getRadianceBound().maxRGB`计算：偏好为`max(recommendedEV, maxRGB<1 ?21:0)`，再受`floor(log2((65504/4)/maxRGB))`限制。弱源21EV是避免HalfFloat下溢的**数值存储精度策略**，不改变摄影C，也不因用户关闭自动摄影而失去精度。最大通道上界留4倍headroom；bound过大超出当前atmosphere支持的−48EV下限时明确抛错。是否满足真实GPU源包络仍需集成后测，不把解析上界视为绝对测光校准。

场景P单独变化不重捕天空，只返回`2^(sceneP-captureP)`。cube一般每轮完成后发布，PMREM常规最多每2秒重建；各有独立tag与采样ratio。PMREM到期时先完成后台生成，再一起替换所有公开指针/标签。PMREM失败保留旧公开cube+环境，不发布“新cube+失败环境”。onPublish是同步通知，调用方应一次提交所列指针；若它自己抛错，模块保留已完成的内部发布并记录错误，无法回滚回调已造成的外部副作用。

publication包含`cubeTarget/cubeTexture/environmentTarget/environmentTexture/cubeCaptureEV/environmentCaptureEV/cubeTag/environmentTag/cubeRatio/environmentRatio/revision/pmremRevision/pmremUpdated/reason`。getters：`.cubeTarget/.environmentTarget/.environmentTexture/.state`；`.dispose()`幂等。

## 状态与边界

`.state.cube/.environment` 分别报告`captureAge`（物理相位秒）、`utcSecondsAge/utcSignedSecondsAge`；tag含固定位置、UTC、revision、EV与选择依据。另有后台face进度、排队原因、总面数、整刷数、取消数和错误。可选args.position `[x,y,z]` 固定观察点，默认`[0,2,0]`；这是单点环境近似，自由高空视角可传实际观察点但它不是空间辐射场。

每次捕获/PMREM使用try/finally恢复RT/face/mip、全局与当前viewport/scissor、clear、XR、shadow状态、toneMapping/outputColorSpace及天空snapshot，即便render/prepare/PMREM抛错。太阳盘不烘进环境与主路径重复。cube texture的最终mip只在第六面生成；实际mip边缘/驱动和GPU包络仍由root真GPU检查。

运行 `node verification/environment-capture-check.mjs` 写入同目录JSON。使用实际Three对象和被测模块、注入非GPU renderer/PMREM，覆盖安全P、弱星P独立摄影、六面快照一致、较慢PMREM独立标签、双buffer/原子失败、12faces/s、快进/暂停与异常恢复。**这是调度/状态夹具，不是GPU像素、shader编译或帧率验收。**
