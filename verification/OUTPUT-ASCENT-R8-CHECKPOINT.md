# R8：实际显示输出与上升装饰火光

本轮是可复核的进展，整体照片感仍未验收。Goal 保持 active。

## 默认已改变的部分

普通筒射礼花载体的装饰火光改为中央 C2 包络：约 .12 秒点燃，最后 .40 秒渐灭。头部、过去时刻的尾迹、八个快门样本及派生照明共用同一物理时钟。没有增加持续推力、重写弹道、改主爆声音、上调参考光强或更改烟物质量。

这里的内部旧名称 `rocket` 仍表示弹道载体，不能据此解释为火箭发动机。DOE 对普通空中礼花的说明是发射药提供出筒冲量、延时引信在上升中燃烧；NASA 的模型火箭资料也明确指出惯性上升时的延时药可以燃烧、冒烟而不产生推力。厂商的装饰“銀竜”甚至可以燃到主弹开花。因此当前淡入/渐灭时长属于作者近似，不是测得的燃料或推力曲线。

- https://www.energy.gov/articles/5-facts-about-fireworks
- https://www.grc.nasa.gov/www/k-12/VirtualAero/BottleRocket/airplane/rktflight.html
- https://uchiage-hanabi.com/library/lead/

专属 CPU 对照 6/6，二十对实际 factory、284 帧；非载体弹道/事件与参考源强保持。十种烟花开花后 +1.1 秒均与封存旧版严格相同。完整边界和旧保护门见 [实现审计](fireworks/ASCENT-EMISSION-IMPLEMENTATION.md) 与 [物理含义复核](fireworks/ASCENT-PHYSICAL-HONESTY-REVIEW.md)。

## 实际 1080p 音画

[R8 原片](pyro-r8-ascent-motion.mp4) 和 [记录](pyro-r8-ascent-motion.json) 为真实网页的一次 20 秒录影。I=1、种子 42、C=16.5、普通 near-apex 弹道，炮口以上作者爆高 140 米；实际 launch→burst 5.00830879 物理秒。它不是用户视频中巨型礼花的十余秒实物标定。

影片使用已接生产的装饰火光包络，但 smoke `ring-burn`、48 条代表轨迹、Taylor 扩散与逐源受光仍是明确 QA 候选；这些没有自动变成生产烟源默认。影片与 D 是独立事件，海云相位、录影时钟与镜头过程有差异，不能称同发像素 A/B。播放器时间也不能直接充当物理时间；同步诊断采样约 200 毫秒，不能给任意压缩视频帧指定精确 burstAge。

[媒体技术检查](pyro-r8-motion-media-check.json) 5/5：H.264 1920×1080 CFR30、48kHz 立体声 AAC、全片解码、有限非空无样本削波音轨，已验收主爆源码 SHA 不变。原生播放器实际 `readyState=4`、seekable 0..20 秒、跳转到 5.3 秒成功，见 [原生记录](pyro-r8-viewer-native.json)。审看页已增加 E，保留 A/B/C/D 和 B 默认。

root 实看上升与末段提取帧：尾迹随速度缩短，末段变化存在，但当前远景光点很小且 SDR 高光仍易饱和；不能仅凭这次录影认定所有细节已经自然。爆开后的规整灯串感、烟缕造型和完整倒影构图仍未验收。该候选录影的 98 个低频 HUD 采样均值约 39.1fps、最低 19fps；录制、同步截图与候选照烟均在场，既不是稳态性能基准，也不能用 CFR30 声称实时稳定 30/60fps。

## 可选 ACES 2 显示输出

原生菜单增加“色彩呈现：原有 / ACES 2（实验）”，默认仍为原有。ACES 2 模块按 OCIO 2.6 生成目标与真实 GPU 参考准入，使用已标明的准确 atan 变体，不宣称未经修改的官方实现或认证。目前 GPU 准入仅 100/700/1270nit；1200nit 已有固定本地 CPU 生成服务，但尚未接 HTTP/GPU 准入，不能把 CPU ready 当成显示可用。精确峰值不支持时明确回退，不暗中选择相邻目标。

控制器区分请求、准备状态、最近 SDR/HDR 实际绘制；模式热切换不重置静止画面的时域历史，且暂停时要求实际重绘。SDR 和 HDR 各自只施加一次输出曝光/编码；中调映射由 ACES 2 负责，不套旧纸白增益。

实际模块 GPU 137/137；暂停、AA 收敛后的 day/blue 两组同场对照均保持物理 snapshot、C/P 与 opaque/composed/reflection 的全域 extrema/counters 一致。这是范围级一致，尚未完整散列全部 master 像素。显示 look 确实变化，日景更暗；没有为维持旧外观私自提高曝光。

