# R17 source-T framebuffer 恢复修复

证据：`r17-first-gl-fault.json` 记录真实首错 `INVALID_OPERATION1282`，发生在 source-T factory 的 preserve finally：实际 DRAW framebuffer为null，而该浏览器对8个DRAW_BUFFER查询均返回BACK，旧trim NONE逻辑最终调用`drawBuffers([BACK,BACK,...])`。

本修复只改 `pyro-smoke-transmission-gpu.js` 的状态保存/恢复：

- 默认 DRAW=null时，恢复列表只取原第0项。
- offscreen DRAW保留原完整MRT选择，仍只裁掉末尾NONE。
- 保存READ_BUFFER，先重新绑定原独立READ FBO，再恢复readBuffer选择。

shader、pack调用、纹理/RT分配、active-partial viewport、循环/采样/pass数量、XYZ几何均保持。每preserve新增一项READ_BUFFER查询及一次readBuffer恢复，没有削弱原READ/DRAW/rectangles/metadata/XR/shadow恢复。

旧源完整备份：`baselines/r17-source-transmission-before-default-buffer-fix/pyro-smoke-transmission-gpu.js`，SHA256 `7107029518b02ec18c6472baf98154ff4686db85fafb5c13353807189ea4242c`。

当前factory SHA256：`d6bc32aa8cf27e899bbf00ff9662dab335bc196a3a9ec5469500c9822202724b`。

CPU验证：`node --check pyro-smoke-transmission-gpu.js` 与更新后的 `node verification/r16-smoke-active-partial-check.mjs`，**8/8 passed**。报告另存 `r17-smoke-transmission-default-buffer-check.json`。

夹具使用实际Three对象与nonGPU renderer：默认FBO返回BACK×8并拒绝不合法恢复参数；验证success/throw均只恢复单个BACK。独立READ selection用COLOR_ATTACHMENT2，模拟setRenderTarget重置selection，要求在重新绑定正确READ后显式恢复；offscreenMRT三附件保持，尾部NONE裁剪。原active-prefix、跨tile/缩小后不读旧tile、状态/metadata恢复与有限源码diff检查保留。

本子任务没有创建GPU context或运行GPU。实际WebGL错误消失、数值结果与native状态恢复仍由root在既有健康renderer上验收；admission模块的同类修复由另一代理负责。
