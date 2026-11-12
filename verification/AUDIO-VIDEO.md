# 声音与视频技术验收

核验日期：2026-10-26。本报告以最终叶形修正后重新录制的 `atoll-immersive-final.*` 为主，依据本地实际文件、浏览器状态记录、FFprobe/FFmpeg 检查以及同一 Web Audio 图的离线渲染记录。**文件、解码和信号层面的检查通过；没有完成模型主观试听，不能据此宣称听感已验收。**

## 最终录制文件

| 项目 | 实际结果 | 证据 |
| --- | --- | --- |
| 浏览器原始录制 | WebM，VP9 + Opus，**10,082,905 字节** | [最终 WebM](atoll-immersive-final.webm)、[最终录制记录](atoll-immersive-final.json) |
| 交付预览 | MP4，**13,742,807 字节** | [最终 MP4](atoll-immersive-final.mp4) |
| 视频 | H.264 High，1440×900，30/1 fps，**357 个实际读出帧** | [最终 FFprobe 记录](atoll-immersive-final-probe.json) |
| 音轨 | AAC LC，48,000 Hz，双声道 | 同上及 [最终解码音频统计](atoll-immersive-final-audio-stats.txt) |
| MP4 容器时长 | **12.033333 秒** | FFprobe `format.duration` |
| 浏览器采集耗时 | **12.021700 秒** | 录制记录 `elapsedSeconds` |

357 帧是实际解码计数，不以计划录制时长乘帧率代替。容器时长包含音视频轨道的封装时间，不能据 30 fps 导出设置推断网页实时帧率。最终录制前后状态中的 FPS 112 / 111 是两个瞬时读数，不能替代持续性能基准。

早先曾遇到一次将含逗号的 MIME 信息错误拆分的 FileReader 导出故障，已经修复并重新录制。此次最终叶形版本的 **WebM 实际文件长度与最终录制 JSON 中的 `bytes: 10082905` 相同**；该数字是 WebM 原件大小，不是转码后 MP4 大小。

未带 `-final` 的 [上一版 MP4](atoll-immersive.mp4)、[WebM](atoll-immersive.webm) 与 [录制 JSON](atoll-immersive.json) 保留为前一次迭代：WebM 10,143,994 字节，MP4 13,827,212 字节，358 帧，容器 12.029333 秒。它们不代表本报告最终源码版本；不要把前一次的帧数、字节或音轨电平混入下列最终结果。

## 交互与同步证据

录制 JSON 留下两次真实调用的相对采集时间和场景时间：

| 事件 | 相对采集时间 | 场景时间 | 世界坐标 |
| --- | --- | --- | --- |
| 投石入水 | **1.503500 秒** | 55.148700 秒 | x=19 m，z=20 m |
| 放一片叶子 | **4.500300 秒** | 58.146100 秒 | x=18.7 m，z=20.2 m |

记录同时显示声音已开启、AudioContext 为 `running`、两条实录文件均成功解码、`warnings: []`，海浪 48 秒双声道、叶声 17 秒单声道，均为 48 kHz；使用 6 个循环声源。采集结束后 `captureActive:false`，扬声器的 AudioContext 仍为 `running`，符合只关闭采集分支的设计。最终记录 `audibleSplashes:1` / `splashCount:1`，与本段单次投石调用相符；录制前 `leaves:[]`，录制后有一片叶子、年龄 7.5037 秒，与本段放叶事件相符。

音频从最终混音/压缩节点并联到 MediaStream，与画布视频合并录制；没有录制麦克风。[最终接触表](atoll-immersive-final-contact.jpg) 已实看，六个抽样画面均有完整海滩、水面与植被画面，后续样本中能看到修正后的漂浮叶片；它只证明抽样画面有效，不能代替逐帧视觉检查或主观听音。

本段声景采用相机位置/朝向决定的空间声源、距离衰减和方向变化。风层跟随场景传入的 `effectiveWind:1.8`；本段运行状态的 `swellSource:"scene envelope"` 表明海浪响度收到场景统计包络。**这属于共享状态驱动的混音近似，不是逐采样的流体声压同步，也不是逐个 GPU 波峰的精确现场声学重建。**事件时间是调用记录，不等于经过空间传播延迟、音频处理和编码后可听瞬态的精确采样位置。

