# R34 QA 换烟源宿主时丢失渲染模式：只读因果审查

初始证据为 `r34-logical-three-layer-plus1p70-state.json`。本阶段仅CPU读源码/已存JSON，没有GPU、浏览器、生产修改或亮度/预算调整。

源码链明确：

1. `main.js` 普通初始化的 `createPyroSmoke` 显式传 `projectionMode:'ellipsoid'` 和 `lightFieldBakeMode:'tiled64'`，并传4m完整请求/1m map/8maps预算。
2. QA-only `setSmokeReviewProfile` 要求无活动烟花/无剩余烟包，再构造新的production host；它传了新的物质源profile及4m/map预算，却没有传当前projection/bake模式。
3. `createPyroSmoke` 和 `createPyroSmokeRenderer` 的库默认是 `legacy-sphere` / `serial-reference`。新QA宿主因此重置两个渲染设置，而不是继承刚才宿主的有效设置。
4. `pyro-smoke-light-field.js.prepare` 明确区分两个算法的准入：tiled64采用 `maxRequestPairs ?? maxBakePairs`，serial-reference采用旧 `maxBakePairs`。只把4m字段传进串行构造，不能让串行核安全接受4m。

保存态精确对应此链：1051包、1728条完整发光ledger，乘积1,816,128；resolved requested=true、effective=false、reason=`pair-work-capacity`，模式serial-reference，旧maxBakePairs1,048,576，尽管diagnostic同时记录maxRequestPairs4,000,000。两个SourceT每眼1728源仍有效。**这不是普通生产渲染一直使用serial，也不是GPU场把某些光源静默截掉。** 失败是已显式报告的SH拒绝，后续renderer采用其原有fallback；是否视觉变暗另需同阶段对照。

最小源修复是仅在该QA新host构造中，从旧宿主 `diagnostics().rendering` 继承 `projectionMode` 与 `lightFieldBakeMode`，保留库默认及普通生产初始化不动。应保持现有前置空宿主检查、先构造/验证后替换/处置旧对象的顺序，不增加光度、物理、源profile或预算变更。不同QA profile本来会切换物质模型，这不授权它顺带切换独立渲染模式。

已有公用 `setSmokeLightingBakeMode('tiled64')` 只调用同一个host的volume mode setter，再重做photometry/SH与正常画面；它不构造新物理host、不推进时间。可在当前暂停+1.70阶段，用此既有入口作修复链的同物理状态证据。原始JSON应保留。对照必须严格核对time、完整state/质量账本、scheduler/各源身份和物质预约、活动event及完整源数/密度代数；field状态/版本、光学请求计数和因新有效光场重算的storage P等渲染元数据允许变化，但不得被包装成物理变化或绝对光度校准。

此前另一个 `r34-three-layer-bright-state.json` 的+.70图是24包，SH本就effective；其tiny/black现象不应被此新QA故障倒过来全部解释。相反，本1051包logical阶段需要先恢复完整SH后再评价受光外观，避免拿被拒绝的光照路径评价新物质模型。音效、所有参考cd、完整源/包数与安全预算保持独立。

root补丁及新同phase raw证据尚待独立复核；本笔记目前只证明上述源码因果，不声称修复已经实际执行或视觉通过。

## 后续独立核验（保留上段为最初审查时的历史状态）

`r34-qa-host-mode-motion-independent-audit.{mjs,json}` 当前7/7。当前main `c731e448fa23b2897ff8f4b811b724da3dac1a39d391f7484faa64eefe2ef922` 与归档旧328f的**整文件逐字逆变换**成立：只新增一次rendering读取与两个构造字段，普通初始化及受保护的water/sky/光度/物理/音频未变。

`r34-logical-same-phase-tiled-repair.json` 明确来自尚未reload的旧页面既有setter。其before/after完整1051包snapshot（全部profiles、packets、预约、风、质量账本、revision）、完整public state、全部source scheduler、FW活动events、cluster与时间严格相同；SH从serial容量拒绝变为tiled有效1,816,128pairs，3maps+1reduce。此结果不是尚未加载的源补丁直接产生。保存的两眼T均1728有效GPU/0CPU查询，但前后view sourceVersion1014/1013完全相同，故这份记录本身不证明setter后另行新绘了两眼。

随后`r34-logical-detail-setup.json`/最终detail保存态仍保持public物理state、质量、FW活动events/record数与cluster exact。全部scheduler只有顶层revision和activeCoverage[0].revision从98987变为106077；logical adapter源码每次install事务都会revision++，其余源身份/预约/质量/闭合时间均相同。这里不称“最终detail scheduler整体exact”。setup记录完整快照不变的页内布尔断言；最终detail未另存完整packet数组，独立证明范围相应限定。

setup与稍后final camera X/Z有各一ULP原始观测差异：37.44833494943836→37.44833494943837，46.40076864322566→46.40076864322565。最初6/7报告因本审查错误要求这两次机位观测exact而失败，保留于`r34-qa-host-mode-motion-independent-audit-before-camera-observation-fix.json`；最终报告原样公开差异，不将其容差归一，也未放宽任何物理快照比较。final主眼1728源GPU有效、0CPU查询；final镜面眼0源/0instances、no-active-source-rays、mediumQueries0，不能叫“两眼GPU”，其diagnostic backend字符串cpu也不代表真实CPU光学回退。

新源码实际reload的证据单独见`r34-profile-mode-reload-live.json`：捕获的方法SHA177b690f…与当前源码提取方法完全相同，空宿主初始→logical-all→production三段均ellipsoid/tiled64，回程0包、GL健康。它证明已加载补丁的QA模式继承，而不是被混入上面的旧runtime恢复。

另`r34-user-restoration-check.{mjs,json}` 29/29严格相同、runtime5/5，无语义例外：全部参数、镜头/夜晚UI意图、相机/target、天文设置、灯光、烟花设置、分类和body交互恢复；自动1270/设备DISPLAY6保持，原始保存证据与批准音频未改，console0errors/0warnings。物理phase56.86429999996713→69.38960000000888是reload/正常运行历史，未宣称回退波浪/云朵/时间缓冲历史，也未测物理nits或完成视觉验收。
