# R14 水体清澈度：真实光程与共享介质

修改范围为`water.js`、纯函数`water-optics.js`和本轮验证文件；主UI/主循环已接入。稳定cac水花未加入局部水体反射，不应把本轮系数宣称已用于该被撤回实验。原始water65a已封存为`r14-water-optics-baseline-water.js`。本轮没有修改石子、波浪、海床、阴影或反射构图。

## 物理依据与模型边界

吸收a与散射b采用每米系数，直达光束消光c=a+b，沿实际距离d的透射为exp(−cd)。NASA PACE技术报告将这些量定义为随波长变化的固有光学性质，并区分散射出光束与吸收；实际水体成分会改变光学性质。[NASA PACE技术报告第4章](https://ntrs.nasa.gov/api/citations/20220002901/downloads/NASA%20TM%202022%20219027%20Vol.%2010%20rev1.pdf)，[NASA PACE IOP](https://pace.oceansciences.org/pace_iop.htm)

科学的光谱系数需结合光谱响应积分，不能把三个随手选定的RGB数字称作测得的完整水体光谱。本项目保留旧有的线性RGB有效系数作为作者参考；分子散射底值与滑杆到颗粒量的映射也都是明确的创作参数，没有声称来自实测数据。[NASA光谱来源与波段积分方法](https://oceandata.sci.gsfc.nasa.gov/rsr/sources/)

界面0–100%的“清澈度”控制悬浮颗粒散射量，不是表面透明alpha，不是NTU或塞氏盘深度。c的倒数只是该RGB通道中平行直达光束衰减到1/e的距离。塞氏盘可见深度还取决于照明、漫射衰减、盘面反照率、背景/人眼对比等因素，不能直接用1/c替代。[Gordon和Wouters的原始研究记录](https://ntrs.nasa.gov/citations/19790027730)

## 选择、自查与取舍

保留吸收[.160,.035,.018]m⁻¹。散射由创作底值[.0005,.001,.002]加颗粒参考[.0035,.008,.012]×((1−clarity)/.1)²组成；默认clarity=.90使用明确参考分支返回旧散射[.004,.009,.014]，避免十进制相减让默认值发生漂移。clarity=1仍有水体散射，clarity=0颗粒系数倍数100；这里不是把全部自然水体压成同一实测分类。

否决“调固定透明度”：它无法表达更长斜视光程、不同深度及RGB选择性消光，且会使天空反射一起消失。否决“直接Secchi米数滑杆”：现有RGB/单次散射模型不足以科学标定该量。暂不引入新光谱LUT/多次散射通道：当前任务用现有物理传输路径增加介质控制即可；密浊水中的多次散射和颗粒吸收仍是局限，不能宣传成完整浊水解算。

太阳入射、水面到海床/真实小物体的出射、局部灯到海床的水中光程、原有近似体散射，全部复用同一absorption/scattering。Fresnel表面界面反射、波浪几何和相机保持原逻辑。配置只更新共享vec3对象，没有增加采样器、RenderTarget、渲染pass、shader重编译或自适应分辨率行为。

## API与原子性

`configureOptics({clarity:0..1})`验证完整patch后提交，拒绝NaN、无限数、越界、字符串、未知键。没有静默裁剪。`getOpticsState()`/`diagnostics().optics`返回不可变状态与revision；相同值和空patch不增加revision。`uWaterAbsorption`/`uWaterScattering`两个uniform对象及vec3的身份始终保持，供其他材质显式共享；当前稳定水花没有局部水体反射接线，不从空材质列表推断其已共享。

默认系数完全相同；GLSL常量折叠与动态uniform浮点运算仍可能有FP32末位差异。实际GPU夹具将明确量出默认传输核的差异，不把系数相同直接说成整个主画面逐像素字节相同。不能通过放宽失败阈值来掩盖编译/读取错误。

## 当前证据

`r14-water-optics-check.json` CPU/factory **6/6**：默认精确值/非零底值、1001级单调散射、a+b与RGB实际距离Beer、150组分段传输合成（最大误差4.44e−16）、非法配置原子拒绝、真实factory共享身份/恢复默认。propProbe/traceSubmergedProps和波浪vertex仍与65a字节一致；生产采样器、RT、scene pass数不变。

冻结water SHA256`da27356ac167f370445e589785ef50005374443b88f700e571f8369cc098b9cb`；optics SHA256`b1d330c1596aec1ed4cdd22d787177fbf924e0f781d9452356337a2528fee6db`。GPU入口`runWaterOpticsGPUCheck(THREE,renderer,{water,splash})`，helper SHA256`1114ee8d2075056e5ddcdd78fc6668cfff9f921faedba8c31e2df69ca23c3670`；只在原有健康renderer上做128×64传输核验证，无新上下文。实际GPU结果、主场景滑杆观感和性能由父代理保存后再更新。

父代理已完成实际GPU5/5、原生UI与固定实景16/16；结果与局限见R14-CLARITY-CHECKPOINT.md和对应JSON。回90实景仍有685个像素残差，未声称整图字节相同。
