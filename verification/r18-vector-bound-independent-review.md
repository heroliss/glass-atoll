# R18 vector emission：独立界与裁剪复核

最新审查源 `fireworks.js` SHA256 `f7503f29e0f32f206b885062d74a3284ee8296f2fefe2a2c891dab7b6ac2bb35`。只读运行源；新增纯 CPU 夹具/报告，未创建 GL 上下文、运行 shader、操作浏览器或做压力测试。root 仍可继续集成，因此后续修改须按报告 hash 重新核验。旧 `a00b56cb…` 的首轮5/5结论在下文保留机制，旧framing/诊断问题已经重新核验，不再作为未修问题报告。

## 已验证

`r18-vector-bound-independent-check.mjs` → `r18-vector-bound-independent-check.json`：**8/8**。实际 Three 对象与真实 factory 源的私有只读插桩，render 使用不含上下文的 stub。原5项有效oracle全部保留，没有为新版缩小输入或放宽阈值。

- 当前 RGB=[0,0,0]、I=0，但过去曝光区间发亮：保留1行 vector 上传，24 tap 均值=[0,1.75,6]，projected aggregate bound=0.0627311>0。`maximumReferenceRGB` 没被当前 unit-Y colour=0 乘掉。
- 独立三脉冲 RGB profile 的39个非黑窗口（含 S0、1/120、.125、.5、1，出生/熄灭/颜色边界）逐通道不超过全周期最大值[12,10,30]；shader平均 tap 与独立 profile 局部积分一致。
- 同一次队列混合 candidate 与 legacy：main/mirror 候选实际 S=.5/.5，legacy S=.5/0。两视图候选24系数及世界光学锚点相同；镜像 legacy 的8个 scalar 时间权重相同。
- 640个确定性 8tap×空间尾迹端点支撑见证：四种速度、三种 stretch、两种 radius，均在实际 raster quad 与 CPU source rect 内；同一源被可见性分类器保留。
- 直接 single-source bound：保持 all-phase reference 后，把当前colour/intensity改成任意大数不改变 peak，表明候选主界直接取完整 RGB reference。
- 新framing正式对齐同一个S=.5：render=1、framing=1，平均参考RGB=[0,1.75,6]、过去中点[2,20,-100]、stretch及viewExposure匹配，输出及内部数组均冻结；S0/默认1/120时已经熄灭，正确返回0。原观察用了默认窗对比长S，已移除该过时观察。
- 新maxChannel：候选使用 `max(maximumReferenceRGB)/unmodulatedIntensity`，dark-now为3；与legacy colour最大值6混合后为6，改变当前colour不影响候选诊断及实际raw界。
- 新kernel诊断：默认legacy仍为8/24；存在candidate时为64，adaptive为2048，并列出地表、单T、离散release网格等明确限制；13个attributes与54个varying标量的声明数量一致。

## 数学关系与范围

`referenceRGBTap(i)` 的连续RGB→六个vec4逆映射正确：RGB0=(t0.xyz)，RGB1=(t0.w,t1.xy)，RGB2=(t1.zw,t2.x)，RGB3=t2.yzw，其余四个同样映射 t3..5。负 `aShape.w` 只给星源选择 vector 路径；烟的非负 opticalDepth 分支仍按 `aShape.x` 分离。

profile为非负分段线性RGB，局部积分除完整bin宽后仍是非负凸平均，逐通道不超过 knots 的全周期最大值。空间 kernel 与时间 bin 权重均为非负，完整归一权重和≤1；adaptive局部裁掉远尾只会减小RGB。故每通道由 `maximumReferenceRGB * min(1,1/(2π sigma²))` 控制，随后乘 raw/(d² omega)，T在[0,1]只减弱光。vector shader没有再乘 `vShape.z`，避免I0重乘；T通过白色 `vColour` 乘一次。

这是对现有线性锚点/投影与8格求积模型的界，不是连续真实轨迹/镜头/遮挡/介质历史的严格积分证明。Float32 shader/erf近似误差及GPU实际像素仍须root的tiny GPU gate；本夹具不替代这些门。

时间bin中心为[-7/16,…,+7/16]S，raster extent预留±S/2。带空间尾迹时再预留±stretch/2，覆盖联合卷积。候选S≤1像素也走显式时间卷积；CPU bound原小shutter方差分支虽与GPU不同，但它额外的1像素rect guard大于所缺的≤.5像素位移，仍保守。side-cull interval自身同时扩大sigma与完整shutter支撑，未发现候选假剔除路径。实际FP32边界仍由root验收。

## 剩余已复现支撑边界

这些记录在JSON的 `observations`，**没有作为需求验收通过项目**：

**当前地表 cutoff 提前丢失过去曝光。** 合成一体：now=.5，当前Y=-.05；曝光内t=.3时Y=.05、RGB=[0,10,0]，但 `updateRecords` 的 currentY>.03先删记录，render=0。这是旧当前可见性截止与新因果快门结合后的边界。正确物理处理应截断地表交点之后的发光，同时保留交点之前的曝光支撑；直接取消ground cutoff会把水下亮点引回来。尚未证明普通高空两profile发射会遇到该边界。新版 `profileOptics.limits` 已明确报告该未解问题。

framing目前正确返回曝光均值和过去中点，但结构仍是 midpoint+radius+stretch；没有额外编码shutter velocity sweep。若消费者要严格包住整快门历史像素而非光学锚点/空间尾迹，仍需补运动支撑或用导演硬界兜底。另当前main的只读QA hook `fireworkFramingSources()` 不透传快门，默认1/120；长S构图核验必须显式统一窗口。这两项是接口消费范围，未将它们偷换为radiance clipping失效。

当前两profile最大life4.876，event endTime至少burst+9.775，足够1秒曝光历史；目前没有event过早退休实证。若将来加入更长profile，不能仅依赖旧 last+.95 与曝光上限1之间的偶然裕量。

## 诊断与后续GPU门

- `maximumEmissionRGBChannel` 新版已按全周期 reference/I0 汇总，dark-now例返回3；它是无量纲channel/I0比值，不是referenceRGB本身。实际界仍直接使用完整referenceRGB，不要再重乘当前颜色。
- vector动态尾迹把8时间bin与空间kernel耦合。legacy8尾迹可达64个Gaussian评估；adaptive两级各128局部样点可达2048次。新版 `tailIntegration.kernelEvaluations` 已分支报告候选成本；这不构成GPU实际耗时测量。
- root tiny GPU门建议至少覆盖：dark-now历史亮、R/G/B非重合峰、S0/.5/出生半窗、同队列legacy+candidate、main/mirror实际S分离、长stretch且subpixel shutter、adaptive与legacy8。比较未曝光rawRGB和source bound，读取异常GL状态并验恢复；不要由本CPU报告宣称GPU链接、像素或FPS已经通过。

所有运行源保持未改动。交接文件：本文件与同名前缀 `.mjs/.json`。
