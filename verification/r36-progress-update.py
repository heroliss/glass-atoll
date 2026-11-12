from pathlib import Path
root=Path(__file__).resolve().parent.parent
prefixes={
 'README.md':'[R36检查点](verification/R36-RADIANT-LONG-TRAIL-CHECKPOINT.md)：新增“三层菊 · 长金尾（实验）”，蓝外层、绿中层、红内芯使用不同余烬尾长度与燃尽时间，持续光有独立且未实测的参考标定。旧样式和认可音效保持。原生短测普通烟33.31FPS、逐点QA烟21.13FPS，均非受控A/B或峰值成绩；CPU光度准备仍约11ms。已保存24秒原生SDR音画，原29组用户设置精确恢复。长尾仍偏均匀、环境受光与海天细线仍未通过自评；按[R37有限优化方案](verification/plans/R37-CPU-PHOTOMETRY-AND-REALTIME-PLAN.md)继续，整体目标active。下方R35及更早条目保留为历史。\n\n',
 'verification/plans/PROGRESS.md':'**当前入口R36（2026-10-30），整体目标 active。** [R36检查点](../R36-RADIANT-LONG-TRAIL-CHECKPOINT.md)接入独立three-heart-radiant120-v1：192根、旧120米参考几何与运动保留，作者持续光G16只乘一次，金尾0.88/0.66/0.40秒在同一积分预算分配。编译5/5、FW包围8/8、物理7/7、独立打包4/4、照明预检6/6、保存实景/恢复7/7；用户29/29精确恢复。实际QA396/1051/1561团，+2.5双眼各1703T、1699SH，新鲜总工作约796.9万配对；暂停SH缓存不能当新鲜计时。实际3秒演化普通33.31FPS/GPU22.89ms、逐点21.13FPS/GPU29.15ms，非受控A/B/峰值或60FPS准入。CPU光度约11ms、逐点排烟释放约10.84ms；55ms全局时钟截断会使负载下运动变慢。24秒SDR原生音画与认可4e5音效保留，录制不是性能测试。背景local-air同刻on/off会改变天空但未消细线，未推广；水/云/撤回shader不重试。长尾仍像均匀发光线、烟/云/岛屿受光弱，照片感仍否决。[R37方案](R37-CPU-PHOTOMETRY-AND-REALTIME-PLAN.md)先处理同代重复投影/未使用材料CDF，时钟独立设计；新燃烧波形仍仅设计。下方所有旧“当前/下一轮”入口均为历史。\n\n'
}
for rel,prefix in prefixes.items():
 p=root/rel;before=p.read_bytes();text=before.decode('utf-8');eol='\r\n' if b'\r\n' in before else '\n';prefix=prefix.replace('\n',eol)
 if text.startswith(prefix):raise RuntimeError('Already updated '+rel)
 p.write_bytes((prefix+text).encode('utf-8'))
print('R36 current entry prepended; previous complete text preserved.')
