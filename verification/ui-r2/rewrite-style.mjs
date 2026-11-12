import fs from 'node:fs';
let source=fs.readFileSync('style.css','utf8').replaceAll('\r\n','\n');
const from=source.indexOf('/* Experience controls:'),to=source.indexOf('/* Focused playback controls;',from);
if(from<0||to<0)throw new Error('Experience style boundaries missing');
const css=`/* Independent time, camera and fireworks panels preserve the existing palette. */
:root{--panel-surface:#f8faf7;--panel-muted:#50615e;--panel-active:#e4eae5;--panel-shadow:none;--quick-ink:#193b37;--quick-button:#193b37;--quick-button-text:#fafdf9;}
body.night-view{--panel-surface:#171b1c;--panel-muted:#b7c2bf;--panel-active:#303737;--panel-shadow:none;--quick-ink:#edf4f0;--quick-button:#e9f1eb;--quick-button-text:#14231e;}
.control-panel,.view-drawer,.scene-actions,.performance-hud{box-shadow:none;}
.control-panel.collapsed{width:138px;background:var(--panel-surface);}
.control-panel .panel-toggle,.drawer-heading{min-height:48px;}
.panel-heading{font-size:12px;font-weight:500;}
.time-panel{position:fixed;z-index:5;top:104px;left:var(--corner);width:230px;background:var(--panel-surface);color:var(--ink);border-radius:10px;overflow:hidden;}
#quick-time-content{padding:0 16px 14px;}
.panel-caption{font-size:11px;line-height:1.6;color:var(--panel-muted);margin:0 0 10px;}
.quick-time-options{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.quick-time-options button{min-width:0;min-height:48px;padding:7px 9px;text-align:left;border:1px solid var(--line);border-radius:6px;background:transparent;color:var(--ink);}
.quick-time-options button>span{display:block;font-size:13px;line-height:1.5;font-weight:500;}
.quick-time-options small{display:block;font-size:11px;line-height:1.6;color:var(--panel-muted);}
.quick-time-options button:hover,.quick-time-options button[aria-pressed=true]{background:var(--panel-active);border-color:var(--panel-muted);}
.quick-time-options button[aria-busy=true]{cursor:progress;}
#quick-time-status{min-height:34px;font-size:11px;line-height:1.55;color:var(--panel-muted);margin:10px 0 0;}
.view-drawer{top:356px;width:230px;max-height:max(96px,calc(100svh - 570px));}
.view-drawer.collapsed{width:230px;max-height:none;}
#views-content{max-height:max(80px,calc(100svh - 622px));}
body.time-panel-collapsed .view-drawer{top:168px;max-height:max(96px,calc(100svh - 382px));}
body.time-panel-collapsed #views-content{max-height:max(80px,calc(100svh - 434px));}
.view-card-compact{margin-top:8px;min-height:62px;}
.view-card[aria-pressed=true] .view-card-name::after{content:'已选';}
.experience-dock{position:fixed;z-index:6;left:50%;bottom:var(--corner);transform:translateX(-50%);width:min(850px,calc(100% - 2 * var(--corner) - 118px));display:block;padding:0 16px 10px;background:var(--panel-surface);color:var(--ink);border-radius:10px;}
.experience-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.experience-heading>.drawer-heading{flex:1;min-width:0;width:auto;padding:0 0 0 1px;}
.experience-heading>.drawer-heading .chevron{margin-left:3px;}
.fireworks-quick{min-width:0;padding-bottom:2px;}
.quick-heading{display:flex;justify-content:flex-end;margin:-3px 0 7px;}
.text-action{font-size:11px;line-height:1.5;padding:2px 0;border:0;background:transparent;color:var(--panel-muted);min-height:24px;}
.text-action:hover{color:var(--ink);text-decoration:underline;text-underline-offset:4px;}
.quick-firework-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.quick-firework-controls select{width:190px;min-width:0;max-width:100%;height:40px;padding:0 25px 0 9px;color:var(--ink);border:1px solid var(--line);border-radius:6px;background:var(--panel-surface);font-size:12px;}
.quick-primary,.quick-secondary{min-height:40px;white-space:nowrap;padding:0 12px;font-size:12px;font-weight:400;border:1px solid var(--line);border-radius:6px;background:transparent;color:var(--ink);}
.quick-primary{background:var(--quick-button);color:var(--quick-button-text);border-color:var(--quick-button);font-weight:500;}
.quick-primary:hover{filter:brightness(.91);}
.quick-secondary:hover,.quick-secondary[aria-pressed=true]{background:var(--panel-active);}
.quick-secondary[aria-pressed=true]{border-color:var(--panel-muted);}
button:disabled{cursor:default;}
.quick-secondary:disabled{color:var(--panel-muted);border-style:dashed;}
.quick-primary:disabled{opacity:.65;}
#quick-firework-status{font-size:11px;line-height:1.55;color:var(--panel-muted);margin:8px 0 0;min-height:17px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;}
.playback-actions{display:flex;align-items:center;gap:6px;padding:0;border:0;}
.playback-actions svg{width:18px;height:18px;}
.playback-actions .small-icon{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:6px;background:transparent;}
.playback-actions .small-icon:hover{background:var(--panel-active);}
.control-hint{font-size:11px;line-height:1.6;color:var(--panel-muted);margin:6px 0 0;}
.experience-dock.collapsed{width:320px;}
.experience-dock.collapsed .control-hint{margin-top:0;}
.place-note{bottom:calc(var(--corner) + 197px);font-size:12px;pointer-events:none;}
.place-note p{font-size:11px;}
body.fireworks-collapsed .place-note{bottom:calc(var(--corner) + 104px);}
.performance-hud{font-size:11px;max-width:108px;}
#toast,body.panel-expanded #toast{bottom:calc(var(--corner) + 208px);top:auto;}
body.fireworks-collapsed #toast{bottom:calc(var(--corner) + 113px);}
@media(min-width:601px) and (max-width:1050px){
 .time-panel,.view-drawer,.view-drawer.collapsed{width:210px;}
 .experience-dock{left:calc(50% - 56px);width:calc(100% - 2 * var(--corner) - 112px);padding:0 12px 10px;}
 .experience-dock.collapsed{width:300px;}.quick-firework-controls select{width:170px;}.quick-primary,.quick-secondary{padding:0 10px;}
 .place-note{bottom:calc(var(--corner) + 218px);max-width:210px;}.performance-hud{bottom:var(--corner);}
}
@media(max-width:600px){
 .time-panel{top:max(76px,calc(env(safe-area-inset-top) + 60px));left:18px;width:calc(100% - 36px);border-radius:8px;}
 .time-panel>.drawer-heading{min-height:44px;padding:0 12px;}
 #quick-time-content{padding:0 10px 9px;}.panel-caption{margin-bottom:7px;}
 .quick-time-options{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;}
 .quick-time-options button{padding:6px 4px;min-height:48px;text-align:center;}.quick-time-options button>span{font-size:12px;}.quick-time-options small{font-size:11px;white-space:nowrap;}
 #quick-time-status{min-height:0;margin:6px 1px 0;font-size:11px;}
 .view-drawer,.control-panel,body.time-panel-collapsed .view-drawer{top:max(248px,calc(env(safe-area-inset-top) + 232px));width:calc(100% - 36px);max-height:max(90px,calc(100svh - 490px));}
 body.time-panel-collapsed .view-drawer,body.time-panel-collapsed .control-panel{top:max(132px,calc(env(safe-area-inset-top) + 116px));}
 .view-drawer.collapsed,.control-panel.collapsed{width:calc(50% - 25px);max-height:none;}
 .drawer-heading,.control-panel .panel-toggle{min-height:44px;padding:0 12px;}.drawer-heading,.panel-heading{font-size:12px;}
 #views-content,body.time-panel-collapsed #views-content{max-height:max(90px,calc(100svh - 540px));}.settings-scroll{max-height:max(100px,calc(100svh - 600px));min-height:100px;}
 .view-extras{grid-template-columns:1fr 1fr;}.view-card-caption{font-size:11px;}
 .experience-dock,.experience-dock.collapsed{bottom:calc(16px + env(safe-area-inset-bottom));left:18px;right:18px;transform:none;width:auto;padding:0 12px 10px;border-radius:9px;}
 .experience-heading{gap:8px;}.experience-heading>.drawer-heading{min-height:48px;padding:0;}
 .playback-actions .small-icon{width:40px;height:40px;}
 .quick-heading{margin:-2px 0 7px;}.text-action{font-size:11px;min-height:24px;}
 .quick-firework-controls{gap:6px;}.quick-firework-controls select{flex:1 1 calc(100% - 110px);width:0;height:44px;font-size:12px;}
 #quick-launch{width:104px;min-height:44px;}.quick-firework-controls .quick-secondary{flex:1;min-height:44px;padding:0 5px;font-size:12px;}
 #quick-firework-status{margin-top:7px;font-size:11px;min-height:17px;}.control-hint{font-size:11px;}
 .place-note{display:none;}.performance-hud{left:auto;right:18px;bottom:calc(294px + env(safe-area-inset-bottom));padding:6px 9px;max-width:104px;}
 body.fireworks-collapsed .performance-hud{bottom:calc(112px + env(safe-area-inset-bottom));}
 #toast,body.panel-expanded #toast{bottom:calc(304px + env(safe-area-inset-bottom));max-width:calc(100% - 36px);}
 body.fireworks-collapsed #toast{bottom:calc(122px + env(safe-area-inset-bottom));}
 body.panel-expanded .time-panel,body.views-expanded .time-panel,
 body.views-expanded .experience-dock,body.panel-expanded .experience-dock,
 body.views-expanded .performance-hud,body.panel-expanded .performance-hud{visibility:hidden;pointer-events:none;}
 body.views-expanded .view-drawer,body.panel-expanded .control-panel{top:max(76px,calc(env(safe-area-inset-top) + 60px));max-height:calc(100svh - 96px);}
 body.views-expanded #views-content{max-height:max(100px,calc(100svh - 152px));}
 body.panel-expanded .settings-scroll{max-height:max(100px,calc(100svh - 244px));}
}
@media(max-height:660px) and (min-width:601px){
 .time-panel{top:80px;width:210px;}#quick-time-content{max-height:max(90px,calc(100svh - 266px));overflow:auto;}.panel-caption{display:none;}.quick-time-options button{min-height:44px;padding:5px 7px;}
 .view-drawer,.view-drawer.collapsed{top:312px;width:210px;}.view-drawer:not(.collapsed){max-height:max(96px,calc(100svh - 420px));}#views-content{max-height:max(80px,calc(100svh - 472px));}
 body.time-panel-collapsed .view-drawer{top:140px;max-height:max(96px,calc(100svh - 330px));}body.time-panel-collapsed #views-content{max-height:max(80px,calc(100svh - 382px));}
 .control-panel{top:80px;max-height:calc(100svh - 242px);}.settings-scroll{max-height:max(100px,calc(100svh - 400px));}.place-note{display:none;}
}
@media(max-width:600px) and (max-height:600px){
 .time-panel{top:70px;width:210px;max-width:calc(100% - 164px);}.time-panel .panel-caption,.quick-time-options small{display:none;}
 #quick-time-content{max-height:max(70px,calc(100svh - 210px));overflow:auto;padding:0 9px 8px;}.quick-time-options{grid-template-columns:1fr 1fr;}.quick-time-options button{min-height:38px;}
 .view-drawer,.view-drawer.collapsed,body.time-panel-collapsed .view-drawer{top:70px;left:auto;right:18px;width:calc(100% - 264px);min-width:112px;}
 .control-panel,.control-panel.collapsed,body.time-panel-collapsed .control-panel{top:122px;right:18px;width:calc(100% - 264px);min-width:112px;}
 .experience-dock,.experience-dock.collapsed{bottom:10px;padding:0 9px 7px;}.experience-heading>.drawer-heading{min-height:44px;}.playback-actions .small-icon{width:36px;height:36px;}
 .quick-heading,#quick-firework-status{display:none;}.quick-firework-controls select{flex:1 1 124px;}.quick-firework-controls .quick-secondary{flex:0 1 auto;padding:0 7px;min-height:40px;}.control-hint{margin-top:5px;}
 .performance-hud,body.fireworks-collapsed .performance-hud{left:100px;right:auto;top:18px;bottom:auto;}
 body.views-expanded .view-drawer,body.panel-expanded .control-panel{left:18px;right:18px;width:auto;min-width:0;top:70px;max-height:calc(100svh - 90px);}
}

`;
source=source.slice(0,from)+css+source.slice(to);
source=source.replace('/* Focused playback controls; the charge indicator contains no visible text. */','/* Playback controls and a readable throw-strength meter. */');
source=source.replace('#throw-charge{width:144px;padding:0;border:0;background:transparent;border-radius:2px;}','#throw-charge{width:164px;padding:8px 10px;border:1px solid #ffffff40;background:#173e3ee6;border-radius:5px;}');
fs.writeFileSync('style.css',source.replaceAll('\n','\r\n'));
