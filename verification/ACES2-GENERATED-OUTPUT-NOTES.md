# 精确整数峰值ACES2输出：独立模块候选

本轮只改 `aces2-output.js` 和专属QA；未改controller/main/lens/HDR/UI/backend、原三个pinned资源或颜色算法。旧模块888原字节保存在 `baselines/aces2-output-before-generated-peaks/`。这是明确非官方 accurate-atan 数值变体，不是OCIO认证；新增峰值尚待root运行真实GPU和实际呈现验收。

## API及准入

```js
import {createACES2Output,ACES2_OUTPUT_PEAK_RANGE} from '../aces2-output.js';
// PEAK_RANGE = {min:100,max:10000,integerOnly:true}
// ACES2_OUTPUT_TARGETS 仍仅指pinned [100,700,1270]。
const output=createACES2Output(THREE,renderer);
const result=await output.prepareTarget({peakNits:1200});
// ready:true 才可同步调用原 render；controller在false时选择legacy覆盖。
```

原100/700/1270继续走原pinned manifest、原函数、两表及17锚点；新目标走同源 `POST /api/aces2-target`，仅传 `{peakNits}`。实际200协议是直接packageInfo外加 `status:'cpu-ready'`/service，参见 `R9-ACES2-TARGET-HTTP.md`。模块不设置曝光C/P、不改光源或白点，不把CPU-ready标作显示生效。

动态资源路径只能是整数导出的 `/vendor/aces2-generated/<peak>/`，basename平面、同module origin，无redirect；响应stream有界。校验service/ready marker/ARTIFACTS/每封存成员的bytes/SHA、OCIO2.6.0/NumPy2.3.4、冻结exporter/core/source-input/atan/prefix/license、exact target参数、两张363×1 RGBA32F/NEAREST/no-mip表。候选必须逐字逆回对应official函数，prefix来自原pinned资产；不是改uniform或在旧表之间插值。hash封存仍以可信本机server和项目为前提，不是数字签名，不能防同一用户一致篡改全部资产/程序。

新峰首次真实compile后，在当前renderer中用一次64×16 RGBA32F draw/read验证完整963行及61行黑padding。输入是显式Float32；CPU JSON与输入/期望F32纹理逐值相等，输入纹理hash额外固定为全目标共享的冻结963数据。准入门仍为原candidate工程门 `abs <= 2e-5 + 2e-4*abs(expected)`；另记strict abs-only诊断、不将它冒充全通过或放宽准入。有限/非负/峰界/alpha1/精确黑/极暗纯蓝及padding另有硬门。公开 `validation` 含exactPeakNits、各family/worst sample、maximumBudgetRatio和strictAbsoluteFailures。

异步fetch完成后只有最新epoch可compile/publish；同峰pending共享Promise，stale/dispose不分配新GPU资源。已准入缓存最多12个动态目标，另有3个pinned目标；满时明确 `cache-full`，不偷偷降峰、淘汰或删除磁盘资产。dispose释放资源。既有GPU资源的缓存仅对当前context生命周期有效；context丢失/重建应由所有者dispose并重建模块，本轮未新增context-loss恢复状态机。

`prepareTarget`失败保留requested/effective分离：域外 `unsupported-target`；服务QUEUE_FULL等返回 `service-queue-full` 等明确reason；完整性、源码逆变换、compile或数值失败为 `validation-failed`。没有失败目标的renderer调用；旧已ready目标仍在cache，但不能冒充所请求的新峰值。同步render依旧只接受exact已ready峰；模块不自行绘制legacy，adapter负责false/throw后的完整覆盖。

## 本轮离线证据

- `aces2-generated-output-check.json`：17/17，包含真实1200包完整加载直至显式no-GPU边界、17类metadata变异拒绝、等长资源篡改、fixture/padding差异、黑/蓝/finite门、同源/redirect/服务错误、epoch及旧三目标shader字符串逐字相同。
- `aces2-generated-output-cache-check.json`：5/5，仅两个精确VM hook替代数据加载和GPUcompile，验证12容量、缓存命中、latest epoch、pending去重、dispose、compile失败；**不是GPU数学或性能结果**。
- `aces2-generated-output-legacy-check.json`：严格整模块逆回888后原12/12离线守卫；`aces2-generated-output-drawbuffers-check.json`：在该逆变换后组合原4/4。旧检查/报告原件不覆盖。新inverse记录12项精确source edits，未知变化必须fail closed。
- 首份 `aces2-generated-output-check-first.json` 保留10/15：QA的Windows file URL路由、子Node URL解码和一条未改变bytes的mutation fixture有误；只修fixture，未放宽任何准入门。修后17/17新增两项明确回归。

真实GPU helper由独立reference agent新增 `aces2-generated-output-gpu-check.js`；root独占运行。它与模块内部963准入之外，还须验证public render、实际driver/Three状态恢复、曝光/单位/OETF/P，以及1200实际native桥。CPU/HTTP成功不代表这些已通过，prepare-time一次读回/首次compile也不计为正常帧性能。

## Artifact字段

新准备结果首次成功含 `generated:true,validation,assetHashes`；缓存命中可从 `diagnostics().resources` 读取同份证据。哈希包括descriptor、ARTIFACTS、ready、candidate、official、两表、963输入/期望/oracle、core/atan/prefix/exporter。`supportedPeakRange`是可准备的整数域，不是声称9901个峰均已在当前GPU验证；只有 `generatedReadyTargets` 中对应exact峰已完成本context准入。
