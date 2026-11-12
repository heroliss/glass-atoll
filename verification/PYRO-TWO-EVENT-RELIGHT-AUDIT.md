# 连续两发共享烟：实际80/80的独立只读复核

2026-10-27。仅读既有JSON与六张原PNG，未重跑helper/GPU、未控制浏览器、未改runtime或冻结helper。

原证据：[首轮2/3](pyro-two-event-relight-scene-first.json)、[第二轮80/80](pyro-two-event-relight-scene-second.json)。首轮因native wind目标未设0而在前置条件退出，无场景图；保留失败，不能算烟/光物理失败。第二轮在根代理将实际风控设0后执行，所有80项技术门通过，JSON的visualAcceptance仍为pending。六张图均已逐张实际查看。

## 由保存的原状态重新核对

| 阶段 | burst phase | packet数 | airborne参考M | enabled field实际sourceCount | C / P |
|---|---:|---:|---:|---:|---|
| [A热](pyro-two-event-A_hot.png) | +1.1s | 180 | 6.327610977590893 | 120 | 16.5 / 11.75 |
| [A冷](pyro-two-event-A_cold.png) | +6s | 628 | 20.35 | 0 | 16.5 / 12 |
| [B热proxy关field](pyro-two-event-B_hot_field_off.png) | +1.1s | 808 | 26.712020493570023 | disabled；缓存数值不作live-source证明 | 16.5 / 11.75 |
| [B热重复关](pyro-two-event-B_hot_field_off_repeat.png) | +1.1s | 808 | 同上 | 同上 | 16.5 / 11.75 |
| [B热开field](pyro-two-event-B_hot_field_on.png) | +1.1s | 808 | 同上 | 120 | 16.5 / 11.5 |
| [B冷](pyro-two-event-B_cold.png) | +6s | 1256 | 40.7 | 0 | 16.5 / 12 |

直接用A冷保存的628个packet ID→mass映射，逐一在B热关/重复关/开和B冷快照查找：**628个全部还在，每个mass数值完全相等，无缺ID、无改mass，merges/forcedMerges均0**。按原ID集合求和得20.35；B新增部分在B热为6.3620204935700215，在B冷为20.35。JS记录的顺序求和为20.350000000000023，binary64求和次序会产生该舍入量；它不是逐packet质量损失，未把该数硬说成十进制逐bit守恒。总ledger在冷相为20.35和40.7，pending发烟为0。

B热三次的**完整snapshot和raw clusters值相同**，不只是M/极值相同。phase/UTC/相机/C固定，A→B之间没有clear，只有第一发之前的显式setup clear。A冷/B冷field均ready且sourceCount0而烟仍非零，支持“发光源退光不删除已存烟”；不是用冷PNG黑不黑推断质量。

1185份保存的rAF后曝光观察全部C16.5。四次phase初始化均调用同值QA绝对C锁，density/source/raw components/maxRawRGB前后逐值相同，物理时间不变，更新后frame.dt=0。本次前后P实际分别保持11.75、12、11.5、12，**没有需要被强行上调的P**；这证明本次初始化没有伪造dt/物理推进，不等于已覆盖所有可能的“暂停时P尚未上调”情形。B热模型开关因全链安全界而选P11.75→11.5，并以相同C补偿输出，不能把存储HDR数直接相减当源变化。

18个实际HDR附件读数（六阶段×opaque/composed/reflection）均NaN/Inf/negative计数0，最大composed值156.625，低于16376安全界。它是完整附件数值安全证据，不是逐像素光程、源能量或多重散射标定。

恢复记录8项均成功，实际门同时检查镜头/烟花偏好、天气/UTC、相机与QA锁相等；物理时间保留31.824799999952297、matterNotRewoundOrCleared=true，最终paused、剩1活跃/0排队。ring-burn测试宿主按合同保留至显式清理/重载，未为“恢复profile”清烟。报告没有另存QA锁的原/末裸值，因此此处引用的是实际getter比较门通过，而不冒称又做了一次独立现场getter读数。

源文件SHA开始/结束一致，锁定音频`fireworks-audio.js`为`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。没有为field对照重发、重播或提高gain；两次正常事件仍可能由原路径播放。未试听，不推SPL/音色结论。

## 图像信号能证明到哪里

B热关→重复关的实际SDR图差为0像素；关→开为159632/2073600像素（7.6983%），最大86 byte，RMS1.19549 byte。这是实景模型切换有信号的证据。不能直接称“159632像素全部是旧A烟被B照亮”：画面包括B自身新烟，P还变化了0.25EV及随后的有限精度/显示补偿，未做旧烟语义mask、单独A-only密度render或source A/B的2×2隔离。

同样不能对这些经过DRT/编码的PNG做线性叠加oracle。真正逐源Gaussian field正确性/排除重复pyro局部光等证据属于[独立resolved GPU报告](pyro-smoke-resolved-field-gpu-first.json)和[supplement](pyro-smoke-resolved-field-supplement-first.json)的隔离范围；本次连续共享烟场景是与其互补的integration witness，不替代它们，也不把间接灯/沙地响应全归为旧烟散射。

## 实看视觉结论

六图的相机一致、真实场景非黑缓冲。A热黄圈/绿眼口、B热红圈，B阶段沙地有可见红响应；A/B冷图不见明显烟花光，但仍持有上述M，符合退光与物质解耦。B开field时外侧/下侧红色细烟迹更明显，技术模型差异存在。

**尚不能称照片级：** 这个远景下笑脸仍有很整齐、近似等亮点串的霓虹观感，内部源/尾烟沿共心径向分布较规整。真实pattern本来可以整齐，所以不能把“圆/对称”本身定为物理bug；需要对照同效果/相近投影尺寸的真实参考和连续时序。当前用户湖面图是占画面很大的多芯长垂尾单发，型号/视角/曝光不同，不能直接拿它要求笑脸在同一时刻也长成巨大金柳。源时程、过曝与DRT、尾迹/烟的轨迹组织仍是下一轮独立变量；本80/80没有解决这些审美缺口。

结论限于：**两发持续源与共享烟状态、已存质量、绝对C、安全P和现有主/镜像数值链已实际通过所声明技术门；旧烟单独被新源显色的隔离图像证明、绝对光度和照片级外观未由本试验验收。**
