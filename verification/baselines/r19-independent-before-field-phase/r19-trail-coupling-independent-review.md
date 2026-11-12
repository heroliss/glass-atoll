# R19 分层尾迹：独立耦合复核与历史支撑反审

仅新增verification材料；没有修改生产文件，没有GPU、浏览器、readback或压力测试。

本次源：FW `0464f873fc44cc227ca2ca5a2c575c539d933f0ddec329001f33ad7db7e5cfeb`；trail pure `916aeba9c4647bf85d668a85e659ff5ec50bd2207dc784658dc9bf73015cb0ce`；layer compiler `40e3ad97b42601fdfe7588a95a9d907002f6dbd57aa714ee69bda3e35ecd9c82`；physics `35bbded2c937d335890c14a9a33abc0487db93a34b8458042db2720719374291`。

## 本轮耦合验收

`r19-trail-coupling-independent-check.mjs/.json`：**9/9**，实际Three factory的私有只读插桩与无GL renderer stub。没有用旧.66/.34硬编码期望充当新recipe测试。

|路径|独立证据|不能据此宣称的内容|
|---|---|---|
|192颗core head|逐体按各自profile的1−f分配当前RGB和全周期最大RGB，outer/middle/inner均64颗|物理发光能量/化学标定|
|1536条当前tail，N=8|逐条核对D、release时刻I、f/sumExp、年龄LUT、无衰减全周期colour bound及I0只乘一次|已经恢复退休release历史|
|ledger / cluster|1728当前row的完整RGB和分别等于actual API，Float32 ledger误差单列容差|GPU SH1/云/GI实际像素或其历史曝光|
|causal window / mirror|S0、默认1/120、.25、1，两视图共192个分层head/tail抽样；24系数对独立clipped LUT Simpson（32子步/段）及core局部积分|长S的source集合完整；连续非线性轨迹/T(t)/遮挡积分|
|颜色控制与光学gain|recipe LUT在两视图不被legacy global colour flag覆盖；2x gain在row、ledger、cluster及上传均一次|自动曝光/真实HDR视觉已验收|
|combustion元数据|192物理root携带相同recipe/f/D；1536绘制tail没有另建物质节点|kg、烟质量、PM或热能已经分配|
|f与画质边界|f0不留tail、f1 head RGB=0；实际N6/10/16各自正确重算sumExp，头仍192颗|各档FPS或视觉可接受性|

canonical recipe配置为 outer f=.06/D=.10，middle .14/.20，inner .24/.32；head share为.94/.86/.76。最大D=.32没有突破导演原.35尾迹硬界。颜色每个LUT节点unit-Y，逐段线性插值仍unit-Y；componentwise全周期最大值在端点取得。因此tail的bound必须使用 `releaseI*f/sumExp * allPhaseColourMaximumRGB`，而不是当前tail colour；当前实现符合此关系。head仍按core自身的全周期RGB界乘1−f。

pure模块初审指出的frozen accessor伪不可变、过小D导致色度节点时间不可表示，两项均已由模块owner在916aeba9补数据descriptor/严格递增年龄检查；canonical值不变。没有以“canonical不碰到”掩盖通用domain漏洞。其独立pure baseline/非法输入证据见owner的 `r19-layer-trail-profile-check.json`。

## 已确认但未修复的历史孔洞

`r19-trail-history-oracle.mjs/.json` 明确输出 **`historyRequirementSatisfied:false`**，不是一个“历史功能验收通过”报告。

当前一帧的尾迹出生节点为 `u_j=now−(j+.5)D/N`。下一帧节点的出生时刻也随now一起移动；这是瞬时Eulerian求积网格，不是稳定的离散release ID。因而：

1. 把这些对象多存S秒，不会自动得到真实release历史；
2. 追加“退休缓存”且保留新的整套currentgrid，会重复或错配release；
3. 仅计算每个当前row自己的精确快门RGB，无法补回根本没有创建的旧row。

独立oracle把两个已明确定义的量分开：

`L(t)= f/sumExp × Σ_j exp(−3.5 lag_j/D) × I(t−lag_j)`，其中 `lag_j=(j+.5)D/N`。

它的**时间平均**可直接对core分段线性I做局部积分，得到当前N-lag瞬时场历史的精确聚合photopic参考值。另一个oracle对“仅present currentgrid的fixed-born proxies”做解析指数积分。S0时两者15例一致；有限S不能把两者偷换成同一个模型。

用source峰I=10、life=.6、位置恒Y=30（排除ground）的小夹具，三种D均在最后tail退休后复现actual factory current/viewTailRows=0，而过去快门尾光仍>0：

|层|默认S=1/120历史tail参考I|S=.5历史tail参考I|当前代理|
|---|---:|---:|---:|
|outer|.000240318|.308594333|0|
|middle|.000560742|.530106890|0|
|inner|.000961273|.518226700|0|

因此孔洞并非只存在QA长快门；默认窗也可在最后尾迹退休的数毫秒边界复现，只是上述量很小。长S更容易看见。不能据default1/120便声称数学上没有该问题。core head在默认窗的三个例子也已经全黑，排除了“只是head代替tail发光”的误解。该oracle是总I参考，不是空间像素、物质守恒或真实连续release物理解算。

## 后续最小方案与反审

本轮保持R18明确限制，**不合入以下新模型**。

若保持旧 `L(t)` 模型，一种直白途径是每个快门时间求积点各重建N个lag节点，以正权重绘制view-only源；这些源只进入光学视图，绝不进入instantaneous ledger/cluster/matter。每个节点的瞬时source集合可按旧模型精确计算，但8时间点本身仍是有限时间求积，不能称连续时间严格积分。它会最多8N个view实例；相比当前一个fixed proxy卷积，需要单独的上传容量、CPU、排序、透射和GPU预算证明，不能未经测量扩14k上限。

保持N个view实例的更小候选是显式改为**release-time求积**：在 `[max(birth,now−S−D),min(now,bodyEnd)]` 放N个release节点，解析积分各固定release与快门的重叠发光；系数必须按release间距归一，不可把扩大区间后每条仍当旧权重。这样可以覆盖退休支撑且不产生额外matter，但是新的连续release近似，不是旧离散currentgrid的精确历史。必须先定义归一与S→0极限、对独立二维时间×release参考积分标误差、审查色谱/出生/熄灭/非线性路径和光学anchor/T近似，才可考虑接线。短D长S时释放采样点过疏，不能仅因总光量接近就证明空间形状正确。

“每个节点固定出生时间”的持久光学release网格也可建立真正ID，但会改变S0图像和帧间能量波动；若按D/N锚定，相位相关的指数权重和会出现周期纹波。不能随意重新归一每帧又称每个固定ember真实光度不变。它应作为新的明确模型单独评估，不能伪装成缓存优化。

地表穿越仍是独立限制：正确处理应终止ground crossing之后的发光，并保留此前快门支撑；简单取消currentY cutoff会重新引入水下亮点。此前R18独立地表合成复现仍适用。以上改动还需保留main/mirror相同候选实际S、legacy mirror S0、全周期RGB界、sourceT的排序行号及RNG/物质不重复契约。

后续root提出的**固定lag Eulerian光场节点**比上述两个方案更小：不重新划分release轴，也不增至8N实例；直接对每个固定lag节点的瞬时photopic I做shifted时间积分。独立detached反证结果与接线条件已另写 `r19-eulerian-tail-field-plan.md`。该新方案目前仅是数学/kinematic oracle通过，不能据此删掉本轮生产历史孔洞报告。
