# R35：尺度、烟源路由与包围的独立定向审查

`r35-smoke-scale-source-audit.json` **5/5**；实际生产FW/provider与两个独立host各运行106个CPU步骤。没有上下文、renderer调用或GPU，也没有修改任何生产文件。审查epoch为layer `2cf3…`、solver `e1e2…`、physics `247b…`、FW `c643…`、show envelope `eb100…`、main **`998d3744…`**（后续四消费者shutter修正）、UI `de97…`、index `83dc…`；完整SHA在JSON中。

## 路由事实与真实尺度消费

| 调用方式 | 实际查询/产烟 | 总物质量 |
|---|---|---|
| 普通trajectory-v1、默认two-births/point | 12个代表root在0.35/0.65两个释放年龄集合中查询，各一次；共24包（含launch9、central3） | 20.35作者相对质量单位 |
| 显式QA logical-all连续源 | 全部192个root，12,065个past body位置查询；本seed全寿命共2,425包 | 20.35，相差仅双精度累计末位 |

两个host均实际使用ellipsoid/tiled64。所有实际provider位置与独立生产physics采样的尺度轨迹逐坐标相同，最大差0，没有future查询。descriptor携带new effectProfile、完整192个已缩放baseVelocity和同一radialScale；源位置确实消费新速度。它不是只改显示metadata或render quad尺寸。

但**普通模式没有自动升级为192主体连续产烟**。trajectory adapter的特殊all-logical分支仍只有powered-bees；普通parser舍弃新profile/scale标记，仍保留真实速度并调用真实provider。因而它没有丢20.35物质量，却只有代表点释放而非每个燃烧主体的连续烟迹。完整192模式当前是显式QA opt-in；不能把这次新尺度编译称为正常运行已完成全主体连续烟源。更多包不等于增加物质量，也不能为了性能删除暗烟。

本次没有改变物质量CDF或烟源时间分配；QA logical-all采用既有每主体连续源规则，不能把现有材料profile descriptor误称为新实测化学产烟率。源扩张、烟包空间协方差和后续SH来自已有实际采样链；绝对烟量/燃料质量仍是作者参考。

## 旧19m/s与光学分支

没有发现遗留19把新运行时速度截回旧值。compiler的19仍约束**未缩放native输入**；新limits为76。live enclosure再按已编译的`19×alpha`检查每个实际kick，违反时拒绝。新profile拥有实际gold trail recipe，向量head/尾迹/曝光窗口/接触路径按body属性消费，不靠仅`three-heart-v1`字符串决定；powered专属力与1/60s限制没有强加给无推进新profile。

审查同时验证main四处bounds消费者都传当前shutter，其中localLights使用optional-chain。首次4/5失败是审计脚本错误期待source receipt有`passed`字段，第二次4/5是计数正则漏了optional-chain；两份脚本/失败JSON已分别保留在R35 baselines。修正只涉及审计fixture，生产未改。

## Live envelope的硬合同与最明显边界

已知事件包围使用真实launch/fuse、immutable radialScale、192个same-birth/no-parent/no-thrust/bounded-descent/gold-trail root、life≤4.876、tail≤0.35；风按声明分量范围，shutter为0–1s。CPU本审查确认真实explicitheight220m可进入该live路径，超过`19×alpha`的伪造kick和超1s快门会拒绝。既有Motion lane另有连续解析推导与实际head/tail/proxy采样证据；本报告没有冒充重新做GPU证明。

需要保持下列范围清晰：

- **定义式的prelaunch/family包围仍拒绝explicitheight**，属于另一合同；explicitheight必须使用已知事件live函数，不能把family调用失败误判为live新尺度故障。
- live承诺只覆盖声明的**worldY≥0**源、尾迹中心和线性快门/lag proxy端点。它夹住minY为0；不承诺负海浪表面上方但worldY<0的可见区域，更不承诺地形安全或接触后仍宽120m。
- camera Gaussian quad、景深、bloom、持续烟雾与最终像素仍需各自framing边界；解析world-space proxy不是整幅画面像素包围。
- 已声明的风范围之外未来用户风、更改后的物理模型，以及任意未审查极端explicitheight不在证明内。二进制64区间计算加padding是保守工程推导，非形式有向舍入证书。

因此此定向审查未发现阻止当前声明的新尺度运动/descriptor消费的源码问题，但普通连续192烟源、实际GPU/原生明亮画面、完整接触/多发积烟和帧率仍有各自未完成范围；5/5不表示目标完成。
