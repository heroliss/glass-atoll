# R17 stage2：同192体三维多芯接线地图与成组补丁方案

2026-10-29。**只读源码与可审查方案**；未改生产FW/physics、main、shader、声音，未运行GPU。stage1纯模块当前`7308fd7a…`，CPU19/19，独立复跑19/19且原三项反例均确认修复。这里不把纯模块已通过误写成场景已接好。

## 1. 源码地图：同一个源在哪里被消费

| 路径/实际锚点 | 当前取值与时钟 | 新profile必须一起处理的事 |
|---|---|---|
| `fireworks-physics.js:128–143` | `starEnvelope/bodyEmissionEnvelope`给标量亮度；strobe、升空attached-light另有包络。 | 旧路径保持原函数；opt-in body引用不可变profile，新增统一current/past RGB采样入口，不能全局替换成piecewise linear近似。 |
| 同文件`:165–230` | 创建192菊root、body.birth/life、固定colour、I0、初速度/drag；rocket/burst独立；`:220`统一倍率一次。 | 分层与profile在创建时编译，保同一原RNG/初始I0和root身份，独立key做新扰动。native10型/载体/声音不因候选改变。 |
| 同文件`:232–245` | `resolveBurst`将真实wind下的burst位置/速度传给root；`sampleFireworkEvent`仍按body.life筛选，公开scalar emission。 | 新life须进退休和公共粒子结果；不能只有FW画面读profile而公开采样仍旧life/色。保parent继承。 |
| `fireworks.js:267` | greybody只用`body.colour===EMISSION_PROFILES.thermal`引用相等识别thermal。 | 动态RGB不能继续用数组身份猜物理类别；第一候选显式reference光度，拒绝不适用组合。不能再将thermal缩放乘一次到已完整profile RGB。 |
| 同文件`:433–439` | 每frame生成current head：位置sampleBody(now)，I=I0×envelope(age)×.66（有尾时），colour固定。 | 记录current完整referenceRGB、I=Y(RGB)、安全colour分解、profile/version、body/layer ID、全phase通道界；0光仍保必要的过去快门覆盖。 |
| 同文件`:440–450` | tail release=`now-lag`；sourceAge=release−body.birth；release位置/速度来自过去body；脱离ember受drag/g/wind。I取过去envelope，色为独立thermal/冷却候选。 | 显式分离releaseAge和emberAge。不能用headColour(now)或未来headPhase给已经释放的ember重新染色。当前双时钟只部分存在，见§3。 |
| 同文件`:558–560` | 上传colour、unmodulatedI；8个**标量**tap取`sourceAge+δ`，δ为居中shutter。 | RGB向量tap/精确每时间格平均取代候选的标量tap；不再将已含I的RGB再乘unmodulatedI。legacy分支不变。 |
| 同文件`:398–416` | source RGB=`Tair × vColour × unmodulatedI × rawPerCandela × scalarKernel/(d²Ω)`；tail独立shutter/spatial积分，adaptive用meanEmission。 | 候选为Σ(referenceRGB_tap×spatialKernel_tap)；不能`meanI×meanColour`。adaptive若分离时间/空间，须明确meanRGB可分离近似及测试。 |
| 同文件`:455–469,81–104` | clusters从**current完整head/tail records**按I/RGB求和、I加权中心/RMS；最多2个代理，超过2发合并守总I/RGB。 | 用同一current referenceRGB；色phase变也重建/重发布。保完整源与保守半径，不能为3层创建3个必需cluster后被2槽截掉。 |
| 同文件`:474–498` | packed ledger stride8=`XYZ,variance, rawRGB, groupIndex`，rawRGB=current I×colour×rawPerCandela；两组metadata可包含4事件，全行上传。cache看records身份+raw scale，version随records变化。 | 新RGB在raw conversion前写同一ledger；可保stride/schema。records内容/色变化须换generation，不能只改profile字段而复用旧records。完整层无逐相机/质量漏行。 |
| 同文件`:212–245,676–691` | bound使用`unmodulatedI × max(current colour)`及实际投影footprint/bin；给main与mirror选P。 | 当前色的max不足覆盖跨色phase的快门；直接使用全phase或实际窗口的channel maxReferenceRGB。0光时也不能把窗口中已发出的光界置0。配套所有clip/near边界oracle。 |
| 同文件`:519–595,293–339` | visibility/sort后ordered rows，与gl_InstanceID绑定GPU source-T；原double endpoint/water-hit origin；失败CPU；每fill sourceVersion。 | 向量tap不改变row identity和T索引，不额外重复乘T。CPUfallback不能只衰减legacy colour而漏候选RGB。T在快门内固定的近似仍存在。 |
| 同文件`:598–637` | smoke provider metadata覆盖真实body；`sampleBody`只查active且past/current实体；descriptor按event WeakMap缓存。 | 新born/life/profile/material时程须进metadata及body sample；immutable source身份与动态光账本revision分开，不返回未来XYZ。 |
| 同文件`:652–675` | getBounds为当前wind下16点forecast+margin；getFramingSources只列current非零实际源；它们不是允许随机域的数学包围证明。 | dark phase不能让director误判整场已结束；用profile允许域的解析envelope作长期预测，current源只作现场诊断。 |

