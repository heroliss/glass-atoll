# 新复杂样式与可选火光AA

FW新增 `sourceStyle` 分支：头部从 `sampleComplexStyle` 取完整包络/颜色；尾从 `sampleComplexTailStyle` 取release-age包络与lag颜色。head使用 `1-f`，tail使用原归一化指数权重乘 `f`，作者I0和全相位RGB上界各只乘一次。新分支不进入vector RGB8段积分，不生成24项RGB taps，不做逐帧谱积分；仍保留原scalar8个曝光包络权重。旧body没有style时，原数值表达式/颜色身份保持。

`event.opticalFlashes` 进入可见记录、即时ledger与cluster，标为optical-flash；物理烟源/燃烧图仍只枚举 `event.heads`，闪光不增加材料。display-vfan按实际birth寻找对应lift；waterfall-ember燃烧图透传明确的parentVelocityFraction。辅助音频事件独立于材料trigger，认可audio模块未改。

新complex world bounds除原采样外，合并island lane的连续家族封套，使用实际launch方向/原点、muzzle0、完整已提交wind min/max与快门。每event WeakMap按wind范围和shutter缓存，避免每个2Hz时间桶重建canonical新烟花。新构造器已拒绝显式高度/定时引信；若防御性遇到未覆盖模式，仅标明sampled-only，不冒称解析保证。旧十型的bounds路线不变。

## 火光AA

`optics.firelightSigmaPixels` 遗漏时为 **.28**，root可显式选 **.42**；有效范围.28.. .6。只给未分辨scalar、非尾点设置图像面最小sigma，已有物理/DOF宽度更大时保持。native scalar尾节点固定radius.0018，包括零长出生节点，明确排除；vector与smoke排除。不改变body半径、光量、运动或材料。

vertex新增uniform与条件分支；fragment不变。旧.0784默认计算保留，新点可扩大sigma，并增加 **.25px** quad margin；CPU radiance peak、投影rect、FP32保守cull与prepared optics key同步。无新RT/pass/MSAA。新uniform显式给定时，lastRender报告实际Float32值。

旧quad下.42研究最大漏尾3.101e-5，未达原2e-5门，保留为 `firelight-psf-study.json` 的 `passed:false/completed:true`，没有把阈值放宽。加margin后，在706m真实投影的49个subpixel相位，最大单位光量误差 **3.840e-6**，通过原2e-5门；旧.28为8.176e-6。完整未截Gaussian积分仍归一。peak相位比约3.430→2.431，但像素角的2×2形态无法由CPU模型宣称消失。

模型平均覆盖像素约 **10.80→23.59/小头**，这是局部成本增加，不能称整帧提速。真实GPU/compiler、画面、HDR与连续性能尚由root后验。AA默认数值CPU路径与旧版相同，shader文本已有显式改动，**不再宣称vertex字节不变**。

## 当前CPU结果与保留原件

- `render-style-check.json` **5/5**：原十型真实producer records/有效attrs/ledger/cluster/descriptor精确；新十型实际scalar头尾/颜色/上界一致；闪光可见且不进材料；新连续forecast/cache/扩风失效；fragment和音效保持，vertex仅允许显式AA差异。
- `firelight-aa-check.json` **5/5**：49相位能量门和保守peak；默认/.28旧bounds+cull精确；尾/vector/烟/已分辨/DOF不变；四边quad保留；真实factory uniform/attrs/ledger、prepared失效与invalid optics先于renderer。

全部为真实CPU生产函数加无GL renderer/read-only probe，不是GPU执行或FPS验收。原FW及style-before-AA的4/4、physics尚未附flash时的3/4、源提取旧cache probe失败、初始脚本语法错误均保留于 `before/`；未通过修改物理或放宽误差门来掩盖。
