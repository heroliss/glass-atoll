# 夜空资源按需加载 · 2026-11-05

目标：白昼首帧不再下载银河 HDR 与二进制星表；夜间数据到达后画面与改前一致，加载前不采样缺失纹理。

## 改动

- 首帧只等待“白昼集”：LRO 月面反照率（139,068 B，白天月亮也可能在天上）与星表 `manifest.json`（6,365 B，曝光上界和天空辐照均值所需的光度数据）。`main.js` 的 `await atmosphere.ready` 改为 `await atmosphere.dayReady`。
- 银河 `milkyway-4k.hdr` 与二进制星表（`stars`、`diffuse`、`lookup-native`、`lookup-wide`）只请求一次，触发条件为以下任一：
  - 首个白昼帧后浏览器空闲（`requestIdleCallback`，最长等待 5 s；不支持时 2 s 后）；
  - 太阳高度低于 12°（`NIGHT_ASSET_ELEVATION_DEGREES`，早于 10° 起的夜间曝光坡道），涵盖时钟走向黄昏、手动太阳与外部天体快照；
  - 切到星空或月亮机位；
  - 日落、黎明、月夜、星空时间预设：先等待夜空数据，再切换时钟。等待期间快捷按钮保持“正在应用…”，并提示“正在载入星表与银河…”。等待中的任何其他时间改动都会取消本次预设（返回 `false`）。加载失败时给出提示，时间照常切换，夜空不含星点；
  - 访问 `atmosphere.ready`：它改为 getter，访问时开始加载，返回同一个 Promise，解析值为已加载状态；失败、`dispose` 与 `loadError` 的行为不变。夜空相关 GPU 诊断入口会先 await 它；另新增 `__ATOLL__.loadNightAssets()`，供绕过预设的夜景采集使用。
- 加载完成前，银河与星表采样器绑定的是原有的 1×1 占位纹理（黑色 RGBA8 / 零 Float32，`uStarCatalogueReady=0`）。完成后，帧循环立即重拍环境立方体，并让暂停中的画面重绘。
- `star-field.js` 中 `fetchBin` 一行原样保留，网站的 gzip 传输适配器与 `test:atoll-transfer` 不受影响。
- 改前文件备份：`verification/baselines/night-lazy-before-20261105/`（含 `SHA256SUMS`）。

## 首帧前网络字节

测量方法：本地无缓存、无压缩静态服务器提供 `site/public/play/glass-atoll/`，使用应用内 Chromium 浏览器，视口 1280×720。包装页（`harness/measure.html`）检测到 `window.__ATOLL__`（与首个 `frame()` 处于同一任务）的时刻，统计在此之前服务器已发送完毕的响应体字节数。改前改后各测一次。

| | 首帧前请求数 | 首帧前字节 |
|---|---:|---:|
| 改前 | 125 | 62,957,961 |
| 改后 | 119 | 9,848,537 |

- 夜间集共 53,101,585 B：`milkyway-4k.hdr` 31,474,895；`diffuse-rgba16f.bin.pack` 14,202,519；`lookup-wide-float32.bin.pack` 3,378,922；`stars-float32.bin.pack` 3,242,047；`lookup-native-float32.bin.pack` 803,202。改前这些全部在首帧之前完成；改后均在首帧后 5.0–5.2 s 才发起请求（空闲回调超时触发：渲染循环几乎没有留下空闲时间），随后加载成功。
- 整次访问请求的文件集合不变（均为 133 个）。原始记录：`before-first-frame-requests.json`、`after-first-frame-requests.json`。
- 未测量：GitHub Pages 的压缩传输量、慢速网络下的耗时。本地首帧耗时（43.7 s → 14.1 s）只是单次 localhost 观察，不作为性能结论。

## 画面一致性

