# 棕榈与云形方案：有界反驳与首轮A/B边界

2026-10-27，独立只读审查。已读`PALM-CLOUD-VISUAL-NEXT.md`及当前`vegetation.js`、`sky.js`、`weather.js`，实际查看`verification/day-review-current.png`、`assets/reference-palms.jpg`、NASA贸易风积云参考像素。没有修改运行时或控制浏览器；音频4e5ede41保持冻结，用户已接受第三次A/B的主爆冲击感，该接受不扩展为音色/设备/SPL全面验收。

## 结论先界定

两个方案都有值得测试的源码事实，但都还不能写成“已经解释整幅图”。棕榈的局部方向确有world-Y截面重建，然而roll仍部分进入长轴和横轴，不能称所有扭转完全丢失；即使厘米宽度正确，在当前远景仍可不足一像素。云默认C2确实没用weather.g高度信息，但三维billow/region仍会造成个体顶高差异，共同包络不等于每个顶面都平。真实共同LCL和平宽humilis也不能作为算法错误。

实拍参照的椰叶是近景，当前图是整岛远景；不能拿两图叶片像素宽直接比较。当前图中冠内碎网/下垂细丝与云团横向重复可见，仍需覆盖诊断和密度切片分离几何、分辨率与照明因素。

## 1. 棕榈：把“恢复frame”和“额外90°扭转”分开

`vegetation.js:408–412`先以局部lateral/tangent构造direction，再用`direction×worldY`构造横轴，叠加`roll*.42`与小相位。这个做法会将许多横截面重新朝向世界上方，低视角容易只见窄投影；它是合理的嫌疑，但长轴已包含部分roll，所以并非一行代码把整个局部frame都抹掉。

独立重开[Kew的Cocos nucifera条目](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:666160-1/general-information)，2024《Palms of New Guinea》确实记载**叶轴远端半段约90°扭转**。它支持存在连续结构扭转，不能推成每枚小叶都独立加90°，也不能证明眼前发丝主要由此造成。更不是增加实体宽度的依据。

**首轮只做A/B0：** A为当前；B0仅将截面side/normal由连续运输的frond frame构造，保留旧roll幅度，不同时新增60–90°远端扭转。额外植物志扭转留作B1，独立于B0。否则改善后无法判断来自frame一致性还是人为大角度增加主镜头投影面积。

### 必须先解决的隔离陷阱

- **中心线耦合：** `blade():126`的midrib center不仅由forward/droop决定，还含`side*sin(πt)*curl`。直接替换side会移动中心线。按root的“centers unchanged”，应冻结原direction、root及旧curl轴生成的整条`M(t)`，另用新sectionSide铺宽度与ridge，不能只检查root没动。
- **ridge朝向：** `blade():116–118`的`cross(side,forward)`随后被`up.y<0`强制翻到世界上半球。新frame接近/跨过90°时，这会翻折几毫米的ridge，而非持续的局部向上面。应为pinna单独保持一致的局部adaxial normal；不顺手改变灌木blade。先unlit确认覆盖，再正常材料，避免把ridge/SSS亮度变化当叶片变宽。
- **RNG锁定：** 新增一次range/random会改变后续所有叶的长度、缺口、色素和树冠。B0须不消费新随机数，或复用同一已生成参数表；应核对root/中心线/宽度/叶数/UV/颜色散列保持，只有截面朝向不同。
- **frame数值：** transported lateral须投影到rachis切线的正交平面并归一，避免当前lateral并不严格垂直tangent的分量被带入；近共线要有确定fallback并保持相邻符号。不要突然切换world-up轴形成翻面。

### 不可省略的渲染风险

`meshFrom()`现有Float32面积剔除、normal/tangent重算和正交化必须保留，不能简单旋转position后沿用旧TBN。UV保持沿叶长/叶宽，tangent.w随新几何正确生成；叶脉、normal map及厚度仍同一UV。曾经零面积叶尖/零法线导致反射NaN，本轮不能回退此修复，也不能靠末端颜色clamp掩盖。

`vGroveNormal`同时影响薄层吸收路径、前后半球透射和局部光响应，截面转动会真实改变高光与SSS；因此相同材料不等于相同亮度。现有`groveDeformAt`虽同步旋转N/T，但flutter轴仍以`leafForward×worldY`构造；B0不能声称已完成全局部frame风力学。先保持现风协议，在wind0证明静态frame有效，再用同wind5时间序列检查有没有新的纸片翻转。