### 接收者、缓存与帧顺序

| 消费者/锚点 | 当前行为 | 最小接法/限制 |
|---|---|---|
| `main.js:1175–1182` | simulation.update→flush sources/audio/smoke→updateScenePhotometry。 | 保同一physicalTime；候选profile不在render临时推进。暂停/seek/clear状态协议另验。 |
| `main.js:767–775` | current clusters→localLights→sky transient→可选完整烟光ledger→GI→各bound。 | 所有消费者在选P之前读同一代源；phase变化不能等下一次环境cube更新。 |
| `local-lights.js:74–80` | slots4/5将2cluster rawRGB变成native PointLights+共享GLSL uniforms+bound；P只统一乘一次。 | I/colour因子仍可保schema，若传整RGB须只分解一次。材质无需每层新增一盏灯。 |
| `main.js:288`、`water.js:58–59,216–223` | native scene materials使用localLights.apply；水底/表面GLSL读localIncident；真实火花水反射另由effects capture。 | 土地、树、沙、水下接收者自然跟随current两代理；其近似不能宣传成逐星GI/精确反射。不要重复加一层flash到水面。 |
| `aerial-perspective.js:178–180,221,321` | localIncident与有限空气散射/bound读同一6个local records。 | 颜色/强度每frame更新即可跟随；不能另加相机空间白雾补能量。 |
| `sky.js:784–796,783` | 两cluster→raw transient RGB、有限半径与raw cloud bound；这里不是solar cloudShadow贴图。 | 直接读新cluster，cloudShadow cache无须因烟花颜色重烘。source→cloud smoke attenuation仍未实现，不能冒称已解决。 |
| `sky.js:798–818`、`main.js:820` | mirror另画alpha0 transient cloud delta，water-hit observer，主sky本身带transient。 | 主/mirror同一current源；保持transient不进PMREM/cube的现合同，避免缓存残留/重复照明。 |
| `pyro-smoke-light-field.js:53–76` | 完整ledger版号+snapshot/revision+count/data为key；静止烟而ledger版本变会重烘。 | 不用densityRevision或descriptorVersion单独作为光场key；新色必须让ledger.version变化。maxSources14000、maxPairs1048576仍约束。 |
| `pyro-smoke-renderer.js:153–182` | 关闭resolved时2cluster/6local；开启时完整field替换烟花代理，避免重复照明。 | 候选沿现替换规则，不再叠3层代理。current光照烟，旧烟的物质不被新光重置。 |
| `indirect-lighting.js:251–264,72–76` | 单位几何响应cache故意不含rawRGB；每prepare用**当前**RGB重组SH与功率。 | 正确做法是更新current records/调用prepare/publish，**无须因纯色phase重算昂贵几何响应**。不要误把正确复用当旧色bug。 |
| `main.js:777–786` | main/mirror源bound、sky/local/GI/smoke/air共同选P；C独立，最后sceneExposure发布。 | 同一phase通道界进P；保持I/P/C分离。平均快门不等于瞬时场界，需覆盖两者。 |

`fireworks.js:500–504`还有旧灰sprite烟的cluster受光路径，虽然生产main以`legacySmoke:false`排除其绘制，QA/兼容分支仍应识别。不能只更新新体积烟后声称所有源consumer已同步。

## 2. 首个可审查候选：同192菊root，三维三芯

建议ID为`chrysanthemum/three-heart-reference-v1`，是原类型内opt-in profile，不增加第11个随机类型、不重置已接受笑脸。普通launch、口径/升高、burst时钟、音频事件与mortar attached-light全部保留。

