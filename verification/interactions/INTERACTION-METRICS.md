# 投石水花与漂浮叶：米制、可见性与边界

2026-10-26。本轮只改 `floating-leaves.js`，新增 `splash.js` 与本目录验证材料；主程序、UI、水面、镜头由主代理集成。此记录的 headless 检查不冒充实际 GPU 编译或最终近景视觉验收。

## 已找到的问题

- 旧水花使用 `PointsMaterial({size:.055})`，每个方形点的世界尺寸为 **5.5 cm**，接近一片叶宽；近看自然会像粗大颗粒。旧点下落后还被 `Math.max(.015,...)` 留在海面上，直到统一淡出。
- 旧叶片网格实际长 **66 cm**、宽 **27 cm**，并非此前口头描述的小叶。按钮只接受第一个湿面命中点，允许距相机 **140 m**，因而“出生成功”不等于用户能发现。
- 旧叶片有共享 GPU 波高，但局部几何和位移合计约 **3–5 cm** 抬升，并未随波面更新照明法线。没有证据证明它一直被不透明水面埋住；本轮消除悬浮高度，并保留真实深度遮挡。

## 当前实际尺寸与实现

| 对象 | 米制设定 | 表现 |
| --- | --- | --- |
| 漂浮叶 | **0.22 × 0.082 m**；约毫米级弯曲 | 尺寸固定，mesh scale=1；暖橄榄色、细叶脉、轻微枯边 |
| 叶片水面间隙 | 共享 GPU surface + **0.004 m**，再叠加 1.5–3.3 mm 叶面起伏 | 受水面深度遮挡，不用 depthTest=false 或始终置顶作弊 |
| 默认投石对应尺寸 | 直径 **0.025 m** | 视觉参数；没有假称求解石子的质量、冲量或实际入水轨迹 |
| 主要水滴 | 直径 **0.4–2.4 mm**，少量 **2.4–4 mm** | 96 个实例化圆形球面 impostor，太阳高光、环境反射/近似折射、IOR 1.333 |
| 薄水冠 | 最大半径约 **0.10 m**，设定上限高度 **0.082 m**，存在 **0.34 s** | 共用 GPU 波面，薄透明水片、细波动冠沿；不是厚白管 |
| 水滴运动 | 重力 **9.81 m/s²**，默认最长约 **0.445 s** | 弹道下降后由真实水面深度隐藏，不钉在海面形成漂浮颗粒 |

水滴没有使用 Points/PointsMaterial；片元中用圆形 coverage 和球面法线剔除方角。低于像素的水滴只扩展最小光栅支持域，**alpha 按真实投影面积比例衰减**，不会远处变成不透明大水珠。远处毫米滴合理地难以看清，短暂薄水冠和真正的水面涟漪承担可见反馈。至多 4 组水花，每组结束后释放事件几何与材质，避免反复点击累积成本。

叶、叶的阴影深度材质、水冠完整共享 `water.uniforms`，并设置 `BAKED_WAVE_TEXTURES:1`，使用四层谱纹理与 SWE/Ripples，避免意外回到逐顶点 256 分量解析支路。叶照明法线也随共享波面梯度倾斜。`renderOrder:3` 只规定绘制次序，深度检测仍开启。

## 集成 API

```js
import {createSplash} from './splash.js';
const splashes=createSplash(THREE,{
  scene,uniforms:water.uniforms,sunDirection,
  // sampleSurfaceHeight:(x,z,time)=>CPU估算，可选
});

// 保留主程序已有的 water.impulse、hydrodynamics.disturb、soundscape.splash。
// 本模块不重复它们。删除旧 Points 创建和旧 splashEvents 更新。
splashes.spawn(x,z,time,1,{stoneDiameter:.025});
splashes.update(delta,time,camera,lens.state.height);
// 第4参数是实际 scene RT 的像素高度，供亚像素覆盖率计算。
// time 不前进时水花冻结。结束可 clear()/dispose()；state 提供实际滴径。
```

叶原有 `spawn(x,z)->boolean`、`update(dt,time)`、`material`、`state`、`dispose()` 保持兼容，新增：

