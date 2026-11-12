# 独立烟体的共享局部光照

后续状态窄修见[PYRO-SMOKE-VIEWPORT-NOTES.md](PYRO-SMOKE-VIEWPORT-NOTES.md)，新renderer SHA97fd2b…310bc；本文件982682版本已由root实际GPU local18/18通过（`pyro-smoke-local-cloud-gpu.json`），source逻辑由后续5/5源码检查证明未改，但DPR新状态路径仍须独立实际GPU复验。

2026-10-27。本轮只修改`pyro-smoke-renderer.js`及本组验证/说明，**未接main/lens/water**。当前冻结source SHA256 **9826822561ec4a5af5d9b61843a6ae714ab8a74706b763f9a53d3f2248632818**。原air-only模块SHA07914…1e77完整保存在`baselines/pyro-smoke-renderer-before-local.js`，用于实际GPU逐位回归。几何、finite Gaussian column、alpha与空气4段薄层公式未改。

## 接口与账本

```js
const localLighting = localLights; // createLocalLights返回的原生对象
const bound = smoke.getRadianceBound(rawLighting, {air, localLighting});
// root据raw bound决定P，随后localLights.setSceneExposure(P)
smoke.render({target, camera, opaqueDepth, frame, lighting: rawLighting,
              air, localLighting});
```

传`null`/省略时使用原2簇路径。传对象时，shader在真实光学conditional-mean世界点`eye + direction*meanDistance`调用共享`localLightGLSL/localIncident`最多6次：3盏地灯、手电、2烟花簇。**这6路替代原2簇项，不再叠一次同一烟花**。ambient、太阳/月亮与前空气仍来自renderer自己原raw输入。烟没有表面法线，不人为乘surface cosine；方向关系只通过共享源锥角和minus-HG相函数。

借用`localLights.uniforms`的uniform对象引用：`uLocalColour`已乘当前storage P，烟renderer**不再乘P**。自己的ambient/dir/air raw仍只乘一次。frame C不参与物理照明；局部光源raw记录也不会被此模块改写、变成新反射/发光源。开启/关闭路径时重新绑定共享/私有合法默认uniform（vec4数组、白dummy、矩阵、尺寸），不会留下对已释放借用纹理的关闭路径引用。

绘制前确认shared shader/6条raw records/uniform结构、有限字段、合法torch默认、以及每RGB≈`record.rawRGB*sceneScale`；相对容差2e−7加绝对1e−12。P不一致立即抛错，尚未算opacity或发起draw，**不偷偷重新曝光borrowed数据**。有效光源uniform半径不得小于raw bound记录半径，避免预算漏界；同draw target的torch纹理feedback也拒绝。caller负责在source-bound→P决策后、draw前调用`setSceneExposure`。

## source上界与局部模型

局部项raw上界为最大SSA乘`HGmax(gSmoke)*Σ_i max(record.rawRGB)/radius_i²`。不读取已P颜色作raw预算，不同时加入旧clusters，不按历史烟packet数放大。共享cone/range/PCF均≤1；地灯shader近场另有`.01m²`分母下限，本界用较小`radius²`给更松保守界。太阳/ambient与air的已有raw界照常相加。单位沿用场景的参考辐射尺度，不宣称测量绝对烟花照度。

地灯与其他receiver共用距离截断/近场限制；手电共用9tap packed-depth PCF和world偏移。**这个PCF包含现有场景torch遮挡，不包含烟自身source→puff光学厚度**。地灯仍没有各自shadow cubemap，太阳/月亮没有新增树/云shadow查询。有限面积源近场、厚烟内部光梯度、多散射、烟/空气联合积分仍未实现；conditional-mean常源层近似保持原边界。

仅2个sampler（独立opaque depth、借用torch shadow），没有增加water sampler/全屏RT；shader局部光循环固定6次，手电实际走PCF时额外9读。默认关闭分支为uniform控制流，所有取样显式LOD，无新导数。源码有两套source分支并不证明实际成本固定；GPU时间必须在真实浓烟/手电范围内另测。

## 可复验证据

- `node verification/pyro-smoke-local-check.mjs` **13/13通过**，实际`createLocalLights`和实际smoke render方法配空GL stub：共享引用、P一次/raw bound不变、错误曝光提前拒绝、近场/range/cone、6替代2、null资源回切、feedback拒绝、两sampler、borrowed资源不被dispose。
- 原renderer math **18/18**、air math **15/15**在新SHA下复验通过。这些是CPU/源码合同，不能代替GPU读回。
- `runSmokeLocalGPUCheck(THREE,renderer)`来自`pyro-smoke-local-gpu-check.js`，冻结SHA **c5a299dabd683ee26a8db11836c31875665fb13fdb36a1d9bbfb1c89ad3a5c87**，18项待root实际运行：旧null/air逐位比、8方位、近场/range、手电正背/penumbra/PCF、P一次、无重复簇、6光求和/bound、alpha不变、资源上限/状态复原，以及曾开启后关闭的普通/air逐位回归。
- GPU fixture的depth=far、torch shadow黑/白1×1均为**synthetic纹理**，只测GPU采样和共享PCF路径；不把它称为实际几何shadow capture或生产深度全链通过。实际app接线、主/镜像图像和性能由root另验。
