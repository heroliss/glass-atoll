# GI 清除与历史重建：实际验收边界

**结论：raw GI 增量能够正确清除，生产画面确实接收到 local GI；开启时间抗锯齿时的逐像素完全返回尚未通过。** 目前证据将小差异归类到历史重建相关路径，不能再称为 GI 系数残光，也不是已证明存在的稳态随机 jitter。未为这些差异放宽门槛、未改运行时、未补跑测试。

## 保留的实际记录

| 报告 | 实际结果 | 可采用的结论 |
| --- | --- | --- |
| [scene first](transient-gi-scene-first.json) | **26/28** | I1图像增量0；原off→return差4像素/1字节。该加载版本尚未在GI开关处重置冻结历史。 |
| [scene second](transient-gi-scene-second.json) | **82/84** | I16可见：face15737像素/max8字节、receiver282023/max14。只有严格clear-return失败：22/12像素，各max1字节。 |
| [scene third](transient-gi-scene-third.json) | **82/84** | I16可见：face15797/max8、receiver283604/max14。clear-return22/1549像素，各max1字节；两个view的off/clear全部216个published Float32系数及P逐位相同。 |
| [history first](gi-history-rebuild-first.json) | **17/32** | 移机位后立即启动，initialP/直接光pose基线尚未与主帧同步；同输入门槛大量失败。保留，不作为严格归因依据。 |
| [history second：稳定机位](gi-history-rebuild-second.json) | **30/32** | 物理时刻、机位、UTC、密度、raw源、C/P均通过。只失败两项严格零像素门槛，见下表。 |

这些不同运行之间物理场景/已有烟的历史并非完全相同，不能将各轮像素计数变化当成严格相同状态的性能或随机性A/B。所有失败JSON及图像均保留；**没有84/84或32/32的全过结论**。

## 同一暂停事件的关键对照

稳定机位报告没有新发射、推进时间、改机位或清烟。C=16.5、P=12；每组使用显式 lens render 后立即导出的实际PNG。

| 对照 | PNG差异 | published R/G/B与独立P倍率 | 判定 |
| --- | ---: | --- | --- |
| 已off → 再调用off API，重建历史 | **13像素，max1字节** | 全216个系数bit-exact，P相同 | 原严格0像素门槛失败 |
| off → on → off | **13像素，max1字节** | 全216个系数bit-exact，P相同 | 原严格0像素门槛失败 |
| 关闭leaf temporal及water glintAA后，off → on → off | **0像素** | 全216个系数bit-exact，P相同 | 此对照的严格返回门槛通过 |

上述三个返回对照的 opaque/composed/reflection **HDR extrema相同**，范围检查有限且非负；extrema相同不等于逐像素HDR相同，报告没有把它冒充全纹理位比较。关闭GI时 incident/reflected增量立即为零，base solar/moon解的公开功率不变。结合published系数逐位一致，已排除这组场景中的raw GI系数残留；不能把1字节差异解释成还有未清除的GI能量。

正对照也成立：稳定机位的原AA on/off改变282090像素、max14字节；禁用两条时间路径后仍改变281096像素、max14字节。它证明实际receiver图像收到增量；local-only开关包含地灯和烟花代理，不能仅凭它宣称每一像素都是烟花专属一跳贡献或已经绝对测光校准。

## 为什么归类为重建差异

再次调用“off”没有改变GI，却重复了开关API的历史重置/24帧重建副作用，得到与on→off相同的13像素差异。去掉两条时间路径后严格返回原图，因此证据支持历史重建/重采样相关的微小差异。它尚未细分为leaf history、water history或两者与下游输出量化的具体一条指令；也没有证据把它归因于base Float32 `+=` 系数漂移——published系数实际相同。

各保存状态显示resetReason为 `local indirect comparison`、historyFrames24、jitterPixels[0,0]，历史已冻结。这里测量的是**主动重置前后**的差异，不是同一冻结历史持续随机抖动的实验。不能以此宣称已解决所有动态闪烁，也不能把13像素或历史1549像素直接变成新的通用容差。

当前可接受的技术表述是：raw source→one-hop→合并预算→P接线与即时清除已有实际证据；I16两机位可见、范围安全；时间路径的bit-exact重建回归仍有原样保留的失败。现阶段无需再改运行时追逐这一字节级结果。

图像可直接复查：[同off重置前](gi-history-second-savedAA_off.png)、[同off重置后](gi-history-second-savedAA_off_API_reset.png)、[GI on](gi-history-second-savedAA_on.png)、[GI返回off](gi-history-second-savedAA_off_return.png)、[无temporal off](gi-history-second-noTemporal_off.png)、[无temporal on](gi-history-second-noTemporal_on.png)、[无temporal返回off](gi-history-second-noTemporal_off_return.png)。

夹具来源：[GI scene helper](transient-gi-scene-check.js) SHA256 `7d8ff8731d90bdba71812a7bc87f61b5d41b3ff1f426b6f6d6795c91d4ebb848`；[history helper](gi-history-rebuild-check.js) SHA256 `cae2351d9b7e8127a7485fefc39461bfb29229ab2263fec609c13e319f276141`。两个旧scene helper精确快照保存在 `baselines/transient-gi-scene-before-floor-cfb0ee74.js`、`baselines/transient-gi-scene-before-probe-50db9624.js`。
