# 上升火光统一包络：只读审查与CPU候选

建议把旧`kind:'rocket'`的上升火光明确当作**随筒射载体运动的装饰发光代理**。可统一增加点燃、稳定燃烧、渐灭；不因名称自动增加持续推力，不把亮度强绑速度。当前只新增QA原型/数值study，生产未接入。

## 类别依据，以及会推翻过度简化的反例

- [DOE：5 Facts About Fireworks](https://www.energy.gov/articles/5-facts-about-fireworks)区分筒射升空与飞行中的延时引信、空中开花。看到上升火光不等于载体一直靠发动机推动。
- [NASA Glenn：Model Rocket Engine Performance](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/model-rocket-engine-performance/)描述真正火箭的随时间变化推力、推进燃尽和之后滑行。若产品是powered rocket，须有独立推力/质量/阻力模型；装饰亮度包络不能代替或反推推力曲线。
- [磯谷煙火店：曲導](https://uchiage-hanabi.com/library/lead/)说明主弹开花前的多种附属演出，其中銀竜可从出筒持续发光至主弹开花。**不能把所有上升装饰都应在顶点前很早熄灭当作真实规律**。本轮网页直接open超时，定向检索返回了该厂商完整相关索引正文；不声称另看了其嵌入视频。

这些资料支持类别区别，不提供本场景的光强、燃料、精确燃烧秒数或强制包络形状。下面的.12s/.40s/.35s是独立作者时间参数，不是厂家测量，也不是实体烟火制造参数。

## 当前恒1走过哪些路径

| 路径/源位置 | 当前行为 | 最小同步要求 |
| --- | --- | --- |
| `fireworks-physics.js:155` | carrier有18参考cd、thermal RGB、kinematic life，未建立engine/fuel/装饰附件材料元数据 | I/RGB/flight life保持；新增的是发光时间函数，不是动力 |
| `fireworks-physics.js:215` | `sampleFireworkEvent`上升carrier直接`emission:1` | 用同一`bodyEmission(body,age)`中央函数 |
| `fireworks.js:245–248` | carrier头部用`age<life?1:0`；records保存当前I及unmodulatedI | 当前物理I乘中央E一次，保留unmodulated基准供快门/保守上界 |
| `fireworks.js:250–259` | carrier分.34尾部、.66头部；尾部过去出生时E写死1；尾火分段还有自身lag指数权重与灰烬运动 | 用E(sourceAge)，不把E(now)统一乘到所有旧灰烬；不重复扣I |
| `fireworks.js:317–319` | 上传`unmodulatedIntensity`，另外8个快门时刻carrier权重仍写死0/1 | 每个时刻读同一中央E；**只改CPU头部会被这里重新点亮** |
| `fireworks.js:215–228` | 片元头部8时刻加权；尾部空间8采样再独立快门平均/大快门GL3 | 不改kernel/PSF/光量归一；只替换CPU上传的时间权重 |
| `fireworks.js:263–277` | cluster从当前records.I求总I、RGB、质心/半径 | 自动跟随当前E；照云/有限局部光共用此原始账，不自行再乘E或P |
| `fireworks.js:282–303` | source-resolved ledger取当前records.I，rawRGB，无camera/P | 自动跟随当前E并版本失效；不能改成camera快门平均，否则物理源随摄影策略变 |
| `fireworks.js:93/385–398` | optical bound按unmodulatedI与最大色分量，再加几何/快门/重叠上界 | 第一版保持旧上界安全；不能仅乘E(now)就当整快门上界 |
| `fireworks.js:337–350` | smoke provider只采event/root过去轨迹，无carrier持续源接口 | 不因增加光曲线就创造沿飞行发动机烟；现launch/burst/真实star物质配额不变 |
| `fireworks.js:24–40` | combustion metadata将carrier标为kinematic lifetime、非已建立engine source；tail/shutter/mirror不另算物质实体 | 增加装饰光时仍须诚实标作者发光代理，fuel/yield unknown |

主图和镜像共用records和fillRecords；镜像当前shutter=0仍应读同一个E。空气/烟消光、反射路径、rawPerCandela、P和C均继续各自只应用一次。光强时间积分变化不意味着物质质量随之变化；光与物质账不能混算。

## 最小中央函数原型与两个可反驳的选择

QA文件：`ascent-envelope-prototype.mjs`，提供`ascentEffectEnvelope`、`bodyEmissionPrototype`、`shutterEmissionPrototype`。非carrier严格委托现有starEnvelope，包含strobe和split子星，不复制另一套星光逻辑。

函数为两个非重叠quintic smoothstep的积，0≤E≤1，端点C2；attack后平台1，fade后0。只读age/life与明确profile，不读速度、相机、曝光、风、RNG或音频。短life仅限制过渡窗不互相覆盖。

1. **`through-burst-v1`（优先研究）**：attack.12s、末尾.40s渐灭，到kinematic life时为0；相容于燃到主弹开花的装饰类别。数值过渡时长仍是作者选择。
2. **`early-burnout-preview-v1`（独立备选）**：同attack/fade，额外在burst前.35s结束头部发光，之后保持原弹道滑行。只有特定参考支持提前燃尽时才选，不把它推广为八类空爆的普遍事实。

示例90mm作者载体life4.65838s：候选1的∫E dt=4.39838s，是旧恒1的94.42%；候选2为4.04838s、86.91%。保留峰值18参考cd，**不为补回旧积分而偷偷抬I**。160/190m对应更长life下，候选1积分比例约95.12%/95.50%。这些只描述当前虚拟光源，不是测量光度或能量/燃料守恒。

尾火读过去E，因此头部熄灭时仍有少量旧灰烬：候选2示例头部0、现10段尾部参考I约1.60454，半秒后尾火为0。这是既有尾部支持窗的结果，不应把旧尾火又当持续动力或第二份烟质量。

## 实际CPU结果与边界

`node verification/fireworks/ascent-envelope-study.mjs`：**13/13**。两seed×十型20个真实event（16有carrier、4个地面无carrier），五个生产源文件运行前后SHA逐字节不变。

- 140070个有界/支持样本；41,760个非carrier比较与现starEnvelope逐值相同。
- 独立Simpson积分对解析面积最大差约1.18e−12s；没有隐藏归一增益。
- 8时刻主图与shutter0镜像的函数/时钟一致；选定边界窗的瞬时E与摄影平均最大差约.001096。两者是不同物理/摄影问题，不强行数值相等。
- 例age=.002s时E(now)约4.5147e−5，而快门内最大约9.6934e−4。直接用当前E收紧bound会低估；旧权重上界1仍保守。
- 30/60/120Hz仅采样同一显式物理时间函数，面积误差分别约8.51e−5/2.71e−6/4.08e−7s，不形成积分状态或帧率驱动燃烧。

首轮study的12/13失败报告保留`ascent-envelope-study-first.json`：原断言把真实sampler的resolveBurst合法出生位姿更新也包进“不变”检查，随后已把变更边界限定到**原型调用前后**，不删轨迹断言、不改生产采样器。当前原型调用不改变event或轨迹。

以上是未集成CPU研究，**不是GPU/主图/镜像/照云/烟field或电影视觉接受**。中央光滑包络也不模拟真实火焰湍流、独立火星燃料、连续排烟或喷流推力。

## 若root批准下一步，最小接入与保护门

建议先显式opt-in装饰profile，旧factory/default事件保持legacy；所有carrier消费者读一个中央函数，不给head/tail/shutter各写私有拟合。每发装饰profile是发光元数据，独立于carrier动力；不改变flight/burst、primary stars、I/RGB、source轨迹、音频events/gain或烟M/预留队列。

第一轮bound继续保守用unmodulated峰值；它可能在熄灭阶段偏松，使P精度浪费。若日后需收紧，只能使用相同record八时刻权重/完整支持窗的可证上界，另做GPU峰值预算，不用单帧E近似蒙混安全门。

现有保护面至少包括：

- `physics-check.mjs`、`timed-flight-check.mjs`、近顶点study：姿态/速度/爆时/高度/RNG逐项相等；默认legacy输出不变。若直接改默认光学，旧emission=1断言不能假装仍原样通过，需显式候选与新增期望。
- `scalar-bound-check.mjs`、`past-bounds-check.mjs`、near-plane/真实7门bound：仅许可的包络调用差异；几何/投影/kernel/bins/shutter支持及安全余量不动。
- `medium-compat-check.mjs`、`emission-ledger-check.mjs`、combustion metadata、ring-burn/trajectory/Taylor：严格source inverse须新建窄层并先逆回本轮冻结源，再走旧normalizer；不能删guard。物质配额、未出生预留、clear/tombstone、queue/source IDs及默认metadata保持。
- 实际GL主/镜像head和tail、large/small shutter以及shutter0；原始cluster/ledger和照云/烟resolved-field都用同物理时钟E，账本版本在变化时刷新，不增加camera依赖或P。
- `audio-check.mjs`：launch/burst时刻、位置、gain与种类逐项不变；可见火光渐灭不自动添加engine持续音。
- 固定C/I、同相位的完整发射→开花→燃尽电影；在HDR和SDR分别检查过渡及曝光预算，不因显示映射隐藏早期火光而抬源gain。原型13门不可替代实际视觉接受。

冻结：prototype `d15862db…`，study脚本`423d2e84…`，最终CPU报告`6bd2d7b2…`。完整SHA在JSON中。当前只读结论不授权生产默认变更。
