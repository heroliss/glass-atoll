# R12：黑夜烟花的源光度、受光与显示因果检查

2026-10-28。本阶段首先只读检查了R11实际图像/JSON及运行时；之后按根代理明确授权实现了**独立opt-in的热体光度候选**，没有改默认。未操作浏览器，未运行实际GPU，不声明照片感、真实烟花光度或帧率通过。

## 当前黑场能确认的原因

R11 `r11-tail-cooling-willow-scene.json` 中无月夜、burst后2.2s、固定摄影C16.5的实际源簇为562.882230cd，位置`[98.621028,187.982378,24.847634]m`，RMS半径28.045907m。对岛心水平面计算：

| 条件/计算 | 数值 |
|---|---:|
| 源簇至岛心距离 | 213.730875m |
| 反平方并乘水平面入射余弦，未含范围衰减 | 0.01083759 reference lux |
| 当前native/custom共同280m范围cut因子 | 0.43626320 |
| 范围cut后岛心入射 | **0.00472804 reference lux** |
| 假设沙反照率ρ=.8，Lambert反射，C16.5，原raw比例 | **0.00305304** pre-tonemap线性显示值 |

这只用捕获的源簇和既有公式，不包括纹理、阴影、BRDF细节或实景GPU像素；足以说明“天空中亮点能过曝，而地面近乎黑”**不需要先假定HDR/P链坏掉**。小半径点源直接辐亮度很高，但数百cd散到两百米外只有很弱照度。`scene-radiometry.js`的raw换算与`2^P`存储、`2^(C−P)`输出相互抵消，不能通过提高P增加场景物理光。

烟源同样存在空间/时间不足：上述R11场景实际只有24个production Gaussian核，M20.35在.65s前已全部排出，此后不再沿长寿命柳星连续补烟。resolved lighting明确`requestedEnabled:false/reason:disabled`，**不是pair cap触发的静默回退**。新all-logical源覆盖与预算由另一专项推进，本候选不把发光RGB、PSF采样点或音频能量变成烟M。

原生头强度为作者reference值：常见5–10cd、柳2.8–5.2cd、棕榈48cd、扇彗52cd，上升附着光18cd。当前没有独立的空中爆点瞬时强光源：`events[].kind='burst'`是物理/音频触发，源records主要来自carrier/head/tail，不能把音频事件energy当可见光cd。新增爆闪需要自己的时间积分/源面积/光度依据，不能拿一张过曝截图确定峰值。

## 文献能支持什么，不能支持什么

