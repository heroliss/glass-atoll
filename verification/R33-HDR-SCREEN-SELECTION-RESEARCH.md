# R33 当前网页所在显示器：只读几何选择候选

原始证据为 `r33-hdr-selection-readonly-diagnostic.json`，不是本候选新增的浏览器采样。两台显示器都叫Q27G4XM；右侧DISPLAY5报告700nit且是探测时前台屏，左侧DISPLAY6报告1270nit。网页的屏幕原点为(-2560,0)，窗口为(-2552,8,2544,1424)，DPR1，完整落在左屏。现有 `applyDisplaySettings` 没传网页几何，因而选用了右屏的前台观察。这解释了此次700/1270切换，不能把它称为面板峰值随意变化或已实测亮度。

## 一手规范与限制

CSSOM View把相关坐标定义为CSS像素；`screenX/Y`、外窗尺寸与屏幕暴露信息属于同一类网页观察，浏览器可以为隐私隐藏/替换屏幕信息。`devicePixelRatio`计算包含页面缩放；视觉视口缩放是另一种机制。因此不能把DPR当成独立的Windows缩放因子来乘回坐标。[CSSOM View](https://www.w3.org/TR/cssom-view/#web-exposed-screen-information), [DPR定义](https://www.w3.org/TR/cssom-view/#dom-window-devicepixelratio).

Window Management区分完整屏幕位置与可用工作区位置；负坐标合法，虚拟原点由实现决定。当前屏幕由系统/浏览器确定，跨屏时可按窗口交集决定；这些规则不证明任意网页观察与原生坐标都可直接转换。详细屏幕接口涉及权限，本候选不调用它，也不请求新权限。[Window Management屏幕模型](https://www.w3.org/TR/window-management/#screen-position), [当前屏幕](https://www.w3.org/TR/window-management/#current-screen), [Chrome权限说明](https://developer.chrome.com/docs/capabilities/web-apis/window-management#the_getscreendetails_method).

DXGI的桌面边界受桌面DPI影响；同一接口的峰值亮度来自EDID/驱动或覆盖配置，局部峰值与全屏峰值是不同字段。相同友好名称不是显示器身份；本候选继续使用原生deviceName，不按名称或最大nit排序。[DXGI_OUTPUT_DESC1](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_6/ns-dxgi1_6-dxgi_output_desc1).

没有充分的一手坐标转换证据能支持“把每台混合DPI显示器的全局原点分别除以它的scaleFactor”。即使所有比例相等但不为1，本轮也不臆造该换算。它们在多屏自动模式下明确返回不可靠/ambiguous，而非回到前台屏。

## 已实现的纯候选

新 `r33-hdr-screen-selection-candidate.js` 仅包装既有 `resolveHDRCalibration`：

- `validateHDRScreenObservation(report,{screen,window})` 返回冻结的可靠性、理由、原生deviceName及独立几何副本。
- `resolveObservedHDRCalibration(report,options,observation)` 返回原有校准结构及 `observationSelection`。options只接受原生deviceName、数值peakNits/paperWhiteNits；不能传入人为screenReliable标志。

自动几何准入**仅限当前硬件家族**：所有连接屏的原生scaleFactor严格为1，浏览器DPR严格为1，观察到的视觉视口缩放若存在也必须为1；有限整数边界；唯一完整尺寸/原点匹配；原生屏幕不重叠；完整窗口必须包含在同一匹配屏内。没有坐标零值默认、3像素猜测或按最大交集的阈值。跨屏、离屏/最大化不可见边框超界、工作区偏移无法证明完整原点、单边隐私零原点和缺失信息均保守拒绝。若有完整left/top，可另行验证可用工作区位于屏幕内。

匹配成功后才向既有解析器提供可靠几何；失败时关闭foreground fallback。明确deviceName选择仍优先，失配仍为unmatched；已有单屏和数值手动亮度行为保留。不会把用户auto设置改写为固定DISPLAY6。实现不读浏览器全局、不访问原生服务、不改变OS/UI/渲染设置，也没有GPU操作。

此策略是对可信实际观察的相互核对，不是反伪造认证。若调用方连同窗口和屏幕信息一起伪造成完全自洽的另一屏，纯几何函数无法识别。后续接入应由受信任代码直接复制当前Window/Screen的封闭字段，在取得原生报告后及时采样并在应用前复核；不要把任意调用方字典称为实际当前屏。过期或不确定观察应保留明确未验证状态，不能偷偷使用另一屏的前台值。

## CPU结果与后续边界

`r33-hdr-screen-selection-candidate-check.json` **9/9通过**：重现已保存左屏1270选择、忽略前台/同名干扰、跟随真实右屏几何、保留明确选择/手动nit，拒绝缩放/跨屏/错误原点/重复屏幕/非法描述符，getter执行次数0；输入只读。没有修改 `hdr-output.js`、`main.js`、原生脚本、UI或R32封存证据。

这些是当前单位缩放硬件的纯逻辑证据，不是一般多屏/混合DPI支持、实时选屏完成、HDR画面正确或亮度测量。生产接入、当前页面实测匹配以及移屏后的重新选择仍由根代理在后续目标轮次独立验证。
