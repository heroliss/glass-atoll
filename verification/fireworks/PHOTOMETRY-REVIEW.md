# 现场首轮后：源强、尾迹与接线审查

2026-10-26，只读审查；不修改作者源强。root实际GPU `../playground-first-gpu.json`：effects8/8、光学7/7，已知100cd/100m的积分目标.01，实际.00999737；此证据只证明给定源强的转换/核积分近似正确，不证明输入源等于真实消费烟花。

## 光度量级的证据与不确定性

当前普通星头5–10参考cd、rocket18参考cd是作者标尺，**没有普通消费烟花逐星现场标定依据**。开放原始实测 [Juknelevicius等，2021，Table2](https://doi.org/10.1002/prep.202000114) 的静态蓝焰试样平均Iv约10–388cd，经校验的光谱测量，并列的是另一单位cd·s/g。作者明确静态燃烧不代表飞行气流环境，气流和燃烧稳定性都会改变表现；因此不能把该范围直接当每颗消费烟花的标准，更不能据此把我们的值统一乘10或30。这个研究只证实实际光强跨度大，也有亮度/饱和度权衡；不提供本模型rocket18cd的校准。

因此保留author reference标签；不因岛在C=12EV变黑就判定星源不足。C是摄影选择，P是存储范围，二者独立。先同机位/同相位固定C比较main emitter、局部照明和岛背景，再根据真实曝光已知的资料做有效标尺校正；不要借提高整场ambient或源强抵消一条人为摄影cap。

## 连续尾迹与照片不是同一个目标

实际已看的Optimum实拍与 [Canon官方说明](https://www.usa.canon.com/learning/training-articles/training-articles-list/photographing-fireworks)一致：更长快门累积更长光迹；页面例图含1s与约10s快门。当前1/120s即时帧不能要求有整幅长曝光照片同样长且始终等亮的花瓣。模型菊尾的实际碎屑历史仅.35s，晚期头–尾相对速度与阻力会形成数米短尾；垂柳/棕榈分别有更长燃烧与.88/.62s碎屑历史。这个寿命是作者近似，不能宣称已由实拍反推。

但段间有缝也不应全归咎于快门：旧vertex将空间尾段`aStretch`与短快门位移`aVelocity*shutter`合为同一向量。老碎屑尾段方向和当前速度常相反，会相消；独立空间/时间卷积不应这样缩短。`trail-support-audit.mjs/json`用真实上传属性、8段、t7.2s量化这一点。现已分离空间/时间：≤1px快门以协方差trace守恒的各向同性方差近似，>1px独立3点积分；不是精确时空卷积。正常尾段仍8次核计算，近景大快门24次，无新pass。

`../playground-second-gpu.json`真实GPU固定C16.5/同t7.2s/同物理头I与半径的A/B4/4通过：尾部线性HDR立体角积分比1.0000234、亮头逐像素0差；1139处同一几何连接的亮度p10 .7087→.7536，median .9258→.9859。已实际看`trail-baseline.png`和`trail-candidate.png`：候选连接略饱满，但原尺寸下差异轻微，整体仍是许多独立短金线，不能称由此变成摄影般长尾。该已知数学缺陷已修；它只解释一部分分段，不证明所有真实感差距来自此处。不能仅把每点放大、加亮或延长全局history来掩盖分段。

## 主帧接线发现

- `drainEvents()`都有eventId，fan各发共享同一ID。构图应按ID去重，不按每个launch脉冲重新启动1.45s过渡；音频仍保留逐发。
- 全局暂停时不推进自动scheduler，避免暂停中创建launch后将静音事件永久标为已投递。root已接手main这一点。
- 已修owned音频race：root context在异步graph构建前就可用，原helper可能在aux=null时留下半初始化断路。现在先等ctx+aux就绪才提交bus，空事件直接返回；mock回归12/12。未改main。
- root主+mirror按相同物理状态/曝光绘制，透明反射不采当前附着depth；GPU已验证有限P→source消光和A0发光。当前CPU压力报告仅局部工作成本，不能作为场景FPS。

## 离轴存储上界回归

后续交叉审查实际复现了球面参考上界的错误：shader有限Gaussian半径按view-depth投影，像素立体角却按欧氏视线角计算，因此离轴峰并不受`I/(πr²)`约束。新预算直接用shader的sigma和Ω，以单位像素积分不超过`min(1,1/(2πσ²))`约束每个非负归一核；空间stretch/快门分别取实际投影端点，跨near就覆盖整屏，不用速度/depth的小角度估算。

`../playground-third-gpu.json`真实GPU7/7：故意选的resolved离轴蓝源峰4.97283、旧budget1.93608（低估2.5685×），新budget5.99383覆盖；near head/tail的escapedPixels=0，无NaN/Inf，叠加及生产records→bins也覆盖实际峰。保留的globalFiniteSurfaceCeiling只是旧球面参考字段，已加globalReferenceOnly；不许再拿它宣称投影shader严格上界。源强、物理火焰半径、head/tail shader此次都未改。

仍待实际：同一可见场景的摄影cap16.5对照、头/尾连续动态、镜面范围、主爆实际试听与完整性能。未把隔离数值通过写成照片级验收。
