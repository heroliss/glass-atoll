# 逻辑燃烧体元数据：最小冻结合同

只新增可选的`fireworks.smokeSourceProvider.describeCombustion(eventId)`。首次明确调用才分配每实例WeakMap/冻结DAG，默认动画、发烟、轨迹、I/RGB、随机数、声音以及旧`describe/sample/diagnostics`均保持原样。只接受当前active且因果风历史仍保留的event，不延长active槽、不存强引用档案。

DAG节点含稳定`sourceID`、`role`、原`bodyId/parentBodyId`、`birth/life/endTime`、`parentSourceID/ancestry/familyID`、`matterWeightCategory`。燃料、烟产率、物质份额均明确unknown/null，不创造kg、数值预算或发射计划。crossette父子属于同一matter family，但此接口不决定父/子应分多少物质。

覆盖全部实际aerial root/child与ground-comet，以及lift/burst触发节点。aerial mortar carrier单列为运动载体，**不声明发动机或燃烧源**；其life是重力+阻力飞行时段。lift/burst的life0只表示instant trigger，不代表已测燃烧时长。fan为9个launch触发与9个comet，bouquet为1个launch触发与104个comet；ground没有伪造高空burst/carrier。

默认十型body数分别为224、192、160、12、120、144、180、160、9、104；crossette包含36父+144子，子birth严格等于父birth+.78。若显式选择不同smiley layout，图按实际heads而非硬编码120生成。

允许描述未来出生节点的作者时钟/谱系；**不返回任何worldXYZ、速度、预测路径或风采样**。真正采轨迹仍只由旧causal`sample`负责，其root-only边界不被本接口暗中扩展。尾迹/快门/镜像/PSF不生成额外燃烧体，不能从render ledger反推物质。

实现范围仅`fireworks.js`最小接入口、新pure graph模块、独立CPU QA与严格逆变换。逆变换须逐字节恢复76b87313冻结源，再接原ledger两点逆变换。既有GPU76结果作为历史证据保留；新元数据不据此假称已重新GPU验收。不新增发烟、budget、膨胀、LOD、renderer/host/main接线。
