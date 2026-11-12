# 烟尘默认4σ代理

`pyro-smoke-renderer.js` 默认代理由5σ改为4σ，显式 `supportSigma:5` 保留。renderer 与 host 均提供 `setSupportSigma(value)`，接受原有4..5范围；host构造也转发此选项。切换只更新代理半径，下一次draw重新投影。物理密度、质量、风、寿命、排烟时程、源透射和受光分布没有改变，shader没有修改。

原件保存在 `baselines/r43-before-smoke-support/`。CPU检查 `r43-smoke-support-check.mjs/json` **5/5**：保存的R39真实1663团、原native主/oblique镜相机，通过实际旧/新renderer factory和无GL的记录器检查。显式5σ在两种投影、两眼下与归档factory的全部有效属性、shader和结果相同；4→5恢复精确，非法设置不部分生效，host状态与scheduler/columns保持。没有物理重放、GPU执行或计时benchmark。

实际renderer含像素padding/取整的代理栅格上界：主眼 **1,462,292→991,136**，镜眼 **1,453,559→986,645**，约减少 **32.2%/32.1%**。全部1663实例保留，没有新增target/pass。该值是工作上界，不是GPU时间或整帧FPS收益；仅纯projector浮点面积会得到约33.7%，不能混作实际renderer计费。

代价是省略极淡Gaussian外缘。该快照两眼各自已有的总off-proxy光学深度保守界由约 `1.8324e-5` 增为 `1.6495e-3`；这不是全场像素/受光误差证书。4σ不减少P×光源数工作，也不减CPU首次烟花光学行构造；还需要root在当前实际场景测量效果。
