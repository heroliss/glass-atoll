import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),j=p=>JSON.parse(read(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(read('main.js')),'c731e448fa23b2897ff8f4b811b724da3dac1a39d391f7484faa64eefe2ef922');
const repair=j('verification/r34-logical-same-phase-tiled-repair.json'),live=j('verification/r34-profile-mode-reload-live.json');assert.deepEqual(repair.before.snapshot,repair.after.snapshot);assert(!repair.before.smoke.rendering.resolvedLighting.effective&&repair.after.smoke.rendering.resolvedLighting.effective);assert(live.sourceContainsInheritedModes);
const dir='verification/baselines/r34-before-progress-update/';fs.mkdirSync(new URL(dir,root),{recursive:true});for(const [p,n]of [['README.md','README.md'],['verification/plans/PROGRESS.md','PROGRESS.md']]){const t=new URL(dir+n,root);if(fs.existsSync(t))assert.deepEqual(fs.readFileSync(t),read(p));else fs.writeFileSync(t,read(p));}
const text=`# R34：实际明亮三层烟花、连续烟源观察，以及QA渲染模式继承修复

本轮没有把照片感判为通过。实际三层外蓝/中绿/内红及尾迹已经可见，水面有对应反射；但全景花形偏小，周围烟云与地面缺少能量。近景仍有程序粒子感。实景证据改变了优先级：先补尺度/发光过程及完整产烟的一致性，而不是继续只优化无用算术。

## 可见观察，不冒充固定GPU门

通过现有日常API正常发射seed341070三芯菊，标准质量、1209×1292、8×MSAA主视图和原生倒影、HDR系统报告1270nit、原音效关闭。同步接accepted receipt后设置pauseAtPhysicalTime，分别观察爆开+.70与+.1.70；自动构图后另有靠近烟花的细节视角。全景保留岛/花/镜像；特写只用于看亮点和烟。

原普通烟源两时刻均24包；1728个SH源及主/镜遮光有效。第二次独立空场景使用既有logical-all QA连续烟源，到+.70产生396包、+.1.70为1051包，发光形状/主体数不变。第二次不是逐位同一物理历史的A/B：绝对发射时间、正常更新序列和释放质量不同。连续源+.70已释放约6.7384、+.1.70约11.6447参考质量，而旧两次出生模型已释放20.35；烟包更多不能说物质量更多。

截图包括 r34-three-layer-plus1p70-detail-hdr-screen.png 与 r34-logical-three-layer-plus1p70-detail-hdr-screen.png。这是浏览器实际HDR呈现的截图，不能证明物理峰值或HDR数值准确；普通屏幕截图自身也不是HDR文件。近景没有完整岛屿和倒影，不能冒充全景构图验收。正常播放及暂停后重收敛会有多次绘制，既不是单次100ms固定门，也不构成持续FPS测量。

## 找到并修复了一个实际回退问题

setSmokeReviewProfile重建QA宿主时，原来只传4m/1m/8的配对策略，遗漏projectionMode与lightFieldBakeMode。普通生产初始化本来明确使用ellipsoid/tiled64；库默认却是legacy-sphere/serial-reference。因而本次1051×1728=1,816,128配对在串行比较路径被旧1,048,576限制拒绝，不能据此说4m分块实现失效。

main.js现在在构造新宿主时继承原宿主的这两个模式，其他烟源、GPU预算和着色器不变。旧主入口328f997…逐字归档，新主入口c731e448…；已认可音效4e5ede41…未改。CPU/source回归6/6覆盖20组模式/投影/配置，以及构造失败保留旧宿主和配置验证失败释放候选。

旧已加载页面的同一暂停时刻，使用现有公共tiled64 setter恢复了完整1,816,128配对受光，完整物理snapshot逐字相同，GL健康。此运行证明模式与能力的因果关系；它发生在重新加载补丁之前，不虚称已经由新源码触发。随后重新加载补丁，实际空宿主logical-all→production往返均自动保留ellipsoid/tiled64，方法指纹177b690f…，GL无错误；这是新源码的实际接线验证。

同phase修复raw里的两眼T是之前最近的有效视图，不能单凭这份宣称恢复SH后新算了两眼。最终特写主眼1728条GPU遮光且0CPU查询，镜面因视角无活跃光线为0条/0查询；不是遮光回退失败，也不能叫“两眼都做了非空GPU任务”。后续缓存/计数差异以独立报告为准，不把渲染元数据变化说成物理状态变化。

## 尺度、光度和云候选的审查结论

生产纯事件计算确认，本次外层水平主体直径+.70为20.824m、+.1.70为38.631m，整个发光寿命最大51.963m。19m/s硬契约连理论上界也只有约55.177m，无法达到所引用120mm示例的120m宽度；这不是只换机位可解决。供应商数据只是尺度示例，没有展开时程或光度测量，后续应建新版本，不改写旧19m/s回归。

当前参考光强约1276cd，+.70仍占本身峰预算89.79%；单位链没有发现P重复缩暗。光度审查定位到未标定的5–10参考cd/星预算、没有独立短时burst-flash发光源，以及地表local光280m范围与cloud/SH不同的近似。相关主资料与不可由普通视频倒推绝对cd的界限保留在 R34-FIREWORK-PHOTOMETRY-ROOT-CAUSE-REVIEW.md；未盲目放大倍数或假称实物测光。

默认云密度exact2可逆候选完成CPU/source5/5、963组，原fallback、采样/LOD/billow/连续云底保留；独立审查未见依赖遗漏。但GPU浮点mix/FMA舍入与性能尚未验证，生产sky仍51db558…，候选未推广。

## 还原及下一步

观察后重新加载并恢复原暂停、机位、烟花设置页、legacy烟花和普通two-births烟源；HDR仍当前屏幕1270nit，音效保持原设置。最终0烟花/0烟包、ellipsoid/tiled64，GL与控制台为空。用户意图比较见 r34-user-restoration-check.json，重新加载不承诺恢复原海浪/云瞬时历史。

下一轮执行 plans/R35-SCALE-PHOTOMETRY-AND-NATIVE-VISUAL-PLAN.md，尺度、闪光/持续发光、连续烟源、全部受光与包围需要一同校准。多发长时积烟、整体性能和照片感仍未完成，原海岛/海水/大气/交互目标保持active。
`;
fs.writeFileSync(new URL('verification/R34-BRIGHT-SCENE-AND-HOST-MODE-CHECKPOINT.md',root),text);
const original=read(dir+'README.md').toString('utf8'),brief='[R34 检查点](verification/R34-BRIGHT-SCENE-AND-HOST-MODE-CHECKPOINT.md)：完成实际三层烟花与连续烟源的明亮近景观察，修复QA烟源切换丢失ellipsoid/tiled64、导致181万配对受光被旧1m路径拒绝的问题。同phase物理快照不变，新源码重新加载的模式继承验证通过。尺寸与光度仍有明确缺口，照片感未通过；云候选未推广，目标active。\n\n';
fs.writeFileSync(new URL('README.md',root),original.replace(/^(# 玻璃海 · Atoll\r?\n\r?\n)/,'$1'+brief));
fs.writeFileSync(new URL('verification/plans/PROGRESS.md',root),read(dir+'PROGRESS.md').toString('utf8')+'\n\n### R34：明亮三层烟花实景与QA宿主模式继承（2026-10-30）\n\n详见 [R34检查点](../R34-BRIGHT-SCENE-AND-HOST-MODE-CHECKPOINT.md)。两次单发正常观察+.70/+.1.70，实际三层/尾迹/反射可见但照片感未通过。普通24包，连续QA396→1051包；后者因QA构造遗漏模式回到legacy-sphere/serial-reference，1816128配对被旧1m拒绝。main仅增加继承两个模式，CPU6/6；旧runtime同phase切tiled恢复受光且完整snapshot不变，新main实际reload空host往返保持ellipsoid/tiled64。不是新shader数学oracle/一次固定100ms门/FPS通过，旧普通初始化本就tiled。尺寸纯生产计算外层最大51.96m而引用示例120m，参考光度/缺burstflash及local280m截断等待校准；云exact2候选CPU5/5未GPU/未推广。原设置与音效还原，目标active。\n');
console.log(JSON.stringify({written:true,productionChange:'QA host mode inheritance only',goalStatus:'active',cloudCandidatePromoted:false,photorealismAccepted:false}));
