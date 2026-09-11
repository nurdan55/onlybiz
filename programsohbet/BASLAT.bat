@echo off
title Sevgili Sohbet
color 0B

if not exist "node_modules" (
    echo [HATA] Once KUR.bat calistir!
    pause
    exit /b 1
)

echo.
echo ========================================
echo    SEVGILI SOHBET
echo ========================================
echo.
echo    Sohbet:  http://localhost:3000
echo    Admin:   http://localhost:3000/admin.html
echo.
echo    Admin sifre: admin123
echo.

start http://localhost:3000
node server.js

pause