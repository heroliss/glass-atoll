# Palm B0：固定中脉的截面运输实验

2026-10-27。只新增`palm-frame.js`并修改`vegetation.js`的静态几何构建和QA接口；未改云、main/lens/water、目录、材质/风shader或centroid。**默认仍legacy，尚未根据实际画面放行transport。**

## 范围与基线

- 修改前源码`baselines/vegetation-before-palm-B0.js` SHA256：`f81f4dfe20fa737d9498e5124d14a66c577db37e36e9cd08f8cf8c60fcad7ef0`。
- 当前`vegetation.js`：`a5f38eb00d66a86d26b923905240ae755adcb95e125f371f6089c2b2f8e37c4e`；私有helper：`df9471498cdd88c35e76c5d8855f2eec5ad401cb98856c4a9aadb63dc5dacf8a`。
- B0只运输旧roll下的rachis局部normal，投影到既有小叶方向的正交平面，旋转边缘截面。**没有新增60–90° distal roll，也没有改小叶着生方向或中脉。** 它是可见性诊断，不是完整植物学扭转重建。

原`side`参与小叶curl中心线，故不能直接替换它。本实现先完全生成旧版Float32顶点，再围绕每行上传后的实际中间顶点M旋转左右两个边缘；中间顶点、根和tip直接沿用原字节。保留旧的沿叶轴分布/下垂/卷曲中心线、尺寸/随机流/UV/颜色/index及全部wind/motion属性。中央枪叶、叶鞘、树干、叶轴和灌木保持原样。

局部frame用相邻rachis切线间的最小旋转运输，使用旧有roll幅度及原每小叶残余roll；没有按世界Y再强行翻转新ridge normal。投影退化/不正交时回退旧截面；Float32候选出现新退化面时按整片小叶回退旧位置，不能重新引入此前修复的零面积tip面。TBN由新静态几何重新计算，动态时仍由同一风旋转正常/tangent。

## 接口与缓存义务

```js
grove.userData.setPalmFrameMode('legacy');
grove.userData.setPalmFrameMode('transport');
grove.userData.palmFrameMode;           // 当前模式
grove.userData.palmFrameDiagnostics(); // fallback、frame误差、内存与构建成本
grove.userData.diagnostics().palmFrames;
```

setter只换同一个pinna mesh的几何，返回`{mode,changed,resetRequired}`；它不改时间、材质或主渲染器。root必须在改变模式时重置TAA、刷新方向影图/包围盒；完整受光比较还须重建对应GI源。首轮GI off并固定同一time/pose/env；否则旧GI几何可能混进B。两套数据共享index、UV、颜色和全部风属性，不加draw call/vertex attribute；来回legacy可恢复原geometry对象，非反复重新随机生成。

## CPU证据

`node verification/palm-frame-check.mjs`：**18/18通过**，详见`palm-frame-check.json`。

- baseline的6组所有attribute/index与默认legacy逐字节一致，11张程序纹理和数量一致；所有visible/depth shader全文一致。
- 31,162片成熟小叶建立transport候选；本种子投影fallback=0、退化fallback=0。旋转正交/行列式误差约1.33e−15以内。
- 168,664个中脉顶点、187,026个根/tip顶点逐bit一致；所有wind/motion属性共用同一buffer。212,584个边缘顶点改变，截面半径的Float32误差最大1.21µm。
- index不变且没有新退化面，normal/tangent全finite、单位且正交。小叶三角形总表面积由886.36变881.97 m²，约**−.495%**；固定弯曲中脉周围的截面旋转仍会略改片段面积，不能声称总面积严格守恒。
- 12个固定视角，以16,384个确定性实际三角形样本估计**未遮挡投影面积**：低仰角5°为旧版1.276–1.344倍，25°为1.120–1.149倍，俯视65°为.787–.805倍。是朝向再分配，不是所有方向加粗。它不是实际轮廓mask、不是beauty得分，也不证明照片真实。
- 既有`leaf-centroid-check` **7/7**、`vegetation-motion-check` **19/19**、`leaf-optics-check` **14/14**继续通过。这些CPU结果不能代替新姿态的真实GPU负色/NaN/风/影图验收。

## 资源和验证边界

候选只额外保留position/normal/tangent共**20,239,680 bytes（约19.30 MiB）CPU数组**；其余attribute和index共享。默认legacy时候选未必已上传；两模式都渲染后，预期另有相同数量级的GPU buffer及少量几何/VAO管理开销，不把CPU统计冒称实际显存读数。临时section数字记录的payload约2,742,256 bytes（V8实际容量/对象管理可能更高），完成后释放引用。Node单次候选buffer/法线/tangent构建约179–198 ms，frame表准备约1.5 ms，后者**不包括所有小叶逐项旋转运算**；完整constructor观测另存JSON且注明冷/热顺序差异，不能拿它当帧率或严谨启动增量。

`palm-frame-coverage-gpu-check.js`导出`runPalmFrameCoverageCheck(THREE,renderer,grove,options)`供root调用。它对两个共享几何在12个固定相机位置，以同一unlit双面材质、静态rest pose和相同MSAA绘制RGBA8，记录实际遮挡后的alpha覆盖/直方图；不改生产材质，返回前恢复模式与renderer状态。它仅做覆盖诊断，几何变动预期使coverage不同，不能把“面积更大”自动判为更真实。主场景同相位A/B、低/中/俯视旋转、实际风运动、SSS、镜像负色/NaN、影图和GPU时间仍由root完成。

本轮不给默认切换或照片级结论。更多可见面会增加实际overdraw，CPU/顶点结构不增不意味着免费；若实际形态收益不足或出现数值/动态/预算回归，保留legacy。
