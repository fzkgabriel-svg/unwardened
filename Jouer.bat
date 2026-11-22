@echo off
rem ============================================================
rem  RPG 2D - Les Terres Oubliees : lance le serveur local + jeu
rem ============================================================
cd /d "%~dp0"

rem --- le serveur tourne-t-il deja ? ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:8000/' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto open

rem --- demarre le serveur HTTP en fenetre minimisee ---
where py >nul 2>&1
if %errorlevel%==0 (set "PY=py") else (set "PY=python")
start "RPG2D - Serveur local (port 8000)" /min %PY% -m http.server 8000
timeout /t 2 /nobreak >nul

:open
start "" "http://localhost:8000"
exit /b
