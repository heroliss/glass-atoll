# 自动燃放控制

四个 owned UI 文件修改前保存在 before/ui-manifest.json；main、物理、渲染和音效由各自 owner 实现，本模块没有修改它们。

- 新 automatic-only 字段：randomIntervals、intervalMinSeconds、intervalMaxSeconds、randomLaunchTilt、automaticTiltMinDegrees、automaticTiltMaxDegrees。默认1–5秒、−40°到+40°；输入闭域为.35–30秒、−65°到+65°。固定 intervalSeconds、手动/固定 elevation、细微 launchSpread 与爆开图案随机仍保留。
- UI不交换最小/最大值。直接 await 现有 onFireworksChange，使主逻辑的原子拒绝可见；失败仅回滚本次编辑字段，连仍聚焦的数字输入也恢复。请求序号阻止旧失败覆盖新编辑，不回滚 active等实时诊断。
- quick-auto 只有提交成功才恢复暂停场景。快捷状态展示实际间隔范围、带符号倾角和0°竖直含义；并发上限读取同步 maxActive，不提交也不自行指定容量。
- 原有控件ID全部保留。原 UI r2 helper fixture/report另备份；只适配submit变成async并直接回调的测试环境，原场景断言不变。

ui-check.mjs使用实际UI函数/事件处理/quick模块与小型DOM及回调stubs，含拒绝、过期结果、当前状态同步、模式禁用和控件保存；它不是实际scheduler、浏览器布局、GPU或性能证明。
