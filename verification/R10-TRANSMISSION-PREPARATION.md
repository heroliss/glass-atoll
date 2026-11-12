# R10 透射计时准备：autoFrame修正

入口`prepareTransmissionBenchmark(a)`：[r10-prepare-transmission-benchmark.js](r10-prepare-transmission-benchmark.js)，SHA256 `78852be962c2ed66c616521db95530439b1dfe19ed9596b438be574e56f17f64`。仅Node语法检查，没有替root运行实际GPU或计时。

caller必须提供空事件/queue、无pending/reserved烟、原生1920×1080、中档/q1、默认1.8m/s风及**声音OFF**。helper不改窗口、quality、renderScale或声音；不以强制重置掩盖非fresh现场。它设置SDRlegacy、固定Moon UTC、诊断C16.5、28mm/DOFoff/bloomon/flareoff，选production point/.2/12/two-births/Brownian烟并明确`resolvedSmokeLighting:false`。

顺序固定为**先**设置初始岸边相机`[-155.371,12,-119.478]`、target`[34.054,73.929,20.738]`，**再**启用autoFrame并同一个JS turn发射菊花seed42/43、各192头/I1。之后没有手动相机调用，autoFrame保持整个飞行与预热；最终相机/target以爆后实际自动构图值写入setup，不能声称仍固定在初始岸边坐标。

实际停在`max(launch.burstTime)+.1`，同C公开重算安全P一次，各透射route预热36 rAF；tail始终adaptive。成功返回ready、两launch/burstTime、实际camera/target/flags、C/P/clock/smoke/source与GL阶段，结束fast/paused，供[8秒计时器](SMOKE-TRANSMISSION-SCENE-PERFORMANCE.md)使用。失败也暂停并保留已发生事件/烟，不回退或删除。

先前dd2fdff版本在autoFrame launch后重新手动setCamera，不能当作匹配旧R10CPU自动构图场景；已完整保留[旧helper](baselines/r10-prep-before-autoframe-correction.js)。修正也把autoFrame:true移到初始setCamera之后，以免初始manualCameraActivity先取消它。新helper不沿用旧“最终岸边相机固定”的断言。

准备器没有成绩；R9 dense的受光场/音频/机位与本fixture可能不同，不作前后FPS提升结论。真实兼容性和性能由root分别归档，CFR影片、源码或语法通过都不代替这些门。
