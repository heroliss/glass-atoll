# 渲染 benchmark：中断协议

`render-benchmark.js`新增`cancel(reason='cancelled')`。活动任务首次取消返回`true`并立即结算原Promise；无活动任务或重复取消返回`false`。定时器随完成或取消清除，旧回调也不能结束后续任务。

正常结果追加`status:'completed'`、`validity:'valid'`、`reason:null`，原有统计字段保持。这里的valid仅表示本计时任务正常完成，不认证GPU样本、画面正确性或设备从中断恢复。

取消结果为`status:'cancelled'`、`validity:'invalid'`和调用方传入的reason；`averageFps:null`，不将中断期间的部分帧数输出成有效帧率。`final:null`且不调用终态snapshot，避免contextlost处理新增快照操作。其余部分统计及raw保留为无效诊断材料，不能作为性能接受证据。

主页面的持久interrupted状态、旧GL query废弃、停止帧循环、拒绝后续benchmark和要求reload由main负责；此模块本身不调用WebGL、不尝试恢复context。

## CPU证据

`node verification/render-benchmark-cancel-check.mjs`：**8/8**；`node --check render-benchmark.js`：exit0。执行的是实际模块源码，时钟、定时器和snapshot仅替换为确定性边界；未模拟GPU数值。

覆盖正常结果与原源全部历史字段逐项一致、主动取消、重复取消、取消前无帧、旧timeout不能干扰下一任务、完成后取消不改结果、并发start仍拒绝、时长限制及全部timer清理。

原源：`baselines/render-benchmark-before-interruption/render-benchmark.js`，SHA256 `37c315c0764013869ba446ba7579079f43c767adea092f37cda97f12cc9b2f7d`。

新源SHA256：`0a2bf5fe92ab322d044ced2a2fa1af66e635c27084d6325af9484d8128b6244e`。本CPU结果不替代真实contextlost及页面重载验收；历史`r8-default-day-benchmark.json`的中断场景不能因已有137fps数值而继续当作有效整场性能证明。
