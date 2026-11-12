# ACES2 首个坏蓝样本：仅 QA 三段诊断

2026-10-27。冻结的原 `aces2-gpu-check.js` SHA423…、原official export和 `aces2-gpu-first.json`（52/53）未改。新helper尚未执行GPU；caller通知/独占renderer后才运行。

```js
const {runACES2StageGPUCheck}=await import('./verification/aces2-stage-gpu-check.js');
const report=await runACES2StageGPUCheck(THREE,renderer);
```

新CPU oracle为 `aces2-stage-oracle/stage-report.json`，SHA `4fb23a9563bb939d4c0e2d50f9431be8c0c2e5abfcb9eef032b48a5691d8ee59`，独立官方CPU导出6/6。GPU只处理三个固定Float32像素：

- bad-pure-blue-Y1 `[0,0,13.850415229797363]`；
- actual-profile-blue-Y1 `[.4846985638141632,0,12.423172950744629]`；
- green-18.28686 `[0,18.2868595123291,0]`。

不是追加曝光/光场/整场压力实验，不做计时或HDRcanvas呈现。原工程门/官方absolute-only诊断不被本helper替换，也没有新的“宽松颜色通过”。

## 三个因果段与输出

1. **线性前缀。** GPU读AP1、AP1Range、AP0，与官方CPU同输入前缀对照。原坏样本的AP1均正且未触发Range，原探针Float32输入/纹理绑定/格式已经通过，故不能再把问题泛指为double输入或8bit表。
2. **正CAM、tone/chroma与查表。** 读Aab、JMh、Jts、reach、toneJMh、cusp和实际reach/cusp索引/插值t。直接在原采表函数return前复制选中的indices/t，不拿CPU hue代替实际GPU hue；另用该GPU hue和原常量数组做独立索引核查。坏蓝CPU公开FF hue275.96585083，离最近cusp knot约.170075°、reach整数边界约.034149°，目前没有足够证据称错bin/接缝。
3. **逆CAM/重建。** 读gamutJMh、inverseLMS及最后Range之前RGB。原CPU坏蓝的红色约由 `12.36134−11.73502−.54000=.0863139` 得到，消减条件数约285；这只是放大机制，不是已定位首个误差来源。新GPU结果会用实际LMS报告相同条件分析。

两套GPU program：A逐字复用冻结official fragment；B仅向13个阶段插入赋值+QA globals，以运行时uStage在完整函数结束后选择15个输出。没有提早return截断路径。新source-check3/3证明三target插桩均可剥离为完整原function，每处missing/duplicate失败，任意无关系数变更不能被归一器抹除。

**这不能保证编译器完全不改变运算。** helper逐样本检查B完整终点与A逐bit相同；若失败，保留所有数值并明确不能把B中间值当作A精确路径证明。还要求原bad-blue的R逐bit重现首轮 `.08624598383903503` 且仍不满足原工程门，避免诊断编译本身悄然改变原失败。

## CPU对照与自我推翻

官方CPU full路径直接把Aab送入tone，而GPU/公开分离FF会经J反求A；此操作路线差异确实存在。但**当前独立CPU实验已否定“光凭这点就解释坏蓝”的结论**：坏纯蓝fullCPU R `.08631390333175659`，splitCPU R `.08631348609924316`，仅−4.17e−7，远小于首轮GPU−6.79e−5；actualblue差约−2.86e−6，green无差。因此没有直接修改生产颜色或改门的依据。

每样本保留fullCPU/splitCPU、fullSerialCPU/splitSerialCPU和stage差异。公开FF的每段是Float32 buffer边界，并存在degree/internal-h往返；其阶段值不是完整CPU内部私有变量。Aab/LMS等公开接口缺失时留null，只记录GPU诊断，不拿私写近似当官方oracle。即使GPU更接近split，也不能单凭终点唯一锁定J/A往返。

官方公开源码证据：[CPU完整前向链](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/ops/fixedfunction/FixedFunctionOpCPU.cpp#L1031-L1050)、[GPU tone生成](https://github.com/AcademySoftwareFoundation/OpenColorIO/blob/v2.6.0/src/OpenColorIO/ops/fixedfunction/FixedFunctionOpGPU.cpp#L570-L616)。具体参数/接口与许可保留在独立stage-oracle目录。原首轮52/53仍未通过，不因新增诊断而推广默认显示链。

## 状态与冻结

借用renderer的保存/恢复代码沿用原实际通过的423状态部分，包含RT/face/mip、逻辑及物理viewport/scissor、FBO、PBO/pack/unpack、program/VAO/buffers、2D纹理/sampler、混合/depth/stencil等；新helper额外记录restore阶段GL error。新资源finally dispose，无resize/新canvas/生产资源接线。实际恢复结果须由本轮真实GPU报告证明，不能从沿用代码直接宣布成功。

新helper SHA256：`725ddf0139306afffc40d4535b293170e7811bb32473300b225288f346667642`。实际GPU仍待root通知；本说明只记录已核CPU/来源与待证伪设计。
