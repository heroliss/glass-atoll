# R17 G0/G1 接线交付

本阶段改`fireworks-physics.js`、新增`firework-layer-profile.js`和CPU夹具；没有编辑FW/main/lens/audio，没有GPU调用。基线physics为`fb6be290…`，原样保留在`baselines/r17-physics-before-layers/`（含旧wind-response依赖）。stage1 pure profile仍`7308fd7a…`。

## 固定接口

```js
createFireworkEvent({type:'chrysanthemum', effectProfile:'three-heart-v1', seed:42});
simulation.configure({type:'chrysanthemum', effectProfile:'two-colour-v1', autoLaunch:false});
simulation.launch({seed:42});
const e = sampleBodyEmission(body, bodyAge);
const w = sampleBodyEmissionWindow(body, {
  fromAge, toAge, bins:8, outRGB:preallocated24Float64OrFloat32
});
```

`effectProfile`只接受`legacy`（默认）、`three-heart-v1`、`two-colour-v1`。非legacy只支持菊；直接create/configure/launch非法组合在修改active/index/settings前拒绝。当前candidate仅QA单次：autoLaunch/randomType明确不支持；切普通type时root显式同时patch`effectProfile:'legacy'`。旧默认settings不额外加键，旧事件对象无新profile字段。

candidate body：`burnProfile`深不可变、`effectProfile`、`layerId`、`ignitionDelay:0`、`emissionReferenceI0`，birth仍真实运动出生。life来自profile（±6%确定性扰动）；没有额外强度随机。I0在原event倍率应用后取现有body.intensity，profile再归一peakY到该I0，因此caller不能再次乘I0或intensityScale。

`sampleBodyEmission(body,age)`返回：

- `emissionRGBReference`：完整当前参考RGB，含I和一次event光学倍率；未乘head/tail份额、rawPerCandela、P、C或T。
- `intensityCdReference = Y(RGB)`；`unitYColour`；`allPhaseMaximumRGB`全phase每通道max，同样不含head/tail份额。
- `envelope=I/I0`，I0为0时为0。candidate renderer不得再乘此envelope。
- legacy使用原`bodyEmissionEnvelope`，unitYColour保原body.colour数组引用；legacy渲染路径可完全不调用新helper。

`sampleBodyEmissionWindow`仅支持candidate（legacy显式拒绝），caller明确指定时间窗，不暗选居中/因果，也不处理尾迹。8个tap打平RGB24值；每tap为该格局部`∫RGBdt / (整个窗宽/8)`，shader均匀1/8权重保全窗通量；避免浮点格宽微差导致能量不闭合。0宽窗8tap取瞬时、积分为0。返回`rgbTaps`就是caller buffer；first24覆写、尾部不写；Float32有正常量化，`averageRGBReference/integralRGBReferenceSeconds`仍来自原double积分。没有outRGB则新分配Float64Array24。不可表示的正格/反向/非有限窗拒绝。

## 三维层与寿命硬界

三芯：stable `id%3`为outer/middle/inner，各64；原native192方向不重新抽RNG，intrinsic velocity相对baseline burst velocity乘1/.7/.4，再加回carrier继承项。`velocity/baseVelocity`同步更新；resolveBurst风响应继续沿原逻辑。

双色：192原root和原速度，独立profile红→绿。两候选的carrier、burst/launch事件、原root I0数组与真实id均不变；无推进、无child、delay0。事件endTime由新body末时刻重新计算，保留旧烟消费窗口下限。

`FIREWORK_LAYER_PROFILE_LIMITS`供解析envelope直接import：三芯maxlife4.876秒、双色3.392秒、intrinsicSpeed19、tail .35、delay0、propulsionKind none；表深冻结。新profile总峰名义I0预算保留，不声称改变life后参考cd·s不变。所有参数为作者参考而非测光/燃料质量。

`sampleFireworkEvent`候选结果带current RGB/I/colour/全phase界，emission为I/I0，life筛选与profile一致。candidate-only的createEvent/launch return/lastLaunch/state.activeEvents均有effectProfile可验证，不可能误拿legacy图像当candidate。

## 仅取旧烟的重复工作优化

```js
simulation.particles({stars:false});
// Equivalent to old simulation.particles().filter(p=>p.kind==='smoke').
```

`sampleFireworkEvent`新增options.stars=true默认，false跳过head/rocket采样和分配，仍先resolveBurst、保旧烟RNG/运动/全部字段。FW root可替换原先“全粒子再filter”这一步；没有减少真实head/tail，也没有缓存/量化动态轨迹。这里只证明删除重复工作，不宣称全场FPS提升数值。

## 元数据与未接范围

`fireworks-combustion.js`仍只是FW describe函数的reexport，未修改。真正metadata在root拥有的FW：建议candidate body节点追加effectProfile/layerId/ignitionDelay/burnProfileId，birth/life仍真实；matter未知及现M模型不改。没有把CDF接线塞进此阶段。root拥有head/tail分配、固定release gold双时钟、8RGB空间kernel、ledger/clusters/allphase bounds、main/mirror、actual optics与T路径。

## CPU证据

`verification/r17-layer-profile-check.mjs/.json`：当前13/13。60个旧事件（十型×3seed×两drag）及180次公共采样与冻结baseline逐值deepEqual；旧自动/random/drain序列一致；84个smoke-only十型/wind/出生边界比较与旧filter严格一致；8064个candidate光度/通道界采样；0/1/2/64增益、10个Float64/Float32窗口对解析oracle、风burst继承和baseVelocity、非法组合原子拒绝均通过。逐次报告保留`r17-layer-profile-runs/`。

独立envelope agent另得5/5、64seed/wind case、61,760 head/carrier＋123,520 tail点无越界，属于其新包围CPU门，不是GPU观感。其方向审查确认各layer全球覆盖，但原Fibonacci序列每3点取样的最小邻距/最大空隙逊于独立64球采样，可能有螺旋条带；按本阶段要求保native方向，待斜视/运动实际视觉验收决定，不隐藏该限制。

approved音频仍`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。本阶段没有生产默认切换、native视觉/性能或声学通过声明。
