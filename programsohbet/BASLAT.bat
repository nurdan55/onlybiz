@echo off
setlocal enabledelayedexpansion
title Bizim Sohbet - Sunucu
color 0B

echo.
echo ============================================================
echo    BIZIM SOHBET v3.0.0
echo ============================================================
echo.

:: ---- node_modules kontrolü ----
if not exist "node_modules" (
    echo [HATA] Kurulum yapilmamis!
    echo.
    echo   Cozum: Once KUR.bat dosyasini calistir.
    echo.
    pause
    exit /b 1
)

:: ---- package.json kontrolü ----
if not exist "package.json" (
    echo [HATA] package.json bulunamadi!
    pause
    exit /b 1
)

:: ---- server.js kontrolü ----
if not exist "server.js" (
    echo [HATA] server.js bulunamadi!
    pause
    exit /b 1
)

:: ---- Port kontrolü (3000 kullanımda mı?) ----
netstat -ano | findstr :3000 >nul
if %errorlevel% equ 0 (
    echo [UYARI] Port 3000 kullanimda!
    echo.
    set /p KILLPORT="Portu kullanan sureci kapatmak ister misin? (E/H): "
    if /i "!KILLPORT!"=="E" (
        echo [*] Port 3000 serbest birakiliyor...
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
            taskkill /F /PID %%a >nul 2>&1
        )
        timeout /t 1 /nobreak >nul
    ) else (
        echo [*] Lutfen server.js'de PORT degerini degistir.
        pause
        exit /b 1
    )
)

:: ---- Bilgi ekrani ----
echo    Sohbet:      http://localhost:3000
echo    Admin Panel: http://localhost:3000/admin.html
echo.
echo    Test kullanicilari:
echo      - Sen:   1111
echo      - O:     2222
echo      - Admin: admin123
echo.
echo ============================================================
echo    Kapatmak icin bu pencereyi kapatin veya Ctrl+C
echo ============================================================
echo.

:: ---- Tarayıcıyı aç (2 saniye gecikmeli) ----
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

:: ---- Sunucuyu başlat ----
node server.js

:: ---- Sunucu kapandıysa ----
echo.
echo [!] Sunucu durdu.
pause
endlocal