# Resolved smoke light field：独立预审与QA协议

2026-10-27，研究/验证文件专属；本审查没有修改任何运行时模块，也没有操作浏览器。依据 `plans/SMOKE-RESOLVED-LIGHT-FIELD-CONTRACT.md`。实际GPU与视觉结果待根代理执行，本文不提前宣称通过。

## 上界成立，但必须以实际上传输入定义模型

令 `v=b+e>0`，b是上传packet的`traceΣ/3`，e是上传source的`radius²/5≥0`，`z²=d²/(2v)`。归一Gaussian平均核满足

```text
F0=(1/v)∫₀¹exp[−z²(1−u²)]du ≤1/v≤1/b
1−u²≥1−u
F0≤(1−exp(−z²))/(v z²)≤2/d²
```

所以每正RGB源组以源AABB到packet mean的最近距离dmin作

`sumRawRGB * min(1/b,2/dmin²)`

是有效标量包络；dmin=0取1/b。再乘`(1+3|g|)/(4π)`，对组求和、对packet/channel取最大即可，不乘packet数。F1向量界来自积分三角不等式`|F1|≤F0`，不是把signed C1系数逐项当作非负颜色。

实际Float32输入是模型的定义：CPU原double mean/variance、原double源位置不可以偷偷替代已经四舍五入上传的值。group metadata必须覆盖全部上传行，RGB和/AABB从这些行得出。组索引、count、布局与buffer version也要一致。

独立 `pyro-smoke-group-upper-check.mjs/.json` 目前 **7/7 CPU**：标量含d=0/两界交点/远场/不同e；四组几何反例；同一真实Taylor60×120重新Float32 pack。实际数值SH角最大`.0004424984`，未加误差margin的组包络最大`.3626095`（明显偏松，安全不等于紧）；每包/通道真SH除以相应包界最大`.34043`。偏绿根烟团仍45/48。

另只读交叉执行已冻结的 `pyro-smoke-light-bound.js`（SHA256 `63685694e78e6d5ed223ffdabd777288615153851abf08342d489048a356bca4`）：实际同上传输入得到`.363339376065748`，除以独立理想界的比值`1.0020128407525235`，与其声明总margin`1.0020128407525104`差约`1.31e−14`。这核对了CPU实现与独立公式，仍不把声明的shader误差预算当成GPU证据。

`pyro-smoke-light-field-oracle.js` 是浏览器pure QA，只用独立正Laplace积分求原三维Gaussian核，不导入生产Dawson/erf/field函数。在b与d宽范围上，与先前23项原型特殊函数比对，F0最大相对差约`1.22e−13`、F1绝对差除以F0约`3.72e−14`；这是独立oracle自检，不是GPU通过。

## 必须守住的具体接线点

1. **稳定行号**：已有volume渲染会随camera深度sort并cull后重排instance。烘焙field按snapshot顺序，不能用绘制`gl_InstanceID`直接读。每个packet要携带原始fieldIndex并在重排后写进instance属性。主/镜像不同排序、剔除第一个packet的夹具是必须的；全同色测试捕不到此错。
2. **源版本和借用buffer**：缓存键需包括实际source generation/raw scale以及density布局版本；只time、count、对象引用都不足。`getEmissionLedger`输出buffer可复用，但生成下一版本后旧内容失效；prepare上传须同步，不能异步借用等待下一frame后再读。相机和P改变则不得使raw field改变/重新计量。
3. **完整替代而非重复**：只替换烟体pyro local slots4/5；保留0..3、ambient、directional与既有front-air。原source、云、水、GI不改。field系数不乘packet mass；只在最终RGB输出乘该frame P一次。raw field也不做view transmittance预过滤。
4. **模型卷积**：输入第4个source float已经是e=R²/5，不可再次平方/除5。Gaussian发光体只匹配均匀体球二阶矩，中心/表面形状仍近似；没有source→smoke T/自遮挡，不能将它写成完整RTE。
5. **原始RGBA32F有限域**：即使最终sceneP能降低，raw系数在乘P前若已经溢出也无法挽救。b必须正且在GPU有效数域，正源RGB/坐标/variance须可表示；CPU预算先拒绝非有限/过大域，不做末端clamp。
6. **far/tiny数值顺序**：合法远场可能让`d²/(2v)`变Inf；若已进入far分支就不要再算`z*exp(−z²)`，否则Inf*0为NaN。F1应以`(delta*inversesqrt(d²))*(enclosed/d²)`计算，避免`d²*sqrt(d²)`先溢出。近z=0需正小z系列、中心F1=0。
7. **Float32 margin**：正加和γ_N与有限每项算术误差应显式记录；N=14000时γ_N约`.000835`。还要覆盖实际特殊函数误差，不能把声明的`.002`直接当已验证值。C1允许signed数据，最终角场`C0−|C1|`必须非负。无source/clear/disable必须立即无贡献，不能沿用旧烘焙系数。
8. **不完整工作不是有效光场**：14000×4096的理论容量不能直接无界dispatch。显式pair cap/unsupported与逐级实测必需；GPU已经提交的工作不能等计时超过50ms后取消。QA只在有效计时和预测余量下升级，不发布部分源/部分packet的静默截断场。

## 实际GPU helper（待执行）

```js
runResolvedSmokeFieldGPUCheck(THREE,renderer,{
  createField:createPyroSmokeLightField,
  createVolume:createPyroSmokeRenderer,
  measurePerformance:true
})
```

实现于 `pyro-smoke-resolved-field-gpu-check.js`。caller先暂停并独占renderer，不新建browser。它读取3个真正RGBA32F附件时先复制到独立owned target，避免附件feedback。expected来自上传Float32数据的独立Laplace oracle。夹具包括中心、小z、`.2/2/4/8`分支两侧、z=1024、有限e、两组、同buffer新version换色、密度行交换、M×100、零源/disable恢复。

volume部分使用真实生产工厂，验证正常排序、镜像逆序、首packet被cull、世界rd、P0/P3与旧分支逐位恢复。raw C1是有符号元数据；不把负C1分量误判成负辐亮度。最终renderer逻辑/实际viewport、scissor、READ/DRAW framebuffer、target/face/mip、clear、shadow、tone/output和debug状态都恢复。GPU特殊函数验收阈值沿合同`.002`；零输出另有非零sentinel/编译诊断，不能把program失败的黑RT当数学结果。

性能只量isolated bake，输入上传/首次程序准备记录为与warm场不同的范围，不推断全岛FPS。60×120起，随后有界升级；没有有效计时就不做大压力。每轮若已>50ms停止，预测下一轮>40ms则提前停止。实际画面仍须在同一物理事件/M/Σ/I/C下旧簇与新field A/B；新场可能只是把金色棉球变成绿色棉球，不能靠技术门替代视觉验收。
