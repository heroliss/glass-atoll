# ACES 2三像素CPU阶段诊断

[stage-report.json](stage-report.json)为新独立材料，**CPU导出/来源检查6/6**；没有修改原`aces2-oracle`资产、423版GPU helper或52/53失败记录，也没有运行浏览器。

三个输入：坏纯蓝`[0,0,13.850415229797363]`；冻结生产blue profile的level1；指定green literal `[0,Math.fround(18.28686),0]`。第三个是请求提供的诊断输入，不假称从原GPU失败样本提取。每个CPU调用使用显式Float32输入。

所有输出均为1270nit/709限制目标，末尾同一Range[0,12.7]，**线性RGB数值1=100nit**，没有曝光、浏览器白转换或OETF。

- `fullCPU`：原完整官方FF的单一processor终点，两组蓝色及prefix严格复现冻结旧CPU oracle。
- `splitCPU`：同样prefix/末尾Range，中间改为四个公开官方FF的单一GroupTransform。
- `stages`：将四个公开FF逐个`applyRGB`的结果。它们是公开拆分链的CPU结果，不能冒称完整CPU私有内部变量。
- `splitSerialCPU/fullSerialCPU`和对应delta：保留多次API调用造成的Float32边界差异。
- `inverseRGB`是拆分逆CAM后、末尾Range之前；`Jts`为`[toneJMh[0],0,0]`。Aab、inverseLMS、reach/cusp无同等公开stage API，明确null，仅可作GPU诊断。

公开链与参数：

1. `RGB_TO_JMH_20` forward，AP0八xy：`[.7347,.2653,0,1,.0001,-.077,.32168,.33767]`。
2. `TONESCALE_COMPRESS_20`，`[1270]`，包含tonescale与chroma compression。
3. `GAMUT_COMPRESS_20`，`[1270,.64,.33,.30,.60,.15,.06,.3127,.329]`。
4. `RGB_TO_JMH_20` inverse，709-D65八xy：`[.64,.33,.30,.60,.15,.06,.3127,.329]`。

JMh的h在这些公开API之间始终为**度数**，不是radian/turn。内部shader的三角函数转换由官方函数完成，CPU导出没有自行插入转换。

| 输入 | fullCPU红 | splitCPU红 | split−full红 |
| --- | ---: | ---: | ---: |
| 坏纯蓝Y1 | .0863139033 | .0863134861 | −4.17×10⁻⁷ |
| 实际blue profile Y1 | .5114984512 | .5114955902 | −2.86×10⁻⁶ |
| green literal | 3.9550304413 | 3.9550304413 | 0 |

完整CPU直接从Aab[0]进行tone，公开分离tone FF从JMh的J路线进入，确实不是逐步同一实现；但以上差值不足以单独解释已报告坏蓝GPU约−6.79×10⁻⁵的红偏差。也不能仅据这张表唯一排除它：还应看同原shader的GPU前向CAM、tone/gamut、逆CAM阶段和插桩对终点优化路径的影响。

原资产seal在查询前后逐项通过46个文件hash。环境复用项目内固定OCIO2.6.0/NumPy2.3.4，没有新依赖。复跑仅写本目录：

```powershell
& '.tools/aces2-oracle/Scripts/python.exe' verification/aces2-stage-oracle/export_stage.py
```

这份报告只提供诊断参考，不改变GPU误差门、不宣称官方shader已正确或HDR视觉已修复。
