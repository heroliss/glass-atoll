# 实际发光源账本与烟光场 CPU 上界

状态：独立模块已冻结，默认生产路径不启用新光场。这里的 CPU 通过不代替 GPU 特殊函数、颜色、实际场景或性能验收。

## 接口

`fireworks.getEmissionLedger({rawPerCandela=3.6e-5})` 返回冻结的元数据：`version / recordGeneration / time / count / stride:8 / capacity:14000 / data:Float32Array / groups`。每行是：

`[worldX,worldY,worldZ,radius²/5, rawR,rawG,rawB,groupIndex]`

rawRGB 使用实际当前 `record.intensity × colour × rawPerCandela`，随后存入 Float32；不使用 `unmodulatedIntensity` 上限，不包含可见相机筛选、传输、P、烟质量或 smoke 记录。最多两个完整事件组；各组 min/max/sumRawRGB 均从实际存入的 Float32 行重建。没有可见度裁剪、静默截取或只取最亮源。

不调用此接口时，没有新源遍历、打包或数据缓冲分配。缓存以私有物理 records 数组代次及 raw 标度为键；相机、曝光和 draw 不改变返回对象/版本。`recordGeneration` 是账本观察到的 records 代次数，不是帧计数。借用的数据缓冲复用，**有效期截至下一次在 records/raw 标度改变后调用此接口**；调用者须立即上传或自行复制，不能写入该缓冲。元数据冻结不意味着 TypedArray 被物理保护。

独立模块 `pyro-smoke-light-bound.js` 导出：

```js
boundSmokeLightField({
  ledger,
  packets: {data: Float32Array, count, stride: 4, capacity, version},
  anisotropy: .32,
  shaderRelativeError: .002
})
```

packet 行严格为 GPU 同一上传值 `[meanX,meanY,meanZ,Float32(traceΣ/3)]`。返回 `maxRGB / maximumRGB / margin / diagnostics / ledgerVersion / packetVersion`，均在 P 之前。每次先核实全部源行与组索引、数量、AABB、RGB 和；然后仅做每包×最多两组的计算，不做每包×每光点。

## 上界与数值域

对每个上传包的 `b>0` 和每个源组，计算包均值至上传源 AABB 的最短距离 d：

`EgroupRGB ≤ sumRawRGB × min(1/b, 2/d²)`，d=0使用1/b。

两组先相加，再乘 `(1+3|g|)/(4π)`，最后跨包/通道取最大值，不乘包数量或烟质量。该式约束合同定义的归一各向同性 Gaussian/SH1 模型，不是完整各向异性射线 RTE 或全场能量守恒证明。

正和 FP32 误差用 `γ(N−1)=(N−1)u/[1−(N−1)u]`，u=2⁻²⁴；另加 γ96 算术裕量、声明的0.2%特殊函数误差，以及组和的 binary64 正和修正。N14000时总浮点/函数裕量约 **1.00284251**。0.2%是待实际 GPU 特殊函数独立核对的实现容差，不是已测保证；若 GPU 不满足，不能仅凭本上界通过声称合格。

最多14000源、4096包；SH1 非负域要求 `|g|≤1/3`。不支持的容量、缺失组、非有限/负 RGB、上传不一致均明确抛错，不发布删减光场。包 b 必须是正的正常 Float32，避免 FTZ 将次正规数冲零。还检查平方距离、合成方差和原始系数的 Float32 安全域；原始上界超过 `Float32Max/16` 时拒绝，不能靠后续 P 降低来修复 raw 光场溢出。

## 已完成的 CPU 证据

- [账本检查](fireworks/emission-ledger-check.json) **13/13**：10类实际工厂共7260源的完整行、当前/上限 I 区分、Float32 组和、两个事件、退休清零、相机/P 缓存不变、14000容量及失败前缓冲不变。两处精确逆向代码可逐字还原冻结的 `b1b1ac57…`，包含原深度裁剪修复，物理/声音/渲染上传未改。
- [上界检查](pyro-smoke-light-bound-check.json) **19/19**：800对独立 Laplace 积分、组和/AABB、有限发光核、零源、无质量/P、包复制不增亮、平移、容量/元数据/溢出异常及最大源数裕量。独立积分对包络最大比值约0.315；这个随机样本比值不是通用紧度承诺。
- 原 physics **22/22**、audio **12/12**、HG **10/10**、scalar **7/7**、past **16/16**、clip **11/11**、trace **6/6**、cluster **14/14**、intensity **17/17**、medium **12/12** 保持通过。QA 默认逆向链显式先移除两处授权 ledger 改动，再核旧 clip/trace/provider 层。
- 4096包/240源 CPU 上界示例暖机约1–1.3ms；这是本机 Node 的组上界成本，不是 GPU bake 或场景 FPS。独立 GPU 与实景验收由根代理集中完成。

保留初次两组/单组合并测试失败 `pyro-smoke-light-bound-different-source-count-margin-first.json`：二源具有 γ1、单源具有γ0，不能比较含不同裕量的结果完全相等；校正测试比较去除各自已声明裕量后的数学值，未改运行时。另保留 `fireworks/medium-stale-intensity-ledger-first.json`：测试依赖的旧 intensity 报告 SHA 过期，先重跑同源 intensity 后 medium12/12，无运行时修改。

冻结 SHA256：`fireworks.js` **76b87313d4f0532098daeddc9e3bb71cf107bc14fc8307d20db1fa8289656f5a**；`pyro-smoke-light-bound.js` **63685694e78e6d5ed223ffdabd777288615153851abf08342d489048a356bca4**。
