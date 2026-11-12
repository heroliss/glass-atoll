# 实施夹具与接线状态

22项独立物理/事件检查、12项声学/来源/初始化race检查已通过；对应JSON记录源码hash。root实际GPU报告`../playground-second-gpu.json`中本模块编译/状态8/8、有限光学7/7、尾迹受控A/B4/4通过；`../playground-third-gpu.json`中离轴/near/叠加存储预算7/7通过。`contact-gpu-check.json`的生产GPU十类联系表检查12/12；音频初版A07回归10/10但用户仍嫌偏轻，现`audio-selected-check.json`更强候选对A07的实际浏览器离线检查16/16（含energy1.15近/零距双发）。`same-colour-contact.png` 是解析位置的离线同色图，**不是浏览器实景截图**；`contact-contact.png`才是实际GPU效果层，同样不是全岛截图。整场视觉/听感/性能验收由root继续；隔离GPU通过不等于已完成整场验收。

```text
node verification/fireworks/physics-check.mjs
python verification/fireworks/render-contact.py
node verification/fireworks/audio-check.mjs
```

实际浏览器独立夹具（只创建/销毁自己的RT/相机/效果）：

```js
await runFireworksGPUCheck(THREE, renderer, createFireworks); // 编译/alpha/曝光/镜像与状态
runFireworksOpticsGPUCheck(THREE, renderer, createFireworks); // 真实shader已知源能量/有限光程
await runFireworksTrailABGPUCheck(THREE, renderer, createFireworks); // 保存的旧shader与当前实际shader，同相位/C
runFireworksBoundGPUCheck(THREE, renderer, createFireworks); // 真实离轴/near/叠加峰值及生产分箱，7/7
```

root主链在opaque/TAA/air/DOF之后调用 `.render({renderer,target,camera,opaqueDepth,reflection:false,frame,optics,air})`，target为color-only HDR。mirror pass用原反射target的硬件depth，`reflection:true`编译排除depth sampler；空气从镜像射线水面交点开始。root负责一次共同Bloom/显示与黑底premult反射补天空。因主背景已经在lens里乘暗角，效果RGB按`optics.vignette`乘同一30% cos⁴因子一次（alpha不变）；镜像效果不乘相机暗角。

- `frame={time,dt,storageEV,sceneScale:2**storageEV,rawPerCandela}`，仅输出时乘P一次。
- `air`：enabled、marineAirCoefficients字段、sunDirection、rawSunRGB（key的未乘P相对照度）、ambientIrradianceRGB。RGB数组/THREE.Color或Vector3可用。四段近air无遮挡近似，不接隐含云/树shadow sampler。
- `getLightClusters()` 输出最多两个事件归属的参考cd与单位Y近似RGB，未乘rawPerCandela/P；pathFlags明确只做diffuse/smoke，不重复可见星的specular。
- `getRadianceBound()` 的maximumRawRadiance/maxRawRadiance含投影bins保守源上界及自己光簇照烟的bound，root另预算receiver/ambient/air。源峰按实际Gaussian的`I/(d²Ω)*min(1,1/(2πσ²))`预算，shutter/stretch端点按实际相机投影；跨near时整屏保守分箱。旧名globalFiniteSurfaceCeiling现在明确globalReferenceOnly，是作者球面参考，**不是离轴Gaussian的严格上界**；无camera调用会返回conservative:false/requiresCamera:true。最大通道按RGB不是Y；蓝色模型单位Y的maxRGB约12.423。
- `getBounds()` 返回min/max、centre/center、radius，按当前风的16段解析轨迹预测加裕量并以2Hz缓存；用户未来改变风后重新预测，不声称能预测未知输入。
- 自动与排队发射按物理slot可用时间排程，帧率不改变开始时刻；最多两主事件，额外最多16条队列。stop只停未来，不删除活跃星体。
- 仰角25..90°全部有效，rig/轨迹同步；同类型muzzle speed固定，作者高度在默认80°标定，低角度自然降低apex并改变水平距离，不通过提高发射能量维持固定高度。重复`configure({autoLaunch:true})`只回显状态，不重置下一发时刻。
- 音频 `.prepare()` 需root已有用户授权的context/aux输出；`.enqueue(events,{time,listenerPosition,temperature,paused})`，`.update({paused})`。未启用事件丢弃，不在恢复时补播旧事件。主爆是真实CC0压缩preview裁切，发射/噼啪及载入失败主爆是合成。两次试听后用户仍嫌A07偏轻，现按18组真实离线网格选用gain12/postgain.70/attack.5ms，318m比A07再高9.061dB；最大事件energy1.15的0m双发sample-peak.97747、clip0。第三次A/B用户接受“冲击感合适”，仅验收此冲击感，不延伸到所有音色/设备/SPL；音频冻结4e5ede41。来源/hash/首候选近场失败及各版证据详见`AUDIO-BOOM-REVIEW.md`，未加入合成低频、WaveShaper或最终硬截断。

近似边界：线性阻力与作者光度参考，非燃烧/冲击波CFD；CIE解析fit+参考谱带+简单色域压缩，非完整实测SPD；灰烟软片、中心深度排序、resolved-depth与分层CoC，非多层全路径薄镜头。既有opaque反射背景的空气近似由主计划明确保留。

尾迹空间stretch与短快门位移独立：≤1px的shutter以保持协方差trace的各向同性正方差近似，>1px用独立3点积分；通常8次Gaussian，近景大快门24次，没有新pass。受控A/B同C16.5、同t7.2s、8尾段，尾部HDR积分比1.0000234、头图逐像素0差，连接亮度p10由.7087到.7536；实际PNG可见差异轻微，不宣称已经消除独立短迹或等同长曝光照片。GPU计时未在此夹具嵌套测量。

预算回归真实复现旧错误：离轴resolved蓝源GPU峰4.97283，旧球面budget1.93608低估2.5685倍，新budget5.99383覆盖。跨near head/tail可见像素均未逃出预算区域，叠加与实际生产记录也有限且被覆盖。当时用于此预算回归的`fireworks.js` SHA256为`22881d28ac39ddd5f97903f80b7a16b598db256f40f3d44c8281a452ded26e4f`；后续root的CPU精确优化有独立版本/报告，不能把这条旧hash冒称当前运行时。该旧版Node CPU-only双菊4258records/update+clusters+bound均值6.41ms、p957.57ms，不含GL上传/绘制，不代表整场FPS。