另一次实际 UI 暂停/继续测试见 [audio-pause-v2.json](audio-pause-v2.json)：经过 **1.2 秒墙钟时间**，暂停前后场景时间均严格为 `1022.9056000001552`，`unchanged:true`；暂停后的 AudioContext 为 `suspended`。点击继续后 `paused:false`、AudioContext 恢复 `running`，场景时间继续至 `1023.1828000002032`。这验证了该次暂停时画面时间冻结且音频停止推进，继续操作能恢复二者。

## AAC 解码信号与完整解码

对最终 MP4 的 AAC 音轨解码后运行 FFmpeg `astats`，实际结果如下。dB 数字为样本峰值/RMS，未测 true peak 或 LUFS，不冒充相应指标。

| 指标 | 左声道 | 右声道 | Overall |
| --- | --- | --- | --- |
| 样本峰值 / dBFS | −15.063749 | −11.357254 | **−11.357254** |
| RMS / dBFS | −32.270646 | −28.218340 | **−29.788065** |
| NaN | 0 | 0 | 0 |
| Inf | 0 | 0 | 0 |
| 非正规数 | 0 | 0 | 0 |

解码统计为每声道 577,536 个样本，最大绝对样本幅值 0.270481，未发生数字满幅削波。左右声道电平不同符合此机位的空间化混音记录，但电平差本身不能证明空间听觉自然。

另外于本报告核验时对 **MP4 和原始 WebM 的完整视频与音轨** 分别执行：

```powershell
ffmpeg -v error -xerror -i verification/atoll-immersive-final.mp4 -map 0:v:0 -map 0:a:0 -f null NUL
ffmpeg -v error -xerror -i verification/atoll-immersive-final.webm -map 0:v:0 -map 0:a:0 -f null NUL
```

两次均返回 **exit code 0，错误输出为空**。这确认最终文件能够完整解码，而非只读取头部或缩略图。

## 离线 Web Audio 与循环检查

[离线 Web Audio 报告](audio/offline-web-audio.json) 和 [离线 WAV](audio/offline-soundscape.wav) 使用与运行时相同的节点图，生成 12 秒、48 kHz 音频，共 1,152,000 个声道样本。结果：

- 非有限样本 **0**；样本峰值 **−11.432941 dBFS**（幅值 0.26813465）；RMS **−29.740139 dBFS**。
- 记录明确为实录素材加统计包络，非声压仿真。该次离线输入使用 `statistical 4-second fallback`，因此不能将其误写成本段实时录制采用的 `scene envelope`。
- [PCM 检查](audio/pcm-qa.json) 共 **5/5 通过**：海浪与叶声无非有限样本或削波，循环边界等于原文件连续相邻样本的一步；程序投石有限、无削波且首尾归零。最终循环分别为 46.3 秒、15.8 秒。

上述检查支持数值有效、播放链路和循环边界连续性；不证明人耳听不到循环感，也不证明声音与画面主观上完全吻合。

## 来源、许可与验收边界

海浪录音是 Anthropic42 在美国南卡罗来纳州 Litchfield Beach 录制的《Beach sounds South Carolina》，作者释放至公有领域。叶声为 Gravity Sound《Rustling leaves》，CC BY 4.0，经剪辑、循环、滤波及音量调制。**这些不是马尔代夫或仙本那现场录音，也不是特定岛屿棕榈树的现场录音。**完整来源、原件校验和、衍生处理与许可见 [声音素材记录](../assets/audio/SOURCES.md) 和 [署名页](../assets/audio/credits.html)。投石水花与很轻的空气底风明确为程序生成，未冒称实录。

模型实际没有听到这些音频。已有 [自动英语 ASR 筛查](audio/asr-scan.json) 未发现连贯可识别句子或置信度 ≥0.8 的词，只出现长时间、低置信度的孤立 `huh`，不足以判定为人声；该检查不能证明无人声、没有其他语言，也不能替代主观试听。最终听感、声源方向自然度、循环是否可察觉，以及声音与可见海浪是否协调，仍属于人工试听验收范围。
