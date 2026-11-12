# R9 新峰值独立public-render GPU夹具

入口[aces2-generated-output-gpu-check.js](aces2-generated-output-gpu-check.js)，SHA256 `768dce517a0e5632a0fdf36ffb89b7cc5730fe25c2121f7fcf5a7dcfa02d827d`。

```js
runACES2GeneratedOutputGPUCheck(THREE,renderer,{
  createOutput:createACES2Output,peakNits:1200
});
```

调用方暂停、持有原renderer的qaRenderLock。夹具不建canvas/device、不改主canvas尺寸、不画主surface、不做timer或生产启用。参数须为100..10000范围中非pinned100/700/1270的整数；默认1200。实际同源POST必须先由主代理统一重启的R9服务提供。

先取真实POST direct package、按hash取descriptor/ARTIFACTS/ready，再按官方CPU hash取64×16输入/期望/CPU JSON；独立逐值确认963样本与61个黑padding。真实factory.prepareTarget必须报告`actualGPU:true / admission:full-963-exact-peak`、精确峰值/样本数/资源hash，才允许继续public render。不是把17anchors换个标签，也不用替代shader。

public render沿用旧独立oracle的固定engineering门absolute2e−5＋relative2e−4，另外保留absolute-only诊断、五families、精确黑/低蓝和padding。还测P±8反补偿bitexact、exposure一次、nits/100与browser白换算、OETF一次、物理viewport与外部sentinel、feedback/nonfinite/8bit拒绝、samepeak缓存不重bake。所有数值输出为owned RGBA32F，不能借此声称F16无下溢或native桥成功。

继承旧137的完整Three/driver恢复协议；新夹具在default framebuffer只捕获一个DRAW_BUFFER0，offscreen仍按其MRT状态。实际借用default状态时只往owned RT画，验证恢复default的单BACK，不接触主canvas像素。dirty viewport/scissor/RASTERIZER_DISCARD/PBO/sampler状态同时覆盖；外sentinel先实读验证初始化，以免沿用旧fixture清色错误。

pinned100另外确认仍走17anchor原路径；新范围内1200不再是假unsupported，故新夹具只将unsupported语义设为99。旧[137 helper](aces2-output-gpu-check.js)和旧报告原样保留，不能不加说明拿旧“1200不支持”门验收新需求。真实源损坏在独立实例fail closed，不把预期corrupt错误混入正常实例的零错误门。

Node语法/ESM导入及模块作者的只读接口交叉审查通过。下述实际GPU报告已执行；新目标的完整相机/曝光、F16/native HDR呈现、场景视觉、全帧性能仍是后续独立门。

## 实际61/61与独立审阅

[r9-aces2-admission-first.json](r9-aces2-admission-first.json)，SHA256 `072b218e162aec351b1f8d1087784dd191a848f606a7453ce6d93fc99d98e3ed`：generated **61/61**，`actualGPU:true`。实际1200资源在ready前已full963＋61 padding准入，public render另对同一原CPU bytes复查；assetHashes对应真实service的descriptor、ARTIFACTS、ready、函数/原official、表、输入/期望/oracle和冻结core。不是用17点或另一峰值代替1200。

五families及黑/低蓝、padding均通过；public raw最大绝对误差5.7220459e−5，最大工程budget ratio约0.085776，非有限/负值失败为0。**纯absolute2e−5诊断有29个通道超限**，61/61使用原批准的absolute2e−5＋relative2e−4工程门，不能说官方纯absolute门全过或官方认证。public最大相对误差1亦保留：绝对toe预算允许极小通道的相对误差很大，精确黑和选定低蓝witness不等于所有极暗RGB都无相对误差。

P±8反补偿、exposure一次、nits/browser-white/OETF均过；实际raw draw为64×16、samples0、RGBA各32bit，绑定tInput与两张NEAREST/CLAMP/level0表共3 samplers，无另外sampler对象。default借用门实记drawBuffers仅`[BACK]`并恢复`changed:[]`；非零physical viewport内部bitexact、外sentinel不变。最终caller DPR1、canvas/drawingBuffer1920×1080，完整driver/Three恢复`changed:[]`、textureBindings空；入口/出口错误空、program live且非delete-pending，GL/hookErrors均空。它是离屏F32准入，不是DPR2、F16、nativecopy、面板或整场景FPS验收；实际新生成峰仅1200，不代表已穷举100..10000。

## R9 pinned回归clone（待实际137复跑）

同份首报告的旧137 helper得到135/137；失败恰是旧“1200域外不支持”和“不能渲染1200”两项。授权新域后它们已过时，原文件/原失败报告继续保留，不能用facade伪造模块拒绝1200。

新[r9-aces2-pinned-output-gpu-check.js](r9-aces2-pinned-output-gpu-check.js)仅原136/137两行的1200改99（包括调用/名称/期望请求峰），export仍为`runACES2OutputGPUCheck(THREE,renderer,{createOutput})`，可由root在新路径import别名。SHA256 `3e7cc1a1ae208f34740c7f6ec09a90abb8d7e1af1cf055d2c305d3119be11202`。

[严格源码检查](r9-aces2-pinned-clone-check.json) **5/5**：旧878a helper未变；只两行不同；strip仅这两整行后其余全部byteexact，SHA256 `a86127316f85425f921869068201163db7999bd61de6151486394f90d23ee705`；仅反向恢复这两行即完整旧文件；真实factory入口不包facade。其它135断言代码与全部容差逐字保留。此5/5是源码证明，**不是新137 GPU通过**；新clone实际执行由root另存报告。
