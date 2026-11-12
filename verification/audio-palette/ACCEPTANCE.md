# 爆破音效层次与本轮收尾验收

2026-10-31。本轮保留 richwise 主爆录音与原有 **gain 12、playbackRate 1**，新增五段 CC0 录音：尖锐爆竹、明亮爆响、两种低沉轰鸣、碎裂噼啪。主爆按种子叠加不同声色，子爆使用较短的爆竹或爆响，并加入有限音高变化与错开时间；仍保留按距离和温度计算的传播延迟、HRTF 空间声与 24 声源上限。素材来源与许可见项目声音来源页及 `../fireworks/audio-palette-check.json`。

原链路在近距离同相密集爆破中已有超满幅样本，本轮为最终输出增加立体声联动峰值保护：实际 Chrome 使用 `linked-stereo-lookahead`，峰值上限 **0.975**、预读 **5ms**、释放 **80ms**。低于上限的信号经过声明延迟后保持不变；不支持 AudioWorklet 时有兼容软峰值路径。环境声、烟花及录音采集均经过最终输出。样本峰值检查不等于扬声器声压或插值真峰值标定。

## 已核对证据

| 范围 | 结果 | 证据与限制 |
|---|---|---|
| 真实 Chrome 音频图 | **123/123** | [`../fireworks/audio-palette-check.json`](../fireworks/audio-palette-check.json)：Chrome 156 的 OfflineAudioContext 使用实际生产混音图，六段录音解码、四种主爆叠层、子爆、远近传播、近零距离/密集/暂停取消、24 声源上限与实际 worklet 输出通过；不是主观试听。 |
| 声音机制 | **12/12** | [`../fireworks/audio-check.json`](../fireworks/audio-check.json)：声速、三维传播距离、静音丢弃、空帧与未就绪图等机制。 |
| 峰值核 | **7/7** | [`../fireworks/peak-kernel-check.json`](../fireworks/peak-kernel-check.json)：低电平逐位保持、脉冲上限、立体声平衡、分块一致、多采样率和非有限值处理；CPU 核检查与真实 worklet 检查分开。 |
| 素材追溯 | **4 个原件 / 5 个派生通过** | [`../../assets/audio/fireworks/palette-source.json`](../../assets/audio/fireworks/palette-source.json)、[`../fireworks/palette-provenance.mjs`](../fireworks/palette-provenance.mjs)：保留压缩预览下载字节，原件和运行音频 SHA256 与已保存回执一致；默认校验不会覆盖回执。 |
| 真实项目页面 | **通过** | [`runtime-smoke.json`](runtime-smoke.json)、[`runtime-smoke.png`](runtime-smoke.png)：独立 Chrome 上下文加载真实页面，声音启用，五种新增录音加载；双响烟花发射后 recordedPlays=4、accentPlays=1，使用 bang/firecracker，未走合成回退。实际峰值保护参数匹配；录音采集生成一条音轨并正确停止；页面异常、控制台错误和 GL 错误均为 0。仍保留浏览器 powerPreference 与既有着色器编译警告。截图处于早期蓝芯阶段，不作为完整烟花视觉验收。 |
| 窄屏缩放 | **通过本次定向检查** | [`../ui-compact-resize-browser-check.cjs`](../ui-compact-resize-browser-check.cjs)：真实 Chrome 从 800×900 缩至 390×550，时间/烟花抽屉正确收起，随后互斥打开，脚本退出码 0。检查使用实际 DOM 状态和按钮事件；不等于真实触屏或整场景移动设备验收。 |
| 独立试听页 | **8/8 音频加载通过** | [`review-page-check.json`](review-page-check.json)、[`review-desktop.png`](review-desktop.png)、[`review-compact.png`](review-compact.png)：八条音频均得到有限正时长，独立完整 GET 为 200；混音播放时钟推进，390px 无水平溢出。Chrome 取得媒体元数据后主动取消的请求单列保存，并以完整 GET 复核；无页面异常或实际资源失败。播放测试显式启用自动播放权限，仅验证播放机制。 |

未将历史测试宣称为全部通过。本次音频验收时的 R15 报告为 **5/7**：两个旧断言仍要求已移除的 `drop-stone` 控件、以及旧版全部机位选项逐字不变，已经过期；原始失败现保留于 [`../continued-polish/before/r15-ui-check.json`](../continued-polish/before/r15-ui-check.json)。后续继续完善时更新了现行合同并实际执行投石事件/机位同步检查，当前 [`../r15-ui-check.json`](../r15-ui-check.json) 为 **9/9**，范围见 [`../continued-polish/r15-test-refresh.md`](../continued-polish/r15-test-refresh.md)。与本轮相关的控件隔离检查 [`../controls-isolation-check.json`](../controls-isolation-check.json) 为 5/5。

## 试听与剩余事项

技术检查已确认素材可解码、事件调度和层次选音生效、已测密集场景无样本剪裁；音色喜好、各设备上的响度平衡与长时间听感仍需实际试听。可比较 [`主爆低鸣`](../fireworks/audio-palette-main_far_boom-a.wav)、[`主爆碎裂`](../fireworks/audio-palette-main_far_crackle.wav)、[`近处子爆`](../fireworks/audio-palette-sub_near_bang.wav)。这些 WAV 是同生产图的离线输出，不是完整现场录屏。

本地服务启动后打开 [独立试听页](../fireworks/audio-palette-review.html)，包含三条场景混音与五段单独素材。正常远景单主爆的样本峰值仍为 0.462295；近场齐爆和密集压力场景上限约 0.975000024（Float32），满幅样本为 0。首轮检查发现的晚段裁剪静音和转码峰值溢出已修正；原混音的削波基线另存于 [`../fireworks/audio-palette-protected-baseline-stress.json`](../fireworks/audio-palette-protected-baseline-stress.json)，没有以单纯降低全部主爆音量替代保护。

复验：`npm run check`、`npm run verify:audio`。完整浏览器音频图可用 `node verification/fireworks/run-audio-palette-check.cjs` 运行；需让 Node 能找到本机已有的 Playwright 依赖。该脚本自建并关闭临时本地服务，不占用日常 5186 服务。

玻璃海整体仍有明确未完成内容：密集长留烟的连续整帧性能和时钟漂移验收；十种新增复杂烟花的完整动态视觉审查；全岛照片感、岸水交界、水花暗边等既有画面问题；真实手机/平板的触屏、音频兼容和持续性能。本轮音频通过不能替代这些验收，也不承诺全部机位或密集燃放稳定 60 FPS。
