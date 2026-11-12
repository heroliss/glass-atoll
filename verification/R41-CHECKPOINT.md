# R41：可选完整烟尘预检 pilot，默认关闭

最终 `main.js` SHA256 **9b59c9266109470c4d6f58b089faf3bc5c118d89deb6d5f9d0da8edc0d1ee4a4**；新增纯计数模块 `smoke-joint-work.js` **ce5ad695378c3d956a95120a12920ed9a00b2344088bb7f774dc6cf28ba22894**。FW 使用此前审查的 prepared-view / discard 接口；本笔记不更改 README 或 PROGRESS。

后端只增加显式 complete-request 上限12m的能力，未更改默认预算。main 的 pilot 默认 **false**，普通路径仍为 **4m / 每map1m / 8maps**；在健康、暂停、无烟花及烟尘的独占场景中，明确启用 pilot 才选择 **12m / 每map1m / 16maps**。纯计数结果本身没有原件所有权、GPU完成或发布资格，不能当作硬件成功。

pilot 在首次 SH prepare 前建立同帧计划：两眼原始 prepared source views、当前 density epoch 和一次完整 ledger；预算通过后 SH 使用同一 ledger。真实 world pass 前检查实际 host stamp、clear counter、live header/profile/ordered layout、两眼 FW handle 和精确预测 optics；callback 在 cloud/volume 之前再次核对本眼。main 本次 focus 与 mirror 旧 currentOptics 的真实时序保持，未放宽 FW 的 focus/matrix guard。

公共 snapshot 每次返回副本，source adapter 保留该帧副本，但每次读取先验证真实 host epoch，不能用冻结 adapter 掩盖同时间 clear。packet数为0时 source medium为空，不额外提交中性 T。SH 检查绑定 cached ledger identity/version/time 及 resolved field 的 version、ledgerVersion、packetCount、sourceCount；光学与 ledger generation、requested 与 committed clock 仍各自保留。

过期 pending 只允许在任何 world pass前重新 photometry 一次。实际 dispatch 失败不重试，不回到大批 CPU columns，也不借用旧 T；先 latch 原因和暂停，再尝试禁用 SH，清理异常只记 cleanupError。fault 的恢复合同明确为 **reload-required**。所有未消费 handle 在拒绝、缓存跳过、main-only截图、异常和结束时释放。main-only 状态以 requestedViews 标明只实际消费main，不称完整三任务已执行。

独立小型 CPU helper 检查 **6/6**：`r41-main-pilot-independent-check.{mjs,json}`，报告 SHA256 **aa93ab9a3a4e3ad717b263fd428a6f23a3b8ffae4c33d901789c8c3ba5dd27bb**。它提取实际 main helper，使用小型 injected stubs，覆盖 default-off water→lens、同时间clear失效、world前仅一次重建、SH/ledger不匹配、disable SH抛异常仍保留原错误、dispatch失败不重试及 handle释放。**这是 mock helpers CPU 证明，不是 GPU、真实 dense 场景或性能证明。**

验证脚本最初 extractor 语法错误（未执行任何 helper）以及4/6的 mock遗漏scene已分别保留于 `baselines/r41-peer-harness-before-extractor-syntax-fix/`、`baselines/r41-peer-harness-before-scene-stub-fix/`，没有修改生产来满足这些测试。

root 已完成真实浏览器空场景流程：`r41-empty-pilot-mainonly.json` 的 enable 为 true，截图 last.complete 为 true，只请求并消费 main；`r41-empty-pilot-fullscene.json` 在原生1209×1292暂停帧请求并消费 reflection、main，last.complete 为 true；`r41-empty-pilot-disabled.json` 成功关闭并恢复4m / 8maps。三份原始证据均无 fault、GL errors为空。该场景 packet/source均为0，数值工作为0、T prepares为0且未分配T资源，因此只验证空场景接线与释放，不是 dense 数值或FPS测量。

R40 的固定数值门通过及本次空场景流程，均不等于新正常帧 pilot 已完成 dense 验收。R42 下一步应使用真实 dense 完整帧 pilot，核对实际三消费者、阶段成本与 physical/wall clock漂移；当前不能声称性能改善、60FPS或照片级视觉目标已经达成。
