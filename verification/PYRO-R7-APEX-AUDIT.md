# R7抬高near-apex单发：独立只读审计

2026-10-27。读取[实际电影记录](pyro-r7-apex-motion.json)、[媒体5/5](pyro-r7-motion-media-check.json)、[CPU包络研究](fireworks/near-apex-envelope-study.json)，逐张实际查看[hot](pyro-r7-apex-hot.png)、[late](pyro-r7-apex-late.png)、[cold](pyro-r7-apex-cold.png)。未重跑场景、未修改代码/参数；本次未连续观看mp4，不能把三张stills说成全片视觉验收。

## 实际配置与高度含义

一发ring/reference笑脸、seed42、I1、elevation80°、native风1.8m/s，ring-burn/TaylorTL10源，C锁16.5，1920×1080。`flightOptions`仅显式worldY141.47704875875286，没有timed3；metadata给实际burst worldY141.47704875875274、发射点以上rise约140m。**141.477是世界Y，不是rise141.477；140是作者高度variant，不是原90mm/120m供应商参考被重新测量。** 原productReference仍120m，widthCalibrated=false，保留该区分正确。

source的首个实际launch packet时钟与burstTime相减约5.00831s，吻合默认near-apex rise140解析模型；不是从视频图像测出的vy0。当前原生factory的apex分支与CPU研究给该条件burstVy≈0，未额外继承timed3的+21.5m/s升力。没有证据说生产默认height已变；这是显式每发QA override。

CPU研究是**240组/7检查通过**，不是240项GPU测试。seed42/80°/originY1.5的height-only140预览：最低life几何Y17.149m、I01最低22.876m、I10最低34.702m，顶端159.882m；life/drag/I/水平展开保持。实景originY约1.477，数值相对表约低.023m，风1.8与原CPU无风不同；常水平风模型的竖直独立性有另一个0/5风门，但不能把CPU包络表当电影逐body实测。稀疏100份scene日志没有保存全部头部轨迹，不能据它独立重建全时域最低亮点。

## 100份实际记录的质量与受光

- 100 samples跨wall .2722–20.0146s、physical1093.2951–1112.6485；全部保存C16.5，P范围11.75–12.25，自然安全选择，没有固定存储P。
- airborne从0单调累积到20.35；100行`emitted-airborne`最大绝对残差0，source分配账残差最大约1.09e−14。最后M20.35、628packets、pending/reserved0；全部sample merges0，source fault0。不是在初生时就把全部20.35瞬间放进场景，也未在退光后删除物质。
- 98个非空烟sample的field均effective/supported/ready，最大工作量59455pairs，低于1048576上限。hot约+1.10049s：180packet/M6.33125、120光源；late约+3.46279s：557/M18.61862、85光源；cold约+9.14459s：628/M20.35、0光源。source退光与物质保留确实分开。
- 本电影JSON未保存完整主/镜像HDR范围读回，不能借上一80/80两事件的范围门冒称本20s每帧NaN/负值/headroom已独立检查。field ready/source bookkeeping也不代替逐像素光程或绝对照烟标定。

## 图像与交付边界

hot主体完整入画，late展开且下降，末端明显弱于hot，cold不再见亮星但日志M仍20.35。图案主平面/投影没有为维持正面而billboard。**完整水中倒影仍未入画**：late底边只能见到被裁开的部分金圈/绿点，hot更高主图的完整镜像也不在此FOV；这不是“主图实际body fit”已解决的范围。未来构图须把镜像支持单列，不靠抬高主体证明倒影完成。

hot依旧有较整齐、近等亮的点串/LED笑脸观感，内侧烟/尾沿共心径向较规整。真实pattern本来可很整齐，不能把圆形本身判作bug；但此高度改动没有解决曝光/显色时程、点PSF/尾迹及自然烟光的照片级目标。火焰照地/照烟/云的绝对亮度仍是作者reference，不能从这三图宣称校准。用户湖面参考是大面积多芯/长垂尾，不能要求这个不同效果的smiley在同phase长成相同形状。

本例autoFrame使用当前真实body轨迹后自动构图；实际相机约[-275.396,12,-207.712]，target约[39.833,83.929,24.152]。旧B采用不同I、风、rise/flight与构图/曝光策略，因此**不是固定机位/C/源等条件下的单变量像素A/B**；不以两图的“高/亮/大小”直接量化height收益。

媒体5/5包括全解码、H2641920×1080 CFR30/AAC48k、约19.996s、音频非空/无sample full-scale及锁定4e5ede41声源不变。声到达使用新实际位置/时钟，记录距离约434.922m、传播延迟1.24812s；没有再调gain。媒体检查不是新主观试听、true-peak/SPL或音画人体感受验收。30fps编码也不证明renderer达30/60fps：记录有158.513ms GPU尖峰，录制/初次工作成本没有滤掉；本报告不从HUD稀疏样本推全片FPS。

结论：本轮支持“只提高该QA事件near-apex高度、保持物质和发光定义，并由实际构图/音频路径跟随”的技术方向；不支持默认已上线、完整反射构图已完成或光影已达照片级的说法。
