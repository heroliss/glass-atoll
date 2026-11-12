# 官方 ACES2 独立 GPU 探针

2026-10-27。`verification/aces2-gpu-check.js` 仅供 caller 独占借用 renderer 的QA，不接 main/lens/HDR 默认，不创建或呈现新canvas。尚无本代理实际GPU通过声明。

```js
const {runACES2GPUCheck}=await import('./verification/aces2-gpu-check.js');
const report=await runACES2GPUCheck(THREE,renderer,{
  targets:[100,700,1270],
  browserSDRWhiteNits:280,
  measurePerformance:false
});
```

调用方必须暂停/锁定生产renderer，完成后使实际视图重绘；不得与生产 `TIME_ELAPSED_EXT` 查询嵌套。可选 `baseURL` 应为绝对URL或URL对象。资源来自冻结 `aces2-oracle/export-report.json`，由独立agent在项目venv运行官方OCIO2.6.0导出；本地18个GLSL/fragment/F32输入/expected/表资源的SHA均已对齐metadata。CPU13/13属于官方导出流程，不是本探针的GPU结果。

## 被测数据与颜色语义

每target实际963样本、64×16 RGBA32F（61padding），严格读取metadata尺寸。GPU输入由导出Float32二进制上传；每个CPU oracle sample明确保存同一个 `inputFloat32`。探针逐值检查输入/expected二进制与JSON一致，不拿double输入的结果与Float32纹理比较。

三个目标都是完整官方wrapper：已经exposed的线性709/D65输入，经官方AP1/BFD输入域与Range、AP0/ACES2输出变换、显示Range。保留原始官方函数逐字不变；仅去掉生成fragment的首行ES3版本声明，因为Three GLSL3会供应同一版本行。原generated highp float/int/sampler声明保留。

官方两张363×1 hue表按其导出RGBA32F包装上传、Nearest、ClampToEdge、无mip、NoColorSpace；官方函数自己完成hue插值，不改成Linear也不猜3D LUT。绑定通过正式samplerName，无需强迫Three采样器分配的unit恰好等于OCIO bindingIndex。实际GPU probe检查LINK_STATUS、真实texture handle、GL过滤/wrap/单level，以及目标attachment四通道32bit/FLOAT/非MSAA。

输出 `1=100nit`。独立门依次测：raw normalized100nit、乘100转nit、乘 `100/OSwhite` 转browser-linear、再仅一次signed sRGB OETF。单位/OETF门以同次测得的GPU raw/linear值做独立标准变换参照，隔离官方CPU/GPU误差，不叠加P、摄影EV、80nit或paperwhite增益。此处的nit是目标编码单位，**不是显示器实测亮度**；不认证HDR canvas、浏览器外部copy、Windows合成或面板。

## 预先声明的门与报告

Root批准首轮工程门为每通道 `2e−5 + 2e−4*abs(expected)`（raw normalized100nit），helper拒绝caller自传容差。官方原GPU前向fixture使用2e−5 absolute、relative=false；探针另报此absolute-only诊断，不把更宽工程门称官方认证，也不假定扩展到1e9输入/边界集仍满足官方原夹具范围。

报告分target、5个family、6hue/5实际profile、EV band保留maximumAbsolute/Relative/BudgetRatio与worst sample的原始input/expected/GPU值。原始作者profile不是实测SPD。

另外单列：所有black样本必须RGB精确0；正的低亮纯blue（CPU B为正常Float32，非subnormal）必须RGB非负、B为正且为主通道，防止绝对底允许极暗色全部被误压为黑。报告保留这些约1e−13输出的ratio；该sentinel不宣称普通绝对误差门已经证明极暗色的严格相对精度。padding不参与CPU色度统计，但必须opaque black；所有alpha精确1，最终官方Range输出必须有限、非负且不超过目标peak。

unit门固定 `2e−4+4e−6*abs(expectedNits)`、browser-linear固定 `2e−6+4e−6*abs(expected)`、OETF固定 `5e−6+1e−5*abs(expected)`，分别约束Float32乘法/标准pow实现；另有中灰必须区分不编码、单编码、双编码的sentinel。任何失败保留原report，不按首轮结果盲调门槛。

## 资源与状态

所有纹理、material、geometry、RT只为QA创建，finally dispose，无生产节点或默认资源改动。保存/恢复caller target/face/mip、公共逻辑viewport/scissor与实际物理rect/FBO、autoClear、clear色、tone/exposure/output、XR/shadow flags、canvas/DPR/size；探针不resize。还恢复用到的program/VAO/buffer/PBO、pixel pack/unpack、2D纹理与sampler绑定、混合/depth/stencil/cull/掩码/读写buffer状态，避免留下上一张QA target或再次乘DPR。

入口GL error flag被记录/排空，不能恢复已消费错误；renderer统计计数与shader cache不是呈现状态，不假装逐值回滚。helper返回 `caller_renderer_full_state_restored_no_resize` 的实际差异项，未实际GPU执行前不能预称已恢复成功。

可选timing默认关闭；开启后仅串行测试64×16官方fragment小夹具（≤24个query、超时/单query>50ms停止），readPixels不在query内。它不测1080p显示pass/整场FPS，也不代表实际HDR呈现延迟。

## 冻结

Probe SHA256：`423ed607411bb213cdedd318e96d60e2a23e049415e00a02a34324a2819c5496`。

官方export-report SHA256：`dc28a8de0cb7bb582c07ade5690c913d67b7f1df220f135b8f2fd3c28b24d1c9`。导出LICENSE与原数据元信息保留在 `aces2-oracle/`。实际GPU通过与失败应作为新报告独立归档，不能覆盖CPU导出证据。