- `suggestSpawn(camera,{viewportHeight,minimumPixels=12,maxDistance=140})`：检查 42 个屏幕候选，拒绝干地、超远点和被地形挡住的射线，再挑最近可见湿面。返回 `x/z/depth/distance/projectedPixels/ndc/focusRecommended/focus`，没有候选时返回 null。
- `spawnVisible(camera,options)`：使用上述候选出生一片叶，返回候选及 id；失败返回 null。
- `locate(camera,{viewportWidth,viewportHeight,id})`：默认最新一片叶，返回 `screen/ndc/visible/world/distance/projectedPixels/focus`。适合仅在出生后短时间显示小定位圈，以及由用户触发或主程序安排“靠近叶片”。定位圈属于界面反馈，不能画成海面上的真实物体。
- `focus:{position,target}`：建议相机距叶水平 3.4 m、高 1.65 m，并检查地形遮挡和相机地面间隙；它只给位置，**不擅自移动用户相机**。

定位 `world.y` 是 CPU 波谱估计，`heightEstimateOnly:true`；真正网格取 GPU 四谱+SWE，不读回 GPU 水平扰动。屏幕定位应允许几像素误差；出生后观察和追踪提示由主代理集成。

## 实际检查结果

运行 `node verification/interactions/metric-check.mjs`，结果 [metric-check.json](metric-check.json)：**14/14 通过**。

实际默认视角的最近清晰湿面约距 **25.30 m**，22 cm 叶只占约 **8.35 px**，所以正确返回 `focusRecommended:true`；靠近建议视角约 **55.93 px**，模型始终未放大。几何边界实测 **0.219999999 × 0.082000002 m**，垂直起伏范围约 **1.82 mm**。默认第一组水滴实际直径范围 **0.402–3.705 mm**。

还检查了干地/非有限点拒绝、屏幕内可定位、完整谱纹理共享、真实深度与法线、暂停冻结、4 事件上限、结束及 dispose 清理；恒定流 `(0.12,−0.04) m/s`、无风，30 秒叶锚点位移为 **(3.6,−1.2) m**。这是明确输入下的输运检查，不能替代真实波场画面的 GPU 测试。Canvas 贴图在该 Node 检查中使用 stub，不包含对贴图外观的视觉判定。

## 原始参考与物理边界

参考在 2026-10-26 查阅：

- NASA GPM：[How big can a raindrop get?](https://gpm.nasa.gov/resources/faq/how-big-can-raindrop-get)。支持一般自由水滴应按毫米理解，而不是把 5.5 cm 点当细滴。**雨滴并非小石入水的滴径分布，不能直接拿该来源宣称本模型有实验标定的水花分布。**本模块的 0.4–4 mm 是相对于 25 mm 小石的有界视觉设定。
- APS Gallery of Fluid Motion：[Anatomy of a Crown Splash](https://gfm.aps.org/meetings/dfd-2023/64ff2e12199e4c1bbe72580c)，[DOI](https://doi.org/10.1103/APS.DFD.2023.GFM.P0015)。已实际查看并留存 [研究缩略图](crown-splash-aps-reference.png)，用于辨认薄冠、细丝与离散滴的形态。**这张海报是研究可视化，不能冒称真实照片，也没有用于运行材质。**
  作者 C. R. Constante-Amores、L. Kahouadji、S. Shin、J. Chergui、D. Juric、J. R. Castrejón-Pita、O. K. Matar、A. A. Castrejón-Pita；海报按 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 发布。这里的缩略图仅作署名研究参考，不归入本项目运行素材的 CC0 声明；商业分发时应移除此参考副本或另行确认许可。
- Deegan、Brunet、Eggers 的原始研究 [Complexities of splashing](https://doi.org/10.1088/0951-7715/21/1/c01)，及 Deegan 的 [Wavelength selection in the crown splash](https://doi.org/10.1063/1.3526743)，作为水冠/冠沿不稳定性的研究入口；本轮只核对了出版元数据，没有将未读全文当作数值标定证据。

当前水花是重力弹道、透明球面近似和参数化薄片；没有空气阻力、合并/破碎、完整自由表面拓扑、体积/动量守恒或 Navier–Stokes 求解。滴的初始高度可传 `surfaceHeight` 或 `sampleSurfaceHeight`；缺省为 CPU 波谱估计，不含 GPU SWE 的逐点读回，不能称其与 GPU 瞬时入水高度完全一致。水冠自身取共享 GPU surface。小滴的折射取环境方向近似，不是逐滴对背景做精确光线追踪。

叶继续采用平均流 RK2 输运 + 近似 Stokes 漂移 + 零均值轨道摆动，真正竖直姿态取共享 GPU 波面；它不是刚体水动力，也没有读取 GPU 瞬态水平速度 u′。看到叶片和保持真实尺寸由择点、定位、靠近观察共同解决，不以放大物体或关闭遮挡取巧。
