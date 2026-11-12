# 本轮最终验收草稿：待最终源码与三段录像刷新

2026-10-31。本文件是收尾清单，**不是最终通过报告**。当前既有 `dynamic-gallery.json` / `media-check.json` / `review-ui-check.json` 曾通过各自检查，但生产 `main.js`、`fireworks.js` 已继续修改，旧录像指纹与现行源码不符。旧报告不能代替画外尾迹预算修复后的验收。

## 已实施行为（等待最终整体验证）

- 金羽保持 128 发、四轮往返；发射间隔由 0.15 秒变为 0.10 秒，节奏为原来 1.5 倍，末发为 12.7 秒。
- 金羽与其它复杂持续尾焰适度延长；银瀑高仰角子体生命 7.6–8.1 秒，接入 2.2 秒真实释放尾迹。低角寿命按离地余量提前结束。
- 独立爆闪为 75 ms、小半径，画面直接显示份额降低，环境接收光保留完整对应光源；作用范围声明为 4096 m，并随距离衰减。
- 待最终确认：自然播放后段，画外/近裁剪尾迹不再错误提高存储预算，使岛屿地表因 FP16 精度损失变黑。

编排的独立 CPU 证据与边界详见 [CHOREOGRAPHY.md](CHOREOGRAPHY.md)。最终生产源码固定后须重新运行其检查以刷新完整指纹。

## 输出归档清单

在新的、尚不存在的归档目录中保留下面三组；恢复关系必须成组保留。已有 `before/`、`before-island-camera-recapture/`、`before-first-leaf-mask-check/`、`before-viewport-budget/` 不覆盖、不删除。

| 组 | 应保留的路径 |
| --- | --- |
| 三段录像及来源 | `display-vfan.webm`、`display-waterfall.webm`、`display-flower.webm`；三款 `display-*-phase-1/2/3.png` 共九张；`raw/` 整目录；`screencast-source/` 整目录；`dynamic-gallery.json`、`media-check.json`；当时的 `record-previews.cjs`、`finalize-capture.cjs`、`media-check.cjs` |
| 环境/自然播放证据 | `baseline-receiver-scene.json`、`current-receiver-scene.json`、`browser-lighting.json`；所有 `baseline-burst-*.png`、`current-burst-*.png`；`natural-light-probe.json`、`natural-0/1/2.png`；当时的 `browser-lighting.cjs`、`receiver-scene-check.js`、`natural-light-probe.cjs`、`fixture-notes.md` |
| 页面与数值指纹 | `review.html`、`review-ui-check.cjs`、`review-ui-check.json`、`review-desktop.png`、`review-mobile.png`（若有也包括 `review-failure.png`）；即将被复跑覆盖的 `choreography-check.json`、`receiver-light-check.json` 以及画外预算新检查的旧结果 |

录像归档中的 `raw/` 和 `screencast-source/` 必须移出当前顶层后再重录。九张图与三段录像也应成组移走，避免失败重录留下旧文件。脚本、页面和数值报告宜复制到归档，保留工作副本用于复跑。归档操作用同一 PowerShell 的 `Copy-Item` / `Move-Item -LiteralPath`，先核实绝对源/目标路径均在本项目验证目录内；不要按模糊通配符递归移动生产目录。

## 最终顺序

工作目录为 `E:\GPT-Projects\个人网站\glass-atoll`。Node、FFmpeg、FFprobe 已在 PATH；脚本使用 `require('playwright')` 和 `C:/Program Files/Google/Chrome/Application/chrome.exe`，继承当前已可用的 Playwright 模块路径。5186 必须指向当前项目，浏览器/GPU 操作由 root 独占，全部串行执行。

1. 完成生产修复并固定源码。运行语法及相关 CPU 检查，确认新预算回归门通过；完成上面的旧证据归档。
2. 先验证自然播放，确认岛屿在 0.8、1.7、2.6 秒仍可见且预算/存储 EV 没有异常。`natural-light-probe.cjs` 目前只导出日志和 PNG，没有综合 `passed` 门，必须审查数值与画面，不能只看退出码。
3. 重新执行真实环境 A/B 与爆闪核检查，输出新的 current/baseline PNG 和报告，确认最终来源指纹。
4. 无 `--only`、无 `--pilot` 地全量录三款；固定同一版源码贯穿三段，录制中不要修改生产代码。
5. 依次 finalize，再媒体封装/解码/连续性检查。
6. 根据新日志的精确阶段时间和新媒体时长，更新 `review.html` 中金羽/银瀑的 meta、范围控件初值、定位图 alt/figcaption；环境 flower 录像仍应是岛屿 24 mm 机位。保留同名 0.800/2.600 秒 on/off 图片路径。
7. 最后运行页面交互检查，确认三段实际播放、2×裁看恢复、顺序播放、390px 布局与四张受光图；再将本草稿收敛为最终 `ACCEPTANCE.md`。

