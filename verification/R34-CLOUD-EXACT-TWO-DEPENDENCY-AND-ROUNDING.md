# R34：云形精确2端点私有候选

状态：仅可逆源码候选与CPU/source检查，**未部署、未编译GPU、未测性能**。生产 `sky.js` 保持 `51db558ead3dea10d4c74633c2a8eb5bedf20952c136e0668b97de0a5ffc8eee`。当前默认 `uCloudShapeBlend=2`、`uCloudBaseContinuity=0`，后者开启的路径也必须保留。

## 依赖与最小变换

`atmosphereCloudDensity` 前部原样执行高度/覆盖率/天气可用性早退、天气采样、region、形状采样和detail采样。紧接detail采样后插入 `if(uCloudShapeBlend==2.0)`，复制原有base、puff、billow、质量/entrainment和连续云底表达式；返回后面的billow端点。**移除补丁后原4936字符GLSL函数逐字恢复，全部fallback内容保持不动**，没有改写原mix式或中间blend路径。CPU `cloudDensityAt` 同样只对原始JS uniform严格 `===2` 进入分支；不把原clamp后的大于2/非有限输入扩大为新分支。

| 数据/计算 | 精确2用途 | 处理 |
|---|---|---|
| weather、region、shape、detail及所有UV/LOD | billow、侵蚀、base与连续base共享 | 原采样顺序、参数及表达式保持 |
| `localHeight/heightCost/field/body/inversion/legacyBody` | 只供legacy混合端 | 跳过 |
| `edgeErosion/ascent/centerHeight/verticalSigma/q/thermalMass/thermalBody` | 只供thermal混合端 | 跳过，不能跳过detail本身 |
| puff采样、billows、heightPenalty、mass、entrainment、billowBody | 当前端点真实云体 | 算术字序保持 |
| base | 正常云底 | 原表达式保持 |
| baseContinuous/continuousBase | 开启连续云底且shape.g>.5、h<.052 | 原表达式保持；返回billow×连续base，不能退回普通base |

原纹理序列仍为 weather@LOD0 → shape@lod → detail@detailLod → puff@min(lod×1.35,1.2)，没有额外采样、采样稀疏化、LOD改变或光学质量改变。只消除了旧端点专属运算。动态分支和重复源码可能增加程序/寄存器成本；不能预先宣布更快，编译器也可能已做部分优化。

## 有限域与不能证明的部分

正常天气接口把cloudBase限制为100–4500m、层厚250–2200m、coverage为0–1、moisture约0.76–1.20；噪声/天气是归一化无符号字节纹理。对有限、无溢出的世界位置/时间/LOD/偏移，已进入云层的样本满足0<h<1。localHeight分母至少0.6，thermal垂直sigma至少0.15，log输入有0.0001下限；两个体密度以及base均有限非负。因此按原JS双精度运算，精确2时旧端点的非负零乘项不改变billow端点，本轮实际函数测试逐位一致。候选不承诺对任意直接写入uniform的NaN/Inf/溢出数据保持跳过项语义；0×Inf仍可能为NaN。

**不能据此证明所有GPU/驱动严格逐位相同。** GLSL ES3的浮点mix给出线性混合表达式，但不是布尔mix的直接分量选择；规范还允许乘加融合和部分重结合/精度变化。改动函数控制流后，即便fallback源码未改，编译器的寄存器和指令安排也可能变化。[GLSL ES3.00规范，§4.5.1、§5.11、§8.3](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)

CPU检查保留一个有限Float32运算次序示例：x=1、y=2^-25；按0×x+1×y得到y，而先舍入(y−x)再加x得到0。它只反驳“实数代数相等必然逐位相等”，**不是证据证明ANGLE实际把mix降低成该公式，也不是本候选已发生误差的报告**。没有用toy mix替换实际函数测试。

JS raw值恰为2与上传后GPU float恰为2还属于不同精度空间：`2-Number.EPSILON` 上传后已经是2。GPU非2控制应使用Float32可区分的 `1.9999998807907104`（nextDown2）或1.75。CPU保留原非2 fallback，实际GPU精确值资格由其float uniform决定；不宣称跨CPU/GPU所有近端点数值一致。

## 本轮证据

`r34-cloud-exact-two-check.json` **5/5**。完整LF/CRLF逆变换、原CPU与GLSL fallback及调用者源码保留；重复变换、共享算术漂移和损坏补丁拒绝。使用生产原始`cloudDensityAt`和`sampleTexture`函数源码、有限小型字节纹理，测试963组端点/近端点/中间blend/coverage/连续base案例；包括Float32可分辨的nextDown2。精确2为96组，其中36组非零、48组经历完整四采样、12组覆盖低层连续base条件。原始与候选的输出`Object.is`及所有采样参数/顺序相同。在三个有效精确2探针中，log调用3→0、exp调用6→3；这是CPU调用计数，不能当GPU性能测量。初始867组5/5记录另存 `baselines/r34-before-float32-fallback-control/`。

生产仍未修改。暂存文件保留原相对import，不能直接从verification目录当成生产模块加载。后续最小硬件资格应使用**完整实际共享密度函数**的有限、正且非空样本，覆盖精确2、连续base开关、接近2的fallback；严格数值差异应按预先声明的规则记录，不自动放宽容差，不直接推广。

候选API：`createCloudExactTwoCandidate(source)` / `restoreCloudExactTwoCandidate(source)`；transformer SHA `9953f20098f4b7fc6d901b6d0cb1a99a4d82abc2832eedbf0a99ab6cd5d1128d`。暂存整模块SHA `31751168eb41aa357bdff01e1695d4f685a088ad1950020b60d092dbeabea548`。
