# R38 taps-only writer 实现回执

生产改动仅 `firework-layer-profile.js` 尾部追加 `writeProfileBodyEmissionBins(body,{fromAge,toAge,bins=8,outRGB})`。旧文件完整的 16,634 字节是新文件的原样前缀，保留原 LF；新追加 2,331 字节。去掉这段已固定的追加文本即可逐字节恢复原件。原公开 summary sampler、profile 编译、点采样/CDF、材料及所有其他旧代码未改。

新入口要求 `Float64Array` 或 `Float32Array` 且长度至少 24，并返回同一个借用数组。前 24 项按原 bin/overlap/逐通道补偿积分/除法顺序直接存储，后缀不碰。它只不建立旧调用者丢弃的 average、integral 数组和 summary 对象，也不做 totals 的额外累计。没有共享池、跨行复用、前缀差积分、逆数近似或采样数减少。

`verification/r38-taps-writer-check.json`：**7/7**，54,565 组 typed window 对照、1,582,385 项 `Object.is`，包括实际 seed341070 的 192 roots×0/1/64 倍、头/尾窗口、knots、熄灭、非零/极大延迟、零和极窄窗口、F32/F64、偏移 view 和前后哨兵。15 个所选窗口拒绝的类型、消息及已写/未写 buffer 全字节相同。`2**42` 到 `2**42+5*2**-10` 的病例保留先写 3 项、再抛 RangeError 的既有行为，未改为预先全窗拒绝。旧公开完整 summary 对另外装入的归档模块仍 deep-exact，并保持属性顺序。缺少 outRGB 的显式新入口拒绝是新增 API 合同；旧 API 仍会自行分配。

独立 peer 的窄门 `r38-taps-writer-independent-check.json` **5/5**：408 个合法输出全 buffer 逐字节一致、offset/prefix/suffix、11 个共同非法输入、上述部分写入病例，以及完整原文件前缀证明；不是 owner 大套件的重复运行。

有限 warmed Node 微对照使用实际 1×曲线的 5,056 个合资格头/尾窗口，每批重复 4 次、每臂预热 2 批、ABBA×4（各 8 批），两臂都丢弃 summary 返回，仅消费相同的 24 项输出。summary 中位数约 **837ns/窗**，新 writer 约 **676ns/窗**，比值 **0.808**。测试进程约 0.58 秒。这只证明该进程内隔离调用差异，**不能宣称浏览器、8.33ms 首次光学构建段、GPU 或整帧 FPS 的收益**。先前更宽的 5,184 窗版本仍通过但包含未出生尾部窗口，已保留为 `*-before-benchmark-record-eligibility.*`，正式微对照已排除这 128 个不存在的当前记录窗口。

插入脚本首次错误假设原文件为 CRLF，断言在生产写入之前中止；旧脚本和 refusal 回执保留。修正采用实际 LF 后完成上述唯一追加。生产源最终 SHA256：

`411ebd75fec379582e5d94086e40241d9f8c388c3c96a668bbbbb5af5d948715`

接口已交给 FW 调用方 owner，仅用于两处完整空气支持快路。部分接触仍走原公开 sampler；FW 自身的 mode/cache 选择由该 owner 独立审查。此回执没有浏览器、GL/GPU、像素比较、运行时性能或正式推广结论。
