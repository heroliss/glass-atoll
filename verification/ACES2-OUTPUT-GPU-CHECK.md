# 可选ACES2输出模块：独立实际GPU夹具

入口：[aces2-output-gpu-check.js](aces2-output-gpu-check.js)，仅新增QA，不改`aces2-output.js`、vendor、main、lens或生产默认。调用方必须先暂停并独占原renderer，例如放在root既有`qaRenderLock`入口中：

```js
const [{runACES2OutputGPUCheck}, {createACES2Output}] = await Promise.all([
  import('./verification/aces2-output-gpu-check.js'),
  import('./aces2-output.js')
]);
return runACES2OutputGPUCheck(THREE, renderer, {createOutput:createACES2Output});
```

实际只调用factory的`prepareTarget/render`，不复制颜色shader作替身。无新canvas、主canvas绘制/resize、WebGPU或Windows显示变更。owned输入/输出均通过调用者Three初始化；颜色输出只到独立samples0 RGBA32F RT。

## 固定门

- 三目标100/700/1270各先经历模块实际17个anchor准入，再通过公开render跑原963个Float32样本。独立期望直接来自原OCIO2.6 CPU二进制/JSON，input/expected各核SHA，不改原数据。五family逐组及全部963门均保留`2e-5 + 2e-4*abs(expected)`工程阈值，另报原`2e-5`绝对诊断，不能借工程门自称官方认证。
- 黑色必须精确0、alpha1、padding黑，极暗蓝要非零且蓝通道主导，避免绝对容差把错误全黑误判通过。
- 同Float32数据P±8与逆向曝光要求全RGBA逐值bit-exact；曝光2须等于显式输入×2，曝光0须黑。单位×100与×Float32(100/280)、一次sRGB OETF按旧独立门隔离验证，不把原CPU/GPU算法误差再算成单位误差。
- 借GL draw时只读检查真实3samplers、input handle、两张NEAREST/CLAMP/level0数值表、实际samples0 RGBA32F附件。函数/表/manifest哈希还由生产模块准入检查。变体是明确的accurate-atan非官方数值修正，不能把该shader称官方原字节。
- caller RT、非默认viewport/scissor、mask、samplers、PACK/UNPACK/PBO、caps等脏状态下，分别核prepare/render/readback的逻辑及driver恢复。独立80×24 RT中仅绘物理rect`[5,3,64,16]`，矩形内应与基准bit-exact，外部sentinel不变。
- before-ready、feedback、NaN曝光、HDR写8bit、unsupported1200应拒绝。用真实fetcher延迟700、先完成1270，核pending去重和latest epoch；用仅内存破坏一字节资源的fetcher核SHA失败不发布。不是修改磁盘资源或给非法shader换一条成功fallback。

已知协议CPU12项另由module作者维护；本夹具没有强行破坏真实driver/compiler以伪造一次shader编译失败。三个正常目标的实际编译/link/anchor仍必须成功。原色/域策略、AP1 Range与输出Range的含义见[集成合同](plans/ACES2-OPTIONAL-INTEGRATION-CONTRACT.md)。

## 适用边界与运行状态

首轮由root实际执行130/134，修正夹具后第二轮实际137/137，详见末两节；未重跑本子任务中的GPU。保留两次报告及原helper，不覆盖失败。

当前DPR由真实renderer读取；本夹具不伪造DPR2、不通过setPixelRatio暗中重建主backbuffer。若需要实际DPR1/2配对，由root在外层可逆切换环境/小backbuffer后分别调用并保存报告。数值RT始终64×16物理像素，报告可用来比较同目标结果，但一份当前DPR报告不冒领另一DPR通过。

没有性能查询：64×16数值门、编译/网络和CPU读回不能称1080p成本或60fps证明。后续全分辨率性能应另做warmup、多个交错非disjoint GPU query及CPU submit统计，不拿一次query叫平均。这里也不验证HDR native copy、面板亮度、视觉色彩满意或全场景source/C/P正确性。

## 首轮130/134与夹具修正

[首轮真实报告](aces2-output-gpu-first.json)保留130/134，无hook或GL错误，DPR1、canvas1280×720。三目标17锚点、完整963×3五family工程门、曝光/单位/OETF/P±8、逐prepare/render/readback状态均通过；四失败为三目标viewport外sentinel和最后整体恢复的`GL.textureBindings2D`。raw最大绝对误差分别约3.93e−6、2.96e−5、6.68e−5，属于原工程相对门通过，不冒称所有扩展样本也通过原2e−5绝对诊断。

首helper原字节保存于[before-fixture-fix](baselines/aces2-output-gpu-before-fixture-fix.js)，SHA256`f1ad918a35d9382f03127a863ca78f57c1b30ad02c1bae7c7d93e5796291bf72`。没有删除失败或放宽任何原门。

