@echo off
title Kurulum
color 0A
echo.
echo ========================================
echo    SEVGILI SOHBET - KURULUM
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js kurulu degil!
    echo Indir: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js bulundu
echo.
echo [*] Paketler yukleniyor...
call npm install

if %errorlevel% neq 0 (
    echo [HATA] Kurulum basarisiz!
    pause
    exit /b 1
)

echo.
echo ========================================
echo    KURULUM TAMAM!
echo    Simdi BASLAT.bat'i calistir
echo ========================================
pause