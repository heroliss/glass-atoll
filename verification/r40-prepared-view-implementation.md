# R40 prepared source view：结构性交接

生产仅改 `fireworks.js`，最终 SHA `50895d4aeba191cd6817f344b3f728a305365e252eeaae7bb9fc96f3187815d8`。原 `03fdb703…c735` 已逐字归档到 `baselines/r40-before-prepared-views/fireworks.js`，备份 receipt 通过。原 vertex/fragment/material 源区 13,063 bytes 精确相同；没有改 source、burn、physics、audio、shader、采样数、packing 或任何 GPU 请求上限。

新增接口：

```js
const view = fireworks.prepareSourceView({
  camera, target, reflection, planeY, frame, optics, medium, legacySmoke
});
const info = fireworks.getPreparedSourceViewInfo(view);
// 联合预检拒绝时：
fireworks.discardPreparedSourceView(view);
// 通过后，实际按镜眼→主眼顺序，一眼一次：
fireworks.render({ ...sameViewArguments, renderer, transmissionBatch, preparedView:view });
```

`target` 可省；仅以原 render 的相同优先级解析 `target?.width || optics.width || 1` / height。句柄是冻结的空 opaque 对象，信息是冻结的纯标量摘要；不返回内部 sorted rows、rgb taps、typed ray buffers、snapshot、相机或 medium 引用。每实例至多 4 个未消费句柄。discard 对本实例已消费/释放/失效句柄安全返回 false，对别实例或伪造句柄拒绝。消费/释放立即清除内部大数组、snapshot、相机/medium 参数、keys 与 cluster/stats 引用；保留少量 owner/status/info。

唯一 `prepareSourceRows` 复用原 `opticalRows`→实际 culling→stable depth sort→original-double rays 算序。正常无句柄 render 仍调用该路径一次。准备句柄不调用 renderer、不调用 transmission prepare、不查询 medium 透射、不前进物理、不分配 requestVersion；它可以填充原有 CPU 光学/接触/投影缓存，并分配私有 CPU 射线数组。主眼/镜眼各有独占 rays，原逐行 taps 仍为原 optical-row 缓存所有，不被下一眼覆写。

真实 render 在 renderer/state/uniform 设置前验证 owner、一次消费、records generation、物理时刻、相同相机对象及完整已解析 V/P/world/eye、尺寸、near、shutter/legacyShutter、DOF/focal/aperture/focus/sensor、rawPerCandela、reflection/planeY、visibility/quality/模式、medium 对象及其实际 host 的 revision/time/requestedTime/tick/wind/profile/packet layout。generation/configure/visibility 变化立即释放旧句柄。storageEV 和 sceneScale 刻意不绑定，使 photometry 能在 preflight 后更新它们。

正常 host 提供 revisioned snapshot 协议：此门不声称认证任意伪造的“相同 header、不同密度内容”自定义 medium。公开 snapshot wrapper 每次可不同，不要求指针相等；实际 render 使用句柄保留的同一份输入 snapshot。请求版本只在真实 batch 提交时按原规则递增；准备主眼再准备镜眼，不会改变实际镜眼先提交的序号。

prepared 正源请求若 batch unsupported/throw/stale，直接抛错并释放，不进入逐源 CPU fallback，不画 FW。旧无句柄调用的原 CPU fallback 保留。inactive/no-source 属于 neutral，不将其称为有源 GPU 成功。没有在生产 preflight 中使用测试的 fake ack。

CPU owner **6/6**，独立源码/已存结果审查通过。实际旧/current factories 以固定 0/2/7.55 三个解析时刻构建同两事件，未重复完整生命周期。旧默认、新默认、新 prepared（准备主眼+镜眼，绘制镜眼→主眼）的两眼各 2,418 行满足：

- 历史 R39 全 original-double endpoints/origins/mask 逐值相同。
- 12 个有效光栅属性、排序/每行 taps 全相同。
- 每眼完整 281,600 个 padded packed U32 words 相同。
- ledger 全容量 Float32 words、实际 source descriptor 与正常 view metadata 相同。
- 准备时 request=0；实际提交版本恰为 1、2。
- storageEV/sceneScale 更新允许；15 种真实视角/源/密度失效在 renderer 访问、GPU prepare 和 medium queries 前拒绝。
- legacy 三 visibility modes、empty、single-use、cross-instance、dispose、4-cap→discard→reprepare 通过。
- prepared unsupported 为 0 medium queries / 0 FW draw；旧 default 同 fixture 仍按旧合同执行 2,418 个 fallback queries。

首 owner 5/6 仅为无效测试：直接改 `matrixWorldInverse` 会被正常 `camera.updateMatrixWorld()` 重算，实际有效相机没有变化。原测试/失败报告已保留；只换成实际 world-matrix 变化后 6/6。补 discard 前的 `e872…` 与原 6/6 也独立归档。

普通 main 尚未调用 prepared API，联合生产预检/共享 SH 接线未完成；本次没有浏览器、GPU、native frame 或性能收益验收。后续调用方必须在任一联合预算拒绝时 discard 两个句柄，并只在全部当前输入通过后进入正常数值和场景事务。

完整 hashes 见 `r40-prepared-view-receipt.json`（`fb099cc9…8dde1`）；owner report `7d29ea82…f0c4d`；独立审查 `r40-prepared-view-independent-source-review.json`（`5d7c5618…b3ff8`）。
