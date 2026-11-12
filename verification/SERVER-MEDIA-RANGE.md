# 本地影片 Range/seek 修复

原静态服务器对全部资源readFile后返回200，没有MP4/WebM类型、长度或字节范围响应；这与浏览器影片ready但seekable仅[0,0]、跳转后回0的现象一致。现在静态GET/HEAD使用文件stat长度与流式pipeline，MP4为video/mp4、WebM为video/webm，并声明Accept-Ranges:bytes。

单字节范围支持闭区间、开放末端、后缀及超长末端夹到EOF；合法请求206带精确Content-Range/Length，不能满足或无效bytes语法416带bytes */完整长度。大数字用BigInt先比较/夹取，再转换可读偏移，避免Float64舍入。多范围与未知单位回完整200；没有验证器可确认的If-Range也保守回200。HEAD不传body，按[RFC9110 §14.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2)忽略Range并保留完整表示头。

运行：`node verification/server-media-range-check.mjs`。

实际HTTP **30/30**，报告`server-media-range-check.json`：

- 临时listen(0)分配127.0.0.1:5049；测试后listener关闭、临时fixture删除。未重启或请求原5186服务/owned进程。
- MP4/WebM完整payload、bounded/open/suffix/clamp/首尾单字节、超大十进制数、非法/越界/空文件、多范围、HEAD/404/405均验证实际网络字节与响应头。
- 真实`verification/pyro-r7-apex-motion.mp4`的HEAD长度、首部/37%位置/尾部三个128B片段与磁盘逐字节一致。
- 原display-hdr探测函数、同源route、path guard、原listen入口片段SHA均与改动前一致；HTTP也验证其跨源403与错误方法405，未额外调用Windows探测。

server.mjs冻结SHA256：`9cefdc0c785496f9ada069a00fa9128aaa024b7181c8dcc4a289aa8fb30d243f`。旧SHA与局部scope seals保留`server-media-before.json`。

本报告证明服务器响应协议与实际字节；**浏览器native seek仍待owner重启同一服务后验证**，不能以临时HTTP通过代替播放/解码或寻址成功。没有修改影片、HTML/渲染/HDR/CLI或其他运行时代码。