- 192个root按稳定`body.id % 3`分为64 outer/64 middle/64 inner。保原全局球面方向序列；每层采样覆盖整球，**不是把连续ID的顶部/中部/底部分成三个半球片**，也不是平面环。以旋转frame变换几何，不面向相机。
- 径向速度乘1/.7/.4，继承同一实际burst velocity；intrinsic speed仍≤旧19m/s。g、现bounded-descent drag、风响应相同，不暗改物体尺度/时间。`basePosition/baseVelocity`也必须同步，使resolveBurst后不复原为旧单层速度。
- 首次对照三个ignitionDelay都0，只更改layer速度、颜色/寿命；结束年龄3.4/4.6/2.6秒来自stage1示例。可保独立body life扰动±6%，最大4.876秒；首次intensity jitter设0，避免与源预算归一混淆。以后增加delay须另测，不能为了“层次”默认伪造二次爆炸。
- 光谱为作者RGB三色候选，不是已测烟花SPD。初步沿现独立gold ember尾迹；不把蓝头强制产生蓝炽热尾，也不以所有头变黑体制造颜色。两色过渡profile另作强制CPU/GPU反例，验证通用通道，而不靠三层固定色掩盖RGB-time接线缺陷。

### I的“守恒”必须先选清楚

不同life/包络下，逐时刻I、峰值和`∫I dt`不能未经定义同时宣称不变。最小对照选：保native seed生成的每body名义`I0_i`及`ΣI0_i`预算，将每层template除以自身peakY使`0≤I_i(t)≤I0_i`；profile RGB已经含该I0分配与event光学倍率，接线不得再乘body.intensity。

有尾体仍head .66、tail .34，并保`Σrelease weights≤1`；reference光度且独立unitY ember色时，总瞬时源不超过同一组名义I0预算。由于各层寿命不同，**同一时刻相对旧包络的I与全程参考cd·s会改变**，这是有意的时程变化，不应称能量守恒。这里的参考cd·s也不是radiant joules。

若希望额外锁定参考`∫ΣI dt`，需用同一native event的old envelope积分和候选profile积分算全局归一因子K；检验K是否突破峰界并更新bound。不能既自动抬K又写“源强未变”。这个模式不是第一版隐式默认；应另立photometric normalization选项和对照。

### M与数量

参考总M沿原空中20.35：launch .35，payload/central合计20；锁原centralFraction（生产.20或明确QA选择），三层分享同一payload budget，不能每层领20。每层64条family按已确定权重划分，再用各body的归一CDF释烟；tail、mirror、快门tap、layer结构本身不另领M。

生产two-births/12代表不会自动变成全体持续源。视觉多芯首验可保旧总M/旧source模型，但必须标其局限；需要烟跟随三层时，作为后续同组的独立开关启用logical-all，不同时换扩散、核形状、总M和光学。现logical scheduler的uniform prefix需要profile CDF适配，见§4。

192×(1+16)=3264个head/tail源/发；保守加carrier最多17个为3281，4发13124，仍低于14000发光容量。这个计数不是GPU成本保证：源×烟packet pairs仍可超过1,048,576；每发长期烟cell/merge成本也不会因body总数相同自动不变。

## 3. 时间、过去尾迹与快门：必须补的合同

### 三个时钟

1. `kinematicBirth`：root从主burst开始运动，始终用于sampleBody。
2. `emissionAge = observationTime − kinematicBirth − ignitionDelay`：只决定burn profile，不改变物理轨迹出生。
3. ember固定releaseTime=u、sourceAge=u−kinematicBirth−delay、emberAge=observationTime−u：释放后的颜色/亮度由**当时**释放强度和独立ember冷却决定，不由现在或下一phase头色决定。

即使以后delay=.12秒，root在这.12秒仍应按已给初速运动；仅点火延迟。把body.birth直接改成burst+.12、位置仍设burst点会导致迟生的假瞬移；不能这样补delay。真正subshell是另一条父子冲量图，本候选不涉及。

stage1没有通用`sampleEmber`或脱落燃料谱模型。最小适配可明确“独立gold ember”：`tailRGB = I_body(sourceAge) × .34 × releaseWeight × unitYGold(emberAge)`，不会继承头色下一phase。其冷却仍作者近似。要从gold切换为release colour/混合谱，必须新增显式版本化emberProfile，不能在shader随意mix当前head色。

### 当前shutter存在的近似

