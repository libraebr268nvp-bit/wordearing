@echo off
chcp 65001 >nul
title WordWiz - 单词学习系统

echo ============================================
echo    WordWiz 单词学习系统
echo ============================================
echo.
echo [信息] 启动 HTTP 服务...
echo [信息] 本地访问: http://localhost:3000
echo [信息] 局域网访问: http://你的IP:3000 (手机同WiFi可用)
echo [信息] 按 Ctrl+C 停止服务
echo.

python -m http.server 3000 --bind 0.0.0.0

echo.
pause
