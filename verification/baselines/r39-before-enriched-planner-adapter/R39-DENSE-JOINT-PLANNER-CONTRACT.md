# R39 完整三消费者 QA 规划器

源码 `verification/r39-dense-joint-planner.js`，SHA256 **87a4016a68ecc3d7e19a0f4a6df76a2e0124e5a1a7d3d3bd4190efa887f53283**。focused CPU 检查 `r39-dense-joint-planner-check.{mjs,json}` **7/7**，约 0.51 秒，无大场景模拟、浏览器或 GPU，生产源码保持原哈希。

接口只有完整输入捕获、CPU 规划和身份比较，没有 dispatch/completion/texture/publication API：

```js
const receipt = captureR39DenseJointEpoch(actualFixture, {maxOwnedInputBytes});
const result = planR39DenseJointWork(receipt, {
  policy: 'current-4m', // 或明确的 QA candidate-12m
  transmissionStorage: 'two-retained', // 或显式 single-borrowed
  budget, // 所有 primitive aggregate cap 必须明确提供
});
```

`capture` 在尺寸检查和 payload 上限之前不克隆完整输入；通过后私有保存原始 snapshot、原始双精度两眼 rays/masks、完整顺序源关联、完整 padded ledger words/groups 及当前 metadata。输入 mutation 不改变既有 receipt，假造 receipt/flags 不获私有身份。只比较声明的捕获原件，不冒充物理模型、SPD/光学 conditioning 或 GPU 认证。payload 以数值及 UTF16 内容收费，不是 JS heap 测量。

两个 view 必须对应实际 main/reflection 标记、count、sourceVersion、cameraKey、densityRevision 和同一 opticalRecordGeneration；原始 eye 中的 −0 保留。source/ledger 时间精确绑定 phase.time。当前真实 fixture 中 **optical generation156 与 ledger generation51 是独立序列**，绝不要求两者相等。committed density.time 是 7.550000000000001，requested/source/ledger time 是 7.55：按保存的 requestedTime 和 density metadata 各自精确匹配，不重写、不用 epsilon，也不把两个时钟错误合并。

当前 4m 调用生产 pure layout/SH planner；12m 调用独立的 QA copies `r39-dense-layout.js/r39-dense-light-tiles.js`，沿用原始 64 项 rectangle decomposition。生产上限和 constructor 默认值没有放宽。固定策略分别是 4m/每 map1m/8 maps 与 QA12m/每 map1m/16 maps，不接受任意额外 cap 参数。拒绝的4m工作仍列出完整潜在几何，不把被拒绝计算伪装成零成本可执行任务。

## 当前完整快照

P1663、main2418、mirror2418、ledger2413；两眼原始 rays 非空且不同。私有原件 payload **8,102,733B**。

| 任务 | logical pairs | 完整 partial cells | padded64 slots | map+reduce draws | 完整输出+最多8个partial读取 |
|---|---:|---:|---:|---:|---:|
| Tmain | 4,021,134 | 62,868 | 4,023,552 | 6+1 | 38,816B |
| Tmirror | 4,021,134 | 62,868 | 4,023,552 | 6+1 | 38,816B |
| SH一次 | 4,012,819 | 63,194 | 4,044,416 | 6+1 | 80,208B |
| 总计 | **12,055,087** | — | **12,091,520** | **21** | **157,840B** |

归约 texture fetch 总数315,318（SH计三张纹理）；数值 raster198,146 texels；固定 padded uploads2,768,896B。该 SourceT count 包含提交请求中的全部顺序行，不能用 active/zero-length 个数减少 pair 账目。

当前4m三任务都 `pair-work-capacity`，整笔 reservedWork 全零。QA12m primitive budgets足够时，可返回**仅模型的**全部 reservation；`actualGPU/effective/productionAdmitted/readyToPublish` 永远 false。任何任务或总 cap失败，同样全零 reservation，不允许半发布、旧纹理替换或大批 CPU fallback。

单 borrowed T field +一次 SH 的固定数值GPU存储 **14,622,720B**：每眼的匹配 T 必须先消费/读取，再 prepare 下一眼，不能等到 joint结束再读两眼。同代数值 joint若保留两眼结果，必须是两套 T field +一次 SH，**19,329,024B**。这两种模式工作次数相同，不用降低内存统计来少收费。CPU upload buffers另计；这些不是整场景/驱动 VRAM实测。

historical P3364/T3112/T3112/SH3101 另有 counts-only 检查：31,369,300 pairs、31,661,312 slots、39 draws、824,380 fetches，不能重标成当前 fixture。counts-only 无原件身份，哪怕 arithmetic supported，reservation仍全零。

检查覆盖原生产普通域、矩形尾行/neutral行为、上述当前与历史算术、全部10个 aggregate cap逐项低1拒绝、私有copy/−0/输入mutation、15个 stale/missing/cross-kind/mask/word/clock拒绝，且保持三任务不能共享两眼T。没有新数值内核、scheduler、在线 oracle、纹理发布或硬件性能结论。root当前授权的单个 main T 数值门与这里的完整三任务模型是不同范围。
