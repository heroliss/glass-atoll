@echo off
chcp 65001 >nul
setlocal DisableDelayedExpansion
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto missing_node
set "PORT=5186"

rem Reuse this site's server; never start a duplicate on an occupied port.
powershell.exe -NoProfile -Command "$listener = Get-NetTCPConnection -LocalPort 5186 -State Listen -ErrorAction SilentlyContinue; if (-not $listener) { exit 10 }; try { $page = Invoke-WebRequest -Uri 'http://127.0.0.1:5186/' -UseBasicParsing -TimeoutSec 3; if ($page.Content -match '<title>[^<]*Atoll</title>') { exit 0 } } catch {}; exit 20"
set "ATOLL_PORT_STATUS=%errorlevel%"
if "%ATOLL_PORT_STATUS%"=="0" goto already_running
if not "%ATOLL_PORT_STATUS%"=="10" goto port_occupied

echo 正在打开玻璃海：http://127.0.0.1:5186/
echo 请保留此窗口。关闭窗口或按 Ctrl+C 可停止本地服务。
echo.
rem Node keeps the HTTP server in this visible console.
rem Its in-process readiness check opens the browser once, then stops polling.
node --input-type=module -e "await import('./server.mjs'); const url='http://127.0.0.1:5186/'; const {spawn}=await import('node:child_process'); let opened=false; const ready=setInterval(async()=>{try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)}); if(response.ok&&!opened){opened=true;clearInterval(ready);spawn('cmd.exe',['/c','start','',url],{windowsHide:true,stdio:'ignore'});}}catch{}},250); setTimeout(()=>clearInterval(ready),15000).unref();"
if errorlevel 1 pause
exit /b

:already_running
start "" "http://127.0.0.1:5186/"
exit /b 0

:port_occupied
echo 端口 5186 已被其他程序占用，无法启动玻璃海。
echo 请关闭占用该端口的程序后重试，或在终端中设置 PORT 后运行 node server.mjs。
pause
exit /b 1

:missing_node
echo 未找到 Node.js。请安装 Node.js 后重新打开，或在终端中执行 node server.mjs。
pause
exit /b 1
