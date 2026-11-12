# HDR 显示输出

`hdr-output.js` 提供独立的真实扩展动态范围呈现器。输入是镜头和 SMAA 之后、`OutputPass` 之前的 **线性 sRGB 浮点 render target**；不会把已经过 ACES 的 SDR 画布复制后称为 HDR。

## 能力边界与标准

- 内部 `RGBA16F` 渲染只说明场景能保存高光，不说明显示器收到 HDR。启用条件同时要求 WebGPU `rgba16float` 画布实际接受 `toneMapping: {mode:'extended'}`，`getConfiguration()` 确认该字段，且当前窗口匹配 `(dynamic-range: high)`。不满足时 `setEnabled(true)` 返回 `false`，原 SDR 继续工作。[WebGPU 画布配置](https://www.w3.org/TR/webgpu/#canvas-configuration)、[Chrome 129 HDR 发布说明](https://developer.chrome.com/blog/new-in-webgpu-129)
- 画布标记 `colorSpace:'srgb'` 时，其数值应为 sRGB **编码值**。`rgba16float` 不自动进行该编码，因此模块在最终输出着色器中编码一次，保留大于 1 的扩展值。输入曝光 `renderer.toneMappingExposure` 也只乘一次。[WebGPU 颜色空间](https://www.w3.org/TR/webgpu/#color-spaces)
- 首选路径利用同一 WebGL context 的 `drawingBufferStorage(RGBA16F, …)`，把 HDR 输出写入浮点 drawing buffer，然后在同一 JS 任务中 `copyExternalImageToTexture` 到 WebGPU 的浮点 HDR 画布。会先用 GPU 回读证明 `[2,.5,.25,1]` 复制后仍为该值。要求主 context 创建时 `alpha:true`；最终每个像素的 alpha 仍强制为 1。该接口从 Chrome 122 起默认提供。[Chrome 功能记录](https://chromestatus.com/feature/5146687245123584)、[WebGL 规范](https://github.com/KhronosGroup/WebGL/blob/main/specs/latest/1.0/index.html)
- 此路径没有显式 CPU 像素读回，**不保证驱动内部零拷贝**。没有声称 WebGLTexture 和 GPUTexture 直接共享内存。浮点来源的扩展颜色在外部图像复制时应保留，实际数值另由夹具核对。[外部图像来源](https://www.w3.org/TR/webgpu/#external-image-copy-source)、[颜色转换](https://www.w3.org/TR/webgpu/#color-space-conversions)
- 后备路径使用三槽、非阻塞 fence/PBO：`RGBA/FLOAT` 读回 → CPU `Float32Array` → WebGPU `rgba32float` 上传，随后着色器输出 HDR。`EXT_color_buffer_float` 保证从 `RGBA16F` 用 `FLOAT` 读取，不假设 `HALF_FLOAT` 读回合法。该路径有真实带宽和延迟成本，适合降低更新率/桥接分辨率；不能当作免费呈现。[扩展规范](https://github.com/KhronosGroup/WebGL/blob/main/extensions/EXT_color_buffer_float/extension.xml)、[WebGL2 规范](https://github.com/KhronosGroup/WebGL/blob/main/specs/latest/2.0/index.html)
- Canvas2D 的 `float16` 存储和 P3 色域能力会报告，但不单独作为 HDR 显示启用依据。[HTML Canvas](https://html.spec.whatwg.org/multipage/canvas.html)、[动态范围媒体查询](https://www.w3.org/TR/mediaqueries-5/#dynamic-range)

API 与媒体查询不是测光仪。本实现没有测量屏幕 nits、修改 Windows HDR 设置，或声称截图/视频已完整记录屏幕 HDR 亮度。`headroom` 是相对 SDR 白点的艺术参数；不是检测出来的显示器峰值。

## 接线协议

```js
const hdr = await createHDROutput(THREE, renderer, {
  maxHz: 60,                  // 可选 30/60；这是更新上限，并非实测帧率
  headroom: 4,                // 相对 SDR 白点，非 nits
  onStateChange: invalidatePausedFrame
});
hdr.setSize(outputPhysicalWidth, outputPhysicalHeight);
await hdr.setEnabled(true);   // 不可用返回 false，并保留原因

// finalLinearTarget: HalfFloat/Float，线性 sRGB，未做 ACES/输出编码
if (hdr.state.enabled && hdr.present(finalLinearTarget, performance.now())) {
  return;                    // 节流帧仍返回 true，保留上一张 HDR 图
}
// 原有 SDR OutputPass / FSR 路径
```

模块默认将 HDR 画布挂到 `renderer.domElement.parentElement`，位于原 GL 画布之上，`pointer-events:none`；Orbit 等输入继续由原 GL 画布处理。独立验证可传 `mount:null`。可配置 `maxHz`、`headroom`、后备 `maxBridgeWidth`；`present` 可选 `{exposure,force:true}`。`setEnabled(false)` 隐藏 HDR 画布并恢复原 drawing-buffer 格式。切换、尺寸变化及错误退回 SDR 后，调用方必须使暂停缓存失效并重绘一次。

HDR 映射在相对线性亮度峰值 1 以下保持线性；以上用保持 RGB 比例的指数肩部渐近到 `headroom`，再做扩展 sRGB 编码。它是显式显示映射，不是 PQ/HLG 编码，也没有用 ACES SDR 再乘亮度伪造扩展范围。高分辨率输出在 HDR 路径采用线性空间放大；SDR FSR1 不被冒称为 HDR 放大器。

`state.lastPresentCpuMs` / `lastUploadCpuMs` 是 CPU 提交/复制耗时，**不是 GPU 时间或场景 FPS**。`mode:'float-canvas-external-copy'` 才表示首选路径；`async-pbo-upload` 明确表示经过 CPU。显示环境不再报告 HDR、设备丢失或验证错误会隐藏 HDR 画布并通知调用方回到 SDR。

## 独立验证

`node verification/hdr-output-math-check.mjs`：10 项数学检查，原始结果见 [hdr-output-math-check.json](../hdr-output-math-check.json)。包括黑/白、中灰编码、扩展值、肩部单调/连续/色比、曝光一次与 binary16 解码。靠近肩部饱和值时双精度乘除会出现最多数个 ULP 的舍入，单调测试使用明确的 float64 计算误差界；没有以宽松视觉阈值掩盖算法下降。

`runHDROutputCheck(THREE)` 位于 [hdr-output-gpu-check.js](../hdr-output-gpu-check.js)，自建未挂 DOM 的 WebGL/WebGPU context：检查 PBO 真实浮点读回、HDR 可用性、实际呈现的黑/白/18% 灰与大于 1 高光、四象限方向、曝光一次、DPR=2 的 renderer 状态恢复、节流保持 HDR 路由以及关闭恢复 SDR。它会销毁自己创建的设备和 context，不使用场景 renderer。若真实显示链路不可用，会记录实际跳过范围，不伪造 HDR 测试环境。

2026-10-26 的实际 Chromium 156 / NVIDIA Lovelace 最终检查见 [advanced-acceptance-gpu.json](../advanced-acceptance-gpu.json) 的 `hdr`：**18/18 通过，errors 为空，WebGL 无错误**。媒体查询报告 HDR/P3，WebGPU 配置确认为 `rgba16float` / `extended`；真实浮点复制 `[2,.5,.25,1]` 前后精确一致。生产呈现链测试高光编码值达到 `1.765625`，中灰 `0.461181640625` 对照独立 sRGB 参考 `0.46135612950044164`；0.76 曝光后的中灰 `0.4052734375` 对照 `0.40556224514116945`。误差在半浮点存储容差内。PBO 上传分支也使用实际读回数据跑了生产 WGSL，方向、扩展值和有限性通过。首选运行模式为 `float-canvas-external-copy`，`readback:null`。较早 [advanced-final-gpu.json](../advanced-final-gpu.json) 的 16 项记录保留，未包含后面两项回归。

最后两项回归也已实际通过：首次并发“启用后立即停用”返回过期启用 `false`，保持关闭且 drawing buffer 恢复 RGBA8；`stop` 会使待完成的启用请求失效。限频采用携带下一截止时间的相位累加，90Hz 合成输入、60Hz 上限在 100ms 的 10 次调用中产生 7 次呈现（含起始），避免按到达时刻重置造成的 45Hz。此项验证的是调度计数，不能称为实测场景 60fps。

数学和合成 GPU 夹具不能证明完整场景的画质、主观亮度或 60fps。最终场景性能应由根任务的实际基准另外报告。
