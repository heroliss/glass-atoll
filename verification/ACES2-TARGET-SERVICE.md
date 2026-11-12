# 任意整数HDR峰值：本地生成服务基础

状态：仅backend模块，未接HTTP/main/controller/browser。入口[aces2-target-service.mjs](../aces2-target-service.mjs)，CPU报告[aces2-target-service-check.json](aces2-target-service-check.json)。目标生成完毕只表示CPU资产可用，**不表示GPU准入、实际HDR呈现或视觉通过**。

```js
import {ensureACES2Target,getACES2TargetServiceState} from './aces2-target-service.mjs';
const packageInfo=await ensureACES2Target(1200);
// 同峰尚未完成时返回同一个Promise；只接受number类型的100..10000整数。
console.log(packageInfo.descriptorURL,packageInfo.candidateDescriptorSHA256);
```

固定执行项目`.tools/aces2-oracle/Scripts/python.exe -I -B tools/export-aces2-target.py --peak <integer> --out <project>/vendor/aces2-generated/<integer>`，`execFile`无shell、隐藏窗口、120秒超时、256KiB进程输出上限。无用户path/command参数，无网络调用/自动安装/全局Python；`-I`隔离Python环境与user site，导出器自身强制OCIO2.6.0/NumPy2.3.4并检查冻结core/atan/input seal。服务另固定导出器SHA256，不把旧700表改uniform来假装新峰值。

## 边界与事务

同一个进程单active、最多8个不同峰排队；同峰合并不占新位。队列满明确`QUEUE_FULL`。缓存最多12个数字峰值目录（完整/不完整都计数），满时`CACHE_FULL`，不删旧资产。跨模块实例/进程以固定cache根的`.service.lock`排他写锁再防并行，已有锁明确`SERVICE_BUSY`，不抢锁、不自动删除可能仍被使用的旧锁；进程崩溃后的孤锁需操作者核查。

所有路径由模块自身和整数构造；cache各父目录必须是项目内普通目录，不接受symlink/junction。文件必须是平面basename、普通非链接文件；最多32个封存成员、单文件8MiB、整包16MiB。验证ARTIFACTS所有bytes/SHA、无额外未封存成员，再验证descriptor版本/peak/core/atan来源、两张363×1/NEAREST/无mip表、函数/probe hash、963组CPU元数据，并逐Float32对比输入/期望纹理与CPU JSON（含61个黑padding）。后续缓存复用也重验上述内容，内存命中不能绕过磁盘hash。

CLI已有临时目录→最终数字目录的原子rename；服务只在完整包复核通过后写独占`.ready-…tmp`，最后原子rename为`ready.json`。缺ready而原包完整时可重新验证后补标记；损坏包明确拒绝、不覆盖或偷偷重生。ready不是GPU状态。服务标记不参与原ARTIFACTS文件清单；因此不要直接对带`ready.json`的目录使用旧CLI的全目录`--verify`（它会正确报告额外服务标记）。独立CLI重现请用新的允许目录再比较原19个导出成员，或保留旧研究包作`--verify`；本服务复用由自身逐成员验证负责。

返回值含：`assetBaseURL`、`descriptorURL`、完整candidate-export-report descriptor及hash、ARTIFACTS hash、ready-marker hash、963输入/期望/CPU JSON URL/hash/字节数、CPU检查计数、`actualGPU:false / gpuAdmission:'required' / productionIntegrated:false`。作者光谱与历史source快照仍是原oracle的数据来源，不冒充当前场景测光或官方认证。

独立只读窄审未见正常协议下的路径/队列/ready事务阻塞。其边界仍是可信本机项目：hash封存不是数字签名，不能防同一用户一致重写整包和所有元数据；不是远端敌手安全认证。异常畸形descriptor有些会以普通TypeError拒绝，HTTP层仍须统一安全失败而非发布ready或直接暴露stack。

## 本轮实际与CPU协议验证

本轮首次直接调用实际生成1200nit；原CLI报告14/14 CPU checks。随后自动报告 **23/23**：实际同峰Promise身份、缓存二次复用、963纹理值、ready/hash，以及新1200的原19个成员（含ARTIFACTS）与保留的`verification/aces2-generated-1200`全部字节相同；旧研究包与pinned100/700/1270库存完全未改。

队列、跨job失败恢复、最大单spawn、固定参数、12缓存拒绝、等长资产/ready篡改拒绝和缺ready重发标记，用同一服务源码的隔离VM＋明确fs/spawn adapter验证；它们不是额外9个峰值的实际导出，也不声称真实Python高压性能。adapter只模拟这些协议，无浏览器/GPU。第一份完整报告[22/23](aces2-target-service-check-first.json)保留：当时QA故意改ready字段也改变了bytes长度，因而先被`INVALID_PACKAGE`拒绝，尚未到`READY_MISMATCH`；改为等长篡改后到达原目标门，未放宽服务校验。最早一次VM缺ready实验的自有虚拟lock未模拟lstat，测试先抛ENOENT；已仅补QA虚拟fs，没有改服务去掩盖真实锁错误。

复跑：`node verification/aces2-target-service-check.mjs`。脚本为VM模块在隔离子Node自动加`--experimental-vm-modules`；实际缓存资产不被测试篡改，最终报告保留VM与真实CPU适用边界。

## 给root的后续同源POST合同（尚未实现）

- 建议`POST /api/aces2-target`，仅loopback Host、同Origin、非cross-site；只接受`application/json`且≤64字节，body严格只有`{peakNits:<整数>}`。不接受路径、代码、命令、任意URL或额外CLI选项。
- 可await共享Promise返回CPU-ready descriptor；request断开不杀死其他同峰用户共享的生成，也不因UI取消删除包。每次读取getState可报告有界队列。INVALID_PEAK→400、QUEUE_FULL→429、CACHE_FULL→409、SERVICE_BUSY→503；损坏包/导出失败明确失败及简要原因，HTTP层不暴露本机绝对路径/stack或进程完整stderr。
- 客户端requested/effective分开：生成期间沿用已验证legacy；CPU-ready后按descriptor下载实际新函数/表并检查hash/inverse契约，做该精确峰值的GPU准入及后续独立963 oracle、F16/native桥。不能把backend ready直接标成显示生效，不从700/1270插值或仅换uniform。
- C/P、光源、白点/纸白与物理时钟不由服务改变。仍按官方数值1=100nit、HDR乘100/browser白后一次OETF。显示器新峰应以新请求epoch替代旧请求；旧任务可以完成缓存，但不能覆盖新UI选择。
- pinned vendor三目标、旧1200研究包、ACES输出模块和生产默认均不由本模块修改（输出模块另有主流程的GL协议修复，不由本CPU服务定版）。下一阶段路由与任意目标GPU接线必须另外验收。