蓝色实景真正进入原生 RGBA16F→WebGPU 呈现缓冲，8/8：源/目的各 7909 个 RGB 分量、5398 个像素超过 1，最大 1.490234375；整 8,294,400 通道按翻行关系逐位一致，有限、非负、alpha=1，GL/设备错误为空。按配置 700nit/系统白 280nit 反算的约 699.743 只是单位与半精量化检查，**不是面板测光、真实火星测光或单凭复制证明上游编码次数**。截图和 MP4 均为 SDR，不能呈现 HDR 面板亮度。见 [独立证据索引](aces2-output-default-drawbuffers-verified.json)、[蓝色实景](aces2-scene-blue-settled.json) 与 [HDR 读回范围](HDR-PRESENTED-FRAME-NOTES.md)。

首轮两处真实 GL 问题已保留失败证据并修复：QA radiance reduction 曾把待删除 program 留为当前绑定；ACES 模块曾在 default framebuffer 恢复八个 BACK draw buffers（合法数量应为一个）。修复后的新 trace 和实景读回均无对应错误，未靠清空错误队列隐藏。完整原因分别在 [radiance 状态复核](RADIANCE-RANGE-STATE-REVIEW.md) 和 [输出修复](ACES2-DEFAULT-DRAWBUFFERS-FIX.md)。

单独 1080p 输出 pass 的交错 GPU timer 13/13，ACES 100/700 平均约 .392/.337ms，对照原有输出约 .037ms。它使用固定 HDR 输入，只有每模式 12 个有效 query，不含全场景、原生呈现复制或手机；不能据此保证整场帧率。见 [测量范围](ACES2-OUTPUT-PERFORMANCE.md)。

## 后续优先级

1. 保持当前数值与输出基础，继续改善真实画面：火星/余烬/烟物质各自的时程与不同品种的差异，减少规整灯串及椭球烟缕感。
2. 补齐发射、地面燃烧和分裂子星的持续烟源，连同有界预算、风和分钟级积烟一起审查；不靠光强、曝光或凭空加烟掩盖几何问题。
3. 完成任意已校准 HDR 峰值的实际 GPU 准入和输出回退，之后再做完整的 HDR/SDR 视觉分级与全场性能复测。

`npm run check` 本轮已补入 `display-transform.js` 与 `aces2-output.js` 并 exit 0。声音 SHA 锁定，原始失败和历史影片保留。最终浏览器将恢复默认场景，审看页 E 可独立查看。

## 默认复测发现的上下文中断

首份 `r8-default-day-benchmark.json` 不能作为有效性能成绩：没有有效 GPU samples，结束有 1280/1282。随后原生页面实际显示图形中断遮罩；读回时底层 `isContextLost()` 已回到 false，旧 query 却仍被使用。三帧真实 trace 在同一个 query 的 `getQueryParameter(QUERY_RESULT_AVAILABLE)` 上逐帧捕获 1282，见 `r8-render-timer-gl-trace-second.json`。helper 入口和先前快照均主动取得 fresh extension，可能重新启用它；**最早 1280 没有被逐调用捕获，不宣称其精确起因**。第一份 trace 因本地服务停止而无法加载，原错误也保留。已核实 5186 无监听后恢复唯一服务，新的 exec session 为 65741。

现保留原本明确要求刷新页面的恢复策略：contextlost 时永久置本页 interrupted，暂停物理时间、丢弃无效 query 引用而不再调用 GL、停止声音并取消 benchmark；底层 Three 自动恢复后也不假称自定义 raw-GL 资源已恢复。基准取消结果有 `cancelled/invalid`、`averageFps:null`、`final:null`；以后基准入口拒绝中断场景，直至重新加载。正常结果原统计字段保持兼容，新增状态字段。

`render-benchmark-cancel-check.json` CPU 协议 8/8。另一次真实页面的 `WEBGL_lose_context` 受控测试 `r8-context-interruption-gate.json` **5/5**：在基准运行中主动丢失该页面上下文，取消报告、物理时间冻结、查询次数停止、底层恢复后仍停止以及拒绝新基准都成立。此测试是显式软件上下文事件，不是诱发驱动崩溃或系统压力测试；不把它当成最早外部中断原因的复现。

首份表面约 137fps 的数字因此作废，不纳入性能结论。旧 source 已封存于 `baselines/main-before-context-interruption/` 和 `baselines/render-benchmark-before-interruption/`；没有覆盖原错误报告或清队列来冒称该旧运行干净通过。

重新加载后的 `r8-default-day-clean-first.json` 为有效默认日景窗口：1209×1292/DPR1/q1/中档/原有显示/音效关闭/无诊断曝光锁/生产12轨迹烟源；8秒约87.31fps，frame p95约22.9ms，690个有效GPU样本均值10.803ms/p95 12.168ms，entry/exit GL均为空、未中断，6项状态门均通过。它是本机当前窗口实测，期间还有后台工具工作，不是空闲工作站对照、全场景性能上限或每帧60fps保证；不与作废的137fps比较提升。最终源码快照与原始证据哈希见 `r8-source-evidence-manifest.json`。
