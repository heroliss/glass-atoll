# Phase A首张笑脸实景：可读，但面部偏霓虹

2026-10-27，只读视觉复审。实际查看`verification/pyro-r2-smiley-hero-first.png`，并再次直接查看Optimum原始[Smiley Shell JPEG](https://www.optimum-fireworks.co.uk/images/glossary/smiley_shell.jpg)。未操作浏览器，未改冻结physics、render或音频。

首图中外圈、两眼和笑口很容易辨识，这一可读性目标已经在这个正/斜视机位出现。它仍有明显图形符号感：口部几乎是连续绿弧，眼是完整中空小圆环；外圈离散点与面部连续线的视觉语法不同。整齐外圈本身不是可靠缺陷判据，因为真实图案弹也有受控几何轮廓，不能只因“太规则”就随机打散。

实拍的外圈与下部口能看到分离星点/短光迹，两眼更像紧凑亮点。原图仅200×131且曝光参数不明，不足证明眼一定只有1/2/3颗，也不能将白芯直接当真实发射光谱。照片的倾斜椭圆符合平面斜视；hero同样倾斜并非必须修正成正圆。

## 首个可检验原因：嘴的线密度比外圈高约2.4倍

当前冻结8c实现，外圈72点、半径1，嘴48点、半径.54、半圆且包含端点：

```text
外圈相邻弧长 = 2π/72 = .08727
嘴相邻弧长 = π*.54/47 = .03609
嘴间距 / 外圈间距 = .414
```

同一实体源PSF/曝光/全场微散射下，嘴天然更容易接成线。按hero约70px的外环半径估算，间距约6.1px与2.5px，和图上外圈仍可分点、嘴近乎连续相符。这是由实际布局可推导的具体机制，不能据此断言bloom算法自身有bug；全局关闭bloom可能同时损失其它真实亮点的镜头响应。

## 两个独立A2候选，尚未获准实施

1. **稀疏嘴弧。** 单独改为约20–24个星，接近外环的单位弧长密度；保持单星I/radius/drag/life、世界平面与时钟。24点的嘴间距约.0738，20点约.0893。它会减少总星数及口部总发光量，必须明确修改144星合同并让全部照明账本如实变化，不能偷偷把少星的I补大。先看离散性与嘴是否仍可读，不能只为等总通量而引入更强亮头再次连线。
2. **填充眼团。** 单独保留12+12星和原I/半径，把圆周布局改成更紧凑的填充团，消除“中空瞳圈”。这是替换图案设计，不声称测得实物内部星数/排列。聚集光源会提高局部重叠峰，虽总I不变仍须重跑投影budget/飞近/离轴，不以能量总和相同便声称数值安全。

两候选必须分别对同一source seed/phase、相机、C/P、PSF/bloom拍A/B；mono先分离布局，再拍作者双色。初始速度、世界风和重力不因相机改变，不引入每帧随机化。不同时加制造误差、不同drag、不同寿命和新flare后再称找到单一原因。

目前不支持给整个圆环任意噪声。单张未知快门的小图不能提供初速/方向误差统计，更不能为逐帧闪烁背书；若以后要做制造差异，应以有时间标尺的实拍序列拟合固定seed的初始差异，保留controlled pattern这个事实。

这是一张静态实景的图案复审，不代表已经观看连续动态、所有侧视可读或整个烟花/云烟照明已照片级。原8c物理和锁定4e5音频继续保持，等root选择是否进入A2。

## A2实际对照后选择reference为默认

后续授权加入四个隐藏`smileyLayout`，最初默认`dense`进行受控对照；实际GPU22/22通过且四布局PNG验收后，根代理选择`reference`为新默认，没有加入每帧/初始随机扰动。8c完整物理源码及其`wind-response.js`依赖保存在`verification/baselines/fireworks-before-smiley-layouts-8c147ee/`。上面的初次只读判断保留为过程记录。

| layout | 外环 | 每眼 | 口 | 总星数 |
| --- | ---: | --- | ---: | ---: |
| dense | 72 | 12圆周点 | 48 | 144 |
| spaced-mouth | 72 | 12圆周点 | 24 | 120 |
| compact-eyes | 72 | 12填充点 | 48 | 144 |
| reference（当前默认） | 72 | 12填充点 | 24 | 120 |

填充眼使用固定golden-angle方位和等面积径向分位，包含中心与原`.105`支撑半径；未消耗新事件RNG。减嘴候选用原前24颗口部星的强度、寿命、半径及seed覆盖完整U，另24颗真正移除。seed42的作者参考总cd从1104.9569降至923.9652（约−16.38%）；这不是绝对实物测光，也没有补偿增益。24点口部相邻弦的速度间距1.54774m/s，原48点为.75785m/s；在共同线性阻力下，间距随同一travel因子演化。

切换默认后重新执行CPU：`smiley-height-check.mjs`37/37、`physics-check.mjs`22/22。前者对144组输入严格比较显式dense与8c全部旧事件字段，唯一豁免是有意更新的`definition.count:144→120`默认元数据；其余definition字段及全部heads、rocket、burst/endTime仍逐值严格相同，不豁免物理输入。每组同时验证默认事件严格等于显式reference120。其余九类对108组输入保持全部旧字段相同，地面型动力学未动。`actualStarCount`反映实际事件：显式dense/compact-eyes仍为144，reference/spaced-mouth为120。新布局仍是固定世界平面；侧视变薄是预期，不会朝向相机重建。

实际GPU报告`verification/pyro-r2-layout-and-director.json`记录smiley22/22，其中选定dense的核心18/18、四布局正面4/4；同报告transfer14、director12是其它模块的独立检查，不能合并冒称本工具48项。已实际查看`verification/fireworks/smiley-r2/layouts.png`像素：24点口比48点口更分离，填充眼消除了完整空心环；reference比dense更接近所选实拍的离散点语法。这不证明精确实物制造排列或绝对亮度标定。

当前GPU工具默认`runSmileyGPUCheck(THREE,renderer,createFireworks,{size:640,capture:true})`已改选reference，仍保留18个核心条件及四布局正面条件，共22项；默认切换后的selected-reference核心复验及全岛双色RGB截图由根代理继续，尚不套用旧dense核心结果。`images.layouts`始终固定相机/距离/seed/实际burst+1.1s/C16.5/P0，未逐图缩放或等能量。`two_tone_front`沿用选定布局。黑背景独立效果层不代替全岛、镜头bloom、近距离预算或动态实景验收。此前16/18失败报告保留；两个反射夹具漏传`reflection:true`已修正，并断言真实材质define/depthTest/lastRender，而非把旧失败称为生产反射缺陷。

实际四布局对照版本physics SHA256为`1303b7227d12167b28b171727d621b0a3fc0f245f150beee790792e72cbf5b1a`；默认reference最终候选为`5a61e6b87b233941cba647bfc44599009ee679f2f91172ececac66a045609b41`。GPU helper为`77eb8c67c82211e597930dc0dc3ea3d3d7b583e2b3825c8a56401682ac060b6a`。默认选择已确定，新的selected-reference实际复验待补；音频4e5继续锁定。
