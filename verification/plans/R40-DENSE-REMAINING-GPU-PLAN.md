# R40：同一双发快照的剩余GPU门与生产接入

R39已完成MAIN T实际4/4和保存原始数据独立6/6；不得重做MAIN来回避剩余工作，也不将这项2.864ms说成整帧速度。原始请求7.55/固定tick7.550000000000001、光学156/ledger51、两眼101/102身份保持。

1. 先核对本轮新增joint artifact与剩余参考回执：MAIN字节/数值精确复制，mirror独立原始/packed T，SH全1663×2413的256节点C0/C1/上下界与8partial，部分512节点收敛和负C1保留。使用新固定身份，原source-only artifact/runtime/pins保持封存。
2. 复用R39/R29的已验证状态/计时/独占输入协议，为mirror-only和SH-only分别固定任务，不接受任意factory/path/cap注入。每项健康通过才下一项。数值任务25ms门不变；先计算实际draw/read/byte预算，不能按构造maxMaps16宽松放行。
3. 再以两套T+一套SH完整保持到readback做同代21draw联合数值任务。共享一次SH，不能把MAIN结果借给mirror，也不能用一个T字段被第二次prepare覆盖后的metadata声称两张结果同时有效。记录19,329,024B数值存储scope。
4. 数值联合后，建立实际生产共同preflight：同代density/光学/ledger与两眼真实有效count或有证明覆盖的上界；三项一次预留，全项成功才发布当前场。不得用verification fake render/ack在live prepare两次或偷偷转CPU。12m只是当前域的QA容量，不直接当永久支持或提速。
5. 在实际native画幅、质量/MSAA/HDR/真实volume与reflection路径上做一次fresh完整帧及短演化，确认SH fresh+1、两眼T当前版本即时消费、0 CPU fallback、物理/墙钟漂移。沿既定100ms单fresh诊断上限，60/30FPS仍为体验目标，不可100ms通过就称流畅。

持续排烟会超过这个首次4m快照，现有容量/填充/CPU准备/55ms时钟仍需处理。全生命周期与新发射包络应纳入live准入；如精确全工作超总预算，要继续算法优化或明示完整epoch延迟合同，不能删已存在烟包/光源、贴旧受光或用缓存冻结FPS冒充真实演化。保留用户设置与认可音效，总目标active。
