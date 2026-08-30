@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   杏坛演示引擎 (科学课堂仿真)
echo   http://localhost:6174
echo   关闭本窗口即停止服务
echo ============================================
start "" http://localhost:6174
node server.js
