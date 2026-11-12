# R13 石子入水后持续存在

运行时只修改 `stone-throw.js`。修正水面辅助捕获层后的冻结SHA256：`e318ba01e5ea2db6e17645cf6cc8b7401e4f5c4488303421c84f44b578e1cd9e`。之前动力学候选保存在 `r13-stone-before-water-layer.js`，SHA256为 `440c87b322154587b911e947e8312405b01de4a69e5ceabd4fe1a803f088877a`。原始基线 `r13-stone-baseline.js` 的SHA256是 `690799e55aeb52affd569731cf25c3691fb3022713f92d5d69db0a9aa4946027`。

## 实现与兼容

原 `STONE_GRAVITY=9.81`、空气阻力常数`.12`、蓄力5–22m/s、发射镜头/手部偏移、空气解析轨迹、兼容`launch`和导出的点碰撞函数逐字保留。实际水面事件再细化到物理根；入水时保留同一个Mesh和全部入射速度，不作凭空减速、放大或移除。

入水后变为固定240Hz、以入水时间为原点的独立动力学网格。完整tick才提交；分数tick只作显示查询，暂停/刷新次数不改变已提交状态。追帧会从实际入水时刻赶到当前时刻，同一石子只调用一次`onImpact`，海床碰撞不会再触发水花、音效或涟漪。海床接触点在固定tick内扫掠并细分求根；平地球心高度精确为`terrainHeight+radius`，斜坡用局部切平面球支撑。水下静止物和原陆地落石一起进入24个FIFO池；空中/下沉合计最多12个移动石子，共享一份geometry/material。水下90s是明确的资源寿命上限，不会假装提前到达海床；默认实际海床最低−32m，通常在其前落底。

现有 `.state` 保持原AIR-only数组和字段。新增 `.underwaterState`、`.restingState` 和 `.diagnostics()`；父代理可以在 `interactions()` 中暴露这三个值。所有新增状态数组都含真实米制位置/直径，未改变图像中的几何大小。材质仍为父场景注册的同一个MeshStandardMaterial，普通不透明深度写入。

父代理发现现有 `water.render` 辅助捕获只看layer1，而初版新石子只有默认layer0，因此不会被折射辅助缓冲捕获。已明确为每个Mesh添加 `.layers.enable(1)`，同时保留主视图layer0（mask3）；水下运动和静止沿用同一个Mesh，因此两层持续保留。CPU已补充空中、水下与静止物的层检查，实际GPU折射可见性仍由父代理验收；初版12/12 CPU不代表这项捕获已验证。

## 物理量与依据

默认直径0.025m，石密度2600kg/m³，体积`πd³/6`、迎风面积`πd²/4`，质量约0.0212712kg。水密度取1025kg/m³，Cd取0.47，均是明确的海水/球体代理参数，并非对这颗不规则石子的测量。

阻力采用 `F_drag=−0.5*rho_water*Cd*A*|v|v`，浮力采用排水重量，故

`dv/dt = [0,−g(1−rho_water/rho_stone),0] − k|v|v`，`k=0.5*rho_water*Cd*A/m`，单位1/m。

默认有效向下加速度5.942596m/s²，k约5.558654m⁻¹，竖直终端速度约1.033959m/s。求解采用重力半kick、精确二次阻力漂移、重力半kick；不是每帧乘一个阻尼系数。独立竖直闭式解验证5s位置误差0.135mm，步长减半误差比3.9998，符合二阶收敛。

公式依据：[NASA阻力方程](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)、[NASA阿基米德原理](https://www.grc.nasa.gov/www/k-12/WindTunnel/Activities/buoy_Archimedes.html)。[NOAA资料中的1025kg/m³海水参考密度](https://www.nodc.noaa.gov/OC5/wod-woa-faqs.html)仅用于这个简化常密度场。NASA也说明[球体Cd会随Re变化](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-of-a-sphere/)，所以0.47不能表述成所有真实石子的精确阻力系数。

没有求解部分浸没、入水空腔、波浪/海流平流、再次出水、碰撞反弹、海床颗粒滚动或完整刚体流固耦合。球的水中力从旧的球心穿越水面事件开始，保留交互时序；这是有边界的动力学近似。

## 验证与交接

`r13-stone-check.mjs/json` **12/12 CPU**：空气路径与旧发射状态精确相同、质量/终端速度/耗散、独立解析收敛、水下同Mesh保留、30/60/120/144Hz及单次4s追帧入水/落底/角度一致、浅水/陆地半径支撑、实际地形全部240顶点无穿入、40次投掷FIFO/共享资源、极端追帧与90s寿命、暂停/时间倒退/非有限输入。第一轮11/12只是检查器误把Euler数组最后的`XYZ`字符串当数值计算；已保留first-check源码/报告，只修正这项检查，没有放松容差或改运行时。

父代理还需实际GPU检查：同一米制石子在不透明层和折射输出中都存在；入水瞬间到海床静止连续；水面回调仍只一次。近看可选岛东侧浅水，实际深度以`terrainHeight`为准（x43,z7约0.2m），镜头距石子1–2m即可获得足够像素，不能用放大几何来代替折射验证。没有宣称画面/帧率/HDR或物理流体完全验收。
