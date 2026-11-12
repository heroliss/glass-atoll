# 椰树、叶片与珊瑚沙的真实参照

检索与实际查看：2026-10-26。本目录用于研究和画面对照，未自动替换运行场景的模型或材质。

## 已检查但不建议采用的树模型

**Innerscene — Palm, detailed**，原作者在自己的发布页明确 CC0；无登录直接下载。

- 原始发布页：https://www.innerscene.com/tools/library/3d-parts/palm-detailed-a8777b8c
- 原作者 CC0 条款：https://www.innerscene.com/tools/library/terms
- 模型：`innerscene-palm-detailed.glb`
- 官方下载：https://www.innerscene.com/api/library/palm-detailed-a8777b8c/download
- 已实际查看的官方预览：`innerscene-preview.png`
- 预览来源：https://www.innerscene.com/api/library/palm-detailed-a8777b8c/preview
- 二进制 glTF 检查：832,208 bytes；37,904 三角形；65 meshes；5 materials；**0 textures / images / skins / animations**。
- 作者标示整体约 5.4 × 5.3 × 8.9 m，16 片羽状大叶、960 小叶。作者称其为 species-inspired，并不保证精确的椰树形态。
- **不采用原因：**实看预览比当前改进方向更稀疏、更像通用景观资产；没有实拍叶片和树皮贴图，树干环纹及冠形过于均匀。满足 CC0 与面数要求不等于更真实。

实时查询 Poly Haven models API 也未找到 coconut / palm tree 模型；其 island_tree 系列不是椰树。没有为凑数引入扇叶棕榈、海枣、卡通模型或需登录才能下载的候选。

## 实拍椰叶微距 — CC0

**Closed book — Coconut leaf.JPG**，2012-04-19，作者自己的作品，Kerala，原图 4000 × 3000。

- 文件：`coconut-leaf-cc0.jpg`
- 原始发布与作者 CC0 授权：https://commons.wikimedia.org/wiki/File:Coconut_leaf.JPG
- 下载：https://upload.wikimedia.org/wikipedia/commons/5/56/Coconut_leaf.JPG

实际观察：每根狭长小叶有一条抬高的黄绿色中肋，极细、低对比的叶脉沿长轴平行；并非阔叶那种明显鱼骨侧脉。中肋的折面产生窄亮边与一侧细暗影。叶面带少量低饱和黄褐斑、轻微褶皱和偶发小缺口，颜色不是整片统一的深森林绿。此图用于几何、纹理和表面起伏对照，不能仅凭它反推精确的光学透射率。

## 实拍珊瑚沙微距 — 作者释放公有领域

**Mark A. Wilson / Wilson44691 — CoralSandAruba.jpg**，2010-04-29，地质学者自己的照片，原图 2560 × 1920。

- 文件：`coral-sand-macro-public-domain.jpg`
- 原始发布及作者 worldwide public-domain 声明：https://commons.wikimedia.org/wiki/File:CoralSandAruba.jpg
- 下载：https://upload.wikimedia.org/wikipedia/commons/4/4a/CoralSandAruba.jpg
- 注意：这是 Aruba 的沙粒，不应标成马尔代夫实拍；用于碳酸盐颗粒形态和尺度对照。

实际观察：图中的 **2.0 mm 标尺**显示颗粒为亚毫米到毫米尺度的混合尺寸；多数呈暖象牙白，少量米黄、浅粉、黄褐碎粒。圆磨颗粒与不规则棱角、贝壳/生物碎片混在一起，颗粒之间是很细的暖暗缝，并非均匀黑胡椒。少数表面略半透明、略有高光。不要把这种显微视野放大成满地厘米石头。

湿干岸线与真实日照仍对照本项目已有的 `../reference-sandbank.jpg`（Adam Juman，真实 Maldives 沙洲）。干沙保留细粒与柔和脊线，湿边较暗较冷，浅水覆盖处逐渐保留沙底颜色；不需要再下载第三张图。

## 可落实的风与叶片光照依据

- [NVIDIA GPU Gems 3，第 6 章](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees)：把树干、枝叶作为层级运动，用不同刚度、频率与相位表现风。对当前场景的推论是树干低频小幅、整片叶柄共同摆动、小叶尖端更快且略有相差；每个顶点独立随机跳动会像橡皮或毛发。它是视觉近似，不是空气动力学求解。
- [NVIDIA GPU Gems 3，第 16 章](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis)：主体弯曲与细节弯曲分开；薄叶透光应由厚度细节、背光方向和遮挡共同控制。对当前材质的推论是粗中肋比薄叶肉更不透光，背光可以亮绿，但不能让所有角度都自发光。风变形后的法线和阴影也应同步变化。
- [UF/IFAS — Palm Leaf Structure](https://gardeningsolutions.ifas.ufl.edu/plants/trees-and-shrubs/palms-and-cycads/palm-leaf-structure/)：椰树为羽状叶，叶片沿叶轴分离排列，小叶通常有 V 形截面。该形态比通用“蕨类叶片”更适合作为建模起点。

所有建议应以近景、逆光、侧光、静风与有风的实际截图/动画复核；素材授权和技术规格不能替代视觉验收。
