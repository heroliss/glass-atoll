# 下一轮真实感研究：只优先验证两件事

2026-10-27，只读研究；本轮没有改运行时、目录或已验收的centroid/运动协议，没有控制浏览器。实际查看了`day-review-current.png`，并重看现有`assets/reference-palms.jpg`、`reference-sandbank.jpg`、`reference-aerial.jpg`和`verification/weather-reference/nasa-trade-cumulus.jpg`、`nasa-humid-cumulus.jpg`。Unsplash照片的作者/许可在`assets/SOURCES.md`；NASA S'COOL照片仅作已有研究参照，摄影者的原署名保留，不能由NASA托管推成CC0。

当前图仍有两个显眼差距：树冠是细丝加内侧碎网，云团在远景像近似同厚的层条。本轮只列有代码证据、可证伪的优先假设；照片没有相同焦距/风/品种的实测标定，所以不凭一张照片断言所有尺寸都错。

## 1. 先修羽叶的局部截面朝向，先不加粗/加叶数

**最高价值假设：世界向上的截面重建削弱了真正的羽叶扭转。** `vegetation.js:408–412`先用localLateral/rachis tangent生成叶片方向，但随后用`direction × (0,1,0)`重新生成叶片横轴，外加只有`roll*.42`等小扭转。于是叶片的长轴有局部变化，横截面却重新依赖世界Y；它不是沿弯曲叶轴平行移动的完整局部frame。`:116–118`的blade函数又以世界Y选择ridge朝向。低机位下，许多叶面趋于屋顶朝向，能看到的投影面积很小，形成发丝；这是明确的构造方式，是否为视觉主因仍要A/B验证。

