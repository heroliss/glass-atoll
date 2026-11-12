# 辐亮度读回夹具状态修复（2026-10-27）

## 已确定的源码缺陷

旧`readRadianceRange()`只保存Three目标/viewport和READ/PACK部分状态，未保存实际CURRENT_PROGRAM、VAO、纹理/sampler等。finally先恢复RT并计算原有`stateRestored`，随后销毁仍绑定reducer的material。因此原`stateRestored:true`不足以说明调用方GL程序/资源状态无污染。

WebGL中仍被使用的程序可以处于delete-pending；后续raw过程切走使其真正删除，再试图恢复旧handle可报INVALID_OPERATION。最初源码审查仅指出它与`aces2-scene-day-first.json`中的prepare入口1282相容，未把推论冒称实测归因。下述真实trace现已复现并闭合此错误链；首轮day报告仍保留，不将清空错误队列当修复，也不改ACES的clean-caller准入门。

## 最小QA修复

原文件逐字归档为[基线](baselines/radiance-range-before-driver-restore.js)，SHA256 `b16ed3eff32f4202d4d979829d5ffecfcb5e21ccd299cd6b76088e6338d6d41e`。

仅修改[读回夹具](radiance-range-gpu-check.js)，SHA256 `8627fc16c55329ad4398a9875160df55e9ed8dd9ee34d9d45bd97b0e0c014e27`：先清理owned RT/material/geometry，再恢复调用方的live program、VAO/buffers、全部2D纹理/sampler slots/active texture、Three及物理RT/viewport/scissor、read/PACK/UNPACK及已触及的driver状态。纹理恢复同时更新Three cache并强制raw绑定，避免setter因缓存跳过。恢复比较现覆盖完整driver状态并输出`stateRestorationChanged`；不再在owned资源销毁前提前声称清理完成。

入口已有invalid/delete-pending程序时，在owned GL draw前明确拒绝。它不是本夹具可无损恢复的合法借用状态，需要调用方先正常重绘或reload；不尝试重用已失效handle。无新增错误drain。

Node语法/ESM导入通过，reducer vertex/common shader与归档逐字相同；IEEE分类、全覆盖reduction、low16/high16计数、所有数值oracle和原门限保持。真实trace结果见文末；完整range回归与native HDR呈现仍由root另行验收，不用这个窄trace替代。

## 实际复验应保留的门

1. 从live、非delete-pending的主场景程序进入，inspect后不靠额外场景draw修补状态；program/VAO/纹理/RT等与入口精确相等，errors空。
2. 立即执行独立ACES新target prepare，不插入一次“救场”重绘；原17-anchor/963门及clean-caller门不放宽。
3. 暂停时切换700→1270并完成实际HDR呈现，记录GL/WebGPU及program trace。自动显示器切换与手动固定峰分开记录，不能把前台窗口变化混成DRT颜色差。
4. 旧day首失败保留。若新trace仍报1282，继续按最早出现段定位，不把本次状态缺口修复直接当完整因果闭环。

## 因果trace入口

[radiance-restore-trace.js](radiance-restore-trace.js)，SHA256 `d17667d2a4b3537643652ce7e73714ad468e394ab28d865ee6ee745f8ef2db8b`：

```js
runRadianceRestoreTrace(THREE, renderer,
  water.reflection.texture, water.reflection.width, water.reflection.height,
  {useBaseline:true, createOutput:createACES2Output});
// 单独再调useBaseline:false；调用方持有qaRenderLock，并先正常画一帧。
```

不在reader与prepare100→700之间插入场景重绘。每次显式drain均有stage记录；短暂包装原`useProgram/getError`观察模块自己消费的错误，原调用恰执行一次、返回值不变。原程序句柄若delete-pending，随后实际restore该失效句柄、原getError读出1282且真实admission失败，才标记`causalReproduced`。它是“已复现归档错误链”的QA结果，不能混称corrected pass。新版须两个真实target admission ready、无新错误，才可标记`correctedPass`。

reader按实际源hash query导入，避免旧页面已缓存ESM被误叫成磁盘新版。finally清理owned output，恢复调用方完整状态和原方法descriptor。夹具不改main canvas、不创建device、不改baseline/ACES模块。

## 实际因果复现与修复门（已独立复核）

报告：[radiance-restore-trace-first.json](radiance-restore-trace-first.json)，SHA256 `0bb2fc6614d3c6c671266bd7d7fef4d5c879f93ea0a5d6085a4e84ed59f1307d`。同一个真实1920×1080反射纹理；reader源hash与冻结值一致，vertex/classifier相同。

