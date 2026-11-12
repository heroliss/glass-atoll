# 自由观察、细叶稳定、亮度与夜空验收

2026-10-26。本轮在当前离岛项目与 http://127.0.0.1:5186/ 中完成，沿用 WebGL2/Three.js，不替换为静态风景照片。默认原生像素、4096 阴影、512 海面谱、一次低频漫反射；在当前设备支持时使用固定 8× MSAA。自动像素缩放、景深默认关闭；HDR 默认按已验证的系统/浏览器能力自动选择。最终页面留在暗夜星河，环境声开启，可切回晴日。

## 本轮改动和实际验收

### 叶片抖动

持续轮换的 Halton 投影采样点使亚像素细叶发生远大于真实风动的覆盖变化；只有纹理 mip 或加大旧相机历史权重不能解决它。原解析风动保持连续，不按帧重新随机。

现在使用固定 MSAA 采样、解析前后风动/相机运动向量、独立的当前叶深度和覆盖率，历史颜色做深度/类别校验。当前深度不能直接使用细叶后方的 MSAA 主深度。运动与叶深度附加到主场景 MRT，不增加场景绘制通道。颜色/运动/叶深度附件与深度格式共同查询样本数，当前硬件均支持 8/4/2/1，实际使用 8。

同一相机、同一 64 个时间点、220×220 ROI 的实际风动重放见 [stable-replay](navigation-night-stable-replay.json)：

| 固定 8× 采样 | 高频时序残差 | 空间高频细节 |
|---|---:|---:|
| 关闭植被历史 | 0.029514 | 0.067951 |
| 运动重投影开启 | 0.014137 | 0.058206 |

残差约降低 52%，细节指标降低约 14%；包含真实运动，不能把所有变化都算作闪烁，也不能推成所有视角的通用百分比。早期 4× + 轮换抖动只有运动向量时收益有限，相关失败/中间结果未删。

暂停稳定后，**不触发应用重绘**、间隔 150 rAF 的实际呈现树冠裁剪 550×420，两张 PNG 字节相同：[呈现检查](navigation-night-paused-presented-check.json)。另外显式调用照片重绘时，全图只有 16/1,562,028 像素改变一个 8-bit 码值，树冠 ROI 完全相同；不可把强制历史/后处理再推进当作实际暂停残闪，亦不能仅凭统计锁定具体 pass。详见 [paused-difference](paused-difference.json)、[植被说明](VEGETATION-STABILITY-NOTES.md)。

仍有固定覆盖偏差、极细远叶断续或轻微历史柔化的可能，不宣称所有亚像素细节都零闪烁。

### 观察、对焦与投石

WASD/方向键平移，QE 原地转向，RF 俯仰，PageUp/Down 升降，Shift 加速。右拖自由看，左拖绕中心，右拖时滚轮调移动速度。Alt 点击可见表面移动环绕中心，Home 还原岸边视角，按钮可单独还原中心。表单保留正常键盘操作，失焦清除按键。

- 实际原生 W、Shift+W、Q、R 按键测试已记录：[平移](navigation-night-keyboard.json)、[旋转](navigation-night-rotation.json)。平移时相机和中心同位移，旋转时相机位置误差约 1e-13 m；R 不再重置太阳。
- 实际 Alt 点击水面后相机位移约 1e-14 m，中心正确移动：[pivot-native](navigation-night-pivot-native.json)。按钮焦点下 Home 也已返回 [-48,12,-40] / [0,2.5,0]；远处中心会扩展 Orbit 允许范围，防止跳镜头。Alt 点击天空只提示，不意外开启景深：[alt-sky](navigation-night-alt-sky-ui.json)。
- 景深加入真实深度点选、自动中心跟焦/手动米数、f/1.4。实际原生点选叶片得到约 3.8 m；Esc 取消正常，自动改手动锁当前距离。70 mm / f/1.4 / 3.761 m 的对照保留叶片主体、虚化前后水面，见 [景深图与量化](DOF-VERIFY.md)。广角远景本来就不易看出区别；并非完整衍射/折射虚像镜头模拟。
- 25 mm 可见石子沿约 0.72 s 重力弹道落水；远目标先平滑靠近，导航可打断。之后共享水花/环波/声音事件，落点有短暂提示。实际按钮、飞行视频和图已检查。最终代码再点按钮，音频状态 splashCount=1、audibleSplashes=1、warnings=[]：[最终交互](navigation-night-final-interaction.json)。[5.6 s 静音 QA 视频](navigation-night-stone.mp4)实际全解码成功；其 30 fps 转码、无音轨均不能证明场景帧率或声画同步。

### 海面、阴影与云

四个波谱场默认从 256² 升到 512²，可选 1024²；近景 footprint 下限从 2.8 cm 降到 3 mm，保留基于像素/坡度方差的过滤；高画质物体平面反射按内部全分辨率绘制，天空反射最低 LOD 不再固定模糊半级。默认关闭景深，避免把近水用远焦主动虚化。[近水照片](navigation-night-near-water.png)。

阴影现在 2048 / **4096 默认** / 6144 / **8192**，四档均实际切换并渲染；GPU 纹理审计记录已上传的 uSunShadowMap 描述尺寸与采样器：[shadow-allocation](navigation-night-shadow-allocation.json)。约 72 m 受光范围对应 4096 约 1.75 cm/texel、8192 约 0.88 cm/texel。纹理审计明确不把 CPU 尺寸描述伪称为 WebGL 每级尺寸读回。仍是单个紧配光空间图，非级联/PCSS。

