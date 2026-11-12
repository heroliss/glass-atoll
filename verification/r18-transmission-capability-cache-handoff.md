# GPU source transmission：固定 context capabilities 缓存

候选生产源唯一改动文件：`pyro-smoke-transmission-gpu.js`。

- 当前SHA256：`2a35974fac7f6d75d6fa128fa04e869160d0ca40c9671569fe356bfef03ee294`。
- 修改前baseline：`verification/baselines/r18-transmission-before-capability-cache/pyro-smoke-transmission-gpu.js`，SHA256 `d6bc32aa8cf27e899bbf00ff9662dab335bc196a3a9ec5469500c9822202724b`。
- 同目录同时保存了修改前CPU fixture，便于还原原8例契约。

## 改动边界

每个field第一次面对同一个健康GL context时，惰性探测并缓存：`MAX_VERTEX_TEXTURE_IMAGE_UNITS`、`MAX_TEXTURE_SIZE`、`MAX_DRAW_BUFFERS`、`EXT_color_buffer_float`的支持结果。支持与不支持结果都缓存，避免不支持时每帧重复getExtension。构造函数不主动查询能力。

稳态每次prepare省 **3次getParameter + 1次getExtension**。首prepare仍查询这些值一次。没有据此宣称FPS提高；新context健康检查也有小量API成本，实际收益由root同场景GPU/CPU验收决定。

`preserve`的实际状态snapshot/restore主体逐字保持，缓存的drawBufferCount仅作为参数送入原循环。每次仍查询真实 `SCISSOR_BOX`、`READ_FRAMEBUFFER_BINDING`、`DRAW_FRAMEBUFFER_BINDING`、`READ_BUFFER`、每个 `DRAW_BUFFERi`，并保留实际scissor test、逻辑/物理viewport/scissor、target/face/mip、XR、shadow、autoClear恢复。默认FBO单BACK、独立READ selection及完整MRT修复继续保留。

输入pack、64-packet shader、reduce shader、XYZ三角形、RT分配/尺寸、active partial viewport、pairs/caps、raw T数值模型、读取反馈禁止、两pass顺序均未修改。能力缓存不更改既有admission/caps门。

## context失效

canvas `webglcontextlost`监听加prepare/绘制边界`isContextLost`检查，一旦观察到loss，或renderer返回不同context identity，旧field永久无效：`effective=false`、texture/target getter为空、prepare返回/抛出显式 `context-lost-or-replaced`，不会在恢复后重新使用旧capabilities/RT。应用本来要求contextloss后reload；也可由host dispose旧field并建立新factory重新准入。dispose移除listener。

同步绘制中发现loss时会走原finally恢复路径，并抛出；caller既有GPU失败回退CPU契约继续适用。没有对丢失context里的无效状态伪造“成功恢复”的GPU承诺，实际GL context-loss处理仍由host负责。

## CPU验证

`node verification/r16-smoke-active-partial-check.mjs` → **14/14**，结果同时写到：

- `verification/r18-transmission-capability-cache-check.json`
- 原active-partial/default-buffer报告路径（现schema明确标记R18）。

原8项source/viewport/default BACK8/READ selection/exception契约保留并按sealed baseline链复核。新增能力查询计数及失效用例：

- 3次prepare中固定查询计数为首轮3+1、后两轮0+0；8 draw-buffer场景中12项实际状态参数每轮完整查询。
- extension不支持、VTF=0、texture size不足，均只probe一次、0 draw、0 resources allocated。
- 首次已loss、两prepare间事件loss、首draw中loss、context identity改变，均不再暴露T、不重用旧field；恢复后继续失败，dispose移除监听。
- 旧/新actual factory 3种dispatch（含跨64 packet边界）逐个比较完整Float32 pack bytes、metadata、targets尺寸/viewports、内存/caps：一致。
- shader/geometry/RT资源ensure块及actual-state snapshot/restore主体逐字一致；没有新增shader loop/sample/target/pass。

仅CPU真实Three对象+无GPU renderer/state fixture；本agent未运行浏览器、GL或压力测试。root应在当前唯一真实renderer上继续原有tiny/cross-tile/状态恢复/光学准入门，然后同场景测量CPU与GPU帧耗时。
