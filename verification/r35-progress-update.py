from pathlib import Path
root=Path(__file__).resolve().parent.parent
entries={
 'README.md': '[R35检查点](verification/R35-SCALE120-INTEGRATION-CHECKPOINT.md)：新增“三层芯 · 120米参考（实验）”，用三维初始冲量匹配爆开后2.5秒的参考展开；它是作者标定，不是实物测量。旧样式输出对照保持。实际逐点烟源1561团、约265万完整配对仍由GPU受光/遮光；这不是连续FPS结论。用户29组设置精确恢复，音效保留。稀疏亮点、短尾迹和环境受光不足仍被自评否决，按[R36方案](verification/plans/R36-SUSTAINED-PHOTOMETRY-AND-BURST-SOURCE-PLAN.md)继续，整体目标 active。下列R34及更早条目保留为历史。\n\n',
 'verification/plans/PROGRESS.md': '**当前入口R35（2026-10-30），整体目标 active。** [R35检查点](../R35-SCALE120-INTEGRATION-CHECKPOINT.md)完成三层烟花120米参考展开的独立校准、生产接线和实际HDR/SDR观察；旧样式保持，新版构图使用实际快门/alpha/完整已提交风范围。编译5/5、物理5/5、连续包围/光学7/7、独立烟路由5/5、保存实景及还原7/7，用户29/29精确恢复。实际QA逐点烟源1561团，受光2652139/遮光2653700完整配对均GPU，非数值oracle或FPS证明。普通模式仍24团代表源，不能称全面逐点排烟已默认完成。照片感仍否决：亮点稀、尾迹短、烟/云/地表受光太弱。[R36方案](R36-SUSTAINED-PHOTOMETRY-AND-BURST-SOURCE-PLAN.md)先区分持续光和爆闪；短闪光不能修复+.70秒后的暗光。音效4e5保持，水/云候选未推广。下方所有旧“当前/下一轮”入口均是历史。\n\n'
}
for rel,prefix in entries.items():
 p=root/rel;s=p.read_bytes();text=s.decode('utf-8');eol='\r\n' if b'\r\n' in s else '\n';prefix=prefix.replace('\n',eol)
 if text.startswith(prefix):raise RuntimeError('Already updated '+rel)
 p.write_bytes((prefix+text).encode('utf-8'))
p=root/'verification/R35-SCALE120-INTEGRATION-CHECKPOINT.md';s=p.read_text(encoding='utf-8').replace('+.2.50','+2.50');p.write_text(s,encoding='utf-8')
print('R35 current entry added; complete previous text retained.')
