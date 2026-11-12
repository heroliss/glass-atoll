# R19 Eulerian阶段：独立 actual-factory 验证

本agent仅新增verification材料，未改生产源、未执行GPU/浏览器/readback/压力测试。

本轮冻结源：FW `c78afe6600a31d07b27751cec70e21fe28be68e2095bfc613cf071e42f2ae262`；field helper `4c19f88ad0083e3e0426464a1ee90facc9a107a5577f873ffe1cbc2a68d4977e`。独立比较baseline FW `abfdfdb70b556e2de1adb4431664c89500db5374047e95671104f4e95a31aeb0`，位于 `baselines/r19-trails-before-eulerian-history/fireworks.js`。

## 本轮结果

`r19-eulerian-actual-factory-check.mjs/.json`：**11/11**，实际Three factory，私有只读插桩与无GL renderer/mock sourceT。

- Shader文本逐字等pre-field baseline；本轮独立测试没有修改旧fixed-release oracle。
- 4个原生时刻、4002条有正光的当前record，所有共同字段（包括位置、真实ember速度、stretch、RGB、强度、peak、release参数）逐值/逐数组严格等旧。实际ledger与cluster结果严格相等。
- 部分退休阶段selected body剩4尾，最后阶段剩1尾，S0的 `aCentre`、`aStretch` Float32上传严格等旧。单条尾迹的原stretch=[0,0,0]被保留。初审发现“把dark retained邻居混进活跃尾迹，改变端点kernel”的真实边界，root已通过currentTailStart修复，本检查没有排除stretch绕过它。
- S0共1728条vector source的bin均值等当前RGB。1536条tail的Eulerian field velocity与真实ember物体速度不同，这是预期修正；S0不使用shutter速度扩大空间支撑。
- 三层 × S0/1/120/.1/.5/1，共15个纯退休案例。S0正确不渲染熄灭tail；其余窗正确保留过去尾光，24RGB对独立shifted core局部积分。案例当前所有tail I=0，actual instantaneous ledger rows=0、clusters=0，证明没有把历史光重新塞回当前环境照明。
- main/mirror历史source位置与24bins相等；current黑色不使all-phase界消失。view最大RGB使用body peak I0与lag权重，已独立比较公式；框内source被可见性分类器保留。
- 用实际field velocity独立投影8个时间bin中心及空间tail端点，CPU source rect覆盖所有检查支撑。这是当前一阶运动模型的double几何见证；实际Float32 fragment/GPU界仍须root门。
- 9个暂停快门值反复查询，逐row view/anchor map均≤4；被逐出的1/120重算后，所有Float32上传数组逐字等原结果，旧borrowed视图值未被覆盖。
- actual helper在24个原生view样本上的dq/dt对独立离线位置差分，最大误差约 `9.28e-9`。运行FW每次body/field query均≤其physical now，field内部release/ember query均≤field query time。未来两侧样本仅用于本离线oracle，不在运行回调。
- mock有效GPU路径main/mirror均按有序q(mid)提交Double端点及独立water-hit origins，sourceVersion递增；零CPU重复query。CPU路径查询同样端点，T只乘一次，24RGB未被T重复更改。此处是接线证明，不是实际VTF执行证明。
- legacy三阶段、两视图共6次：当前records、ledger、clusters及完整上传数组严格等pre-field baseline。

## 阶段语义

此次闭合的是**原瞬时N-lag辐射场的退休RGB时间支撑**，不是建立稳定物理release ID。每个j固定lag，释放时刻随t平移；view用coreRGB shifted−lag的bin平均Y乘固定age色谱/衰减权重。ledger和物质节点保持瞬时原义。

非零S仍使用过去中点、一阶field速度、当前邻居构造的空间kernel。尤其空间邻居在曝光期间也可能退休，其完整时空卷积没有被本次解析RGB均值自动解决。本轮严格S0空间一致，不能由此宣传非零S像素卷积精确。

地表 `currentY` 截止仍是独立已知限制；本轮退休案例Y100排除地表干扰。完整camera/depth/receiver曝光历史、T(t)、真实烟火物质/热能仍未实现。

## 旧证据保留

旧 `r19-trail-coupling-independent-check.mjs/.json` 的9/9 fixed-release报告、旧 `r19-trail-history-oracle.mjs/.json` 及原审查说明，均复制封存至 `verification/baselines/r19-independent-before-field-phase/`。旧报告源为0464f873，明确反映旧阶段的known history hole；不会把它改成新模型的“通过”，也没有删掉其原期望。

新phase采用本文件的新11项oracle。root实际GPU验收仍需核查原sourceT GL/VTF/restoration门、raw RGB/峰界、镜面图像与同场景CPU/GPU耗时；CPU通过不等于画质/FPS完成。
