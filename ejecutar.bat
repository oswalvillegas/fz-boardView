@echo off
setlocal
cd /d "%~dp0"
title FZ BoardView - Ejecutar

echo ============================================================
echo    FZ BoardView - Ejecutar
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :nonode

if not exist "node_modules" goto :nomodulos

if "%PORT%"=="" set "PORT=9000"

echo Elige como quieres abrir el programa:
echo.
echo   1) Navegador  (servidor web, recarga rapida al modificar)
echo   2) App Electron (ventana propia de escritorio)
echo.
set /p MODO=Opcion [1]: 

if "%MODO%"=="2" goto :electron
goto :navegador

:navegador
echo.
echo Iniciando servidor en http://localhost:%PORT%
echo Para detenerlo, cierra esta ventana (o pulsa Ctrl+C).
echo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"
call npm start
goto :fin

:electron
echo.
echo Iniciando FZ BoardView en ventana de Electron...
echo Para detenerlo, cierra la ventana o pulsa Ctrl+C.
echo.
call npm run app
goto :fin

:fin
echo.
echo El programa se detuvo.
echo.
pause
exit /b 0

:nonode
echo [ERROR] Node.js no esta instalado o no esta en el PATH.
echo Descargalo desde: https://nodejs.org  (version LTS)
echo.
pause
exit /b 1

:nomodulos
echo [ERROR] Faltan las dependencias del proyecto.
echo Ejecuta primero  instalar.bat
echo.
pause
exit /b 1