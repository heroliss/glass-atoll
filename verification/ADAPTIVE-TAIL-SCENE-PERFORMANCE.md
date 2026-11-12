# 动态近景尾迹：交错整帧GPU成本夹具

[adaptive-tail-scene-performance.js](adaptive-tail-scene-performance.js)，SHA256 `b8cd721c87e11555372a946ef577999bc8aa03db4f00601cf91e9819172dee0a`。

```js
runAdaptiveTailScenePerformance(a,{
  gl:originalMainGL,seconds:8,
  burstTime:preparedPalmLaunch.burstTime,declaredSeed:42,drainMs:2000
});
```

root先准备唯一palm/seed42、近机位、固定C/质量/风、约burst+.1并暂停，无队列/自动发射。burstTime必须由该真实launch给出；activeEvents未公开seed，因此报告把42标为owner-declared，不假装独立读到了它。调用者独占one-shot frame-probe槽，**不持qaRenderLock**，否则主循环不会跑。测试不再发射/清烟/改天气/相机/源强，不回退时钟。

先设置legacy8，resume并调用原`a.benchmark(8)`。只透明包装原context的beginQuery/getQueryParameter，原操作各调一次，不getExtension/getError、不建新query、无手工querypoll/rAF渲染。begin时立即锁存当前mode/帧号到WeakMap；帧末probe记真实phase/pose/C/P/尺寸，再`setFireworksTrailIntegration(next,{resetHistory:false})`切下一帧，所以不会被main在probe之后才endQuery的顺序误标。

每31帧相邻两帧另读fireworks tail-policy/records/source元数据，减轻逐帧getBounds开销并轮换顺序；计数是CPU投影估计，不是GPU执行指令。每frame仍记录状态/光度与mode切换开销，整段FPS/CPU时长包含这些观测开销。GPUelapsed也可能包含CPU提交间隙，不能把两组整帧GPU均值差宣称为纯尾迹shader成本。

8秒结束先暂停，最多额外2秒等原loop自己返回已标记queries；不新增poll操作。每模式至少30份实际返回、有限正值GPU样本。没有query、null/非有限、pending未取回、contextloss、benchmark取消、C/pose/分辨率漂移等均invalid；不补零/不把已取回少量说成完整。报告保留整段benchmark、逐query原始ns/模式/phase、每mode n/mean/nearest-rank p50/p95、未回收项、setup/probe/switch/wrapper/stats开销。

这是**同一8秒演变事件的帧交错**，非同一物理时刻的精确paired A/B；每模式没有各自独立FPS。原benchmark整段FPS只能称仪器化交错窗口，不保证任意硬件60fps。原GL错误标记不由夹具读取/清空，owner的独立entry/exit错误门另行保留。

finally清owned probe、恢复原模式`tailIntegration.requested || legacy8`并resetHistory:true、恢复GL方法descriptor且留暂停；事件继续到真实结束时刻，不偷偷回退。contextloss时遵守主程序reload策略，跳过会触GL的模式/历史重建，明确invalid，仍恢复JS包装和暂停。

[小协议检查](adaptive-tail-scene-performance-check.json) **7/7**，只用fake mainloop：probe改mode后再end、延迟两帧读query仍正确归类；原操作数一致/getError0/ownquery0；无query/null/contextloss拒绝和cleanup均过。它不是actual GPU或性能数据。

## 已封存的真实证据

2026-10-28独立只读复核以下root执行结果；没有另跑浏览器或更改helper/生产。修复后[小GPU夹具](r9-adaptive-tail-gpu-fixed.json) **9/9**：103组未改golden的最大绝对差`2.30745049e-7`、最大工程预算比`.0035402285`，实际legacy/head冻结基线逐像素相同、GL及恢复门均过。原[首轮7/8](r9-adaptive-and-radiance-gpu-first.json)仍保留，不能改写为原版已通过；根因与窄坐标修复见[候选说明](fireworks/ADAPTIVE-TAIL-CANDIDATE.md)。

