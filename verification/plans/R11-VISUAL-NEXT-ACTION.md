# R11：分离“火星变暗”与“火星变色”的最小实验

2026-10-28。原只读审查已推进到明确授权的 opt-in 实现；未选择新默认，未运行本页所述 GPU 场景或宣称照片感通过。当前运行时 `fireworks.js` 为 `cc864bf4cbfee0739362bc3b3770e0d8a2840238afe989b4c8815170660724e6`；音频、物理、烟源、shader、main/UI 均未由本实现修改。

## 从现图和源码能确认什么

实际看过 R10 `r10-logical-bouquet-0p8.png`、`r10-logical-crossette-3p6.png`，以及用户湖面单发参考 `verification/references/user-lake-single-shell-20261027/{13,17}.png`。R10宽景中烟较淡、烟花占屏较小，不能拿它们证明产烟量不足或任何新烟源已照片级。用户参考中早晚色调及背景受光变化很明显，但无逐帧时间戳、曝光/白平衡或光谱信息，不能直接反推温度和源强曲线；湖面17比13更橙/更亮也不是“实测再点燃”。

确定缺口是**原发光色度没有时间变化**。`fireworks-physics.js` 的 thermal 为固定2850K参考积分，向量 `[1.8277674763872431,.8316207499306247,.23049133199015837]`，线性sRGB的Y≈1；body.colour终生不变。原`starEnvelope`已有起亮/衰退/strobe，因此不能说整个模型始终同亮。真实seed42柳的一颗头在life比例.05/.25/.5/.75/.95时包络约.95588/.80779/.67331/.57921/.02277，色度仍完全相同。

原`fireworks.js`脱离母体的余烬已经有真实过去位置、.25继承速度、阻力/重力和按lag衰减的亮度权重，但所有尾段仍用同一thermal色。这个局部缺口不需要改动烟量或曝光即可做清晰的单变量实验。

ACS区分炽光与谱线/谱带发光，温度影响炽光颜色，不能用一个黑体温度生成所有饱和烟花色。[ACS原始教育材料](https://www.acs.org/education/chemmatters/resources/fireworks-what-do-we-know-about-fireworks/further-exploration-activities.html)。色度匹配应积分光谱；官方1nm标准配色函数有独立来源，但本轮保留原解析CIE拟合，未偷换为该数据集。[CIE官方表](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer)。这些来源只支持成像机制，不提供本型号余烬的实测温度/冷却常数。

## 已实现的单变量

`createFireworks(THREE,{tailColourMode:'constant'|'cooling'})`，或在同一暂停状态下 `fireworks.configure({tailColourMode:'cooling'})`。默认constant；getter `fireworks.tailColourMode` 及显式选择后的 `diagnostics().tailColour` 报告当前模式。原默认诊断形状保持，无需冷却LUT分配。

cooling仅将**脱离尾段**的参考色度设为 `T(u)=2850−950u`，`u=lag/existingDuration`；1900K端点是明确的作者实验值，不能称真实测温。它不随body年龄擅自改变仍在燃烧的头部颜色，也不推断上升火光是发动机。现有duration `.88/.62/.50/.35s`、尾段位置/速度/尺寸、I、亮度权重、包络、物理life、事件/声音与烟M完全保持。

首次cooling才用原5nm Planck/CIE拟合和同一中性抬升色域压缩生成129条RGB，归一至Y=1，运行期只线性查表。模块 `fireworks-thermal-tail.js` 是无场景的纯重导出入口；没有给运行时增加新的相对import，从而保留既有dataURL QA工厂加载方式。

这是**固定参考cd下的色度实验**，不是热传递、化学或总辐射能守恒。Y归一主动移除了Planck的绝对亮度，亮度仍由旧模型给定。较冷端最大RGB通道2.58522，高于旧1.82777；不能继续使用旧RGB峰值上界、固定P或在末端裁色。

## 共享光链路与明确接点

1. `updateRecords`尾段唯一`colour`字段改变。头部仍使用`body.colour`；constant分支逐字维持旧thermal向量。它在模式切换时从同一simulation.time重建records，不推进时钟/RNG，不drain事件。
2. `getEmissionLedger`从该同一records的 `intensity×colour×rawPerCandela`写完整Float32源；没有第二套“只为烟/照地”颜色。records身份变化使旧ledger缓存失效。
3. `getLightClusters`读同一records，按I加权RGB；模式切换时clusterCache被清空。moment近似/半径未改。
4. `getRadianceBound`、`writeSourceBound`仍从实际record的最大RGB预算，boundCache随records清空；main/mirror的 `fillRecords`读相同RGB，并各自应用原源到镜头透射一次。shader没有颜色gain或额外发光。
5. 根代理接QA setter后须重新运行原统一P预算/历史恢复；固定摄影C比较，允许P为新最大RGB变化而改变。不可把存储P变化误认为源变亮。此模块不自行修改root的P/C。

## 已完成CPU与接下来的实际场景

[专项报告](../r11-tail-cooling-check.json) **8/8**：40个十型实际工厂状态、18998原records与R10 b37默认逐值相同；all10 cooling只改变6102尾段RGB，1403其余记录不变；1万点正值/Y和有界插值；257色独立1nm积分；暂停切换/ledger/cluster/bounds失效及constant往返。1nm比较仍使用同一解析CIE拟合，不是实测SPD或官方表准入。完整6723源Float32 ledger的Y相对误差≤3.17e−9。该CPU报告不证明实际GPU/照片感。

下一步只做一组**同暂停事件 A/B/A**：

- 首选palm或willow真实事件seed42，固定风/摄影C/镜头/烟profile/受光选择；暂停在burst后1.8秒。原宽景截图不够评价，镜头使主要尾迹高度至少约500像素，并另保留完整海面倒影的宽景；每个机位内部保持同一相机。
- Aconstant、Bcooling、A重复；保存原始1920×1080 SDR图和HDR opaque/composed/reflection读回。A重复应字节一致或如实给稳定性差分，不能把TAA未收敛的改变归给颜色。场景无源/无尾或只有白色饱和芯时拒绝夹具。
- 核对同physical.time/头部/所有I与运动/烟M/事件队列、完整ledger源数；只有尾RGB改变，Y在约定误差内。RGB峰值预算覆盖新色、三个buffer有限非负、GL[]。mirror需实图或像素差分，CPU同源不代替实际反射验收。
- 画面评价看新旧尾之间是否有细微暖色梯度、老余烬是否像细火星而非彩色LED；头部仍有层次、冷尾不过度红或全剪切。若只是换橙色、整体仍灯串感，就记录否决，不提升默认。
- 性能只在同演变相位、同分辨率/阴影/烟/声音下测新增记录计算与整场CPU/GPU；此LUT不是新的每尾81波长运算。无实测前不称零成本。

之后才分别做品种烟量/产率和多层星壳/变色星的实验。当前所有空中总M仍20.35的作者参考；这一色度模式不解决其真实品种差异、不补齐发动机燃料、不让远处气象云自动受光，也不取代4096积烟压力门或整体照片感验收。
