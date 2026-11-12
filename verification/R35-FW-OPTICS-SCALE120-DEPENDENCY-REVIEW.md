# R35：scale120 的发光、快门、尾迹与运行时边界依赖审查

阶段：实现前、只读源码/既有报告审查。没有生产修改、物理重放、浏览器或GPU。拟议版本为 `three-heart-scale120-v1`：同192体、64/层、三层燃烧曲线/寿命/参考光度和RNG身份，在爆后2.5秒，以每个outer头自身未施加用户gain的峰值Y为基准，Y≥10%时的**水平两两最大距离**标成120m。它是作者定义的几何标定目标，不是厂商实测的爆后2.5秒可见直径。旧 `three-heart-v1` /19m/s合同应原样保留。

## 最小真实改动清单

|位置|现有具体依赖 / 最小动作|
|---|---|
|`firework-layer-profile.js` 编译/limits|新增独立ID与限额表/分支；先按旧规则验证原native kick≤19，实例化同一旧三层profile，再对 `v_layer−burstVelocity` 的全部3D分量统一乘alpha。新增**输出**验证≤19×alphaCap，不能把旧输入19门整体改成76。按固定参考时刻/own-peakY门算alpha，0×光度也必须有相同alpha，不从当前I0除零。|
|同文件三层tail/profile返回值|当前 `effectProfile==='three-heart-v1'` 才附 `THREE_HEART_TRAIL_PROFILES[layer.id]` 和trailRecipeId。新名必须明确复用同一三层金尾实例/recipe；否则会落回旧`.34/.35s`尾迹，是实际外观与光账本变化。应仅扩展新ID条件，旧分支内容不动。|
|`fireworks-physics.js` 事件/configure/launch|接受新ID并传播实际scaled `velocity/baseVelocity`，后续resolveBurst仍只加实际壳carrier与baseline carrier的差。生灭、birth、intensity、burnProfile、material、trail、rocket/音效不变。若选择固定drag或仅definition-rise/apex域，必须真实API preflight和无发布副作用拒绝，不能仅在测试夹具里限定。|
|`firework-show-envelope.js:74–94`|当前所有非powered layered都强制intrinsic≤19。新增仅该ID的独立76（若cap4）合同与推导，保留旧19门；用新S实际参与初速、位移、最低高度、尾迹/快门支撑公式，而不是只放宽验证。实际wind history的区间、寿命4.876、同birth/no motor等合同均需保持。|
|`fireworks.js.getBounds():780–816`|目前只有powered会union连续解析show-envelope；普通三层仅16点轨迹采样+8m pad和2Hz缓存。新scale必须接入独立的解析union，不能宣称16点足以包住更快曲线/尾迹。追加新版本条件下的完整已提交wind min/max及alpha/版本身份cache key；仅latest wind不能代表中途风史。旧非新版本返回对象和powered字段保持。|
|`fireworks.js.smokeSourceProvider.describe():735–745`|roots已经取实际`baseVelocity`，sample/sampleBody也用真实body；新运动不需重写采样。当前只有powered在descriptor上公开effectProfile。建议仅新ID额外公开固定空间标定metadata（alpha、target/time/metric、cap、基准、witness IDs），用于溯源和新边界合同；不要伪造motorProfile或force knots，也不要给旧profile突然新增字段。|
|main / UI（由root拥有）|profile whitelist/选择项接新ID；展示“120m作者几何目标，接触后可见支持可能更小”。不要把旧three-heart直接换宽，不改参考强度1×、曝光、快门或批准音效。|

建议的新 `fireworks.js` 候选只包含**new-ID条件下descriptor metadata与getBounds解析union/cache**。等compiler metadata和envelope接口冻结后，再建立精确单锚点可逆变换：全文件inverse回到归档原字节，非新版本CPU输出严格旧值。此时不应编写依赖未冻结字段名的宽松正则transformer，也不应直接改着色器。

## 可保持通用实现，重点验证而非重写