可执行命令按上述依赖顺序如下；**本次只读梳理未运行这些浏览器命令**：

```powershell
npm run check
node verification/lighting-choreography/choreography-check.mjs
node verification/lighting-choreography/receiver-light-check.mjs
# 此处先运行 root 最终采用的画外尾迹/存储预算 CPU 回归检查。
node verification/lighting-choreography/natural-light-probe.cjs
node verification/lighting-choreography/browser-lighting.cjs
node verification/lighting-choreography/record-previews.cjs
node verification/lighting-choreography/finalize-capture.cjs
node verification/lighting-choreography/media-check.cjs
# 此处按最新 JSON 修正 review.html 的静态时间文字。
node verification/lighting-choreography/review-ui-check.cjs
```

每条完成且结果通过再执行下一条。对最终视效的改动若发生在录制之后，必须重新归档并全量刷新，不用旧文件补当前通过。

## 易踩陷阱

1. **不能 selective 补当前版本。** `record-previews.cjs --only=...` 要求旧报告完整通过且九份 `sourceHashes` 完全相同；本轮 `main.js` / `fireworks.js` 已变化，必须全量录三段。
2. **最终不要使用 `--pilot`。** 录制脚本虽然读取该 flag，但输出始终是本目录；媒体脚本却会因此转向 `screencast-pilot/`，两者不是同一输出合同。
3. **严格保持 record → finalize → media。** finalize 对顶层编码输入的 bytes/hash 检查；media 会把该输入移到 `raw/` 并 stream-copy 回顶层，最终 hash 可以变化。media 后再次 finalize 既可能因输入 hash 不符失败，又会改 gallery 的时间和 hash，破坏媒体报告与 raw/final 的对应关系。
4. **旧 raw 会阻止新录制验收。** media 对已有 raw 使用旧 `media-check.json.gallerySha256` 及 raw/final 双 hash 严格校验；只覆盖三个顶层 WebM 不够。若媒体检查中途失败，可能已有部分视频被移入 raw，保留失败报告并成组归档，不能把新旧三段混合。
5. **不要按目录中的 JPG 数量验收。** 新录制会按 `00000.jpg` 起写入现有源目录，旧尾部文件可能残留。finalize 只验证新 timeline 声明的文件；归档并移走整个旧源目录最清楚。
6. **技术连续性不是后段亮度验收。** media 只测时间戳、解码、音频非静音等；页面 UI 检查仅在每段约 45% 位置播放一小段。因此二者都不能发现“后段地表突然变黑”的视觉回归。自然播放日志/PNG与花冠完整视频必须共同审阅。
7. **UI 检查须最后执行。** 它保存 review 与 media report 的 SHA；media 重跑或静态时间更新后，旧 UI 报告即不再是最终对应证据。其截图只覆盖页面可见区，四张比较图另由 decode 检查，不是全页视觉截图。
8. **音轨来源快照的边界。** finalize 在录制后才采音频脚本/素材 SHA，属于来源快照，不能称为录制期间逐响应封存；WebAudio 录音与 compositor 图片只近似墙钟同步。
9. **包时间网格保留。** 源图片按实际 compositor 时间写 ffconcat，VP8 编码仍量化到 40 ms 网格；没有生成中间帧，也没有改变速度。文件中的最高 0.08 秒包间隔不直接等于网页渲染 FPS。
10. **金羽音频数量不必等于 128。** 旧捕获记录中 128 发的调度音效数为 112，属于现有音频并发/调度行为；媒体门只检查实际非静音和连续性，不应为凑发数篡改轨道或调度日志。

## 待填最终结果

| 检查 | 最终状态 |
| --- | --- |
| 语法与编排/接收光 CPU | 待最终源码复跑及 hash 核对 |
| 画外尾迹预算与 FP16 自然播放回归 | 待 root 最终回归门与 0.8/1.7/2.6 秒画面审阅 |
| 环境 GPU A/B、爆闪核降低 | 待最终源码刷新后当前报告/PNG 核对 |
| 三段全量录制 | 待记录最终 physical/wall/encoded 时长、相机、sourceHashes |
| finalize | 待检查三段、来源图片及九张定位图 hash |
| 媒体 | 待三段 full/reference 解码、连续性、音轨及 raw/final 指纹 |
| 页面 | 待最终 12 项交互/响应式/资源检查与 review/media 指纹 |
| 主观观看/听感 | 待完整正常速度回放；不以阶段静帧或数值通过替代 |

最终限制仍应保留：截图/录屏开销不是持续性能基准；低仰角会主动缩短银瀑燃烧；离地数值证明采用零垂直风与水平海面，地形遮挡仍由运行时处理；2×仅裁看原画面；移动设备、密集长留烟、毫秒级声画同步与最终主观听感不由这组检查覆盖。
