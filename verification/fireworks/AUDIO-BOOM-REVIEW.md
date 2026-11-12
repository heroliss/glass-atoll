# 主爆偏轻：只读诊断与最小候选

2026-10-27。用户已实际听过24s实录并反馈冲击不足；本文不把相关检测通过当成主观听感通过。技术复算为`audio-boom-audit.py/json`，源与录屏音轨均记录hash。

## 已见证据

- `night-playground-audio-check.json`证明两次真实录音均出现、时间含约318m/0.914s传播延迟，非静音bug；整段peak0.06824/RMS0.00547。匹配窗的20ms最大RMS0.02667/0.02469，背景同量约0.00773/0.00920，瞬态相对背景仍不强。
- 实际Ogg峰0.87080，首个10%峰时刻15ms，峰25.7ms，5–95%能量位于15.9–79.4ms；4ms入淡在主要起音前已经结束。前250ms矩形窗FFT中20–80Hz占20.69%、80–250Hz占27.66%，**低频并未缺失**；单声道折叠这两带仅损约0.51/0.38dB。该有限窗频谱不是完整声学频响测量。
- 318.45m的inverse距离增益24/d≈0.07537（−22.46dB），随后burst0.90、pyro输入0.64、master0.75。仅标量链合计−29.75dB，录音峰约变成0.02835；这没有包含HRTF和自动makeup，不是最终sample预测。实录主爆窗peak约0.065/0.058。
- 当前8.42kHz低通不针对20–250Hz；不能归咎于它“切没了bass”。两级压缩阈值−7/−9dB，远场输入明显低于动态压缩范围；但WebAudio压缩器自带makeup与固定lookahead，不能把它当作纯透明限幅，也不能靠调阈值推断最终峰值。[W3C Web Audio规范](https://www.w3.org/TR/webaudio-1.0/#DynamicsCompressorNode)

## 获准的单变量候选

第一候选仅将burst参考gain由0.90改为3.60（+12.04dB）；海风、发射/噼啪、距离/HRTF/传播延迟、master与两级压缩参数不改，不新增合成低频。旧完整模块保存在`audio-baseline.js`，SHA256为`8e1c07a73075c9292a2dbf4843a05e53e226e0f20f7228a0a7a86c1ad5476d62`；第一候选存为`audio-gain12-unprotected.js`，SHA256为`153813d110d7e9160acf919be9fe7a14c03f573c848df86004dbd2d4050d6f61`。

`audio-ab-check.js`通过独立OfflineAudioContext借用**实际**`createSoundscape.renderOffline`主混音图，在原图构建后、离线开始前prepare录音并enqueue。实际baseline/candidate模块各测318m单/双、24m双、0m双；两发使用同一实录同相位，属于保守相干叠加。统计预WAV Float32峰、全幅/连续全幅样本、同一海风背景的瞬态对比与排程。

第一候选真实浏览器`audio-ab-first.json` **8/10**：318m单/双峰约.2059/.4127，远距20ms相对海风对比2.63→10.38；但24m双峰1.05748，6个全幅样本/最长2连续，0m双峰1.07630，8个全幅样本/最长4连续。不能把已编码WAV的截断当作安全通过。

据此第二候选只在pyro compressor之后、根master之前加线性Gain0.80（−1.94dB），源burst仍3.60，其余压缩/滤波/延迟保持。净标量主爆提升约+10.10dB；所有烟花SFX都会承受这1.94dB余量，不能声称远场完全不变。没有新增非线性谐波/限幅/WaveShaper/lookahead，也不声称是任意源数的峰值限制器。第二候选源码SHA256为`a07f25d6782fa8bdcb9dd460eada531cae8b115f8fa3f539531f0bc96a47474d`。

真实浏览器`audio-ab-headroom.json` **10/10通过**，记录candidateFactoryOverridden=true与A07源码hash：318m单/双peak.16498/.32995，差分RMS相对原baseline均提高10.103dB，单发20ms相对海风对比2.63→8.31；24m双peak.91314，0m双peak.93101，所有情景全幅及连续全幅样本均0，四情景排程变化均0秒。保留这一最小候选，不追加非线性处理。这仅覆盖最多两主爆、声明的同背景/方位/音量样例，非任意源数/任意系统的安全声压或真峰保证；真实同机位24s重录和用户听感验收仍由root继续。

**第二次实际试听后，用户仍明确觉得A07偏轻。** 因此上述10/10不代表主观目标达成。`audio-grid-check.js`在筛查阶段仅在内存构造18组burst gain7.2/10.8/12.0、postgain.6/.7/.8、attack0/.0005s变体，目标是在318m再提高约8–10dB并同时压住近场双发峰；先screen两情景，再至多三组完整确认。筛查时不改运行时，也没有加入额外低频、海风duck或最终硬截断。

## 更强候选：真实网格后落盘

`audio-grid-check.json`已实际运行18组筛查并完整确认3组。root选择`gain12 / postgain.70 / attack.0005s`：318m单峰.46230、双峰.60280；24m双峰.93335、0m双峰.96784，均无全幅样本/平顶警告。相对用户第二次听过的A07，318m差分RMS再提高**9.061dB**，20ms相对海风对比8.31→23.37。固定海风/真实录音/距离/HRTF/传播排程，未添合成低频、Worklet、WaveShaper或最后硬截断。

已将这组参数落入唯一运行时文件`fireworks-audio.js`，当前冻结SHA256为`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`，mock仍12/12。用户听过的A07完整代码保存在`audio-a07-baseline.js`、hash仍A07；原最早版另存`audio-baseline.js`。网格helper已改从保存的A07构造内存变体，因此当前运行时变了仍可复跑。

`audio-selected-check.json`真实浏览器补测 **16/16通过**，基线hash为A07、候选hash为4e5ede41，确为**A07对新版**。最大当前作者事件能量1.15（棕榈主爆）的24m相干双发峰值**.9427369237**、0m双发峰值**.9774701595**，全幅样本均0、无平顶警告。318m单发差分RMS实测比A07高**9.061dB**，20ms相对海风8.305→23.368，排程变化0秒。这里是声明场景下的sample-peak检查，不冒充任意系统/任意源数/真峰或实际SPL保证。

root已生成`boom-v3-before-after.wav`，按A07→新版排列、同背景同音量并交给用户试听。**第三次A/B后，用户明确接受“冲击感合适”。** 此接受仅覆盖这轮对照的主爆冲击感，不扩展为所有音色/录音背景/播放设备/声压的全面主观验收；16/16依旧只是声明情景的技术检查。离线对照也不替代统一重载后完整岛屿/动态控制的验收。运行时音频保持冻结4e5ede41，不再调整增益。

```js
const {createFireworksAudio:candidateFactory}=await import('/fireworks-audio.js?selected=12-07-0005');
const {runFireworksSelectedAudioCheck}=await import('/verification/fireworks/audio-selected-check.js?v=1');
const result=await runFireworksSelectedAudioCheck({candidateFactory,capture:true});
// 6情景×A07/新版 + 参数/时延等共16项；两段far WAV在result.audio。
```

```js
await runFireworksAudioABCheck({capture:false});
// capture:true另返回318m单发的baseline/candidate WAV，注意分开保存dataURL。
// 同一页面换候选时显式注入cache-bust导入的factory，避免ESM缓存旧节点图：
const {createFireworksAudio:candidateFactory}=await import('/fireworks-audio.js?headroom=2');
await runFireworksAudioABCheck({candidateFactory,capture:true});
```

离线图固定同一listener/方向、风1.8m/s、swell envelope0.5、master0.75；它验证实际音频节点的安全和相对动态，不冒充先前24s录像原样重放。最终仍需同机位、同系统音量重录24s A/B并由用户试听。未测耳机/扬声器频响，也未校准实际SPL。
