# 新复杂烟花的连续渐暗

只改 `complex-fireworks-style.js`，SHA `be7e4799281b5b5590d0b3d00636d7bd293e92e573e2d9aaab5c0c87b33b816e`；原件 `before/complex-fireworks-style.js` SHA `23921400961a7594472dcec74e058615c085ecf9df4804b9cbabbc2ea3930a41`。

默认包络短attack达1，随后依次在有效burn duration的18%/42%/68%/86%/95%处降至.82/.50/.24/.075/.012，life端为0。各段smoothstep单调且C1连接，点燃/峰值/熄灭端斜率为0；没有数值overshoot、没有延长life或增加I0。pulse乘子仍是原式，因此刻意闪烁保留，但底层burn逐渐减弱；尾迹使用同一个source/release age包络。

新字段 `envelopeInterpolation`：无显式knots默认`'smoothstep'`；显式knots默认`'linear'`，保护.18s主闪光。旧无字段的手工style仍按linear采样。使用`createComplexStyle({...style,...,envelopeKnots:scaledKnots})`缩放每body寿命时，保留spread中的此字段；不要丢失它。显式linear可选，但不允许未知插值名称。

CPU `complex-envelope-check.json` **6/6**：21条不同life/onset曲线、86,037个峰后采样单调有界；每段接点C1与终端剩余值；解析积分/数值积分；2008个显式flash时刻的原值/RGB/积分exact；pulse与tail释放时钟；缩放clone。默认5.2s曲线在旧最后.18s的起点从.42降至.00929，life前1e-6相对时间仅1.44e-11。默认积分是旧plateau曲线约56.6–59.4%，这是渐暗的光量减少，未通过额外亮度补偿隐藏。

首轮自设“旧最后fade起点低于原10%”门在短.5/1s曲线上失败，5/6报告和脚本保存在`before/complex-envelope-first-terminal-threshold.*`。实际短曲线约11.6%；最终使用已声明新knots导出的≤.075且低于旧20%观察门。生产曲线未为该测试改动；C1/单调/零端/显式flash保护门均未放宽。未运行GPU或浏览器，不宣称视觉验收。
