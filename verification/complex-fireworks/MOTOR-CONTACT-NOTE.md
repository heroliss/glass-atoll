# 大型编排有限推进：接触与尾迹适配

仅修改 firework-contact-support.js、firework-tail-field.js；原件和 SHA256 见 motor-contact-before/。本轮没有修改通用接触求解器、物理积分、渲染、声音或旧推进模型。

- Contact 的速度界在 displayMotor 上复用 bodyMotorMotionBound 的积分加速度 J 界；固定滞后尾迹还计入同一 helper 的最大规定加速度。正的线性阻力卷积使每个速度分量可由被动界加 J 保守包含。这里不是从轨迹采样最大值建立界。
- displayMotor 不能进入普通线性弹道的海平面快捷解；走原有有界求解。每个 cells.from/to 都转换为 body.birth+age；尾迹按自身 lag 再平移后分区。旧 thrustProfile.toAge 分支逐字保留。
- displayMotor 的 sampleBody 没有返回旧 motorAcceleration 元数据；尾迹因此只在新分支调用 bodyMotorAcceleration(body,releaseTime)。使用规定推进加速度加在完整被动加速度之后，不把响应速度导数或分离火星速度误当为固定滞后光场导数。旧路径沿用 source.motorAcceleration，不重排其数值表达式。
- 旧 limits 文本和旧源的输出保持；新 motor 的文本明确是 finite authored display-motor acceleration。contact 原文件 LF、tail 原文件 CRLF 均保留，没有全文件换行转换。

## CPU 证据

motor-contact-check.json：6/6。使用真实 display-helix/display-vortex、两个固定 seed 的98个 motor bodies；7644个轨迹见证满足速度/位移解析界。固定滞后72例的解析导数与数值差分最大误差约6.25e-10 m/s，且与实际分离火星速度确实不同。4个接触例在真实轨迹上构造已声明静态测试平面，以检查新力边界和接触求解路径；不是新增海面模型。旧 legacy/three-heart/powered-bees：36例尾迹、18例接触连同诊断对归档适配器逐值严格相等。完整源码闭合变换检查限制了所有改动位置。

第一次测试为4/6：测试错误地假定 contact 原文件也使用 CRLF，且一处测试公式遗漏实际 body.gravity 的默认9.81。两项均为夹具错误，未修改生产算法来迎合。原脚本/失败报告保存在 motor-contact-check-before-fixture-fix.*；修复测试默认值和原换行断言后通过。

没有 GPU、浏览器、像素、帧率或跨引擎逐位一致性声明。采样见证补充解析边界，不能代替连续域证明；现有数值安全余量仍属于工程计算合同。