**归档旧版5/5表示“预期错误链成功复现”，不是旧reader正确。** `causalReproduced:true`、`correctedPass:false`。实际entry错误空，调用方program id1 live、非delete-pending。读回完成后program变成id3，仍live但`deletePending:true`，VAO为null；此时显式after-range drain仍为空。prepare100随后真实使用新id4，恢复id3时wrapper观测到id3已`live:false`，`useProgram(id3)`未能切离id4；模块原有`getError()`接着读到1282，实际target admission返回`validation-failed / prepare GL-state restoration failed`。prepare700又对id4重复同链，第二次1282与admission失败均保留。

每次显式阶段drain为空**不等于没有错误**：这两个1282已被模块自身原`getError()`消费，并由透明wrapper逐条保留在`driverCalls`。wrapper没有增加该段getError调用，没有改返回值，也没有在reader与prepare之间补画场景。两次prepare的失效句柄、原getError结果和失败admission相互对应；不是依据最后空error队列倒推通过。

**修复版5/5才是corrected pass。** `correctedPass:true`、`causalReproduced:false`：读回后及100/700 prepare前后始终为原id1、live、非delete-pending，VAO保持live；无失效句柄restore、无原getError读到新错误。两个真实target均ready，17-anchor准入最大误差分别约1.55e−6/8.11e−6，沿用原absolute2e−5＋relative2e−4门。旧/新range的min/max与NaN/Inf/negative计数相同，只有新state比较实际覆盖完整driver。

两variant最后均`restoration.changed:[]`、errors空，返回原live id1与VAO，原GL方法descriptor恢复；root的between-variant外部读数也为错误空、live且非delete-pending。归档错误未污染下一corrected fixture。

这闭合了“QA读回清理→delete-pending→下一raw prepare恢复失效程序→1282”的真实因果链，支持修复落在QA清理而非ACES数学/module。它不代替完整range分类回归、1270重新准备、生产HDR桥全幅比较、颜色视觉或性能验收；本次ACES生产module字节保持原`fa6f4e33…`，未放宽任何错误门。

## R9追加：默认framebuffer的drawBuffers数量（第二个独立状态缺口）

上述8627修复通过program因果回归后，仍有另一个被真实主场景找到的QA缺口。[r9-radiance-default-buffer-trace.json](r9-radiance-default-buffer-trace.json)入口错误空、program live非delete-pending；首次post-entry1282精确在seq121的`drawBuffers`，参数是8个BACK，调用栈为本夹具`restoreDriver→restoreState→readRadianceRange→lens.inspectRadiance`。尾部program仍live/nonpending；因此不能再归为前一delete-pending问题。

默认framebuffer只能恢复一个DRAW_BUFFER0；该机查询其MAX_DRAW_BUFFERS槽位时返回多份BACK，照MRT数量恢复违反默认FB协议。离屏MRT仍需要保留MAX范围及原来的尾部NONE截去逻辑。

本轮原8627逐字封存[新基线](baselines/r9-radiance-before-default-draw-buffers.js)。当前reader SHA256 `81ad2550412c23522e2e86c92011cd42176f6b9025cce7e78c1787e15d622a85`，仅captureDriver一处数组长度改为`DRAW_FRAMEBUFFER_BINDING===null ? 1 : MAX_DRAW_BUFFERS`。任何shader、分类、数值/门限或其它清理行为均不改；逆转唯一表达式即完整原8627 bytes。不清flags伪造通过。

[定向CPU协议检查](r9-radiance-draw-buffers-check.json) **7/7**，直接执行原/新实际captureDriver函数：旧default8BACK复现不合法cardinality协议，新default1BACK；defaultNONE、离屏2MRT、稀疏MRT、满8slot及完整源码逆向byte seal均过。这是标明fake-GL的CPU协议，不是新增GPU通过。

最小实际GPU入口：[r9-radiance-default-buffer-gpu-check.js](r9-radiance-default-buffer-gpu-check.js)，SHA256 `5452528ab549dae66552ade3c2a7c1642daf326982a5b66f3b4924a65cf49a3a`，`runRadianceDefaultBufferGPUCheck(THREE,renderer)`。调用方暂停并持qaRenderLock；只用own13×9 Float32源与own2MRT，分别借default/离屏调用新reader，对独立CPU extrema/negative counts、全caller状态、实际draw-buffer数组、显式entry/exit错误做门。不draw/clear主canvas、不创建context/device/timer，finally恢复原caller。Nodecheck/导入已过，GPU与原同相位场景重跑由root执行后另存；本节不预填通过数。
