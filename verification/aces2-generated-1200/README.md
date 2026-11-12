# 1200nit 单目标离线资源（未GPU准入）

OpenColorIO2.6.0 / NumPy2.3.4，项目独立venv；运行时未引用。official与accurate-atan候选分别由export-report.json及candidate-export-report.json描述。后者是明确非官方数值替换，不是官方认证；两者共用963组显式Float32输入、官方CPU期望及两张363×1原表。

输入已施曝光的linear709/D65；输出display-linear709数值1=100nit。HDR浏览器线性值为输出×100/browserSDRWhiteNits，再一次extended-sRGB OETF。不能再加C/P、旧ACES、纸白乘数或80nit因子。目标peak已写进代码及表，不是独立uniform。

表上传RGBA32F/NEAREST/CLAMP_TO_EDGE，无mip、NoColorSpace、flipY=false；shader采样器highp。CPU报告保留裸FF/域限制前后，不以最终clamp冒充原结果。实际nits不是光度计测量。

生成命令（项目根）：

    .\.tools\aces2-oracle\Scripts\python.exe tools/export-aces2-target.py --peak 1200 --out verification/aces2-generated-1200

重现/校验现包（不覆盖）：同命令追加 --verify。默认拒绝覆盖；仅允许指定项目缓存/vendor-generated子树或精确QA目录。ARTIFACTS.json封存所有其他文件的实际bytes/SHA256；自身hash由CLI stdout给出。输出不含生成时间，重复生成应逐字节一致。

原423 GPU helper只接100/700/1270，不能直接传1200而声称已跑通。下轮应使用显式支持该单目标的新probe、保留原门与原报告；先RGBA32F oracle，再F16/桥/实际场景/成本。工程门2e-5+2e-4 relative与官方abs2e-5 diagnostic分开；本CPU通过不代替任何GPU或观感结果。
