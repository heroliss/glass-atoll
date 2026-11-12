# 现行界面回归检查刷新

2026-10-31。只修改测试与证据，未修改生产界面或交互逻辑。

旧 `r15-ui-check.mjs/json` 已原样保留于 [before/r15-ui-check.mjs](before/r15-ui-check.mjs) 和 [before/r15-ui-check.json](before/r15-ui-check.json)。旧报告是 5/7；它仍要求存在 UI-r2 已按产品需求移除的显著投石按钮、以及 R15 时期逐字不变的机位选项。继续检查还发现其固定合同落后于已实施的新增烟花、亮度步进和默认轻量烟策略。

更新后的检查保留所有其余 137 个 R15 DOM ID、原有控件的类型/范围/默认值/回调，以及全部旧选项；仅为以下现行合同设置明确迁移：

- `drop-stone` 已由场景内按住左键蓄力/松开投石及 Enter 快投替代，见 [UI-r2记录](../ui-r2/REPORT.md)。新检查实际执行从 `main.js` 提取的事件注册，覆盖半蓄力、满蓄力上限、拖动取消、pointercancel、窗口失焦、隐藏页面、非主指针/右键忽略和 Enter 默认行为拦截。
- 原十个机位均保留，增加 fireworks、fireworks-close、stars。新检查实际执行 `setView`，覆盖全部13项的 state、下拉框、文字及各卡片 aria-pressed 同步，并确认未知项不会改变选择。
- 原十种烟花均保留，新增大型编排；下拉选项必须与生产 `FIREWORK_TYPES` 完整一致，见 [复杂烟花验收](../complex-fireworks/ACCEPTANCE.md)。
- 当前亮度界面范围为 0.1–32、步进0.1、默认1；其他原属性继续逐项核对。该UI检查不宣称关闭了底层0×调试能力。
- 长期体积烟默认关闭，推荐轻量短烟，见 UI-r2 的明确取舍。

`node verification/r15-ui-check.mjs` 退出0，现行 [r15-ui-check.json](../r15-ui-check.json) 为 **9/9**。原有分类、抽屉、焦点/隐藏界面、FPS格式化五项继续保留。检查使用实际抽取的处理函数和小型依赖桩；它不代表真实浏览器布局、GPU、触屏或帧率验收。
