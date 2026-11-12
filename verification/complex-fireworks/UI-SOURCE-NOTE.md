# 大型编排 UI 接线

仅修改 index.html、ui.js、ui-quick-experience.js；原件和 SHA256 清单保存在 ui-before/。未修改 CSS、main、物理、渲染或声音。

- 快捷区与详细设置各新增“大型编排”分组，十个 ID 和中文标签由当前定义合同固定；所有旧选项与实验 profile 保留，初始类型仍为牡丹。
- 快捷映射以真实 FIREWORK_TYPES 中 collection=large-choreographed 的条目建立 identity 映射。总类型数/自动随机提示读 FIREWORK_TYPES.length。
- 两处说明读取当前定义的 label/height/burn/description；新样式标明创作参考高度或近地顶点、编排秒数，不声称实物测光。返回旧样式或实验 profile 时隐藏并清空大型编排说明。
- 全部选择复用原 submitFireworks；非 chrysanthemum 选择回到 legacy profile，保留当前共享状态、请求序号和失败回退。选择本身不发射、不改声音、不移动镜头。
- 新 CPU 检查 ui-check.mjs 使用实际 quick 模块与 UI update/submit/type-change 函数、真实定义及注册表；DOM/回调使用小型替身。它不验证 GPU、真实布局、烟花画面、音效、并发容量或 FPS。

实际20类注册表合并后，首版7/7检查已通过，保存在 ui-before-firelight-aa/。新增镜头 firelightAA=true、重置默认、复选框事件与 syncLens 同步后，最终 ui-check.json 为9/9。该开关只提交 onLensChange，UI 不改分辨率、焦距、物理尺寸或渲染算法。新复选框及说明位于镜头设置抗锯齿区域。

这只完成界面/回调CPU验证，不是完整烟花画面或性能验收。

最终说明文字调整：静态 HTML 与动态 light-smoke 提示均去掉18团/8.5秒的普遍化表述，改为简化烟团与持久烟的视觉/开销差别。前版源和通过报告保存在 before-smoke-copy/，未修改烟雾行为。最终语法与回归结果见 STATUS.md。
