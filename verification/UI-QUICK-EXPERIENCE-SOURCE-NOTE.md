# 快捷体验模块

`ui-quick-experience.js` 只读取传入的既有 state，复用 submitFireworks、invoke、togglePause、openSettings；私有值仅记录按钮 busy 和组合请求序号，不复制场景状态。

- `initQuickExperience(...)` 返回 `syncFireworks/clearShowcase/setShowcase`。root 负责旧 UI 更新末尾同步以及手动调整后的组合标记清除。
- `type:smiley/comet` 对应生产 `ring/fan`，其余十种类型与三个快捷实验 profile 闭合。深层其他 profile 不假装普通菊，下拉不选并显示说明。
- 自动启动复用既有 legacy 归一化，并在原 state.paused 时恢复播放；停止只调用既有回调，不清烟、不取消空中事件。
- 组合直接 await onShowcase，成功后标“已应用”。错误/过期结果不标成功；四按钮 busy 均在 finally 解除。组合不发射、不启用声音，相机与主请求序号由 main 回调负责。
- root 应把 syncFireworks 的真实 active/queued 写入 state.fireworks，模块才显示这些数字；未知数量不补造0。

该文件通过语法检查；`ui-quick-experience-check.{mjs,json}` 的小型 DOM/callback stub 检查5/5，覆盖选择别名、busy前捕获选择、自动恢复/停止、异常解锁、组合成功/过期/失败以及深层其他profile。它不是浏览器、GPU或真实场景交互验收。没有修改既有生产文件或音效。
