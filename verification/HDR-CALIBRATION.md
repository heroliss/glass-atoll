# HDR 显示映射与 Windows 只读探测

这一轮修正的是显示变换：原实现能保存并显示大于 SDR 白的浮点数值，但使用任意 `headroom=4`，没有读所选显示器的峰值/SDR 白电平，也没有保持原 SDR 的 filmic 响应。旧版 18 项通过证明了浮点传递与其旧曲线实现，不能证明该曲线适合当前显示器。旧运行时和夹具已保留在 `verification/baselines/`，旧 JSON 未删除。

## 实际系统数据

原始读数：[display-hdr-native.json](./display-hdr-native.json)。`display-hdr.ps1` 使用 DXGI `IDXGIOutput6::GetDesc1` 及 `DisplayConfigGetDeviceInfo`，没有修改 HDR、亮度、ICC、校准或驱动设置。

| 输出 | 名称 | 桌面范围，物理像素 | 色彩空间 | 每通道位数 | 峰值 / 全屏峰值 | Windows SDR 白 |
|---|---|---|---|---:|---:|---:|
| DISPLAY5 | Q27G4XM | [0,0] → [2560,1440] | RGB_FULL_G2084_NONE_P2020 | 10 | 700 / 700 nit | 280 nit |
| DISPLAY6 | Q27G4XM | [−2560,0] → [0,1440] | RGB_FULL_G2084_NONE_P2020 | 8 | 1270 / 1270 nit | 280 nit |

两者均报告 Advanced Color 支持且启用。保存的这次探测中 DISPLAY5 是前台窗口所在屏；前台随用户操作可改变。这个标志不能证明嵌入浏览器一定在同一屏。默认选择返回 `confidence:'foreground-observation'` 并说明来源，用户可用完整 `deviceName` 明确选屏；两个屏同名，不能按名字猜。浏览器 screen 坐标只有调用方明确传 `screenReliable:true` 才用于几何匹配，避免把 IAB 虚拟坐标当成物理桌面。

这些是系统/驱动/EDID/校准报告，**不是测光仪实测**。DXGI 的小面积峰值与全屏峰值分别保留，即使本次相同也不混淆定义。1200nit 仅是用户示例/手动覆盖，不能冒充任何一个屏的系统读数。[DXGI_OUTPUT_DESC1](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_6/ns-dxgi1_6-dxgi_output_desc1)

