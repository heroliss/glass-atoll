# R9白色尾珠串：独立有限高斯段对照

仅新增QA，无烟花/状态/曝光/ACES模块改动。参考 `gaussian-streak-oracle.py/.json`：Python libm erf，正权复合GL16，二倍细分收敛；轴向另有CDF原函数闭式交叉检查。约半秒离线计算，无GPU、canvas或设备。物理含义仅为均匀有限图像段与归一像素box Gaussian卷积；不是实际火星几何或新增物质/光源。

对象是interface报告的A候选：`targetStep=.5*max(1,sigma), x=max(7,L/targetStep), N0=floor(x)+1,N1=N0+1`，两个normalized midpoint average以quintic(fract(x))混合。保留sigma floor .28、原erfApprox和meanEmission；head原8时域点不在此候选范围。

## 结果与反例

10/10是参考积分/正权/局部截尾/连续性等数学协议门，不冒充GPU或照片验收。60组L0/4/17/30、sigma .28/.55/1/4/20、角0/22.5/45°及两pixel phase：GL16二倍细分最大差1.67e−16，轴闭式差1.11e−16。对实际17/30px和最低sigma .28，legacy8最大absolute kernel error .04930679，A为.000853852，降低98.27%。

端点仍能有1.4515%乘1/L的绝对误差；比如L30的某弱端点reference .00158818、A .00125045，相对误差约21%，不能用统一“低于1%逐像素”描述。该处绝对误差只为1/L峰尺度的1.013%。内部固定横向偏移的连续profile，legacy8数值起伏为reference均值的176%–347%，A为.0109%–.0236%。连续profile不是GPU raster/MSAA结果，但支持原珠串的采样根因。

shader erfApprox与libm erf分开：[-8,8]10001点的最大erf误差1.394e−7，本候选kernel仅由该近似造成的最大差1.836e−7；空间离散误差不能归咎于erf。103个供GPU复核的小fixture已将pixelOffset/motion/sigma显式round为Float32后重新生成reference和candidate预期，分别附exact-erf、shader-erf及局部window结果。

只测横竖会因方形pixel box的sinc零点偶然掩盖alias；斜22.5/45°与半像素phase必须保留。整数N处quintic双层选择连续；新增sigma .999↔1.001及非整数N阈值检查，max(1,sigma)处只保证C0，不声称所有case均C1。sigma缩放步长使宽PSF测试的局部预算有界。Float32裸quintic在f≈.9989可算出1.00000107，所以shader最后需要clamp到[0,1]来保持正权；沿视线projectedL≈0也必须safe axis。以上只是浮点协议建议，不冒充实际GPU读数。这不涵盖MAX_GLOBAL/MAX_LOCAL resource fallback回legacy8时的形态切换。

## 正通量、截尾、界

每层权重和1，mix非负且和1，因此无限平面flux为1，point值不超过未伸展pixel Gaussian峰，也不超过 `min(1,1/(2πsigma²))`。原CPU用baseSigma而实际sigma只增大，故此项仍保守。不能因此声称finite quad/raster/MSAA flux逐bit完全不变；原quad截边和投影/overlap-bin仍要实际验证。

局部window `boxAxisHalf + 6sigma + .02 + shutterProjection` 外的每个pixel-box概率至多Q(6)。保持原全局1/N、不局部重归一时，pixel绝对截尾误差≤9.866e−10，全平面质量损失≤2Q(6)=1.973e−9；此处观测max2.56e−11。这一界仅对精erf正权积分，排除Float32、erfApprox和quad裁边，不能拿它替代actual shader oracle。

## 最小实际验收建议

