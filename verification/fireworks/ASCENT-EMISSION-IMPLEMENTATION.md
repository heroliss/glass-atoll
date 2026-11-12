# 装饰昇り曲包络：已接默认，CPU验收冻结

普通ballistic shell默认已使用`through-burst-v1`：火光.12s平滑点燃、平台、末段.40s渐灭，到开花时结束头部发光。没有新增推力、提前.35s熄灭策略、引擎烟或额外声源；没有为了补光时间积分抬高参考I。

只改两份运行时：

| 源 | 最终SHA256 |
| --- | --- |
| `fireworks-physics.js` | `dc5de6b1a11a3e1a70d7342d3bdacc5813ab0f66e426f622d6e287991b4af87a` |
| `fireworks.js` | `40189f53842b6361a487fa4fa0af78de02727b2de1a23c5720f9128f18c97b9f` |

两份完整旧源在`verification/baselines/fireworks-before-ascent-envelope/`，旧SHA分别`3bbac197…`、`963bc4fe…`。音频源仍`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。

## 实际实现范围

新中央`bodyEmissionEnvelope(body,age)`位于physics。非carrier原样委托旧starEnvelope，包括strobe和split子星；legacy kind=`rocket`仅表示无持续推进的筒射载体，火光为作者装饰代理。元数据只更新carrier的说明字符串，未改字段/ID/祖先/事件数量或unknown fuel/yield。

统一了physics sampler、FW头部当前E、尾火过去出生时E、上传给shader的八个快门E。cluster/照云和resolved raw ledger自然从当前records.I更新，不再另乘包络。I/RGB基准、RNG、弹道、爆时、声音events/gain、烟质量/队列/物质配额均保留。原shader、Gaussian/PSF、重叠bins、近远裁切和unmodulated bound未改。

真实瞬时源与摄影快门平均共用同一函数/物理时钟，但平均值本来不等于瞬时值；镜像shutter0直接取同一时刻E。bound保留旧峰值1保证保守，未使用可能低估的E(now)收紧。

## 当前真实CPU结果

运行：`node verification/fireworks/ascent-envelope-runtime-check.mjs`，**6/6**。使用实际current factory/physics与封存old比较，不是另一套render实现。

- 20对factory，十类型×恒定/变化风，284帧。
- 1,144个carrier records核对只有其modulated I变化；18,304个快门权重逐项核对中央函数；72,432行raw ledger核对真实records当前I。
- 非carrier源记录、轨迹、属性、声音时钟/事件、body RNG/I/RGB逐值相同。三种intensity组合的30个纯event及其采样另外验证不变；原参考光强无补偿上调。
- 104个ground或残余carrier尾火结束后的帧，records、主/镜像上传属性、cluster、有效ledger内容和光学bound全部相同；**十类型开花后+1.1s对照严格相同**，覆盖root当前HDR取景相位。
- 元数据十型DAG/IDs/字段保持，只有carrier的发光含义说明为授权差异。

精确计数以`ascent-envelope-runtime-check.json`为准；没有在此声称真实GPU像素或电影观感接受。

### 必须说明的短暂传播范围

火光渐灭后旧灰烬可继续短时发光，不能人为在burst后改回恒1来制造“全postburst无差异”。既有FW duration顺序是willow.88s、palm.62s、其他carrier.50s；本轮保持此顺序与支持。因而burst后前.88s内，部分carrier尾火及它照亮的旧legacySmoke精灵可以随新E改变。这是同源光传输的正常结果。

生产persistent路径`legacySmoke:false`已单独严格核对不受旧精灵影响；旧精灵开启路径也验证除其派生smokeLight和授权carrier权重外，其几何/shape/RGB/物质不变，尾火结束后整个上传完全相同。root的+1.1s已经超过全部旧支持。

首两个QA边界失败分别保留`ascent-envelope-runtime-first.json`、`ascent-envelope-runtime-tail-window-first.json`：前者把旧烟精灵的派生照明也误要求全程相同，后者误把所有类型的carrier尾窗当.50s。修正的是夹具边界，未修改生产tail duration、位置、shader或权重归一来迁就测试。

## 旧保护门如何保留

新`ascent-default-normalize.mjs`严格逆回**2个physics站点和5个FW站点**，包含完整helper块，恢复封存旧源每个字节。缺失/重复14个反例拒绝，未授权gravity/shader改动不会被擦除。该窄层先于既有timed-flight/combustion/ledger等inverse组合。

旧medium/moments/default-metadata的历史默认等价比较明确使用`ascent-legacy-entry.mjs`：从**实际current源码**只逆掉授权包络，完整断言未删/改容差；这不是声称新ascent和旧恒1相等。当前新默认的差异/同步由上述真实factory6门负责。报告中也标注了这个兼容范围。past-bounds夹具仅更新private sampleBody计数的import锚点，以适应新中央函数名称；物理采样/17点/缓存断言未删。

最终各报告汇总在`ascent-acceptance-cpu.json`：physics22、audio12、timed12、intensity17、metadata15、ledger13、medium12、moments14、trace6、clip11、phase10、past16、scalar7、smiley37均通过；`node --run verify:smoke-burn`37和`node --run verify:smoke-field`54完整命令exit0。初轮旧scope/stale依赖失败与旧报告在`ascent-guards-before/`保留，未把旧失败改写成历史通过。

## 留给root的实际验收

重新加载后从发射前录至开花/燃尽；检查.03/.06/.12和burst前.4/.2/.01s的头部/尾部渐变，同步主图/镜像/照云/烟field；不只截平台相位。保持C、I/RGB、HDR/SDR配置和物质profile固定，观察新旧光学预算及无NaN/Inf。+1.1s应单独核对当前已验收HDR场景没有非预期变化。未新增任何GL pass/资源，但CPU/JIT和整场帧率仍应由实际页面测量，不能由CPU回归冒称零成本或始终60fps。
