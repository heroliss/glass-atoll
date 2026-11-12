# 最终控制、默认值与 README 一致性复核

2026-10-27。复核main/ui/index/quality-presets/HDR控制与README，不占用浏览器。初始只读审查后，root明确授权仅在ui.js修三处最小问题；main、README和其他运行时未由此审查改动。

## 已修复的实质问题

1. **摄影开关带入时间/模式**：night-exposure事件原发送完整state.night，包含date；main见date就设astronomical。自由太阳模式下改自动曝光因此可能改钟/换回天文太阳。现callback仅发送`{autoExposure}`，不带date。
2. **联动地灯被完整快照取消**：UI联动是编辑偏好，renderer的完整灯状态含默认linked=false。每次滑杆input回传第一灯后，syncLamps会取消联动，导致后续input只改单灯。现完整lamps快照保留UI联动；显式编辑补丁`{linked:false}`仍可主动取消。
3. **HDR自动回退被说成手动选择**：旧status在auto缺原生校准时写“已选择SDR”。现自动模式明确浏览器能力、显示环境、系统亮度不足或系统显示条件的回退原因；显式SDR才说已选择。强制HDR失败保留错误并说未开启。

ui.js最终SHA256：`5411d5524bfea1ec56c333807f09d9a83ea6858fa23eb3339bb75a6375df13dd`。未触及root已有reset/pause标签改动。

[controls-isolation-check.json](controls-isolation-check.json) **5/5**，运行`node verification/controls-isolation-check.mjs`。检查执行原UI事件注册和同步方法源码，并提供小依赖缝；不是另写一份镜像逻辑。它不验证DOM排版或真实浏览器事件，后者由root统一reload后完成。

## 默认值/接口核对结果

- DEFAULT_QUALITY=medium，index与UI相同，main初始化最终执行applyQualityPreset。旧parameters.quality='high'只是内部兼容分支，不等于用户默认第五档。
- 中档请求4096阴影、512海谱、8×合法MSAA；摄影28mm/f8/DOF关，声音关、自动内部像素缩放关，与README一致。HDR为auto，具备浏览器API/显示信号且native校准/系统状态满足才自动启用。
- 八固定机位及sun/moon、时间/地点/UTC时差、五时间与四天气入口、灯/手电、十烟花及后续停止、自动构图取消均有main handler；缺handler保护没有在当前main误禁用这些入口。时段预设主路径不改天气或相机，也不覆盖autoExposure偏好。
- README全部本地链接当前存在。旧性能/旧报告有顶部历史声明；没有把30fps录屏当场景FPS，也保留移动设备模拟和未主观试听边界。

## 已交 root 的剩余一致性问题

以下是审查时的源状态，root负责收尾；不把它们当未修复就擅自解冻运行时。

- **自定义画质effective读数**：主流程手动shadow/wave改变实际资源后，markCustomQuality仍把原parameters.renderSampling作为effective；footer可能仍显示4096/512，而高级项已为8192/1024。建议从实际资源读取或同步独立有效值，不能把旧请求当实际。root已接管main修复。
- README“新增光照不占水shader采样器”应明确只指太阳SH漫反射缓存；新增手电实际使用uLocalShadowMap，不能涵盖所有新局部照明。
- README“支持8×时使用固定8×”须限定**所选档请求8×**；低/较低档分别请求2×/4×，不能泛指所有档。
- README仍将旧NAVIGATION-NIGHT报告叫“本轮验收”，与顶部历史提醒不一致。交付应改为新playground验收入口，并明确历史记录。

本复核未发现上述之外必须新增功能才能交付的阻塞项；它也不是主观画面/音色、所有机位或全部浏览器的通过声明。
