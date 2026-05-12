@echo off
title Bendahara Tongkrongan — Runner
echo 🏦 Sedang menjalankan Bendahara Tongkrongan...
echo.

:: Menjalankan Server & Bot di background
start /b node server.js
start /b node bot.js

:: Tunggu 2 detik biar server siap
timeout /t 2 /nobreak >nul

echo 🚀 Membuka Dashboard di Browser...
start http://localhost:5000

echo.
echo ✅ SEMUA SUDAH JALAN!
echo Jangan tutup jendela CMD ini kalau mau tetep pake web/bot-nya.
echo Kalau sudah selesai, tinggal tutup jendela ini.
pause
