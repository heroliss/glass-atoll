import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const here=new URL('./',import.meta.url),root=new URL('../../',here);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const sourceNames=['main.js','firework-auto-show.js','fireworks-physics.js','fireworks.js','firework-show-envelope.js','ui.js','ui-quick-experience.js','index.html','style.css','package.json','fireworks-audio.js'];
const sourcePins=Object.fromEntries(sourceNames.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex')]));
assert.equal(sourcePins['fireworks-audio.js'],'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
const names=['scheduler-check.json','envelope-check.json','ui-check.json','fw-capacity-check.json','physical-capacity-check.json','browser-check.json'];
const tests=Object.fromEntries(names.map(name=>{const j=read(name);assert.equal(j.passed,true,name);return[name,j.counts??{passed:j.total??j.count,total:j.total??j.count}];}));
const before=read('user-state-before.json'),after=read('user-state-after.json');
const preferences=['sun','wind','current','lens','weather','air','graphics','sea','director','qualityPreset','paused','sound'];
for(const key of preferences)assert.deepEqual(after.state.parameters[key],before.state.parameters[key],key);
for(const key of Object.keys(before.fireworks.settings))assert.deepEqual(after.fireworks.settings[key],before.fireworks.settings[key],key);
assert.deepEqual(after.state.camera,before.state.camera);assert.deepEqual(after.state.target,before.state.target);assert.equal(after.celestial.utcMs,before.celestial.utcMs);
assert.deepEqual([after.fireworks.settings.intervalMinSeconds,after.fireworks.settings.intervalMaxSeconds,after.fireworks.settings.automaticTiltMinDegrees,after.fireworks.settings.automaticTiltMaxDegrees],[1,5,-40,40]);
const dense=read('dense-benchmark.json'),recommended=read('recommended-live.json').result.benchmark;
assert.equal(dense.result.validity,'valid');assert.equal(recommended.result.validity,'valid');
const performance={scope:'Native1209x1292, DPR1, medium, HDR, light short smoke, cloud illumination enabled, sound disabled; live five-second windows. Different trajectories and ages are not paired before/after evidence.',target60FpsMet:false,dense:{activeAtStart:dense.start.active,averageFps:dense.result.averageFps,cpuMedianMs:dense.result.cpuMs.median,gpuMedianMs:dense.result.gpuMs.median},recommended:{activeAtStart:recommended.activeAtStart,activeAtEnd:recommended.activeAtEnd,averageFps:recommended.result.averageFps,cpuMedianMs:recommended.result.cpuMs.median,gpuMedianMs:recommended.result.gpuMs.median}};
const result={schema:'glass-atoll.automatic-show-acceptance.v1',date:new Date().toISOString(),functionalChecksPassed:true,performanceTargetMet:false,tests,sourcePins,restoration:{passed:true,parameterGroups:preferences,oldFireworkSettingsPreserved:true,cameraAndTargetExact:true,utcExact:true,newDefaults:[1,5,-40,40],testGlobalsRemovedByFinalReload:true},performance,limitations:['This feature is complete; the wider photorealism/performance goal is not declared complete.','At low FPS the existing main-loop55ms delta cap can slow physical time; random ranges are simulation seconds, not guaranteed wall seconds under overload.','Full long-lived volumetric smoke retains its source/SH budgets; dense GPU acceptance here uses light smoke.','32 physical chrysanthemum producer capacity is a CPU/factory test, not a32-chrysanthemum sustained GPU FPS guarantee.','No new audio listening, absolute photometry, chemical or fluid simulation claim.']};
fs.writeFileSync(new URL('acceptance.json',here),JSON.stringify(result,null,2));
const report=`# 自动燃放范围与多发并存验收

本轮功能检查通过；密集燃放的性能目标未达成，整体照片感与性能目标没有标记完成。

## 已实现

- “详细烟花设置”可分别设置随机间隔上下界（0.35–30秒，默认1–5秒）和自动倾角上下界（−65°～+65°，默认−40°～+40°）。每次独立抽样；0°为竖直，正负沿配置发射方位的两侧偏转。
- 可关闭两种随机模式，恢复固定间隔或原有固定仰角。手动发射保留原有仰角/小锥形抖动；自动有符号倾角不会叠加该小锥形抖动，因此不会越出所设范围。内部近地扇形/花束本身的展开形状保留。
- 主场景完整事件上限从4提升至32。满额跳过新的自动发射；手动第33发明确拒绝，均不排队，不删掉仍存续事件。
- 动态光栅/账本缓冲随需求扩容，硬上限262144/131072行，不预分配最大空间；光照把全部事件聚合到两组代理。自动观赏机位按所有可能品种及整个角度区间预测构图。

## 验证

| 检查 | 结果 | 证据 |
|---|---:|---|
| 实际调度器与运动状态 | 15/15 | scheduler-check.json |
| 连续角度范围/10种烟花104646个真实位置 | 30/30 | envelope-check.json |
| UI函数、拒绝和异步回滚 | 9/9 | ui-check.json |
| 扩容、完整行交接与小场景精确兼容 | 6/6 | fw-capacity-check.json |
| 真实32场菊型生产factory | 4/4 | physical-capacity-check.json |
| 实际浏览器操作与运行 | 7/7 | browser-check.json |

真实32场菊型在爆开后1.2秒得到55296条发光记录，账本、prepared-view、render交接数量一致，扩容到56000行；这是无GL的CPU容量证明。实际浏览器自动燃放另达到32枚完整事件同时存续，无排队、GL错误或目标崩溃。真实键盘编辑、无效区间恢复、0°竖直及固定/随机切换均已检查。

npm run check退出0。相关原有回归：亮度17/17、烟气模式6/6、机位324/324、控件/质量22/22、基础数学11/11通过。没有把整个历史测试集重新当成全部绿色；既有历史失败资料保留。

## 性能实测与边界

测量环境为原生1209×1292、DPR1、中档、HDR、轻量短烟、烟花照云开启、音频关闭。两次五秒窗口均valid，存在不同轨迹、年龄与照明负载，不构成优化前后对照。

| 窗口 | 活跃事件 | 平均FPS | CPU中位ms | GPU中位ms |
|---|---:|---:|---:|---:|
| 密集尾段 | 起始28 | ${performance.dense.averageFps.toFixed(2)} | ${performance.dense.cpuMedianMs.toFixed(2)} | ${performance.dense.gpuMedianMs.toFixed(2)} |
| 默认1–5秒的月夜 | 4→5 | ${performance.recommended.averageFps.toFixed(2)} | ${performance.recommended.cpuMedianMs.toFixed(2)} | ${performance.recommended.gpuMedianMs.toFixed(2)} |

更早的暮光32秒记录HUD中位45FPS，也不能与月夜作配对提速证明。密集自动22秒阶段HUD中位25FPS、峰32事件；随后尾段更慢，不能只拿较快阶段作为密集性能结论。

主要热点包括CPU粒子/尾迹采样、主/倒影提交及间接光/云阴影；不能把所有开销归因于烟雾。现有主循环把delta限制为55ms，低于约18FPS时物理钟可能落后墙钟（密集5.14秒窗口物理只推进约3.46秒）。本轮随机区间指物理秒，过载下不是墙钟间隔保证；该共用时间步问题没有冒险扩大修改。下一步窄候选见 PERFORMANCE-NEXT.md，尚无新性能收益承诺。

完整长期体积烟保留SourceT18000/SH14000及配对预算，本轮没有证明它能流畅支持32场；密集展示继续推荐轻量短烟。容量支持也不代表32枚大菊同时GPU绘制达到60FPS。

## 用户状态与交付

原机位/目标、UTC、画质、镜头、天气、海水、灯光、声音、暂停/自动状态及已有烟花设置已精确恢复；有意保留新默认1–5秒和−40°～+40°。重载清除了验证中的烟花和烟气，不复原原先两枚烟花或旧波浪的瞬态；临时开发观测全局由最后重载移除，未改系统HDR设置或创建重复服务器。原主爆音效SHA256保持4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31。

入口仍为 http://127.0.0.1:5186/ 。settings-final.png展示最终设置，dense-night.png是实际密集夜景瞬间；普通截图不能证明HDR亮度或动态流畅程度。修改前源码和首轮测试夹具错误在before/中可追溯，原失败不删除。完整源码指纹与状态恢复检查见 acceptance.json。
`;
fs.writeFileSync(new URL('REPORT.md',here),report);
console.log(JSON.stringify({functionalChecksPassed:true,performanceTargetMet:false,tests,restored:true,audioUnchanged:true}));
