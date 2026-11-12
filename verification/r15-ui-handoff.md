# R15 界面整理交接

只修改 `index.html`、`style.css`、`ui.js`；没有渲染器、海水、物理、声音改动。源文件前态保留 `r15-ui-before-*`。

## 选择

海岛是主画面。默认左侧“选择机位”、右侧“场景设置”均收起；左侧展开为可滚动的8个真实场景缩略图。太阳/月亮动态机位仍保留在“全部机位”原生下拉框，自动环岛和周期也在该抽屉，切换不改时间/天气。图片路径 `assets/views/{shore,lagoon,aerial,sandbar,palm,reef,waterline,island}.webp`，由 root 实景制作；没有图片时隐藏故障图像并保留文字机位，不伪造缩略图。

右侧8类（海水、天气、时间、显示、灯光、烟花、镜头、操作），每次只展示一类。原画质预设及状态移到镜头类。投石/暂停/复位成为独立底部小条，不必打开设置。帧率条独立在角落，顶栏图表图标可隐藏。颜色延续奶白/青绿，夜晚沿用现有深色主题，不新增前端依赖和模糊层。

桌面两抽屉可同时开；600px及以下互斥。手机机位图片改2列以节省高度；画面操作条在底部。所有抽屉和性能条都受H隐藏；隐藏面板使用原生hidden，整套界面隐藏时设置inert，恢复时保留用户所选分类和抽屉状态。收起含焦点的抽屉先回到其入口；分类支持方向键、Home/End和roving tabindex；Escape收起两侧抽屉。系统reduce-motion保留。

## root 接口

保留全部旧callback/API。新增 public `ui.setPanel(open)`、`ui.setViews(open)`、`ui.setCategory(id)`、`ui.setHidden(hidden)`，不发渲染callback。分类id为 `sea/weather/time/lighting/lamps/fireworks/camera/navigation`。

`ui.setStats({fps,gpuMs,paused,status,renderScale,focusMetres})`，状态只合并实际提供字段。status`interrupted`显示“画面已中断”，暂停显示“— FPS / 已暂停”；初始未知FPS显示“— / 正在测量”。GPU毫秒非负时才显示，内部像素比例小于1时才显示。显示条不自行测量/推算FPS，main应提供实际已渲染帧窗口数据。`setPaused`立即更新暂停标记。按钮`#stats-toggle`改变`state.statsVisible`，初始显示。

## 实际已做的检查

- 原138个HTML id全部保留，0丢失、0重复；所有原input/select类型、min/max/step/value、disabled/checked、data-callback、select选项和默认值逐一精确保留。见 `r15-ui-control-inventory.json` 和 `r15-ui-check.json`。
- `r15-ui-check.mjs`7/7：现有控件完整性、8实际缩略图路径、8tab关联，执行实际分类/抽屉/隐藏/帧率函数的DOM微型依赖。不是浏览器布局验收。
- 旧质量22/22、隔离5/5复制测试通过，只写本轮 `r15-ui-quality-regression.json` / `r15-ui-isolation-regression.json`，不覆写旧报告。
- `node --check ui.js`通过。

root仍需：主计数接线、真实缩略图、原生浏览器控件/类别/焦点/手机/夜景、截图检查；完成后运行Impeccable detect并按实际问题修正。本代理未打开浏览器或调用GPU，不以这些检查宣称视觉/帧率验收完成。

父代理独立审查后补一条窄屏层级规则：展开抽屉z-index7，高于另一侧仍收起的入口z6，避免DOM较后的右入口遮挡左抽屉收起按钮；互斥逻辑不变。实际浏览器复验仍由root执行。

390×844原生复查后再补窄屏规则：body.views-expanded隐藏右侧collapsed设置入口，body.panel-expanded隐藏左侧collapsed机位入口；visibility:hidden将整个控件分支移出绘制、AX与正常Tab顺序，pointer-events:none禁止命中，transition:none避免visibility过渡延迟。只有CSS改动，可仅热加载CSS；桌面仍独立双抽屉。

检测器后的CSS可读性修整：加载提示改#3d6462，所有原10/11px的正文提示/参数值/机位标题辅助字提升12px，FPS单位与状态最低11px（手机不再9px）。面板柔和偏移阴影改中性黑，保留相同偏移/模糊/透明度。未修改JS、API或控件尺寸；root继续实际响应式截图，检查文本换行。