1. actual kernel readback先与相同N/mix/local窗的CPU shader-erf数值比，再独立报连续积分离散残差。可预先约定 `2e−6 + 5e−5*abs(expected)` 为normalized-kernel工程门，root未批准前仅是建议；不能直接拿连续积分当离散shader的逐bit预期。另验finite/nonnegative、原保守pointbound、normalized flux及source I/RGB/physics不变。
2. 0/22.5/45°、两个pixel phase、L17/30、sigma .28，端点与内部起伏分开。N阈值两侧应在同pose测差而非只测总flux；zero L必须归回原point kernel。whole-source fallback须明确统计，不能悄悄只算部分样本。
3. A/B主+mirror相同physical time/camera/C/native resolution/MSAA，无FSR或光强变化。先看断珠是否消失、端点亮度/长度是否稳定，再判断照片感；本数学结果不保证人眼验收。
4. 成本必须真实测主/镜面overdraw和local实际调用数，不能用N上限或isolated单sprite推整场FPS。实际17/30px、sigma .28下，局部window通常每层约9–11点、两层约18–22点，对比旧8；large-shutter3点还会乘3。建议先固定该近景+一帧最大多尾视角，记录有效query GPU median/P95、frame/CPU、candidate/fallback source数及max local count。若计时GL错误/disjoint则该轮不能当性能证据。本文件不设虚构毫秒保证、不要求再造积分模型。

## 首轮实际7/8的独立诊断（尚待varying读回封闭）

原报告 `r9-adaptive-and-radiance-gpu-first.json` 保留：103个kernel fixture里7个超原 `5e−5 + 5e−4*abs(expected)` 门，max7.3958e−5；flux/head8/pointbound/policy/GL/state另7门通过。本研究不改门或原golden。新 `adaptive-tail-raster-snap-study.py/.json` 只检验一个坐标来源假设：真实vertex把quad clip.xy变成屏幕坐标，raster再固定子像素网格量化顶点；smooth vOffset=position*extent的实际插值因而可能不同于helper要求的理想pixelOffset。

对所有103样本统一采用1/256px网格（无逐样本拟参），按量化quad两端重新计算vOffset再调用同CPU候选，max残差2.1495e−7、RMS4.4288e−8；4/6/10/12bit其它统一网格均明显不符。例p[-8,-3]、motion[15.70595,6.50562]：Ex≈9.524976量化至9.5234375，Ey≈4.924809量化至4.92578125，实际vOffset预测改变约[-.001292,+.000592]px。oracle梯度给出的负kernel变化与GPU−7.396e−5吻合。45°尾端量化向内则预测正变化，方向亦吻合。

这强烈支持fixture的理想输入与实际varying不同，而不是erf或归一积分本体错误；仍**不是新GPU证据**。必须由独立QA实际记录 `SUBPIXEL_BITS`、同pixel的vOffset/vMotion/vSigma/N，再以实际输入重算oracle并检查插桩未改变原beauty输出。原“requested offset”误差需保留，单独列几何漂移；不能用偷偷改golden或宽门来抹去首轮失败，也不能因此宣称所有硬件均使用8bit或全部闪烁已解决。

### 实际varying读回后的封闭

root随后保存 `r9-adaptive-tail-varying-probe.json`：4/4，103组原beauty与插桩stage0逐bit相同、GL空、最大offset漂移.0017004013px，**查询SUBPIXEL_BITS实际为4**。前述8bit网格仅是离线解释模型，不是该查询值，也不据此声称硬件实际精度为8bit。

独立 `adaptive-tail-interpolant-recheck.py/.json` 使用实际p/motion/sigma/N/blend及actual distance/omega归一重算：原固定门下103/103匹配，max residual5.2674e−8/max budget ratio.0009416。消融只换actual offset、其余仍理想输入，max residual4.2352e−8；反之只换actual sigma/motion/N而保留理想offset，仍误差7.3966e−5。amplitude修正最大仅2.7377e−8。由此将根因定位为实际插值坐标漂移；原requested-coordinate7失败及原7/8没有覆盖，连续积分相对离散近似的端点残差也仍保留。

对interface提供的f0c最小补丁只读审查：未扩展ndc产生flat projected sourcecentre，只有adaptive函数的along/q改为gl_FragCoord−centre；未改sigma、N、权重、quad、I或legacy/head/smoke。当前main/mirror full-target、origin0 viewport路径未见阻塞。该坐标协议不额外承诺任意非零局部viewport；新flat varying会影响driver链接/packing，故仍需真实旧baseline legacy/head byte回归和原103理想golden门实际再跑。postfix诊断须用probe v2的 `actual.physicalOffset`，不能误用其特意保留用于诊断的legacy `actual.pixelOffset`。
