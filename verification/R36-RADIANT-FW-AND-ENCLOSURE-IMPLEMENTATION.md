# R36：新辐射版本的 FW 与连续包围接线

本 lane 生产修改仅 `fireworks.js` / `firework-show-envelope.js`，冻结 SHA 为 `03fdb7038bffbfc769924ffff6ee57a51b5e9f8b2d3c72169d06e72b9d45c735` / `1c0c374b07f74b81356981bcee26ad030358a85acad96c7af25aaf687354297a`。18处闭合逆变换逐字恢复 `baselines/r36-before-radiant-profile/`，FW保留CRLF、envelope保留LF。shader、通用contact/曝光/tail-field方程、原生强度和4e5主爆源码没有修改。

新ID `three-heart-radiant120-v1` 独立进入连续scaled family/live包围、active cache与descriptor路径。新recipe `radiant-layered-gold-v1` / schema `glass-atoll.radiant-layer-trail-profile.v1` 明确准入D≤.88；其limit必须保持192根、76家族上界、19×实际alpha、bounded-descent、无motor及作者gain16。旧R35的ID/recipe/.35 guard原样保留。合法explicit-height仍从真实载弹初始状态和固定life解析；完整已提交风史组件界、实际0..1s快门和相邻尾场stretch支撑延续既有正kernel推导。cache的新ID标记避免同seed/time/alpha的旧新事件误共享较小尾迹包围。

实际光度仍只在纯新编译变换应用G16。FW的vector head/tail `unmodulatedIntensity` 对新ID改为**已派生** `emissionReferenceI0×allocation`，不再读取较小native body.intensity，也不重复×16。现有即时RGB、窗口RGB、all-phase maximum、ledger、light clusters、反射/main上传和radiance bounds均消费这份实际source。烟provider与combustion metadata新-only增加radianceProfile、native/derived峰值；仍192物质根、同lift/carrier/burst角色，不把lag/shutter/mirror复制成新烟源或音效事件。radialScale原对象仍是几何校准输入预算，不冒称新辐射总预算。

独立actual-factory CPU `r36-radiant-live-envelope-check.json` **8/8**：

- 14旧style：42个pure envelope、56个live bounds、14个provider descriptor全部exact，含R35原版。
- 18事件的3 seeds×25/78/90°×definition/explicit-height，全life source/tail、causal midpoint、1s shutter/stretch端点、未来风范围及cache行为通过。
- 启用sea contract的main/reflection矩阵共9,406 actual optical/inert-fill行；这是factory默认10 lag节点的支持测试，不冒称当前中档8节点GPU工作量。该78°矩阵全部走full-support，contact-local=0，另有低height25°实际case产生266条非空contact-local row，端点与物理state不变通过。
- **另一个明确N8**的U0/1/2/64案例核768根：native intensity不动，derived I0与source knots恰是R35同用户倍率的16倍，全部4,800非空source时间taps受all-phase RGB包围。完整receiver ledger Float32词、实际上传aShape参考强度逐词/逐值相符，clusters总参考Y和当前source一致；光学调用保持physical state与ledger对象不变。
- 该seed/+0.7s/U1新峰预算native1421.292953→derived22740.687253参考cd，当前实际总Y20472.10044，N8 ledger/upload均1600行。U2/64线性增加，U0严格0行/0光。没有将其解释为测得真实cd或面板nit。

Bounds lane另外只读复核确认：既有field travel `F_e=(1-exp(-1.35D))/1.35`、固定lag速度/lag derivative界对.88仍有效，未见数学阻塞。其physics生命周期检查另有独立7/7；本报告不代替该证据，也不执行GPU。

这只完成新source/包围接线与CPU范围验证。更长尾迹的屏幕面积与adaptive kernel工作会增加，固定阶段的源烟完整请求、主/镜真实光路、HDR/SDR图像、连续运动、原生整帧性能与最终照片感仍需root实际验收。N10支持矩阵或N8单相位1600行均不能当整寿命、多人多发或GPU帧率证明。