切换候选几何要reset主/水TAA与运动历史，主色、reflection、depth/shadow、GI surfel若引用旧几何也须同步重建或刷新；否则残影/旧间接光会污染A/B。CPU初始化运输不增三角形/draw/纹理指令，但投影面积和遮挡改变会影响实际着色成本，不能仅据源码承诺GPU成本不变。

### 最小可证伪验收

先选一个中龄单羽叶与同一树冠，锁midrib/尺寸/数/材料/种子/相机距离/时间。wind0+常色unlit，低/中/俯视及四方位查看覆盖和三角形面积加权`|N·V|`；随后正常材料与同物理wind序列。需要确认羽叶面变得连贯而非只对主机位加厚，也不要求每一个方位覆盖都同时增加——旋转真实表面本来会重新分配投影。若unlit覆盖几乎不变而只是更亮，应否定“frame解释发丝”的主要因果；若某向改善但其它向翻纸/成密网，也拒绝该候选。

## 2. 云：信息丢失成立，但直接高度缩放会制造新顶盖

`sky.js:100`的localHeight使用weather.g；默认C2的`:128–135`却只用全局h构造heightPenalty。这确实丢弃了原本的每热团高度字段，但并不证明它是当前横条的唯一或主要原因。世界尺度250m水平/115m垂直可由Worley8映射计算得出，约2.17:1；这只是基础噪声单元尺度，真实field还叠有其它频率、warp、region和Beer沿程积分，不能把每块云都称为一个固定椭球。

### 对h/scale的明确反例

当前`P(h)=.75h²+.65h⁴`，在h=1时为1.4；在所有输入取各自合法上限的松界下，mass其它正项总和最多1.29，entrainment非负。因此原C2在全局top前已经自然归零。若简单改成`P(h/1.2)`，h=1时只剩约.834，已不能证明密度在globaltop为零；足够强的puff可能仍有正密度，随后被`altitude>=uCloudTop`突然切掉，反而重新产生全局平顶。这里是合法范围反例/安全证明失效，未冒称已在当前实际纹理中复现新的剪切像素。

若切片确实支持加入高度差，首B宜只采用**固定端点的单调warp**，例如`hEff=h+a*h*(1-h)`且`|a|<=.4`：0和1端点不动，导数至少.6；全局LCL/top支撑和原top归零上界仍保留。已有weather.g可驱动a，但“a均值为零”不等于云水量或光学厚度积分不变，尤其g与weather.r相关；必须另报density/opacity均值，避免只变稀薄就看起来不盒形。该warp仍是受限造型近似，不是浮力/湿度动力求解。

### 修改前先取三平面证据

固定seed、天气纹理、offset/shear/time及同一可见云的世界位置，取XY/YZ/XZ切片与多个等密度轮廓，包含实际渲染阈值.0008附近及更高阈值；再由三个方位看同一云，区分共同LCL、实际顶高、噪声轴向面与低对比照明。不能用随机晴区或另一朵云作对照。若只有真实平底而上缘并不呈共同矩形，应拒绝“去平底”目标。

首轮保持coverage/extinction/LCL/globaltop/颜色/光照/steps不变；默认稀云和RH.95/coverage.9/厚1800m均检查。如果C2高度差有效，再另测puff垂直尺度，不能同一B同时改height与115→200m。改尺度应只改对应puff空间坐标，不顺手缩放时间相位、RGB shape/detail或全部uvw；相应LOD足迹也要检查。

任何新density要同步CPU probe、GLSL view/cube及cloud shadow。只要横向weather.r支持与全局层界没变，现max-support理论仍可保守，但仍要跑parity/support和边界扫描，不能凭此删验证。源码每次density查询不增纹理数，也不代表帧成本必然相同：更多正密度可能触发更多3步自阴影查询，更多opacity又可能更早终止march，实际GPU成本须同云/同窗量。

## 本轮结案边界

root先只做palm B0的隔离A/B；云先收集三平面density证据，未验证前不改density。保留现有已验收版本、source/hash和截图。若证据不支持，明确否定假设，不通过同时加宽叶、增密、增亮、加steps或改云底把结果“修漂亮”。本审查只更新研究/QA文档，没有运行时变更。
