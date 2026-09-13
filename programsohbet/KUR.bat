@echo off
setlocal enabledelayedexpansion
title Bizim Sohbet - Kurulum
color 0A

echo.
echo ============================================================
echo    BIZIM SOHBET v3.0.0 - KURULUM
echo ============================================================
echo.

:: ---- Yönetici kontrolü (opsiyonel, uyarı) ----
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Bu betigi yonetici olarak calistirmak zorunlu degil.
    echo.
)

:: ---- Node.js kontrolü ----
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js kurulu degil!
    echo.
    echo   1. https://nodejs.org adresine git
    echo   2. LTS surumunu indir ve kur
    echo   3. Bu betigi tekrar calistir
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js bulundu
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo      Surum: %NODE_VERSION%
echo.

:: ---- Node.js sürüm kontrolü ----
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION:~1%") do set NODE_MAJOR=%%a
if %NODE_MAJOR% lss 18 (
    echo [UYARI] Node.js 18+ onerilir. Sizde: %NODE_VERSION%
    echo.
)

:: ---- npm kontrolü ----
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] npm bulunamadi!
    pause
    exit /b 1
)

echo [OK] npm bulundu
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo      Surum: %NPM_VERSION%
echo.

:: ---- Zaten kurulu mu? ----
if exist "node_modules" (
    echo [!] node_modules klasoru zaten var.
    set /p REINSTALL="Yeniden kurmak ister misin? (E/H): "
    if /i "!REINSTALL!"=="E" (
        echo [*] Eski paketler siliniyor...
        rmdir /s /q node_modules 2>nul
        del /q package-lock.json 2>nul
    ) else (
        echo [*] Kurulum atlandi.
        goto :FINISH
    )
)

:: ---- npm install ----
echo [*] Paketler yukleniyor... (1-3 dakika surebilir)
echo.
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Paket kurulumu basarisiz!
    echo.
    echo   Cozum onerileri:
    echo   - Internet baglantini kontrol et
    echo   - Node.js'i yeniden kur
    echo   - Antivirus/firewall kapali olsun
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Paketler basariyla kuruldu!
echo.

:: ---- data klasörü oluştur ----
if not exist "data" (
    mkdir data
    echo [OK] data klasoru olusturuldu
)

:FINISH
echo.
echo ============================================================
echo    KURULUM TAMAMLANDI!
echo ============================================================
echo.
echo    Sonraki adim: BASLAT.bat dosyasini calistir
echo.
echo    Test kullanicilari:
echo      - Sen:   1111
echo      - O:     2222
echo      - Admin: admin123
echo.
echo ============================================================
echo.
pause
endlocal