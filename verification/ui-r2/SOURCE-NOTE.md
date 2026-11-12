# UI r2：时间、机位与烟花分别操作

用户新要求覆盖旧的组合预设与无文字投石条约定。四个 owned UI 文件修改前完整归档在 before/（含 SHA256 manifest）；没有编辑 main.js、渲染/物理或音效。

- 可见组合预设改成独立白昼/日落/月夜/星空。直接 await `onQuickTimePreset`，或 fallback `onTimePreset`；回调成功后由 main 通过 `ui.syncTime` 发布真实时钟，不调用相机、发射或声音。false/undefined/异常均不标成功。
- 时间、机位、详细设置、烟花操作可分别折叠。时间与烟花的 open 状态属于既有 UI state；收起时还原键盘焦点、更新 aria-expanded/hidden。烟花收起后暂停、重置与投石操作提示仍在 header/footer。窄屏短高度时互斥展开时间/烟花，避免争用画面。
- 新增 fireworks-close 机位卡与select选项；机位位置与朝向由 main 单独实现。相机变化不再清独立时间的选中状态。
- 移除显著投石按钮，只保留“按住左键蓄力，松开投石”；力度条显示“投石力度”和百分比。删除旧 show-case heading/status 与 drop-stone 三个ID为用户明确要求，所有详细设置原ID保留。
- 烟气 light/full/off 使用同一 submit 与主状态；默认 light。长期体积烟标高开销，说明其与18团短烟/约8.5秒的视觉取舍，未声称全模式流畅。旧 persistent checkbox 映射 full/off。

`check.mjs` 是真实 quick 模块与提取的实际 UI helpers 加小型 DOM/callback stubs，以及详细控件/ARIA 静态检查；不包含浏览器、GPU、实际布局或FPS验收。源码语法检查通过。样式改写脚本首次因注释冒号/分号锚点不同而在写文件前停止，失败记录另存；只修正验证脚本锚点。

沿用现有平面中性色界面、配色和字体；应用 design-taste-frontend 的应用界面分组/层级原则，未重做艺术方向。最终真实视觉和交互由 root 在同一浏览器验收。