- 当前FW scalar tap以`sourceAge+δ`采包络，δ居中；tail geometry却是当前生成的固定release ember。这不构成完整双时间积分。
- 一个物理ember的u固定，快门内变化是emberAge，不是让u随observationTime一起滑动后仍用同一ember几何。连续尾迹严格形式为`∫dt ∫du E_body(u) × emberResponse(t−u) × K(x−Xember(u,t))`；旧spatial/shutter分离是近似，profile不能假装它精确。
- 要满足“无未来尾色”，建议候选采用快门结束时间为now、窗口`[now−S,now]`，固定过去release格并裁掉`t<u`部分。这个选择必须同时改motion kernel居中、shutter footprint/visibility/bound；不能只改时间tap。若保midpoint timestamp，则必须明确允许的lookahead时域及物理帧状态，不能无声明采now后的颜色。
- 初次瞬时源/照明一致性门可用S=0，随后单独验S=1/120；不能据S=0通过跳过正常快门。
- `lens.js:333`给finite effects固定1/120，而`main.js:760,777`的bound读parameters.lens.shutterSeconds；默认值一致，但非默认会错配。`fireworks.js:704`又令mirror S=0。接线必须在draw与bound共享**实际**窗口；main/mirror曝光近似可不同，但要如实报告，不能要求其pixel等同。
- 烟/云/GI目前取瞬时current光，整个接收者图像未做同样的过去光照积分。source向量快门正确不等于全场时间积分已经正确。先在instantaneous同phase门验证“无旧色”，receiver曝光历史属于另一个明确误差/功能范围。

## 4. 最小成组补丁，不能拆成只给shader换色

下表为**未应用的patch计划**。先写pure编译器/adapter及CPU oracle，再在一次review中接通G1–G4，达到instantaneous全consumer一致；G5的正常快门门完成前不向用户启用候选。

| 组 | 计划文件/变更 | 必须同时锁住的合同 |
|---|---|---|
| G0 | 新pure `firework-layer-profile.js`编译192真实root→layer/profile；不改native随机流；返回预算、寿命/速度硬界。 | 编译失败不入active；profile及seed immutable；count192、I0预算、M分配显式。stage1模块仅作为采样器，不把它伪称legacy指数包络等价。 |
| G1 | physics event可选profile ID，body的kinematic/emission时钟、life/最晚retire、baseVelocity；公共sample结果带current完整RGB。 | 原类型不选profile时byte/数值行为原样；active上限、launch/burst、wind history、approved audio不变。 |
| G2 | FW records新增current RGB与window/all-phase通道界；用同一适配器生成head/tail过去色，clusters/ledger/framing同步。 | 通过I=Y(RGB)/安全colour分解保持旧ledger schema，倍率/P不重复。0暗相也保必要的快门历史records，current照明仍为0。 |
| G3 | bound/visibility读完整参考RGB界；GPU T保持ordered rows索引/原double endpoints；CPUfallback衰减同一完整RGB。 | 不让新colour字段绕过T，也不在CPU+GPU重复乘；main/mirror每pass sourceVersion仍独立。不能只修current bound而漏快门phase。 |
| G4 | main显式QA profile选择、完整frame generation；local/cloud/GI/smoke按同代current源；新解析envelope接director。 | 现receiver大多能继续消费I/colour，但强制证据证明实际调用/缓存更新。色变化不强制重算GI几何单位响应。 |
| G5 | 候选vector temporal path、实际曝光窗共享、过去ember时间模型；legacy shader/material分支保留。 | 一个可行布局是8个RGB格均值（6个vec4替换2标量vec4），单格RGB用stage1解析积分，运动kernel按格求积；候选不再额外乘I。属性/varying/编译与精度上限须由root实际renderer查询，不能仅凭源码声称支持。 |
| G6 | 可选logical smoke CDF适配及图metadata字段、过去source-cell质量加权矩。 | 必须晚于瞬时层几何/颜色门；不能只把prefixMass改CDF而其余仍按uniform时刻权重。 |

G5中，8格RGB精确积分仅保证**无空间/透射变化时的时间光量**；带运动kernel仍有求积误差，需要高精度独立oracle。旧adaptive的meanEmission应替换meanRGB；空间×时间若不再可分离，不能直接复用旧scalar pass的“预算证明”。可保aColour用于传T/legacy色，候选RGB tap已经含I，fragment分支明确；具体pack布局需先以实际varying/attribute能力定案。

G6有两个真实未兼容点：