[NIST candela realization](https://www.nist.gov/pml/sensor-science/optical-radiation/realization-candela)给出光谱辐射量通过`683∫X_e,λ V(λ)dλ`转为光度量，以及远场照度/强度的反平方关系。其标准V(λ)范围为360–830nm。它支持单位和测量方式，**没有提供本场景烟花的cd**。

[CIE Planck定律](https://cie.co.at/eilvterm/17-24-005)定义黑体光谱辐亮度随温度/波长的关系。[CIE luminance](https://www.cie.co.at/eilvterm/17-21-050)将亮度联系到指定方向的投影面积。因此，均匀Lambert球体在某方向的强度可用`I_v=L_v·πr²`，灰体再乘ε。这里是投影面积，不是整个球面`4πr²`，也不是再把结果重复乘π。

[JES真实烟火星燃烧观察](https://www.jes.or.jp/mag_eng/stem/Vol.68/No.5.04.html)支持实际火焰强度随时间显著变化，但公开摘要没有可转用的绝对cd曲线。已查到的实验照明flare研究、警示闪灯的effective intensity与普通展示星不是同一种源，不能把它们的峰值直接套过来。[NIST flashing light说明](https://www.nist.gov/pml/sensor-science/optical-radiation/effective-intensity-flashing-lights)还区分了瞬时/积分/视觉有效强度；单帧白芯不能直接变成恒定源强。

未找到可直接用于当前150mm柳/棕榈各星、带几何尺度和时间响应的公开绝对光度数据。**不能把缺数据写成测得当前强度错误**，也不能用实验flare的数字或照片饱和区反推当前cd。

## 已实现的有界候选

`fireworks.js`冻结SHA256：`bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b`。R11原文件CC完整保存为`verification/baselines/r12-before-thermal-photometry/fireworks.js`；精确8块逆变换`r12-thermal-photometry-normalize.mjs`恢复其全部字节。没有新增静态运行时import，既有data-URL工厂夹具继续可用。

- `createFireworks(THREE,{photometryMode:'reference'|'thermal-greybody',thermalEmittingRadiusMm:2})`；可在暂停状态用相同字段`configure()`切换。
- 默认`reference`，没有额外默认diagnostics字段；显式candidate输出`diagnostics().photometry`，并有只读mode/radius getter。
- 固定T2850K、ε1，精确SI常数h/c/k、1nm步长360–830nm，使用**原有解析CIE-Y拟合**积分。这个T是作者色温代理，ε与有效发光面积也是假设，并非测温/实物标定。
- 参数radius1–3mm指**4 reference cd面积单位的有效半径**；一个原生body的相对面积为`body.referenceI/4`。因此2mm不是声称所有星都一样大：Iref52的扇彗对应相对面积13、有效半径约7.21mm。渲染Gaussian/PSF半径仍完全分离，禁止把约1cm的显示核直接当黑体物理发光面积。
- 只对原生`body.colour===EMISSION_PROFILES.thermal`的完整body预算缩放一次。头部和分离尾部保持原有.66/.34等分配和包络；彩色头部及其看起来金色的尾段**不单独加亮**。上升装饰光是native thermal，因此同一规则适用，但不改变它的弹道/熄灭规律或解释为发动机。
- 不改M、source provider、随机数、燃烧life、位置、速度、形状、声音、R11固定Y冷却色度或shader。实际record I自动进入已有ledger/cluster/峰值边界；暂停mode变化重新生成records并使相关缓存失效。

积分结果：2850K的拟合`L_v=19,417,669.16cd/m²`附近；r1/2/3mm的I分别为61.0024068/244.0096271/549.0216610cd。当前柳2.8–5.2cd若解释为相同T/ε的灰体，只相当于约0.214–0.292mm有效半径；这不是对真实物理尺寸的测量。2mm reference-area候选与原I的倍率为61.0024068，**固定本配置时数学上就是一个明确、统一的native-thermal缩放**，不能包装成已独立标定的真实能量模型。

以原实际柳簇作解析推算，2mm候选将岛心范围cut后的reference E推到0.288422lux，pre-tonemap约0.186243。它给出可证伪的实景预期：若同事件/C下地面依然几乎完全黑，就要检查受光路径而非继续增大源强；若地面与烟一起过亮，先检查此作者有效面积假设和显示，不增加任意“烟专属gain”。

## 验证结果与根代理接力

[r12-thermal-photometry-check.json](../r12-thermal-photometry-check.json) **12/12 CPU通过**：

- 十型×六相位reference记录/诊断/ledger/簇/边界/声音事件与R11逐值一致。
- 十型×五相位candidate只改变应选native thermal体的I：8505条thermal记录被缩放，9428条彩色体记录保持，含6347条金色外观但来自彩色体的尾段。
- I0/.2/1/64、r²、R11 cooling组合、暂停切换/roundtrip、非法混合参数拒绝、两个主/镜像CPU上传路径均检查。
- 新`getFramingSources()`仅深不可变复制**当前**正发光records的`eventId/position/intensity/colour/radius/stretch`；不推进时间、排事件、查未来或改变ledger引用。它供相机专项读当前真实源，非新的照明/物质账本。
- 独立SI积分和官方CIE 1nm V(λ)交叉检查：解析拟合相对官方V结果约**0.1677%**偏差，小于预声明1%门。官方数据原SHA256与元数据校验一致，CC BY-SA4.0署名见`verification/references/r12-cie-photopic/SOURCES.md`；仅QA使用，不作为新增运行时数据集。

下一步由根代理在实际浏览器固定同事件、同物理phase、C、镜头、烟state与天气，A/B/A切reference→greybody2mm→reference：记录真实ledger版本、sourceI、cluster、P独立重预算，完整主/合成/倒影HDR缓冲有限非负，量化白沙/近场旧烟的受光差；用两个相位（例如早.15s与2.2s）避免把无爆闪与后期弱源混淆。不要先把它设为默认，不拿上述CPU上传或解析白沙推算代替GPU画面。

气象云另有距离和量纲限制：既有可见云多在7.8–41.8km，而source高度约190m；远云反平方和散射角很不利。即使近场烟在新源下明显被照亮，也不能宣称几十公里外气象云应同步大亮。要校核云/沙同入射E，还需独立slab/白卡光度夹具，不能翻转相函数或加云专用强度追图。
