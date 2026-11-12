# Ring burn 运动记录：独立只读复核

本次仅读取两份原始记录和六张1920×1080原图，不修改运行时、原始JSON或媒体。新记录为 [pyro-r5-burn-motion.json](pyro-r5-burn-motion.json)，前一轮为 [pyro-r5-taylor-motion.json](pyro-r5-taylor-motion.json)。两者是不同绝对时间的烟花场次；机位、波相和摄影状态不能视为逐像素相同输入。

## 技术账目

两片均为单个实际host、seed42笑脸、I1、原生风1.8m/s、resolved field与flare开启、240秒环绕导演模式。`captureFPS:30`是录制请求，记录中的逐点fps/GPU耗时不是受控性能对照。本复核不代替ffprobe/完整媒体解码或主观试听。

| 项目 | ring-uniform-burn-v1 | 前一轮two-births/Taylor48 |
| --- | ---: | ---: |
| 采样点 | 100 | 90 |
| 全采样质量闭合最大绝对误差 | 3.55×10⁻¹⁵ | 3.55×10⁻¹⁵ |
| adapter accountingResidual最大绝对值 | 5.33×10⁻¹⁵ | 3.55×10⁻¹⁵ |
| 最终物质 / 预留 / pending | 20.35 / 0 / 0 | 20.35 / 0 / 0 |
| 最终包数 / merge | 629 / 0 | 60 / 0 |
| 最大source×packet对数 | 59,166 | 7,200 |
| 有烟采样中field有效且支持 | 98/98 | 88/88 |

逐点核算式为 `airborne + pendingMass + reservedArea + cancelledReservedArea − allocatedArea`。两片各有最初两个尚无烟的点明确报告`awaitingSmoke:true`、`supported:true`、`effective:false`；其余点均为`ready`，未发现有烟却静默退回、不支持或质量缺口。新片最大59,166对低于1,048,576对上限，但这不证明小时级或多发堆积成本。

新片三个原图时刻的账目如下；物质量单位沿项目的作者参考面积预算，不冒称公斤：

| 原图 | burst后秒数 | 包数 | airborne | pending | reserved |
| --- | ---: | ---: | ---: | ---: | ---: |
| [hot](pyro-r5-burn-hot.png) | 1.1090 | 182 | 6.418196 | 0.027457 | 13.904348 |
| [late](pyro-r5-burn-late.png) | 3.3914 | 544 | 18.253703 | 0.006760 | 2.089537 |
| [cold](pyro-r5-burn-cold.png) | 9.0889 | 629 | 20.350000 | 0 | 0 |

hot的field为120个当时发光源×182包；late为96源×544包。cold时发光源已归零，field保持有效且复用零光场，629包密度仍保留；`rawBound:0`不是烟被删除。对照旧片在约+1.22秒便已物化全部20.35，新片确实把尚未释放的物质保留到后续燃烧时段。

两片全部采样的音频参数都保持`relativeBurstGain=12`、`postCompressorHeadroomGain=.7`、`compressorAttackSeconds=.0005`，录音来源签名各自始终相同。各片只调度一次launch与一次burst，最终均为一次录音播放、一次合成播放且`loadError:null`。这里只核对配置/事件账目，未据此宣称听感、响度或音画同步已由人耳验收。

## 独立看图结论

已逐张查看新旧hot/late/cold原图。新hot的烟明显更细、更连续地连接向外展开的光点，旧hot眼睛周围粗亮的短花瓣减轻；这是形态改善，不能归结为同一帧的纯参数因果，也不能量化为照片相似度提升。

仍然最假的地方是：中央眼部之间有平滑绿亮结，烟的径向辐条过于整齐，整体像规则轮辐；发光点的排列和亮度也过于均匀。late时烟在此远景下很淡，cold几乎不可辨，这既不能证明烟量丢失，也不足以证明残烟纹理已经自然。小岛在约400m远的导演构图中很小，适合看整体展开，不足以验收近距离烟的细节。背景重复的扁云和规则海面条纹仍明显影响真实感，与本轮释放时程不是同一个问题。

本轮样本没有把厚亮黄棉团带回，但仍未达到照片级烟尘。只看抽样静帧，未以此保证整段运动无闪烁、无拖影，也未进行连续主观电影/声音验收。

## 覆盖与准入边界

此候选仍是48条实际代表root路径分配120根母群的参考预算，**不是120条烟路径逐根实采**；不覆盖分裂子星或全部地面燃烧体，也不是十类型通用连续排烟/CFD。源码生产默认的two-births没有据此自动推广。物质保持到+9.09秒是本次实证，小时残留尚不能由20秒录制证明。

另已在 [ALL-SOURCE-SMOKE-COVERAGE-AUDIT.md](plans/ALL-SOURCE-SMOKE-COVERAGE-AUDIT.md) 注明：变量`rocket`不代表发动机。当前重力+阻力壳体没有engine/fuel/ascentComet元数据，因此飞行段无持久烟不自动构成缺陷，不能据名称补发动机大尾烟。
