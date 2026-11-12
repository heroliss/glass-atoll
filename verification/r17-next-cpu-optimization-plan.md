# R17：最终两发 profile 的下一轮最小 CPU 优化方案

只读分析，2026-10-29。没有修改 FW、physics、GPU factory 或其他运行文件，没有执行 GPU/新压力测试。FW作者提供了独立源码交叉审查。

## 1. 本次证据边界

`r17-final-two-gpu-benchmark.json`：有效冻结快照 time45.3040，48烟包，主/镜各3456源，GPU透射有效、CPU mediumQueries均0，106帧/3.0443秒，34.819FPS，CPU median25ms，外层GPU median20.435ms，workload.interrupted=false。

这不是正常运动性能，也不能与time79.6972的较早三窗口作因果速度比较。下面依据本次源码与profile选候选，仍需在相同输入上重新测量各候选的收益。

`r17-final-two-gpu-cpu-profile-summary.json` 明确分析前 **3100.686ms**。原始profile总长约3456.8ms，不能把后约356ms一并相加。我以相同前缀边界逐sample累计，结果匹配summary：

| self / native stack occupancy | 前缀时间 | 解释 |
|---|---:|---|
| flightSegment：FW自己的采样栈 | 362.167ms | frame→FW.update→updateRecords→sampleBody→flightSegment |
| flightSegment：先构造particles的栈 | 23.094ms | frame→FW.update→updateRecords→simulation.particles→sampleFireworkEvent→sampleBody→flightSegment |
| 两处fillRecords self | 242.4+226.8ms | 主视图/镜像，各自裁剪、排序、填充、快门权重；不含子调用self |
| 全部getParameter self合计 | 527.385ms | 约17%采样窗口；多个安全状态保存器重复查询 |
| packSmokeTransmissionInputs两栈self | 约30.9+25.4ms | 已退出首要热点，不能继续沿旧pack归因 |

这些是采样窗口内CPU/驱动栈占用，不是纯函数基准，也不是独立GPU kernel时长。

## 2. 第一候选：移除真正被丢弃的运动学采样

源码路径：`fireworks.js:433–450`。

1. `updateRecords()` 先执行 `simulation.particles().filter(p=>p.kind==='smoke')`。
2. `simulation.particles()` 进入 `sampleFireworkEvent`，先为rocket与所有有效head调用sampleBody、构造粒子和envelope。
3. filter把这些head/rocket记录丢掉；FW随后再次循环这些body，生成自己的head和detached tail。

**最小改法**：给原particles/sampleFireworkEvent增加显式smoke-only/heads=false路径，旧默认API完全保留；FW仅请求其实际消费的legacy smoke。保留resolveBurst、烟粒子RNG与烟结果原式，不跳过必要事件/历史更新。heads循环本身无RNG/事件提交副作用，可避免这批注定被丢弃的sampleBody与对象构造。

这是正常运动每帧都存在的重复工作，不依赖冻结时间缓存。不能顺便删除legacy smoke，因为它仍可能被诊断、radiance bound与旧API消费；只能减少不被本调用消费的head采样。

验收：原particles默认输出、smoke-only输出与原filter逐值相同；10种类型、起飞/爆前/爆后/燃尽/低于地面、分裂子体、变风、强度0/1/2、稀疏尾迹阶段；源ledger、烟质量、事件/声音、heads数量和source bound保持一致。

## 3. 第二候选：fillRecords精确减工作与去临时数组

### 3.1 镜像零快门：8次相同envelope变1次

`fireworks.render` 对reflection固定 `uShutter=0`；`fillRecords:560` 却为每条有body的记录调用8次bodyEmissionEnvelope。正常运动每帧、每条镜像记录都重复相同年龄。

最小改法：S===0时算一次原式envelope，复制到8个Float32槽；非零快门保持原路径。验证life起止、strobe边界、rocket C2 fade、signed zero与body缺失；8通道逐字节比较。不能把主视图非零快门也改成中心亮度，不能把颜色/快门物理积分改近似。

### 3.2 标量写入与复用scratch

`fillRecords:557–558` 为每个非smoke源构造`[0,0,0]`，为shape构造新的四元素数组。可直接把同样数值逐标量写入预分配Float32Array，保持原fround顺序；这在main与mirror都减少分配。`eligible.filter`、`ordered.push({p,z})`还有整批对象，但不应一轮同时重写所有排序结构。

先只改zeroLight与shape这两个准确、局部的分配源。随后若self/GC仍热，再用预分配记录/索引与z数组；排序必须保留原z比较和相同z时原输入次序，保守clip理由、ordered行序、gl_InstanceID、sourceVersion和T纹理行映射逐项一致。

