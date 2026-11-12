# 过去段矩源核 V2：冻结CPU候选

V1实景技术23/23通过，但规则亮球/中央棉团已被视觉拒绝；V2不因CPU通过而默认胜出。此轮仅扩展host/source adapter并新增纯math模块；原V1 point/.20与legacy9默认保持。state、renderer、physics、audio、fireworks只读provider与旧sourcePackets源码均未改。

```js
createPyroSmoke(THREE, renderer, {
  time, wind, sourceModel:'trajectory-v1',
  sourceProvider:fireworks.smokeSourceProvider,
  kernelModel:'past-segment-v2', // 默认'point'
  centralFraction:.05         // 默认.20，必须独立A/B
});
```

四组同event/同source batch：point/.20；segment/.20；point/.05；segment/.05。只有选中host渲染与参加P预算，其他为QA物理对照，声音仍消费一次原数组。两选项固定在构造时，不能改已出生物质。legacy9收到非默认核选项会拒绝，避免假开关。

## 实际核定义

仍为launch9+centre3+root12，总24/空中单发，burst20、连launch共20.35。中心.05时面积1，轨迹19；.20时仍4/16。release ages仍.35/.65，选择与参考物质分配不读I/RGB/C/P/画质。

每个代表root采用出生后[.05,.35]或[.35,.65]的过去窗口，5个正权Gauss-Legendre节点。源在窗口end提交；不采未来，也不声称在提交前已连续排出了这些M，时间求积延迟最多.30s。

对每个τ节点，先将该点烟推进到共同birth b：

`yτ = star(τ) + integral(W, τ..b) + [0, nativeThermalRise(b−τ), 0]`

`Cτ = σ0² I + 2 diag(K) (b−τ)`，σ0=.30m、K=[.6,.12,.6]。

σ参数名sigmaPerp，但实际是三轴相同的**各向同性初生核**，不只二维横截面；长轴由真实年龄化轨迹分布生成。按相同native cool12s/drag2s/ambient300K同时得到年龄后的温度与浮速。

统一正权归一后：`μ=Σwy`，`C=Σw[Cτ+(y−μ)(y−μ)ᵀ]`，热/浮速也取加权均值；M保持原分配。局部原点求矩避免大世界坐标的二阶矩相消。σ0>0、K≥0与正权保证完整SPD；旧state/columns/GPU现有Cholesky直接消费，不改光学g、源I、shader或质量。

## 风与事务

source history只记录**host实际setWind使用的同timestamp held输入**，不是star drag位移，也不读未来恒风预测。保留完整所需窗口及其前一held值、最多1024 knot，超过则在提交前拒绝，不量化、不丢段。history属于prepare候选，只有commit才安装；input/provider/容量失败不改变物理状态或风历史。clear取消全部未出生reserve并将历史origin重置到新的当前物理state；默认point不维护额外风历史。

单次host仍受旧state200个20Hz tick的catchup预算；失descriptor/风因果或预算不足都显式拒绝。prepare/commit依赖同一同步主线程内provider不变，不具有独立provider版本检测。意外底层queue故障仍披露已接受包并fault-lock，不虚构rollback。

## CPU结果

[独立math](pyro-smoke-source-moments-check.json) **12/12**：

- 热/浮升年龄对独立RK4最大误差4.26e−14。
- 曲线+native热/风/扩散矩对4097点独立RK4+Simpson最大误差7.82e−14。
- fullSPD旧state/sharedCPUcolumns与独立密度数值积分吻合约1e−15；不是另造对照公式自比。
- 5节点突变风相对连续积分的mean差−0.548mm、variance差+0.000713m²被保留：这是有限节点代表混合，不能称任意风下连续积分精确。
- 出生后2s的实例，丢失热/速度—位置cross covariance使C差0.0261m²；均值在线性native模型下仍吻合。只承诺**birth时该代表5节点混合**的M/μ/C闭合，不承诺未来协方差精确。

[实际生产source CPU](pyro-smoke-trajectory-v2-check.json) **10/10**：整个冻结V1 factory的point默认逐包/账本等价；同event四host总量/核/比例独立；双发48包/M40.7在30/60/120同timestamp输入下逐字节一致；真实provider节点birth μ/C oracle；provider失败与1024 knot容量失败完整不装state/history；clear与边界选项检查。

Point默认原29/29、legacy host20/20、events36/36、state50/50再次通过。首个point scope检查28/29失败保存在 `pyro-smoke-v2-point-scope-first.json`：旧fail-closed测试试图删掉已被V2替换的整段文字，实际上成为no-op；现逐层exact inverse后再检查对应旧层，另对V2每项缺失/重复独立检查。不是更改物理容差或掩盖runtime失败。

运行：

```powershell
node verification/pyro-smoke-source-moments-check.mjs
node verification/pyro-smoke-trajectory-v2-check.mjs
node verification/pyro-smoke-trajectory-check.mjs
```

## 实际画面准入仍由root完成

12代表仍可能是12条亮香肠；更窄核固定M会提高局部τ，不能以源强/亮度系数补偿。原K继续在birth前后增宽，到phase1.1不会保持.30m。需读取实际上传/年龄后eigenvalues、投影aspect、τ峰、5sqrt(traceC) proxy quad覆盖与main/mirror真实GPU成本，不能从包数推FPS。旧V1 scene helper的“root mean等于end star点”只适用于point；segment均值本来在过去段烟的共同年龄位置，须用矩oracle而非错误判为位移故障。

保留条件均值散射、无自遮挡/多次散射/CFD等旧边界；瞬时合并也未保留未来热/速度cross covariance。四组实际图片/范围/成本和视觉选择尚待主代理，CPU通过不代表照片级。

## 冻结

V1封存 `verification/baselines/smoke-trajectory-v1/`。V2严格inverse只移除明确匹配一次的可选扩展，可逐字节恢复完整V1 host/adapter；原legacy归一链继续恢复更早基线。当前hash：

- `pyro-smoke.js`：`17d2193ff88bf97d7a581c364ab81350412655e073dfc59ed964eb45e5a4c398`
- `pyro-smoke-trajectory-events.js`：`021e248c03ce8e3fc4b0651d555214efa6d7d6ffa42a1345a8650618d707a840`
- `pyro-smoke-source-moments.js`：`eb2c2e3d4150e042428a6cc8ab4cad061a4bcd9b0b34cdb7270f62f7074e7ac0`
- `verification/trajectory-v2-default-normalize.mjs`：`342b9895f4f70eca6ea92a5ed7cbd10c03419381ea23682c2708debf20f20434`
- `verification/trajectory-default-normalize.mjs`：`bc253a33b3acef1fd24b661c3699ba1331f7bc8444518d8d3611b56288557ed4`
