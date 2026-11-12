# 单峰值 ACES2 离线生成 CLI

已生成独立1200nit候选包；**尚未GPU准入，生产未引用**。没有修改lens/main/HDR/UI、服务器或原官方46件资产；实际原目录含其seal共47文件，运行前后逐文件SHA相同。

项目根运行，必须使用已有项目venv，不自动安装依赖：

```powershell
& '.tools/aces2-oracle/Scripts/python.exe' tools/export-aces2-target.py --peak 1200 --out verification/aces2-generated-1200 --verify
& '.tools/aces2-oracle/Scripts/python.exe' verification/aces2-single-target-cli-check.py
```

生成新目标时去掉`--verify`并使用新目录。默认拒绝覆盖；`--verify`在受控临时目录完整重建，与现包每文件/每字节比较后清理临时目录，不改现包。peak只接受100..10000整数。输出仅允许`.cache/aces2-targets/`、`vendor/aces2-generated/`子目录，或精确的`verification/aces2-generated-<peak>`；相对项目根解析，不取决于调用cwd。原oracle、项目根、越界路径与错配QA目标均拒绝。

CLI只执行固定SHA旧exporter中的已选函数定义，不import其会重写三目标的顶层export循环。OCIO2.6.0与NumPy2.3.4及已冻结实际profile输入/atan数学源均校验版本/哈希；不从全局Python或动态上游取代码。

1200包为19文件、1,928,001B（含seal），有：

- `export-report.json`：官方原函数/两表资源元数据。
- `candidate-export-report.json`：明确nonOfficial accurate-atan候选，唯一调用替换可严格逆回官方；不是官方认证。
- 两份函数/独立probe、两张363×1原始及RGBA32F表、许可和来源。
- 963组显式Float32 CPU oracle与64×16 GPU输入/期望。保留裸FF、域限制前后与输出限制前结果；不以最终clamp掩盖原始值。18%灰目标输出约14.8468nit。

实际CPU/资源门 **14/14**；CLI定向门 **17/17**，见`aces2-single-target-cli-check.json`。1200整包再次生成逐字节相同；700回导的官方函数/probe、两表、输入/期望、atan函数/probe与原冻结资产逐字节相同，963组10个CPU阶段/单位字段也完全相同。拒绝覆盖/参数/路径门通过。

冻结SHA256：

| 项目 | SHA256 |
| --- | --- |
| `tools/export-aces2-target.py` | `4f4d6331e0bd280558259bbdce15d27bc3c9bbf3f5f97dd96d86cca5c9de75ea` |
| 1200 `ARTIFACTS.json` | `f436bd50f785f89a786f943bba1378e3bed133b175f3aae1fb130104aa9fc92d` |
| 1200 official function | `811ec1020fd531b9e52b46fbf4ddfa96cb3b5dbdd8a77208a27955f89b79a870` |
| 1200 atan candidate | `f7dfc6cd06eb2f6399d588df6dc6d4fd975a5a44d3ff53f8eaec349e02ef0e38` |
| 1200 CPU oracle | `bf130fb6d5c8b9be100fb6e1bf998b4fa9d055c7aac5e9dcf3013d664ba12667` |

表为Float32/NEAREST/clamp/no mip/highp sampler；输出数值1=100nit，browser单位转换/OETF仍独立。old GPU423只接100/700/1270，不能直接传1200便称通过；下一步需要另一个显式支持单目标的GPU probe，保持原oracle/门/旧报告。此处没有GPU、显示桥、全尺寸成本或视觉通过结论。
