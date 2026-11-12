# R39：密集烟花 GPU 路径的下一步（只读方案）

**推荐先走方案A：沿用现有精确 tiled64，补三消费者的整帧准入，再对一个真实密集快照逐级校准。** 不直接把日常上限改大。方案B的有界稀疏层级值得后续研究，但其 GPU/SH/实际密集场景证据尚不足以成为最小修复。此轮只读源码/旧报告及做常数规模调度算术；无新基准、CPU场景回放、GPU、浏览器或生产改动。

## 现在真正阻塞在哪里

1. `pyro-smoke-transmission-pack.js:3–17`：显式 `maxRequestPairs` 最高4m；`count*packets` 超限在 SPD packing/context 前返回 `pair-work-capacity`。`pyro-smoke-transmission-gpu.js:48–53` 已有完整原64项分块及一次最终归约，**不是尚未搬到GPU**。
2. `fireworks.js:699–721`：同步 `prepare` ineffective/抛错/Promise 均不能产生可消费T；随后每个 luminous row执行原 CPU medium query。保存的两发案例是每眼3112次、两眼6224次调用；这是调用路由，**不是每次都遍历全部烟包**，既有 CPU BVH仍有效。
3. `pyro-smoke-light-tiles.js:10–23` / `pyro-smoke-light-field.js:63–73`：tiled64也有4m显式门。SH超限不是偷偷在CPU做完整SH；resolved场失效，渲染退到现有少量 local lights/legacy clusters，光照变粗。serial-reference另受旧maxBakePairs约束。
4. 当前每图像默认1m保守64-slot/map、最多8 maps。partial容量由完整request预算证明；只删4m检查既没证明空间，也没解决map数量。T固定partial80,500逻辑格，SH66,596；数值GPU存储分别2,707,456B与3,919,872B，共6,627,328B（不含整场景/driver/JS）。见 `smoke-transmission-layout.js:26–47`、`pyro-smoke-light-tiles.js:15–35`。
5. 当前没有生产整帧总工作 governor。SH可在完全相同density/ledger key下跨两眼共享一次；不同main/mirror original-double rays不能共用T。物理或ledger更新后应fresh，不能用 `reused:true` 缓存消除真实演化成本。

## 已有证据给出的尺度

| 保存的工作 | 范围/结果 | 不能外推之处 |
|---|---|---|
| R29 source峰 | 2,256,632 pairs；5 draws；单次GPU1.912832ms | 仅一个固定T请求，非镜像/整帧 |
| R29 SH峰 | 3,242,109 pairs；6 draws；1.584128ms | 固定SH数值任务，无烟volume fill |
| R29同代joint | T1,966,718 + SH3,231,198；10 draws；3.093504ms | 该历史相机mirror=0，非三消费者完整帧 |
| R29实际相机两发CPU记录 | P3364、每眼T3112、SH3101；31,369,300不同核pairs | 20Hz抽样、旧profile/epoch，未做该密度GPU计时，不能当当前radiant全寿命上界 |
| R36 logical演化 | GPU均值29.145ms，观察21.135FPS；持续排烟/volume fill仍在增长 | 非受控A/B，已显示不能忽略全景和累计填充 |
| R37普通烟native | P24；GPU均值22.420ms、30.013FPS；光度CPU内部均值12.973ms | default普通烟已受CPU/全景约束；扩大dense GPU预算不是60FPS修复 |

R29两发峰的每眼T为10,468,768 pairs，SH为10,431,764；三路总31,369,300。既有矩形planner在1m保守slot/map下实际得：T每眼164,936格/10,555,904 slots/12maps+reduce；SH164,836格/10,549,504 slots/12maps+reduce。**合计39数值draw、31,661,312保守slots、824,380次partial texture读取**（T两眼各1纹理，SH三纹理），还没计volume、opaque/reflection、HDR/lens、上传和CPU组装。不能把“每map≤1m”写成“整帧≤1m”。

## 两个选项

| | A：原精确内核 + 完整epoch预算/校准（推荐） | B：有误差证明的稀疏相互作用GPU |
|---|---|---|
| 数值语义 | 保留全部packet/source、原64项顺序和最终归约；不改T/SH模型 | 物理packet/source仍全保留，但只省略有累积误差上界的数值影响；不是逐位相同 |
| 能复用 | 生产packer/layout/rectangle/核、R29严格runner、R31整帧guard | 生产CPU columns BVH/refit、R24有限域上界/独立oracle |
| 新工作 | 三消费者共同preflight/reservation、精确较大容量证明、固定native任务和完整演化帧校准 | GPU节点/索引表/可变列表、原顺序scatter、T误差累计；另做SH非负C0/有符号C1上界与Float32证明 |
| 固有风险 | 运算总数不减少；host packing、提交/归约和fill仍增长 | dense inside/tangent/高度重叠时可能一个pair也省不了；构建/遍历本身收费，不能强剪来过预算 |
| 当前证据 | 核已经在真实单发/同代joint通过；新密度未准入 | R24仅小型合成CPU。修复过短射线/病态协方差低估；条件proxy≤65536仍非通用FP证书，无nativeGPU/SH结果 |

选择A是为了最少改变已验证算术，先修复**一个明确密度域**的CPU cliff，不代表凭空增加预算就完成性能目标。B若后续有效，可让同样总预算容纳更多事件；它不能作为A失败时自动切换的无证据后门。WebGPU迁移目前也没有证据能消除相同31m工作及填充，不作为第三个同时实施的改动。

## 方案A的最小实施边界