本轮重新打开[Kew植物志汇编](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:666160-1/general-information)：2024《Palms of New Guinea》条目记载叶轴远端半部约90°扭转，叶长可达6 m、90–120片小叶/侧，中部小叶约100×2–5 cm。该页另有植物志记4–5 m/100×2 cm，不能混成唯一统一标尺。[NParks](https://www.nparks.gov.sg/florafaunaweb/flora/5/6/5618)记80–100对小叶、宽1.5–5 cm、长50–150 cm和约6 m冠幅。现代码80–85对、宽约2.6–5.0 cm并没有少一个数量级；当前叶轴弧长中位5.63 m、范围4.22–7.20 m的既有审计也提示上缘偏大，而不是叶片必须再加宽。90°是对应植物志的形态描述，不应强制每枚程序羽叶精确相同。

**首轮拆成A/B0，先不新增90°扭转：** A为当前frame；B0只把width/ridge截面改为由rachis切线及运输的frond normal构造，投影到**现有小叶direction的正交平面**，保持旧roll幅度和随机样本。小叶root、direction、长度、下垂及整条midrib中心线完全不变。只作用于成熟羽叶上的coconut pinnae，不顺带改中央枪叶、叶鞘和灌木。尺寸、数量、纹理、材料、太阳、相机、风时间和MSAA均锁定。不要同时缩短叶轴或改变粗糙度。

只有B0有独立支持，才另开B1：在同一固定中心线的截面上增加连续远端roll，候选幅度约60–90°，不和B0混在一次对照。**B0/B1都是叶面可见性诊断，不是完整植物学重建**：真实rachis扭转也会改变小叶着生方向，后续若要改direction/centerline，应另立版本与验收，不能凭截面诊断就宣称实现真实90°羽叶。

**一个必须先拆开的源码耦合：** `blade()`的`side`既用于宽度，也在`center = root + forward*length*t + side*sin(pi*t)*curl`中控制中心线；直接换side会违反“只改截面”。未来实现须保留旧curlAxis和原始中心线`C(t)`，固定旧实际midrib `M(t)=C(t)+oldUp*ridge*shape(t)`。中心顶点保持M，左右边缘围绕M使用新widthAxis和ridgeAxis；原边缘相对midrib的fold高度是`-1.68*ridge*shape`，加原flare。A分支仍直接运行旧构造，保证基线可逐字节对照，而不是用代数重排假称相同。

**可证伪验收：** 在同一树冠，以低/中/俯视及四个方位拍相同像素大小的全冠和单羽叶；先wind=0，用现有unlit诊断分离几何覆盖，再看正常材料及同物理时间序列。记录实际三角形面积加权`|N·V|`分布及不透明覆盖，检查低视角能否形成有可读宽度的羽叶条带、减少细网，同时俯视不过密、旋转不翻成纸片。若只有一个角度变厚，或仅靠增加投影面积掩盖轮廓，拒绝B。不能把实拍近景的大叶片像素宽直接当远处全冠的目标。

例如仅作为投影数量级估算，1292像素高、28 mm、36 mm高传感面、距离45–70 m时，2–5 cm宽的叶片正面也只有约.29–1.12像素；叶面倾斜会再降低投影面积。这解释为什么正常厘米尺度也会成为发丝，但不代替实际frame测量。不能设“至少1像素宽”把远叶实体加粗。

**成本边界：** 不增加三角形、draw call或纹理采样；局部frame/tangent/normal在初始化生成即可。运行期GPU理论结构不变，但更多可见面可能增加真实overdraw，仍需同窗GPU计时。必须重跑centroid负色、TBN/NaN、风端点/运动/深度和阴影回归；保留之前6/4/5→0负色修复。

**frame与缓存风险约束：** 沿叶轴用最小旋转运输normal，投影后若接近平行/长度趋零，用前一有效frame或旧frame回退；符号按邻接frame连续，不能再用`up.y<0`强制世界朝上造成fold翻面。重算几何normal、显式UV tangent和handedness，禁止零面积面重新因风展开。midrib位置及其wind属性相同，故其风动轨迹也必须相同；tip/root重合与edge flutter消失约束保留。SSS随真实几何normal改变是预期的角度响应，必须与unlit覆盖分开判读。若QA切换了几何，旧previous-rest-pose不再有效，须重置temporal history，更新包围盒/影图；完整受光对照还须为各几何重建GI源，首轮几何诊断可GI off，不能让旧GI缓存偷偷成为B的光照输入。

## 2. 云要查生长包络与物理尺度，不能把平底当bug

**优先假设：活跃billow分支丢弃每热团高度差，又叠加统一的偏扁3-D尺度。** `sky.js:263,281–282`为各热团生成并保存在weather.g的高度；`:100`构造含它的localHeight，但默认`uCloudShapeBlend=2`的billowBody在`:128–135`只用同一个`h`的heightPenalty，未把该高度差用于最终生长。所有云团共享相近的垂直衰减包络，噪声虽然有凸瓣，群体顶部/厚度仍容易趋同。这是源码中的具体信息丢失，不是“细节太少”的泛评。

其次，`:90,125–127`将相同Worley8场映射成约250 m水平、115 m垂直的基本单元（5200/(2.6×8)、2400/(2.6×8)），所有puff都约2.17:1偏扁。LOD1.2时每基本单元只剩约3.5个滤后纹理采样间隔，轮廓会更圆钝/分片。这是可计算的结构因素，但目前没有证据证明单纯加纹理分辨率或加steps就会改善图像；若按相同物理footprint正确提高LOD，增加纹理分辨率未必增加远景信息。

[NASA对印度洋晴天积云的说明](https://science.nasa.gov/earth/earth-observatory/fair-weather-clouds-sri-lanka-81833/)明确支持平底、圆顶、通常低于约3 km，而且humilis本来就常宽于高。现默认LCL约813 m、层厚950 m在合理数量级。现有真实沙洲照片也能见到共同基底，NASA贸易风照片甚至有很扁的云。**本轮不建议随机抖动云底、把所有云变成高塔，或凭平底直接宣称算法失败。**

**建议先做密度诊断，再只改一项：** 固定同一天气纹理/seed/time，给同一组云拍3个方位，并输出横纵密度切片/等密度轮廓，以区分真实共同LCL、反演顶界、笛卡尔纹理面及低对比照明。若只有共同底部平而顶部实际不矩形，不以“去平底”为目标。只有云群高度重复被确认，才试下面保端点的生长warp；不要同时改coverage、extinction、初始天气位置和颜色。若高度差不能改善个体侧轮廓，拒绝该B；之后才独立测试puff垂直尺度115→约180–230 m，仍允许水平大于垂直，不能把两种变化混在一次A/B里。

**独立反驳已否决直接height scale。** 当前billow2其余项最大为1.29，`heightPenalty(1)=.75+.65=1.4`，所以现密度在全局top之前自然归零。若把h直接除以1.2，在global top有效h=.8333，penalty仅约.8343，最强puff仍可有正密度，随后被`altitude>=uCloudTop`硬切为0，反而制造新平顶。因此撤回最初“直接±15–20%高度尺度”的宽泛表述。

首个B候选限定为`hEff = h + a*h*(1-h)`、`|a|<=.4`，仅用于billow的heightPenalty；h仍是原物理高度，LCL、world坐标、噪声、风切变和全局top支撑不变。它在0/1保持原端点，导数`1+a*(1-2h)>=.6`，不会折返；h=1仍有原1.4惩罚。a可由已有weather.g确定连续差异，gain=0须还原A，不引入新随机场。范围给的是候选上限，不声称是实测云动力学；最大内部坐标位移为.1层厚，默认950 m约95 m。**a均值为零也不等于积分密度或光学厚度不变**，须另报告密度体积分、视线光学厚度及不透明度统计，不能用调extinction/曝光偷偷抵消。若选择top-fade替代法，须另证明连续支撑/积分影响，不和此warp混在首B里。

**可证伪验收与成本：** 默认稀云和真实占云的RH .95/coverage .9/厚1800 m分别锁定UTC、太阳、视角/RT和物理时间，比较顶部高度分布、长直边/直角是否随世界轴对齐、侧轮廓是否圆钝但不矩形。任何新密度必须同步CPU probe、GLSL view、cube及ground shadow，并重跑parity/support，不能仅改背景。上述生长尺度或坐标A/B均为0新增纹理读取、0新增steps/RT；不靠翻倍march预算。定量性能仍由实际GPU同窗比较，不能用看向晴区的高FPS代替浓云成本。

这两项是有边界的未来试验，不是保证能达到照片级真实的承诺。第一项优先于新叶纹理/新模型，第二项优先于再次提高云采样数；若A/B不支持假设，应保留当前已验收版本，而不是顺带改更多参数。

## 最终未来实施契约（当前尚未实现）

1. **默认和回退：** 两个实验彼此独立，A永远是当前已验收源与资产hash。首轮只允许palm B0，或在切片支持后单独cloud warp；不同时改二者。QA配置应在构造时固定，或切换时明确废弃对应缓存，不能静默热换数据。
2. **palm不变量：** 不新增随机调用；根、direction、原curl中心线、实际midrib位置、尺寸、UV、颜色、index拓扑和全部wind/motion属性保持。A字节一致；B的midrib/端点轨迹逐顶点比较。仅边缘截面位置和由此重算的normal/tangent可变。退化投影/零面积/非有限的case明确回退或拒绝，不靠归一化零向量/最终颜色clamp。
3. **palm光照与历史：** 维持两面材料、centroid vColor、TBN随风同旋转、SSS实际normal、visible/depth同一变形；更改rest geometry时history reset。影图、包围盒及GI几何源与候选一致；静止unlit覆盖、正常受光和动态序列分别验证，不用整体变亮冒称叶形改善。
4. **cloud不变量：** 同纹理、同seed、同base/top、同weather支持、同warp参数同时进入CPU/GLSL/ground shadow/cube snapshot；不改march步数、噪声尺度、密度gain或extinction。top附近连续零支撑、单调warp、baseLOD parity、support不误拒绝、默认及实际浓云GPU图均需过；积分密度/opacity改变必须如实报告。
5. **放行：** 先单因子静态A/B，再同相位风/云演化、镜像、负色/NaN与运动回归，最后同条件GPU窗口（包括影图/cube/PMREM更新）。不新增GPU结构不代表免费；若增加可见叶面积/云占据导致overdraw或march占用超预算，应拒绝或明确质量成本，不将FPS下降藏在自动降分辨率后。未达视觉收益或出现任一真实数值回归，恢复A，不再顺带改其它参数。
