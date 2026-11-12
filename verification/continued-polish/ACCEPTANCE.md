# 继续完善：减少重复计算、十款实景回放与当前回归

2026-10-31。[打开十款声画回放](review.html)，或进入[声音分层试听](../fireworks/audio-palette-review.html)。本轮生产代码只修改 fireworks.js 的标量零快门数据填充；当前十款样式、物理与音效使用现有实现。

## 实际代码改进

倒影原有标量快门为零，八个时间样本落在同一物理时刻。此前每条光点/尾迹仍调用八次亮度包络；现在求值一次，填入相同的八个 Float32 输入。非零快门的八次计算和向量燃烧路径保持原实现。原件保存在 [before/fireworks.js](before/fireworks.js)。

[zero-shutter-cpu.json](zero-shutter-cpu.json) 的 **28 类案例、377,862 条上传记录全部逐值一致**，绘制诊断也一致；覆盖旧/新样式、迟生/迟亮、闪星、零亮度与五种实验分层，报告源哈希与当前生产文件一致。独立代码审查未发现非零快门、向量 RGB taps 或寿命边界回归。

最新 Node ABBA 局部测量中，五类镜像 CPU 绘制平均耗时约降低 **19%–39%**，包含更新、光照、账本、双眼包围和绘制的 CPU 流程约降低 **3%–15%**。结果随运行变化，不能直接换算网页帧率。

[browser-performance.json](browser-performance.json) 是实际 Chrome baseline/current/current/baseline 四轮对照：960×720、中档、SDR、每轮使用 101/202/303/404 同一组固定种子的四枚星冠、轻量烟。正常演化原版两轮约 27.80/26.95 FPS，当前约 27.09/28.14 FPS，变化混合，**未证明显著整帧提速**。四轮无页面异常或 GL 错误；这不是密集长烟或持续 60 FPS 验收。

## 当前检查结果

| 检查 | 结果与范围 |
| --- | --- |
| 当前实际 GPU | [current-styles-gpu.json](current-styles-gpu.json)：十种复杂烟花各一次 64×64 RGBA32F 实际工厂绘制，10/10；有限、非负、非零、完整身体与状态恢复通过。不是原生分辨率整帧性能。 |
| 全时程 CPU | [lifecycle-audit.json](lifecycle-audit.json)：20 类×3 场景，1,387,405 个轨迹样本、9,884,541 个关键边界样本；未发现提前出生、非法运动、包络越界、父子断裂或声明尾迹提前清除。30/60/120Hz 调度未发现重复或漏交付。有限搜索不等于连续数学证明。 |
| 当前界面合同 | [r15-ui-check.json](../r15-ui-check.json)：9/9。实际提取的蓄力投石与取消事件、13 个机位状态/ARIA、20 种烟花及现行控件合同通过。这是代码与 DOM seam 检查，不是手机触屏验收。旧 5/7 及迁移依据保留于 [测试刷新说明](r15-test-refresh.md)。 |
| 十款源事件 | [dynamic-gallery.json](dynamic-gallery.json)：10/10，从发射到事件退出，含升空、迟发子花、变色与余辉；GL 无错误。预热、固定夜空、中档轻烟、种子 619，零发射散布与倾斜，当前近景机位。 |
| 成品媒体 | [media-check.json](media-check.json)：10/10。VP8+Opus 全文件解码、libvpx 参考解码、960×720 尺寸、墙钟时长、视频/音频包连续性、尾端覆盖与非静音通过。视频相邻包最大间隔 80ms，音轨首包均为 0；不是恒定 30 FPS 或主观听审结论。 |
| 实际回放页 | [review-ui-check.json](review-ui-check.json)：真实 Chrome 9/9，十段均实际跳转至中段播放并成功解码；顺序开始、自动进入下一段、停止、零页面/控制台错误通过。桌面与 390px 无横向溢出，截图见 [桌面](review-desktop.png) / [窄屏](review-mobile.png)。这仍不是实机移动设备验证。 |

## 回放的来源和时间精度

