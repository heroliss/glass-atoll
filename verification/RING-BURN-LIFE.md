# 笑脸根星燃烧释烟：opt-in CPU 准入

状态：实现冻结，**未提升生产默认，尚未通过实际I1动态/视觉/场景成本验收**。合同见 [RING-BURN-LIFE-CONTRACT.md](plans/RING-BURN-LIFE-CONTRACT.md)。本轮只改source adapter，增加纯计划库及其QA；state、host、main、FW、physics、audio、renderer均未由本实现修改。

接口：`createPyroSmokeTrajectoryEvents({…,emissionProfile:'ring-uniform-burn-v1'})`。默认 `'two-births'` 不变。新模式要求 past-segment-v2、48代表根、中心.05、原20+.35预算；当前ring descriptor必须有120个原生根、ID0..119和原生life范围。非ring仍使用two-births释烟，`recentSources[].sourceProfile` 明确给出non-ring-not-applicable；这**不意味着整个现代QA host与旧生产其他类型的所有参数相同**。

纯库 `pyro-smoke-ring-burn.js` 提供 `ringFirstCellSeconds(bodyId)`、`createRingBurnCells({descriptor,selected,totalMass})`。不读取未来XYZ/风/I/颜色/RNG；首格由稳定body.id错相，随后≤.30秒，最后准确到原根life。GL5只在格内部查询实际过去轨迹，沿用现有时龄/风/Taylor/fullΣ闭合。极小末格与前格重新均分，既不丢质量也不制造不能表示的采样点；绝对时钟精度不足会明确拒绝。

[针对性检查](ring-burn-profile-check.json) **13/13**：

- 12处精确逆向代码可逐字恢复冻结adapter `e351e568…`；ring/crossette/fan/bouquet四组完整默认输出、状态及diagnostics与旧实现相同。
- 33种子完整计划617–633包；理论每发≤684。固定实际工厂seed42得到628包（旧空间代表选择的浮点tie/发射坐标可使研究frame的627变628，选择器未改）。单发源物化后M20.35、reserved0。
- 同一已知held-wind输入在30/60/120Hz下，EmissionID/出生时刻/质量相同；出生与最终状态的μ/Σ/q/热量/浮升最大数值差约 **2.93e−14**。没有风量化、未来采样或退休历史重建。
- source I1与I16/blue两种颜色输入得到相同计划和密度；产烟率不随发光或strobe改变。
- clear取消完整未来预留、旧burst不复活，同刻新event ID合法；可预测provider/容量错误在提交前保持状态/预留/IDs不变。底层queue第二包意外失败则真实保留已提交的1包并fault-lock，不伪称回滚。
- 支持provider仍有完整因果历史的大步catch-up；event已退休时明确拒绝，不填补旧爆点。

该实际工厂/held-wind例的固定相位账目（密度只在20Hz提交，pending不可漏算）：

| 爆后 s | 已提交包数 | airborne M | 已排队pending M | reserved M |
| --- | ---: | ---: | ---: | ---: |
| .35 | 60 | 2.388770444 | 0 | 17.961229556 |
| .65 | 108 | 3.970358813 | 0 | 16.379641187 |
| 1.1 | 179 | 6.292745807 | .040949160 | 14.016305033 |
| 2 | 323 | 11.037510914 | .040949160 | 9.271539926 |

三项相加均20.35；不是把总质量调低。未物化预留同时包含未来燃烧和≤.30s批量延迟。实际固定帧最大.055s窗口20根格/100次GL5查询仅是调度数量，**不是CPU/GPU性能结果**。旧烟不会年龄删除，连续发射仍可能触发已有4096容量merge，其近似和光场pair上限均未改变。

后续只在明确experimental/event-specific选择下看真实I1连续镜头，核查烟段出生节拍、轨迹位置、完整预算和实际成本。该模型不是通用CFD、实测物质产率、分裂子星继承或落水熄灭/沉积解。

冻结SHA256：adapter **a40d150973d9e7a0cd720bebe160c4ff8a7795ddbd10ea09bc37436da8b3b219**；planner **1a94df8702783e3b843108ccd627997da80059f3814ce71d44bbc9ac410d4eb5**。逆向入口：`normalizeRingBurnAdapterSource`，位于 `verification/ring-burn-default-normalize.mjs`。
