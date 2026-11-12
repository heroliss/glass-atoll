import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),j=p=>JSON.parse(read(p));
const controls=j('verification/r33-water-solar-controls-actual-gpu.json'),timing=j('verification/r33-water-solar-timing-actual-gpu.json');
assert(controls.passed&&timing.passed);assert.equal(sha(read('water.js')),'d7d5b76dadf35e2e507b640b8975fb3819821b29d113ceeebf195080fd88b045');
const archive='verification/baselines/r33-before-progress-update/';fs.mkdirSync(new URL(archive,root),{recursive:true});
for(const [src,name]of [['README.md','README.md'],['verification/plans/PROGRESS.md','PROGRESS.md']]){const target=new URL(archive+name,root);if(fs.existsSync(target))assert.deepEqual(fs.readFileSync(target),read(src),'Do not overwrite earlier documentation archive');else fs.writeFileSync(target,read(src));}
const checkpoint=`# R33：修复当前屏幕 HDR 校准，并完成海水候选的受控实机检查

本轮可见修复是自动 HDR 选屏。浏览器位于左侧 DISPLAY6，系统报告峰值1270nit；旧逻辑却采用前台窗口所在 DISPLAY5 的700nit。现在自动模式以一致的浏览器屏幕及完整窗口矩形匹配原生报告；明确选屏与手动亮度仍优先。实际页面自动6/1270、明确5/700、恢复自动并刷新6/1270均通过，GL、着色器和上下文正常。全目标继续 active。

## 实际修复与边界

新增 hdr-screen-selection.js 是无浏览器副作用的纯策略模块。main.js 在校准时直接采集当前窗口/屏幕，异步配置完成前后检查请求与位置是否过期；合并重复刷新，QA与画质切换期间延后发布，1秒低成本位置检查沿用现有原生报告。UI显示当前屏幕及选择依据。

本次自动匹配仅准入当前全屏幕单位缩放、DPR1、唯一完整屏幕矩形、窗口完全落在对应屏幕的情况。混合DPI、跨屏、缩放或矛盾坐标保守拒绝自动猜测，保留手动选屏。未请求新权限，未调用 getScreenDetails，未更改 Windows 设置，也未物理移动窗口。系统报告的1270nit不是测光仪实测；未证明绝对场景亮度或官方 ACES HDR 输出准确。生产色彩呈现仍 legacy。

证据：r33-hdr-live-check.json **3/3**、r33-hdr-live-motion-independent-audit.json **9/9**；策略候选9/9，生产策略12/12，异步接线独立8/8。界面图 r33-hdr-auto-restored1270.png 只展示选屏及设置，黑夜空场景没有作为照片感验收。

## 海水：一致性通过，未推广候选

生产 water.js 仍 d7d5b76d…，R32候选、旧实机数据及其失败历史均未改。R33只新增两个封闭QA入口，沿用真实1209×1292视口、2,457,600索引的生产水面网格与冻结采样纹理；没有物理、烟尘、镜面或整场景更新。

三个控制分别是合成正向太阳键、debug15、远处不命中的水下物体计数1。固定6次绘制、24附件读回319,488B；三对四MRT存储值逐位相同，容差0。实际结果 **8/8**，独立原始附件审计 **7/7**。远球只检查计数回退，不能冒充真实水下石子命中或真实白天画面。

随后另行执行单采样、关闭scissor的原生水面计时，固定 warmA、warmB、A1、B1、B2、A2：

| 查询 | GPU ms |
|---|---:|
| warmA | 29.349888 |
| warmB | 12.626944 |
| A1 原版 | 12.201984 |
| B1 候选 | 20.246528 |
| B2 候选 | 11.336704 |
| A2 原版 | 11.908096 |

排除两次预热后，原版均值12.055040ms、候选15.791616ms，比值1.309960。两样本及候选波动不能建立稳定提速或统计退化结论；本次没有足够收益证据，决定 **UNPROMOTED**。没有重跑挑选成绩、提高门限或放宽像素容差。

计时调用实际 **8/8**，独立原始附件审计 **7/7**；warmA/warmB和最终A2的既定32×32哨兵逐位一致。中间ABBA不读图，全图没有逐像素比较。共6draw/14,745,600索引、12读回159,744B、6clear、0blit/mipmap；单次查询均ready/nondisjoint且低于100ms，六查询600ms只是派生总量，绝非放宽整帧预算。单采样独立水面、固定纹理和带检查的查询不能换算正常8×MSAA整场景FPS。

## 还原与后续

两次GPU工作均还原原始网格、材质、uniform引用、原生program/VAO、方法描述符和body.inert，未提交还原绘制。最终仍是暂停、0烟花/0烟团、原机位与烟花设置页，GL与控制台为空。已认可主爆音效4e5ede41…未变。正常源码语法检查及新模块单独语法检查通过。完整用户设置比较见 r33-user-restoration-check.json；自动派生峰值由700修正为1270，不把它说成原始数值不变。

下一轮先审查默认云密度端点中真正无用的 legacy/thermal 计算，保留采样、LOD、云形、基底连续性和所有中间混合；仍需实际像素与耗时证据后才决定推广。明亮烟花原生画面、多发积烟超过400万配对的回退、岸浪/水花/海平线及整体照片感仍未完成，不能用本轮数值通过代替视觉交付。
`;
fs.writeFileSync(new URL('verification/R33-HDR-WATER-CHECKPOINT.md',root),checkpoint);
const brief='[R33 检查点](verification/R33-HDR-WATER-CHECKPOINT.md)：修复自动HDR误用另一块屏幕的亮度；当前浏览器实际自动匹配DISPLAY6/1270nit，手动DISPLAY5/700及恢复自动刷新均验证。海水候选三组回退控制与独立原生计时均8/8，检查区域逐位一致；两次测量未证明更快，生产海水保持原版。音效与用户设置意图保留，整体目标active。\n\n';
const original=read(archive+'README.md').toString('utf8');assert(original.startsWith('# 玻璃海 · Atoll'));fs.writeFileSync(new URL('README.md',root),original.replace(/^(# 玻璃海 · Atoll\r?\n\r?\n)/,'$1'+brief));
const progress='\n\n### R33：当前屏幕HDR修复、海水候选实机受控检查（2026-10-30）\n\n详见 [R33检查点](../R33-HDR-WATER-CHECKPOINT.md)。旧自动模式错误采用前台DISPLAY5/700nit，现实际浏览器左屏DISPLAY6/1270nit匹配正确，明确选屏5/700、恢复auto并刷新6/1270均通过；系统报告而非物理测光。单位缩放/完整窗口一致性保守准入，异步过期结果与QA期间刷新已隔离，无OS设置变化。\n\n海水三组合成回退控制实际8/8与独立raw7/7，原生单采样预热+ABBA实际8/8与独立raw7/7，所读四MRT逐位一致。原版两次均值12.055ms、候选15.792ms且样本少/有波动，不能证明稳定提速，候选UNPROMOTED、生产waterd7不动；不是全场8×MSAA FPS或全图像素验收。GL/控制台健康，主爆音效4e5不变，原机位/暂停/烟花页恢复。下一步默认云密度端点无用计算审查、明亮原生视觉与多发积烟，目标active。\n';
fs.writeFileSync(new URL('verification/plans/PROGRESS.md',root),read(archive+'PROGRESS.md').toString('utf8')+progress);
fs.writeFileSync(new URL('verification/r33-command-check.json',root),JSON.stringify({schema:'glass-atoll.r33-syntax-command-check.v1',passed:true,commands:[{command:'npm run check',exitCode:0,sessionId:63317},{command:'node --check hdr-screen-selection.js',exitCode:0}],scope:'Observed process exits in this R33 turn; syntax only, not browser or whole historical suite acceptance.'},null,2)+'\n');
console.log(JSON.stringify({written:true,candidatePromoted:false,checkpoint:'verification/R33-HDR-WATER-CHECKPOINT.md',archive}));