1. **先整体计数，后任何新GPU任务。** 从同一已提交density snapshot、current luminous ledger、同快门光学行得到main/mirror的完整有界计数/源身份；精确保留各眼真实rays/cameraKey。当前live SourceT在water/lens内部才填行，SH则更早准备，因此需一个很小的FW只准备计数/视图输入接口，或经证明覆盖所有裁剪结果的上界。不能把ledger.count当 optical count；R36/R37两者已不同。禁止用现有verification fake-ack `FW.render`充当生产preflight再重复fill。
2. **一次预算预留三消费者。** 用R24 joint planner的工作向量/ownership契约作参考，换成当前原矩形planner；分别记T pairs、SH pairs、保守slots、归约3纹理读取、draws、上传字节、数值存储、两眼烟proxy像素上界及CPU准备。SH同代只收费一次，T不跨眼共享。字段齐全/整体准入后才开始；失败不发布新半张场、不冒充effective、不转进大批同步CPU查询。
3. **容量只作为测量候选。** 例如显式12m完整request足以容纳上述10.47m固定快照；当前8map必须改为另经证明的值（该快照需12，不能写8）。保持每map1m、原64循环和最终reduce不变。按现有紧凑上界公式，12m全构造域的数值存储为T4,706,304B+SH9,916,416B=14,622,720B；这是公式结果，**未获GPU/分配准入**，不是VRAM测量。需重证所有正packet计数、尾行、zero/shrink、故障后旧key、公开默认/legacy语义；不能仅修三个literal。
4. **继续排放与边界不能靠当下一个count。** 发射仍可能在之后变亮、长尾延迟、烟包持续增加至4096且已有合并、相机改变两眼裁剪。R29两发已有82个抽样点/路>4m，最终4096P/大量merge；31.37m不是连续上界，更不是新radiant/N16/多发上界。进入一个live支持域前必须有该配置/在途发射的全寿命保守工作包络及逐帧重算reservation；设置/新发射使包络无效时要先作明确准入决策。拒绝新任务只是保护边界，不是完成用户要求；已活跃内容不能悄悄删烟/删镜像/降灯来凑数。
5. **固定工作量和GPU时间不是同一门。** count/byte/draw上限可在提交前强制；timer是回顾值，不能撤回同步已排队maps。若全部当前精确工作超所选总预算，单纯chunk不可能同时交付同一新帧且保持预算。此时应继续算法优化/重新校准硬件预算，或明确引入完整epoch延迟策略；不能把旧T/旧SH贴到新源/新深度。

## 下一次最小实际门（另待 root 授权）

- 只冻结**一个当前代码、当前profile、真实两发、两眼非空**的CPU重建快照及全源/烟/时序；选择真实超4m点，不靠合成增count，先保存全输入和离线所有T/SH参考。R29旧计数是发现cliff的证据，不直接冒充当前新fixture。没有理由重跑一串tiny基础门。
- 复用 `r29-native-calibration-runtime.js` 的source+cached-function pins、before-await私有拷贝、PACK/UNPACK/PBO/COPY_READ/READ/DRAW/MRT状态、只一次prepare/consumer、所有有效输出与≤8partial/核、T现有1e-5和SH有符号C1 .002门。分别root单次T及SH后，再做同代main+mirror+一次SH；每次明确draw/read/byte预算，健康结果后才下一项，失败不自动重试。
- 上述39draw完整joint仅是已知旧计数推得的候选上界，不在本方案中授权提交。沿用原数值任务25ms回顾门，若新硬件任务需要别的门，必须在运行前另立、说明依据，失败后不抬门。不能用1.9ms/million直接线性预测31m。
- 数值joint通过后，还必须复用R31的**一次fresh正常场景**事务，保留当前真实分辨率、projection/MSAA/HDR路径、volume/reflection填充及SH fresh+1、各眼T版本即时消费、0CPU fallback；整帧门沿用当时明确声明的100ms安全上限，16.7/33.3ms只作推荐/高级参考，不能100ms通过就声称性能好。再做短的当前演化段及持续排放包络，记录物理/墙钟漂移；不拿冻结缓存FPS做结论。

异步跨帧是B以外的**延迟合同变化**：须拥有整个immutable epoch、主/镜深度/曝光/场景也一致、最多一个pending、原图完整展示，不能只回传pending而触发现有CPU fallback；不断继续排放/移动镜头可能使取消重来饥饿。它比本次精确同步路线更大，暂不选。

## 核对指纹与复用证据

- 当前不变数值链：T pack `8b52f7db…d3a2` / GPU `16d7546c…abcf2` / layout `79b76d3e…08a5` / rectangles `3080bdaf…8832`；SH field `6e37c2cc…ffa6c` / tiles `3840487a…e663`。
- 当前FW `03fdb703…d45c735` / main `08b43c65…0cbedf`。相关路由见 `fireworks.js:699–721`、`main.js:983,995,1351`，烟proxy/raster统计见 `pyro-smoke-renderer.js:173–213`。
- R24纯CPU joint planner `2e6ef329…b54a`（`verification/r24-joint-work-planner.js:89–132`），仅accounting模型、从未生产导入；旧1m请求合同不可原样冒充12m支持。稀疏helper `374e8f0d…81a4`，具体失败/修复历史见 `R24-SPARSE-SYNTHETIC-WITNESS-RESULT.md`。
- R29成熟runner `3535ebae…3896d`；source/light/joint实际收据分别 `e81d9057…bbb9` / `9a2db237…2302` / `137e5231…5e6d`。两发计数 `768b1f03…35a7`；fallback独立审计 `7516147e…8fe0`，不是GPU密集场景通过证明。
- R37当前native原始记录 `a7a2d091…2b93`。R36 logical演化 `d3ff02b8…1e57`。旧epoch证据不得重标成当前性能，计划本身也不宣称已移除生产CPU fallback。
