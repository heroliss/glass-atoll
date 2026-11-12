# Smoke RT视口与DPR窄修

2026-10-27。只改`pyro-smoke-renderer.js`的render-state setup/finally，未改main/water/GI。baseline SHA **9826822561ec4a5af5d9b61843a6ae714ab8a74706b763f9a53d3f2248632818**保存到`baselines/pyro-smoke-renderer-before-viewport.js`；该版local18/18实际GPU来自`pyro-smoke-local-cloud-gpu.json .local`，不得把它冒称本修复已GPU通过。

本DPR阶段冻结renderer SHA **97fd2ba3f69cf028b27af88bdba767a206ee9cc839d35121aec61fd960a310bc**，root已实际运行并通过：`pyro-smoke-viewport-gpu-first.json`专用9/9、内嵌Gaussian18/18、air14/14、local18/18。DPR1/2同17×13 RT逐位相同、221pixel全覆盖、caller/draw target元数据和状态恢复、原backbuffer尺寸恢复均通过。

报告本身未内嵌source hash；复查实际冻结源97fd与helper4708后，已另存[接受manifest](pyro-smoke-viewport-acceptance.json)，包含source/helper/report/原source-proof文件hash及这一出处边界，不把事后manifest说成GPU自动测量源码。后续可选finite-phase扩展已将97fd源码和原5/5 proof原报告封存在`baselines/smoke-before-finite-phase/`，其新GPU需另验，不污染本阶段已过语义。

## 确定原因与范围

Three r180 `vendor/three.module.js:15555–15570`的public `setViewport`更新的是logical pixel并始终乘canvas pixelRatio，即使当前绑定RT；`:17615`的`setRenderTarget`则直接用RT.viewport物理矩形。旧烟代码把RT.width/height又传public setViewport，在DPR2下生成2w×2h视口而uSize仍是w×h，导致光栅覆盖/射线方向错误。已有DPR1夹具不会暴露此问题。

修复仅临时将draw target.viewport/scissor设置为完整物理尺寸、关闭其scissor，再setRT；不再显式setViewport(0,0,w,h)。finally先恢复draw target元数据，再恢复caller的public logical矩形；利用caller RT临时物理元数据setRT恢复入口actual/current viewport与scissor，随后恢复caller原存储元数据。公共矩形、当前实际矩形、RT存储元数据可以三者不同，不能混当一种坐标。READ/DRAW真实FBO及Three绑定cache一并恢复。

柱密度、geometry、排序、source、shader、S/T、P与bound完整字节未改；没有靠重铺纹理、改颜色或输出clamp补偿。仅为状态修复，不声称所有DPR/驱动/原始GL手工状态情形已形式证明。

## 验证与调用

- `node verification/pyro-smoke-viewport-check.mjs` **5/5 CPU源码范围检查通过**：除state setup/finally外前后完整源码相同，物理逻辑/GLSL同hash。
- 原renderer math18/18、air math15/15、actual local factory+stub13/13在新hash下复验通过；不是GPU证据。
- 新helper `runSmokeViewportGPUCheck(THREE,renderer,{parentLocked:true})`，来自`pyro-smoke-viewport-gpu-check.js`。SHA **4708c42dc8086da287186a81ada49a2a30852e18cc793300841ed8233c6622e0**。该版已由root实际运行，通过结果及边界如上。

helper默认先DPR1共享调用原Gaussian18、air14、local18三组；再同17×13 Float32RT在DPR1/2作全221pixel覆盖/逐位比较，故意设置draw target自定义viewport/scissor及caller不同public/actual RT矩形，并包含callerTarget===drawTarget反例。每次render返回后、readPixels前核对raw binding/矩形/flags与元数据；最后检查原pixelRatio、logical size、drawingBuffer尺寸恢复。pixel/coverage实际通过才可写DPR修复验收。

**必须由parent独占锁production renderer**；参数只是caller声明，不会神奇阻止另一rAF。`setPixelRatio`重建canvas buffer，finally恢复尺寸不等于保留旧呈现像素；root应在返回后invalidate paused presentation cache并重画。helper不改变app state、相机、光照或物理clock，所有私有RT/纹理均释放。源/目标small RT测试不证明实景性能或任意MSAA资源链；后者由独立depth-copy GPU报告负责。