1. **清除precondition错误已由源码和primary规范确认。** 夹具先启用RASTERIZER_DISCARD作脏状态，`clearOwned`却只临时禁SCISSOR；[Khronos ES3 glEnable参考](https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glEnable.xhtml)明确该模式也会忽略Clear/ClearBuffer*。因此原sentinel初始化不成立。`.125/.25/.5/.75`本身均可由Float32精确表达，不是需要放宽容差的舍入问题。第二版只在夹具清除期间禁discard并恢复，生产模块保持原样；新增每目标的整幅初始化exact读回门，之后仍要求outside exact不变和inside bit-exact。
2. **总恢复路径确有cache/物理slot不同步的缺口。** fixture/rawGL可以令实际ACTIVE_TEXTURE与Three缓存不同；仅`renderer.state.activeTexture/bindTexture`可能因为缓存相同而跳过原始GL调用。第二版在更新缓存的同时，对每slot强制实际`gl.activeTexture/gl.bindTexture`，最后active unit也强制恢复。保留原整体完整状态门，新增before-dispose/after-dispose/after-restore具体unit/token/live差异。首轮只有通用字段名，没有原unit值，所以不能事后伪造“首轮就是某一个unit”。

生产`aces2-output.js`保持`fa6f4e3336e5f00d1672d20a3ddeb50d7401dcaaded99f7ecbeeea4bf27b53e9`。上述修复提交时明确要求第二版真实重跑，未仅凭源码宣布成功；实际后续结果见下节。固定import仍可能缓存旧helper，未来修订也需reload/new tab或已接好的显式revision入口，不能只给factory query就误称运行了新夹具。

## 第二轮137/137：独立只读复核结果

[第二轮真实报告](aces2-output-gpu-second.json)SHA256`ea1846154a99f7a7bbb265c51a91ab03822a995e08c8e87794ab6cbf3fa13599`，实际GPU=true、137/137、hookErrors=[]、GL=[]、没有failure。独立比对两报告的gate名称集合：**原134项全部保留并通过，仅新增3个sentinel已初始化的前置门；没有移除原失败项或改误差门**。两报告的tolerance对象完全相同，三目标最大raw误差统计也与首轮一致，不把这个统计等同跨轮全像素比较。

| 目标nit | 独立CPU样本 | prepare实际锚点 | 最大raw绝对误差 | 最大工程预算比 |
|---:|---:|---:|---:|---:|
| 100 | 963 | 17 | 3.93391e−6 | .04129 |
| 700 | 963 | 17 | 2.95639e−5 | .07133 |
| 1270 | 963 | 17 | 6.67572e−5 | .23474 |

五family每目标均为450六hue、375作者profile、106黑灰白、10负/极端域、22 AP1边界，共963；它们沿用原CPU期望与原工程门。prepare三目标及race的新1270锚点logs均[]。P±8反补偿、一次曝光/OETF/单位、黑/低蓝、实际3sampler与RGBA32F等原门全部通过。经`100/280`单位转换的700/1270数值输出峰约2.5/4.53571、编码峰约1.49047/1.92586，说明独立浮点RT没有把>1提前截掉；这不是实际HDR屏幕测光。

三个新增preclear门均记录进入时discard=true、返回时仍true、整幅sentinel mismatch=[]。其后原viewport门insideBitExact=true、outsideSentinelUntouched=true。最终完整状态门changed=[]、textureBindings=[]、canvas和drawingBuffer均1280×720、DPR1，无resize。第二报告额外记录restore前unit0的原live texture未绑定，restore后差异清零，支持实际强制绑定的必要性；首轮没有unit明细，仍不声称由第二轮倒推出首轮唯一错误unit。

真实延迟fetcher的pending去重成立，新1270请求generation2实际锚点通过并生效，旧700 generation1返回stale、不发布。内存中污染资源一字节得到明确SHA256/length mismatch及validation-failed，effective为空，没有替换shader或退回另一个目标伪报成功。unsupported1200、反馈、异常输入及8bit承载扩展值的原拒绝门也保留通过；没有故意让driver编译非法shader来充作额外真实GPU覆盖。

**通过范围只到可选输出模块的数值与借用状态契约。** 实际为DPR1；DPR2外层环境未执行，不能把非零rect门改称双DPR认证。全部数值输入/输出为Float32，P±8逐值不变不证明生产HalfFloat中低亮下溢/量化也无损。performance=null，没有warmup/timer、完整输出分辨率成本、CPU submit或60fps数据。

该模块仍是默认未接入的optional候选，尚未接lens/main显示选择及native HDR拷贝桥；不借legacy桥已有能力冒称新DRT已穿过WebGPU/OS/屏幕验证。HDR/SDR实际场景同float master对照、FP16/桥误差、日景look、显示器切换/峰值fallback和最终视觉接受仍在后续集成门内。

复核时模块hash仍为上述`fa6f4e…`，第二helper为`878a426c79d9cf14ef6c71cc7f8beefd622f03e53a54d3ab021a306accb7e84b`；本次仅追加说明，没有修改runtime、vendor、helper、首/次原始报告，也没有重新运行GPU。
