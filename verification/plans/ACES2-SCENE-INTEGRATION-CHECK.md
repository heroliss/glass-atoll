# ACES2 实景接线验收设计（只读，2026-10-27）

状态：设计，**未执行实景门**。独立module已有137/137；孤立1080p成本夹具有13/13；这两者不能替代以下native桥、暂停缓存和实际UI路径。本文不改运行时，不新增光源或重调曝光。

## 源码接线核对

- `main.js`创建同一个`displayTransform`给lens与HDR；状态变化调用`hdrOutput.requestRedraw()`并使暂停缓存失效。`setGraphics`的纯输出设置不重置已收敛AA，适合固定master对照。
- `lens.js`在aerial、DOF、effects、bloom、SMAA之后取同一线性浮点`result`。候选SDR100成功时绕过原OutputPass；q<1时绘入原encodedTarget再走FSR，q1时直接输出。失败才走原OutputPass，不能两者串联。
- `hdr-output.js:nativePresent`先`ensureNativeFloat()`，同步尝试候选；成功不跑旧HDR_FRAGMENT，失败才跑旧曲线。随后同一JS task立即`copyExternalImageToTexture`，没有await。PBO分支只报告`pbo-legacy-only`，不声称执行候选。
- `display-transform.js`有requested/preparation与SDR/HDR分别的effective/target/reason；只有实际`output.render()`成功才记`exact-target-rendered`。当前仅100/700/1270精确资产；默认校准若给1000或1200，HDR回legacy是预期边界，不是把700表换uniform。SDR100仍可独立准备并使用。
- 单位：传入是已存储scene RGB，exposure沿原C/P补偿只乘一次。官方函数输出1=100nit；HDR乘100/browserSDRWhite后一次extended-sRGB OETF，SDR100一次OETF。候选不再乘legacy纸白比例；Windows读数不等于面板实测。

## 最小实景程序与证据

1. 选一幅现有日景，再选已有夜间带烟花/烟的暂停状态；不为切换输出额外发射。固定UTC/天气/相机/focal/实际C和源强。记录`parameters`、`photometry()`、`smokeSnapshot()`、`fireworkClusters()`、`graphics()`、`lens`状态；按已有只读接口记录源ledger/field状态。正式采样前AA收敛，禁止用不同phase的两张图当DRT差异。
2. 同一暂停状态依次`await a.setGraphics({displayTransform:'legacy'})`、`aces2`、`legacy`；只等待有界rAF。每步记录requested、preparation、各surface effective/peak/reason、实际render计数；source/烟M、Σ、q、时钟、UTC、相机、C应不变。若P因既有安全预算合法变化，必须记录并验证实际C及pre-DRT master不变，不能强制写P。原始source hash前后核对；检查pre-DRT数值或样本，不能只用extrema相等冒充全图bitexact。
3. 暂停切换必须真正重呈现：native HDR时`presentedFrames`或`lastPresentationTimestamp`应增长，物理时间保持；随后应重新静止。`preparation:'ready'`或菜单选中不算实际呈现。拒绝在`preserveDrawingBuffer=false`停止重绘之后用`toDataURL`黑帧证明稳定；可见surface用compositor截图。
4. SDR q1与q<1各一次：候选SDR100实际生效，FSR仍只在q<1；不应新增第二次ACES/OETF。`a.screenshot()`明确强制`sdr:true`，这是100nit目标SDR导出，不是HDR surface截图/裁到1的替代品。截图helper额外重绘可能改变AA状态，先记native计数再导出，不用它检验nativecopy。
5. 真native HDR：显式选已验700或1270并关闭系统校准覆盖，核对实际`calibration`和browser white；记录桥mode必须为`float-canvas-external-copy`、有效surface为ACES2、GL/WebGPU error数组空。用已有桥只读诊断读取实际浮点或WebGPUcopy后的数值，见到>1是必要witness；同时核对100/white单位与实际physical viewport。菜单/SDR PNG不能证明>1或native显示链。原生HDR→关HDR→再开HDR、一次resize后同样确认有效surface和重绘。
6. unsupported1200与pending选择：保持具体fallback原因，旧曲线应真的画；恢复700后应真的切回候选。若实际环境仅支持PBO，保留`pbo-legacy-only`为明确未实现项，不把PBO的legacy图当ACES2通过。准备请求700↔1270/1200只检验最新请求最终生效，不在主renderer已有query时另启嵌套query。
7. finally还原输出模式、校准、HDR、AA/q和暂停偏好，不回退物理时钟、不清烟、不改锁定音量。保存native与强制SDR各自来源/尺寸、实际C/P、source hashes、WebGPU/GL诊断；不把两种DRT的正常中灰/高光差异当物理光源变化。

## 明确的未证明项与停止条件

module137门是在RGBA32F独立目标，性能13门为F16离屏图案，两者均未证明整个native桥/全场景帧时或面板nit。实景必须另保留连续帧时间；无需把CPU与GPU提交耗时相加制造“必增0.7ms”的结论。nativecopy不保证零拷贝。

目前源码未见重复DRT/OETF或在draw与nativecopy间await的确定错误。需特别防止将controller的“SDR已呈现ACES2”误读为“当前HDR surface已呈现ACES2”：两surface独立，当前校准峰值可能不受支持。若prep失败、fallback原因丢失、物理状态漂移、pre-DRT改变、浮点/桥错误或暂停不重绘，保留失败证据，不靠改I/C让图更像。普通GUI清晰可读与视觉偏好仍需实际看图，不由技术门自动通过。
