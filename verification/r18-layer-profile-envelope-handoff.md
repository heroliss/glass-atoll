# R18 菊类 profile 导演硬界接入

范围：只改 `firework-show-envelope.js` 与本任务CPU夹具/报告，未修改 FW/physics/compiler/main/lens，未运行 GPU。

## 接口

```js
getFireworkShowEnvelope({
  type: 'chrysanthemum',
  effectProfile: 'three-heart-v1', // 或 two-colour-v1；默认 legacy
  settings: fireworksSettings,
  origin: [base.x, base.y + .17, base.z],
  muzzleOffsetMetres: .66,
  azimuth,
});
```

显式options.effectProfile优先于settings.effectProfile。两候选只接受chrysanthemum；未知值、null、错误类型、非菊组合显式拒绝。导演遍历其他类型时应显式传`effectProfile:'legacy'`，不能给所有类型套用候选。legacy分支不新增返回字段，不改变原数值、对象key或说明字符串。

候选从独立纯模块 `firework-layer-profile.js` 导入冻结hard limits与validator。没有让physics导入envelope，不形成循环。只在候选canonical event校准时传effectProfile，以取得同compiler的life/drag；legacy canonical调用仍不带新key。

## 硬界论证

| 项 | 三芯 | 双色 | 依据 |
|---|---:|---:|---|
| 最大head life | 4.876s | 3.392s | 模板最长4.6/3.2s，固定lifeVariationFraction=.06，timeScale≤1.06；不是取有限seed最大值 |
| intrinsic速度范数 | ≤19m/s | ≤19m/s | 原菊球面方向×(13+6rng)，层倍率1/.7/.4或1；只缩放相对baseline burst velocity，不缩放carrier继承速度 |
| 点火延迟 | 0 | 0 | compiler不改birth，patch ignitionDelay0 |
| 推进 | 无 | 无 | propulsionKind none，未新增加速度/转向轨迹 |
| detached tail lag | ≤.35s | ≤.35s | 仍为菊原tail时程；carrier tail .50s保持 |
| body数量/drag | 192，旧drag类 | 同左 | compiler只patch life/profile/velocity，不patch drag/gravity |

envelope核这些contract的域，不接受未来推进、延迟、额外速度或超过4.876s的模型而悄悄沿用旧证明。

原carrier界完全保留：同nominal muzzle speed、launch cone、muzzle offset、apex fuse、piecewise wind component范围、burst position/velocity intervals。head模型仍为正线性阻力响应：初速的时间系数F=(1-exp(-kt))/k，wind响应核非负，其积分H=t-F；因此可用组件wind范围、最小drag的F和最大drag的H包围任意允许风历史。所有burst旋转被intrinsic范数19的球包围，不依赖某次方向采样。

候选只替换head最长时间与同不增大的S，随后沿用原区间传播及verticalTravelUpper。尾迹从已包围的body位置出生，继承1/4瞬时速度，drag1.35；原速度上界与lag界给出F/H位移padding。carrier的尾迹界另算，取两者较大者，所以候选的较短/较长star life不会取消carrier保护。

返回界只覆盖renderer floor以上的物理head/carrier/尾迹中心；Gaussian quad、快门/DoF/bloom支撑和持久烟尘仍由独立framing margin处理。仍保留原1e-5m算术padding；这是Binary64保守推导与源码hard contract，不是完整directed-rounding形式化证书。

## 实际CPU验证

`node --check firework-show-envelope.js` 与 `node verification/r18-layer-profile-envelope-check.mjs`：**5/5 passed**。

- 10种legacy×2drag×3elevation×2spread=120组，与保存的原envelope源逐值/字段/字符串完全相同；显式legacy亦同。
- 两候选life/S/delay/tail与pure limits一致，carrier、muzzle、drag、launch/burst区间不变。
- options/settings优先级与不支持组合拒绝。
- 64个有界候选/drag/低高pitch/宽窄cone/seed/风历史case，61760个body/carrier点与123520个detached-tail点没有越出界。包括任意大burst旋转以及正负3D风组件。有限witness寻找反例，不替代源码推导。
- 实际simulation configure/launch与event.effectProfile metadata均被核对，避免误测到legacy路径。

## body.id%3 的独立方向审查

当前原192点按id%3取三组时，各64点仍遍布整个球面；seed42每组八个卦限均有6–10点，没有误切成北/中/南纬度层。

但等面积原192球点的黄金角被stride3变成约52.523°步长，低点数均匀性变差。seed42原三组最近邻约13.11–13.41°，4096球面probe最大空隙约23.04–23.61°；独立64点Fibonacci参考约22.27°和18.78°。可能出现螺旋条带或局部挤点，已告root/FW作者；本任务没有修改方向。该视觉缺陷不损坏上述全方向范数硬界。若后续改各层独立球采样，仍需保持192个ID/预算、速度上界和统一burst旋转并另做画面验收。

## 文件与冻结摘要

- `firework-show-envelope.js`：`3df220694c02a641cdcaf320f70ff06475049e2ad751750f8ff391106e88dfd5`。
- 原envelope：`baselines/r18-envelope-before-layer-profile/firework-show-envelope.js`，`d89bb457d79eb9540798dca97565bb6b712fe4be2f6842ad38ecdb3806e9f050`。
- CPU夹具/报告：`r18-layer-profile-envelope-check.mjs` / `.json`。
- 被检查的compiler源：`197a651e98e6371495ff3726e4e7e0d06d98c7fd3fa2e8e63387d42168f7a01f`；physics：`9630b3c2078cb6cde39d9171e6f1fbb81b5499b6c4be6851f06a6d269b1d20ff`。这两文件由FW代理负责，后续改变需重核contract。
