# R36：持续光与长金尾独立版本

状态：批准有界实现和实际画面检查；不表示最终照片感验收。前一轮R35是已完成的具体进度，目标继续active，没有新阻塞。

新ID固定为`three-heart-radiant120-v1`。保留所有旧ID的输入、输出和限制。新版本先复用R35纯编译与120m自由飞行参考几何，再做明确的辐射变换。192根星、层分组、出生、运动、寿命、原RGB时程、材料预算和主爆音效不变。没有新增短爆闪、相机增益、夜间ambient或280m传播策略改动。

作者参考光度G=16，每根最终峰目标为`native body.intensity（已含用户倍率U）×G`。burnProfile RGB、emissionReferenceI0、全部光学/光照上界必须共用这个派生目标，只乘一次。物理body.intensity可保留native预算；所有unmodulated/allPhase诊断须明确使用哪个预算，不能用旧较小上界。最终referencePeakBudget报告派生预算，同时保存nativeReferencePeakBudget和gain/未实测声明。R35几何校准的旧预算属于校准输入，不能误叫新光度总预算。

新金尾配方：outer duration .88s / fraction .72，middle .66s / .56，inner .40s / .38。它把发光从头部分配给真实移动、逐步冷却的脱落余烬。继续使用现有归一有限尾迹核和8个延迟节点；对应时间积分在新参考源预算内闭合，不能把尾迹叠加成额外未声明的能量。最大.88s沿用既有native willow/field物理域，但向量profile、解析包围和接触路径必须各自显式准入。不能仅放宽旧.35s合同或只改shader。新schema/recipe与固定限制必须有版本边界。

纯尾迹研究显示外层在+.7/1.7/2.5秒，180m视距由约9/6/5像素增加到约71/60/43像素；这是CPU投影参考，未证明最终画面或性能。更长路径会提高自适应曲线采样成本，不能因源数量未增加就宣称无性能影响。

接线顺序：新纯规格与trail版本→层编译→physics admission/metadata/reference bounds→连续live/family包围与实际optics→main/UI。四个main bounds消费者继续使用实际快门。通用getScaledFireworkLiveEnvelope可支持显式new合同，但旧ID的recipe、D和19/76边界不变。新event endTime须覆盖尾迹实际可见期；烟家族、消光面积预算和音效事件不增不重触发。

验证先做精确旧行为对照、0×/用户gain-once、新总预算、全部receivers输入闭合、尾迹时间积分、角度/显式高度/有界风/接触/光学端点及完整源烟请求。之后普通现有gain16/短尾对照与新默认1×/长尾分别实景观察；绝对时间/海云相位不同的两枚不能冒称逐像素A/B。普通代表烟源和QA逐点排烟分别标注。

原生中档1209×1292、8×MSAA、同摄影设置优先看+.7/1.7/2.5秒宽景与近景，再分别确认HDR与SDR。记录实际非空主/镜光路、SH新鲜/缓存、P与camera EV、GL和恢复；无源neutral镜面不算CPUfallback。新的单帧性能门必须声明完整当前工作量和数值pass次数，保留4m/request、1m/map、8maps，不截烟/源、不中途盲跑多发压力。

初始真实亮度观察：现有R35 profile用户gain16仍像更亮的点，说明单改亮度不能修复菊形尾迹。这个G16是可追溯的作者候选，不来自实验火焰或某次爆闪的cd值，不宣称绝对光度标定。若画面仍差，继续改实际燃烧/辐射模型，不把本合同通过视为目标完成。
