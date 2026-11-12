# R37 第二机会：只取发光数据的燃烧曲线采样

状态：只读审查和有限 CPU 诊断，**未实现候选、未修改生产、无浏览器或 GPU**。本轮仍先处理投影候选；这里不是新的并行实现任务。

## 实际依赖

`firework-burn-profile.js:100–103` 的 `sampleBurnProfile` 总是计算 `materialCDF`。`sampleMaterialCDF` 对材料曲线内部年龄调用补偿积分 `area`，再除以已经在 WeakMap 内保存的归一化面积。WeakMap 缓存的是编译数据和归一化，不是每个年龄的 CDF 值。

当前生产文件搜索中，`materialCDF` 只出现在这个返回对象；没有光学接收方读取它。调用链是：

- `sampleProfileBodyEmission` 先取得完整对象，再补 `allPhaseMaximumRGB/envelope/effectProfile/layerId`。
- `sampleBodyEmission` 转发这一路径；物理粒子组装只取包络、RGB、强度、色度和全时上界。
- `fireworks.js:558/569` 的当前头部与离散尾部也只读取这些发光字段。它们不会从 CDF 得到烟量；现有连续逻辑烟源有独立的物质时间表。

已有优化不能重复算作新机会：正宽度的八段快门在 `sampleProfileBodyEmissionWindow` 内已经直接积分 RGB，没有逐 tap 调用完整采样器；`verifiedWindowProfiles` WeakSet 使一次合法性验证只做一次。宽度为零的窗口仍调用完整采样器，但普通 `1/120s` 路径不是这个分支。FW 还已有按 records/shutter 的光学记录和运动锚点缓存，两个视图并非把所有曲线积分再算一次。

## 有限测量

脚本：`verification/r37-emission-cdf-cost-probe.mjs`；报告：同名 `.json`。实际当前 `createFireworkEvent` 生成 192 个不可变 R36 radiant 曲线实例，沿用成功录像 seed 341070、真实发射时间/原点/角度/朝向和 G16 参考强度。没有构造替代曲线，没有采样像素。Node 与浏览器严格物理身份不作等同。

按当前源代码重建 N8 点采样工作：

| 爆炸后物理年龄 | 物理粒子点 | FW 头部点 | FW 尾部点 | 总点 | CDF 内部积分 / 边界快路 |
|---|---:|---:|---:|---:|---:|
| 0.7s | 192 | 192 | 1408 | 1792 | 1792 / 0 |
| 1.7s | 192 | 192 | 1536 | 1920 | 1920 / 0 |
| 2.5s | 176 | 192 | 1536 | 1904 | 1875 / 29 |

这些是接触过滤前的源代码工作集；物理粒子的海面判断使用静风原生运动。不是实际帧探针、完整地形接触或两个视图自适应行数。所有实例只有 4 个 emission knots、3 个 material knots。

本次 0.35 秒 CPU 进程内诊断、每方法 3 次预热批和 8 次交替顺序测量批、每批 22,464 次调用，中位数约为：

- 完整 `sampleBurnProfile`：466 ns/点。
- 单独 `sampleMaterialCDF`：227 ns/点。
- 完整 `sampleBodyEmission` 包装：495 ns/点。

1.7s 工作集乘以单独 CDF 的测量值约 0.44ms，只能用作机会大小的直觉，**不能当成可兑现的整帧节省**：孤立循环显式读取 CDF，真实调用者不读取，JIT 可能产生不同的内联/消除；GC、分配、调用和缓存亦不能用两个独立中位数相减证明。它不解释先前十余毫秒的整段 CPU 成本，更不保证 FPS 提升。

首次报告只有 `wallSeconds` 单位误写为毫秒，原脚本和原报告保留为 `*-before-wall-unit-fix.*`；修正后复核仍保持全部输入和生产文件哈希不变。

## 未来最小接口边界

如果投影改动完成后仍值得测，建议新增一个明确的 `sampleBurnEmission(profile, age)`：同样用私有 `requireProfile` 验证实例、同样有限年龄检查、同样 `pointAt`、同样 photopic Y、同样 `colour` 和次正规阈值/原始 RGB 保留逻辑，只不求 CDF。不要重写插值顺序、归一化、年龄边界或 RGB 运算；不要引入新的年龄缓存或按帧随机。

为真正保留旧 API，现有 `sampleBurnProfile` **连返回字段及属性顺序都保留**。`sampleProfileBodyEmission` / `sampleBodyEmission` 现有返回对象也暴露 CDF，因此不能只把它们的内部调用直接换掉，然后宣称 API 不变。可选的窄路由是新增对应的 emission-only 包装入口，只有 FW 头/尾和物理粒子组装三处内部光学消费者改用；旧函数、材料 API、标定初始化和烟源时间表继续走旧路。预计涉及 burn/layer/physics/FW 四个小接缝，而不是改通用 shader 或烟源。也不能用懒 getter 偷换旧 API 的求值/错误/属性语义。

未来验收应先做全部旧完整 API 精确输出保留，再用真实全阶段/零强度/延迟/边界曲线比较 emission-only 共享字段与旧 sampler 的 `Object.is` 结果；随后同输入实际光账本、尾迹快门和接触结果精确比较。只有通过后才测实际调用链 A/B。新波形增加 emission knots 会提高点插值扫描成本，但不会自动提高这个独立材料 CDF 的 knot 数；不能把尚未实现的 96-knot 波形成本当成当前收益。