- **`firework-tail-field.js`**：release位置和初速度来自`sampleBody(body,time−lag)`；脱离体仍取真实source velocity的.25。Eulerian qdot由真实source加速度/drag/wind求导。更大初kick自然传导进位置、qdot和spread，不存在19限制。它不是把source整体alpha再乘一次；不要单独放大尾迹lag或物理ember速度。
- **`firework-exposure-window.js`**：颜色/时间积分与causal-end anchor只依birth、life、参考RGB和实际sampleAt，无速度常量。快门RGB积分保持原值；空间锚点随真实新运动改变。它不声称对任意1秒强曲率轨迹作精确空间积分。
- **`firework-contact-support.js` / `firework-contact-optics.js`**：speed enclosure从实际birth velocity及wind/terminal forcing建立，field qdot enclosure也消费该M；没有19常量。新版本是无持续推进的线性drag体，仍可用已有海平面解析分支/一般地表有界区间，不应借powered标签套force分区。接触段RGB按local/global快门时长加权，严禁把穿地的光重新补回来以达到120m。
- **`firework-powered-optics.js`**：只对真实thrustProfile做force-knot切片与1/60限制。新scale无thrust，故不要新增powered假分支或复制force knots。普通S≤1s的既有first-order shutter模型可保留；新版本的高曲率误差/长快门必须如实测试和限定，不能继承旧测试就称已证明。
- **GPU optical attributes、`writeSourceBound`与保守culling**：实际centre/velocity或rasterVelocity/stretch/radius/24RGB taps决定quad、shutter span和峰值；没有硬19或three-heart名。由scaled poses重建记录并使缓存失效后通用shader应继续使用。需CPU原始double→完整Float32上传/投影检查及后续小实际GPU门，不能仅因源码通用便预称所有clip/near/water面分支通过。
- **光度/光账本**：`vectorRecord`、完整head/tail share、`getEmissionLedger`、clusters中心/RMS/maxExtent、云/地表/空气入射与resolvedSH均读实际records。参考I/RGB曲线不变，几何/近场/距离改变后受光和camera像素可以改变；不要乘面积补亮或调整rawPerCandela。接触后实际存活的ledger总I也可能较旧版本低，不能错误要求所有角度的世界可见总I绝对相同。
- **thermal模块**：`fireworks-thermal-photometry.js`/`fireworks-thermal-tail.js`只是既有纯导出，Planck/CIE有效面积与金色年龄LUT不依运动，保持原样。新profile应继续reference photometry；不能在放宽几何时顺带切greybody强度。
- **`luminous-framing.js`**：消费实际source/tail端点和虚像，无19限制。它的阈值是**全帧最大RGB权重**与总通量排除预算，不是本次每体自身峰Y的10%门，不能直接用来计算校准alpha。其离散future snapshots不是连续轨迹包络；safe director仍应先有连续包络，再可用实际当下发光点改善构图。
- **烟源/物质**：`describeCombustion`、trajectory/logical provider采实际scaled运动，past-segment covariance应重新得到实际路径。ID/时钟/CDF/总预算不变不代表包的位置、协方差、条件数、透射或投影overdraw不变。新ID不得误落入powered-only烟源路由；也不能静默把当前生产two-births改成logical-all。

## alphaCap 与“COM/可见宽度”必须说清

compiler lane拟cap4，因此新的intrinsic硬界为76m/s；cap3则57m/s。两者都是数值/兼容政策，不是自然界速度限制。cap3若有限seed样本足够，仍只能证明这些样本可解；要么提供全域下界证明，要么在alpha超cap时显式拒绝，不能clamp后仍称达到120。cap4也不免除同样的finite/eligible pair/alpha上界preflight。旧19门仍应用于旧合同及新校准输入的native生成器；新post-scale输出才可到76。

目前方案是 `burstVelocity + alpha*(oldLayerVelocity−burstVelocity)`，保留**壳carrier**，不是按未知质量重新计算的COM。有限192个kick的平均通常不为0，其残余均值也被放大；不可声称物质量COM严格不变。若改成先减平均kick，alpha=1也不再完全复用旧运动，属于另一候选，不可悄悄混入。

2.5秒的目标在contact裁切前定义。Bounds lane已发现低仰角25°示例有55个头在该时刻位于海面下；这不是修改contact、重生亮点或把所有爆炸拉平的许可。若允许25–90°，UI/metadata必须说明120是源几何标定而非每种地形/仰角的实际可见宽度；若要求实际可见120，则需另行真实高度/仰角/接触准入，不能靠fixture隐藏。

## 后续最小验收门

1. **先CPU**：新profile192ID/3层/seed/RNG/生灭/burn/trail/reference峰严格对旧；gain0/1/64的alpha一致；目标时刻按own-referenceY独立重算完整outer maxpair=120（记录所有eligible及witness），验证alpha有限且≤cap。旧profile全部输出与旧19负测不变。
2. **实际factory传导**：sampleBody、release field、detach、8-bin shutter和接触窗口覆盖1/120及边界快门；比较完整body/record/ledger来源与新运动，有限Float32/容量失败应显式拒绝，不删点。含实际海平面、岛边、25°/90°、wind knot、birth/burnout/尾迹结束、近面/反射。
3. **连续边界**：对所有层和完整生灭/尾迹/快门时段，用独立样本挑战新76解析包络；全风历史与缓存变更需有反例fixture。实际source projection/radiance bounds按新记录覆盖，别只改golden数字。样本测试不是解析全域证明，二者应分别记账。
4. **之后才实际GPU**：沿用已有固定小unit gate和一个完整新phase CPU preplan（全部T/SH与各眼源、原始rays、上传padding、像素代理面积），保留4m完整请求/1m map/8maps政策。可复用shader/renderer不等于数值draw与overdraw免费；不能把旧R30/R31钉住+3.90的golden/digest改成新物理后声称同一场景回归通过。

待compiler元数据/解析envelope候选冻结后，可将上述 `fireworks.js` 两处adapter交给本lane独立实现并验证。当前没有任何生产候选被此笔记准入。
