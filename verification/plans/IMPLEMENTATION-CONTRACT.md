# 实施接口与文件边界 v1

2026-10-26；与FINAL-DESIGN同一阶段门。下面是实现契约，不是现有API声明。Root负责最后main/renderer集成，任何接口变更先相互通知，避免各自猜不同的物理/曝光语义。

## 公共帧与光学数据

```js
frame = {
  time, dt, // physical seconds, never astronomical accelerated delta
  utcMs, observer, windVector, weather,
  storageEV, cameraEV,
  rawPerCandela, // declared effective reference, not a claim of absolute lux
  sceneScale: 2**storageEV
};
optics = {width,height,focalMm,aperture,focusMetres,sensorHeightMm,dof,vignette,shutterSeconds};
```

模块提供未乘sceneScale的source radiance/光度界限，由root统一选storageEV，再在每个输出路径恰好乘一次。不要在模块里读renderer.toneMappingExposure再猜sceneScale。事件用物理time，音频另映射AudioContext时钟。

## 天体（tropical_vegetation）

可拥有 `sky.js`、`night-sky.js`、新 `celestial-controller.js` / `star-field.js`、`assets/night/catalog/`和对应离线生成/验证文件；不改main、water、lens、ui/index/style。

- `createCelestialController({utcMs,latitude,longitude,height,timeZoneOffsetMinutes,rate,running,mode})`：`configure(patch)`、`update({time,dt,paused})`、`get state`。输出连续日/月几何及视方向、角半径、月相、EQJ旋转、epoch/revision。统一+X东/+Y上/−Z北；界面地理az北起顺时针。
- atmosphere新增 `setCelestial(snapshot)`：同步天球，不自己再使用另一UTC；保留旧艺术setSun兼容。`setStorageExposureEV(P)`明确覆盖数值预曝光，`lighting()`继续输出physical*与recommendedExposureEV；摄影C由root负责。
- `prepareStarView(renderer,camera,{width,height,storageEV,frame,optics})`：针对实际将绘制的camera准备目录点源供天空在云/大气之前合成；环境face也可调用。恢复renderer target/viewport/scissor/autoClear等，不绘入主canvas。
- `captureSnapshot()` / `withSnapshot(snapshot,fn)`：同步冻结并临时应用天空全部可变uniform/时间/天气/天体状态，fn后恢复；纹理共享引用、不复制大体积数据。root用来做back cube一致捕获。不得冻结后又混用当前日期的star field。
- 第一阶段实现连续天球和圆盘诊断，再接目录资源。星表按用户允许的非商署名许可，记录原始/派生/单位/epoch/去重与有效星等。所有原始大数据进入research或catalog source，不混进最终必需下载；runtime只加载派生精简资源。

## 烟花（reference_research）

可拥有新 `fireworks.js`、`fireworks-physics.js`、`fireworks-audio.js`、相关资产/夹具；不改main/water/lens/已有audio.js。接受THREE作为工厂参数以方便Node测试。

```js
createFireworks(THREE,{terrainHeight,origin:[29,0,7],seed})
  .rig                 // standard-material launcher group, root adds to main
  .effectsScene        // particles/smoke only; never root main scene
  .types               // ten distinct definitions/labels/references
  .configure(patch)    // type, azimuth/elevation, automaticDirection/show options
  .launch(options)     // single event, bounded pool/queue, no camera mutation
  .update({time,dt,windVector})
  .getBounds()         // current/predicted event bounds for root framing
  .getLightClusters() // physical/reference cd, RGB, finite radius; <=2 active
  .getRadianceBound({camera,optics,rawPerCandela})
  .drainEvents()       // launch/burst/crackle, time/position/type/seed/energy
  .render({renderer,target,camera,opaqueDepth,reflection,planeY,frame,optics,air})
  .setQuality(patch)   // render representation; do not delete physical heads
  .diagnostics()
```

render不清除目标，保持premult ONE/ONE_MINUS_SRC_ALPHA，不被默认SRC_ALPHA或最终shader premult chunk抹掉alpha0发光。主variant目标color-only，采opaqueDepth手动遮挡；reflection variant用硬件深度test且**不bind当前附着depthTexture**，将该sampler绑定dummy或完全编译掉。镜像投影与空气起点分离，P→source传输；所有粒子/烟按足够细深度排序。主CoC/快门PSF与反射近似遵循FINAL-DESIGN，不偷偷烘全屏辉光。

audio helper独立接受 `getContext/getOutput/isEnabled` 回调、监听者位置和温度，事件若静音不补放旧事件。Root在原soundscape增加明确aux输出getter。录音未经试听/许可门不标实录；可先以标记清楚的合成夹具验证排程，后替换音源。

## 界面与画质（interface）

可拥有index.html/style.css/ui.js、新quality-presets.js；不改renderer/main。沿用现有轻面板、键盘焦点与手机滚动。

新增callbacks：

```js
onTimeChange(patch)       // utc/date local input + explicit offset, rate/running/mode
onTimePreset(name)
onLocationChange({latitude,longitude,height,timeZoneOffsetMinutes})
onWeatherPreset(name)
onQualityPreset(id)      // low, balanced, medium(default), high, ultra
onLampChange({index,enabled,brightness,color})
onLampMode(mode)         // night, on, off
onFlashlightChange({enabled,brightness})
onFireworksChange({type,autoLaunch,autoDirection,azimuth,elevation,autoFrame})
onLaunchFirework()
onStopFireworks()        // stop future scheduling; don't erase active stars
```

原onView/onHome/onRestorePivot和摄影/显示/海水等callback继续兼容。缺少功能callback时不在init自动调用导致崩溃；root最终统一接线，不让未准入按钮假装工作。

新增同步方法：`syncTime(info)`、`syncLamps(info)`、`syncFlashlight(info)`、`syncFireworks(info)`、`setQualityState(info)`、`setNavigationStatus(info)`、`setThrowCharge(ratio,visible)`；可复用setNight/syncLens/syncGraphics，但要记录兼容参数。状态读数不反向触发onChange。

quality-presets只声明候选请求/说明与纯能力解析，renderer实际设置由root提交；effective必须可读。五档后经消融修订，不在模块里伪造FPS。HDR/曝光/日期/天气/物理源逻辑不被档位覆盖；高级单项改动标自定义。

## Root

main统一frame顺序、SceneRadiometry、环境双buffer/标签、GI/history曝光、local-lights/手电/receiver response、finite-effects hook、premult water反射、导航/滚轮/蓄力投石/碰撞/水花、所有callback和QA。

Root不在队友拥有文件里并发修改。确需共享修改时先消息明确片段/时间窗口，合入后跑实际检查。每模块先小夹具，后整场接线；不靠所有功能同时落地后才找黑屏。