**不能复用整个main fill给mirror**：两机位的深度排序、完整quad裁剪、shutter、DoF、water-hit origin、active rays和T均不同。可共享的是records-generation内不随视图变化的原始属性/同shutter权重；按各视图ordered indices再gather，仍保留独立main/mirror GPU prepare→立即draw。

## 4. 第三候选：共享解析阻力因子，不缓存陈旧姿态

`flightSegment:33–38` 对每次相同 `(drag,dt)` 重算 `exp(-drag*dt)`、`-expm1(-drag*dt)/drag`。同一event的root通常同birth/drag，各tail slot的born与ember lag在body间也共享。body的life/方向/强度不同，不妨碍阻力时间因子共享。

最小、安全方案：**一个同步updateRecords调用内有界exact-double factor cache**；key使用实际计算得到的drag与clamped dt，不量化时间，不以近似lag代替`now-born`；只缓存原式decay/travel，不缓存position/velocity或T。达到容量时退回原计算；每records generation清理/复用scratch，不能跨帧无限积累Map。

风力、初始位置/速度、gravity不影响这两个因子，因此不需要因为风变而复用旧pose。保留原完整位置/速度公式与加法顺序，尤其不能把小dt改成`1-exp`、把lag/duration代数约分或把gravity0分支简化成另一运算序列。低drag/非有限公共输入继续原分支和错误域。

更进一步的scalar flightSegment可保留新返回数组但消除acceleration/map闭包；若引入out参数必须明确借用寿命，不能让多条records共享随后被覆写的position数组。这比只共享数学因子扩大了改动面，作为后续独立候选。

### 过去轨迹和resolveBurst失效边界

- `sampleBody(parentBody, body.birth, timeline)` 是分裂子体的实际过去出生姿态。不可缓存一次后假定body对象永不变化：resolveBurst会替换root的position/velocity。
- 现update与particles各会调用resolveBurst；它每次以rocket在burstTime的真实风响应修正heads。**爆前预测**会随新风段改变，即使事件ID/rocket对象相同也必须更新。爆后新增风段虽通常不再影响过去爆点，也不能只按timeline数组身份判缓存。
- `wind-response.js` 已有按drag的checkpoint和prefix memo，append/prune通过length/first/last探测；旧segment原地编辑依赖显式invalidateWindResponse。新增pose memo若跨调用，要同时跟踪timeline mutation/prune/invalidate及resolveBurst birth-pose generation，不能只保存wind末值。
- 第一轮不做跨帧pose缓存。若以后需要，可先在所有resolveBurst完成后，为**单一同步只读采样阶段**创建body+exact time memo；该阶段无await/写风/改body，结束即失效。这样父体固定birth时刻的重复回查也能减少，正常运动仍有效。
- tail `born=now-lag` 每帧变化；同bodyId/tailIndex不代表同一个物质点/同一个端点，不能把旧tail状态或烟透射T按这个ID跨帧复用。

## 5. getParameter为何频繁：实际调用路径

同一3100.686ms前缀中，按native getParameter的直接调用者分解：

| 调用者 | self约ms | 原因 |
|---|---:|---|
| GPU source-T preserve，main+mirror | 168.511+25.651 | 每prepare都查询caps与保存SCISSOR、READ/DRAW FBO、所有drawBuffers；两视图独立准备 |
| sky.renderTransientClouds，mirror | 78.302 | 保存physical viewport/scissor，供临时反射delta恢复 |
| smoke light-field preserve | 61.334 | photometry→prepareLighting→field.bake，保存独立READ/DRAW等 |
| aerial.render | 57.525 | 保存实际scissor/viewport，避免DPR与target metadata混淆 |
| optical bloom captureTargetState | 55.353 | 保存scissor、READ FBO/readBuffer，之后执行5passes |
| pyro smoke volume render，main+mirror | 21.449+18.818 | 保存当前target与actual FBO/rectangles |
| reflection depth-copy save与copy | 21.619+18.058 | 独立READ/DRAW、源/目的samples/FBO完整性、depth blit |
| environment withRendererState | .765 | 少量face调度，不是当前主要项 |

查询用于之前真实出过问题的状态契约，不是无用装饰。相同GPU-T preserve的main与mirror耗时差很大，**不能把全部527ms都当成均匀、可删除的纯CPU算术**；驱动/IPC/前序GPU工作的等待可能体现在该native栈，本profile未分离这些机制。

### 第一步：只缓存固定context能力

