# 渐暗：实例闭合与夜间可见性

本轮只读，未进一步修改生产曲线。`actual-complex-envelope-review.json` **3/3**：当前10种实际event生产器的2117个head全部保留smoothstep、style.life==body.life与0端点，273,093个峰后样本单调有界；随机planar寿命缩放仍保留插值flag。14个显式flash的.18s线性曲线/2534采样保持；32个pulse源与1344个尾迹源仍共享同一逐渐变弱的baseline。

但这不能证明感知上不会突然熄灭。main当前referenceBrightnessGain=64；storageEV只负责FP16精度，最终storage与output exposure相消，不能压低真实相机过曝。数值包络C1与白色核心是否已经进入显示曲线的衰减区是两件事。

`night-fade-sensitivity.json` 使用实际Saturn outer head（seed45002，I0=532.399637、radius=.01259583m、head share=.74），production投影函数和选定的1209×1292/FOV60°相机，假设中心像素、静止/无遮挡、AA sigma .42，评估原生legacy SDR fitted anchor。它是保守敏感性场景，不是Root当前相机/移动火花的画面；不代表HDR/ACES2输出或显示器测光。当前包络在95%life时仍为.012：

| 距离 / camera gain | encoded核心降至.95所需包络 | 降至.5所需包络 | 当前.95→.1发生于life结束前 |
|---|---:|---:|---:|
|706m / EV14|5.42e-3|5.26e-4|96.3→9.36ms|
|706m / EV21|4.23e-5|4.11e-6|7.15→.82ms|
|100m / EV21|8.49e-7|8.25e-8|1.00→.12ms|
|30m / EV21|7.97e-8|7.74e-9|.31→.035ms|

因此Root的疑虑成立：当前短尾从.012滑至0，虽数学平滑，在高gain下仍可能只有极少实际帧显示核心变暗。光晕/亮斑面积可能更早收缩，不能仅以单个白色峰值断言整个点完全没有渐暗。

建议先以Root真实冻结/演化预览判断，再决定一个显式作者曲线修订：让最后20–30%life跨更多数量级，例如.001→1e-5并继续到1e-7附近，而不是把约1%的残亮留到最后5%。这可显著扩展中远景的可见衰减时窗，但不能保证30m/EV21所有白芯都不饱和；若想所有近远视角均渐暗，还需独立评估当前曝光/64倍参考增益的过曝意图。不得每帧按相机位置改物理源曲线，也不偷偷补I0来抵消渐暗造成的积分下降。显式.18sflash与pulse乘子应继续保持原合同。

以上是候选准则，不是已部署更深tail。当前`complex-fireworks-style.js`仍为`be7e4799281b5b5590d0b3d00636d7bd293e92e573e2d9aaab5c0c87b33b816e`。
