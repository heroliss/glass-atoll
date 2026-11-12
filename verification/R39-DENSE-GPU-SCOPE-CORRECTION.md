# R39：两眼数值任务的存储范围补充

历史只读计划 `plans/R39-DENSE-GPU-READONLY-PLAN.md`（7aad2d1c…db6d6）已纳入 R38 seal，保持原字节。本补充限定其12m假设分配的消费方式：每个 SourceT field 为4,706,304B，SH field为9,916,416B。

- 正常live若第一眼即时消费后再覆盖同一T field，单T+SH为14,622,720B。
- 独立三任务数值joint若在整段timer结束后才读取两眼输出，必须保留**两个独立T field**；2T+SH为19,329,024B。不能把被下一次prepare替换的借用纹理当作前眼结果。

以上均是原布局公式的数值buffer字节，不是已准入GPU/driver/整应用VRAM，也不包含私有fixture、offline references、readback、sentinels。精确配额仍待新的冻结fixture及root授权门。

曾误以为计划尚未封存而修改其中一个段落；改变后的copy保存在 `baselines/r39-plan-scope-edit-before-restoration/`，随后完整逆变恢复7aad原hash。未改生产或其他历史证据。
