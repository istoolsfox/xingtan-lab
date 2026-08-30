@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   杏坛教师助手 - 课件演示原型
echo   http://localhost:6173
echo   关闭本窗口即停止服务
echo ============================================
start "" http://localhost:6173
node server.js
