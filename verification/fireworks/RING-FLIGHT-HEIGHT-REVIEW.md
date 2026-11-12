# 笑脸：爆高、最低燃烧点、升空时程与固定取向

2026-10-27。**只读研究和独立CPU候选，不改physics/runtime。** [可复跑脚本](ring-flight-height-study.mjs)实际运行9/9，48组（6方案×4seed×0/5m/s恒定水平风）；[完整曲线/报告](ring-flight-height-study.json)。生产physics读取hash为`d60c1ec9d2f5ccffc36ff1517868af990897299a22547fa1d8fb802370a2d045`，首尾相同。没有浏览器、GPU或新视觉验收。

## 1. 先区分四种高度和两种时钟

- `rise`是爆点相对发射点的升高；这里origin Y=1.47704875875m，故rise120对应worldY121.477m。
- `burst/apex`目前被源码绑定：先反解上升顶点为120m的发射初速，再在顶点爆开。这是作者假设，不是供应商资料证明的事实。
- 星体最高点还包括向上散开速度和爆点遗留上升速度；整幅最高点不等于爆高。
- 最低仍在life内的星、固定1%/10%源信号门限的最低星、摄影像素里最后能见亮点不同。端点life处`starEnvelope=0`，不能称该端点仍有强火星。
- 物理飞行时间是launch→burst；phase是burst后时间。切换3s引信时，phase1.1改为launch后4.1s，而旧apex方案为5.758s。视频/源/声音事件必须一起使用新burstTime，不能只改位置。

现`fireworks-physics.js:129–141`在80°下用重力9.81、drag .075求apex，rise120的飞行4.658379s、muzzle speed55.542513m/s；`baselineBurst.vy=0`。`:143–170`给星体加`burstState.velocity`，这个继承路径本来正确，不能为了稳定图案把它去掉。`:199`和`fireworks.js:248,255`在y<.03m裁掉发光记录，因此要同时报告裁前life几何与裁后scene信号。

## 2. 官方当前页的支持范围

本轮重新在线核实，不只依赖旧README或研究稿：

