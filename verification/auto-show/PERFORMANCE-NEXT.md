# 28发场景：两个窄范围精确优化候选

只读保存的 dense-benchmark.json 与当前源代码，没有新增模拟、CPU计时、浏览器或GPU工作。记录起点28发、6895条records；5.142秒内12.253FPS，CPU中位79.4ms，GPU中位35.146ms。两种时长不能相加或据此预测优化后FPS。

63个细分frame中，firework-simulation-audio均25.354ms；photometry均18.997ms/中位15.7；water与main-lens CPU提交均15.146/16.722ms。62个photometry样本中，world-bounds均4.285ms、11次超过1ms、峰29.8ms；main/mirror source bound均3.221/3.013ms，indirect-and-cloud-shadow均6.663ms。这是light短烟场景，resolved-smoke-lighting均0.005ms，不能把所有成本归因于长期烟尘/SourceT。

recommended-live.json 的独立夜景 benchmark 从4发到5发，16.563FPS、CPU中位53.8ms、GPU中位16.988ms；该记录84个photometry样本的GI/cloud-shadow中位14.1ms，反而高于28发记录。灯的位置、可见性与采样分支等同样影响成本，烟花数量不能独自解释总帧时间。更早random-live.json的白昼/暮光HUD约45FPS也属于不同照明与阶段，不能和夜景有界benchmark当作配对提速证明；推荐默认目前仍未达到60FPS。

## 1. 优先：缓存同一个body的固定17点未来bounds预测

fireworks.js:getBounds 已缓存已过去的17个采样点，但仅在 simulation.time>=body.birth 时才取得pastSamples缓存，未来点每次2Hz cache miss或新发射使全局key变化时重算。预爆头部恰好属于此类；body值/parentVersion的既有失效检查可复用。

每body保留一个独立future数组及风stamp：timeline对象、length、末knot对象、time与三个wind分量；body版本变化时两类缓存都重置。历史knot不可变/显式invalidate的既有合同必须保持。future转past时仅在风stamp仍相同才可沿用，否则重算。固定 t=birth+life*j/16、sampleBody自身表达式、include遍历与余量保持不变。这个缓存只用于构图forecast，不能提供给禁止未来pose的烟源接口。

可影响的是均4.285ms、峰29.8ms这个scope的一部分；min/max遍历、smoke envelope与新事件初始化仍要执行，不能预称全部节省。风不变时适合命中，频繁改变风则应自然退回重算。内存约每body至多额外17×3个number加数组开销，事件回收用WeakMap；不要无界按时间点积存。

## 2. 次优、低风险：每个trailSegments只计算一次尾迹归一化和

updateRecordsUncached 对每一个有尾迹body都重复执行同一 j顺序的 sum += exp(-((j+.5)/segments)*3.5)。它与body、duration、颜色、风、相位无关。缓存最终binary64 sum（按完全相同表达式与求和顺序生成），保持后续 lag/duration 与各强度乘法原顺序；不要顺手把weight改成代数等价预表以免改变FP结果。

若该帧B个尾迹body、medium为8段，则指数计算由8B次降为首次8次；仍有尾迹采样和分配成本，不能据此把25.354ms全算作收益。预期只是低毫秒或亚毫秒量级候选，尚未测量，不值得单独承诺FPS。可再评估对明确全过期尾迹的早退出，但必须采用原 `(now-lastLag)-birth` 的两次减法，不用重排的 age-lastLag，也必须保留当前head/dark-history记录；这部分应单独验收，不能未经证明合并。

旧R38 taps-only只改vector profile而当前随机十种以legacy为主，且当时完整流程没有稳定收益，不建议重做。GI已有静态6槽单位响应cache，移动烟花位置/半径会使其真实失效；随意降频或冻结不属于本次精确优化。其6.663ms scope也包含cloud/base工作，不能直接宣布全是两个灯的visibility。

下一步最小验收是候选1对同seed/phase/风史、先future再past、改变未来风、出生位姿/parent变化及query顺序的原始factory精确bounds比较，然后由root做一次相同28发输入的正常有界帧测量。即使成功，仍保留源记录构建与双眼绘制成本，不能由数值门推导60FPS。

本轮只封存诊断建议，不实施bounds缓存或其它生产优化。
