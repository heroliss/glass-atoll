# HDR ACES2 的1282：独立单帧归因记录

只读复核 `aces2-hdr-gl-frame-first.json` 与 `aces2-hdr-gl-isolation-first.json`，未改追踪器或运行时。结论：本轮首次**新增**1282定位在 ACES2 输出完成后的 `drawBuffers` 恢复语句，不能继续归因于色彩shader、像素读回或WebGL→WebGPU拷贝。

## 实际调用证据

- 隔离报告同一固定700nit/paused条件：SDR legacy、HDR legacy错误均为空；HDR ACES2出现1282。program/VAO均live，program非delete-pending。
- trace包裹226个context方法，记录1351次应用调用、1356次原getError读取；方法描述符与observer均完整恢复。
- trace入口已有1282，单独标为`source:entry / seq0`。这不作为下一次操作的罪证。其后另一个实际新错误为`source:post-call / seq1326 / drawBuffers / main-frame / 1282`。
- 触发参数为长度8数组，短参数记录前6项均1029（BACK）。即使未打印末两项，**默认framebuffer恢复数组长度8本身已足以违反该目标的单buffer约束**，不需要臆测未记录的数据。
- 紧前seq1325是正常完成且无新增错误的`drawArrays(TRIANGLES,0,3)`；触发调用栈明确到`aces2-output.js:131:25`的finally恢复，随后才是`restoreGL`的seq1327 `bindFramebuffer(DRAW_FRAMEBUFFER,原offscreenFBO)`。
- 实际HDR调用链把`target:null`传入输出库；库的`beginDraw`绑定default DRAW framebuffer。finally先调用`drawBuffers(savedList)`，再恢复原offscreen FBO。因此seq1326确实仍在default目标上执行，不能把之后绑定的offscreen FBO当作它当时的目标。

旧恢复逻辑以MAX_DRAW_BUFFERS枚举目标状态，实际形成8槽BACK列表，而default输出只应记录/恢复一个有效draw-buffer入口。尾部trim NONE无法修正这组BACK返回值。这里需要根据**被恢复状态所属目标**决定枚举数量；tropical的最小修正为default目标只读1项，非default才读MAX_DRAW_BUFFERS。

[WebGL2多render-target接口规范](https://registry.khronos.org/webgl/specs/latest/2.0/)说明drawBuffers是目标上的绘制状态；[Chromium历史实现](https://chromium.googlesource.com/chromium/blink/+/master/Source/modules/webgl/WebGL2RenderingContextBase.cpp)也明确区分default单入口与FBO多附件。历史源码不是当前浏览器的精确错误码oracle；本机实际1282由上述逐操作trace直接记录。

## 为什么像素正确与错误标志同时存在

这次无效调用在有效draw之后；drawBuffers只设置后续绘制状态，不会倒改已经写出的canvas像素。故先前实际HDR拷贝8294400通道bitexact，与恢复步骤另报1282可以同时成立。最早怀疑的native interop gap现在没有必要作为该新增错误的解释：firstPostEntry1282已经在copy之前出现，且栈和具体无效参数都已定位。

trace完成了1920×1080、700nit目标、系统SDR白280、exposure1.52的真实native observer；`copyCompleted:true`。仍不能以这次追踪后的外层errors[]称为无错误：tracer消耗并登记了错误，还明确报告剩余虚拟flag1282。281.6ms包含逐调用探测/同步开销，也不是普通帧性能。

白昼图最大编码通道约.577，没有>1像素本来是合法的；此图只能检查实际值是否正确传递，不能强迫它承担HDR高光见证。后续>1门需真实明亮输入/场景单独满足，不应为过门增加I/C。

## 修复后仍需补的实际证据

原失败报告保持原样。本文件只证明归因与修正方向，**尚不替代修后验收**。root随后应在修后源重新执行：

1. cached100/700目标下同一真实单帧trace，entry/new-error/尾部及恢复均清楚记录；default恢复只含一个入口。
2. 不开tracer的实际native reader/外层错误检查，证实错误不再由探测器被消耗后隐藏。
3. 同样全图拷贝/F16比对与不同场景的必要>1见证；不把白昼无高光当作失败，也不把bitexact当成色彩观感或屏幕nit认证。

本轮只新增此说明。其他独立HDR校准、DRT数值门与视觉接受范围不因这处GL状态修复自动升级。
