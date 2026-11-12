# Controls / profile 接线说明

2026-10-26。新增 UI 已实现；主场景接线和真实浏览器验收由 root 完成。本文件不声明新灯/烟花/天文渲染已经通过。

`initUI(callbacks)` 不主动调用任何 callback。缺少新增 handler 的对应控件禁用；原方法、原 callback 保留。同步方法只更新 UI/state，不反向派发事件。

## 事件

| callback | 实参 / 语义 |
|---|---|
| `onQualityPreset(id)` | `low/balanced/medium/high/ultra`。默认medium。可返回 `{effective,limits,custom}`；或内部主动调用`setQualityState`。不改变摄影/HDR/日期/天气/逻辑源。旧`onQuality`存在时仅作两档兼容，并明确显示自定义兼容设置。 |
| `onView(id)` | 固定`shore/lagoon/aerial/sandbar/palm/reef/waterline/island`；动态朝向`sun/moon`。不改时间/天气。 |
| `onTimePreset(id)` | `dawn/day/sunset/moon/stars`。只改clock；moon/stars允许明确样例日期。旧`onNightPreset`仅fallback。 |
| `onTimeChange(patch)` | 单次只发送`{utcMs}`、`{rate}`、`{running}`或`{mode:'astronomical'|'artistic'}`。datetime-local先按显式offset换成UTC，**不依赖浏览器自身时区**。一天滑杆0..1439分钟，保留当前当地日期。 |
| `onLocationChange(value)` | `{latitude,longitude,height,timeZoneOffsetMinutes}`。修改时差保留utcMs，只改变民用显示。未发送observer的Deg命名，root适配controller。 |
| `onWeatherPreset(id)` | `clear/fair/cloudy/humid`，状态变化由root回传`syncWeather`。不改相机/UTC/摄影/潮流/远涌浪。 |
| `onLampChange(value)` | `{index:0..2,enabled,brightness:0..1,color:'#rrggbb'}`，输入色为sRGB。联动checkbox只影响之后的编辑，依次向0/1/2各发送一次完整灯设置，不擅自同步旧值。 |
| `onLampMode(mode)` | `night/on/off`；实际输出由root策略决定，保留每灯enabled。 |
| `onFlashlightChange(value)` | `{enabled,brightness:0..1}`。 |
| `onFireworksChange(value)` | 完整`{type,autoLaunch,autoDirection,azimuth,elevation,autoFrame}`。方位0..360°，仰角25..90°；autoDirection时手动角度禁用。只影响后续发射。 |
| `onLaunchFirework()` / `onStopFireworks()` | 单发 / 停止后续排程，后者不能抹掉活动事件。按钮等待async完成避免重复点击。 |

十类type：`peony/chrysanthemum/willow/palm/ring/heart/crossette/strobe/fan/bouquet`。bouquet显示“近地花束”，物理Mine的映射由烟花模块/root约定。autoFrame默认false，可被手动导航取消并通过同步取消勾选。

原 `onNightChange` 继续处理摄影偏好`autoExposure`；新时间预设/UTC事件不写这个偏好。`setNight({date,autoExposure,label,message})`保留；date按当前显式民用offset解释，新的连续时间优先使用`syncTime({utcMs,...})`。

## UI同步

```js
ui.syncTime({utcMs,rate,running,mode,observer:{latitude,longitude,height},
  timeZoneOffsetMinutes,preset:null,label,message});
ui.syncLamps({mode:'night',linked:false,selected:0,
  lamps:[{enabled:true,brightness:.65,color:'#ffdfab'},/*共3盏*/],message});
ui.syncFlashlight({enabled:false,brightness:1});
ui.syncFireworks({type:'peony',autoLaunch:false,autoDirection:true,
  azimuth:110,elevation:78,autoFrame:false,active:0,queued:0,message});
ui.setQualityState({requested:'medium',effective:{msaaSamples:8,
  shadowSize:4096,waveResolution:512},custom:false,limits:[]});
ui.setNavigationStatus({speedMps:5,message});
ui.setThrowCharge(ratio /*0..1*/, visible);
```

info各字段可省略。`syncLamps`也接受3灯数组；linked/selected属于UI编辑状态，可不回传。连续同步不会覆盖正在编辑的时间/数字/角度输入；不每帧移动键盘焦点。可用message说明天体在地平线下、发射队列/灯策略实际状态。`setThrowCharge`只有轻量小条，不改变投掷物理或镜头。

单独改GI/阴影/海谱/AA/时域/微散射/自动像素，UI标custom；焦距、DOF、曝光、HDR、帧率目标、日期、源参数不标custom。root也须保存真实custom状态，避免后续`setQualityState`覆盖。advanced UI现有`syncGraphics/syncLens`仍由root同步实际参数。

## quality-presets.js

`DEFAULT_QUALITY='medium'`；`QUALITY_IDS`、`QUALITY_PRESETS`不可变；`getQualityPreset(id)`返回独立request副本。`request`字段：

`dprCap/msaaSamples/shadowSize/shadowHz/waveResolution/cloudSteps/atmosphereSteps/airSteps/airShadowTaps/causticsGrid/causticsSize/causticsHz/reflectionScale/reflectionSamples`，加所有档统一`indirect:'low',antialias:'smaa',temporal:true,glintAA:true,opticalBloom:true`。

数值是明确候选，**不是实测质量排名或性能承诺**。root可消融后改数据。`resolveQualityPreset(id,{maxTextureSize,sampleSupport:[[8,4,2,1],...],reflectionSampleSupport?})`用所有附件合法集合交集选≤请求的最大值；无共同样本选0，不能用min(maxSamples)填未支持中间档。纹理上限作纯capability回退，不判断显存/创建成功。返回`{request,effective,limits,capabilitiesKnown,capabilityResolutionOnly:true,...}`，缺cap不伪称已知。最终FBO分配成功/实际采样数必须root再验证、以`setQualityState`回传。

纯数据检查：`node verification/controls-quality-check.mjs`，结果写`controls-quality-check.json`。该检查不包含实际排版、键鼠操作、GPU性能；这些继续由root集中验收。
