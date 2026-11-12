# 清烟重建时间与平海面半空间：只读证明

2026-10-27。未改state、main或renderer；生产`pyro-smoke-state.js`仍为SHA256 **d40060da202a0c4b488986acef4afcbb64550ac97bd875b012b9bdba70a25e19**。新[proof脚本](pyro-smoke-halfspace-proof.mjs)和[结果](pyro-smoke-halfspace-proof.json) **13/13 CPU通过**，没有GPU或视觉验收声明。

## 重建时已有time原点，不需要新initialTime选项

现构造器用`time`，可以直接：

```js
const smoke = createPyroSmokeState({
  time: appPhysicalTime,
  wind: currentWindVector,
  // profiles / diffusion / thermal options...
});
```

在4000s重建并`advanceTo(4000)`是0步，立即排入`time:4000`的新烟即入态。若忘记传time而沿用默认0，再调用`advanceTo(4000)`，首次只到10s、behind3990s；这是调用原点错误，不是state缺少原点功能。默认200step/调用不能拿来补4000s空历史。重建后emissionId可继续沿全局单调序号，无需重用旧active event；源和wind输入应先于推进到对应时间排入。UTC不能替代这个物理时间。

## 当前库确实无地面边界

`sampleMedium`和`columnOpticalDepth`是整空间Gaussian的查询，y<0仍可非零；没有地形、沉降或湿清除。`ledger.airborne`在此版本指完整数学库M，不是已证明全部位于真实空气中的M。渲染器若只裁y<0却继续宣称可见半空间总量等于M，会丢失尾部；若把地下尾当空气参与水下/镜像光路，也不正确。这里不默认改变state查询。

## 平面0的反射质量核可保M，但不是只翻mean

令`R=diag(1,-1,1)`，`rhoG`归一到M。定义：

`rhoPlus(x)=rhoG(x)+rhoG(R*x)`（y>=0），y<0时0。

将第二项换元，正半空间上两项的积分恰为原Gaussian正、负半空间质量之和，即 **M而不是2M**。一般SPD的虚拟image核必须`mean'=R*mean`、`cov'=R*cov*R`；xy、yx、yz、zy项反号。只翻mean对倾斜相关Gaussian不成立。proof用相关SPD实测这一反例。

等价实现不必上传/生成第二个物理packet：在同一base kernel上查询反射后的点/射线即可。**image不是新的排放源，不进入质量ledger或active事件列表。** 截面分辨率、support裁切和后续合并的误差仍须另算；无限域证明不能替有限4σ cache的质量误差背书。

这是平海面上的反射/折叠密度近似，适于避免近地烟的地下尾部参与空气光路；它不是吸收/沉积边界、真实海面水滴捕集、沙地形碰撞或流体壁面求解。不能因密度在平面上呈偶对称，就宣称任意垂直wind/热漂移已经解出真实不可穿透流场。若latent中心越过平面，折叠可以产生反弹式外观，物理含义仍需明确。

## latent参数不等于受限烟体的实际质心

折叠分布等价于`(X,abs(Y),Z)`。因此X/Z均值保持，实际Y均值是：

`E|Y| = sigmaY*sqrt(2/pi)*exp(-muY²/(2sigmaY²)) + muY*erf(muY/(sqrt(2)*sigmaY))`。

实际`Var(|Y|)=sigmaY²+muY²-(E|Y|)²`；相关项`Cov(X,|Y|)=Cov(X,Y)*erf(muY/(sqrt(2)*sigmaY))`，Z–Y同理。不要把state的latent covariance标成这个受限分布的实际协方差。

proof的latent mean为`(.3,.2,-.5)`、sigmaY=1m；一般相关SPD的3D数值积分质量为`.999999999993`，实际受限质心约`(.3,.8137901,-.5)`，与latent `.2m`显著不同。核恰在平面且sigmaY=1时，实际质心为`.79788456m`，方差约`.36338023m²`，不是mean0/variance1。密度在边界可达原核的两倍，但它的总量没有翻倍。

## 有限column先裁真实半空间，再查询image

真实射线`p(s)=o+s*d`，有效区间先取`[start,end] ∩ {oY+s*dY>=0}`。y方向为0且起点在地下则空；向上/向下时分别更新入/出点。起点y=0、start=0、相机在烟内均合法。

裁好区间`[a,b]`后，质量column为：

`columnG(o,d,a,b) + columnG(R*o,R*d,a,b)`。

注意先用**真实世界射线**裁y>=0，不能将image射线再次按正半空间裁掉。主视角到水、虚拟mirror camera穿平面到烟、water-hit朝上、内部起点和水平上下射线均与独立密度数值积分相符；该夹具的各column绝对误差约1e−11到2.3e−9，门槛3e−7，仅证明此组CPU输入。

虚拟mirror camera y<0的空气起点应为water-hit，不能把水面下camera→water段当真实空气。proof显示裁掉虚拟地下段后，它的column等于water-hit→烟的column。真实观察者→water若也穿烟，是另一条真实段：由主视角前景介质承担一次；不能因为反射段已查烟就丢掉，也不能双方都重复乘同一段T。**质量method-of-images与水面镜像成像是两个不同操作。**

## 对阶段A合成的有限认可

“旧烟先画、发光星后画并显式乘star自身有限路径的T_smoke”在职责上可避免先给星乘T、随后又由烟alpha重复衰减同一颗星。必须满足：烟对背景的合成与星到眼/水hit的T使用同一密度、半空间与深度截断；烟在星后方不挡星；新星可照旧烟；不同光源/位置的散射源项不能仅因tau可加就交换顺序。中心排序与thin/centre lighting仍是明确近似。

conditional optical mean应是裁后**实际射线位置**的消光权重均值，不是base/image的latent中心平均。单个1D Gaussian沿线权重`w(s)=C exp(-(s-muS)²/(2sigmaS²))`时：

- `I0=∫[a,b]w(s)ds`。
- `I1=muS*I0 + C*sigmaS²*(exp(-(a-muS)²/(2sigmaS²))-exp(-(b-muS)²/(2sigmaS²)))`。
- 原核和image分别求I0/I1，再用`meanS=(I1a+I1b)/(I0a+I0b)`，物理点为`o+d*meanS`，应落在真实裁后区间。tau极小时需明确安全fallback，不能NaN或跑到地下image中心。多profile合并时RGB消光权重可能不同，一个亮度加权mean仍属近似。

光照在这个mean点取值不等于完整积分`∫T*j ds`；厚重叠、自阴影和有限源附近光照梯度仍未解。sky已有清洁空气辐亮度，不能把整张sky乘T_smoke后声称前景clean-air散射也严格保留。此前成对空气修正的适用条件和误差边界仍有效；本proof没有实现或验收它。P仅在散射source写入存储RGB时乘一次，density/tau不随P/C变化。

当前建议：重建直接使用已有`time`参数；半空间只作为显式、共享的renderer/CPU候选，不偷偷改state默认查询。选定后再做真实GPU column/受限均值/主镜像路径和无双重衰减夹具。
