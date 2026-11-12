# R11：可选的水面倒影构图范围

已在`camera-framing.js`加入纯计算opt-in：

```js
fitPerspectiveBounds(THREE, camera, sourceAndIslandBox, {
  eyeHeight: 8,
  margin: .84,
  bearing,
  reflectionPlaneY: 0
});
```

省略`reflectionPlaneY`或显式传`undefined`，完全走原函数体，返回字段和数值行为不变。本轮仅改`camera-framing.js`；未改main、director/controller、相机焦距、烟花几何或物理。

冻结模块SHA256：`31f49459f24ee57821873d0bb2471a763efe082920221800b8606797fbe96d1f`。原始[基线](r11-reflection-framing-baseline.js)SHA256 `3c5b7a4f79dbb7fd6f901b7755c7ddcb9f42e5b5b699f0e6c441db1f02b92929`。

## 计算方式与接口

水面平面`y=p`的虚像为`y'=2p−y`。新分支先验证plane为有限number，再复制源box，将原始y范围与镜像y范围并集。目标y精确设为planeY，保留所给eyeHeight和水平bearing，使用camera副本的真实透视投影检查**原始8角＋镜像8角**，距离搜索先约束margin、正视深度和near，再独立验证最小解是否满足far；.2%距离余量仅在不触碰far时采用。输入box若已包含小岛，则原岛角和镜像岛角也包含在拟合范围内。

输出保留`position,target,distance,horizontalDistance,margin`，并附：

```js
reflectionFraming: {
  planeY: 0,
  cornerCount: 16,
  sourceBounds: {min: [x,y,z], max: [x,y,z]},
  fittedBounds: {min: [x,y,z], max: [x,y,z]}
}
```

这些数组、position和target均为独立副本。无效plane、反射坐标溢出、无法在clipping volume内容纳的场景抛RangeError，不改变camera/box/bearing。固定焦距时包含倒影需要拉远，小岛可能变小；最终构图需实际图像检查。


## 独立审查发现与修复

初版69e35在角度margin和near/far一起二分搜索时，会因初始box对角线已经超far而误拒绝一个更近的有效解。独立复现：FOV120°、aspect1、near.15/far125、box[-20,0,-20]..[20,80,20]、eye8、bearing[-1,0,0]、plane0、margin.9；原初始对角线169.7056m导致抛错，但80m手动视角有效。这一失败源和当时检查已保留：[初版源码](r11-reflection-framing-first-farbug.js)、[旧检查结果](r11-reflection-framing-check-before-far-fix.json)。

31f修复只影响新增reflection分支，按正camera view depth确保物体在前方，然后不依赖far搜索角度/near解。最终far验证仍会拒绝真实不可能的场景。上述case现返回水平距离77.5880324m，最大NDC .8970026 < .9；far125全部有效。额外窄窗口case：far105.961867m时保留无.2%padding的77.4331661m解；far105.950867m确实不足则抛错。默认旧路径源码逆变换与96组默认值仍完全相同。

## 执行证据

[检查器](r11-reflection-framing-check.mjs)、[原始结果](r11-reflection-framing-check.json)：**10/10**。

- 去除新增签名字段、opt-in分支及末尾helper后，整个旧函数源码字节等于3c5b基线。
- 96组aspect/focal/eyeHeight/bearing，省略和显式undefined的所有返回字段及浮点数与旧函数deepStrictEqual；输入未改变。
- 600组实际THREE投影：aspect .35/.65/.936/1.6/2.4；focal18/28/70mm；plane−18/−2.75/0/5.5m；eye1.6/8m；五种水平bearing及退化fallback。同时检查火花源、小岛、并集box和各自镜像，共28800点。最大绝对NDC **.83828668051 < .84**，全在裁剪范围内，目标y和eyeHeight正确。
- box跨平面、整个box在平面下方及退化单点共9组，原始/虚像角均满足margin。
- NaN/±Infinity/null/string/object及反射坐标溢出共7种输入提前拒绝；far=3m的不可能范围也明确拒绝，输入未改变。
- 新增已知far125有效解及窄far窗口两项回归；far不足仍明确拒绝，没有把失败改为任意返回。
- 修改返回metadata/向量不会回写输入；测试前后模块hash保持冻结值。

这是透视数学证据，不是浏览器视觉验收；镜面波浪偏折、光晕与屏幕扩散可伸出理想平面bounds。该函数只拟合调用者给定的source/小岛box，不自行生成烟花未来范围或修改物理。是否接入自动镜头由root在实际场景对比后处理。
