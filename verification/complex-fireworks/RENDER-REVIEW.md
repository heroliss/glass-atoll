# 新增十种复杂烟花：渲染与成本审查

本轮只读生产源码，没有GPU、浏览器、重放或生产修改。审查基线：FW `d982523fbeb6538266b6d26043c148f77006166dac26dab1ce6af0e7a96bc819`，physics `8425fd82af1dfbf12a5cea42e72558625da1b349984463507267b834bde24b45`。音效须保持 `fireworks-audio.js` **`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`**；不改原十种的随机调用、时钟、数组身份或数学。

## 推荐：新图案优先复用scalar路径

几何层次、不同寿命、延迟点燃和少量颜色关键点不需要全部转成实验菊型的 `burnProfile`。普通scalar记录直接使用当前颜色和已有包络；有 `burnProfile` 的每个头/尾会进入vector路径，首次每快门生成24个Float64 RGB taps、8段曲线积分及锚点；接触或力节点可再拆行。已有同代缓存不会消除下一物理更新的这项成本。

新type建议 **180–320个真实body，总数包含延迟层和分裂子体**。其中 `trail:true` 的carrier最多192个，其他层保留清晰亮点。质量N16时每场最多 `320+192×16=3392` 瞬时行，32场108544，仍在当前131072账本域；320头全部长尾则32场N12已达133120，超过账本域。N6/8宜作默认；稠密头+长尾+8段曲线同时叠加不是免费增加丰富度。

现有shader不识别pattern名字：只要生成既有记录属性，环、球、扇、花瓣、旋转坐标系和多层组合可走同一instancing draw。光学容量262144并不保证这些行的像素填充或32场帧率。SourceT18000、SH14000源仍是另外的限制，大场完整烟路径不能偷偷落回巨大CPU透射。

## 最小body合同与新颜色数据

运动仍用既有 `id/event/birth/position/velocity/drag/gravity/life/radius/intensity/colour/trail`；ID唯一，RGB有限非负，强度缩放由原创建流程只做一次。层的寿命和起燃时间直接放 `life`、`birth=burstTime+delay`，不额外创建每个亮点的JS更新回调。既有 `strobe/frequency/phase/duty` 可复用，但不是曝光积分后的精确闪烁。

建议新body独占一个不可变、可序列化的数据分支（字段名可由实现统一）：

```js
sourceStyle: {
  schema: 'glass-atoll.scalar-source-style.v1',
  headColours: [{ ageFraction: 0, rgb: unitYRGB }, /* 2–4 keys */],
  tailColours: [{ lagFraction: 0, rgb: unitYRGB }, /* 2–4 keys */],
  tailFraction: 0.0,      // finite 0..1; head uses 1-tailFraction
  tailSeconds: 0.35      // first version <=.88
}
```

`headColours` 用源body自身age/life；`tailColours` 用脱离后lag/duration，两种时钟不能混用。尾的发光量仍在实际release age取源包络，随后按lag衰减；不能取现在的头颜色冒充旧尾颜色。相邻unit-Y线性RGB关键色作凸组合可保持作者强度预算，不再逐行做色温谱积分。全相位逐通道最大颜色预先计算，用于保守radiance bound，不能只拿当前最暗关键色做储存曝光上界。

**当前代码不会消费上述新字段。** 需要新type-only pure sampler，并由physics的 `sampleBodyEmission` 与FW的scalar head/tail record创建共同调用。否则可见颜色、ledger/cluster/GI和CPU参考会各用一套颜色。旧body无该字段时必须返回原colour数组/旧表达式。当前scalar tail固定热金色或全局cooling，fraction默认.34、duration按旧type硬编码；独立尾颜色/长度/份额必须显式接线，不能仅把属性挂在body上。

这种scalar颜色动画使用当前颜色乘既有运动快门核，**没有积分曝光窗内的颜色变化**。首版宜用≥约.3秒的缓慢色变，不声称精确快速闪光/变色历史；将必要的少量特殊层升级成vector是后续可选，不强迫所有新type升级。不要通过给普通新头挂伪 `burnProfile` 来获得颜色动画。

## 延迟层与旋转推进的边界

- 未来birth已被record循环跳过，但未来body的 `position/velocity` 必须是其自身birth时的真实起点。若随壳运动后再点燃，应在burst解析时求该时刻pose；不能把burst点重复当成延迟后的世界位置。
- `endTime` 必须覆盖所有 `birth+life+tailSeconds` 和保留的烟源/光学支撑；层迟到后不能提前删除整个event。多次视觉点燃可保留一次launch+一次burst的旧声/烟触发合同；若真增加多个burst事件，需另做显式源/声音合同，不能只改event数组。
- 真正有限旋转推力应使用有限、确定性的力时程，不能以逐帧随机抖动或shader位移冒充轨迹。已有 `sampleBody` 可消费 `thrustProfile`，但同时不支持powered parent/child继承。
- 有 `thrustProfile` 的每源已触发 **shutter<=1/60** 限制；scalar不进入vector力节点拆分，只是短窗一阶运动近似。普通新type并不会自动获得旧 `powered-bees-v1` 的连续解析forecast。`getBounds` 普通路径17点采样+8m裕量不能证明任意spiral极值已覆盖，必须给新type速度/力贡献和出生延迟上界。

## 必须闭合的接线

| 消费者 | 当前事实 / 最小动作 |
|---|---|
| `firework-show-envelope.js` | `FIREWORK_ENVELOPE_LIMITS[type]` 为旧type表。新type需最大速度、寿命、birth delay和有限力位移上界，供自动构图/运镜使用。不能套旧19m/s限制。 |
| `getLightClusters` / ledger | 已完整合并32场、保留两簇/两组；新颜色必须先进入同一records，不能只改draw颜色。 |
| `pyro-smoke-events.js` / `pyro-smoke-trajectory-events.js` | 两处旧十type白名单会直接拒绝新ID。要显式扩展批准type，按aerial两触发分配原预算；不要改音频事件type来绕过白名单。 |
| smoke descriptor | 延迟birth、life、baseVelocity、root ID/endTime必须实际一致。现两次代表源要求每个root的 `life>.65` 且 `birth+.65<=endTime`；短于此的全新root不能只加白名单便准入。两次代表源只表示稀疏排烟；有限弯曲路径不自动取得force-knot连续排烟的承诺。 |
| contact / shadow / bounds | scalar中心接触和既有光学近似保持；新样式不因此获得vector曝光内接触积分。曝光上界需包住新颜色/峰值，有限力/延迟层需连续或保守边界。 |
| audio | 保留原launch/burst世界记录及已认可模块hash；这里只扩展视觉type，不宣称新增真实子爆声学。 |

最小后验检查应包含：新十type各一个确定seed的真实producer、所有body/ledger颜色和时钟一致、sourceStyle缺省旧样式精确、延迟层event不早退、全部type的forecast/轻烟准入，以及一个有限spiral短快门case。再由root选一场和少量重叠场看实际画面/帧成本；无需先为十种图案复制十套GPU核或做32场大压力门。