1. 结构等价（`structural-compare.json`）：新旧两个已加载的 `createAtmosphere` 实例，在正午、黄昏、月夜、无月夜下，全部 61 个天空 uniform 相同（纹理比较参数与数据 SHA-256），`lighting()` 每个字段相同，`getRadianceBound()` 相同；银河（4096×2048 半浮点）、月面、暗星聚合、点源星表纹理均相同。GLSL 未改。
2. 天空像素（`harness/sky-compare.html`，640×320 Float32 HDR，正午 69.5°、黄昏 −3.2°、月夜、无月夜各 3 个视向，新旧实例调用历史相同）：
   - 加载后新版对旧版：第 1 次运行 12/12 逐位相同；第 2 次运行（`sky-compare-run2.json`）有 4/12 存在差异，最大绝对差 4.1e-4、相对差 ≤1.24e-3。同一次运行中，两个未改动的旧版实例之间也有 2/12 存在差异，最大绝对差 1.2e-4、相对差 1.36e-3，且部分差值完全重复出现（正午地平线 1.15275e-4 同时见于旧-旧与新-旧）。这属于本机 GPU 的实例间波动，不是本次改动引入的。
   - 加载前（占位纹理）：无 NaN/Inf，无 GL 错误，无控制台警告。正午单通道最大相对差 1.0e-4（能量比 1.000000）；黄昏 −3.2° 为 1.9e-3（能量比 0.999999）；夜间缺少星点与银河（无月夜能量为参考值的 7–51%，月夜为 99.7–99.8%），因此时间预设会先等待加载，并以 12° 作为提前触发阈值。
3. 引擎 GPU 检查（主场景，同一浏览器先后运行新版与旧版）：`runNightCheck` 4/5、`runStarFieldCheck` 4/4、`runCelestialDiscCheck` 4/4，新旧输出逐项相同（不含时间戳）。`runNightCheck` 中未通过的一项 `preexposure_before_FP16_preserves_physical_star_radiance`（能量误差 −0.5437）在旧版中以完全相同的数值失败，属于改前已存在的问题或本机环境所致。`runCelestialZeroCheck` 的跨像素四元组地平线精确相等项以约 1e-12 的差值失败，且两版都随运行变化（旧版 8/10、9/10；新版 9/10、7/10）。
4. 预设等待路径：首帧刚出现即调用 `timePreset('stars')`。调用时夜间集尚未请求；界面提示“正在载入星表与银河…”；1,051 ms 后完成并切到星空日期；无 GL 错误。

局限：本会话中浏览器面板不可见，`requestAnimationFrame` 不运行，因此无法逐帧监视或截图实时的白昼→黄昏→夜晚过渡。逐帧保证来自两点：代码顺序（预设只在 `loaded=true` 之后才切换时钟；此前绑定的始终是占位纹理），以及上述直接渲染结果。若在加载完成前直接把时间滑块拖到夜里，在数据到达前会显示没有星点和银河的夜空（占位纹理），这是有意的设计。

## 节点检查

- `npm run check` 通过；`npm run verify:details` 全部通过（夜空 30/30）。
- `verify:playground`：与夜空相关的脚本全部通过（celestial-controller、star-catalog、environment-capture 27 项、celestial-zero、controls-isolation、cloud-base-continuity、transient-cloud）。未通过的脚本均涉及烟花契约（类型数量为 20 而脚本预期 10、上升段源码归一化、事件字段），不读取本次改动的文件，属于改前已存在的问题。由于该命令以 `&&` 串联，在第一个失败处就会中止，本轮改为逐个运行。
- `r17-sky-irradiance-cache-check`：该检查按 `return {mesh,uniforms,ready:` 文本插桩，`ready` 改为 getter 后插桩失效且不报错。已把锚点改为 `get ready(){`，并补上与同函数其他锚点一致的存在性断言，结果 13/13（原文件备份于 baselines 目录）。
- `r17-frozen-benchmark-guard-check` 使用改前的 `main.js` 时以相同方式失败，属于改前已存在的问题。`r36-sustained-star-photometry-audit` 是 R35 封存哈希审计，改前已因 `fireworks.js` 失败；现在 `sky.js` 的哈希也与封存值不同。

## 网站

`python scripts/vendor-glass-atoll.py` 重新导出；`npm run test:atoll`、`npm run test:atoll-transfer`（7 例）通过；PowerShell 下以 `SITE_BASE=/liss-works/`、`SITE_URL=https://heroliss.github.io` 运行 `npm run build`（运行时 194 个文件完整性校验通过）与 `npm run verify:dist`（`failures: []`）。`glass-atoll-provenance.json` 中仅 `main.js`、`night-sky.js`、`sky.js`、`star-field.js` 四条记录变化；原工程、`public` 与 `dist` 的哈希全部一致。
