@echo off
rem ============================================================
rem  RPG 2D - Les Terres Oubliees : lance le jeu
rem  Double-clique sur ce fichier pour jouer.
rem ============================================================
cd /d "%~dp0"
title RPG 2D - Lanceur du jeu

rem --- port 8000 deja occupe ? on ouvre direct ---
netstat -ano | findstr ":8000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto open

rem --- demarre le serveur HTTP (python) en fenetre minimisee ---
where py >nul 2>&1
if %errorlevel%==0 (
    start "RPG2D - Serveur local (port 8000)" /min py -3 -m http.server 8000
) else (
    start "RPG2D - Serveur local (port 8000)" /min python -m http.server 8000
)

rem --- attente que le serveur reponde (max ~10 s) ---
set /a tries=0
:wait
set /a tries+=1
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient).Connect('127.0.0.1',8000); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto open
if %tries% GEQ 20 goto open
ping -n 1 127.0.0.1 >nul
goto wait

:open
start "" "http://localhost:8000"
timeout /t 3 >nul
exit /b
