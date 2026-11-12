# 全分辨率输出映射成本夹具

入口：[aces2-output-performance.js](aces2-output-performance.js)。仅QA；调用方先暂停并用既有`qaRenderLock`独占原renderer，不创建canvas、不改caller尺寸、不改production模块。

```js
const [{runACES2OutputPerformance}, {createACES2Output}] = await Promise.all([
  import('./verification/aces2-output-performance.js'),
  import('./aces2-output.js')
]);
return runACES2OutputPerformance(THREE, renderer, {
  createOutput:createACES2Output,
  width:1920, height:1080, // alternatively1280×720
  samplesPerMode:12, warmupRounds:3, measureMs:3000
});
```

同一确定RGBA16F输入、同一samples0 RGBA16F目标，四模式依次轮换起点交错：legacy SDR fitted＋OETF、原生产HDR_FRAGMENT（700/纸白280/浏览器白280）、实际ACES2 public module100和700。SDR基准保留生产HDR原`filmic/encode`定义，只将main派生为一次fit＋OETF；HDR基准整个原fragment不变，运行时fetch/片段SHA都会记录。它是映射pass成本比较，不是完整OutputPass/FSR/native copy链条比较。

输入为128×64重复正浮点tile：六种作者RGB/灰的暗至亮log ramp，另含黑、极暗蓝、原色、亮中性与高光八个固定anchor；RGBA16F实际量化后整幅hash一致、所有模式共用同一texture handle。目标附件实查FLOAT/各通道16bit/samples0且与输入不同，避免feedback。F16输入/各模式输出八anchor经小RGBA32F copy在计时外读回：证明实际storage/数值有限与半精度可表达，不代替原963×3的颜色oracle，也不把toe/低亮F16下溢误说成色彩准入。

先做实际目标17anchor admission和全分辨率warmup，结束后一次finish在测量外。每轮4个query，永不嵌套，开始前有外部active query就拒绝；轮间读取异步available。默认每模式12份、至少8份有效非disjoint才计算GPUmean/p50/p95。无ready/非正timer/任何测量期disjoint明确丢弃，不拿一个query叫平均。CPUsubmit单独记录实际函数调用耗时；legacy借Three微型fullscreen render，ACES借真实public API，因此CPU路径差异属于报告边界。

采样/轮数硬上限24每模式；submission/poll时窗500–4500ms，默认3000ms，给5秒目标保留余量；单次有效GPUquery>50ms停止继续提交。driver同步调用不能被JS中途抢占，实际measurement.wallMilliseconds始终记录，不能把极端driver stall隐去。初始化/编译/加载/读回/清理均不混进GPU query；这不代表整个QA函数含初始化也只耗5秒。

统计为每组所有有效GPU样本的算术mean，p50/p95用nearest-rank；CPUsubmit按所有提交尝试另报。原始逐样本mode/round/order/cpu/gpu/rejection保留。结果没有实际全场景rAF、场景渲染、MSAA、WebGPU copy、compositor、面板测光或60fps保证。

退出沿用已通过137/137的完整Three＋driver恢复协议，包括raw activeTexture/bind强制同步；owned查询/模块/纹理/RT/材质全dispose，恢复target/face/mip、逻辑/物理viewport/scissor、清色、tone/output/XR/shadow、samplers/PBO和触及GL状态。入口已有GL错误单独记录并drain，无法“恢复错误队列”，不将它们混成owned操作错误。

## 实际结果与独立审计（2026-10-27）

[aces2-output-performance-first.json](aces2-output-performance-first.json)实际执行 **13/13** 通过；48条原始query全部有效、无discard、无disjoint、无shader/GL错误。按rawSamples独立重算，各mode的mean及nearest-rank分位数与原报告一致；每种mode都出现在轮内0、1、2、3四个位置，未固定总是先测旧曲线。默认三轮warmup完成后才计时，GPUquery只包围实际draw，不含准备17锚点、纹理上传、readback或dispose。

同一1920×1080、RGBA16F输入和RGBA16F输出、exposure=1：

| 模式 | 有效/提交 | GPU mean ms | GPU p50 ms | GPU p95 ms | CPU submit mean ms | CPU p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| legacy SDR fitted＋OETF | 12/12 | 0.036584 | 0.034816 | 0.045792 | 0.033333 | 0.100000 |
| legacy HDR 700 | 12/12 | 0.036517 | 0.035840 | 0.040960 | 0.025000 | 0.100000 |
| ACES2 100 | 12/12 | 0.392344 | 0.270336 | 0.771072 | 0.433333 | 0.700000 |
| ACES2 700 | 12/12 | 0.336555 | 0.275456 | 0.694272 | 0.325000 | 0.500000 |

相对各自legacy组，ACES2的GPU算术mean增加约0.355760/0.300037ms；CPU提交mean增加约0.400000/0.300000ms。两者不能直接相加当作确定的单帧损失：CPU与GPU可重叠，legacy是Three小场景提交，而ACES2包含真实public API的校验和状态保存/恢复。CPU时间约0.1ms量化，旧组中位0仅表示小于计时分辨率，不能说零成本。12份样本下nearest-rank p95就是该组最大值；测量段实际只有67.4ms，不能代表长时温度稳态、连续rAF或生产场景尾延迟。3000ms是上限，本次因已取得目标份数提前结束。

F16门实际读得目标RGBA各16bit、samples0、输入输出不同纹理；8个输入anchor与已上传half bits精确对应。例如作者1e−7蓝已量化成5.960464477539063e−8，0.18已量化成0.179931640625；不是原binary64值无损保存。四种输出anchor均有限、非负、alpha1并可由half表达，但不同曲线的输出本就不同。此门证明真实半精度路径，不代替[963×3独立颜色门](ACES2-OUTPUT-GPU-CHECK.md)，也不证明小于half有效范围的夜间细节不丢失。

viewport结论区分源码与遥测：helper确实创建1920×1080目标，Three的`setRenderTarget(destination)`使用该目标物理viewport；legacy fullscreen与ACES2默认target viewport均画向它。读回报告还实查了该目标的16F附件。但本报告没有逐mode记录draw时的`GL_VIEWPORT`或右上角覆盖witness，不能声称已用独立遥测证明每个全屏像素均被处理。调用方canvas/drawingBuffer为1280×720、DPR1，不与1920×1080离屏目标混用；最终它们以及所有已捕获的Three/GL状态精确恢复，`changed:[]`，包含texture/sampler slots。没有resize或主canvas draw。

这是现有本机renderer上的独立输出pass成本。它排除了全场景、native WebGL→WebGPU same-task copy、HDR surface/compositor和显示面板，不能推广成任意硬件60fps保证，也不是新增接线后的实景性能验收。

证据标识：report SHA256 `61a3f5ffe605fd2260d5c8d024e3fbd80aca9e5c214ad78918b7814c34c8776b`；helper SHA256 `60230872b91a2fcc917150cd810f89f7c579b16c0224d130f22336e36cbd95b5`；共享F16输入SHA256 `887e8069d498ff1f8748a42d202b03a16be581917fe286923e250adcd366165c`。原legacy HDR片段SHA256 `5e78af914a00e3c22a3d337e216921c725e47aa7173297eb29c914ab57ab53b6`，与本次读取的生产原片段一致。
