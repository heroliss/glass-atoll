# 最后跨模块只读复查

2026-10-27（本地日期）。本轮没有修改运行时，也没有控制浏览器。审查当前`main.js`、`lens.js`、`water.js`、`local-lights.js`、`celestial-controller.js`、`night-sky.js`、`sky.js`及环境捕获接线；只记具体发现，不以源码审查替代root实际GPU验收。

## 一个可复现的强度接线错误

**手动太阳强度在水的天空ambient项中重复相乘。**

- `sky.js:543`的physicalSunStrength已含`intensityUniform.value`；`:554`的天空irradiance也已含该强度I，`:557`由它生成`skyTintPhysical`。
- `main.js:494`将`skyTintPhysical * 1.7 * 2^P`赋给水`uSkyColor`，此处已经包含I；`:491`却在artistic模式再把`uIntensity`设为同一个I。
- `water.js:151`的bedAmbient、`:176`的volume ambient和`:228`的foam sky lighting再乘`uIntensity`，使太阳主导的这些分项随I²变化。其它直射、陆地PMREM与天空主要随I变化。I=.5时这些水ambient太阳分项变.25；I=2时变4。不是说整个最终水像素都四倍，直射/反射等项仍有各自公式。
- 非太阳的月光/星光ambient也被这个额外I误乘；例如手动太阳I=0会将水的这些天空ambient分项清零，尽管月/星的天空radiance并未按太阳强度清零。
- 复现路径：切手动太阳模式，固定方向/天气/相机/摄影曝光，比较强度.5/1/2；分离bedAmbient或volumeAmbient可直接看到上述比率。astronomical模式`uIntensity=1`及默认手动I=1不受此错误影响。

建议由root删除这次重复增益（最小做法是令水`uIntensity`始终1，保留由skyTintPhysical提供的真实强度）。不能通过摄影曝光补偿，因为曝光会同时改变已经正确缩放的其它表面。此处为发现时的源码状态；后续修复/实际验证应另记。

## 实看画面的诚实边界

已用本地view_image查看`day-review-current.png`。树冠外轮廓仍过于细丝化，内侧重叠叶片像深色网，羽叶分布/冠体光照仍能看出程序生成；远云虽有体积，许多云底近乎齐平、长条层状，仍有简化体积场的外观。该图整体仍可辨CG，不能称已达到第一眼误认为实拍。这些是当前视觉限制，不是本轮发现的新数值回归；不因此重启树冠/云形设计。

本轮未发现其它有足够具体证据的新HDR/P/C重复乘、UTC驱动物理秒或暂停相机位置失效问题。并不等于证明所有状态/硬件/光照组合无bug；已完成的root实际范围检查、运动回归与显示验收仍各自限定其条件。