[同事件静帧](r9-adaptive-tail-scene.json) **13/13**，是真实palm/seed42/I1、burst+.8s的front/detail四张PNG：同一角度的legacy8/adaptive保持物理源snapshot、clusters、UTC、相机、C16.5及P相同；front P12、detail P11.25。实际请求模式确已渲染，main/mirror等被检查HDR缓冲范围安全，后置GL错误为空。`visualAccepted:false`；这证明受控技术条件，不能据此称珠串/运动闪烁或照片感已经视觉验收，更不是动态成本数据。

[8秒真实交错报告](r9-adaptive-tail-scene-performance.json)，SHA256 `097419ad9685db768298b61ab55f4c3fe77e192035742e088e65cb2b3109b9f4`。原生1920×1080、q1、实际MSAA8、28mm、DOF关、SDR legacy输出、声音关；`parameters.quality=high`而`qualityPreset=medium`，以实际采样参数为准。风1.8m/s，唯一palm12头/I1，显式palm-fan-burn烟源候选；这不是生产默认烟时程测试。近机位为`[40.65746673,204.81178260,-73.31079247]`，target`[88.65746673,192.81178260,21.68920753]`。

| 交错帧标签 | 有效完整query | 整帧GPU elapsed均值 | p50 | p95 | 覆盖burst后相位 |
|---|---:|---:|---:|---:|---|
| legacy8 | 207 | 18.684768ms | 18.246656ms | 24.967488ms | .1191–8.1131s |
| adaptive | 207 | 19.174107ms | 18.546688ms | 27.713536ms | .1529–8.1270s |

两组均值差约`+.489340ms / +2.619%`，只是这个交错完整帧区间的观测差，不是隔离尾迹shader成本、严格同相位配对因果量或两个模式各自FPS。相位不同、烟/光/天空等完整工作量随事件推进，C始终16.5，P按源衰减自然在10.25–12间调整，不能写成fixed-P测试。CPU投影估计在每模式14个观测帧取样，adaptive最大N91、局部上界16、未报告fallback；不是逐帧GPU执行统计或所有视角资源上限已验收。

整段benchmark`valid`，实际窗口8.0257s、413个rAF间隔、平均 **51.459686fps**，不是60fps达成。原benchmark采用`floor(p*(n-1))`，rAF p95 **29.8ms**、p99 **35.8ms**；原始413间隔中276个大于`1000/60ms`，占 **66.83%**。若改用nearest-rank，p95仍29.8ms而p99为36.1ms；两者分位定义不同，不能混报。每模式表沿helper的nearest-rank定义。

原benchmark封口时记录409个三位小数GPU结果；透明包装另保留414个完整ns结果，最后5个由暂停后的原主loop在57.7ms drain内返回，零pending/invalid/foreign结果。414个query各有唯一ID/帧号，207/207标签与最终实际帧模式一致，main后置GL错误为空、program live且非delete-pending，context未丢失。方法与probe已恢复，保留测试前的adaptive选择并resetHistory:true，结束暂停；这不改变源码默认。

## 成本与未闭合项

观测本身在query内：probe累计74.8ms（约.181ms/测量帧），mode切换累计13.1ms，包装metadata估计3.8ms；**这些时间有包含关系，不能相加当独立总成本，也不能从GPU均值机械扣除**。setup约.5ms、统计1.1ms、最终恢复2.5ms在测量窗口外；`performance.now`量化使小分项只是估计。主query在probe之后结束，因此elapsed区间也可能包含CPU提交空隙；这份结果不是设备纯GPU占用计数。

仍需独立实际动态影片检查连续尾迹、段端/快速镜头与fallback切换，完整镜像/构图，以及最终选定默认和有声生产场景预算。既有13/13是暂停画面门，8秒交错是仪器化单近景窗口，均不保证任意设备/每帧60，也不能替代照片对照或用户接受。本文不作runtime或默认选择。锁定音频`fireworks-audio.js` SHA256仍为`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`；本次声音关，未评价新版听感或音画同步。
