# 当前 HDR 输出与亮度设置

2026-10-26。旧 2/4/8× 表示相对参考白的高光余量，不是画质等级，已从当前界面移除。现在直接设置峰值 nit、参考白 nit，或使用本机系统报告；显示模式为自动 / SDR / HDR。

## 本机实测状态

Windows 只读 DXGI / DisplayConfig 接口报告两块同名 Q27G4XM：DISPLAY5 峰值 700 nit、DISPLAY6 峰值 1270 nit，SDR 白均为 280 nit，均已在 Windows 启用 HDR。原始记录见 [display-hdr-native.json](display-hdr-native.json)。这是系统/驱动数据，不能替代测光仪。

自动模式同时要求浏览器浮点 extended 输出能力、浏览器 HDR 显示能力和完整系统亮度报告；不修改 Windows HDR 开关。前台窗口观察可能与嵌入浏览器所在屏不一致，界面明确说明来源，提供每屏手选。当前屏变化会刷新校准。普通远程静态托管没有本地只读接口时不会假装取得 Windows 峰值。

已经用实际界面取消“使用系统报告的亮度”，输入 **1200 nit**，输出状态确认为 `manual-override / peakNits:1200 / errors:[]`，之后恢复系统自动。见 [实际手动输入](navigation-night-hdr-manual-ui.json)、[界面截图](navigation-night-hdr-ui.png)。

## 修正与验证

当前链路为场景线性 sRGB 浮点 → 镜头/抗锯齿 → 与同源 SDR ACES fitted 一致的暗部/中间调 → 有界高光延伸 → 一次扩展 sRGB 编码 → WebGPU rgba16float extended 画布。未把已经过 ACES 的 SDR 结果重新当作场景线性输入。颜色贴图按 sRGB 解码；法线、粗糙度、波场等数据贴图不按颜色解码。夜空星图使用线性 HDR；月面反照率使用 sRGB。

- 显示数学 **17/17**：[数学检查](hdr-output-math-check.json)。
- 独立使用 vendored Three OutputPass 作 SDR oracle 的实际 GPU 检查 **20/20**：[GPU 结果的 hdr 字段](navigation-night-first-gpu.json)。样本中最大 SDR 参考偏差 0.234 nit；700/1200/1270 nit 测试值分别解码约 699.743/1198.939/1269.871 nit。包括原生复制与 PBO 路径数值对照。这些是数值链路检查，不能证明面板实际发出了该亮度。
- 本地只读端点 **5/5**：[接口结果](display-hdr-endpoint.json)。
- 当前机器使用浮点 WebGL → WebGPU external-image copy，无显式 CPU 像素读回；驱动是否零拷贝没有证明。PBO 是有 CPU 读回的备用路径。

旧版本 HDR 未维持 SDR filmic 响应、并用任意倍数估计显示器余量，是切换后观感不一致的重要原因。验证中还发现 PBO WGSL 的局部变量重名，已修正并实际复跑；[旧失败](navigation-night-first-hdr-failure.json) 保留。

这仍是有边界的浏览器显示变换：不是官方 ACES HDR ODT，不是原生 80-nit scRGB swap chain；场景 lux、材质实测反射率、面板亮度均未绝对标定。HDR扩展亮度，内部仍以线性 sRGB 三通道工作，不宣称完整连续光谱或 BT.2020 资产制作链。PNG 照片专门导出 SDR，不能用 PNG 亮度证明 HDR 显示效果。

公式、官方资料和具体限制见 [HDR-CALIBRATION.md](HDR-CALIBRATION.md)。
