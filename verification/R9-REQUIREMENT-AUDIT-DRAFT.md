# R9需求检查点草稿：功能、技术证据与照片感分开

2026-10-28。只读核对README、`plans/PROGRESS.md`、R8检查点、当前默认接线及下列已封存R9报告；未新操作浏览器、未更改生产。已补palm/fan清洁GL、f0c影片、927优化GPU与密集交错成本、最终应用默认的实际重载/日景证据。分钟级累积、视觉接受与整场预算不因此闭合，**原目标继续active，不能标照片感完成**。

## 用户明确接受的范围

- 第三轮主爆A/B：“冲击感合适”。仅该样例冲击感，`fireworks-audio.js` SHA256 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`锁定；不是所有音色/设备/SPL接受。
- 椰冠B0：用户认为B更宽、茂盛、美观，同时指出没有本质叶形变化。可作为当前transport基础，不扩为植物照片感接受。
- 持续释烟B影片：“b明显更好”。仅笑脸B相对旧时程改善；随后继续质疑低点/飞行/图案倾斜。不能扩为palm/fan候选、全部十型、烟气或整场完成。
- 未找到用户对整体照片感、R9 HDR观感、adaptive尾迹或新palm/fan源的最终接受。技术代理选reference笑脸、C2云或某默认，不等于用户全项验收。

## 原要求与扩展要求对照

| 要求 | 当前可确认 | 仍缺的交付证据/限制 |
|---|---|---|
| 真实玻璃海、白沙、统一热带光线 | 共享海面/海床反照率、Snell/Fresnel/Beer、动态天空/云影、真实沙颜色输入均有数值与实景历史证据 | 第一眼照片感未接受；椰叶梳齿/细丝、程序云、沙床远距偏差仍在。高机位/长焦的平面海边与球形天空灰蓝带已有物理定位，B5曲面远海仍只有方案，不能称任意角度都经得细看 |
| 自由拖转缩放、调太阳/光照、与水互动 | 原生导航/拖动/焦距/对焦、独立时间天气、太阳/月亮、投石/漂叶已可操作并有历史原生检查 | 不等于R9新源码已重跑全部交互；真实手机未测，只有桌面视口/DPR模拟。完整岛/烟花/水倒影共同构图仍有裁切历史 |
| 物理与动态一致 | 同源波谱/SWE/焦散/风/叶/声音；存储P与摄影C分离；日月星按独立UTC | 有限实时模型，非破波/完整水动力、全谱材质或完整多次GI/RT。不能用DLSS/RTX开关或“全mip”名义替代已明确的浏览器边界 |
| 夜空、可调镜头、音画同步、灯与缓慢环岛 | 目录星空/月面、四MRT/AA/可选薄镜头、实录+传播延迟、三角全向地灯、手电和导演镜头均已接线 | 星河是摄影长曝光观感近似，场景非绝对lux/SPL。地灯/烟花照明遮挡与反弹有限；镜头ghost/DOF非全路径镜头。三地灯完整cube源阴影未实现 |
| 真实且不同的烟花形态/高度/时程/颜色/尾迹 | 十型真实3D轨迹，reference笑脸固定世界面；普通近顶点为默认，上升装饰火光中央渐灭已生产启用 | 120/160/190m为作者依供应商例子分档，不是各具体效果实测；巨弹十余秒/多层彩圈、品种燃料/色谱随龄、终末亮度与尾迹未全标定。timed3是显式QA，不能当默认托高补丁；LED规整感未接受 |
| 每个燃烧光点/地面发射产烟、先浓后淡长留/积累 | 基础持久烟host与主/反射已接，物质不随发光active消失；用户选B持续释烟方向；R9又有palm12/fan9沿真实life候选 | **生产仍point/.20/12/Brownian/two-births**。ring/Taylor48/细长核与palm-fan-burn仍是显式QA；后者只适用两型，不能说全十型/十字子星/可选comet已全面覆盖。早期膨胀、不同烟产率/温度、小时级积烟视觉与成本未验收；参考面积不是kg |
| 烟花照亮烟/云/地/海与间接光 | 同一raw账本、P预算、有限空气/动态云、一次局部反弹、可选逐源烟受光均有独立GPU证据；两发共烟80/80是连续受光集成见证 | 默认晴夜云底约813m的I1/4实景开关无可见差，I16仅4像素1级；**明显照云仍未验收**。不能靠SunGain或曝光救亮。源→烟/云自消光、多重散射和完整体积空间场仍近似；旧烟独立隔离的颜色证据不能由PNG差分虚构 |
| HDR优先、独立SDR输出、任意校准峰值 | R8可选ACES路径和R9本地整数100..10000生成/逐峰GPU准入已接；1200实际full963与native扩展呈现均成功 | 只1200这个新峰有当前封存真实GPU/桥证据，非穷举所有峰。legacy仍默认。需要后续真实HDR/SDR观感分级、面板/曝光标定边界；SDR PNG不能展示面板HDR亮度，不能从用户SDR参考倒推cd/nit |
| 清晰稳定并争取60fps | MSAA/选择性历史/SMAA/SDR FSR有实证；f0c修后GPU9/9、静帧13/13，927零权重优化GPU10/10；应用默认adaptive已真实重载，模块legacy8路径保留 | f0c近景交错51.46fps；927双菊密集交错25.93fps，模式整帧GPU均值27.82004→28.03981ms；最终默认日景86.09fps但p95 23ms、16.81%间隔慢于60。均非独立模式FPS/同相位pairs/纯tail成本，CFR影片不是renderFPS，分钟级累积/完整倒影/照片感仍未验收；旧7/8与作废137fps保留 |

## R9技术增量：哪些通过，哪些仍不能盖章

- [目标HTTP](r9-aces2-target-http-check.json)73/73、[原媒体回归](r9-server-media-range-check.json)30/30：临时端口实际请求、同峰共享、64B/Origin/错误处理和既有Range正常；5186已由root唯一重启。这些不证明显示观感。
- [首准入](r9-aces2-admission-first.json)：generated61/61。1200的963＋61padding、5families、单位/OETF/P、samplers/附件/完整状态是真GPU；纯absolute2e−5仍有29通道超限，工程absolute＋relative门通过，不是官方认证。旧helper135/137两项是过时的“1200域外”；原失败保留，窄clone只将这两项改99，后续[第二报告](r9-palm-fan-source-scene-second.json)的pinned137/137已执行。
- 同一第二报告palm45/45、fan45/45说明源/质量/状态与选定phase的技术门成立，**但顶层exit GL仍1282，不能称该旧job干净全通过**。之后[真实trace](r9-radiance-default-buffer-trace.json)明确定位QA reader恢复8BACK；仅一处cardinality修复保全部分类/数值字节，[实际独立reader9/9](r9-adaptive-and-radiance-gpu-first.json)已过。新[清洁实景复验](r9-palm-fan-source-scene-clean.json)另行封存：palm45/45、fan45/45，burst后.8/3.6/10秒各front/detail及early/continuous两host，共24张PNG；entry/palmAfter/after全部GL[]、program live且非delete-pending，两个报告runtimeErrors均空、偏好恢复完成。末相位palm M20.35/261包、fan M.9/192包、reserved0且账目闭合；`visualAccepted:false`。旧45+1282和[等待API前启动失败](r9-smoke-clean-startup-race.json)均保留；新报告不反写旧失败，不自动提升候选为生产默认。
- [1200实景](r9-hdr1200-scene-presentation.json)：10个条件成立，native full-frame copy8/8，1920×1080、真实扩展>1、flipRows匹配、无新GL错误；原始物理snapshot与全域范围不变。它不是完整master逐像素不变、面板1200nit实测或HDR视觉接受。
- [adaptive首GPU](r9-adaptive-and-radiance-gpu-first.json)7/8保留；[varying probe](r9-adaptive-tail-varying-probe.json)4/4及独立actual-interpolant重算定位扩大quad插值偏移。窄坐标修复后[真实GPU](r9-adaptive-tail-gpu-fixed.json)9/9，用未改103组golden/原门，并新增冻结旧GLSL实际逐像素回归；不把首失败改写为通过。[同事件四图](r9-adaptive-tail-scene.json)13/13保持源、相机、UTC、C/P，模式和HDR范围成立，但`visualAccepted:false`，不等于动态或照片感验收。
- f0c[交错实景性能](r9-adaptive-tail-scene-performance.json)有效：原生1920×1080/q1/MSAA8/声音关、唯一palm/I1与显式持续烟候选，414个完整query各207，legacy8/adaptive整帧均值18.6847675/19.1741072ms（+.48934ms，+2.619%）。整段8.0257秒51.4597fps，rAF p95/p99为29.8/35.8ms（原benchmark floor分位定义），276/413间隔超过1000/60ms。C16.5固定，P自然10.25–12；不是fixed-P、同相位pairs、各模式FPS或纯shader增量。57.7ms drain取回最后5个query，零pending，后置GL干净；具体开销/边界见[专项说明](ADAPTIVE-TAIL-SCENE-PERFORMANCE.md)。
- 后续927零权重优化[GPU10/10](r9-adaptive-tail-zero-only-gpu.json)实际九组全图Float32与f0c逐位相同；[双菊单模式压力5/5](r9-adaptive-tail-high-count-scene.json)仍属较早f0c，[密集交错](r9-adaptive-tail-dense-scene-performance.json)才属927。密集声音开/生产point烟/384头、抽样3072tail；209个完整query（105/104）均值27.8200384/28.0398135ms（+.219775ms/+.790%），整段25.9297fps、rAF p95 92.7ms、120/208慢帧。物理phase只推进6.4217秒，后段tail过期、CPU/probe等共同成本都在；不是“零成本”或每帧60证明，详见[密集说明](ADAPTIVE-TAIL-DENSE-SCENE-PERFORMANCE.md)。
- f0c[实际16秒palm影片](pyro-r9-tail-motion.json)已有[媒体12/12](pyro-r9-motion-media-check.json)、[原生ready4/ended16.02](pyro-r9-tail-native-player.json)；它是单palm/持续烟QA、含一次近景切镜头，不是927重新录制或动态legacy/adaptive同相位A/B。CFR475帧由原生273帧素材导出，不证明实时30/60。媒体可用不等于照片感或用户接受，完整倒影/自然烟形仍有缺口。
- **应用默认已启用adaptive**，仅main工厂选项变化，模块927默认仍legacy8并保留fallback。[实际重载](r9-application-default-scene.json)中无源日景requested adaptive/awaiting-render正常，实际palm诊断96tail/maxN10/无fallback；日景/palm的三缓冲无非有限/负值且后置GL[]。菜单中档、实际MSAA8/shadow4096/wave512，`diagnosticCameraEV=null`而日景实际C0、palm自然C约16.5，不能把无QA锁误称实际曝光为空。生产烟仍point/.20/12/Brownian/two-births、resolvedSmokeLighting false；显示仍legacy，未推广持续烟/Taylor48组合。默认日景1209×1292/DPR1/q1/声音关8秒86.08751fps，rAF p95/p99 23/27.4ms、116/690慢帧，685GPU均值10.834565ms/p95 12.153ms；这是短日景窗口，不是烟花/积烟预算。只表示root有据选择及实际接线成立，不冒充用户接受。

## 最小收尾顺序

1. **保留本轮边界继续视觉反审**：数值/静帧、影片可播放、密集窗口和默认实际重载均有证据；原首7/8、旧1282、启动race与中间失败都保留。f0c影片不能替927动态回归，当前默认也不能替用户视觉接受；继续查段端/过软/快速镜头和完整镜像。
2. **烟源候选不自动提升**：palm/fan持续烟、Taylor/核/逐源受光组合仍需单独选择。补全十型燃烧体source coverage、差异化发光/RGB/尾迹属于下一有界合同，不能把应用tail默认变化解释为整套烟候选上线。
3. **补主目标画面与长时预算**：椰冠、远海地平线、云/沙近远景及明显照云，按固定光线/尺度照片反审；分钟级冷烟/多发累积、4096包边界和夜间HDR分别测完整成本。已有86.09日景、25.93密集仍不保证每帧60，不以新后端或单pass计时替代。
4. **文档与当前源对齐**：README/PROGRESS新增R9入口，旧R8“1200尚未HTTP/GPU”保留为历史并指向新证据。f0c与927、应用adaptive与模块legacy8、用户偏好与技术门/代理视觉决定明确区分。完整检查点见[HDR与尾迹R9](HDR-TAIL-R9-CHECKPOINT.md)。

**结论：R9输出与源时程基础有真实进展；原“第一眼以为照片、任意角度细看”仍未达成。** 本稿不新增生产决定、测试或资产，也不把用户对B/主爆的有限认可扩大。