最终视频来自浏览器合成器导出的实际页面帧，原有 WebAudio 输出单独采集为 Opus，然后合成为 VP8 WebM。没有离线重建烟花、补帧或时间缩放。每段包含约 0.75 秒开场；事件约 16.35–25.63 秒，视频约 17.12–26.40 秒。

全部 **4,976 张源 JPEG** 和 **30 张阶段 PNG** 已核对哈希；源帧与时间轴保存在 screencast-source/。最大源帧间隔约 62.6ms，首帧偏移最大约 9.4ms。本轮预热录制中，事件物理/墙钟差异最大约 10.5ms，文件时长/采集墙钟差异最大约 37.6ms。录屏增加开销，这些数字不用于衡量正常网页性能。

JPEG 拼接将时刻量化到 40ms 网格，声画以相邻启动调用近似对齐，没有共用的实测音频采样时钟；不能宣称毫秒级同步。音轨存在、非静音与参考解码通过，也不能代替正常速度的主观听感评判。V 形扫射的声音以现有程序发射声为主，其余样式保留现有实录主爆/点缀，不为回放额外抬高音量。

初始五个主程序/烟花源码哈希在录制前后核对。另有录制结束后、媒体验证前的 14 个音频模块/素材指纹，明确标为事后来源快照，不冒充捕获期间的逐响应封印。最终源文件、媒体、回放页均通过哈希关联，验证脚本拒绝用旧 raw 覆盖新录制。

## 发现并纠正的验收缺口

- 首次 data URL 导出错误地按第一个逗号拆开 vp9,opus MIME 参数，已修复并保存 [首次导出失败证据](before/media-export-first/export-failure.json)。
- 后续直接 canvas/MediaRecorder 文件虽可解码，却有约 1.9–8.3 秒视频起始空档；温态、手动请求帧与 2D 复制试验也未消除缺口。这些旧片不作为完整动态通过，证据见 [时间连续性审查](recording-timing-audit.md)、[采集复核](capture-reliability-review.md) 和 before/。
- 最终合成器方案的首版 VP9 可被 FFmpeg 解码，但 Chrome 实播报视频解码错误。现改为同一源帧、同一 Opus 的 VP8，通过了十段 Chrome 实播。VP9 文件与失败页面报告保存在 before/compositor-vp9/；未据此认定驱动故障。

## 仍需继续完善

1. 密集长留烟的连续整帧 CPU/GPU 成本：联合 12m pilot 仍默认关闭，日常 4m/8map 预算没有提高；轻量烟回放不能外推到密烟。
2. 首发冷启动停顿，以及低于约 18 FPS 时 55ms 物理步长截断造成的时钟漂移：预热录制避免冷启动，生产运行问题仍在。
3. 正常播放中的构图、反射和声音层次。[归档四款视觉复核](VISUAL-REVIEW.md) 已确认螺旋/旋翼倒影底边裁切、主体偏小、银瀑远景辨识不足；这些是继续改机位/取景的依据，尚未修复或宣称照片感达标。
4. 全岛照片感、岸水交界、水花暗边/天际问题，以及真实手机和平板的触屏、音频兼容与持续性能。

## 复验

生产检查：npm run check、node verification/r15-ui-check.mjs。CPU 数据检查/局部基准：node verification/continued-polish/zero-shutter-cpu.mjs。

在已运行的 5186 服务上，设置可用的 Playwright NODE_PATH 后，依次执行 screencast-gallery.cjs、finalize-capture.cjs、media-check.cjs、build-review.cjs、review-ui-check.cjs。脚本均位于本目录。重录前先归档现有顶层 WebM、raw/、画面源和相关报告；初次 finalize 必须在媒体重新封装前执行。原始录制均保留，当前浏览器设置由独立上下文隔离。

browser-review.cjs benchmark/gpu 保留完整网页性能和小型 GPU 检查入口，其旧 gallery 模式仅保留用于复现直接采集问题。一次只运行一个 GPU 浏览器。阶段图片用于定位，不代替完整动态与听感审阅。
