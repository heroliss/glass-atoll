# 旧断言分类与合同修正

原测试和失败报告四件保存在 before/。`intensity-preexisting-proof.mjs/json` 将归档 fireworks-physics（033d676b…）原字节临时放在原依赖图旁，逐字运行原单个 case，并与当前3dfb3221…比较；没有改写原断言、import 或模型。两者都因默认4个 immediate slots得到 `[1,16,64,4]`，旧预期是 `[1,16]`。这是旧 queue 假设的同型失败，非该新改动的独有回归；临时文件已删除。

按 root 明确授权，此 case 现显式指定 `{launchPolicy:'legacy-queue',maxActive:2}`，使其确实验证名称中的排队合同；原强度不变、显式64与隐式后续0的断言保持。原测试17/17通过，未修改生产物理来迎合测试。

controls-quality 原反射采样断言将 medium 当作开启多重采样，但当前 medium 请求0。现用 high验证独立反射采样交集，并另断言 medium显式0保留。旧固定10机位计数改为命名核心机位集合、fireworks-close存在以及无重复；十种普通烟花约束保持。22/22通过。

这些均为CPU数据/实际factory和静态HTML合同，没有浏览器、GPU、真实显示、FPS或最终照片级视觉结论。
