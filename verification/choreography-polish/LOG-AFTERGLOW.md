# 深余辉默认曲线候选

`complex-fireworks-style.js` SHA `5d1b888f9224dc4a4515f279c6f8f280d16940894ab19b80f6dde48e52838787`。前版be7原件保存在`before/complex-fireworks-style-before-log-afterglow.js`；原6/6、actual3/3和旧曝光proxy报告未覆盖。

默认`envelopeInterpolation='log-smoothstep'`。短attack峰值1，然后有效burn时长的18%/42%/60%/70%/80%/90%/96%依次为`.82/.50/.08/.002/2e-5/2e-7/2e-10`，life端为0。正→正用`exp(log(a)+(log(b)-log(a))*smoothstep(u))`；任何0端点用普通smoothstep，确保C1连接和零端斜率。peak/life/I0不变，无补亮。

只有log模式新增冻结`envelopeLogValues`预计算数组，0端点为null。每次`createComplexStyle`根据当前knots重建，因此`{...style,life,...,envelopeKnots:scaled}`的clone保留mode但不会沿用错误缓存。采样不分配数组，正常creator生成的style不逐样本重复Math.log，只有一次Math.exp。显式knots无mode仍linear；显式linear/smoothstep保持前版算序，flash不加log字段。

`complex-log-afterglow-check.json` CPU **6/6**：21条curve与86,037个峰后样本；C1斜率门4e-6、终端剩余门2e-11沿用前版，实测最大残值3.75e-19；独立积分/数值积分门保持life×1e-7；显式flash/linear/smoothstep共6015个采样及对象相同；pulse/tail/cache/clone；当前10类2117head和14flash。默认积分为前版平滑曲线约80–81%，是作者余辉变弱，不伪称保持总光量。

`night-log-afterglow-sensitivity.json`确认源I0/radius/life/head-share及投影/曝光/SDR映射与旧proxy相同。EV21下encoded核心.95→.1时窗，100m从.887ms增至263.5ms，706m从6.33ms增至390.94ms。此为静止中心像素的legacy SDR纯CPU敏感性，不是移动场景/HDR/ACES2视觉验收；近景、光晕、面积、实际曝光仍由Root预览。未运行GPU/浏览器，未改FW/物理/renderer；这是固定作者曲线，不随相机变化，也不是实测化学冷却模型。
