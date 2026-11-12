# R39 密集请求：最小校准接缝

这是当前源级就绪审查和有界实现合同。R29内核、状态恢复及错误/计时协议已有实际证据；本轮不重跑tiny基础门，不改物理、曲线、烟量、shader算术或生产4m日常策略。

## 必需的最少变化

1. 当前SourceT packer明确拒绝>4m，SH tiled planner也有显式4m门。新增verification副本：pack/layout/GPU、light-tiles/light-field；只将显式QA request上限改为12m并重定位imports。旧maxPairs/maxBakePairs/defaults/legacy comparator不变。layout也须指向QA packer，否则12m仍被原4m校验拒绝。矩形planner、Gaussian/SH字符串、native-state guard直接引用当前不变生产模块。
2. 新runner从R29复制已验证完整协议，改为新的严格pins/schema/revision和一个闭合真实fixture；第一门**仅MAIN SourceT**，并不运行SH或反射。接口`runR39DenseCalibration(THREE,renderer,{parentLocked:true})`，不接受输入/计数/cap/自定义factory注入，内部静态引用QA工厂。root新main方法只负责paused/empty/健康/独占锁与lazy调用；旧R29 pins不放松，也不复用旧fixture标签强跑。
3. QA构造为18k sources/4096 packets/explicit12m/1m map/16maps。实际mapRects、draws、readBytes取本轮固定真实fixture，硬门应等于该请求，不能因构造允许16maps就任意提交16。旧kernel仍每map最多64项、原递增tile归约；完整request与保守64-slot预算分别列出。
4. 新fixture必须来自当前代码、原N8 radiant、真实两次发射和当前机位，MAIN请求确实>4m；原snapshot/profiles/ID/mass/covariance、完整current ledger、main/reflection所有原double rays/active/sourceVersion/cameraKey均保留。source-only提交不等于可删除artifact中的其它消费者。先具备所有MAIN physical/quantized离线T参考；joint后来再加独立全SH参考，不在线做全pair oracle。

## 复用而非重造的保证

沿用R29：第一次await前私有复制完整输入/参考并预算capture；精确U32全padding装包、rectangle覆盖和原排序校验；源文件与cached函数双pin、严格不可变pin-keyset；旧T 1e−5/packed8e−6门，SH后续保留signed C1 .002及raw/group上界。只在完整同步prepare后发布私有结果；不借给live，不把inactive rows或未写suffix视为有效输出。

沿用R29现有READ/DRAW/MRT、PACK/UNPACK/PBO/COPY_READ、Three target/viewport/scissor、debug callback和descriptor finally；每个数值render恰一实际draw，fixed总draw/read/typed bytes硬上限，已有context且无竞争query。一个完整任务一个owned query，25ms是回顾安全门，不能中断已经提交的maps；fault/disjoint/timeout/超时后不读图、不自动重试。正常数值门不含FW/volume/全景绘制，不能宣称FPS或完整密集整帧通过。

每核最多8个partial read仍足够作为辅助：保留首/末、末tile、重要map分界两侧和非中性色源/packet；不能让R29旧probes的`.slice(0,8)`在12maps时把末tile/有色sentinel全部挤掉。全有效输出的离线参考仍是主要数值门，partial抽样不声称覆盖每个中间texel。

## 容量与三消费者范围

12m构造域的紧凑上界仍是SourceT `ceil(12m/64)+18000=205500`逻辑partial格，SH `ceil(12m/64)+4096=191596`；均小于旧rectangle索引域1,152,000，也远小于Float32整数精确界2^24和GLSL有符号int界。实际纹理宽/高、device maxTextureSize与完整数值字节须从原layout得出再检查。构造只扩大容量，不更改循环上限：T归约最大64tiles，SH最大ceil(14000/64)=219。

公式数值存储为单T4,706,304B、SH9,916,416B；首次SOURCE-only门只承担单T，另有已声明sentinel和输入capture，不把它写成14.6MB的两核实测VRAM。

三job数值joint与正常即时消费不同。统一query结束后才readback两眼时，必须持有两个独立T fields，否则第二次prepare已覆盖main借用texture；最小做法为2T+1SH，数值存储**19,329,024B**。正常live可一T prepare→立即对应FW draw→另一眼prepare，但其scene draw/状态与预算也必须实际计入。后续joint要求同一个owned snapshot对象与current ledger，T两眼分别保留sourceVersion/cameraKey/origin，不得共用T；同代SH只fresh bake一次。

R29旧两发数字推得39draw/31.661312m slots仅是旧fixture尺度。当前radiant长尾、机位与烟量可能不同；本轮root先选择实际>4m MAIN固定门，不把旧计数当新输入，也不提前修改日常上限或执行更大的joint。
