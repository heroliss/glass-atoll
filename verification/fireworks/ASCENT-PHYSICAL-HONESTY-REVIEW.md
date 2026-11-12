# 上升火光：独立说明审查

本轮只读审查当前默认源码及`ASCENT-EMISSION-IMPLEMENTATION.md`，未改运行时、音频或`package.json`。

**可向用户这样解释：**普通筒射礼花靠出筒时的发射冲量升空；上升尾火可以是随弹体燃烧的装饰“昇り曲”，看到它不表示发动机仍在推动。[磯谷煙火店的“曲導”说明](https://uchiage-hanabi.com/library/lead/)中，“銀竜”可以从出筒燃到主弹开花。这里实现的是作者设定的点燃—渐灭亮度曲线，弹道与爆点未因此改变，尚未模拟真实燃料或火焰。

厂商来源支持这种装饰类别存在，不支持把它推广成所有礼花的统一燃烧规律。当前`.12s`淡入、`.40s`渐灭是作者参数；“到开花时结束头部发光”是本场景的策略，不是厂家测得的通用燃尽时刻，也不意味着所有尾迹同时消失。既有余烬支持仍为willow`.88s`、palm`.62s`、其他carrier`.50s`；颜色、火焰结构、温度及真实物质燃尽并未由这个标量包络求解。

当前说明明确`kind='rocket'`为旧命名的ballistic carrier，并将engine/fuel/yield保留为未建立或unknown；未发现持续推力、真实燃料守恒或完整燃烧模拟的错误宣传。[DOE的概述](https://www.energy.gov/articles/5-facts-about-fireworks)也区分筒中发射与上升期间的延时引信；真正动力火箭应另设模型，不能从装饰亮度反推推力。

## 语法检查覆盖与冻结

`package.json`当前`check`包含57个`node --check`命令，但遗漏已进入主色彩路径的`display-transform.js`和`aces2-output.js`。建议添加这两项；本轮单独执行二者`node --check`均exit0。这只补语法覆盖，不替代controller policy、官方函数GPU误差、HDR桥和真实显示验收。本轮仅报告，不修改脚本。

烟花音频锁定文件为`fireworks-audio.js`，现场重算SHA256仍为`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`。`audio.js`是另一份环境音模块，不能把两者的hash混写。

本审查没有主观试听、浏览器录影或新GPU接受结论；新包络的真实画面与HDR共存仍以主代理的本轮记录为准。