Windows 原始 `SDRWhiteLevel=3500`，按官方公式 `3500/1000×80=280nit`。80 是原生 scRGB 的参考单位；不能在浏览器 sRGB 画布上再随意乘一次 80。[SDR_WHITE_LEVEL](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-displayconfig_sdr_white_level)、[Windows HDR 与 SDR 白](https://learn.microsoft.com/en-us/windows/win32/direct3darticles/high-dynamic-range)

## 编码与色调响应审计

- WebGPU `rgba16float` 只是存储格式。`colorSpace:'srgb'` 仍解释 sRGB 编码值，不是原生 Windows 的线性 scRGB swap chain；当前最终编码一次符合规范，没有证据支持删除 gamma 编码。[WebGPU 颜色空间](https://www.w3.org/TR/webgpu/#color-spaces)
- Chromium 的 Windows 显示实现读取相同的 `SDR_WHITE_LEVEL`，并用它构造输出颜色变换；浏览器 sRGB 参考白与原生 scRGB 固定 80nit 的概念不同。根据该实现把线性画布单位按系统 SDR 白换算，是这里的亮度模型依据，不是 WebGPU 跨平台保证绝对 nits。[Chromium screen_win.cc](https://chromium.googlesource.com/chromium/src/+/main/ui/display/win/screen_win.cc)、[Chromium ColorSpace](https://chromium.googlesource.com/chromium/src/+/main/ui/gfx/color_space.cc)
- 主 `lens` 输入为色调映射前的 HalfFloat 线性 sRGB。HDR 与 SDR 选择发生在同一个镜头/SMAA 结果之后，曝光来自 `renderer.toneMappingExposure`。新 HDR anchor 使用与原版 Three `OutputPass` 相同的两矩阵、拟合式及 exposure/0.6；没有把原 ACES 已处理的画布重新当线性输入。
- 已检查当前 `main/lens/sand/water/sky/vegetation`：沙与植被颜色贴图标为 sRGB，数据贴图保持数据颜色空间，未发现能够证实的全局重复 decode/曝光。此审计不等于所有材质、入射辐射或场景 lux 已做绝对物理校准。
- 旧 HDR 在暗部/中间调直接线性呈现，而 SDR 用 ACES fitted，切换时响应明显不同。若窗口在报告 700nit 的屏，旧 headroom 4 配合系统白 280 还对应名义 1120nit，超过该屏报告峰值；这也说明必须先匹配屏幕，再做有界映射。

## 当前有界映射

设曝光后的场景最大通道为 `p`；`B` 是原版 SDR ACES fitted 的线性输出，限制在 `[0,1]`；`W=paperWhiteNits`，`P=peakNits`，`S=sdrWhiteNits`，`H=P/W`。

```text
p ≤ 1 或 H = 1：G = 0
p > 1：G = (H−1) × [1−exp(−(p−1)²/(H−1))]
linearCanvas = [B + B/max(B) × G] × W/S
encodedCanvas = extended_sRGB_encode(linearCanvas)
```

黑色的归一项按零处理。默认 `W=S`，因此同一输入采样上，曝光后最大通道不超过 1 的暗部与中间调保持同源 SDR filmic 结果，不会因为开 HDR 全局再增亮。原生输出/平场可直接比较；降分辨率时 SDR FSR1 与 HDR 线性放大的采样顺序不同，不承诺两张完整画面逐像素相同。高光在阈值处连续且一阶连续，沿 filmic 基色比例扩展；每个线性 RGB 通道最多为 `P/S`，中性极亮输入渐近到目标峰值。纸白定义为 SDR filmic 基准白的目标亮度，**不是未经色调映射的场景数值 1**。

这是项目的“校准 HDR 显示映射”，不是官方 ACES HDR ODT、PQ/HLG 编码或场景绝对辐射校准。屏幕实际输出仍受系统颜色管理、显示校准与硬件行为影响；`absoluteNitsCalibrated:false` 保持诚实。不同设备的实际亮度需测光仪才能确认。全屏峰值另行显示，不把小面积峰值当成面板持续全白能力。

## API 与本地端点

```js
const report = await fetchDisplayHDR();
const calibration = resolveHDRCalibration(report, {
  deviceName: selectedDeviceName // 省略时使用有来源说明的选择
  // 手动模式才传 peakNits / paperWhiteNits
});
hdr.configure(calibration);
await hdr.setEnabled(requestedHDR);
```

`fetchDisplayHDR()` 只请求同源 `GET /api/display-hdr`。服务端固定调用本地脚本，5 秒按需缓存、合并并发读取、12 秒超时；不接受任意命令/文件，不允许跨源读取或写方法，不需要管理员或 ExecutionPolicy 绕过。`createAtollServer()` / `readDisplayHDR()` 可独立测试。端点只读，不会启用 Windows HDR 或 Windows Auto HDR；网页自动模式只能根据已有系统状态与浏览器能力选择网页呈现方式。

`resolveHDRCalibration` 原生完整时使用所选屏系统白/峰值并标 `windows-dxgi`；手动填写标 `manual-override`；没有原生数据时明确标 `unverified-fallback`，203/1000 是回退假设，不能显示成“系统检测值”。WebGPU extended 配置与 `(dynamic-range:high)` 仍是实际 HDR 的必要条件。

首选桥接继续使用同 context 浮点 WebGL drawing buffer → 同任务 WebGPU 外部图像复制，不显式读回 CPU，但不保证驱动零拷贝。异步三槽 PBO 为明确备用。开关请求序号、SDR 格式恢复、尺寸失效与相位累计限频继续保留；PNG/普通录屏不能作为屏幕绝对 HDR 亮度证据。

## 验证状态

- CPU 数学/选择/标定边界 **17/17 通过**：[hdr-output-math-check.json](./hdr-output-math-check.json)。中性 anchor 另用 45 位十进制算术求参考值，不从新输出函数生成期望值。
- 本地端点 **5/5 通过**：[display-hdr-endpoint.json](./display-hdr-endpoint.json)。临时随机 loopback 端口测试后关闭，没有重启/抢占主 5186；主服务器由根任务重启。
- 新 GPU 夹具：[hdr-calibration-gpu-check.js](./hdr-calibration-gpu-check.js)，`runHDRCalibrationCheck(THREE)`。独立创建未挂 DOM 的 renderer/device；真正运行未修改 vendor `OutputPass` 到 Float32 RT 作暗部/中间调/曝光参照；按标准 sRGB 逆传递与显示单位检查纸白、700/1270 峰值和明确手动 1200 示例，并检查两桥接路径、状态/开关/节奏/恢复。

实际结果见 [navigation-night-first-gpu.json](./navigation-night-first-gpu.json) 的 `hdr`，**20/20 通过，errors 与 glErrors 均为空**。6 个同源 SDR oracle 样本最大绝对偏差 **0.233779nit**，非零样本最大相对偏差 **0.10543%**；实际 HalfFloat 输入的量化也保留在官方 oracle 输入中。18% 灰、0.76 曝光样本解码为 **41.436818nit**，官方对照 **41.478357nit**，不是二次曝光。手动纸白 203nit 的样本为 **43.192658nit**，官方 anchor×203 为 **43.239808nit**。

| 测试目标峰值 | 读回编码值，sRGB 扩展 | 逆编码×280 后的数值亮度 | 相对误差 |
|---:|---:|---:|---:|
| 700nit | 1.490234375 | 699.743051nit | −0.03671% |
| 1200nit，明确手动示例 | 1.87890625 | 1198.939114nit | −0.08841% |
| 1270nit | 1.92578125 | 1269.871474nit | −0.01012% |

这些是 GPU 数值读回按已知 SDR 白换算的模型亮度，不是测光仪照度/亮度读数。原生桥与 PBO WGSL 的四象限结果逐值一致；中间调准确性来自原版 vendor oracle，二者一致本身只作为语言/方向/上传一致性证据。开关竞争、DPR=2 状态、resize、60/90Hz 合成调度和 SDR 格式恢复均过。实现过程中出现过一次 WGSL 局部变量 `base` 重名导致初始化失败，已改为 `gridBase`；最终以真实 GPU 成功与 `state.errors` 为准，不把空控制台当成编译成功。

同一文件的 `graphics.hdr` 记录真实主场景自动开启，`calibrationSource:'windows-dxgi'`，`paperWhiteNits=280`、`peakNits=700`、`headroom=2.5`，首选 `float-canvas-external-copy`、`readback:null`、`errors:[]`。这是本次前台选择的快照，不证明将窗口移动到另一台屏幕后会自动精确跟屏；当前匹配源与手动选屏说明仍须保留。