云默认 C2：独立 3D Worley 大形、侵蚀和连续液水密度，去掉旧共享硬顶，限制过粗的噪声 LOD；在同一相机/时间的 A/B 中优于旧盒形和被拒绝的 C1 棉花团。只增加一次 3D 查询，无新纹理/RT/pass。[C2 对照元数据](navigation-night-cloud2-ab.json)。最终日景仍可见远云偏层状、稀薄和有限步采样痕迹，尤其低仰角，不宣称已完全照片化或实现完整天气流体。

### HDR 与夜空

旧 2/4/8× 是相对参考白的余量，已改成明确 nit 设置与只读 Windows 检测；两屏报告 700/1270 nit、SDR白280 nit。实际 UI 手动输入 1200 nit 后输出正确采纳，现已恢复自动。匹配不准可手选显示器；系统报告不是测光仪。[当前 HDR](CURRENT-HDR-SUMMARY.md)。

本地 NASA 4096×2048 线性 HDR 星图/银河、LRO 月面和 Astronomy Engine 日期计算，仙本那 4.5N/118.6E，正确右手坐标。加入日落、月夜、暗夜星河预设和观察方向；太阳滑杆仍独立。夜间在写半浮点之前统一预曝光，避免微弱星光先下溢再尝试提亮，地面/水/天空共享主光与曝光比例。

10月26日22时月相约99.6%、月高55.9°；8月13日22时暗夜预设月亮已在地平线下。[月夜](navigation-night-final-moon.png)、[银河](navigation-night-final-stars.png)、[最终界面](navigation-night-final-ui.png)。暗夜是长曝光摄影观感，星图相对亮度未绝对测光，月夜自动曝光较高；没有假造照亮整个无月海岛的白天填光。详见 [夜空技术与来源](NIGHT-SKY.md)。PNG 为 SDR 导出/截图，不证明 HDR 面板 nit。

## 当前短时性能

本机浏览器视口 **1209×1292、DPR1、q=1、8× MSAA、自动缩放关、环境声开、原生浮点 HDR**。分别先预热，再连续测约10秒，不在读回/录屏时计时。GPU timer 不是完整显示延迟；rAF 是提交节奏，另用 presentedFrames 差值计 HDR 提交，均不等于光学实测扫描帧率。

| 场景 | 平均 rAF fps | HDR 提交/秒 | 帧间隔 P95 | GPU P95 |
|---|---:|---:|---:|---:|
| 推荐日景，4096/一次反射/512 | 82.25 | 71.36 | 26.1 ms | 12.934 ms |
| 高级日景，8192/两次反射/1024 | 58.23 | 51.33 | 39.7 ms | 18.498 ms |
| 推荐暗夜银河 | 124.90 | 113.49 | 13.8 ms | 9.057 ms |

原始数据：[day](navigation-night-benchmark-day.json)、[ultra](navigation-night-benchmark-ultra.json)、[stars](navigation-night-benchmark-stars.json)。期间每条记录保存其自己的显示器校准；后续前台自动读屏可能变化，不把不同时间的峰值报告混用。结果有长帧，不能承诺任意角度或每帧60；真实手机没有实测。390×844/DPR1 桌面模拟无横向溢出，新增控制面板可滚动：[mobile-state](navigation-night-mobile-state.json)。

自动像素缩放默认关闭。启用时仅按近期 GPU/CPU 负载改变内部渲染像素，再重建到输出尺寸；不自动提升材质/阴影等级，也不锁帧。没有原生 DLSS 或完整硬件光追。

## 完成的检查与保留边界

- `npm run check`：30 个运行时模块语法通过。
- `verify:physics`：29 光学 + 38 水动力 + 6 镜头 + 45 像素预算检查通过。
- `verify:details`：原9脚本，加19植被运动和30夜空；天气10、支持区520704采样/0误排、时域27、交互14、入水阴影17、沙过滤12、空气18、叶光学14通过；尺度报告单列，不虚造总通过数。
- `verify:lighting`：间接光25、HDR17、海况26通过。
- `verify:navigation`：15/15，vendor Three + fake EventTarget 验证平移/旋转不变量、长持 Shift 4倍、右拖、输入框保护、失焦清键与远中心无跳位；不把合成事件说成实际原生右键拖动。
- 实际 GPU：[最终 water/motion/night](navigation-night-final-gpu.json) 的 **71/71、14/14、5/5**；夜空记录 cloudShapeBlend=2 和实际 shader 指纹。独立 HDR GPU20/20、只读接口5/5另见 HDR 文档。
- 最后加载后实际触发水花，浏览器无新增 error/warn：[console](navigation-night-final-console.json)。早期 PBO WGSL 失败、离线 QA 大数组展开错误，以及旧 HLSL 多返回路径警告保留；水花函数改为已初始化单返回值后实跑无新增警告。

最终是实时近似，非完整天气、全谱/绝对测光、全路径 GI 或三维流体。细叶历史会柔化，远云仍是最显眼的剩余画质限制之一；浅水没有完整破波/湿岸推进。验收数值、图片和清单支持上述具体结论，不代表每种光照、视角、设备均已穷尽测试。

当前源码、证据文件尺寸与 SHA256 见 [navigation-night-manifest.json](navigation-night-manifest.json)，用 `node verification/seal-navigation-night.mjs` 可重新生成；历史失败也保留在清单中，不把它们重新标成通过。
