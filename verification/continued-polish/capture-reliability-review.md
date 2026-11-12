# Canvas 录制可靠性复核

2026-10-31。仅阅读采集脚本、生产渲染与 HDR 输出代码，并用 ffprobe 检查已完成的文件；未启动浏览器、GPU 或性能测量。此报告补充首轮 [recording-timing-audit.md](recording-timing-audit.md)，不更改其归档范围。

## 两次手动采集试验均未通过连续性验收

两次试验均使用同一生产场景、SDR、960×720、medium、轻量烟雾，以 `captureStream(0)`、`requestFrame()` 和 VP8/Opus 录制。`setFrameProbe` 在生产 `renderSceneFrame` 之后执行，脚本在回调中请求下一次采集并重新挂载探针。录制后先等待 recorder 的 stop，再停止输入轨。

第一次直接捕获主 WebGL canvas，先运行场景 3 秒，再录制并保留 3 秒预录后发射星环。输出已固定归档为 [direct-request-frame.webm](before/capture-pilots/direct-request-frame.webm) 和 [direct-request-frame.json](before/capture-pilots/direct-request-frame.json)，不再引用曾被覆盖的顶层同名输出。JSON 记录 538 次请求、23.1071 秒墙钟。

第二次先完整预热同款星环，再运行场景 3 秒；在实际渲染之后用 `drawImage` 把主 WebGL canvas 复制到独立 Canvas2D，再对该 Canvas2D 请求采集。此试验仍保留 3 秒预录。检查时顶层 [capture-pilot.cjs](capture-pilot.cjs)、[capture-pilot.json](capture-pilot.json)、[capture-pilot.webm](capture-pilot.webm) 对应这次 2D 复制试验，JSON 记录 521 次请求、19.6135 秒墙钟。它不是独立的简单 2D 动画基线。

| 试验 | 流 | 编码 | 包数 | 首/末 PTS | 最大相邻 PTS 间隔 |
|---|---|---|---:|---|---|
| 直接 WebGL | 视频 | VP8 | 330 | 0 / 23.044 秒 | **0.366→11.457 秒，11.091 秒无新视频包** |
| 直接 WebGL | 音频 | Opus | 385 | 0.026 / 23.063 秒 | 65ms，相邻包起点间隔 |
| 复制到 Canvas2D | 视频 | VP8 | 225 | 0 / 19.541 秒 | **0.366→11.500 秒，11.134 秒无新视频包** |
| 复制到 Canvas2D | 音频 | Opus | 327 | 0.028 / 19.586 秒 | 66ms，相邻包起点间隔；最大包边界缺口 6ms |

请求计数不能替代捕获交付或编码帧计数。长间隔拒收依据是逐包 PTS；音频的 65/66ms 是包起点间距，不能直接当成同长度音频缺口。本报告未以容器时长、视频包 duration 求和或 remux 后全局交错顺序判断连续性。

检查时 SHA256：

- `before/capture-pilots/direct-request-frame.json`: `D033EE6C55757D26B536B0F4529C23D1639570859A21F99C0D8EC4664FB63661`
- `before/capture-pilots/direct-request-frame.webm`: `5DF5EB1EB813F70A41C82CD13E617B6576F036F1D041EC8E5EE17E4BB06CCDFA`
- `capture-pilot.cjs`（现存 2D 复制脚本，4609 bytes）: `1E893E040255BED06A6C192CE449B8F7E602396FA9C1169B32394D3F246463DC`
- `capture-pilot.json`（2D 复制）: `771112D70B1FE243AB23BAFD04343BBF38C11D2FE0F2D70207AAA63FA905FC87`
- `capture-pilot.webm`（2D 复制）: `D985E2A9F61727C0DE8703B7E69A344560A8929811CA50E43605CFC396836041`

直接 WebGL 试验的原脚本未另存，不能把当前已修改脚本的哈希归给第一次试验。两次结果说明换成 VP8、手动请求帧、增加预录、先复制到 Canvas2D 均未解决该环境的长冻结，不能从此声称生产渲染本身也冻结了 11 秒。原因仍未定位到 canvas 捕获、浏览器合成或编码排队中的具体环节。

后续 CDP compositor JPEG 加独立 Opus 同步试验属于另一采集路径，不在本报告双失败结论的范围内；只有该单段试验独立通过后，才能另行判断其连续性。

## 代码边界

- 主渲染 canvas 创建时 `preserveDrawingBuffer:false`。当前手动探针位于实际渲染之后，方向合理；不应仅为录屏全局开启保留缓冲区或改变生产 GPU 设置。
- `#scene canvas` 选择器没有显式指定 canvas 身份。HDR 输出会添加覆盖 canvas，但它初始化为 `display:none`，禁用时也会隐藏。第二次试验已保存所选 canvas 的证据：class 为空、960×720、计算样式 `display:block`，`a.graphics().hdr.enabled:false`、`mode:disabled`、`presentedFrames:0`，确认该试验未捕获 HDR 覆盖输出。
- 正常的场景 FPS、JS 心跳、音轨持续输出和 track readyState=live，只分别证明对应环节继续工作；均不单独证明视频帧持续交付。

## 仅在需要继续定位时的最小隔离顺序

1. 先比较相同浏览器、尺寸、时长、编码与音轨下的简单 2D 动态 canvas 和生产 WebGL canvas。只需各一段短试验，避免在单段未通过前重录整组。
2. 把“渲染探针计数→捕获轨帧交付→编码视频包 PTS”分开记录。可先特性检测 `MediaStreamTrackProcessor`；若使用克隆轨作只读探测，应及时关闭读到的 `VideoFrame` 并清理 reader/轨道。若采用 video 元素的 `requestVideoFrameCallback`，须记录实际呈现计数与回调时间，不能把回调数当作所有源帧数；隐藏或未呈现的元素不适合证明合成持续性。
3. 仅当捕获交付持续、编码包仍缺失时，进一步比较编码路径；若捕获交付已停，继续更换 MediaRecorder codec 不能定位上游问题。
4. 一个正式生命周期必须先独立通过视频相邻 PTS≤250ms、首音频 PTS≤150ms、音频相邻包边界缺口≤30ms、视频尾端延迟≤250ms，再推广到十类。该门槛并不承诺恒定 30FPS。

对本报告这两次 Canvas 采集，准确验收范围是：源事件完成、阶段图像与音频可检查、媒体可解码；**两次文件均未通过完整连续播放验收**。CPU 优化的独立测量不因此失效。可以保留真实的阶段预览与已检验音频，不应通过补帧、重复帧或只比较总时长把这些文件改判为连续通过。

## 一手资料核对

以下标准/浏览器资料用于解释机制，不用于断言当前环境的具体故障根因：

- W3C Media Capture from DOM Elements：canvas 帧捕获与 `requestFrame()` 的请求语义。`https://www.w3.org/TR/mediacapture-fromelement/`
- Chrome Canvas captureStream：捕获上限与实际画布绘制相关。`https://developer.chrome.com/blog/capture-stream/`
- W3C MediaStream Recording：单个 timeslice blob 不要求独立可播放，完整组合才是验收对象；timeslice 不是实时交付保证。`https://www.w3.org/TR/mediastream-recording/`
- Chrome Insertable streams：读写 `VideoFrame` 管道及释放 frame 的示例。`https://developer.chrome.com/docs/capabilities/web-apis/mediastreamtrack-insertable-media-processing/`
- web.dev requestVideoFrameCallback：回调与呈现帧计数的含义。`https://web.dev/articles/requestvideoframecallback-rvfc`