GPU factory当前prepare中检查MAX_VERTEX_TEXTURE_IMAGE_UNITS/MAX_TEXTURE_SIZE，preserve又查MAX_DRAW_BUFFERS，并反复getExtension。这些在同一个有效context lifetime内固定，可在constructor/首次有效prepare缓存；已有错误原因、unsupported fallback、显式caps保持。

以原生MAX_DRAW_BUFFERS=8的例子，单prepare有约14次getParameter：2项caps +1项MAX_DRAW_BUFFERS +SCISSOR/READ/DRAW三项 +8个DRAW_BUFFER。固定能力缓存只减少其中3次，**不是清除全部14次**。确切调用次数仍应由有界实际trace确认。

context loss/restore必须使能力与资源generation失效；当前app遇到contextlost要求reload，不可凭相同gl对象重新使用旧能力/RT。scratch Vector4和数组可复用以降GC，但actual状态仍应按旧顺序捕获。

### 第二步：受控caller状态token，保留generic安全路径

只有第一步回归通过且后续profile仍显示状态成本高时，再考虑由host在同一同步view scope捕获一次可信pass-state token，供多个受控嵌套helper借用。默认API仍完整捕获；未知caller、失效token、跨异步/外部rawGL变更时回到generic路径。

token需覆盖context generation、logical target/face/mip、actual DRAW/READ FBO、每个drawBuffer、readBuffer、logical与physical viewport/scissor/test、RT metadata、XR/clear/shadow flags；PACK/PBO若被改动也必须由其所有者恢复。token不是从`renderer.getRenderTarget()`猜所有状态。

特别不能：

- 把READ与DRAW默认等同，或把source.samples当真实bound FBO的samples；MSAA renderbuffer/extension resolve和raw诊断可使其不同。
- 删MRT drawBuffers恢复，或把渲染target存储viewport当作当前physical viewport；DPR>1与临时subviewport已分别验收过。
- 用depth texture作为仍附着draw target的sampler；独立depth blit不能因性能被取消。
- 跨main/mirror复用上个T，或在prepare后其他draw覆写借用T，再去渲染旧geometry。

FBO完整性/format/sample检查可研究按RT allocation-generation缓存，事件dispose、resize、MSAA/attachment/type变动和context变动都必须失效。不要第一轮同时改depth-copy与所有pass-state函数。

## 6. 建议一轮只做一个的次序与验收

1. smoke-only采样路径；2. mirror零快门8→1；3. shape/zeroLight标量填充；4. bounded exact factor cache；5. context固定能力cache；6. 只有仍值得才做共享state token/更大数据布局。

每项先保留源baseline，跑有界CPU复放：原positions/velocities/record顺序、Float32属性bytes、temporal权重、ledger/cluster/radiance bound、烟源过去点与事件输出对比；风测试覆盖constant、append/prune、历史invalidate、爆前变风、爆后继续变风和crossette父子。连续时间按30/60/120Hz与同一物理时刻回查，不能仅测试dt=0。

随后root在一个健康renderer内按现有小gate顺序做main/mirror actual draw、MRT与READ/DRAW恢复、反射水面hit、近裁剪、GL错误与数值T检查。最后用同一physical snapshot/pose/output三窗或配对短测，并加短正常运动序列；观察CPU total、GC、函数self、queries数量与p95，禁止将不同物理时刻结果直接相减当收益。

所有候选不改实际烟量/寿命、星体数量、拖尾时长/曲线、发光RGB、快门长度、物理g/drag/wind或默认画质。冻结缓存另列，不能当正常运动60FPS证据。

## 源快照

| 文件 | SHA256 |
|---|---|
| fireworks-physics.js | fb6be290ea34ced9a36925c0ec24e2e3745c1108bded80d4a8aee0d72fe63236 |
| fireworks.js | 3fb39738c83705d77dd5b6c55db8d15f76fbba6ec4e24d17130a9e9a3de477fe |
| wind-response.js | dfa1ba96c3b8d5fb1d35853392874678c46200ad98ffb8b7306c91cbba71bca1 |
| pyro-smoke-transmission-gpu.js | ca1de3347567fb86bbbadf748eb4f16179dae1e773595f6de366fc0e7ce6dae3 |
| pyro-smoke-light-field.js | c0fc6b1f3218e43aafd7c6bf0efadd88ad10eb3bd3258269b352eef47b43550a |
| depth-copy.js | df73dd00d2fc5a99ae1376c2adc9eb627d3766b0e3c1216aeb81e0d3b268a622 |
| optical-bloom.js | 52508e641fda1aec9594444c583f2523f9285e7dfec67ca7a25fa0157a2b9601 |
