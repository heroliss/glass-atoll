# 固定lag Eulerian尾迹光场：独立反审

这是后续窄prototype方案；本agent没有修改生产源。`r19-eulerian-tail-field-oracle.mjs/.json` 为detached纯CPU验证：**5/5**，明确 `productionHistoryAdmitted:false`。

## 结论与语义

root提出的固定lag光场方案，比扩大release区间重新放N节点或直接绘制8N实例更可控。它保持当前瞬时ledger定义，不假造稳定物理release ID；每个j是Eulerian辐射场节点，`lag_j=(j+.5)D/N`，`u_j(t)=t−lag_j`。

每个节点瞬时尾光：

`RGB_j(t) = Y(coreRGB(t−birth−lag_j)) × f × exp(−3.5 lag_j/D)/Z × C(lag_j)`。

这里C来自recipe的unit-Y色度LUT，lag在该节点固定。coreRGB分段线性，因此可以使用现有core局部窗口积分，先取每bin平均RGB的Y，再乘固定权重/C。Y是线性算子，这等于该节点瞬时RGB的**精确bin平均**。8bin平均也等于整个时间窗的参考RGB平均；空间像素仍是8时间点+一阶运动kernel，不能把RGB平均的精确性扩大成连续时空像素精确。

detached oracle对648个layer/N/now/S/j组合，与独立按shifted knots切段的直接积分比较，最大绝对误差 `1.055e-15`。默认窗最后tail已退休/currentRGB=0时，新bins仍非零。此方式不需要新物质节点、重复release缓存或增加实例数。

## 必须满足的接线条件

1. **从body+lag建立view支持。** 不能只遍历已经生成的当前tail records，否则退休源仍不存在。可保留独立光学支持描述符或按active body惰性构造view集合；同一个j只存在一条view row，不能把current N和history N拼接。
2. 每j光学出生为 `body.birth+lag`，末次可能发光为 `body.birth+life+lag`。按请求曝光区间判断是否相交，保守支持可到 `life+lag+maxS`；S0时已经熄灭必须丢掉全黑bins。maxS仍遵循现有0..1，不能暗扩。
3. **只更改view。** 当前physical head/tail I、RGB、位置、真实ember速度、ledger、cluster、matter/烟源元数据全部保持原值。历史view RGB不能进入当前local/cloud/GI照明，否则会把已熄灭烟花重新点亮环境。receiver历史曝光是另外的功能。
4. 全周期尾界为 `corePeakY × f × exp(−3.5 lag/D)/Z × C(lag)`，不能仍用当前releaseY或当前colour。canonical编译器的I0已做peak-Y归一；若将来接任意profile，要验证该峰，不能盲信body.intensity。上传24RGB系数已经含完整幅度，shader不得再乘一次I0。
5. 光学position为 `q_j(mid)`，它是从core在 `r=mid−lag` 的release pose出发，aged lag后的尾迹位置。release尚未出生时使用明确虚拟光学出生锚点，不能查未来core样本或把过去不存在的state当物理状态。
6. sourceT、side-cull、radiance bins、framing均使用相同view position/velocity/24RGB；main/mirror用同一个候选实际S，legacy mirror仍S0。当前ledger源版本/坐标不能替代view有序源行；现有每fill唯一sourceVersion和T行序绑定可沿用。

## q的导数与风结点

不能把真实ember速度当Eulerian节点导数。设r=t−lag，core采样为B,V，其加速度 `A=kb(W(r)−V)−gb Yaxis`；kb<1e-8的原无阻力分支取A=−gbYaxis。尾迹ke=1.35、ge=9.81，定义 `E=exp(−ke lag)`、`T=−expm1(−ke lag)/ke`。

由同一个aged-lag ember采样得到真实 `Vember`，风的速度响应为：

`windV = Vember − .25 V E + ge T Yaxis`。

Eulerian位置的解析导数为：

`dq/dt = V + .25 A T + windV − (1−E) W(r)`。

恒风下最后两项相消。只有过去r/t与已知wind(r)被访问，不需要未来状态。detached 72例恒/变风、drag0/.4/1.5、父子body对离线中心差分的最大误差 `2.196e-8`；样本中真实ember速度与q导数的最小差仍 `2.70m/s`，混用会显著改变shutter长度。

r恰在风结点时有导数折点，左右导数不相同。独立one-sided差分复核已通过，应明确选侧；离线验证允许有完整已知timeline作两侧oracle，生产公式不因此获得采未来样本的许可。仅用“过去差分”可以是有界近似，但未给误差界就不能叫解析/精确导数。

## 缓存、支持与容量

q(mid)比旧fixed-born代理要额外采core release pose。必须在同physical generation/同S内共享view构造，供radiance bound、framing、main/mirror共用；否则CPU查询可能成倍增加。现有wind memo仅缓存风响应，不缓存body pose，不能因body对象没变就跨wind/resolveBurst历史编辑复用q。

暂停时S可能反复调整，不宜保留无限 `Map<shutter,allRows>`；一代仅最近S或很小有界LRU足以满足同步双视图。实际camera eye、排序、reflection water-hit及sourceVersion仍归每fill，不能错误共享整张T纹理。

canonical4事件、192root、N≤16，固定N view而非追加N，保守上限：`4×192×17 + 4×17 rocket + 4×18 smoke =13196 <14000`。这不扩大GPU sourceT constructor caps；例如GPU只允许4096源仍应显式fallback，不能自动扩容。bees/分裂/额外root不在这条证明里。

canonical最长body4.876+tail.32+S1=6.196，当前event保留至少burst+9.775，覆盖本方案历史支持；未来更长profile须重新证明。光学一阶线段可能越过真实曲线极值，导演的物理包络不能自动证明长S的代理像素完全入镜，须仍检查实际投影支撑。

## 不能顺带声称已解决的部分

**地表仍是独立阻断条件。** 瞬时旧场实际上含 `q_j(t).y>.03` 的可见指示。仅积分core I并不积分这个指示：沿用currentY cutoff仍会漏过去可见光；去掉cutoff可能让水下发光。真正闭合它需要找光学时间窗内地表交点并裁发光区间，可能不止一次交叉；不能默默把过去/当前水下状态混为一谈。

一阶段可诚实关闭“退休导致的RGB源集合缺失”，继续标注ground、非线性空间轨迹、单anchor T、camera/depth/receiver历史未积分。字段/诊断应改称Eulerian field，不再称fixed-release window/稳定真实粒子追踪。

实际接线后的独立门应把旧retirement反例升级为新view均值等于上述oracle，保留旧source hash报告；同时要求S0当前ledger字节/pose不变、所有当前head/tail峰界仍保守、两视图T绑定正确、出生/末尾消失无少帧。当前R19固定-release coupling夹具的窗口期望必须按显式新model tag分支，不能删掉旧oracle后泛称全部兼容。root再做tiny GPU/误差/CPU同场景验收，才能准入生产。
