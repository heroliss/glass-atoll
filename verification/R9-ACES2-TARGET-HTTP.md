# R9 本地ACES2目标POST接线

状态：已接`server.mjs`，仅实际HTTP/CPU验证；本轮**未重启5186**，未改main/controller/ACES输出模块、后端服务或pinned资产。主代理统一重启后入口才会出现在现有网页。

```js
const response=await fetch('/api/aces2-target',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({peakNits:1200})
});
const packageInfo=await response.json();
```

成功200直接返回原`packageInfo`字段，另加`status:'cpu-ready'`与`service`只读队列信息；不是`{ok,target}`包裹。顶层含peakNits、assetBaseURL、descriptorURL、descriptor及hash、963fixtures、`actualGPU:false / gpuAdmission:'required' / productionIntegrated:false`。**CPU-ready不得视为GPU或HDR显示生效**。

## 请求与失败语义

只接受POST。Host限127.0.0.1/localhost/[::1]且peer是loopback；必须显式Origin精确匹配`http://Host`（浏览器同源POST；CLI须自行带Origin），拒缺失/null/跨端口/跨协议/cross-site，不发CORS放行头。只接受application/json，允许charset=utf-8，不接受其他编码或URL query。

实际实体最多64字节，既检查Content-Length又累计chunk字节；收body超时2秒。严格UTF-8 JSON，唯一literal键peakNits，数值必须为100..10000整数；拒重复键、额外字段、字符串、任意路径/命令。合法JSON数字1200.0/1.2e3若恰为整数可接受。无请求内容可传成CLI选项。

错误均为no-store/nosniff JSON：method405/AllowPOST，origin403，类型415，过大413，body超时408，输入400。QUEUE_FULL429、CACHE_FULL409、SERVICE_BUSY503；完整性失败409；运行时/导出不可用503；未知内部错误500。后端message/stack/本机路径不会直出，连未知`constructor`/`__proto__` code也按own-key白名单落通用500。429/503带Retry-After2。

Node工厂`createAtollServer({ensureTarget,getTargetState})`可注入函数用于CPU协议；HTTP请求不能选择这些函数。完成body后客户端断开，不取消共享后端Promise、不杀生成或删包；只略过向已断开的response写入。未完成body的断开不会创建任务，错误/timeout会清理body监听与timer并安全drain。

## 实际证据

- [r9-aces2-target-http-check.json](r9-aces2-target-http-check.json)：**73/73**，真实临时loopback端口14265/9238。覆盖Origin/Host/方法/内容类型、UTF8、重复键/额外输入、exact64与chunked65、超时/abort、固定错误映射、不泄露内部文本、断开不杀共享job。后端错误/断开采用明确注入fixture；429映射不是实际新导出风暴，后端有界队列另有23/23 CPU/VM报告。
- 其中真实后端1200并行HTTP请求返回同一in-flight Promise，CPU14/14、963fixtures，`cache.reused:true`且generatedCount0。返回descriptor URL经同一临时server实际GET，bytes/hash相符（`570c3d5f…`）。没有新GPU目标、浏览器/面板测光或native桥通过声明。
- [r9-server-media-range-check.json](r9-server-media-range-check.json)：**30/30**，临时端口9242。实际MP4/WebM full/range/suffix/HEAD/416/IfRange等、磁盘byte oracle及HDR探测路由拒绝行为都保留。原HDR probe、route、path guard、listen源码块与本轮封存源码hash相同。
- 原server封存为[基线](baselines/r9-server-before-aces2-route.mjs)，SHA256 `9cefdc0c785496f9ada069a00fa9128aaa024b7181c8dcc4a289aa8fb30d243f`。后端服务仍`0d769e87…`，本轮未改。

首份R9媒体报告[29/30](r9-server-media-range-check-first.json)原样保留：复用旧test时误取了现已是媒体header记录的`server-media-before.json`，它没有`parts`字段，因而源封存门抛TypeError。仅R9 clone改为读取本轮真实server基线并比较原四段字节，30个门未删/放宽；旧媒体源码/旧报告没有被覆盖。

复跑：`node verification/r9-aces2-target-http-check.mjs`及`node verification/r9-server-media-range-check.mjs`。两者独立起临时端口、退出关闭listener；媒体临时目录经workspace路径验证后清除。本轮不触当前5186服务，不以HTTP成功代替新峰值963 GPU准入、F16或HDR实际呈现。
