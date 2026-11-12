# Ring 固定3秒引信参考轨迹：可关闭候选

2026-10-27。唯一 runtime 变更为 `fireworks-physics.js`。默认未启用；CPU验证不等于画面/HDR/GPU验收。

## 接口与严格范围

```js
fireworks.launch({
  type: 'ring',
  flightModel: 'timed-reference',
  burstDelaySeconds: 3,
  seed: 42
});
```

底层 `createFireworkEvent` 接受同参数。仅支持 ring、显式数值3、definition rise120m，不支持 candidate 的任何显式 `height`（包括null），也不支持其它 fuse、其它type或未知model。默认/显式 `flightModel:'apex'` 完整等价旧默认，且不能携带 `burstDelaySeconds`，避免无效参数被静默忽略。`configure`拒绝两项新key，不能让自动show意外把此ring-only模式应用到其它类型。现有main的 `launchFirework(options)` 已原样把per-launch options送到工厂，无需更改main/FW。

simulation.launch 在queue/seed/slot变更前校验新选项；candidate把已验证的有效type冻结为ring，所以等待slot时后改settings.type不会造成dequeue晚抛。未新增settings字段，不改变默认launch返回对象。candidate证据只附加到 `event.heightInfo.flightInfo`，现有真实FW diagnostics会复制heightInfo，因此可读：

```js
a.fireworks().activeEvents[0].heightInfo.flightInfo
// { model, burstDelaySeconds, referenceRiseMetres,
//   referenceElevationDegrees, referenceVerticalVelocity, muzzleSpeed,
//   actualBurstVerticalVelocity, heightMeaning, authorApproximation, sourceURL }
```

## 数学与继承路径

固定线性drag `k=.075/s`、重力 `g=9.81m/s²`。对参考80°、H120m、t3s，令 `A=(1−exp(−kt))/k`：

```text
vY0 = (H + g t/k)/A − g/k = 59.9349552573 m/s
muzzle = vY0/sin80° = 60.8595485504 m/s
```

改变elevation时保持这个candidate的muzzle speed和3秒引信，**不是保证任意角度120m**：25° rise28.084177m、burstVY−5.815957m/s；80° rise120m、burstVY21.504955m/s；90° rise122.483874m、burstVY22.243258m/s。origin高度另加到worldY。该candidate参考muzzle能量与旧apex模型不同；这里只保证candidate内部变角度不偷偷补能量，没有用质量标定焦耳。

`rocket.life`与`burstTime`采用3s；heads birth、launch/burst事件、原生endTime计算与排队slot因而连动。未改heads寿命、drag、RNG、I/RGB/半径、平面/tilt/spread、源物质预算或音频gain。

现有工厂本来就 `add(patternVelocity,baselineBurst.velocity)`；原apex的Y接近0，而timed模式自然继承向上速度。现有resolveBurst仍只按 `actual−baseline` 修正一次，**未另加一次Y**；candidate metadata的actualBurstVerticalVelocity随同resolver更新。风时间线、父子递归、body解析式均未改；ring候选无child，其它类型的child默认结果逐字段保留。

公司示例表同时给3号/公称9cm、120m与3.0s引信标签：[株式会社ライズ基础知识](https://rise-hanabi.jp/fireworks/knowledge/)。这不是该smiley的高速摄影轨迹测量，也未提供本文80°假设或线性drag校准。把示例标签映射成launch-to-burst3s是作者展示近似，不是通用物理标准，不涉及装药/制造推算。

## CPU证据与来源守卫

`node verification/fireworks/timed-flight-check.mjs`：12/12。包括9个精确inverse点恢复完整D60 source、每点missing/duplicate fail-closed；10类×3种子×3角度默认/显式apex完整对象相等；独立drag endpoint、角度/固定fuse、实际风resolver不重复继承、同爆后龄pair distance、满槽非法参数前置拒绝、queued type稳定、30/60/120Hz精确同状态/两条音频source event，以及真实FW provider/combustion metadata/持续ring source预算。

真实source host见launch/burst时钟0/3s，carrier metadata life3s，所有root birth3s；最后M20.35、reserved0、accounting residual0。没有增加尾段物质事件，也没有改源排放profile。改变爆点/时间会自然改变声音传播延时与场景源遮挡，不能说听到的绝对时刻/响度不变；这里只验证源event的energy仍1/1、无重复与gain修改。

回归：原physics22/22、intensity17/17、trajectory29/29、V2 10/10、cluster14/14、medium12/12。4个既有“physics字节不变”守卫只前置9点严格inverse，再比较原完整基线；未放宽数值容差、未删失败。新normalizer不会删除无关source mutation。medium守卫还要求新12/12报告绑定当前physics hash。

保留失败：`timed-flight-check-first.json`的11/12是Windows写入CRLF导致完整source inverse匹配失败；恢复原LF后12/12，数值项首轮也全部通过。`pyro-smoke-trajectory-timed-first.json`的28/29是此前combustion metadata改变了raw provider block，旧negative test在未剥外层时找不到旧block；现先剥已验证精确bound/metadata外层，再在V1层逐点做missing/duplicate检查，未将其改为总是真。

冻结baseline为 `verification/baselines/fireworks-before-timed-reference/fireworks-physics.js`，SHA256 `d60c1ec9d2f5ccffc36ff1517868af990897299a22547fa1d8fb802370a2d045`。candidate SHA256 `3bbac1976fccf39dbb9fefdfd04bfdb5ae7fa8e26edbbe1169373d01130486df`。

## 本轮保留的实际边界

- 原body-based FW getBounds/records/provider读到新真实body轨迹，无需改FW；仍是原16点future forecast/current-wind/8m margin近似，未新证明为全风全时严格界。
- 未使用的physics `eventBounds`仍是旧burst+固定r启发式，不能拿其burstY+54当新185m最高点的保守证明。本轮按root范围未改forecast函数。
- main静态show/director预规划没有per-launch flight参数，不能宣称其镜头保证已覆盖新轨迹；由root实际同镜头记录或后续单独接线。不要用改镜头掩盖此候选本身的高度效果。
- 120m是爆点参考rise，不是最高星高度。更高的星轨会改变散射、投影峰界、反射和source查询成本；默认未推广，仍待root真实same-event视觉/HDR/性能验收。
