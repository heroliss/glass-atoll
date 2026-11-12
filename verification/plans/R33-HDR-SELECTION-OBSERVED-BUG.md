# R33：已复现的自动HDR选屏问题

R32封存之后，根代理只读核对了峰值由1270变700的原因，没有改设置或提交新GPU绘制。原始数据在 `../r33-hdr-selection-readonly-diagnostic.json`，另一次原生输出观测为 `../r33-hdr-display-observation.json`。

- Windows同时报告两块同名Q27G4XM输出：DISPLAY5在[0,0,2560,1440]，700nit，探测时foreground=true；DISPLAY6在[-2560,0,0,1440]，1270nit，foreground=false。两者scaleFactor=1、HDR均开启、SDR白280nit。
- 当前网页的screen为2560×1440、availLeft=-2560、availTop=0；window.screenX=-2552、screenY=8、outerWidth2544、outerHeight1424、devicePixelRatio1，几何对应DISPLAY6。
- `main.js:applyDisplaySettings`只传显式deviceName或空选项给 `resolveHDRCalibration`，没有传浏览器屏幕观测。现有默认选择因此跟随Windows前台窗口，得到DISPLAY5/700nit；当前实际HDR状态也是700nit。
- 以同一份原生报告调用既有解析器并明确传入这份screen几何及screenReliable=true，仅作为只读诊断，得到DISPLAY6/1270nit。没有调用配置函数，没有改Windows或网页选择，也没有实现普遍可靠性政策。

下一步优先修复自动模式的当前浏览器屏幕匹配：对几何唯一且坐标/缩放可信的观测使用现有screen匹配；保留用户明确选择；对缩放/缩放页面/坐标原点和镜像等歧义给出明确状态，不能盲目把screenReliable恒设为true，也不能把另一个前台窗口当浏览器位置的证明。先查阅主规范并做纯CPU边界验证，再接线并在这两个实际输出上只读复核。无需为只读当前屏信息新建权限流程。

此问题不影响R32私有线性水面两材质之间的同输入像素对照，但其结果不能当成HDR显示已正确校准的证明。R32证据、生产水面和已认可音效均未因本诊断而修改。
