# 烟花空间矩照明代理：候选与兼容验证

本轮仅新增可选 `clusterModel`。工厂默认仍为 `legacy`；没有改变烟花半径、轨迹、展开时间、随机序列、头尾记录、总参考强度、颜色或 PSF。新模型是否改善黄亮棉团，仍由主场景同相位 A/B 判断；CPU 通过不代表照片级或实景 GPU 已验收。

## 接口

```js
const fireworks = createFireworks(THREE, { ...options, clusterModel: 'moments' });
fireworks.configure({ clusterModel: 'legacy' }); // 可实时切回
fireworks.configure({ clusterModel: 'moments' });
```

只接受 `legacy` / `moments`；无效工厂参数在创建几何前拒绝，无效配置在修改物理设置前拒绝。`configure` 会先剥离 `clusterModel`，物理模拟不会收到此字段；返回值和 `diagnostics()` 报告模型。切换会失效 cluster cache 及预算诊断缓存，不重新生成事件。

`getLightClusters()` 在 `moments` 下保留原有的强度加权质心、RGB、`referenceCandela`、`intensity`、event ID 和 path flags，再使用同一当前发光头/尾记录计算：

- `rmsRadius = sqrt(Σ Iᵢ |pᵢ − c|² / Σ Iᵢ)`。
- `radius = max(2m, rmsRadius)`，不再使用旧的 28m 上限。
- `maxExtent = max |pᵢ − c|`，仅计正强度记录，作为诊断，不充当光照半径。
- `illuminationModel` 明确标记为空间矩有限半径点代理，而非精确面光源。

`legacy` 的半径与返回字段完全保留，不额外插入新 cluster 字段以破坏旧消费者的精确比较。其诊断模型为旧 `age × 8` / 2–28m 规则。

## 实际 CPU 证据

[cluster-moments-check.json](fireworks/cluster-moments-check.json) **14/14**：独立加权 Welford 方差 oracle 对照 10 类事件的 45 个有光相位；RMS 最大绝对差 `1.01e-12 m`。默认/显式 legacy 对照 B95 的 50 帧、14,292 个实际上传实例，clusters、排序、实例属性、事件与预算均保持一致。

退化与边界包括单点 RMS=0/radius=2m、零强度不形成支撑、非对称加权两点、40m 半径不再截到28m、刚体平移/坐标置换、同位源拆分、1/4/16/64强度倍增、实时切换、无效配置原子拒绝。近场照度的有限性/单调性只证明当前 `I / max(d², radius²)` **代理本身**，不是空间分布真实火星的照度上界。

笑脸 seed42、展开后1.1s、8尾段、风 `[1.8,0,.5]` 的同一记录：

| 项目 | 结果 |
| --- | ---: |
| 总参考强度 | 715.287328107 |
| 旧 radius | 8.800m |
| 新 RMS radius | 17.951838917m |
| 最远正强度记录 | 21.820293550m |
| 新/旧质心代理照度 | 0.240297 |

这是约 `4.1615×` 的旧/新近场照度比，来自代理的空间尺度调整；没有改变源强，也不是按未知曝光实拍反推出的物理标定。

已重跑当前源回归：

| 回归 | 结果 |
| --- | ---: |
| optional medium/default | [12/12](fireworks/medium-compat-check.json) |
| 历史轨迹 bounds cache | [16/16](fireworks/past-bounds-check.json) |
| scalar projected radiance budget | [7/7](fireworks/scalar-bound-check.json) |
| HG 传播方向独立 oracle | [10/10](pyro-smoke-phase-check.json) |
| 物理机械/拓扑 | [22/22](fireworks/physics-check.json) |
| 源强倍率/default1 | [17/17](fireworks/intensity-scale-check.json) |

运行顺序（scalar 会检查当前 phase/past 报告，medium 会检查当前 intensity 报告）：

```powershell
node verification/fireworks/cluster-moments-check.mjs
node verification/pyro-smoke-phase-oracle.mjs verification/pyro-smoke-phase-check.json
node verification/fireworks/past-bounds-check.mjs
node verification/fireworks/intensity-scale-check.mjs
node verification/fireworks/medium-compat-check.mjs
node verification/fireworks/scalar-bound-check.mjs
node verification/fireworks/physics-check.mjs
```

## 范围与保留问题

RMS 是当前发光头尾空间分布的二阶标量代理。它减弱“已铺开火星仍聚在很小发光球”的近场放大，但没有解析环形/多峰分布，也没有解出质心附近各个来光方向的 HG 积分、真实面积、遮挡或烟自阴影。2m floor 仍为保留的近场代理规则，不是烟花的实物半径。没有增加 glow、重标颜色或修改半径/展开时序。

采用两种模型的主/镜像光照、烟与云均须消费同一 clusters；选择 P 前的 raw bounds 也须来自所选模型。工厂默认未切换；主代理负责生产显式选择与同 camera/seed/phase/C/optics 的实景及 GPU 数值验证。

## 冻结与旧失败

- B95 完整源码与同轮物理/风/QA：`verification/baselines/fireworks-before-moment-clusters/`；原源码 SHA256 `b95bbcb76eab4f864d51e5155fc6860d3cc8b0c16c4254805aa97666a50714d0`。
- 当前 `fireworks.js` SHA256 `077ea21a5bb294bd459ac6ec396547fb2dc878d1cc32187b76c07fcec3fb12b2`。
- 当前物理 SHA256 `d60c1ec9d2f5ccffc36ff1517868af990897299a22547fa1d8fb802370a2d045`、wind SHA256 `dfa1ba96c3b8d5fb1d35853392874678c46200ad98ffb8b7306c91cbba71bca1` 与 B95 封存逐字节一致。
- QA normalizer 只逆转六个精确匹配一次的 cluster 编辑，即可逐字节还原 B95；再逆转原五个 medium 编辑，即可还原原完整 runtime 源。不做宽泛块删除或空白归一，另有缺失/重复/无关修改的 fail-closed 检查。
- [首轮 medium 11/12 失败原报告](fireworks/cluster-medium-pre-intensity-scope-failure.json) 保留。唯一失败是旧测试要求当前 d60 物理字节等于更早5a61，而之前已授权的 `intensityScale` 扩展改变了物理文件。现在改为本轮 B95 物理字节相同，并要求独立 intensity17/17 的旧默认事件/RNG等价证据与当前源码 hash；旧5a61 baseline 与原失败不改、不删除。没有放宽数值容差，也没有为通过测试回退源强功能。
