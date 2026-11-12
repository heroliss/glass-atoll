# 逻辑燃烧体接口：基础层验收

此接口只描述物理对象与作者时钟，不产生新烟。合同见 [COMBUSTION-METADATA-CONTRACT.md](plans/COMBUSTION-METADATA-CONTRACT.md)。

```js
const graph = fireworks.smokeSourceProvider.describeCombustion(eventId);
// graph.schema === 'glass-atoll.combustion-metadata.v1'
// graph.nodes, graph.edges, graph.counts
```

节点具有`sourceID`、`role`、原`bodyId/parentBodyId`、`birth/life/endTime`、`parentSourceID`、`ancestry`和`familyID`。`node.matter`提供`matterWeightCategory`，但`relativeWeight/absoluteMassKg`为null、`weightStatus/fuel/smokeYield`为unknown。split家族标识只说明谱系，不分配父子预算；也不能将父与子各算一份完整装药。

| 类型 | aerial root | child | ground comet | lift | carrier | burst | 总节点 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| peony | 224 | 0 | 0 | 1 | 1 | 1 | 227 |
| chrysanthemum | 192 | 0 | 0 | 1 | 1 | 1 | 195 |
| willow | 160 | 0 | 0 | 1 | 1 | 1 | 163 |
| palm | 12 | 0 | 0 | 1 | 1 | 1 | 15 |
| ring（reference） | 120 | 0 | 0 | 1 | 1 | 1 | 123 |
| heart | 144 | 0 | 0 | 1 | 1 | 1 | 147 |
| crossette | 36 | 144 | 0 | 1 | 1 | 1 | 183 |
| strobe | 160 | 0 | 0 | 1 | 1 | 1 | 163 |
| fan | 0 | 0 | 9 | 9 | 0 | 0 | 18 |
| bouquet | 0 | 0 | 104 | 1 | 0 | 0 | 105 |

crossette子星在各父星birth+.78秒出生，四个子节点继承父节点的familyID。fan每根comet有自己的错时lift触发；bouquet的104根共用一个lift触发。显式smiley layout按实际body数描述，未写死120。

`mortar-carrier`的life是现有重力+阻力飞行时长，绝不表示发动机燃烧；lift/burst的life0只是instant trigger，而非实测燃烧时长。ground图没有高空burst节点；其header `burstTime`沿用现有物理事件的共同发射/起算时钟，不能据此虚构空爆。

图深冻结、没有原始event/body指针，也没有坐标、速度、I/RGB、随机数、风或渲染记录。未来birth允许描述，但没有未来风XYZ。旧`sample`仍只接受过去/当前、活动event及保留的因果风；它仍不提供child分支，元数据完整不等于所有body已经能发烟或采样。

首次显式调用才建立本实例WeakMap并建图；调用失败不建cache。WeakMap不延长active event的寿命。保留的图是静态值，不是有效provider租约：event退休、缺失或factory disposed时，新查询明确拒绝。独立纯入口`fireworks-combustion.js`重导出builder；默认factory没有调用它，旧diagnostics字段/计数不变。

## 本轮证据

- [combustion-metadata-check.json](fireworks/combustion-metadata-check.json)：**15/15**，含十型×三seed的实际DAG/数量/寿命、crossette .78秒、ground触发、深冻结、未知物质、future拒绝、lazy分配、inactive/disposed拒绝、layout变体与无副作用。
- 十型共50个采样点与冻结76源进行零容差比较：render records、光源ledger/预算/cluster、旧describe/sample、diagnostics与launch/burst声音事件完全相等；新增方法不增加旧describe/sample计数。这里只比较CPU输入/输出，不冒称新GPU运行证据。
- [emission-ledger-check.json](fireworks/emission-ledger-check.json)：**13/13**；[physics-check.json](fireworks/physics-check.json)：**22/22**。只重跑本次factory/元数据相关范围，未重复整场GPU。
- [combustion-metadata-normalize.mjs](fireworks/combustion-metadata-normalize.mjs)的三处逐字节逆变换恢复原76冻结源，再进入原ledger两点逆变换；漏改/重复片段均fail closed。旧76源及当时CPU报告保留在[baseline目录](baselines/fireworks-before-combustion-metadata/)，旧真实GPU图像/JSON未重写来源hash。

冻结`fireworks.js`：`963bc4fef5167bebebf84f1075072166f222ff4e4e1b8b4384b470ed44bb5310`。

这只是下一阶段源覆盖的可审查基础。没有新budget/排烟/膨胀/LOD，没有改变physics、音频、renderer、host或main，也没有照片级、性能或全源持久烟的准入声明。
