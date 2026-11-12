# R31 渲染后端与优化边界

当前本地代码使用 Three.js r180 的 `WebGLRenderer`（`main.js`），主场景、自定义水面、体积介质及大多数后处理均走 WebGL 2。`hdr-output.js` 的 WebGPU 外部图像复制只承担 HDR 呈现桥，不代表主场景已经使用 `WebGPURenderer`。

WebGL 着色器本来就在 GPU 上执行。把 CPU 的光路透射查询迁到 GPU 可以省掉 CPU 循环，但不会消除烟尘的屏幕覆盖、透明叠加、反射重绘、纹理带宽和 GPU 运算。R31 单次分段计时中 photometry 约1.52ms，water 约53.45ms，lens 约82.64ms；后两组包含各自的场景与后处理，不能进一步指认其中某一个 shader 独占耗时。三段合计137.61ms 超过检查上限，保留失败，不声称为稳态帧率。

继续优化现有路径的理由是实测及迁移范围。官方指南明确：`ShaderMaterial`、`RawShaderMaterial`、`onBeforeCompile` 自定义与 `EffectComposer` 需要迁移到 node materials / TSL 及新后处理栈；不是替换构造函数即可。WebGPU 是后续可评估的计算与渲染方案，不能预先保证该场景更快，也不存在对所有场景都最好的引擎。

已核对的官方来源（2026-10-30）：

- [Three.js WebGPURenderer 迁移指南](https://threejs.org/manual/pages/webgpurenderer)
- [WebGPURenderer API 与后端回退](https://threejs.org/docs/pages/WebGPURenderer.html)

本轮只合入关闭太阳阴影时的提前返回，未迁移渲染器、降低画质或调整烟量。后续以实际同场景基准决定改动，保留当前可回退实现。