| 直接来源 | 本轮读到的展示尺度 | 支持边界 |
|---|---|---|
| [Rise官方尺度图](https://rise-hanabi.jp/fireworks/knowledge/)，玉の大きさと花火の大きさ | 3号/90mm：到达高120m、开花半径30m、延时3.0s；4号/120mm：160m、半径65m、延时3.5s | 通用示例表，未说明具体smiley、D(t)/光门限或高速摄影时钟；延时不应无条件当成该产品实测launch→burst。这里只引用图形尺度/时间，不提供实物操作建议。 |
| [三遠官方产品页](https://san-en-fireworks.com/index/products/productse/) | 90mm：burst height120m、最大宽60m；150mm：190m、150m | 本页引用协会2009例表。未标时间/效果一一对应，不是所有同口径图案的尺寸标准。 |
| [小千谷官方4号商品说明](https://ojiyaenka.base.shop/items/34029650) | 说明实际效果高160m、直径120m | 当前售卖对象是空壳模型，文中描述真实4号效果；与Rise的同高130m全宽不同，不能混为同产品测量。 |
| [Optimum官方图案说明](https://www.optimum-fireworks.co.uk/glossary.html)，Heart/Smiley/Ring sections | 图案弹不能保证朝向，可能倒置/倾斜/侧看成线 | 支持固定世界取向的局限；不是任意添加随机抖动/每帧转向相机的依据。 |

[DOE官方说明](https://www.energy.gov/articles/5-facts-about-fireworks)区分mortar lift、上升time fuse与burst。参考表同时给120m与约3s，**不能与“120m重力apex=3s”同时成立**：本站这套drag模型的120m apex是4.658s。合理的可检验候选是让shell在3s上升中到120m爆开，遗留向上速度由星体自然继承；这并不证明某张smiley照片就是3s/120m。升空时间与爆高需各自元数据，不能以apex初速反解冒称已经全部测量标定。

当前同一burst的120星birth严格相同，是理想化同步点火。life本身3.196–3.993s（seed42）有作者差异，并非严格同时熄灭。现有资料未给这颗图案弹逐星点火时差；已知燃烧时长的离散也不能直接改成随机点火延时。先保同步，不用随机时间噪声打散已可读图案。

> 2026-10-27后续证据修正：日本烟火协会把上升至顶时开花列为良好“玉の座り”，详见[湖面20图复核](../plans/PYRO-LAKE-SINGLE-SHELL-REVIEW.md)。下文timed3/+21.5m/s结论只属于本站所选drag模型的作者候选；供应商高度/延时表不是该smiley实测弹道，不能据此把上升开花当所有壳默认、也不能作为托高低尾的普遍补丁。保留原CPU数据/历史A/B，近apex与time-fuse两类参考需独立校准。

## 3. 新的timed3候选：只改发射时程假设

保持参考rise H=120m、参考elevation80°、carrier线性drag k=.075。设`h(T)=(1−exp(−kT))/k`，精确反解：

`v0y=(H+gT/k)/h(T)−g/k`，`muzzle=v0y/sin80°`。

T=3s得`v0y=59.9349552573m/s`、muzzle60.8595485504m/s，比旧muzzle增9.5729%；3s时正好rise120、`burstVy=+21.5049552573m/s`。若没有burst，carrier稍后约5.02954s才达其141.269m上升顶点，进一步说明爆点与apex不同。

QA完整重设owned event的rocket velocity/life、burstTime/position、baselineBurst、root birth/basePosition/baseVelocity和burst事件，再沿用生产`sampleFireworkEvent`风解析resolver。星相对carrier的原始扩张速度、life/I/颜色/RNG/半径/drag全部不变。不是每帧把图案向上抬，也没有为低点另加力。

低仰角仍用同muzzle和固定3s fuse：25°实际rise28.084177m且burstVy−5.815957m/s；90°rise122.483874m。**不能沿用旧apex算法又声称固定fuse；也不能为了低角度仍达120m而偷偷增加能量。** 本文只做虚拟情景校准，不讨论现实操作范围。

## 4. 实际CPU对照：seed42、无风、80°

I01/I10用整事件固定`Iref=max authored body intensity`，单星门限.01/.1×Iref；不是每帧重新归一，也不是显示像素阈值。D_op沿用[既有DIAMETER-TIME操作定义](DIAMETER-TIME-RESEARCH.md)：E10–E90内且总信号≥采样峰10%，取最大scene D_I10。以下高度均world Y，已含origin1.477m。

| 单参QA | flight s | burst Y m | burst Vy m/s | D_op m | 全burn最低I01 / I10 m | 最高life Y m |
|---|---:|---:|---:|---:|---:|---:|
| 旧apex120 | 4.6584 | 121.477 | 0 | 90.714 | 3.270 / 14.919 | 139.858 |
| 仅初速离差s=.75 | 4.6584 | 121.477 | 0 | 68.035 | 17.904 / 28.693 | 132.161 |
| 仅apex rise160 | 5.3311 | 161.477 | 0 | 90.714 | 43.270 / 54.919 | 179.858 |
| 仅world-plane tilt±15° | 4.6584 | 121.477 | 0 | 90.714 | 5.264 / 16.796 | 138.708 |
| **仅timed3/rise120** | **3.0000** | **121.477** | **+21.505** | **90.714** | **64.500 / 72.551** | **185.319** |

| phase s | 旧apex最低life / I01 / I10 m | timed3最低life / I01 / I10 m | 两者裁前Σ源信号参考cd |
|---|---:|---:|---:|
| 1.1 | 94.694 / 94.694 / 94.694 | 116.385 / 116.385 / 116.385 | 715.287 |
| 2.65（本seed D_op时刻） | 46.068 / 46.068 / 46.068 | 92.515 / 92.515 / 92.515 | 499.037 |
| 3.65 | 9.135 / 9.135 / 空 | 68.587 / 68.587 / 空 | 10.498 |
| 3.90 | −.684 / 空 / 空 | 61.707 / 空 / 空 | .2559 |

旧seed42首个life内穿过.03m发生phase3.8819996s，此星当时仅.25345% Iref。phase3.65仍有31颗I01，但I10已空。用户观察的“最低快入海”有几何依据；不能把它说成全程主强光已撞海，也不能以最后暗到近0的星决定整幅自动构图。

新timed3在本seed整个life内不入海；临燃尽最低端点60.1488m，此时envelope=0。四seed/0风：新I01最低64.50–68.57m、I10最低72.55–76.59m；旧I01最低3.27–8.38m。0/5m/s恒定水平风的全部竖直指标和D_op逐值/数值容差一致；水平共同漂移仍真实存在，没有回正。sampleStep .025→.0125的六方案seed42 D_op/最低I01一致，但不把有限采样称全时域严格峰证明。

## 5. 各单参解决什么，不解决什么

1. **优先actual A/B timed3 vs旧apex：** 它修的是burst时间/遗留升力假设，保D(t)/星亮度与生命期；不保证视觉一定更真实，须看上升中的展开、全burn和真实倒影。整幅最高点反而到185m，既有camera fit需要更新，不能仍按“爆高120”包住全部效果。
2. **s=.75独立对照：** 修偏大/扩张偏快的作者观感，D_op约降25%，也减小向下初速度从而改善低尾；它改变离差动能，不能称 measured-energy 守恒。不要初轮与timed3叠加，避免无法判断来源。
3. **apex160备选：** 把整幅Y抬40m、保D(t)，但升空更慢到5.331s；若用户不满速度，这不解决该问题。继续标90mm产品已测高度会失真，应是独立height override或新产品profile。
4. **tilt只修取向：** 本QA指绕固定pattern.right的出平面俯仰，保root均值速度和3D尺寸；正面小角投影面积约cos15=.966，低尾仅改善约2m。用户若要笑脸“歪头”，应另定绕normal的in-plane roll，二者不可混称。当前azimuth只定世界朝向，尚无tilt/roll字段。单次取向应冻结，不随相机/burst后frame改变。

## 6. 若root随后授权，所需接口/边界

新增ring-only `flightModel:'apex-reference'|'timed-reference'`、`burstDelaySeconds`；保旧apex为baseline。分别记录reference rise/elevation、固定delay、实际burst worldY/上升量/velocity、实际muzzle；旧显式height的worldY语义不改。timed模式只对未来事件生效，不改已发body/烟水位。`velocityDispersionScale`、`patternTiltDeg`、`patternRollDeg`是另外的候选轴，不能暗中打包。

强度I和life/星数已在CPU逐body比较保持；physics没有烟M字段。ring-uniform smoke可保总参考预算、相对life曲线，但burst/每源时钟与世界轨迹会改变，不能声称完整烟hash不变。source provider、未来reservations、endTime、bounds/director预测、主+mirror必须用同一新事件；光簇/云/GI跟新world位置，原PSF/overlap/rawbound与P必须实际复验。音频gain不动，但真实事件time/position改变后传播到时自然改变。

最终像素门：同seed/风/固定C与相机，P允许安全选择且记录补偿；分别录launch→burst和同burst phase .3/1.1/2.65/3.65至燃尽；保原palette/材料/源量/烟profile不动。不要把autoFrame不同相机、DOF/曝光或新烟形态混成时程A/B。通过CPU数学只能放行这次有界实际对照，不能称供应商测得的精确smiley、绝对光度或任意硬件60fps。