1. `pyro-smoke-logical-burn.js:29`为uniform prefix，`pastSegmentSourceMoments`当前内点/权重假定该格均匀释放。非均匀CDF改了质量，还须按rate加权求空间/时间/热龄化矩；不能把格末质量撒在uniform轨迹分布上再声称物理正确。跨rate knot的cell应分段或带明确加权积分规则。
2. 当前makeCell要求mass>0；有长暗相/零烟率的profile可能出现CDF平段。需事务性消费零质量cell的时钟进度而不向烟state发非法0mass包；不丢后续保留M、不凭暗相取消整个body。pure stage1 ledger不是新host的提交权，应CAS核验baseLedger/revision，继续旧token/容量/clear/故障锁。

## 5. 寿命、空间包围、退休

旧`firework-show-envelope.js`chrys最大body life是`4.3×1.11=4.773s`。本候选4.6×1.06=4.876s，**已经超过旧硬界**；同count且速度缩小不构成旧包围仍正确的证明。

profile编译器应给`maximumKinematicSeconds=4.876`、`maximumIgnitionDelay=0`、`intrinsicSpeedMax=19`、对应drag域、tail duration≤.35及carrier原界。解析helper显式接受profile bounds并更新bodyF/bodyH、垂向max和tail anchor pad；不改g/世界米。未来delay>0时完整coast+burn时长增加，若有推进则还需Δv/窗口上界；不能复用这一次无推进的证明。

`event.endTime`要覆盖最晚body、尾迹、所有due smoke cells及采样消费窗口；不能只改可见life而active提前退休。`describeCombustion`缓存必须在event固定后建立，不能event已对外发布后再原地加层/改life。director的16点样本只作附加构图，不替代允许域解析包围。

## 6. 可审核测试门

1. **legacy隔离**：未选profile的十型native events/原RNG/I/colour/life/events与冻结基线一致；approved音频hash4e5不变。
2. **三维结构**：192/64×3、每层全球方向覆盖、speed倍率/真实位置、burst wind继承、baseVelocity更新；相机0/30/60/90°不改变物理输出。未通过native视觉前不声称照片级。
3. **预算**：同seed I0数组及ΣI0不变、profile peakY≤I0、head/tail分配上界、全场raw ledger RGB和cluster总RGB/总I匹配；M总20.35分层/family闭合。另输出参考cd·s变化，不能藏掉。
4. **current/past色**：单body在不动位置红→绿，静止烟densityRevision不变，ledger.version仍变、cloud/local/GI/resolved field均发布新RGB；fixed release ember不被现在/未来头色重染。phase在shutter边界前后、出生/熄灭/暗相各有反例。
5. **向量积分**：单格及跨knot独立解析/高阶oracle；avgI×avgColour错误反例必须失败。source window与bound实际window一致；移动PSF、tail/shutter分离误差、anchor T固定误差分开报告。
6. **主/反射**：同physicalTime/同current ledger身份，reflection water-hit原double路径，GPU与CPU fallback只乘T一次、ordered row不串色、不留上一pass sampler；mirror S=0差别显式。
7. **数值界**：动态RGB每通道max、0/暗相快门可见、near-plane/极近DOF、phase切换高峰P先降；旧bound current色可能为0而窗口有光的夹具必须揭露问题。
8. **轨迹域**：解析新life/速度/tail界论证为主，有限大量seed+风角扫描只是反例搜索；update/retire/past sample与20Hz烟cell消费全部一致。
9. **源容量/成本**：1发与2发已有安全场景，禁止未经需要的GPU4发压力；先CPU证明4发完整源计数/14k不截，再由root有界native测CPU/GPU、pair cap、unsupported/fallback状态。
10. **释烟推广另门**：rate加权源矩、CDF平段、同family budget、30/60/120Hz、旧烟被新色光照亮；renderer tail数/画质/camera不改变M。

首个用户验收应录同seed、同FOV/C/天气/I0/M的单层A与三芯B完整展开→分层→消退→落弧；同时带斜看/正常速度，不用一个正面静帧证明立体性。先S=0的照明一致性，再正常shutter，不把不同参数组合的整体美观差误归某一技术。

## 7. 本轮源快照与边界

读取时FW仍`3fb39738…`、physics`fb6be290…`、pure profile`7308fd7a…`；main`e24e54b0…`、sky`51db558e…`、localLights`c3199796…`、GI`2299d1eb…`、lens`a3897b76…`。main/sky由其他工作持续推进，行号只定位本轮读取快照；未来应用patch前应重定位/核对内容，不能盲套旧行号。

本文只列未应用的最小成组改动与门；未增加运行开关、未绘制候选、未修改声音/源强/烟量、未运行GPU，也没有新的照片级/帧率通过结论。
