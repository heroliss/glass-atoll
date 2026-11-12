# 独立深度快照：MSAA 实际 GPU 验证

## 实际集成问题与窄修

原 `depth-copy.js` 只接受 `samples=0`，而生产水反射默认请求 MSAA2、画质档还可请求 MSAA4。因此反射回调更新独立烟雾深度时会直接抛异常；此前单采样 **10/10** 不能证明实景这条链正常。

当前实现保留水反射 MSAA。通过 `renderer.setRenderTarget(source)` 取得真实 DRAW framebuffer，执行同尺寸 `NEAREST`、仅 `DEPTH_BUFFER_BIT` 的 blit/resolve，写入匹配尺寸、depth type/format/internalFormat/stencil 的独立单采样目标。没有把附着中的深度纹理当 sampler，也没有重建深度或替换相机 near/far。READ 与 DRAW 的实际绑定及 Three 缓存、公共/物理 viewport、scissor 均恢复。

WebGL2 对多采样到单采样的 blit、同尺寸以及深度存储格式匹配有明确要求：[WebGL2 规范](https://registry.khronos.org/webgl/specs/latest/2.0/)。此方案沿用本地 Three 的实际 FBO 选择；不以 `source.samples` 猜测当前绑定。

## 实际报告与覆盖

`depth-copy-msaa-gpu-trace.json`：**40/40 通过**。这是主代理在真实 renderer 上执行的独立夹具，非 Node 模拟，也不是全场景烟雾/帧率验收。

| requested / actual samples | 透视副本最大误差 | oblique 副本最大误差 | 原目标继续绘制 |
| --- | ---: | ---: | --- |
| 0 / 0 | 0 | 0 | 通过 |
| 2 / 2 | 0 | 0 | 通过 |
| 4 / 4 | 0 | 0 | 通过 |

六个案例各检查六项：实际 FBO 完整/sample 数；真实 opaque plane/sky 的解析几何见证；READ/DRAW 与公共/物理矩形恢复；独立匹配存储的深度副本；源颜色/源深度/目标颜色均不被 copy 改动；继续在原 MSAA 目标绘制采样独立深度、`depthWrite=false` 的有限效果，遮挡和深度保持正确。另四项检查 resize、缺失深度拒绝、GL 错误和外层状态恢复。

实际环境 `MAX_SAMPLES=8`、DPR1，`WEBGL_multisampled_render_to_texture` 不可用；因此 MSAA2/4 验证的是普通 multisample renderbuffer FBO 路径。代码在扩展存在时会另测 renderer-native 和强制普通路径，但本次不声称该扩展路径已在 GPU 通过。当前夹具使用生产同类 RGBA16F 色目标与 unsigned-int D24 深度，没有穷举其他深度/模板格式。

## oblique oracle 的修正范围

首轮 `depth-copy-msaa-gpu-first.json` **36/40** 保留：三个 oblique 的 pixel-center 等值见证失败，末尾还有一个聚合 GL `1282`。六个案例的源深度与副本逐像素误差、源/目标色深保持、原 MSAA 继续绘制及状态恢复当时已全部通过。

对于斜面，多采样 resolve 的深度可对应像素内某个 sample，不能要求等于像素中心。当前 oracle 对每个纯内部像素，确认四角均与真实 opaque plane 相交；投影平面的深度在 screen XY 上仿射，因此任意像素内 sample 深度必在四角深度的 min/max 范围内。区间外数值容差仍为原 **2e-6**，副本比较仍为原 **1e-7**，没有通过放大常数使旧见证过关。

| oblique samples | 保留的 pixel-center 最大残差 | 像素角点深度区间最大宽度 | 区间外最大偏差 |
| --- | ---: | ---: | ---: |
| 0 | 6.5645360e-6 | 0.0043301270 | 0 |
| 2 | 0.0002441564 | 0.0043301270 | 0 |
| 4 | 0.0007882795 | 0.0043301270 | 0 |

透视平行平面的区间宽度为零，区间外误差最大 `3.3546333e-8`。oblique inverse 已在修改投影矩阵后显式重算，不是旧逆矩阵。单采样的中心残差仍原样记录；本报告没有独立证明它来自哪种 raster/subpixel 精度行为，也不把“落在像素区间”冒充“严格中心精度已解释”。源→副本误差为零说明该残差并非本次 copy 引入。

## GL 1282 的真实结论

v4 在 fixture 前单独读取 `entryErrors`，并临时包装关键原生 GL 操作，将错误记录到具体 case/phase/调用参数；包装在 `finally` 恢复。本次 **entryErrors=[]、operationErrors=[]、instrumentationFailures=[]**，含实际 21 次 blit、54 次 readPixels、66 次 drawElements、236 次 bindFramebuffer。

所以旧聚合 `1282` **本次未复现，归属没有确定**。不能声称它一定来自预存错误、深度 blit、读回或某个已修复 driver/cache 问题。v4 的 oracle/错误观测变化并未修改生产 copy 源码，失败首报仍是历史证据；本次只证明在这套明确观测条件下未出现 GL 错误。

## 冻结

- `depth-copy.js`：`df73dd00d2fc5a99ae1376c2adc9eb627d3766b0e3c1216aeb81e0d3b268a622`
- `depth-copy-gpu-check.js`：`72cd8d70ecb5c45273ddec086b834525fe0d38577b8690855cddb6993c140aff`
- 入口：`runDepthCopyGPUCheck(THREE, renderer)`；调用方先暂停主循环，动态导入 helper 时避免旧 ESM 缓存。
- 生产 smoke 主/反射、热/冷源、暂停缓存与重载后的实景构图，仍由主代理另行验收；此处不声称用户视觉或 FPS 已通过。
