# 可选烟花源强倍率（独立阶段）

此阶段未接主场景/UI，默认仍为 `1`，也未据此选择新的生产源强。`intensityScale` 是作者参考发光强度的线性倍率，不代表已完成商业烟花绝对测光标定。

## 接口与不变量

```js
createFireworkEvent({ ...options, intensityScale: 1 });
simulation.configure({ intensityScale: 4 });
simulation.launch({ intensityScale: 16 });
```

- 接受有限数值 `0..64`；无效 factory/configure/launch 输入抛出 `RangeError`，配置验证先于设置写入。
- `configure` 仅影响之后实际生成的事件。已发射事件保持原强度；队列里显式给出的倍率保留，省略时使用实际生成时的配置。
- rocket、heads 和 child bodies 构造完成后统一各乘一次；默认 `1` 跳过乘法，保留旧数值及 RNG。尾迹由 body 强度继承，不再乘倍率。
- `0` 保留轨迹、几何 records、活动槽、烟源事件、声音事件时间/位置/energy，只使光源强度为零。
- event、实际即时 launch 返回值及 active-event diagnostics 记录倍率。尚未生成的 queued 返回值不假装已有实际事件倍率。
- 声音模块未改动，锁定 SHA256 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。

## 已运行验证

`node verification/fireworks/intensity-scale-check.mjs`：**17/17**。原 `physics-check.mjs` **22/22**、`smiley-height-check.mjs` **37/37** 同时通过，阈值未放宽。

新增检查包括：99 个默认/显式 `1` 事件与保存的 `5a61` baseline 的所有旧字段逐值一致；十类在 `1/4/16/64` 下完整非强度事件图一致；crossette 父/子星不重复乘；五种 palette、四种 smiley layout、分段风和 30/60/120 分帧保持原轨迹；无效配置原子拒绝；真实生产 `createFireworks` 的光簇及 main/mirror radiance bound 线性变化。

固定 peony seed42、爆后 1.1s 的生产 CPU 结果：

| 倍率 | 光簇参考 cd | main raw bound | mirror raw bound | records |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1277.390823 | 0.2974403 | 0.1288069 | 239 |
| 4 | 5109.563293 | 1.1897612 | 0.5152276 | 239 |
| 16 | 20438.253172 | 4.7590447 | 2.0609104 | 239 |
| 64 | 81753.012689 | 19.0361790 | 8.2436417 | 239 |

这些是实际生产 CPU 导出函数的参考值，不是 GPU 图像、全场景能量或 FPS 验收。现有光簇 `1e-6` 过滤阈值未改，线性数量不变量仅针对远离该阈值的活跃阶段；倍率 `0` 返回空光簇。Y 归一颜色的 RGB 最大通道独立于参考光度倍率，不能把蓝色 RGB 最大值当成 cd。

## 冻结证据

- `fireworks-physics.js`：`d60c1ec9d2f5ccffc36ff1517868af990897299a22547fa1d8fb802370a2d045`
- `intensity-scale-check.mjs`：`0d47c324d7f61515320f4d56a697e1be94f9d0938013a0cbd19d478e0477008e`
- 完整结果/其他被测源 hash：`intensity-scale-check.json`。

后续固定相机、同相位与一致 P/C 的真实 GPU `1/4/16` 对照，由主代理运行后再决定源强。此阶段没有改 P/C、主场景默认输出、音频增益或烟量。
