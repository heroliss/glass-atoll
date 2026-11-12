# 瞬态云照明：独立opt-in候选

2026-10-27。生产只修改`sky.js`，未接main/water/GI/fireworks或UI；新实例默认`uTransientCount=0`。这不是整场烟花照云已交付。

```js
atmosphere.setTransientLights(clusters, {
  rawPerCandela: frame.rawPerCandela, enabled: true
});
const rawBound = atmosphere.getRadianceBound(); // 已含transientCloudUpper
// host先将此界交统一P控制器，再设置主sky的storageEV。
atmosphere.renderTransientClouds({
  renderer, target: reflectionRT, camera: mirrorCamera,
  reflection: true, planeY: 0, frame
});
atmosphere.setTransientLights([], {enabled: false});
```

输入最多两簇：`position`、`referenceCandela`、`color/linearColor/colour`、`radius/falloffRadius/sourceRadius`。先计算raw参考强度RGB=`I*colour*rawPerCandela`，不读已曝光native PointLight或屏幕/bloom。零强度被排除；无效批次原子拒绝，不截掉第3个源。源量仍为作者参考，非商业壳弹实测cd。

主sky在原density march的view权重上累积新增单散射，保留原base路径；零源不执行新增传输。沿用归一的`.82 HG(.62)+.18 HG(−.25)`，SSA=.999；局部源不乘Sun22/.34。入射self-shadow将有限p→source段与球形云壳相交（最多两段），4个样本按壳内总长度分配。source/view cleanT分别4点，使用现Rayleigh/Mie/O3参数。相函数方向为`dot(cameraToSample, sampleToLight)`；proxy中心方向退化作有限mu0近似。

独立mirror pass只输出新增RGB、alpha0；premult ONE over保留destination alpha，远深度由opaque硬件深度遮挡，不绑定其attached-depth sampler。虚拟mirror eye不被抬到2m；有效ray先求真实water-hit，然后从hit到云计算view段。负t、近水平或非有限/过大交点返回0，不clamp分母伪造交点。主aerial仍拥有camera→water段，后续烟compositor拥有view烟。这里尚无source→cloud烟遮蔽、真实分布星近场积分、多重云散射、绝对测光或完整倒影DOF。

`captureSnapshot()`默认排除全部瞬态count/数组；`captureSnapshot({includeTransient:true})`可保存live状态。`withSnapshot`的内部save明确includeTransient，finally恢复光/P/天气坐标；否则默认排零的save会错误丢live。六面capture仍需按默认snapshot调用，不把闪光写进长期cube/PMREM。瞬态view pass恢复RT/face/mip、public/physical viewport/scissor、XR、shadow状态、autoClear与临时P/plane；它不改变clear/toneMapping/output色域。新增主sky4个vec4+count、无新增sampler，近水16sampler不变。

`getRadianceBound()`含raw `transientCloudUpper = .999*.76389964*Σ max(IRGB)/r²`。这是实现的两簇有限半径代理界；view吸收/SSA/权重均不放大。不是所有真实星在代理半径内的界。caller必须在画图前按合并后的源界选P；FP16 overflow和弱夜空下溢仍需真实集成验证。

独立证据：

- `transient-cloud-cpu-check.mjs/json`：**11/11通过**，覆盖raw单位、P独立、默认count0、capture排除、nested/throw恢复live、非法输入原子拒绝、disabled与零源。
- 首次实际GPU报告`pyro-air-cloud-gpu-first.json.cloud`为**16/22**，原始失败保留。实际main/mirrorΔ、alpha0/保dstalpha、硬件遮挡、P、source envelope和capture通过；六项数值probe返回全RGBA0，不能当数学输出。原因是夹具提取的`atmospherePhaseHG`依赖生产全局`const float pi`，但独立probe遗漏了它，导致整个数值program编译失败。main/mirror使用完整生产shader，未受该遗漏影响；生产sky不因该夹具错误而改动。
- `transient-cloud-gpu-check.js` v2保持`runTransientCloudGPUCheck(THREE,renderer,atmosphere)`。补同一生产shader的pi依赖，保留原22项及全部六项阈值，新增真实同一probe非零sentinel、program link/compile与shader-error诊断，预计**24项**。debug callback/flag也在finally恢复。仍借已上传纹理，不建新Atmosphere/catalog/context。synthetic白1e6参考cd仅为Float32差分，非默认实景源强；还要测试球壳/HG的有效非零输出，不能因零结果恰好符合parallel case就称物理通过。
- v2实际GPU复验在本说明更新时**尚待执行**；不把Node通过或首次局部通过称全部GPU成功、全岛图像验收或FPS。

冻结hash：sky `66c269fe2fc117b6a83847dd83b0cd79fac02e8ad6390f4dec9b6bbe89dc3923`；v2 GPU helper `7c3d76d818c08fb5bc5afa20f02b3b03ccbe66c36db35f80297ff6f504b3c764`（v1为`5e045df7…47cb084`）。后续若修实际错误，保留失败报告并更新hash/边界，不掩盖成已通过。
