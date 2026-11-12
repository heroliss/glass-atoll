from pathlib import Path
root=Path(__file__).resolve().parent.parent
entries={
'README.md':'[R37检查点](verification/R37-CPU-PROJECTION-REJECTION-CHECKPOINT.md)：精确投影缓存在CPU基准中反而平均慢26.8%，已完整归档并逐字节回退，没有合入提速。新增采样期间的细分计时：一次实际原生演化中主视图首次光学准备约8.33ms、镜像约0.80ms，下一项针对丢弃的快门汇总构建。29组用户设置及原HDR已精确恢复，认可音效保持，整体目标active。下列R36及更早入口为历史。\n\n',
'verification/plans/PROGRESS.md':'**当前入口R37（2026-10-30），整体目标active。** [R37检查点](../R37-CPU-PROJECTION-REJECTION-CHECKPOINT.md)拒绝并回退投影缓存：CPU精确6/6、216样本开启后mean1.268×/median1.293×，独立拒绝审计4/4，候选及106项依赖/输入/结果归档；FW正式逐字恢复03fd，main缓存QA开关撤除。生产仅main08b43保留profileFrames期间的细分计时，可反向逐字恢复R36，无shader/光源/烟/质量/时钟改动。实际单发普通24烟团原生演化91条：光度12.973ms、main-source-bound8.333、resolvedSH2.497、mirror0.800；主视图首次构造光学行，不能把差值全归某子步。读数6/6，freshSH92/Tprepare184，GPU有效，约30.01FPS/GPUmean22.42ms只是基线诊断非候选提速；异常值保留。用户29/29及完整parameters/night/lens恢复、DISPLAY6/1270系统HDR、0活动/0烟/GL与console空，音效4e5保持。一次误用pauseAt的QA发射失败保留，后续正确pauseAtPhysicalTime采样，没有并发压力。[R38单项方案](R38-FIRST-OPTICAL-CONSUMER-PROPOSAL.md)尚未实现：taps-only writer去掉两处丢弃的汇总计算，保持全部RGB算序和独立24项缓冲。时钟/多发密烟/环境受光/照片感/冲滩水花天际仍未完成。下方旧“当前/下一轮”入口均为历史。\n\n'
}
for rel,prefix in entries.items():
 p=root/rel;b=p.read_bytes();eol='\r\n' if b'\r\n' in b else '\n';s=b.decode('utf-8');prefix=prefix.replace('\n',eol)
 assert not s.startswith(prefix),rel
 p.write_bytes((prefix+s).encode('utf-8'))
print('R37 current entry added; older complete history retained.')
